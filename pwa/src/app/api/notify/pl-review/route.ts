 /**
  * POST /api/notify/pl-review
 * body: { projectId: string, ym: string, taskKind: "budget"|"reportFix", taskLabel: string }
  *
 * 予算例外 / 月次報告書確認の各タスクで「PL に確認依頼」を送る。
  * project_members.is_pl=true のメンバーの slack_id 全員に Slack DM を送信。
 *
 * SLACK_BOT_TOKEN env が必須。未設定なら graceful skip。
 * design/routine.md #13 参照。
 */

import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import { calcPjBudget, createBudgetApprovalToken, numberValue } from "@/lib/budget-approval";

interface Body {
  projectId?: string;
  ym?: string;
  taskKind?: string;
  taskLabel?: string;
}

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";

function fmtYen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const { projectId, ym, taskKind, taskLabel } = body;
  if (!projectId || !ym || !taskKind || !taskLabel) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "no SLACK_BOT_TOKEN" });
  }

  const supabase = createAdminClient();

  // PL 一覧取得 (project_members.is_pl=true)
  const { data: pmRows, error: pmError } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_pl", true)
    .eq("is_active", true);
  if (pmError) throw pmError;
  const memberIds = (pmRows ?? []).map((r) => r.member_id);

  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "PL が登録されていません" });
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("member_id, code_name, slack_id")
    .in("member_id", memberIds);
  if (membersError) throw membersError;

  // PJ 名取得 (メッセージに使う)
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("project_name")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) throw projectError;
  const projectName = project?.project_name ?? projectId;

  // 依頼者 (今ログイン中のユーザー)
  const { data: requester } = await supabase
    .from("members")
    .select("code_name")
    .eq("email", auth.user.email.toLowerCase())
    .maybeSingle();
  const requesterName = requester?.code_name || auth.user.email;

  const ymLabel = `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
  const cockpitUrl = `${APP_BASE_URL}/project/${projectId}/cockpit?ym=${ym}&step=${taskKind}`;
  const text = `${projectName} ${ymLabel} ${taskLabel}の確認依頼`;
  const { data: cycle, error: cycleError } = await supabase
    .from("billing_cycles")
    .select("budget_reported_amount, budget_buffer_amount")
    .eq("project_id", projectId)
    .eq("ym", ym)
    .maybeSingle();
  if (cycleError) throw cycleError;

  const invoiceYen = numberValue(cycle?.budget_reported_amount);
  const bufferYen = numberValue(cycle?.budget_buffer_amount);
  const budgetYen = calcPjBudget(invoiceYen, bufferYen);
  const budgetLines = taskKind === "budget"
    ? [
        `請求額: *${fmtYen(invoiceYen)}*`,
        `バッファ: *${fmtYen(bufferYen)}*`,
        `PJ予算: *${fmtYen(budgetYen)}*`,
      ]
    : [];
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${taskLabel}* の確認依頼が届いたよ`,
          `PJ: *${projectName}*`,
          `稼働月: *${ymLabel}*`,
          `依頼者: ${requesterName}`,
          ...budgetLines,
        ].join("\n"),
      },
    },
  ];

  const client = new WebClient(token);
  let sent = 0;
  const errors: string[] = [];
  for (const m of members ?? []) {
    if (!m.slack_id) continue;
    try {
      const approvalToken = taskKind === "budget"
        ? createBudgetApprovalToken({
            projectId,
            ym,
            expectedInvoiceYen: invoiceYen,
            expectedBufferYen: bufferYen,
            expectedBudgetYen: budgetYen,
            recipientSlackId: m.slack_id,
          })
        : null;
      const elements = approvalToken
        ? [
            {
              type: "button",
              text: { type: "plain_text", text: "承認する" },
              style: "primary",
              url: `${APP_BASE_URL}/api/admin/budget-approval?mode=approve&token=${encodeURIComponent(approvalToken)}`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "差し戻す" },
              style: "danger",
              url: `${APP_BASE_URL}/api/admin/budget-approval?mode=reject&token=${encodeURIComponent(approvalToken)}`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "OSで確認" },
              url: cockpitUrl,
            },
          ]
        : [
            {
              type: "button",
              text: { type: "plain_text", text: "コックピットで確認" },
              style: "primary",
              url: cockpitUrl,
            },
          ];
      const memberBlocks = [...blocks, { type: "actions", elements }];
      const open = await client.conversations.open({ users: m.slack_id });
      const channel = open.channel?.id || m.slack_id;
      await client.chat.postMessage({ channel, text, blocks: memberBlocks });
      sent++;
    } catch (e) {
      errors.push(`${m.code_name || m.member_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, sent, plCount: memberIds.length, errors });
}
