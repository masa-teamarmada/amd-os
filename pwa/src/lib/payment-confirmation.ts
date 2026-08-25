import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentConfirmationPayload = {
  projectId: string;
  invoiceYm: string;
  sourceYms: string[];
  expectedAmountYen: number;
  expectedNetAmountYen: number;
  recipientSlackId?: string | null;
  exp: number;
};

export type PaymentConfirmSource = "slack_expected" | "slack_actual" | "freee_deal" | "freee_wallet_txn";

function tokenSecret(): string {
  const secret = process.env.PAYMENT_CONFIRM_TOKEN_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error("PAYMENT_CONFIRM_TOKEN_SECRET or CRON_SECRET is not configured");
  return secret;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signBody(body: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
}

export function createPaymentConfirmationToken(payload: Omit<PaymentConfirmationPayload, "exp"> & { exp?: number }): string {
  const exp = payload.exp ?? Date.now() + 14 * 24 * 60 * 60 * 1000;
  const body = base64Url(JSON.stringify({ ...payload, exp }));
  return `${body}.${signBody(body)}`;
}

export function verifyPaymentConfirmationToken(token: string): PaymentConfirmationPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("invalid token");
  const expected = signBody(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("invalid token signature");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PaymentConfirmationPayload;
  if (!parsed.projectId || !parsed.invoiceYm || !Array.isArray(parsed.sourceYms) || parsed.sourceYms.length === 0) {
    throw new Error("invalid token payload");
  }
  if (!parsed.exp || parsed.exp < Date.now()) throw new Error("token expired");
  return parsed;
}

function yen(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export async function confirmPaymentGroup(
  db: SupabaseClient,
  payload: PaymentConfirmationPayload,
  input: {
    amountYen: number;
    source: PaymentConfirmSource;
    actor: string;
    note?: string | null;
    freeePayload?: Record<string, unknown> | null;
    /** 実際の入金日 (freee の取引日)。分かるときは確認時刻ではなくこちらを残す */
    receivedOn?: string | null;
  }
): Promise<{ updated: number; alreadyConfirmed: number }> {
  const sourceYms = [...new Set(payload.sourceYms)].filter((ym) => /^\d{6}$/.test(ym));
  if (sourceYms.length === 0) throw new Error("sourceYms is empty");

  const { data: cycles, error: selectError } = await db
    .from("billing_cycles")
    .select("project_id, ym, payment_confirmed_at")
    .eq("project_id", payload.projectId)
    .in("ym", sourceYms);
  if (selectError) throw selectError;
  if (!cycles?.length) throw new Error("target billing cycles not found");

  const now = new Date().toISOString();
  const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(input.receivedOn ?? ""))
    ? `${input.receivedOn}T00:00:00.000Z`
    : now;
  const alreadyConfirmed = cycles.filter((cycle) => cycle.payment_confirmed_at).length;
  const { error: updateError } = await db
    .from("billing_cycles")
    .update({
      payment_confirmed_at: receivedAt,
      payment_confirmed_by: input.actor,
      status: "payment_confirmed",
      updated_at: now,
    })
    .eq("project_id", payload.projectId)
    .in("ym", sourceYms);
  if (updateError) throw updateError;

  const logRows = cycles.map((cycle) => ({
    project_id: payload.projectId,
    ym: cycle.ym,
    action: "payment_confirmed",
    actor: input.actor,
    detail: {
      source: input.source,
      invoice_ym: payload.invoiceYm,
      source_yms: sourceYms,
      amount_yen: yen(input.amountYen),
      expected_amount_yen: yen(payload.expectedAmountYen),
      expected_net_amount_yen: yen(payload.expectedNetAmountYen),
      note: input.note ?? null,
      recipient_slack_id: payload.recipientSlackId ?? null,
      freee: input.freeePayload ?? null,
      confirmed_at: now,
    },
  }));
  if (logRows.length > 0) {
    const { error: logError } = await db.from("billing_log").insert(logRows);
    if (logError) throw logError;
  }

  return { updated: cycles.length, alreadyConfirmed };
}
