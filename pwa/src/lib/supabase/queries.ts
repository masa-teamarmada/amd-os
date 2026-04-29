import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingRow, MilestoneRow, ProtocolRow } from "@/types/dashboard";
import { currentYmJST } from "@/lib/utils/format";

export async function getDashboardData(supabase: SupabaseClient) {
  const ym = currentYmJST();

  const [billingRes, milestoneRes, protocolRes] = await Promise.all([
    supabase.from("v_billing_dashboard").select("*").eq("ym", ym),
    supabase
      .from("v_milestone_dashboard")
      .select("*")
      .or("progress_pct.is.null,progress_pct.lt.100"),
    supabase
      .from("v_protocol_summary")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return {
    billing: (billingRes.data ?? []) as BillingRow[],
    milestones: (milestoneRes.data ?? []) as MilestoneRow[],
    protocols: (protocolRes.data ?? []) as ProtocolRow[],
    currentYm: ym,
  };
}
