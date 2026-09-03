import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPaymentsClient, type AdminPaymentsData } from "@/components/admin/AdminPaymentsClient";
import { todayJst } from "@/lib/admin-schedule/date";
import type { OperatingFact } from "@/lib/admin-schedule/types";
import { buildPaymentLedger } from "@/lib/finance/payment-ledger";
import type { CompanyPaymentObligation } from "@/lib/finance/payment-obligations";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "納付 - AMD OS" } };

const PAGE_SIZE = 1000;

async function loadPaymentsView(): Promise<AdminPaymentsData> {
  const supabase = await createClient();
  const today = todayJst();
  const errors: string[] = [];

  // 行数上限で黙って切り捨てないようページで読む。
  const obligations: CompanyPaymentObligation[] = [];
  for (let from = 0; from < 20000; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("company_payment_obligations")
      .select("*")
      .in("category", ["tax", "social_insurance"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      errors.push(`company_payment_obligations: ${error.message}`);
      break;
    }
    const page = (data ?? []) as CompanyPaymentObligation[];
    obligations.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const [occurrencesResult, factsResult] = await Promise.all([
    supabase
      .from("company_schedule_occurrences")
      .select("event_kind,title,due_on,lifecycle_status")
      .eq("current_version", true)
      .limit(20000),
    supabase.from("company_operating_facts").select("*").is("superseded_at", null).limit(1000),
  ]);
  if (occurrencesResult.error) errors.push(`company_schedule_occurrences: ${occurrencesResult.error.message}`);
  if (factsResult.error) errors.push(`company_operating_facts: ${factsResult.error.message}`);

  const { rows, summary } = buildPaymentLedger(obligations, today);
  const lastSyncedAt = obligations
    .map((row) => row.updated_at ?? null)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return {
    today,
    rows,
    summary,
    occurrences: (occurrencesResult.data ?? []) as AdminPaymentsData["occurrences"],
    facts: (factsResult.data ?? []) as OperatingFact[],
    lastSyncedAt,
    errors,
  };
}

export default async function AdminPaymentsPage() {
  const data = await loadPaymentsView();
  return (
    <Suspense fallback={<div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">納付を読み込み中…</div>}>
      <AdminPaymentsClient data={data} />
    </Suspense>
  );
}
