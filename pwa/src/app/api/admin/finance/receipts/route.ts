import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

type ReceiptEvent = {
  id: string;
  recurring_item_id: string | null;
  ym: string | null;
  receipt_date: string | null;
  vendor_name: string | null;
  amount_yen: number | null;
  currency: string;
  payment_method: string | null;
  withdrawal_account: string | null;
  subject: string | null;
  source_kind: string;
  source_ref: string | null;
  raw_hash: string | null;
  status: string;
  payload: Record<string, unknown>;
};

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function cleanYm(value: unknown): string | null {
  const text = cleanString(value);
  return text && /^[0-9]{6}$/.test(text) ? text : null;
}

function ymFromReceipt(receipt: ReceiptEvent) {
  if (receipt.ym) return receipt.ym;
  if (receipt.receipt_date) return receipt.receipt_date.slice(0, 7).replace("-", "");
  return null;
}

async function loadReceipt(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("company_finance_receipt_events")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as ReceiptEvent;
}

async function syncReceiptActual(receipt: ReceiptEvent) {
  const ym = ymFromReceipt(receipt);
  const amount = Number(receipt.amount_yen ?? 0);
  if (!ym) throw new Error("receipt ym or receipt_date is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("receipt amount_yen is required");

  const supabase = createAdminClient();
  let category = "fixed_cost";
  let accountName = receipt.vendor_name || receipt.subject || "receipt";
  let recurringPayload: Record<string, unknown> | null = null;

  if (receipt.recurring_item_id) {
    const { data: item, error } = await supabase
      .from("company_finance_recurring_items")
      .select("*")
      .eq("id", receipt.recurring_item_id)
      .single();
    if (error) throw error;
    category = item.category || category;
    accountName = item.display_name || accountName;
    recurringPayload = item;
  }

  const sourceRef = `company_finance_receipt_events:${receipt.id}`;
  await supabase
    .from("company_actual_monthly")
    .delete()
    .eq("ym", ym)
    .eq("scope", "company")
    .eq("source_ref", sourceRef);

  const { error: insertError } = await supabase.from("company_actual_monthly").insert({
    ym,
    scope: "company",
    project_id: null,
    category,
    account_name: accountName,
    actual_amount_yen: Math.round(amount),
    source_ref: sourceRef,
    raw_hash: receipt.raw_hash,
    payload: {
      financeReceiptEventId: receipt.id,
      recurringItemId: receipt.recurring_item_id,
      sourceKind: receipt.source_kind,
      sourceRef: receipt.source_ref,
      subject: receipt.subject,
      paymentMethod: receipt.payment_method,
      withdrawalAccount: receipt.withdrawal_account,
      recurringItem: recurringPayload,
    },
  });
  if (insertError) throw insertError;

  const now = new Date().toISOString();
  const { error: receiptError } = await supabase
    .from("company_finance_receipt_events")
    .update({ actual_synced_at: now, status: "synced", updated_at: now })
    .eq("id", receipt.id);
  if (receiptError) throw receiptError;

  if (receipt.recurring_item_id) {
    await supabase
      .from("company_finance_recurring_items")
      .update({ last_receipt_at: now, updated_at: now })
      .eq("id", receipt.recurring_item_id);
  }

  return { ym, category, accountName, amount: Math.round(amount) };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action === "syncActual") {
      const id = cleanString(body.id);
      if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
      const receipt = await loadReceipt(id);
      const result = await syncReceiptActual(receipt);
      return NextResponse.json({ ok: true, receiptId: id, actual: result });
    }

    const payload = {
      recurring_item_id: cleanString(body.recurring_item_id),
      ym: cleanYm(body.ym),
      receipt_date: cleanString(body.receipt_date),
      vendor_name: cleanString(body.vendor_name),
      amount_yen: Number(body.amount_yen ?? 0) || null,
      currency: cleanString(body.currency) ?? "JPY",
      payment_method: cleanString(body.payment_method),
      withdrawal_account: cleanString(body.withdrawal_account),
      subject: cleanString(body.subject),
      source_kind: cleanString(body.source_kind) ?? "manual",
      source_ref: cleanString(body.source_ref),
      raw_hash: cleanString(body.raw_hash),
      status: cleanString(body.status) ?? "candidate",
      payload: (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("company_finance_receipt_events")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;

    let actual: Awaited<ReturnType<typeof syncReceiptActual>> | null = null;
    if (data.status === "confirmed" || data.status === "synced") {
      actual = await syncReceiptActual(data as ReceiptEvent);
    }
    return NextResponse.json({ ok: true, receipt: data, actual });
  } catch (err) {
    console.error("[admin finance receipts POST]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
