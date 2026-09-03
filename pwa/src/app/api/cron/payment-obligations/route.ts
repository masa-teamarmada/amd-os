import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";
import { getGoogleAuthAsync, getMemberGoogleAuth } from "@/lib/sources/google";
import { freeeApi } from "@/lib/freee-client";
import {
  addMonthsToYm,
  currentDateJst,
  currentYmJst,
  gmailObligationSourceKey,
  notificationStage,
  parsePaymentEmail,
  type CompanyPaymentObligation,
} from "@/lib/finance/payment-obligations";
import {
  addMonthsToStatutoryYm,
  buildAmdStatutoryPaymentDrafts,
  buildStatutoryPenaltyEstimates,
  type StatutoryPayrollMonth,
  type StatutoryPaymentEvidence,
  type StatutoryTaxForecast,
} from "@/lib/finance/statutory-payment-rules";

export const runtime = "nodejs";
export const maxDuration = 300;

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://amd-os-pwa.vercel.app";

type GeneratedObligation = Omit<CompanyPaymentObligation, "id" | "created_at" | "updated_at"> & {
  first_seen_at?: string;
  last_seen_at: string;
  updated_at: string;
};

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

function ymFromDate(value: string | null | undefined): string | null {
  const match = String(value ?? "").match(/^(\d{4})-?(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

function yen(value: number | null): string {
  return value == null ? "金額未確認" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}

function isActiveInMonth(item: { start_ym: string; end_ym: string | null; frequency: string }, ym: string): boolean {
  if (ym < item.start_ym || (item.end_ym && ym > item.end_ym)) return false;
  if (item.frequency === "one_time" || item.frequency === "unknown") return ym === item.start_ym;
  if (item.frequency === "annual") {
    const startMonth = Number(item.start_ym.slice(4, 6));
    return Number(ym.slice(4, 6)) === startMonth;
  }
  return true;
}

async function kiyoMember(db: ReturnType<typeof createAdminClient>) {
  const { data, error } = await db
    .from("members")
    .select("member_id, code_name, slack_id")
    .eq("code_name", "きよ")
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data?.member_id) throw new Error("active member code_name=きよ not found");
  return data as { member_id: string; code_name: string; slack_id: string | null };
}

function numeric(value: unknown): number {
  const result = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(result) ? Math.max(0, Math.round(result)) : 0;
}

function monthEndIso(ym: string): string {
  const value = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

type FreeeAccountItem = { id?: number | string; name?: string | null };
type FreeeDealDetail = {
  entry_side?: string | null;
  account_item_id?: number | string | null;
  amount?: number | string | null;
  description?: string | null;
};
type FreeeDeal = {
  id?: number | string;
  issue_date?: string | null;
  amount?: number | string | null;
  details?: FreeeDealDetail[];
};
type FreeeWalletTxn = {
  id?: number | string;
  date?: string | null;
  entry_side?: string | null;
  amount?: number | string | null;
  description?: string | null;
  walletable_type?: string | null;
};

async function fetchFreeePayrollDeals(startDate: string, endDate: string, accountItemId: string): Promise<FreeeDeal[]> {
  const deals: FreeeDeal[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const params = new URLSearchParams({
      start_issue_date: startDate,
      end_issue_date: endDate,
      account_item_id: accountItemId,
      accruals: "with",
      limit: "100",
      offset: String(offset),
    });
    const data = await freeeApi("GET", `/api/1/deals?${params.toString()}`) as { deals?: FreeeDeal[] };
    const page = data.deals ?? [];
    deals.push(...page);
    if (page.length < 100) break;
  }
  return deals;
}

async function fetchFreeeWalletEvidence(startYm: string, endYm: string): Promise<StatutoryPaymentEvidence[]> {
  const evidence: StatutoryPaymentEvidence[] = [];
  for (let ym = startYm; ym <= endYm; ym = addMonthsToStatutoryYm(ym, 1)) {
    for (let offset = 0; offset < 500; offset += 100) {
      const params = new URLSearchParams({
        start_date: `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`,
        end_date: monthEndIso(ym),
        entry_side: "expense",
        limit: "100",
        offset: String(offset),
      });
      const data = await freeeApi("GET", `/api/1/wallet_txns?${params.toString()}`) as { wallet_txns?: FreeeWalletTxn[] };
      const page = data.wallet_txns ?? [];
      for (const row of page) {
        if (!row.id || !row.date || row.walletable_type !== "bank_account") continue;
        const description = String(row.description ?? "");
        const kind = /シヤカイホケン|社会保険/.test(description)
          ? "social_insurance"
          : /ロウドウホケン|労働保険/.test(description)
            ? "labor_insurance"
            : /ゼイムシヨ|税務署/.test(description)
              ? "tax_office"
              : /チホウゼイ|地方税/.test(description)
                ? "local_tax"
                : null;
        if (!kind) continue;
        evidence.push({
          kind,
          date: row.date,
          amountYen: numeric(row.amount),
          sourceRef: `freee:wallet_txn:${row.id}`,
        });
      }
      if (page.length < 100) break;
    }
  }
  return evidence;
}

async function fetchFreeeStatutoryInputs(today: string): Promise<{
  payrollMonths: StatutoryPayrollMonth[];
  paymentEvidence: StatutoryPaymentEvidence[];
}> {
  const currentYear = Number(today.slice(0, 4));
  const accountItems = await freeeApi("GET", "/api/1/account_items?limit=500") as { account_items?: FreeeAccountItem[] };
  const byName = new Map((accountItems.account_items ?? []).map((row) => [String(row.name ?? ""), String(row.id ?? "")]));
  const withheldId = byName.get("預り金");
  const legalBenefitsId = byName.get("法定福利費");
  if (!withheldId || !legalBenefitsId) throw new Error("freee account items for payroll liabilities were not found");

  const deals = await fetchFreeePayrollDeals(`${currentYear - 1}-01-01`, today, withheldId);
  const payrollByYm = new Map<string, StatutoryPayrollMonth>();
  const rowFor = (ym: string) => {
    const existing = payrollByYm.get(ym);
    if (existing) return existing;
    const created: StatutoryPayrollMonth = {
      ym,
      withholdingIncomeTaxYen: null,
      withholdingObserved: false,
      socialInsuranceYen: null,
      socialInsuranceObserved: false,
      residentTaxYen: null,
      residentTaxObserved: false,
    };
    payrollByYm.set(ym, created);
    return created;
  };

  for (const deal of deals) {
    const ym = ymFromDate(deal.issue_date);
    if (!ym) continue;
    const target = rowFor(ym);
    let socialDeal = false;
    for (const detail of deal.details ?? []) {
      const accountId = String(detail.account_item_id ?? "");
      const description = String(detail.description ?? "");
      const signedAmount = numeric(detail.amount) * (detail.entry_side === "debit" ? -1 : 1);
      if (accountId === withheldId && /源泉所得税/.test(description)) {
        target.withholdingObserved = true;
        target.withholdingIncomeTaxYen = (target.withholdingIncomeTaxYen ?? 0) + signedAmount;
      }
      if (accountId === withheldId && /住民税/.test(description)) {
        target.residentTaxObserved = true;
        target.residentTaxYen = (target.residentTaxYen ?? 0) + signedAmount;
      }
      if (accountId === legalBenefitsId || (accountId === withheldId && detail.entry_side === "debit" && /保険料|厚生年金|子ども・子育て支援金/.test(description))) {
        socialDeal = true;
      }
    }
    if (socialDeal && numeric(deal.amount) > 0) {
      target.socialInsuranceObserved = true;
      target.socialInsuranceYen = Math.max(numeric(target.socialInsuranceYen), numeric(deal.amount));
    }
  }

  const paymentEvidence = await fetchFreeeWalletEvidence(`${currentYear - 1}07`, today.slice(0, 7).replace("-", ""));
  const payrollMonths = [...payrollByYm.values()]
    .map((row) => ({
      ...row,
      withholdingIncomeTaxYen: row.withholdingObserved ? numeric(row.withholdingIncomeTaxYen) : null,
      residentTaxYen: row.residentTaxObserved ? numeric(row.residentTaxYen) : null,
    }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  return { payrollMonths, paymentEvidence };
}

async function generatedFromStatutoryRules(
  db: ReturnType<typeof createAdminClient>,
  ownerMemberId: string,
  today: string
): Promise<{ obligations: GeneratedObligation[]; counts: Record<string, number>; sourceError: string | null }> {
  const currentYm = today.slice(0, 7).replace("-", "");
  const horizonYm = addMonthsToYm(currentYm, 18);
  const [paramsRes, liveForecastRes, fallbackForecastRes] = await Promise.all([
    db.from("company_budget_inputs")
      .select("payload")
      .eq("input_kind", "params")
      .eq("source", "gas_monthly_pl")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("company_budget_monthly")
      .select("ym,category,budget_amount_yen")
      .eq("scope", "company")
      .eq("source", "os_live_monthly_pl")
      .eq("version", "os-live-current")
      .gte("ym", currentYm)
      .lte("ym", horizonYm)
      .in("category", ["tax_payment_consumption", "tax_payment_corporate"])
      .order("ym", { ascending: true })
      .limit(100),
    db.from("company_budget_actual_monthly")
      .select("ym,category,budget_amount_yen")
      .gte("ym", currentYm)
      .lte("ym", horizonYm)
      .in("category", ["tax_payment_consumption", "tax_payment_corporate"])
      .order("ym", { ascending: true })
      .limit(100),
  ]);
  if (paramsRes.error) throw paramsRes.error;
  if (liveForecastRes.error) throw liveForecastRes.error;
  if (fallbackForecastRes.error) throw fallbackForecastRes.error;
  const params = (paramsRes.data?.payload ?? {}) as Record<string, unknown>;
  const forecastsByYm = new Map<string, StatutoryTaxForecast>();
  const forecastRows = (liveForecastRes.data ?? []).length > 0
    ? liveForecastRes.data ?? []
    : fallbackForecastRes.data ?? [];
  for (const row of forecastRows) {
    const forecast = forecastsByYm.get(row.ym) ?? { ym: row.ym, consumptionTaxYen: 0, corporateTaxYen: 0 };
    if (row.category === "tax_payment_consumption") forecast.consumptionTaxYen = numeric(row.budget_amount_yen);
    if (row.category === "tax_payment_corporate") forecast.corporateTaxYen = numeric(row.budget_amount_yen);
    forecastsByYm.set(row.ym, forecast);
  }

  let payrollMonths: StatutoryPayrollMonth[] = [];
  let paymentEvidence: StatutoryPaymentEvidence[] = [];
  let sourceError: string | null = null;
  try {
    const freee = await fetchFreeeStatutoryInputs(today);
    payrollMonths = freee.payrollMonths;
    paymentEvidence = freee.paymentEvidence;
  } catch (error) {
    sourceError = errorMessage(error).slice(0, 300);
  }

  const drafts = buildAmdStatutoryPaymentDrafts({
    today,
    horizonMonths: 18,
    fiscalYearStartMonth: numeric(params.fiscalYearStartMonth) || 1,
    previousCorporateTaxYen: numeric(params.prevCorpTax),
    previousConsumptionTaxYen: numeric(params.prevConsumptionTax),
    payrollMonths,
    paymentEvidence,
    taxForecasts: [...forecastsByYm.values()],
  });
  // 加算税・延滞税の賦課決定通知を既に受け取っている親には、見込みを重ねない。
  const { data: settledRows, error: settledError } = await db
    .from("company_payment_obligations")
    .select("status,payload")
    .not("payload->>penaltyForSourceKey", "is", null)
    .limit(500);
  if (settledError) throw settledError;
  const settledParentKeys = (settledRows ?? [])
    .filter((row) => row.status !== "cancelled")
    .map((row) => String((row.payload as Record<string, unknown> | null)?.penaltyForSourceKey ?? ""))
    .filter(Boolean);
  const penaltyEstimates = buildStatutoryPenaltyEstimates(drafts, today, settledParentKeys);
  const penaltyByParent = new Map(penaltyEstimates.map((row) => [row.parentSourceKey, row]));

  const now = new Date().toISOString();
  const obligations: GeneratedObligation[] = drafts.map((draft) => ({
    source_key: draft.sourceKey,
    title: draft.title,
    counterparty: draft.counterparty,
    category: draft.category,
    amount_yen: draft.amountYen,
    amount_status: draft.amountStatus,
    due_date: draft.dueDate,
    due_date_precision: "day",
    expected_payment_ym: draft.dueDate.slice(0, 7).replace("-", ""),
    status: draft.status,
    cashflow_treatment: draft.cashflowTreatment,
    budget_category: draft.budgetCategory,
    auto_debit: draft.autoDebit,
    owner_member_id: ownerMemberId,
    source_kind: "statutory_rule",
    source_ref: draft.sourceRef,
    confidence: draft.confidence,
    paid_at: draft.paidAt,
    paid_amount_yen: draft.paidAmountYen,
    payload: {
      ...draft.payload,
      generatedFrom: "statutory_rule+freee+management_forecast",
      penaltyEstimate: penaltyByParent.get(draft.sourceKey) ?? null,
    },
    last_seen_at: now,
    updated_at: now,
  }));
  return {
    obligations,
    counts: {
      statutory: obligations.length,
      withholding: obligations.filter((row) => row.payload.ruleKey === "withholding_income_tax_special").length,
      socialInsurance: obligations.filter((row) => row.payload.ruleKey === "monthly_social_insurance").length,
      residentTax: obligations.filter((row) => row.payload.ruleKey === "resident_tax_special_collection").length,
      laborInsurance: obligations.filter((row) => row.payload.ruleKey === "annual_labor_insurance").length,
      corporateAndConsumptionTax: obligations.filter((row) => /tax_(?:interim|final)$/.test(String(row.payload.ruleKey ?? ""))).length,
      penaltyEstimates: penaltyEstimates.filter((row) => (row.totalYen ?? 0) > 0).length,
    },
    sourceError,
  };
}

async function generatedFromOsSources(
  db: ReturnType<typeof createAdminClient>,
  ownerMemberId: string,
  today: string
): Promise<{ obligations: GeneratedObligation[]; counts: Record<string, number> }> {
  const baseYm = currentYmJst(new Date(`${today}T00:00:00+09:00`));
  const endYm = addMonthsToYm(baseYm, 17);
  const [recurringRes, reimbursementsRes, payoutsRes, membersRes, actionItemsRes] = await Promise.all([
    db.from("company_finance_recurring_items").select("id,display_name,vendor_name,category,amount_yen,frequency,start_ym,end_ym,auto_debit,status").eq("status", "active").lte("start_ym", endYm).limit(1000),
    db.from("reimbursements").select("reimbursement_id,project_name,date,category,amount,description,created_by,billed_ym,status").eq("status", "approved").limit(1000),
    db.from("payout_notices").select("member_id,ym,total_yen,sent_at").gte("ym", baseYm).lte("ym", endYm).limit(2000),
    db.from("members").select("member_id,code_name,member_name").limit(1000),
    db.from("action_items").select("action_id,category,title,summary,due_at,status,source,source_ref").in("status", ["open", "in_progress"]).in("category", ["finance", "tax", "legal", "contract", "admin"]).limit(1000),
  ]);
  if (recurringRes.error) throw recurringRes.error;
  if (reimbursementsRes.error) throw reimbursementsRes.error;
  if (payoutsRes.error) throw payoutsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (actionItemsRes.error) throw actionItemsRes.error;

  const now = new Date().toISOString();
  const obligations: GeneratedObligation[] = [];
  for (const item of recurringRes.data ?? []) {
    for (let index = 0; index < 18; index += 1) {
      const ym = addMonthsToYm(baseYm, index);
      if (!isActiveInMonth(item, ym)) continue;
      obligations.push({
        source_key: `recurring:${item.id}:${ym}`,
        title: item.display_name,
        counterparty: item.vendor_name,
        category: item.category === "tax_payment" ? "tax" : item.category === "loan_payment" ? "loan" : "subscription",
        amount_yen: Math.max(0, Math.round(Number(item.amount_yen) || 0)),
        amount_status: "exact",
        due_date: null,
        due_date_precision: "month",
        expected_payment_ym: ym,
        status: "open",
        cashflow_treatment: "included_in_budget",
        budget_category: item.category,
        auto_debit: item.auto_debit,
        owner_member_id: ownerMemberId,
        source_kind: "finance_recurring_item",
        source_ref: `company_finance_recurring_items:${item.id}`,
        confidence: 1,
        paid_at: null,
        paid_amount_yen: null,
        payload: { recurringItemId: item.id, frequency: item.frequency },
        last_seen_at: now,
        updated_at: now,
      });
    }
  }

  for (const item of reimbursementsRes.data ?? []) {
    const ym = /^\d{6}$/.test(item.billed_ym ?? "") ? item.billed_ym : ymFromDate(item.date) ?? baseYm;
    obligations.push({
      source_key: `reimbursement:${item.reimbursement_id}`,
      title: item.description || `${item.project_name || "会社"} 経費精算`,
      counterparty: item.created_by,
      category: "reimbursement",
      amount_yen: Math.max(0, Math.round(Number(item.amount) || 0)),
      amount_status: "exact",
      due_date: null,
      due_date_precision: "month",
      expected_payment_ym: ym,
      status: "open",
      cashflow_treatment: "included_in_budget",
      budget_category: "reimbursement",
      auto_debit: false,
      owner_member_id: ownerMemberId,
      source_kind: "reimbursement",
      source_ref: `reimbursements:${item.reimbursement_id}`,
      confidence: 1,
      paid_at: null,
      paid_amount_yen: null,
      payload: { reimbursementId: item.reimbursement_id, projectName: item.project_name, expenseCategory: item.category },
      last_seen_at: now,
      updated_at: now,
    });
  }

  const memberNames = new Map((membersRes.data ?? []).map((member) => [member.member_id, member.code_name || member.member_name || member.member_id]));
  for (const item of payoutsRes.data ?? []) {
    const amount = Math.max(0, Math.round(Number(item.total_yen) || 0));
    if (amount <= 0) continue;
    obligations.push({
      source_key: `payout-notice:${item.member_id}:${item.ym}`,
      title: `${memberNames.get(item.member_id) || item.member_id} 報酬支払い`,
      counterparty: memberNames.get(item.member_id) || item.member_id,
      category: "reward",
      amount_yen: amount,
      amount_status: "exact",
      due_date: null,
      due_date_precision: "month",
      expected_payment_ym: item.ym,
      status: "open",
      cashflow_treatment: "included_in_budget",
      budget_category: "cost_member",
      auto_debit: false,
      owner_member_id: ownerMemberId,
      source_kind: "payout_notice",
      source_ref: `payout_notices:${item.member_id}:${item.ym}`,
      confidence: 1,
      paid_at: null,
      paid_amount_yen: null,
      payload: { memberId: item.member_id, noticeSent: Boolean(item.sent_at) },
      last_seen_at: now,
      updated_at: now,
    });
  }

  for (const item of actionItemsRes.data ?? []) {
    if (item.source === "gmail") continue;
    const dueDate = item.due_at ? currentDateJst(new Date(item.due_at)) : null;
    const parsed = parsePaymentEmail(item.title, item.summary || "", dueDate || today);
    if (!parsed) continue;
    const expectedYm = dueDate?.slice(0, 7).replace("-", "") ?? parsed.expectedPaymentYm;
    obligations.push({
      source_key: `action-item:${item.action_id}`,
      title: item.title,
      counterparty: null,
      category: item.category === "tax" ? "tax" : parsed.category,
      amount_yen: parsed.amountYen,
      amount_status: parsed.amountStatus,
      due_date: dueDate ?? parsed.dueDate,
      due_date_precision: dueDate || parsed.dueDate ? "day" : "unknown",
      expected_payment_ym: expectedYm,
      status: parsed.amountYen != null && expectedYm ? "open" : "needs_review",
      cashflow_treatment: "additive",
      budget_category: null,
      auto_debit: null,
      owner_member_id: ownerMemberId,
      source_kind: "action_item",
      source_ref: `action_items:${item.action_id}`,
      confidence: parsed.amountYen != null && expectedYm ? 0.9 : 0.6,
      paid_at: null,
      paid_amount_yen: null,
      payload: { actionItemId: item.action_id, originSource: item.source, originSourceRef: item.source_ref },
      last_seen_at: now,
      updated_at: now,
    });
  }

  return {
    obligations,
    counts: {
      recurring: obligations.filter((row) => row.source_kind === "finance_recurring_item").length,
      reimbursements: obligations.filter((row) => row.source_kind === "reimbursement").length,
      payouts: obligations.filter((row) => row.source_kind === "payout_notice").length,
      actionItems: obligations.filter((row) => row.source_kind === "action_item").length,
    },
  };
}

function headerValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string): string {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function addressFromHeader(value: string): string {
  const bracketed = value.match(/<([^>]+@[^>]+)>/);
  const plain = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return String(bracketed?.[1] ?? plain?.[0] ?? "").trim().toLowerCase();
}

function senderDomainFromHeader(value: string): string {
  return addressFromHeader(value).split("@")[1] ?? "unknown";
}

function isOwnCompanySender(fromHeader: string, mailboxEmail: string | null): boolean {
  const from = addressFromHeader(fromHeader);
  return Boolean(from && (from.endsWith("@team-armada.jp") || from === String(mailboxEmail ?? "").toLowerCase()));
}

function isoDateFromInternalDate(value: string | null | undefined): string {
  const ms = Number(value);
  return Number.isFinite(ms) ? currentDateJst(new Date(ms)) : currentDateJst();
}

function matchesRecurring(text: string, recurring: Array<{ id: string; display_name: string; vendor_name: string | null; amount_yen: number }>) {
  const normalized = text.toLowerCase();
  return recurring.find((item) => [item.display_name, item.vendor_name]
    .filter((value): value is string => Boolean(value && value.trim().length >= 3))
    .some((value) => normalized.includes(value.toLowerCase())));
}

function isAggregateCardStatement(text: string): boolean {
  return /freeeカード|クレジットカード|カード(?:ご利用|利用代金|代金|引落)|ご利用代金/.test(text);
}

function deduplicateGmailObligations(rows: GeneratedObligation[]): GeneratedObligation[] {
  const cardPayments = new Set(rows
    .filter((row) => row.category === "card_payment" && row.amount_yen != null && row.due_date)
    .map((row) => `${row.amount_yen}:${row.due_date}`));
  for (const row of rows) {
    if (row.amount_yen == null || !row.due_date || !cardPayments.has(`${row.amount_yen}:${row.due_date}`)) continue;
    row.category = "card_payment";
    row.cashflow_treatment = "included_in_budget";
    row.budget_category = "fixed_cost";
    row.auto_debit = true;
    row.source_key = gmailObligationSourceKey({
      senderDomain: String(row.payload.senderDomain ?? "unknown"),
      title: row.title,
      category: "card_payment",
      amountYen: row.amount_yen,
      dueDate: row.due_date,
      referenceDate: String(row.payload.messageDate ?? row.due_date),
    });
  }
  const unique = new Map<string, GeneratedObligation>();
  for (const row of rows) {
    const current = unique.get(row.source_key);
    if (!current) {
      unique.set(row.source_key, row);
      continue;
    }
    const preferred = row.payload.aggregateCardStatement === true && current.payload.aggregateCardStatement !== true ? row : current;
    const mailboxIds = new Set<string>([
      ...((current.payload.mailboxMemberIds as string[] | undefined) ?? []),
      ...((row.payload.mailboxMemberIds as string[] | undefined) ?? []),
    ]);
    preferred.payload = { ...preferred.payload, mailboxMemberIds: [...mailboxIds] };
    preferred.confidence = Math.max(current.confidence, row.confidence);
    unique.set(row.source_key, preferred);
  }
  return [...unique.values()];
}

async function generatedFromGmail(
  db: ReturnType<typeof createAdminClient>,
  ownerMemberId: string
): Promise<{ obligations: GeneratedObligation[]; mailboxes: number; messages: number; tokenErrors: string[] }> {
  const [membersRes, tokensRes, recurringRes] = await Promise.all([
    db.from("members").select("member_id,email,code_name,is_admin,status").eq("status", "active").limit(1000),
    db.from("member_google_oauth_tokens").select("member_id,refresh_token").eq("provider", "google").not("refresh_token", "is", null).limit(1000),
    db.from("company_finance_recurring_items").select("id,display_name,vendor_name,amount_yen").eq("status", "active").limit(1000),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (tokensRes.error) throw tokensRes.error;
  if (recurringRes.error) throw recurringRes.error;
  const tokenByMember = new Map((tokensRes.data ?? []).map((row) => [row.member_id, row.refresh_token as string]));
  const targetMembers = (membersRes.data ?? []).filter((member) => member.is_admin === true || member.code_name === "info");
  const envEmail = (process.env.GOOGLE_OAUTH_ACTOR_EMAIL || "masa@team-armada.jp").toLowerCase();
  const obligations: GeneratedObligation[] = [];
  const tokenErrors: string[] = [];
  let mailboxes = 0;
  let messages = 0;

  for (const member of targetMembers) {
    const refreshToken = tokenByMember.get(member.member_id);
    let auth = refreshToken ? getMemberGoogleAuth(refreshToken) : null;
    if (!auth && String(member.email || "").toLowerCase() === envEmail) auth = await getGoogleAuthAsync();
    if (!auth) {
      tokenErrors.push(`${member.member_id}:no-auth`);
      continue;
    }
    mailboxes += 1;
    try {
      const gmail = google.gmail({ version: "v1", auth });
      const listed = await gmail.users.messages.list({
        userId: "me",
        q: "newer_than:45d -in:sent -label:spam -label:trash {納付 納期限 納付書 督促 支払 お支払い 請求 振込 口座振替 引落 税 社会保険 保険料 源泉 e-Tax eLTAX}",
        maxResults: 100,
      });
      for (const ref of listed.data.messages ?? []) {
        if (!ref.id) continue;
        const message = await gmail.users.messages.get({
          userId: "me",
          id: ref.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To"],
        });
        messages += 1;
        const subject = headerValue(message.data.payload?.headers, "Subject") || "支払義務候補";
        const fromHeader = headerValue(message.data.payload?.headers, "From");
        if (isOwnCompanySender(fromHeader, member.email)) continue;
        const senderDomain = senderDomainFromHeader(fromHeader);
        const referenceDate = isoDateFromInternalDate(message.data.internalDate);
        const parsed = parsePaymentEmail(subject, message.data.snippet || "", referenceDate);
        if (!parsed) continue;
        const searchableText = `${subject}\n${message.data.snippet || ""}`;
        const recurringByText = matchesRecurring(searchableText, recurringRes.data ?? []);
        const recurringByAmount = parsed.amountYen == null ? [] : (recurringRes.data ?? [])
          .filter((item) => Math.round(Number(item.amount_yen) || 0) === parsed.amountYen);
        const recurring = recurringByText ?? (recurringByAmount.length === 1 ? recurringByAmount[0] : undefined);
        const aggregateCardStatement = isAggregateCardStatement(searchableText);
        const now = new Date().toISOString();
        obligations.push({
          source_key: gmailObligationSourceKey({
            senderDomain,
            title: parsed.title,
            category: aggregateCardStatement ? "card_payment" : parsed.category,
            amountYen: parsed.amountYen,
            dueDate: parsed.dueDate,
            referenceDate,
          }),
          title: parsed.title,
          counterparty: senderDomain === "unknown" ? null : senderDomain,
          category: aggregateCardStatement ? "card_payment" : parsed.category,
          amount_yen: parsed.amountYen,
          amount_status: parsed.amountStatus,
          due_date: parsed.dueDate,
          due_date_precision: parsed.dueDatePrecision,
          expected_payment_ym: parsed.expectedPaymentYm,
          status: parsed.status,
          cashflow_treatment: recurring || aggregateCardStatement ? "included_in_budget" : "additive",
          budget_category: recurring || aggregateCardStatement ? "fixed_cost" : null,
          auto_debit: /引落|引き落とし|口座振替/.test(searchableText) ? true : null,
          owner_member_id: ownerMemberId,
          source_kind: "gmail",
          source_ref: `gmail:${member.member_id}:${ref.id}`,
          confidence: parsed.confidence,
          paid_at: null,
          paid_amount_yen: null,
          payload: {
            mailboxMemberIds: [member.member_id],
            messageDate: referenceDate,
            senderDomain,
            matchedKeywords: parsed.matchedKeywords,
            recurringItemId: recurring?.id ?? null,
            aggregateCardStatement,
          },
          last_seen_at: now,
          updated_at: now,
        });
      }
    } catch (error) {
      tokenErrors.push(`${member.member_id}:${error instanceof Error ? error.message.slice(0, 120) : "gmail-error"}`);
    }
  }
  return { obligations: deduplicateGmailObligations(obligations), mailboxes, messages, tokenErrors };
}

async function upsertGenerated(db: ReturnType<typeof createAdminClient>, rows: GeneratedObligation[]) {
  if (!rows.length) return { upserted: 0, preserved: 0 };
  const keys = [...new Set(rows.map((row) => row.source_key))];
  const existing = new Map<string, { status: string; reviewed_at: string | null }>();
  for (let offset = 0; offset < keys.length; offset += 250) {
    const { data, error } = await db.from("company_payment_obligations").select("source_key,status,reviewed_at").in("source_key", keys.slice(offset, offset + 250));
    if (error) throw error;
    for (const row of data ?? []) existing.set(row.source_key, row);
  }
  const writable = rows.filter((row) => {
    const current = existing.get(row.source_key);
    return !current || (!current.reviewed_at && current.status !== "paid" && current.status !== "cancelled");
  });
  for (let offset = 0; offset < writable.length; offset += 250) {
    const { error } = await db.from("company_payment_obligations").upsert(writable.slice(offset, offset + 250), { onConflict: "source_key" });
    if (error) throw error;
  }
  return { upserted: writable.length, preserved: rows.length - writable.length };
}

async function sendKiyoNotifications(
  db: ReturnType<typeof createAdminClient>,
  kiyo: { member_id: string; slack_id: string | null },
  today: string,
  dryRun: boolean,
  sourceKey?: string | null
) {
  let obligationQuery = db
    .from("company_payment_obligations")
    .select("*")
    .in("status", ["needs_review", "open", "scheduled"])
    .or(`expected_payment_ym.is.null,expected_payment_ym.lte.${addMonthsToYm(today.slice(0, 7).replace("-", ""), 1)}`)
    .limit(2000);
  if (sourceKey) obligationQuery = obligationQuery.eq("source_key", sourceKey);
  const { data, error } = await obligationQuery;
  if (error) throw error;
  const candidates = ((data ?? []) as CompanyPaymentObligation[])
    .map((obligation) => ({ obligation, stage: notificationStage(obligation, today) }))
    .filter((item): item is { obligation: CompanyPaymentObligation; stage: { scheduleKey: string; stage: string } } => item.stage !== null);
  if (dryRun) return { candidates: candidates.map(({ obligation, stage }) => ({ id: obligation.id, title: obligation.title, stage: stage.stage })), sent: 0, skipped: 0 };
  if (!kiyo.slack_id) throw new Error("きよのslack_idが未設定");
  const { WebClient } = await import("@slack/web-api");
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  const opened = await slack.conversations.open({ users: kiyo.slack_id });
  const channel = opened.channel?.id || kiyo.slack_id;
  let sent = 0;
  let skipped = 0;
  for (const { obligation, stage } of candidates) {
    const { data: previous, error: previousError } = await db
      .from("company_payment_obligation_notifications")
      .select("id,status")
      .eq("obligation_id", obligation.id)
      .eq("recipient_slack_id", kiyo.slack_id)
      .eq("schedule_key", stage.scheduleKey)
      .eq("stage", stage.stage)
      .maybeSingle();
    if (previousError) throw previousError;
    if (previous?.status === "sent") {
      skipped += 1;
      continue;
    }
    const auditPayload = {
      obligation_id: obligation.id,
      recipient_member_id: kiyo.member_id,
      recipient_slack_id: kiyo.slack_id,
      schedule_key: stage.scheduleKey,
      stage: stage.stage,
      status: "pending",
      attempted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: audit, error: auditError } = await db
      .from("company_payment_obligation_notifications")
      .upsert(auditPayload, { onConflict: "obligation_id,recipient_slack_id,schedule_key,stage" })
      .select("id")
      .single();
    if (auditError) throw auditError;
    const due = obligation.due_date || (obligation.expected_payment_ym ? `${obligation.expected_payment_ym.slice(0, 4)}年${Number(obligation.expected_payment_ym.slice(4, 6))}月` : "期日未確認");
    const needsReview = obligation.status === "needs_review" || obligation.amount_status === "unknown" || obligation.due_date_precision === "unknown";
    const amountText = obligation.amount_status === "estimated" && obligation.amount_yen != null ? `約${yen(obligation.amount_yen)}` : yen(obligation.amount_yen);
    const text = needsReview
      ? `支払義務の確認が必要: ${obligation.title} / ${amountText} / ${due}`
      : `支払期限アラート: ${obligation.title} / ${amountText} / ${due}`;
    try {
      const posted = await slack.chat.postMessage({
        channel,
        text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*${needsReview ? "支払義務を確認して" : "支払期限アラート"}*\n${obligation.title}\n金額: *${amountText}* / 期日: *${due}*` } },
          { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "支払義務を開く" }, url: `${APP_BASE_URL}/admin/finance#payment-obligations` }] },
        ],
      });
      await db.from("company_payment_obligation_notifications").update({ status: "sent", slack_channel_id: channel, slack_ts: posted.ts ?? null, sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq("id", audit.id);
      sent += 1;
    } catch (postError) {
      await db.from("company_payment_obligation_notifications").update({ status: "failed", error_message: postError instanceof Error ? postError.message.slice(0, 500) : String(postError).slice(0, 500), updated_at: new Date().toISOString() }).eq("id", audit.id);
    }
  }
  return { candidates: candidates.length, sent, skipped };
}

async function run(req: NextRequest, options: { dryRun: boolean; sendNotifications: boolean; notificationSourceKey?: string | null }) {
  const db = createAdminClient();
  const { dryRun, sendNotifications } = options;
  const today = req.nextUrl.searchParams.get("date") || currentDateJst();
  const kiyo = await kiyoMember(db);
  const [statutory, osSources, gmail] = await Promise.all([
    generatedFromStatutoryRules(db, kiyo.member_id, today),
    generatedFromOsSources(db, kiyo.member_id, today),
    generatedFromGmail(db, kiyo.member_id),
  ]);
  const all = [...statutory.obligations, ...osSources.obligations, ...gmail.obligations];
  const sync = dryRun ? { upserted: 0, preserved: 0 } : await upsertGenerated(db, all);
  const notifications = dryRun || !sendNotifications
    ? { candidates: [], sent: 0, skipped: 0 }
    : await sendKiyoNotifications(db, kiyo, today, false, options.notificationSourceKey);
  return NextResponse.json({
    ok: true,
    dryRun,
    sendNotifications,
    notificationSourceKey: options.notificationSourceKey ?? null,
    today,
    discovered: { ...statutory.counts, ...osSources.counts, gmail: gmail.obligations.length, gmailMailboxes: gmail.mailboxes, gmailMessagesScanned: gmail.messages },
    preview: dryRun ? all
      .filter((row) => row.source_kind === "statutory_rule" || row.source_kind === "gmail" || row.source_kind === "action_item")
      .slice(0, 100)
      .map((row) => ({ title: row.title, category: row.category, amountYen: row.amount_yen, dueDate: row.due_date, status: row.status, sourceKind: row.source_kind })) : undefined,
    sync,
    notifications,
    tokenErrors: gmail.tokenErrors,
    sourceErrors: [...gmail.tokenErrors, ...(statutory.sourceError ? [`freee-statutory:${statutory.sourceError}`] : [])],
  });
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
    return await run(req, {
      dryRun,
      // 台帳同期とSlack DMは別責務。初回同期で未確認候補を一括送信しないよう、
      // 自動DMは本番環境で明示的に有効化されるまで停止しておく。
      sendNotifications:
        !dryRun &&
        process.env.PAYMENT_OBLIGATION_AUTO_NUDGE_ENABLED === "1" &&
        req.nextUrl.searchParams.get("notify") !== "0",
      notificationSourceKey: req.nextUrl.searchParams.get("sourceKey"),
    });
  } catch (error) {
    console.error("[payment-obligations cron]", error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;
  try {
    let body: { dryRun?: boolean; sendNotifications?: boolean; notificationSourceKey?: string | null } = {};
    try { body = await req.json(); } catch { body = {}; }
    const dryRun = Boolean(body.dryRun);
    return await run(req, { dryRun, sendNotifications: !dryRun && body.sendNotifications !== false, notificationSourceKey: body.notificationSourceKey });
  } catch (error) {
    console.error("[payment-obligations manual]", error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
