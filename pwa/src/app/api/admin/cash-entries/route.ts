// 口座の入出金明細の追加・書き換え・削除。正本は pwa/manual/6-12-cash-and-loans-spec.md。
// これがあることで、きよはスプレッドシートに戻らずに OS だけで記録を続けられる。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateCashAndLoansCache } from "@/lib/finance/cash-and-loans";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function int(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function str(value: unknown): string | null {
  const s = value == null ? "" : String(value).trim();
  return s === "" ? null : s;
}

type Payload = {
  id?: string;
  accountId?: string;
  entryDate?: string;
  seq?: number;
  counterparty?: string;
  transferName?: string;
  withdrawal?: number | string;
  deposit?: number | string;
  balance?: number | string | null;
  category?: string;
  targetMonth?: string;
  note?: string;
  isPlanned?: boolean;
};

function toRow(body: Payload) {
  return {
    account_id: body.accountId,
    entry_date: body.entryDate,
    seq: Number.isFinite(body.seq) ? Number(body.seq) : 0,
    counterparty: str(body.counterparty),
    transfer_name: str(body.transferName),
    withdrawal: int(body.withdrawal),
    deposit: int(body.deposit),
    balance: body.balance === null || body.balance === "" || body.balance === undefined ? null : int(body.balance),
    category: str(body.category),
    target_month: str(body.targetMonth),
    note: str(body.note),
    is_planned: body.isPlanned === true,
    source: "manual",
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: NO_STORE });
  }
  if (!body.accountId || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate ?? ""))) {
    return NextResponse.json(
      { ok: false, error: "口座と日付は必ず入れてね" },
      { status: 400, headers: NO_STORE },
    );
  }

  const supabase = createAdminClient();
  const row = toRow(body);
  const { data, error } = body.id
    ? await supabase.from("cash_ledger_entries").update(row).eq("id", body.id).select("id").maybeSingle()
    : await supabase.from("cash_ledger_entries").insert(row).select("id").maybeSingle();

  if (error) {
    console.error("[admin cash entries POST]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }
  invalidateCashAndLoansCache();
  return NextResponse.json({ ok: true, id: data?.id ?? body.id ?? null }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400, headers: NO_STORE });

  const supabase = createAdminClient();
  const { error } = await supabase.from("cash_ledger_entries").delete().eq("id", id);
  if (error) {
    console.error("[admin cash entries DELETE]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }
  invalidateCashAndLoansCache();
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
