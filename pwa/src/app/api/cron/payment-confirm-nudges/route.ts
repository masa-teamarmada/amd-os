import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createPaymentConfirmationToken } from "@/lib/payment-confirmation";
import { cleanYm, currentYmJst, loadPaymentConfirmationGroups } from "@/lib/payment-groups";

export const runtime = "nodejs";

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";
const ENABLE_SLACK_INTERACTIVE_CONFIRM = process.env.PAYMENT_CONFIRM_SLACK_INTERACTIVE === "1";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return bearer === secret || req.nextUrl.searchParams.get("secret") === secret;
}

function fmtYen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function ymLabel(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

async function adminSlackTargets(db: ReturnType<typeof createAdminClient>) {
  const { data, error } = await db
    .from("members")
    .select("member_id, code_name, slack_id")
    .eq("is_admin", true)
    .eq("status", "active")
    .not("slack_id", "is", null);
  if (error) throw error;
  return (data ?? []).filter((member) => member.slack_id);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const paymentYm = cleanYm(req.nextUrl.searchParams.get("ym")) || currentYmJst();
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  return sendPaymentConfirmNudges(paymentYm, dryRun);
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
  const paymentYm = cleanYm(body.ym) || currentYmJst();
  return sendPaymentConfirmNudges(paymentYm, Boolean(body.dryRun));
}

async function sendPaymentConfirmNudges(paymentYm: string, dryRun: boolean) {
  const token = process.env.SLACK_BOT_TOKEN;
  const db = createAdminClient();

  try {
    const groups = await loadPaymentConfirmationGroups(db, paymentYm);
    const targets = await adminSlackTargets(db);
    if (!token) {
      return NextResponse.json({ ok: true, ym: paymentYm, dryRun, sent: 0, groups, skipped: "no SLACK_BOT_TOKEN" });
    }
    if (dryRun) {
      return NextResponse.json({ ok: true, ym: paymentYm, dryRun: true, targets, groups });
    }

    const client = new WebClient(token);
    const results: Array<{ projectId: string; admin: string; ok: boolean; error?: string }> = [];
    for (const group of groups) {
      if (group.expectedGrossAmountYen <= 0) continue;
      for (const admin of targets) {
        const confirmToken = createPaymentConfirmationToken({
          projectId: group.projectId,
          invoiceYm: group.invoiceYm,
          sourceYms: group.sourceYms,
          expectedAmountYen: group.expectedGrossAmountYen,
          expectedNetAmountYen: group.expectedNetAmountYen,
          recipientSlackId: admin.slack_id,
        });
        const expectedUrl = `${APP_BASE_URL}/api/admin/payment-confirm?mode=expected&token=${encodeURIComponent(confirmToken)}`;
        const actualUrl = `${APP_BASE_URL}/payment-confirm?token=${encodeURIComponent(confirmToken)}`;
        const confirmValue = JSON.stringify({
          token: confirmToken,
          projectId: group.projectId,
          projectName: group.projectName,
          invoiceYm: group.invoiceYm,
          sourceYms: group.sourceYms,
          expectedAmountYen: group.expectedGrossAmountYen,
          expectedNetAmountYen: group.expectedNetAmountYen,
        });
        const expectedButton = ENABLE_SLACK_INTERACTIVE_CONFIRM
          ? {
              type: "button",
              text: { type: "plain_text", text: "予定通り入金済み" },
              style: "primary",
              action_id: "payment_confirm_expected",
              value: confirmValue,
            }
          : {
              type: "button",
              text: { type: "plain_text", text: "予定通り入金済み" },
              style: "primary",
              url: expectedUrl,
            };
        const text = `入金確認: ${group.projectName} ${ymLabel(group.invoiceYm)} ${fmtYen(group.expectedGrossAmountYen)}`;
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `*${group.projectName}* の入金確認`,
                `支払月: *${ymLabel(group.invoiceYm)}* / 対象: ${group.sourceYms.map(ymLabel).join(", ")}`,
                `予定入金額: *${fmtYen(group.expectedGrossAmountYen)}*（税抜 ${fmtYen(group.expectedNetAmountYen)}）`,
                `支払条件: ${group.dueRuleLabel} / 期日: ${group.dueDate}`,
              ].join("\n"),
            },
          },
          {
            type: "actions",
            elements: [
              expectedButton,
              { type: "button", text: { type: "plain_text", text: "金額を入力" }, url: actualUrl },
            ],
          },
        ];

        try {
          const open = await client.conversations.open({ users: admin.slack_id });
          const channel = open.channel?.id || admin.slack_id;
          await client.chat.postMessage({ channel, text, blocks });
          results.push({ projectId: group.projectId, admin: admin.code_name || admin.member_id, ok: true });
        } catch (e) {
          results.push({
            projectId: group.projectId,
            admin: admin.code_name || admin.member_id,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    return NextResponse.json({
      ok: results.every((result) => result.ok),
      ym: paymentYm,
      groupCount: groups.length,
      targetCount: targets.length,
      sent: results.filter((result) => result.ok).length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
