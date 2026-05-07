/**
 * POST /api/notify/pl-review
 * body: { projectId: string, ym: string, taskKind: "budget"|"reportFix"|"invoiceIssue"|"estimateSend", taskLabel: string }
 *
 * 予算確定 / 月次報告書 / 請求書発行 の各タスクで「PL に確認依頼」を送る。
 * project_members.is_pl=true のメンバーの slack_id 全員に Slack DM を送信。
 *
 * SLACK_BOT_TOKEN env が必須。未設定なら graceful skip。
 * design/routine.md #13 参照。
 */

import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";

interface Body {
  projectId?: string;
  ym?: string;
  taskKind?: string;
  taskLabel?: string;
}

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";

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
  const { data: pmRows } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_pl", true)
    .eq("is_active", true);
  const memberIds = (pmRows ?? []).map((r) => r.member_id);

  if (memberIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "PL が登録されていません" });
  }

  const { data: members } = await supabase
    .from("members")
    .select("member_id, code_name, slack_id")
    .in("member_id", memberIds);

  // PJ 名取得 (メッセージに使う)
  const { data: project } = await supabase
    .from("projects")
    .select("project_name")
    .eq("project_id", projectId)
    .maybeSingle();
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
  const text = `:bell: *${taskLabel}* の確認依頼が届きました\n\nPJ: *${projectName}* (${ymLabel}稼働分)\n依頼者: ${requesterName}\n\n→ <${cockpitUrl}|コックピットで確認する>`;

  const client = new WebClient(token);
  let sent = 0;
  const errors: string[] = [];
  for (const m of members ?? []) {
    if (!m.slack_id) continue;
    try {
      await client.chat.postMessage({ channel: m.slack_id, text });
      sent++;
    } catch (e) {
      errors.push(`${m.code_name || m.member_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, sent, plCount: memberIds.length, errors });
}
