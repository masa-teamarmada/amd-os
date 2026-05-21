import { createClient } from "@/lib/supabase/server";
import {
  AdminFinanceClient,
  type FinanceReceiptEvent,
  type FinanceRecurringItem,
} from "@/components/admin/AdminFinanceClient";

export default async function AdminFinancePage() {
  const supabase = await createClient();
  const [{ data: recurringItems, error: itemError }, { data: receiptEvents, error: receiptError }] = await Promise.all([
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
  ]);

  if (itemError) console.error("AdminFinancePage items:", itemError.message);
  if (receiptError) console.error("AdminFinancePage receipts:", receiptError.message);

  const items = (recurringItems ?? []) as FinanceRecurringItem[];
  const receipts = (receiptEvents ?? []) as FinanceReceiptEvent[];

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">Finance Ops</h1>
        <span className="text-sm text-muted-foreground">
          recurring {items.length} / receipts {receipts.length}
        </span>
      </div>
      <AdminFinanceClient recurringItems={items} receiptEvents={receipts} />
    </div>
  );
}
