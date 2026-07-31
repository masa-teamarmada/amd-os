import { createClient } from "@/lib/supabase/server";
import {
  AdminFinanceClient,
  type FinanceReceiptEvent,
  type FinanceRecurringItem,
} from "@/components/admin/AdminFinanceClient";
import { PaymentObligationsPanel } from "@/components/admin/PaymentObligationsPanel";
import { FreeeReconciliationRail } from "@/components/admin/FreeeReconciliationRail";
import type { CompanyPaymentObligation } from "@/lib/finance/payment-obligations";
import { loadOfficerReserve } from "@/lib/finance/officer-compensation";
import { loadReconciliationOverview } from "@/lib/finance/freee-reconciliation-client";
import { currentYmJst } from "@/lib/payment-groups";

export default async function AdminFinancePage() {
  const supabase = await createClient();
  const paymentYm = currentYmJst();
  const [
    { data: recurringItems, error: itemError },
    { data: receiptEvents, error: receiptError },
    { data: obligations, error: obligationsError },
    officerReserve,
    reconciliationOverview,
  ] = await Promise.all([
    supabase
      .from("company_finance_recurring_items")
      .select("*")
      .order("status", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("company_finance_receipt_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("company_payment_obligations")
      .select("*")
      .order("status", { ascending: true })
      .order("expected_payment_ym", { ascending: true, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(2000),
    loadOfficerReserve(supabase, paymentYm),
    loadReconciliationOverview(supabase),
  ]);

  if (itemError) console.error("AdminFinancePage items:", itemError.message);
  if (receiptError) console.error("AdminFinancePage receipts:", receiptError.message);
  if (obligationsError) console.error("AdminFinancePage obligations:", obligationsError.message);

  const items = (recurringItems ?? []) as FinanceRecurringItem[];
  const receipts = (receiptEvents ?? []) as FinanceReceiptEvent[];
  const paymentObligations = (obligations ?? []) as CompanyPaymentObligation[];

  return (
    <div className="space-y-5">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">Finance Ops</h1>
        <span className="text-sm text-muted-foreground">
          recurring {items.length} / receipts {receipts.length}
        </span>
      </div>
      <FreeeReconciliationRail initialOverview={reconciliationOverview} />
      <PaymentObligationsPanel initialObligations={paymentObligations} />
      <AdminFinanceClient recurringItems={items} receiptEvents={receipts} officerReserve={officerReserve} />
    </div>
  );
}
