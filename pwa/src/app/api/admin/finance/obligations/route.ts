import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const CATEGORIES = new Set(["tax", "social_insurance", "payroll", "reimbursement", "reward", "invoice", "subscription", "loan", "card_payment", "other"]);
const STATUSES = new Set(["needs_review", "open", "scheduled", "paid", "cancelled"]);
const AMOUNT_STATUSES = new Set(["exact", "estimated", "unknown"]);
const PRECISIONS = new Set(["day", "month", "unknown"]);
const CASHFLOW_TREATMENTS = new Set(["additive", "included_in_budget"]);

function text(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
}

function enumValue(value: unknown, allowed: Set<string>, fallback: string): string {
  const result = text(value);
  return result && allowed.has(result) ? result : fallback;
}

function nullableAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? Math.round(result) : null;
}

function isoDate(value: unknown): string | null {
  const result = text(value);
  return result && /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

function ym(value: unknown): string | null {
  const result = text(value);
  return result && /^\d{6}$/.test(result) ? result : null;
}

function authorizedByCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

async function authorize(req: NextRequest) {
  if (authorizedByCron(req)) return null;
  const auth = await requireAdmin();
  return auth.ok ? null : auth.errorResponse;
}

function createPayload(input: Record<string, unknown>, index = 0) {
  const amount = nullableAmount(input.amount_yen ?? input.amountYen);
  const dueDate = isoDate(input.due_date ?? input.dueDate);
  const expectedYm = ym(input.expected_payment_ym ?? input.expectedPaymentYm) ?? dueDate?.slice(0, 7).replace("-", "") ?? null;
  const amountStatus = enumValue(
    input.amount_status ?? input.amountStatus,
    AMOUNT_STATUSES,
    amount == null ? "unknown" : "exact"
  );
  const duePrecision = enumValue(
    input.due_date_precision ?? input.dueDatePrecision,
    PRECISIONS,
    dueDate ? "day" : expectedYm ? "month" : "unknown"
  );
  const sourceKind = text(input.source_kind ?? input.sourceKind) ?? "manual";
  const sourceKey = text(input.source_key ?? input.sourceKey) ?? `manual:${crypto.randomUUID()}:${index}`;
  const status = enumValue(input.status, STATUSES, amount != null && expectedYm ? "open" : "needs_review");
  const paidAt = status === "paid" ? text(input.paid_at ?? input.paidAt) ?? new Date().toISOString() : null;
  return {
    source_key: sourceKey,
    title: text(input.title) ?? "支払義務",
    counterparty: text(input.counterparty),
    category: enumValue(input.category, CATEGORIES, "other"),
    amount_yen: amount,
    amount_status: amountStatus,
    due_date: dueDate,
    due_date_precision: duePrecision,
    expected_payment_ym: expectedYm,
    status,
    cashflow_treatment: enumValue(input.cashflow_treatment ?? input.cashflowTreatment, CASHFLOW_TREATMENTS, "additive"),
    budget_category: text(input.budget_category ?? input.budgetCategory),
    auto_debit: typeof input.auto_debit === "boolean" ? input.auto_debit : typeof input.autoDebit === "boolean" ? input.autoDebit : null,
    owner_member_id: text(input.owner_member_id ?? input.ownerMemberId),
    source_kind: sourceKind,
    source_ref: text(input.source_ref ?? input.sourceRef),
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8) || 0.8)),
    paid_at: paidAt,
    paid_amount_yen: status === "paid" ? nullableAmount(input.paid_amount_yen ?? input.paidAmountYen) ?? amount : null,
    payload: typeof input.payload === "object" && input.payload !== null && !Array.isArray(input.payload) ? input.payload : {},
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const unauthorized = await authorize(req);
  if (unauthorized) return unauthorized;
  const status = text(req.nextUrl.searchParams.get("status"));
  const db = createAdminClient();
  let query = db.from("company_payment_obligations").select("*").order("expected_payment_ym", { ascending: true, nullsFirst: false }).order("due_date", { ascending: true, nullsFirst: false });
  if (status && STATUSES.has(status)) query = query.eq("status", status);
  const { data, error } = await query.limit(2000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, obligations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const unauthorized = await authorize(req);
  if (unauthorized) return unauthorized;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const inputs = Array.isArray(body.items) ? body.items : [body];
    const payloads = inputs
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
      .map(createPayload);
    if (!payloads.length) return NextResponse.json({ ok: false, error: "items are required" }, { status: 400 });
    const { data, error } = await createAdminClient()
      .from("company_payment_obligations")
      .upsert(payloads, { onConflict: "source_key" })
      .select("*");
    if (error) throw error;
    return NextResponse.json({ ok: true, obligations: data ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await authorize(req);
  if (unauthorized) return unauthorized;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = text(body.id);
    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    const payload: Record<string, unknown> = { ...createPayload(body), reviewed_at: new Date().toISOString() };
    delete payload.source_key;
    delete payload.source_kind;
    if (!("payload" in body)) delete payload.payload;
    const { data, error } = await createAdminClient()
      .from("company_payment_obligations")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, obligation: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
