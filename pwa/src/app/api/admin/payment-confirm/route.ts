import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  confirmPaymentGroup,
  verifyPaymentConfirmationToken,
  type PaymentConfirmationPayload,
} from "@/lib/payment-confirmation";

export const runtime = "nodejs";

function yen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
}

function html(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;margin:0;display:grid;min-height:100vh;place-items:center;color:#1d1d1f}.box{width:min(520px,calc(100vw - 32px));background:#fff;border:1px solid #d2d2d7;border-radius:12px;padding:24px;box-shadow:0 16px 50px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 12px}.meta{font-size:13px;color:#6e6e73;line-height:1.7}.ok{color:#047857;font-weight:700}.err{color:#b91c1c;font-weight:700}a{color:#0f766e}</style></head><body><main class="box">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function projectLabel(payload: PaymentConfirmationPayload) {
  const db = createAdminClient();
  const { data } = await db
    .from("projects")
    .select("project_name")
    .eq("project_id", payload.projectId)
    .maybeSingle();
  return data?.project_name || payload.projectId;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const mode = req.nextUrl.searchParams.get("mode") || "";
  try {
    const payload = verifyPaymentConfirmationToken(token);
    const projectName = await projectLabel(payload);

    if (mode === "expected") {
      const db = createAdminClient();
      const result = await confirmPaymentGroup(db, payload, {
        amountYen: payload.expectedAmountYen,
        source: "slack_expected",
        actor: payload.recipientSlackId ? `slack:${payload.recipientSlackId}` : "slack:payment-confirm",
        note: "Slack button: expected amount received",
      });
      return html(
        "入金確認完了 - AMD OS",
        `<h1 class="ok">入金確認をOSに反映したよ</h1><p class="meta">PJ: <strong>${esc(projectName)}</strong><br>支払月: ${payload.invoiceYm}<br>対象月: ${payload.sourceYms.join(", ")}<br>入金額: ${yen(payload.expectedAmountYen)}<br>更新: ${result.updated} cycle</p>`
      );
    }

    return NextResponse.json({
      ok: true,
      projectId: payload.projectId,
      projectName,
      invoiceYm: payload.invoiceYm,
      sourceYms: payload.sourceYms,
      expectedAmountYen: payload.expectedAmountYen,
      expectedNetAmountYen: payload.expectedNetAmountYen,
    });
  } catch (e) {
    if (mode === "expected") {
      return html("入金確認エラー - AMD OS", `<h1 class="err">入金確認できなかった</h1><p class="meta">${esc(e instanceof Error ? e.message : String(e))}</p>`, 400);
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; amountYen?: number; note?: string | null };
    const payload = verifyPaymentConfirmationToken(body.token || "");
    const amountYen = Number(body.amountYen ?? 0);
    if (!Number.isFinite(amountYen) || amountYen <= 0) {
      return NextResponse.json({ ok: false, error: "amountYen must be positive" }, { status: 400 });
    }
    const db = createAdminClient();
    const result = await confirmPaymentGroup(db, payload, {
      amountYen,
      source: "slack_actual",
      actor: payload.recipientSlackId ? `slack:${payload.recipientSlackId}` : "slack:payment-confirm",
      note: body.note ?? "Slack form: actual amount received",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
