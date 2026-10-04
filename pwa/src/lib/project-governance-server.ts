import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyOverviewData } from "./company-overview";
const OPEN_ACTION_STATUSES = ["open", "in_progress"];

/** 認可済みの当該PJを読み取る共通の会社概要・資金調達履歴。 */
export async function loadProjectGovernance(db: SupabaseClient, projectId: string): Promise<CompanyOverviewData> {
  const [profileRes, shareholdersRes, transactionsRes, convertiblesRes, financialsRes, roundsRes, meetingsRes, actionsRes] = await Promise.all([
    db.from("project_company_profiles").select("*").eq("project_id", projectId).maybeSingle(),
    db.from("project_shareholders").select("*").eq("project_id", projectId).order("holder_type", { ascending: true }),
    db.from("project_equity_transactions").select("*, project_equity_entries(*)").eq("project_id", projectId).order("effective_on", { ascending: true }).order("created_at", { ascending: true }),
    db.from("project_convertible_instruments").select("*").eq("project_id", projectId).order("issued_on", { ascending: false, nullsFirst: false }),
    db.from("project_financial_periods").select("*").eq("project_id", projectId).order("fiscal_year", { ascending: false }),
    db.from("project_valuation_rounds").select("*").eq("project_id", projectId).order("round_date", { ascending: false, nullsFirst: false }),
    db.from("project_shareholder_meetings").select("*").eq("project_id", projectId).order("meeting_date", { ascending: false, nullsFirst: false }),
    db.from("action_items").select("*").eq("project_id", projectId).eq("review_status", "confirmed").in("status", OPEN_ACTION_STATUSES).neq("source", "meeting_summary").order("due_at", { ascending: true, nullsFirst: false }),
  ]);

  const error = [profileRes, shareholdersRes, transactionsRes, convertiblesRes, financialsRes, roundsRes, meetingsRes, actionsRes]
    .map((result) => result.error)
    .find(Boolean);
  if (error) throw new Error(error.message);

  return {
    profile: profileRes.data ?? null,
    shareholders: shareholdersRes.data ?? [],
    transactions: transactionsRes.data ?? [],
    convertibles: convertiblesRes.data ?? [],
    financialPeriods: financialsRes.data ?? [],
    rounds: roundsRes.data ?? [],
    meetings: meetingsRes.data ?? [],
    actionItems: actionsRes.data ?? [],
  };
}
