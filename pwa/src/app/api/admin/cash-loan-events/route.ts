// 借入・返済の記録。正本は pwa/manual/6-12-cash-and-loans-spec.md。
// PayPay銀行の枠は何度も借りて返すので、その都度ここへ1行足すと残高と利息が更新される。
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateCashAndLoansCache } from "@/lib/finance/cash-and-loans";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const KINDS = new Set(["drawdown", "repayment", "fee"]);

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
  loanId?: string;
  eventDate?: string;
  kind?: string;
  amount?: number | string;
  principalAmount?: number | string | null;
  interestAmount?: number | string | null;
  isPlanned?: boolean;
  note?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400, headers: NO_STORE });
  }
  if (!body.loanId || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.eventDate ?? "")) || !KINDS.has(String(body.kind))) {
    return NextResponse.json(
      { ok: false, error: "借入先・日付・種類 (借入 / 返済) は必ず入れてね" },
      { status: 400, headers: NO_STORE },
    );
  }

  const amount = int(body.amount);
  if (amount <= 0) {
    return NextResponse.json({ ok: false, error: "金額は1円以上で入れてね" }, { status: 400, headers: NO_STORE });
  }

  // 返済で内訳を入れなかったときは、全額を元金として扱う。
  const principal =
    body.principalAmount === null || body.principalAmount === undefined || body.principalAmount === ""
      ? body.kind === "fee" ? 0 : amount - int(body.interestAmount)
      : int(body.principalAmount);

  const row = {
    loan_id: body.loanId,
    event_date: body.eventDate,
    kind: body.kind,
    amount,
    principal_amount: principal,
    interest_amount: body.interestAmount === null || body.interestAmount === undefined || body.interestAmount === ""
      ? null : int(body.interestAmount),
    is_planned: body.isPlanned === true,
    note: str(body.note),
    source: "manual",
    updated_at: new Date().toISOString(),
  };

  const supabase = createAdminClient();
  const { data, error } = body.id
    ? await supabase.from("loan_events").update(row).eq("id", body.id).select("id").maybeSingle()
    : await supabase.from("loan_events").insert(row).select("id").maybeSingle();

  if (error) {
    console.error("[admin cash loan-events POST]", error);
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
  const { error } = await supabase.from("loan_events").delete().eq("id", id);
  if (error) {
    console.error("[admin cash loan-events DELETE]", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }
  invalidateCashAndLoansCache();
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
