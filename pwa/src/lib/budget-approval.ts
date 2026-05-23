import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BudgetApprovalPayload = {
  projectId: string;
  ym: string;
  expectedInvoiceYen: number;
  expectedBufferYen: number;
  expectedBudgetYen: number;
  recipientSlackId?: string | null;
  exp: number;
};

export type BudgetApprovalDecision = "approve" | "reject";

function tokenSecret(): string {
  const secret = process.env.BUDGET_APPROVAL_TOKEN_SECRET || process.env.PAYMENT_CONFIRM_TOKEN_SECRET || process.env.CRON_SECRET;
  if (!secret) throw new Error("BUDGET_APPROVAL_TOKEN_SECRET or CRON_SECRET is not configured");
  return secret;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signBody(body: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(body).digest("base64url");
}

export function numberValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function calcPjBudget(invoiceYen: number, bufferYen: number): number {
  return Math.max(0, Math.round(numberValue(invoiceYen) * 0.65) - Math.max(0, numberValue(bufferYen)));
}

export function createBudgetApprovalToken(payload: Omit<BudgetApprovalPayload, "exp"> & { exp?: number }): string {
  const exp = payload.exp ?? Date.now() + 14 * 24 * 60 * 60 * 1000;
  const body = base64Url(JSON.stringify({ ...payload, exp }));
  return `${body}.${signBody(body)}`;
}

export function verifyBudgetApprovalToken(token: string): BudgetApprovalPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("invalid token");
  const expected = signBody(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error("invalid token signature");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BudgetApprovalPayload;
  if (!parsed.projectId || !/^\d{6}$/.test(parsed.ym)) throw new Error("invalid token payload");
  if (!parsed.exp || parsed.exp < Date.now()) throw new Error("token expired");
  return parsed;
}

export async function decideBudgetApproval(
  db: SupabaseClient,
  input: {
    projectId: string;
    ym: string;
    decision: BudgetApprovalDecision;
    actor: string;
    note?: string | null;
  }
): Promise<{
  projectId: string;
  ym: string;
  invoiceYen: number;
  bufferYen: number;
  budgetYen: number;
  status: string;
}> {
  const { data: cycle, error: cycleError } = await db
    .from("billing_cycles")
    .select("project_id, ym, status, budget_reported_amount, budget_buffer_amount")
    .eq("project_id", input.projectId)
    .eq("ym", input.ym)
    .maybeSingle();
  if (cycleError) throw cycleError;
  if (!cycle) throw new Error("billing cycle not found");

  const invoiceYen = numberValue(cycle.budget_reported_amount);
  const bufferYen = numberValue(cycle.budget_buffer_amount);
  if (invoiceYen <= 0) throw new Error("budget request has no invoice amount");

  const budgetYen = calcPjBudget(invoiceYen, bufferYen);
  const now = new Date().toISOString();
  const nextStatus = input.decision === "approve" ? "budget_confirmed" : "budget_rejected";
  const update =
    input.decision === "approve"
      ? {
          status: nextStatus,
          budget_yen: budgetYen,
          budget_confirmed_at: now,
          budget_confirmed_by: input.actor,
          member_allocations_json: null,
          updated_at: now,
        }
      : {
          status: nextStatus,
          budget_yen: null,
          budget_confirmed_at: null,
          budget_confirmed_by: input.actor,
          member_allocations_json: null,
          updated_at: now,
        };

  const { error: updateError } = await db
    .from("billing_cycles")
    .update(update)
    .eq("project_id", input.projectId)
    .eq("ym", input.ym);
  if (updateError) throw updateError;

  await db.from("billing_log").insert({
    project_id: input.projectId,
    ym: input.ym,
    action: input.decision === "approve" ? "budget_approved" : "budget_rejected",
    actor: input.actor,
    detail: {
      invoice_yen: invoiceYen,
      buffer_yen: bufferYen,
      budget_yen: budgetYen,
      decision: input.decision,
      note: input.note ?? null,
      decided_at: now,
    },
  });

  return { projectId: input.projectId, ym: input.ym, invoiceYen, bufferYen, budgetYen, status: nextStatus };
}
