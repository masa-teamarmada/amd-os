import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type RecurringItem = {
  id: string;
  status: string;
  item_kind: string;
  display_name: string;
  vendor_name: string | null;
  category: string;
  amount_yen: number;
  currency: string;
  frequency: string;
  start_ym: string;
  end_ym: string | null;
  budget_forward_fill: boolean;
  auto_debit: boolean | null;
  withdrawal_account: string | null;
  payment_method: string | null;
  source_kind: string;
  source_ref: string | null;
  notes: string | null;
  payload: Record<string, unknown>;
};

const STRING_FIELDS = [
  "status",
  "item_kind",
  "display_name",
  "vendor_name",
  "category",
  "currency",
  "frequency",
  "start_ym",
  "end_ym",
  "withdrawal_account",
  "payment_method",
  "source_kind",
  "source_ref",
  "notes",
] as const;

const BOOLEAN_FIELDS = ["budget_forward_fill", "auto_debit"] as const;

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function cleanYm(value: unknown): string | null {
  const text = cleanString(value);
  return text && /^[0-9]{6}$/.test(text) ? text : null;
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function currentYm() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(ym: string, delta: number) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const zeroBasedMonth = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(zeroBasedMonth / 12);
  const nextMonth = zeroBasedMonth % 12 + 1;
  return `${nextYear}${String(nextMonth).padStart(2, "0")}`;
}

function compareYm(a: string, b: string) {
  return Number(a) - Number(b);
}

function buildPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    if (!(field in body)) continue;
    if (field === "start_ym") {
      const ym = cleanYm(body[field]);
      if (ym) patch[field] = ym;
      continue;
    }
    if (field === "end_ym") {
      patch[field] = cleanYm(body[field]);
      continue;
    }
    patch[field] = cleanString(body[field]);
  }
  for (const field of BOOLEAN_FIELDS) {
    if (field in body) patch[field] = body[field] === null ? null : Boolean(body[field]);
  }
  if ("amount_yen" in body) patch.amount_yen = numberOrZero(body.amount_yen);
  if (!patch.currency) patch.currency = "JPY";
  if (!patch.category) patch.category = "fixed_cost";
  if (!patch.status) delete patch.status;
  if (!patch.item_kind) delete patch.item_kind;
  if (!patch.frequency) delete patch.frequency;
  if (!patch.source_kind) delete patch.source_kind;
  patch.updated_at = new Date().toISOString();
  return patch;
}

function budgetMonthsForItem(item: RecurringItem) {
  const baseYm = currentYm();
  if (item.end_ym && compareYm(item.end_ym, baseYm) < 0) return [];
  const start = compareYm(item.start_ym, baseYm) < 0 ? baseYm : item.start_ym;
  if (item.frequency === "one_time" || item.frequency === "unknown") return [item.start_ym];

  const hardEnd = item.end_ym && compareYm(item.end_ym, start) >= 0
    ? item.end_ym
    : addMonths(start, 23);
  const months: string[] = [];
  let ym = start;
  for (let guard = 0; guard < 36 && compareYm(ym, hardEnd) <= 0; guard++) {
    months.push(ym);
    ym = addMonths(ym, item.frequency === "annual" ? 12 : 1);
  }
  return months;
}

async function syncBudgetRows(item: RecurringItem) {
  const supabase = createAdminClient();
  const sourceRef = `company_finance_recurring_items:${item.id}`;
  await supabase
    .from("company_budget_monthly")
    .delete()
    .eq("source", "finance_recurring_item")
    .eq("source_ref", sourceRef);

  if (!item.budget_forward_fill || item.status !== "active" || item.amount_yen <= 0) {
    const { error } = await supabase
      .from("company_finance_recurring_items")
      .update({ last_budget_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) throw error;
    return { inserted: 0 };
  }

  const rows = budgetMonthsForItem(item).map((ym) => ({
    ym,
    scope: "company",
    project_id: null,
    category: item.category || "fixed_cost",
    account_name: item.display_name,
    budget_amount_yen: item.amount_yen,
    cash_amount_yen: null,
    runway_months: null,
    payload: {
      financeRecurringItemId: item.id,
      itemKind: item.item_kind,
      vendorName: item.vendor_name,
      frequency: item.frequency,
      autoDebit: item.auto_debit,
      withdrawalAccount: item.withdrawal_account,
      paymentMethod: item.payment_method,
    },
    note: "Budget forward-filled from admin finance recurring item",
    source: "finance_recurring_item",
    source_ref: sourceRef,
    version: "active",
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("company_budget_monthly").insert(rows);
    if (error) throw error;
  }

  const { error } = await supabase
    .from("company_finance_recurring_items")
    .update({ last_budget_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", item.id);
  if (error) throw error;

  return { inserted: rows.length };
}

async function loadItem(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("company_finance_recurring_items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as RecurringItem;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action === "syncBudget") {
      const id = cleanString(body.id);
      if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      const item = await loadItem(id);
      const result = await syncBudgetRows(item);
      return NextResponse.json({ ok: true, itemId: id, ...result });
    }

    const payload = {
      status: "active",
      item_kind: "subscription",
      frequency: "monthly",
      start_ym: currentYm(),
      source_kind: "manual",
      ...buildPatch(body),
      display_name: cleanString(body.display_name) ?? cleanString(body.vendor_name) ?? "New recurring item",
      amount_yen: numberOrZero(body.amount_yen),
      created_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("company_finance_recurring_items")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;

    let budgetSync = { inserted: 0 };
    if (data.budget_forward_fill) budgetSync = await syncBudgetRows(data as RecurringItem);
    return NextResponse.json({ ok: true, item: data, budgetSync });
  } catch (err) {
    console.error("[admin finance recurring POST]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = cleanString(body.id);
    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

    const patch = buildPatch(body);
    delete patch.id;
    delete patch.created_at;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("company_finance_recurring_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    let budgetSync = { inserted: 0 };
    if (body.syncBudget === true) budgetSync = await syncBudgetRows(data as RecurringItem);
    return NextResponse.json({ ok: true, item: data, budgetSync });
  } catch (err) {
    console.error("[admin finance recurring PATCH]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
