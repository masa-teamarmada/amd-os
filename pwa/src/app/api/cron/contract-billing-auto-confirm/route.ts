import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { decideBudgetApproval } from "@/lib/budget-approval";
import { collectAutoConfirmCandidates } from "@/lib/contract-billing-auto";

export const runtime = "nodejs";

/**
 * つくよみ: 契約由来の請求額を毎月自動確定する cron。
 *
 * 設計 (= まさ確定 2026-06-18, ①案):
 *   contract_terms を applied にした時点 = 人 (admin) が金額を確認済み。
 *   なので毎月の「請求額確定」は つくよみ が契約由来額を自動セットして
 *   budget_confirmed まで進め、PM には「契約通りこの額で確定したよ」と事後通知する。
 *   PM は確認するだけ。手入力は不要。
 *
 * 冪等性: その月の billing_cycle がすでに reported 以降 (人が触っている) なら一切触らない。
 * 安全弁: end_ym 未設定の契約は対象外 (無期限計上事故防止 / contract-billing-auto.ts のガード)。
 *
 * 正本 spec: pwa/spec/5-6-contracts-management-current-spec.md / pwa/manual/6-3-invoice-and-billing-routine-spec.md。
 */

const TSUKUYOMI_ACTOR = "つくよみ(契約自動確定)";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function currentYmJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cleanYm(value: string | null): string {
  return value && /^\d{6}$/.test(value) ? value : "";
}

function fmtYen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function ymLabel(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ym = cleanYm(req.nextUrl.searchParams.get("ym")) || currentYmJst();
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  return runAutoConfirm(ym, dryRun);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  let body: { ym?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const ym = cleanYm(body.ym ?? null) || currentYmJst();
  return runAutoConfirm(ym, Boolean(body.dryRun));
}

async function runAutoConfirm(ym: string, dryRun: boolean) {
  const db = createAdminClient();
  const slackToken = process.env.SLACK_BOT_TOKEN;

  try {
    const candidates = await collectAutoConfirmCandidates(db, ym);
    const actionable = candidates.filter((c) => !c.alreadyProgressed);
    const skipped = candidates.filter((c) => c.alreadyProgressed);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        ym,
        dryRun: true,
        actionable: actionable.map((c) => ({
          projectId: c.resolution.projectId,
          projectName: c.project.project_name,
          invoiceYen: c.resolution.invoiceYen,
          bufferYen: c.resolution.bufferYen,
          budgetYen: c.resolution.budgetYen,
          source: c.resolution.source,
          currentStatus: c.cycle?.status ?? "not_started",
        })),
        skipped: skipped.map((c) => ({
          projectId: c.resolution.projectId,
          currentStatus: c.cycle?.status,
          reason: "already progressed by human",
        })),
      });
    }

    const slack = slackToken ? new WebClient(slackToken) : null;
    const results: Array<Record<string, unknown>> = [];

    for (const c of actionable) {
      const { projectId, invoiceYen, bufferYen } = c.resolution;
      try {
        // 1) 請求額を契約由来額でセット (status='reported' へ)
        const now = new Date().toISOString();
        const { error: upErr } = await db
          .from("billing_cycles")
          .upsert(
            {
              project_id: projectId,
              ym,
              status: "reported",
              budget_reported_amount: invoiceYen,
              budget_buffer_amount: bufferYen,
              budget_reported_at: now,
              budget_reported_by: TSUKUYOMI_ACTOR,
              updated_at: now,
            },
            { onConflict: "project_id,ym" },
          );
        if (upErr) throw upErr;

        // 2) そのまま承認まで進める (budget_confirmed)。budget_yen = 請求額×0.65 - 契約バッファ消化額
        const decided = await decideBudgetApproval(db, {
          projectId,
          ym,
          decision: "approve",
          actor: TSUKUYOMI_ACTOR,
          note: `契約由来額で自動確定 (source=${c.resolution.source}, buffer=${fmtYen(bufferYen)})`,
        });

        // 3) PM へ事後通知 DM (確認するだけ)
        let notified = 0;
        if (slack) {
          notified = await notifyPm(db, slack, projectId, c.project.project_name || projectId, ym, decided.invoiceYen, decided.budgetYen);
        }

        results.push({
          projectId,
          projectName: c.project.project_name,
          invoiceYen: decided.invoiceYen,
          bufferYen: decided.bufferYen,
          budgetYen: decided.budgetYen,
          source: c.resolution.source,
          status: decided.status,
          pmNotified: notified,
          ok: true,
        });
      } catch (e) {
        results.push({ projectId, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({
      ok: results.every((r) => r.ok !== false),
      ym,
      candidateCount: candidates.length,
      confirmed: results.filter((r) => r.ok).length,
      skipped: skipped.length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

async function notifyPm(
  db: ReturnType<typeof createAdminClient>,
  slack: WebClient,
  projectId: string,
  projectName: string,
  ym: string,
  invoiceYen: number,
  budgetYen: number,
): Promise<number> {
  const { data: pmRows } = await db
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("is_pm", true)
    .eq("is_active", true);
  const memberIds = (pmRows ?? []).map((r: { member_id: string }) => r.member_id);
  if (memberIds.length === 0) return 0;

  const { data: members } = await db
    .from("members")
    .select("member_id, slack_id")
    .in("member_id", memberIds)
    .not("slack_id", "is", null);

  const cockpitUrl = `${process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app"}/project/${projectId}/cockpit?ym=${ym}`;
  const text = `${projectName} ${ymLabel(ym)} の請求額を契約通り自動確定したよ (${fmtYen(invoiceYen)})`;
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `🌙 *${projectName}* ${ymLabel(ym)} 分の請求額を、契約どおり自動で確定しておいたよ〜`,
          ``,
          `請求額: *${fmtYen(invoiceYen)}*`,
          `PJ予算: *${fmtYen(budgetYen)}*`,
          ``,
          `契約から取った金額だから、基本そのままで大丈夫…。`,
          `もし今月だけ違う額になるなら、コックピットから直してね。`,
        ].join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "コックピットで確認" }, url: cockpitUrl },
      ],
    },
  ];

  let sent = 0;
  for (const m of (members ?? []) as Array<{ slack_id: string | null }>) {
    if (!m.slack_id) continue;
    try {
      const open = await slack.conversations.open({ users: m.slack_id });
      const channel = open.channel?.id || m.slack_id;
      await slack.chat.postMessage({ channel, text, blocks });
      sent += 1;
    } catch {
      // 個別 PM の通知失敗は致命ではない (確定自体は済んでいる)
    }
  }
  return sent;
}
