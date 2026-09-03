/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase schema varies across applied migrations; runtime rows stay narrow at adapter boundaries. */
import { createHash } from "node:crypto";
import {
  addDays,
  addMonthsYm,
  adjustToNextBusinessDay,
  dateInRange,
  fiscalYearEndDate,
  isIsoDate,
  isYm,
  lastDayOfYm,
  monthList,
  nextMonthDay,
  nextMonthEnd,
  todayJst,
  ymFromDate,
  ymInRange,
} from "./date.ts";
import { OFFICIAL_RULES, officialRule, ruleRefs } from "./rules/official.ts";
import type {
  AmountRole,
  AmountStatus,
  DatePrecision,
  GeneratedOccurrence,
  InternalPrepSpec,
  JsonRecord,
  LifecycleStatus,
  OperatingFact,
  ScheduleCategory,
} from "./types.ts";
import {
  isAcceptedAmdContract,
  isContractSigningExpected,
  isCurrentAmdContract,
  isEligibleTaxSocialObligation,
  isScheduleActionItem,
} from "./predicates.ts";
import { deadlineForReportYm, planMonthlyReportSchedule, reportRule } from "./report-plan.ts";
export {
  isAcceptedAmdContract,
  isContractSigningExpected,
  isCurrentAmdContract,
  isEligibleTaxSocialObligation,
  isScheduleActionItem,
  isStatutoryScheduleObligation,
} from "./predicates.ts";

// Supabase's generated Database type is intentionally not used in this repo.
// Keep this module tolerant of schema additions while retaining narrow runtime shapes below.
export type ScheduleDb = {
  from: (table: string) => any;
};

type RawRow = Record<string, any>;

export type ScheduleGenerationOptions = {
  now?: Date;
  from?: string;
  to?: string;
};

export type ScheduleGenerationResult = {
  ok: boolean;
  generated: number;
  inserted: number;
  updated: number;
  superseded: number;
  needsSource: number;
  sourceCounts: Record<string, number>;
  errors: string[];
  from: string;
  to: string;
};

const ACTIVE_ACTION_STATUSES = ["open", "in_progress"];
const GENERATED_STATUSES = ["needs_review", "open", "scheduled", "paid", "cancelled"];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const result = String(value).trim();
  return result || null;
}

function numberValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? Math.round(result) : null;
}

function booleanValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  if (["true", "yes", "1", "あり", "対象"].includes(value.trim().toLowerCase())) return true;
  if (["false", "no", "0", "なし", "対象外"].includes(value.trim().toLowerCase())) return false;
  return null;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value, (_, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.keys(item).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = item[key];
      return result;
    }, {});
  }), "utf8").digest("hex");
}

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s【】「」『』()[\]（）・:：/／｜|_-]+/g, "")
    .trim();
}

function sourceHash(source: string, row: unknown): string {
  return stableHash({ source, row });
}

function parseFactValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function factValue(facts: Map<string, OperatingFact>, key: string): unknown {
  const value = facts.get(key)?.value_json;
  if (!value || value.missing === true) return null;
  return value.value ?? value;
}

function factSource(facts: Map<string, OperatingFact>, key: string): OperatingFact | null {
  return facts.get(key) ?? null;
}

function ruleMeta(ruleKey: string) {
  const rule = officialRule(ruleKey);
  return {
    ruleKey,
    ruleVersion: rule?.ruleVersion ?? "runtime-1",
    officialRefs: ruleRefs(ruleKey),
    reviewAfter: rule?.reviewAfter ?? null,
  };
}

function ownerIdByName(name: unknown, members: RawRow[]): string | null {
  const needle = normalized(name);
  if (!needle) return null;
  const match = members.find((member) => [member.member_id, member.code_name, member.member_name, member.email]
    .some((value) => normalized(value) === needle));
  return match?.member_id ? String(match.member_id) : null;
}

function kiyoId(members: RawRow[]): string | null {
  return members.find((member) => String(member.code_name ?? "") === "きよ" && member.status === "active")?.member_id ?? null;
}

function amountFields(amountYen: number | null, status: AmountStatus, role: AmountRole) {
  return { amount_yen: amountYen, amount_status: status, amount_role: role };
}

function scheduleNotificationOwner(): "company_schedule" | "none" {
  return process.env.AMD_OS_SCHEDULE_NOTIFICATIONS_ENABLED === "1" ? "company_schedule" : "none";
}

function occurrence(input: {
  key: string;
  source: string;
  sourceId?: string | null;
  sourceHash: string;
  scope: "company" | "project";
  category: ScheduleCategory;
  eventKind: string;
  title: string;
  periodKey?: string | null;
  dueOn?: string | null;
  dueYm?: string | null;
  datePrecision: DatePrecision;
  dateKind: string;
  amountYen?: number | null;
  amountStatus?: AmountStatus;
  amountRole?: AmountRole;
  projectId?: string | null;
  ownerMemberId?: string | null;
  sourceRefs?: unknown[];
  ruleKey?: string | null;
  resolutionHref?: string | null;
  lifecycleStatus?: LifecycleStatus;
  notificationOwner?: "payment_obligation" | "company_schedule" | "none";
  missingReason?: string | null;
  sourceObservedAt?: string | null;
  metadata?: JsonRecord;
}): GeneratedOccurrence {
  const meta = input.ruleKey ? ruleMeta(input.ruleKey) : { ruleKey: null, ruleVersion: null, officialRefs: [], reviewAfter: null };
  const now = new Date().toISOString();
  return {
    occurrence_key: input.key,
    source_hash: input.sourceHash,
    scope: input.scope,
    category: input.category,
    event_kind: input.eventKind,
    title: input.title,
    period_key: input.periodKey ?? null,
    due_on: input.dueOn ?? null,
    due_ym: input.dueYm ?? (input.dueOn ? input.dueOn.slice(0, 7).replace("-", "") : null),
    date_precision: input.datePrecision,
    date_kind: input.dateKind,
    ...amountFields(input.amountYen ?? null, input.amountStatus ?? (input.amountYen == null ? "unknown" : "exact"), input.amountRole ?? "informational"),
    project_id: input.projectId ?? null,
    owner_member_id: input.ownerMemberId ?? null,
    source_kind: input.source,
    source_id: input.sourceId ?? null,
    source_refs_json: input.sourceRefs ?? [],
    rule_key: meta.ruleKey,
    rule_version: meta.ruleVersion,
    official_refs_json: meta.officialRefs,
    resolution_href: input.resolutionHref ?? null,
    missing_reason: input.missingReason ?? null,
    source_observed_at: input.sourceObservedAt ?? null,
    rule_review_after: meta.reviewAfter,
    lifecycle_status: input.lifecycleStatus ?? (input.dueOn || input.dueYm ? "open" : "needs_source"),
    generation_state: input.lifecycleStatus === "needs_source" || (!input.dueOn && !input.dueYm) ? "needs_source" : "generated",
    notification_owner: input.notificationOwner ?? scheduleNotificationOwner(),
    metadata_json: input.metadata ?? {},
    generated_at: now,
    last_seen_at: now,
    updated_at: now,
  };
}

function currentFacts(rows: RawRow[]): Map<string, OperatingFact> {
  const map = new Map<string, OperatingFact>();
  for (const row of rows) {
    if (row.superseded_at) continue;
    const current = map.get(String(row.fact_key));
    if (!current || String(row.observed_at ?? "") > String(current.observed_at ?? "")) {
      map.set(String(row.fact_key), row as OperatingFact);
    }
  }
  return map;
}

export async function syncCompanyOperatingFacts(db: ScheduleDb): Promise<{
  ok: boolean;
  upserted: number;
  missing: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const [membersRes, entriesRes, companyProfilesRes] = await Promise.all([
    db.from("members").select("member_id,code_name,member_name,email,status").eq("status", "active").limit(1000),
    db.from("company_profile_entries").select("entry_key,body_md,source_kind,source_ref,source_confidence,updated_at").limit(1000),
    db.from("project_company_profiles").select("project_id,legal_name,corporate_number,fiscal_year_end_month,source_ref,source_verified_on,updated_at").limit(1000),
  ]);
  if (membersRes.error) errors.push(`members: ${membersRes.error.message}`);
  if (entriesRes.error) errors.push(`company_profile_entries: ${entriesRes.error.message}`);
  if (companyProfilesRes.error) errors.push(`project_company_profiles: ${companyProfilesRes.error.message}`);

  const members = (membersRes.data ?? []) as RawRow[];
  const entries = (entriesRes.data ?? []) as RawRow[];
  const companyProfile = (companyProfilesRes.data ?? []).find((row: RawRow) => ["amd", "AMD", "p00"].includes(String(row.project_id))) as RawRow | undefined;
  const entryByKey = new Map(entries.map((entry) => [String(entry.entry_key), entry]));
  const profileValue = (key: string): { value: unknown; sourceRef: string; confidence: number } | null => {
    const entry = entryByKey.get(key) || entryByKey.get(`operating_fact:${key}`);
    if (!entry) return null;
    return {
      value: parseFactValue(entry.body_md),
      sourceRef: String(entry.source_ref || `company_profile_entries:${key}`),
      confidence: Number(entry.source_confidence ?? 0.7),
    };
  };

  const candidates: Array<{ key: string; value: unknown; sourceKind: string; sourceRef: string; confidence: number }> = [];
  const addCandidate = (key: string, value: unknown, sourceKind: string, sourceRef: string, confidence: number) => {
    candidates.push({ key, value, sourceKind, sourceRef, confidence: Math.max(0, Math.min(1, confidence || 0.5)) });
  };

  addCandidate("regular_payee_count", members.length, "members", "members:active-count", 1);
  const profileFacts: Array<[string, unknown]> = [
    ["legal_name", companyProfile?.legal_name],
    ["corporate_number", companyProfile?.corporate_number],
    ["fiscal_year_end_month", companyProfile?.fiscal_year_end_month],
  ];
  for (const [key, value] of profileFacts) {
    if (value != null && value !== "") addCandidate(key, value, "project_company_profiles", `project_company_profiles:${companyProfile?.project_id}`, 0.9);
  }

  const factKeys = [
    "legal_name", "corporate_number", "fiscal_year_end_month", "withholding_payment_mode",
    "payroll_closing_day", "payroll_payment_day", "social_insurance_enrollment",
    "labor_insurance_enrollment", "consumption_tax_filing_mode", "tax_return_extension",
    "year_end_adjustment_deadline_ymd", "corporate_tax_interim_required", "previous_corporate_tax_yen",
  ];
  for (const key of factKeys) {
    const profile = profileValue(key);
    if (profile && profile.value !== null && profile.value !== "") {
      addCandidate(key, profile.value, String(entryByKey.get(key)?.source_kind || "company_profile_entries"), profile.sourceRef, profile.confidence);
    }
  }

  const missing = factKeys.filter((key) => !candidates.some((candidate) => candidate.key === key));
  for (const key of missing) {
    addCandidate(key, { missing: true }, "schedule_sync", `company-operating-facts:missing:${key}`, 0);
  }

  const existingRes = await db.from("company_operating_facts").select("fact_id,fact_key,source_kind,source_hash,superseded_at").is("superseded_at", null).limit(1000);
  if (existingRes.error) errors.push(`company_operating_facts: ${existingRes.error.message}`);
  const existingByKey = new Map<string, RawRow[]>();
  for (const row of (existingRes.data ?? []) as RawRow[]) {
    const list = existingByKey.get(String(row.fact_key)) ?? [];
    list.push(row);
    existingByKey.set(String(row.fact_key), list);
  }

  let upserted = 0;
  for (const candidate of candidates) {
    const hash = sourceHash(candidate.key, candidate.value);
    const currentRows = existingByKey.get(candidate.key) ?? [];
    const now = new Date().toISOString();
    for (const old of currentRows.filter((row) => row.source_hash !== hash)) {
      await db.from("company_operating_facts").update({ superseded_at: now, updated_at: now }).eq("fact_id", old.fact_id);
    }
    const { error } = await db.from("company_operating_facts").upsert({
      fact_key: candidate.key,
      value_json: candidate.value && typeof candidate.value === "object" && !Array.isArray(candidate.value) ? candidate.value : { value: candidate.value },
      source_kind: candidate.sourceKind,
      source_ref: candidate.sourceRef,
      source_hash: hash,
      confidence: candidate.confidence,
      observed_at: now,
      updated_at: now,
      superseded_at: null,
    }, { onConflict: "fact_key,source_kind,source_hash" });
    if (error) errors.push(`${candidate.key}: ${error.message}`);
    else upserted += 1;
  }

  return { ok: errors.length === 0, upserted, missing, errors };
}

function readDeadlineDay(value: unknown): number | null {
  const number = numberValue(value);
  if (number != null && number >= 1 && number <= 31) return number;
  const match = String(value ?? "").match(/(?:毎月|翌月|当月)?\s*(\d{1,2})\s*日/);
  return match ? numberValue(match[1]) : null;
}

function projectTerms(project: RawRow, contract: RawRow | null): JsonRecord {
  const projectTerms = record(project.contract_terms_json);
  const contractTerms = record(contract?.operational_terms_json);
  return { ...project, ...projectTerms, ...contractTerms };
}

function contractAmount(contract: RawRow, terms: JsonRecord): number | null {
  return numberValue(contract.contract_value_yen)
    ?? numberValue(terms.amountTaxExclTotal)
    ?? numberValue(terms.monthlyFeeYen);
}

function matchesObligation(obligation: RawRow, words: string[], dueOn: string | null, dueYm: string | null): boolean {
  const title = normalized(obligation.title);
  if (!words.some((word) => title.includes(normalized(word)))) return false;
  const obligationDue = text(obligation.due_date);
  const obligationYm = text(obligation.expected_payment_ym) || ymFromDate(obligationDue);
  return (dueOn && obligationDue === dueOn) || (dueYm && obligationYm === dueYm) || (!dueOn && !dueYm);
}

function findObligation(obligations: RawRow[], words: string[], dueOn: string | null, dueYm: string | null): RawRow | null {
  return obligations.find((row) => matchesObligation(row, words, dueOn, dueYm)) ?? null;
}

function lifecycleForSource(row: RawRow, dueOn: string | null, dueYm: string | null): LifecycleStatus {
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "paid") return "completed";
  if (!dueOn && !dueYm) return "needs_source";
  return "open";
}

function rangeYears(from: string, to: string): number[] {
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  return Array.from({ length: Math.max(1, toYear - fromYear + 1) }, (_, index) => fromYear + index);
}

const KNOWN_HOLIDAY_CALENDAR_TO_YEAR = 2027;

function officialBusinessDate(rawDate: string | null): string | null {
  if (!rawDate) return null;
  if (Number(rawDate.slice(0, 4)) > KNOWN_HOLIDAY_CALENDAR_TO_YEAR) return null;
  return adjustToNextBusinessDay(rawDate);
}

function officialNextMonthDay(ym: string, day: number): { raw: string | null; dueOn: string | null } {
  const raw = nextMonthDay(ym, day, false);
  return { raw, dueOn: officialBusinessDate(raw) };
}

function officialNextMonthEnd(ym: string): { raw: string; dueOn: string | null } {
  const raw = nextMonthEnd(ym, false);
  return { raw, dueOn: officialBusinessDate(raw) };
}

const PENALTY_TITLE_WORDS = ["加算税", "延滞税", "延滞金", "督促", "滞納処分"];

export function paymentObligationEventKind(row: RawRow): string {
  const title = normalized(row.title);
  const category = normalized(row.category);
  if (PENALTY_TITLE_WORDS.some((word) => title.includes(normalized(word)))) {
    return category === "socialinsurance" ? "social_insurance_penalty_payment" : "tax_penalty_payment";
  }
  if (category === "socialinsurance") {
    return /労働保険|年度更新/.test(String(row.title ?? ""))
      ? "labor_insurance_annual_update"
      : "social_insurance_payment";
  }
  if (title.includes(normalized("源泉所得税")) || title.includes(normalized("源泉徴収"))) return "withholding_tax_payment";
  if (title.includes(normalized("法人税"))) {
    return title.includes(normalized("中間")) ? "corporate_tax_interim" : "corporate_tax_filing";
  }
  return "tax_payment";
}

function generatePaymentObligations(obligations: RawRow[]): GeneratedOccurrence[] {
  return obligations.filter(isEligibleTaxSocialObligation).map((row) => {
    const dueOn = text(row.due_date);
    const dueYm = text(row.expected_payment_ym) || ymFromDate(dueOn);
    const precision = row.due_date_precision === "month" || (!dueOn && dueYm) ? "month" : dueOn ? "day" : "unknown";
    const amountYen = numberValue(row.amount_yen);
    const amountStatus: AmountStatus = row.amount_status === "estimated" ? "estimated" : amountYen == null ? "unknown" : "exact";
    const isTax = normalized(row.category) === "tax";
    return occurrence({
      key: `company:payment:${row.id}`,
      source: "company_payment_obligation",
      sourceId: row.id,
      sourceHash: sourceHash("company_payment_obligation", row),
      scope: "company",
      category: isTax ? "tax" : "labor",
      eventKind: paymentObligationEventKind(row),
      title: String(row.title || "支払義務"),
      periodKey: dueYm,
      dueOn,
      dueYm,
      datePrecision: precision as DatePrecision,
      dateKind: "支払期日",
      amountYen,
      amountStatus,
      amountRole: "outgoing",
      ownerMemberId: text(row.owner_member_id),
      sourceRefs: [{ kind: row.source_kind || "payment_obligation", ref: row.source_ref || row.id }],
      resolutionHref: "/admin/finance#payment-obligations",
      lifecycleStatus: lifecycleForSource(row, dueOn, dueYm),
      notificationOwner: "payment_obligation",
      missingReason: !dueOn && !dueYm ? "支払義務の期限または対象月が未取得" : null,
      sourceObservedAt: text(row.updated_at || row.last_seen_at),
      metadata: {
        obligationId: row.id,
        category: row.category || "other",
        counterparty: text(row.counterparty),
        obligationStatus: text(row.status),
        cashflowTreatment: row.cashflow_treatment || null,
        autoDebit: row.auto_debit ?? null,
        paidAt: row.paid_at || null,
        paidAmountYen: row.paid_amount_yen ?? null,
        obligationSourceKey: text(row.source_key),
        penaltyEstimate: record(row.payload).penaltyEstimate ?? null,
        penaltyForSourceKey: record(row.payload).penaltyForSourceKey ?? null,
      },
    });
  });
}

function generateCorporateTax(
  facts: Map<string, OperatingFact>,
  obligations: RawRow[],
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const fiscalMonth = numberValue(factValue(facts, "fiscal_year_end_month"));
  const rows: GeneratedOccurrence[] = [];
  for (const fiscalYear of rangeYears(from, to)) {
    if (!fiscalMonth || fiscalMonth < 1 || fiscalMonth > 12) {
      rows.push(occurrence({
        key: `company:tax:corporate-tax-filing:FY${fiscalYear}`,
        source: "operating_fact",
        sourceId: "fiscal_year_end_month",
        sourceHash: sourceHash("corporate_tax_filing_missing", { fiscalYear, fact: factSource(facts, "fiscal_year_end_month")?.source_hash ?? null }),
        scope: "company",
        category: "tax",
        eventKind: "corporate_tax_filing",
        title: "法人税確定申告・納付",
        periodKey: `FY${fiscalYear}`,
        datePrecision: "period",
        dateKind: "法定期限",
        amountStatus: "unknown",
        amountRole: "outgoing",
        ownerMemberId,
        ruleKey: "corporate_tax_filing",
        resolutionHref: "/admin/company",
        lifecycleStatus: "needs_source",
        missingReason: "AMD本体の決算月が未取得。会社情報またはfreeeの正本を確認して再生成",
        sourceObservedAt: factSource(facts, "fiscal_year_end_month")?.observed_at ?? null,
        metadata: { fiscalYear },
      }));
      continue;
    }
    const periodEnd = fiscalYearEndDate(fiscalMonth, fiscalYear);
    const dueCandidate = lastDayOfYm(addMonthsYm(periodEnd.slice(0, 7).replace("-", ""), 2));
    const dueOn = nextBusinessDayFromOfficial(dueCandidate);
    const dueYm = ymFromDate(dueCandidate);
    if (!dateInRange(dueOn, from, to) && !ymInRange(dueYm, from, to)) continue;
    const obligation = findObligation(obligations, ["法人税", "法人事業税", "法人住民税"], dueOn, dueYm);
    if (obligation) continue;
    rows.push(occurrence({
      key: `company:tax:corporate-tax-filing:FY${fiscalYear}`,
      source: "official_rule",
      sourceId: `FY${fiscalYear}`,
      sourceHash: sourceHash("corporate_tax_filing", { fiscalYear, fiscalMonth, fact: factSource(facts, "fiscal_year_end_month")?.source_hash ?? null }),
      scope: "company",
      category: "tax",
      eventKind: "corporate_tax_filing",
      title: "法人税確定申告・納付",
      periodKey: `FY${fiscalYear}`,
      dueOn,
      dueYm,
      datePrecision: dueOn ? "day" : "month",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "corporate_tax_filing",
      resolutionHref: "/admin/finance#payment-obligations",
      lifecycleStatus: dueOn ? "open" : "needs_source",
      missingReason: dueOn ? null : "年度別の休日カレンダーが未取得。公式期限の翌営業日を確定できない",
      metadata: { fiscalYear, periodEnd, rule: "事業年度終了日の翌日から2月以内", rawDueCandidate: dueCandidate },
    }));
  }
  return rows;
}

function nextBusinessDayFromOfficial(date: string): string | null {
  // 法定期限は休日の翌営業日に繰り下げる。祝日表にない将来日の期限は、別途 needs_source で止める。
  return officialBusinessDate(date);
}

function generateCorporateTaxInterim(
  facts: Map<string, OperatingFact>,
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const configured = booleanValue(factValue(facts, "corporate_tax_interim_required"));
  if (configured === false) return [];
  const rows: GeneratedOccurrence[] = [];
  for (const fiscalYear of rangeYears(from, to)) {
    rows.push(occurrence({
      key: `company:tax:corporate-tax-interim:FY${fiscalYear}`,
      source: "operating_fact",
      sourceId: "corporate_tax_interim_required",
      sourceHash: sourceHash("corporate_tax_interim", {
        fiscalYear,
        configured,
        previousTax: factSource(facts, "previous_corporate_tax_yen")?.source_hash ?? null,
      }),
      scope: "company",
      category: "tax",
      eventKind: "corporate_tax_interim",
      title: "法人税中間申告・納付",
      periodKey: `FY${fiscalYear}`,
      datePrecision: "period",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "corporate_tax_interim",
      resolutionHref: "/admin/company",
      lifecycleStatus: "needs_source",
      missingReason: configured === null
        ? "中間申告の適用有無が未確認。前期税額と申告資料を確認して再生成"
        : "中間申告の対象期間・前期税額からの適用判定が未取得。推測で期限を置かない",
      sourceObservedAt: factSource(facts, "corporate_tax_interim_required")?.observed_at ?? null,
      metadata: { fiscalYear, previousCorporateTaxYen: factValue(facts, "previous_corporate_tax_yen") ?? null },
    }));
  }
  return rows;
}

function generateWithholding(
  facts: Map<string, OperatingFact>,
  obligations: RawRow[],
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const mode = String(factValue(facts, "withholding_payment_mode") ?? "").trim().toLowerCase();
  const rows: GeneratedOccurrence[] = [];
  if (mode === "monthly" || /毎月|通常/.test(mode)) {
    for (const salaryYm of monthList(from.slice(0, 7).replace("-", ""), 24)) {
      const officialDue = officialNextMonthDay(salaryYm, 10);
      const dueOn = officialDue.dueOn;
      const dueYm = ymFromDate(officialDue.raw);
      if (!dateInRange(dueOn, from, to) && !ymInRange(dueYm, from, to)) continue;
      const obligation = findObligation(obligations, ["源泉", "源泉所得税"], dueOn, dueYm);
      if (obligation) continue;
      rows.push(occurrence({
        key: `company:tax:withholding-monthly:${salaryYm}`,
        source: "official_rule",
        sourceId: salaryYm,
        sourceHash: sourceHash("withholding_monthly", { salaryYm, mode, fact: factSource(facts, "withholding_payment_mode")?.source_hash ?? null }),
        scope: "company",
        category: "tax",
        eventKind: "withholding_tax_payment",
        title: "源泉所得税納付（通常）",
        periodKey: salaryYm,
        dueOn,
        dueYm,
        datePrecision: dueOn ? "day" : "month",
        dateKind: "法定期限",
        amountStatus: "unknown",
        amountRole: "outgoing",
        ownerMemberId,
        ruleKey: "withholding_monthly",
        resolutionHref: "/admin/finance#payment-obligations",
        lifecycleStatus: dueOn ? "open" : "needs_source",
        missingReason: dueOn ? null : "年度別の休日カレンダーが未取得。公式期限の翌営業日を確定できない",
        metadata: { salaryYm, rule: "給与等を支払った月の翌月10日", rawDueOn: officialDue.raw },
      }));
    }
    return rows;
  }
  if (mode === "special" || /特例|半年/.test(mode)) {
    for (const year of rangeYears(from, to)) {
      const firstDue = `${year}-07-10`;
      const secondDue = `${year + 1}-01-20`;
      for (const item of [{ period: `${year}H1`, due: firstDue }, { period: `${year}H2`, due: secondDue }]) {
        const dueOn = officialBusinessDate(item.due);
        const dueYm = ymFromDate(item.due);
        if (!dateInRange(dueOn, from, to) && !ymInRange(dueYm, from, to)) continue;
        const obligation = findObligation(obligations, ["源泉", "源泉所得税"], dueOn, dueYm);
        if (obligation) continue;
        rows.push(occurrence({
          key: `company:tax:withholding-special:${item.period}`,
          source: "official_rule",
          sourceId: item.period,
          sourceHash: sourceHash("withholding_special", { period: item.period, mode, fact: factSource(facts, "withholding_payment_mode")?.source_hash ?? null }),
          scope: "company",
          category: "tax",
          eventKind: "withholding_tax_payment",
          title: `源泉所得税納付（納期特例 ${item.period}）`,
          periodKey: item.period,
          dueOn,
          dueYm,
          datePrecision: dueOn ? "day" : "month",
          dateKind: "法定期限",
          amountStatus: "unknown",
          amountRole: "outgoing",
          ownerMemberId,
          ruleKey: "withholding_special",
          resolutionHref: "/admin/finance#payment-obligations",
          lifecycleStatus: dueOn ? "open" : "needs_source",
          missingReason: dueOn ? null : "年度別の休日カレンダーが未取得。公式期限の翌営業日を確定できない",
          metadata: { period: item.period, rule: "1月から6月は7月10日、7月から12月は翌年1月20日", rawDueOn: item.due },
        }));
      }
    }
    return rows;
  }
  return [occurrence({
    key: "company:tax:withholding:needs-source",
    source: "operating_fact",
    sourceId: "withholding_payment_mode",
    sourceHash: sourceHash("withholding_mode_missing", factSource(facts, "withholding_payment_mode")?.source_hash ?? null),
    scope: "company",
    category: "tax",
    eventKind: "withholding_tax_payment",
    title: "源泉所得税納付（納付方式未確認）",
    periodKey: null,
    datePrecision: "period",
    dateKind: "法定期限",
    amountStatus: "unknown",
    amountRole: "outgoing",
    ownerMemberId,
    ruleKey: "withholding_monthly",
    resolutionHref: "/admin/company",
    lifecycleStatus: "needs_source",
    missingReason: "毎月納付か納期特例か未確認。納付書・税務資料を正本へ反映して再生成",
  })];
}

function generateSocialInsurance(
  facts: Map<string, OperatingFact>,
  obligations: RawRow[],
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const enrolled = booleanValue(factValue(facts, "social_insurance_enrollment"));
  if (enrolled === false) return [];
  if (enrolled === null) {
    return [occurrence({
      key: "company:labor:social-insurance:needs-source",
      source: "operating_fact",
      sourceId: "social_insurance_enrollment",
      sourceHash: sourceHash("social_insurance_missing", factSource(facts, "social_insurance_enrollment")?.source_hash ?? null),
      scope: "company",
      category: "labor",
      eventKind: "social_insurance_payment",
      title: "社会保険料納付（加入状態未確認）",
      datePrecision: "period",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "social_insurance_month_end",
      resolutionHref: "/admin/company",
      lifecycleStatus: "needs_source",
      missingReason: "社会保険の加入状態が未取得。日本年金機構の納入告知書または給与正本を確認",
    })];
  }
  return monthList(from.slice(0, 7).replace("-", ""), 24).flatMap((targetYm) => {
    const officialDue = officialNextMonthEnd(targetYm);
    const dueOn = officialDue.dueOn;
    const dueYm = ymFromDate(officialDue.raw);
    if (!dateInRange(dueOn, from, to) && !ymInRange(dueYm, from, to)) return [];
    if (findObligation(obligations, ["社会保険", "厚生年金", "健康保険"], dueOn, dueYm)) return [];
    return [occurrence({
      key: `company:labor:social-insurance:${targetYm}`,
      source: "official_rule",
      sourceId: targetYm,
      sourceHash: sourceHash("social_insurance_month_end", { targetYm, fact: factSource(facts, "social_insurance_enrollment")?.source_hash ?? null }),
      scope: "company",
      category: "labor",
      eventKind: "social_insurance_payment",
      title: `社会保険料納付（${targetYm.slice(0, 4)}年${Number(targetYm.slice(4, 6))}月分）`,
      periodKey: targetYm,
      dueOn,
      dueYm,
      datePrecision: dueOn ? "day" : "month",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "social_insurance_month_end",
      resolutionHref: "/admin/finance#payment-obligations",
      lifecycleStatus: dueOn ? "open" : "needs_source",
      missingReason: dueOn ? null : "年度別の休日カレンダーが未取得。公式期限の翌営業日を確定できない",
      metadata: { targetYm, rule: "納付対象月の翌月末日（休日の場合は翌営業日）", rawDueOn: officialDue.raw },
    })];
  });
}

function generateLaborInsurance(
  facts: Map<string, OperatingFact>,
  obligations: RawRow[],
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const enrolled = booleanValue(factValue(facts, "labor_insurance_enrollment"));
  if (enrolled === false) return [];
  if (enrolled === null) {
    return [occurrence({
      key: "company:labor:labor-insurance-annual:needs-source",
      source: "operating_fact",
      sourceId: "labor_insurance_enrollment",
      sourceHash: sourceHash("labor_insurance_missing", factSource(facts, "labor_insurance_enrollment")?.source_hash ?? null),
      scope: "company",
      category: "labor",
      eventKind: "labor_insurance_annual_update",
      title: "労働保険年度更新（加入状態未確認）",
      datePrecision: "period",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "labor_insurance_annual_update",
      resolutionHref: "/admin/company",
      lifecycleStatus: "needs_source",
      missingReason: "労働保険の加入状態が未取得。労働局の年度更新資料を確認",
    })];
  }
  return rangeYears(from, to).flatMap((year) => {
    const officialDeadline = year === 2026 ? "2026-07-10" : null;
    if (findObligation(obligations, ["労働保険", "年度更新"], officialDeadline, `${year}07`)) return [];
    return occurrence({
      key: `company:labor:labor-insurance-annual:${year}`,
      source: officialDeadline ? "official_rule" : "official_rule_pending",
      sourceId: String(year),
      sourceHash: sourceHash("labor_insurance_annual_update", { year, officialDeadline, fact: factSource(facts, "labor_insurance_enrollment")?.source_hash ?? null }),
      scope: "company",
      category: "labor",
      eventKind: "labor_insurance_annual_update",
      title: `労働保険年度更新（${year}年度）`,
      periodKey: `${year}年度`,
      dueOn: officialDeadline && dateInRange(officialDeadline, from, to) ? officialDeadline : null,
      dueYm: officialDeadline ? ymFromDate(officialDeadline) : null,
      datePrecision: officialDeadline ? "day" : "period",
      dateKind: "法定期限",
      amountStatus: "unknown",
      amountRole: "outgoing",
      ownerMemberId,
      ruleKey: "labor_insurance_annual_update",
      resolutionHref: "/admin/finance#payment-obligations",
      lifecycleStatus: officialDeadline ? "open" : "needs_source",
      missingReason: officialDeadline ? null : "年度ごとの公表期限が未取得。前年度の日付を複製しない",
      metadata: { year, officialDeadline, officialWindow: "6月1日から7月10日（年度ごとの公表日を優先）" },
    });
  });
}

function generateYearEndAdjustment(facts: Map<string, OperatingFact>, ownerMemberId: string | null, from: string, to: string): GeneratedOccurrence[] {
  return rangeYears(from, to).map((year) => {
    const exactDate = text(factValue(facts, "year_end_adjustment_deadline_ymd"));
    const dueOn = exactDate && exactDate.startsWith(String(year)) ? exactDate : null;
    return occurrence({
      key: `company:labor:year-end-adjustment:${year}`,
      source: dueOn ? "operating_fact" : "operating_fact_missing",
      sourceId: "year_end_adjustment_deadline_ymd",
      sourceHash: sourceHash("year_end_adjustment", { year, fact: factSource(facts, "year_end_adjustment_deadline_ymd")?.source_hash ?? null }),
      scope: "company",
      category: "labor",
      eventKind: "year_end_adjustment",
      title: `年末調整の社内工程（${year}年分）`,
      periodKey: `${year}年分`,
      dueOn,
      dueYm: dueOn ? ymFromDate(dueOn) : `${year}12`,
      datePrecision: dueOn ? "day" : "period",
      dateKind: "社内工程",
      amountStatus: "not_applicable",
      amountRole: "informational",
      ownerMemberId,
      ruleKey: "year_end_adjustment",
      resolutionHref: "/admin/company",
      lifecycleStatus: dueOn ? "open" : "needs_source",
      missingReason: dueOn ? null : "給与締日・最終給与処理・提出工程から社内期限を確定できる事実が未取得",
      sourceObservedAt: factSource(facts, "year_end_adjustment_deadline_ymd")?.observed_at ?? null,
    });
  });
}

function dateOnly(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match && isIsoDate(match[1]) ? match[1] : null;
}

function monthsInRange(from: string, to: string): string[] {
  const fromYm = from.slice(0, 7).replace("-", "");
  const toYm = to.slice(0, 7).replace("-", "");
  if (!isYm(fromYm) || !isYm(toYm)) return [];
  const result: string[] = [];
  let cursor = fromYm;
  for (let index = 0; index < 60 && cursor <= toYm; index += 1) {
    result.push(cursor);
    cursor = addMonthsYm(cursor, 1);
  }
  return result;
}

function projectOwnerId(projectId: string | null, project: RawRow, contract: RawRow | null, projectMembers: RawRow[], members: RawRow[]): string | null {
  const explicit = project.owner_member_id ?? project.business_owner_member_id ?? contract?.owner_member_id;
  const direct = ownerIdByName(explicit, members);
  if (direct) return direct;
  const named = ownerIdByName(project.business_owner ?? contract?.business_owner, members);
  if (named) return named;
  const assignment = projectMembers.find((row) => {
    if (String(row.project_id) !== String(projectId)) return false;
    const role = normalized(row.role ?? row.member_role ?? row.assignment_role);
    return row.is_pm === true || row.is_pl === true || role.includes("pm") || role.includes("pl") || role.includes("owner") || role.includes("責任");
  });
  return assignment?.member_id ? String(assignment.member_id) : null;
}

function projectLabel(project: RawRow | null, projectId: string | null): string {
  if (!project) return projectId ? `PJ ${projectId}` : "プロジェクト不明";
  return String(project.project_name ?? project.name ?? project.client_name ?? project.project_id ?? projectId ?? "プロジェクト");
}

function reportCompletion(report: RawRow | null): boolean {
  if (!report) return false;
  if (report.fixed_at || report.completed_at || report.confirmed_at || report.published_at) return true;
  return /fixed|confirmed|complete|approved|published|確定|承認済/.test(normalized(report.status));
}

function generateContracts(
  contracts: RawRow[],
  projects: RawRow[],
  projectMembers: RawRow[],
  members: RawRow[],
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const rows: GeneratedOccurrence[] = [];
  const projectById = new Map(projects.map((project) => [String(project.project_id), project]));
  for (const contract of contracts.filter(isAcceptedAmdContract)) {
    const projectId = text(contract.project_id);
    const project = projectById.get(String(projectId)) ?? null;
    const terms = projectTerms(project ?? {}, contract);
    const ownerMemberId = projectOwnerId(projectId, project ?? {}, contract, projectMembers, members);
    const sourceRefs = [
      { kind: "contract", ref: contract.contract_id ?? contract.id },
      projectId ? { kind: "project", ref: projectId } : null,
    ].filter(Boolean);
    const base = `project:contract:${contract.contract_id ?? contract.id}`;
    const sourceObservedAt = text(contract.updated_at ?? contract.signed_at);
    const amountYen = contractAmount(contract, terms);
    const amountStatus: AmountStatus = amountYen == null ? "unknown" : "exact";
    const ownerMissing = !ownerMemberId ? "担当者が契約正本に紐づいていない" : null;
    const addContractEvent = (input: {
      key: string;
      eventKind: string;
      title: string;
      dueOn: string | null;
      dueYm?: string | null;
      precision: DatePrecision;
      dateKind: string;
      missingReason?: string | null;
      metadata?: JsonRecord;
    }) => {
      const missingReason = input.missingReason ?? ownerMissing;
      rows.push(occurrence({
        key: input.key,
        source: "contracts",
        sourceId: String(contract.contract_id ?? contract.id),
        sourceHash: sourceHash(input.eventKind, { contract, terms, event: input.eventKind }),
        scope: "project",
        category: "contract",
        eventKind: input.eventKind,
        title: `${projectLabel(project, projectId)} / ${input.title}`,
        periodKey: input.dueYm ?? (input.dueOn ? ymFromDate(input.dueOn) : null),
        dueOn: input.dueOn,
        dueYm: input.dueYm ?? (input.dueOn ? ymFromDate(input.dueOn) : null),
        datePrecision: input.precision,
        dateKind: input.dateKind,
        amountYen,
        amountStatus,
        amountRole: "contract_reference",
        projectId,
        ownerMemberId,
        sourceRefs,
        resolutionHref: projectId ? `/admin/contracts?projectId=${encodeURIComponent(projectId)}` : "/admin/contracts",
        lifecycleStatus: missingReason ? "needs_source" : "open",
        missingReason,
        sourceObservedAt,
        metadata: { contractId: contract.contract_id ?? contract.id, ...input.metadata },
      }));
    };

    const expectedSigningDate = dateOnly(contract.expected_signing_date ?? contract.expected_signature_date);
    if (isContractSigningExpected(contract)) {
      addContractEvent({
        key: `${base}:signing`,
        eventKind: "contract_signing",
        title: "契約締結見込み",
        dueOn: expectedSigningDate,
        dueYm: expectedSigningDate ? ymFromDate(expectedSigningDate) : null,
        precision: expectedSigningDate ? "day" : "period",
        dateKind: "契約工程",
        missingReason: expectedSigningDate ? null : "契約締結見込み日が正本に未設定",
      });
    }

    const current = isCurrentAmdContract(contract);
    const expirationDate = dateOnly(contract.expiration_date ?? contract.expires_at);
    const indefinite = booleanValue(terms.indefinite ?? terms.isIndefinite) === true || /無期限|indefinite/i.test(String(terms.contractPeriod ?? terms.contract_period ?? ""));
    if (expirationDate || (current && !indefinite)) {
      addContractEvent({
        key: `${base}:expiration`,
        eventKind: "contract_expiration",
        title: "契約満了",
        dueOn: expirationDate,
        dueYm: expirationDate ? ymFromDate(expirationDate) : null,
        precision: expirationDate ? "day" : "period",
        dateKind: "契約期限",
        missingReason: expirationDate ? null : "契約満了日が正本に未設定。無期限かどうかも確認が必要",
      });
    }

    const renewalDate = dateOnly(contract.renewal_notice_date ?? contract.renewal_date);
    const renewalRequired = booleanValue(terms.renewal_required ?? terms.renewalRequired) === true
      || Boolean(renewalDate)
      || Boolean(contract.renewal_notice_date);
    if (renewalRequired) {
      addContractEvent({
        key: `${base}:renewal`,
        eventKind: "contract_renewal",
        title: "契約更新判断",
        dueOn: renewalDate,
        dueYm: renewalDate ? ymFromDate(renewalDate) : null,
        precision: renewalDate ? "day" : "period",
        dateKind: "契約更新期限",
        missingReason: renewalDate ? null : "契約更新通知期限が正本に未設定",
      });
    }
  }
  return rows.filter((row) => dateInRange(row.due_on, from, to) || ymInRange(row.due_ym, from, to) || row.lifecycle_status === "needs_source");
}

function generateReports(
  contracts: RawRow[],
  projects: RawRow[],
  projectMembers: RawRow[],
  members: RawRow[],
  monthlyReports: RawRow[],
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const rows: GeneratedOccurrence[] = [];
  const currentContracts = contracts.filter(isCurrentAmdContract);
  const contractByProject = new Map<string, RawRow>();
  for (const contract of currentContracts) {
    const projectId = text(contract.project_id);
    if (projectId && !contractByProject.has(projectId)) contractByProject.set(projectId, contract);
  }
  const reportByKey = new Map(monthlyReports.map((report) => [`${report.project_id}:${String(report.ym ?? "").replace("-", "")}`, report]));
  const targetMonths = monthsInRange(addMonthsYm(from.slice(0, 7).replace("-", ""), -1).replace(/^(\d{4})(\d{2})$/, "$1-$2-01"), to);
  for (const project of projects) {
    const projectId = text(project.project_id);
    if (!projectId) continue;
    const contract = contractByProject.get(projectId) ?? null;
    if (!contract) continue;
    const terms = projectTerms(project, contract);
    const reportPlan = planMonthlyReportSchedule(terms);
    if (reportPlan.kind === "none") continue;
    const ownerMemberId = projectOwnerId(projectId, project, contract, projectMembers, members);
    const ownerMissing = !ownerMemberId ? "報告提出担当者が正本に未設定" : null;
    let unresolvedMonths = 0;
    if (reportPlan.kind === "expanded") {
      for (const reportYm of targetMonths) {
        const report = reportByKey.get(`${projectId}:${reportYm}`) ?? null;
        const dueOn = deadlineForReportYm(reportYm, reportPlan.rule);
        if (!dueOn) {
          unresolvedMonths += 1;
          continue;
        }
        const completed = reportCompletion(report);
        rows.push(occurrence({
          key: `project:report:monthly:${projectId}:${reportYm}`,
          source: "contract_terms",
          sourceId: String(contract.contract_id ?? contract.id),
          sourceHash: sourceHash("monthly_report", { project, contract, reportYm, rule: reportPlan.rule }),
          scope: "project",
          category: "report",
          eventKind: "monthly_report_submission",
          title: `${projectLabel(project, projectId)} / 月次報告提出（${reportYm.slice(0, 4)}年${Number(reportYm.slice(4, 6))}月分）`,
          periodKey: reportYm,
          dueOn,
          dueYm: ymFromDate(dueOn),
          datePrecision: "day",
          dateKind: "契約上の提出期限",
          amountStatus: "not_applicable",
          amountRole: "informational",
          projectId,
          ownerMemberId,
          sourceRefs: [
            { kind: "contract", ref: contract.contract_id ?? contract.id },
            { kind: "monthly_report", ref: report?.report_id ?? report?.id ?? `${projectId}:${reportYm}` },
          ],
          resolutionHref: `/admin/contracts?projectId=${encodeURIComponent(projectId)}`,
          lifecycleStatus: completed ? "completed" : ownerMissing ? "needs_source" : "open",
          missingReason: ownerMissing,
          sourceObservedAt: text(report?.updated_at ?? contract.updated_at),
          metadata: { reportYm, contractId: contract.contract_id ?? contract.id, reportId: report?.report_id ?? report?.id ?? null },
        }));
      }
    }

    if (reportPlan.kind === "contract_gap" || unresolvedMonths > 0) {
      const missingReasonBase = reportPlan.kind === "contract_gap"
        ? reportPlan.missingReason
        : "契約上の月次報告義務はあるが、一部の月をカレンダー日付へ解決できない";
      const missingReason = ownerMissing ? `${missingReasonBase}。${ownerMissing}` : missingReasonBase;
      rows.push(occurrence({
        key: `project:report:deadline-missing:${projectId}:${contract.contract_id ?? contract.id}`,
        source: "contract_terms",
        sourceId: String(contract.contract_id ?? contract.id),
        sourceHash: sourceHash("monthly_report_deadline_missing", {
          project,
          contract,
          rawRuleText: reportPlan.rawRuleText,
          unresolvedMonths,
        }),
        scope: "project",
        category: "report",
        eventKind: "report_deadline_missing",
        title: `${projectLabel(project, projectId)} / 月次報告期限ルール要確認`,
        periodKey: String(contract.contract_id ?? contract.id ?? projectId),
        dueOn: null,
        dueYm: null,
        datePrecision: "unknown",
        dateKind: "契約上の提出義務",
        amountStatus: "not_applicable",
        amountRole: "informational",
        projectId,
        ownerMemberId,
        sourceRefs: [{ kind: "contract", ref: contract.contract_id ?? contract.id }],
        resolutionHref: `/admin/contracts?projectId=${encodeURIComponent(projectId)}`,
        lifecycleStatus: "needs_source",
        missingReason,
        sourceObservedAt: text(contract.updated_at),
        metadata: {
          contractId: contract.contract_id ?? contract.id,
          rawRuleText: reportPlan.rawRuleText,
          unresolvedMonths,
        },
      }));
    }

    const annualRaw = terms.annualReportSubmissionDeadline ?? terms.annual_report_submission_deadline;
    if (annualRaw != null && String(annualRaw).trim()) {
      const annualRule = reportRule({ monthlyReportSubmissionDeadline: annualRaw });
      for (const year of rangeYears(from, to)) {
        const explicit = dateOnly(annualRaw);
        const annualYm = `${year}12`;
        const dueOn = explicit && explicit.startsWith(String(year))
          ? explicit
          : annualRule && /\d{1,2}月/.test(String(annualRaw))
            ? deadlineForReportYm(`${year}${String(readDeadlineDay(String(annualRaw).match(/(\d{1,2})月/)?.[1]) ?? 12).padStart(2, "0")}`, annualRule)
            : null;
        const missingReason = ownerMissing ?? (!dueOn ? "年次報告の提出期限を正本から確定できない" : null);
        const annualReport = monthlyReports.find((report) => String(report.project_id) === projectId && String(report.ym ?? "").replace("-", "").startsWith(String(year)) && /annual|year|年次/.test(normalized(report.report_kind ?? report.kind ?? report.category)));
        rows.push(occurrence({
          key: `project:report:annual:${projectId}:${year}`,
          source: "contract_terms",
          sourceId: String(contract.contract_id ?? contract.id),
          sourceHash: sourceHash("annual_report", { project, contract, year, annualRaw }),
          scope: "project",
          category: "report",
          eventKind: "annual_report_submission",
          title: `${projectLabel(project, projectId)} / 年次報告提出（${year}年度）`,
          periodKey: `${year}年度`,
          dueOn,
          dueYm: dueOn ? ymFromDate(dueOn) : annualYm,
          datePrecision: dueOn ? "day" : "period",
          dateKind: "契約上の提出期限",
          amountStatus: "not_applicable",
          amountRole: "informational",
          projectId,
          ownerMemberId,
          sourceRefs: [{ kind: "contract", ref: contract.contract_id ?? contract.id }, { kind: "annual_report", ref: annualReport?.report_id ?? annualReport?.id ?? `${projectId}:${year}` }],
          resolutionHref: `/admin/contracts?projectId=${encodeURIComponent(projectId)}`,
          lifecycleStatus: reportCompletion(annualReport ?? null) ? "completed" : missingReason ? "needs_source" : "open",
          missingReason,
          sourceObservedAt: text(annualReport?.updated_at ?? contract.updated_at),
          metadata: { year, annualRaw, contractId: contract.contract_id ?? contract.id },
        }));
      }
    }
  }
  return rows.filter((row) => dateInRange(row.due_on, from, to) || ymInRange(row.due_ym, from, to) || row.lifecycle_status === "needs_source");
}

function actionCategory(value: unknown): ScheduleCategory {
  const category = normalized(value);
  if (/tax|税/.test(category)) return "tax";
  if (/contract|契約/.test(category)) return "contract";
  if (/invoice|billing|請求/.test(category)) return "invoice";
  if (/payment|支払|入金/.test(category)) return "payment";
  if (/report|報告/.test(category)) return "report";
  return "governance";
}

function generateActionItems(
  actionItems: RawRow[],
  obligations: RawRow[],
  projects: RawRow[],
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const projectById = new Map(projects.map((project) => [String(project.project_id), project]));
  return actionItems.filter(isScheduleActionItem).flatMap((action) => {
    const dueOn = dateOnly(action.due_at ?? action.due_on);
    const dueYm = dueOn ? ymFromDate(dueOn) : text(action.due_ym);
    if (!dueOn || !dateInRange(dueOn, from, to)) return [];
    const title = String(action.title ?? action.summary ?? "確定action item");
    const sourceRef = text(action.source_ref ?? action.source_id ?? action.action_id ?? action.id);
    const isPaymentDuplicate = obligations.some((obligation) => {
      const obligationRef = text(obligation.source_ref ?? obligation.id);
      if (sourceRef && obligationRef && normalized(sourceRef) === normalized(obligationRef)) return true;
      return matchesObligation(obligation, [title], dueOn, dueYm);
        });
    if (isPaymentDuplicate) return [];
    const projectId = text(action.project_id);
    const project = projectById.get(String(projectId)) ?? null;
    const ownerMemberId = text(action.assignee_member_id ?? action.owner_member_id);
    const actionMetadata = record(action.metadata_json ?? action.metadata);
    const actionClassification = action.category ?? action.source ?? actionMetadata.classification ?? actionMetadata.category;
    return [occurrence({
      key: `company:action:${action.action_id ?? action.id}`,
      source: "action_items",
      sourceId: String(action.action_id ?? action.id),
      sourceHash: sourceHash("action_item", action),
      scope: projectId ? "project" : "company",
      category: actionCategory(actionClassification),
      eventKind: "confirmed_action_item",
      title: project ? `${projectLabel(project, projectId)} / ${title}` : title,
      periodKey: dueYm,
      dueOn,
      dueYm,
      datePrecision: "day",
      dateKind: "確定action item期限",
      ...amountFields(null, "not_applicable", "informational"),
      projectId,
      ownerMemberId,
      sourceRefs: [{ kind: "action_item", ref: action.action_id ?? action.id }, sourceRef ? { kind: action.source ?? "source", ref: sourceRef } : null].filter(Boolean),
      resolutionHref: text(action.action_url) ?? (projectId ? `/project/${encodeURIComponent(projectId)}` : "/admin/weekly"),
      lifecycleStatus: ownerMemberId ? "open" : "needs_source",
      missingReason: ownerMemberId ? null : "action itemの担当者が未設定",
      sourceObservedAt: text(action.updated_at ?? action.created_at),
      metadata: { actionId: action.action_id ?? action.id, priority: action.priority ?? null, source: action.source ?? null },
    })];
  });
}

export const INTERNAL_PREP_SPECS: Record<string, InternalPrepSpec> = {
  corporate_tax_filing: { offsetDays: -30, title: "決算書・法人税申告書の作成" },
  corporate_tax_interim: { offsetDays: -14, title: "中間申告書・納付額の確認" },
  withholding_tax_payment: { offsetDays: -5, title: "所得税徴収高計算書・納付額の確認" },
  social_insurance_payment: { offsetDays: -5, title: "納入告知額・口座残高の確認" },
  labor_insurance_annual_update: { offsetDays: -14, title: "年度更新申告書・賃金集計の作成" },
};

export function addInternalPrepMilestones(
  rows: GeneratedOccurrence[],
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const milestones: GeneratedOccurrence[] = [];
  for (const row of rows) {
    if (!row.due_on || row.lifecycle_status !== "open") continue;
    const spec = INTERNAL_PREP_SPECS[row.event_kind];
    if (!spec) continue;
    const prepDueOn = addDays(row.due_on, spec.offsetDays);
    if (!dateInRange(prepDueOn, from, to)) continue;
    milestones.push(occurrence({
      key: `${row.occurrence_key}:internal-prep`,
      source: "internal_prep_milestone",
      sourceId: row.occurrence_key,
      sourceHash: sourceHash("internal_prep_milestone", { parent: row.occurrence_key, prepDueOn, spec }),
      scope: row.scope,
      category: row.category,
      eventKind: `${row.event_kind}_internal_prep`,
      title: spec.title,
      periodKey: row.period_key,
      dueOn: prepDueOn,
      dueYm: ymFromDate(prepDueOn),
      datePrecision: "day",
      dateKind: "社内締切",
      amountStatus: "not_applicable",
      amountRole: "informational",
      ownerMemberId: row.owner_member_id,
      resolutionHref: row.resolution_href,
      lifecycleStatus: "open",
      sourceObservedAt: row.source_observed_at,
      metadata: {
        ...row.metadata_json,
        parentOccurrenceKey: row.occurrence_key,
        parentEventKind: row.event_kind,
        leadDays: spec.offsetDays,
        parentSourceKind: row.source_kind,
        parentSourceId: row.source_id,
        parentSourceHash: row.source_hash,
      },
    }));
  }
  return milestones;
}

const SHAREHOLDER_MEETING_EGOV_URL = "https://laws.e-gov.go.jp/document?lawid=417AC0000000086_20260624_508AC0000000046";
const SHAREHOLDER_MEETING_AS_OF = "2026-08-19";
const CANONICAL_SHAREHOLDER_MEETING_TYPES = ["agm", "annual", "annual_general_meeting", "定時株主総会"];
export const SHAREHOLDER_MEETING_FLOW: Array<{ days: number; label: string; kind: string; dateKind: string }> = [
  { days: -21, label: "計算書類・事業報告・議案・招集通知の確定", kind: "shareholder_documents_finalized", dateKind: "社内工程目安" },
  { days: -14, label: "招集通知・総会資料の発送", kind: "shareholder_notice_dispatch", dateKind: "社内工程目安" },
  { days: 0, label: "定時株主総会", kind: "shareholder_general_meeting", dateKind: "確定開催日" },
  { days: 7, label: "株主総会議事録・登記要否の確認", kind: "shareholder_followup", dateKind: "社内工程目安" },
];

const CANONICAL_SHAREHOLDER_MEETING_TYPES_NORMALIZED = new Set(CANONICAL_SHAREHOLDER_MEETING_TYPES.map((value) => normalized(value)));

export function canonicalShareholderMeetingForYear(rows: RawRow[], year: number): RawRow | null {
  return rows.find((row) => CANONICAL_SHAREHOLDER_MEETING_TYPES_NORMALIZED.has(normalized(row.meeting_type))
      && dateOnly(row.meeting_date)?.startsWith(String(year))) ?? null;
}

export function generateShareholderMeeting(
  facts: Map<string, OperatingFact>,
  shareholderMeetings: RawRow[],
  ownerMemberId: string | null,
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const rows: GeneratedOccurrence[] = [];
  const factDate = dateOnly(factValue(facts, "shareholder_meeting_date"));
  for (const year of rangeYears(from, to)) {
    const canonical = canonicalShareholderMeetingForYear(shareholderMeetings, year);
    const authoritativeDate = canonical
      ? dateOnly(canonical.meeting_date)
      : (factDate && factDate.startsWith(String(year)) ? factDate : null);
    if (!authoritativeDate) {
      const febYm = `${year}02`;
      const marYm = `${year}03`;
      if (ymInRange(febYm, from, to)) {
        rows.push(occurrence({
          key: `company:governance:shareholder-meeting:${year}:prep-guidance`,
          source: "operating_fact_missing",
          sourceId: "shareholder_meeting_date",
          sourceHash: sourceHash("shareholder_meeting_prep_guidance", { year, fact: factSource(facts, "shareholder_meeting_date")?.source_hash ?? null }),
          scope: "company",
          category: "governance",
          eventKind: "shareholder_meeting_prep_guidance",
          title: `計算書類・事業報告・議案・招集通知の作成目安（${year}年2月・月精度の目安）`,
          periodKey: febYm,
          dueYm: febYm,
          datePrecision: "month",
          dateKind: "月精度の目安",
          amountStatus: "not_applicable",
          amountRole: "informational",
          ownerMemberId,
          resolutionHref: "/admin/company",
          lifecycleStatus: "needs_source",
          missingReason: "定時株主総会の確定日が未取得。正本要確認、月精度の目安のみで法定期限としての断定はしない",
          metadata: {
            year,
            egovUrl: SHAREHOLDER_MEETING_EGOV_URL,
            asOf: SHAREHOLDER_MEETING_AS_OF,
            guidance: "authoritative_date_not_confirmed",
            statutoryDeadline: false,
            needsSourceLabel: "正本要確認",
          },
        }));
      }
      if (ymInRange(marYm, from, to)) {
        rows.push(occurrence({
          key: `company:governance:shareholder-meeting:${year}`,
          source: "operating_fact_missing",
          sourceId: "shareholder_meeting_date",
          sourceHash: sourceHash("shareholder_meeting_guidance", { year, fact: factSource(facts, "shareholder_meeting_date")?.source_hash ?? null }),
          scope: "company",
          category: "governance",
          eventKind: "shareholder_general_meeting",
          title: `定時株主総会 開催目安（${year}年3月・月精度の目安）`,
          periodKey: marYm,
          dueYm: marYm,
          datePrecision: "month",
          dateKind: "月精度の目安",
          amountStatus: "not_applicable",
          amountRole: "informational",
          ownerMemberId,
          resolutionHref: "/admin/company",
          lifecycleStatus: "needs_source",
          missingReason: "定時株主総会の確定日が未取得。正本要確認、月精度の目安のみで法定期限としての断定はしない",
          metadata: {
            year,
            egovUrl: SHAREHOLDER_MEETING_EGOV_URL,
            asOf: SHAREHOLDER_MEETING_AS_OF,
            guidance: "authoritative_date_not_confirmed",
            statutoryDeadline: false,
            needsSourceLabel: "正本要確認",
          },
        }));
      }
      continue;
    }
    const sourceKind = canonical ? "project_shareholder_meetings" : "operating_fact";
    const sourceId = canonical ? String(canonical.id) : "shareholder_meeting_date";
    const sourceRef = canonical ? (text(canonical.source_ref) ?? String(canonical.id)) : null;
    const sourceObservedAt = canonical ? text(canonical.updated_at) : factSource(facts, "shareholder_meeting_date")?.observed_at ?? null;
    for (const step of SHAREHOLDER_MEETING_FLOW) {
      const dueOn = addDays(authoritativeDate, step.days);
      if (!dateInRange(dueOn, from, to)) continue;
      rows.push(occurrence({
        key: `company:governance:shareholder-meeting:${year}:${step.kind}`,
        source: sourceKind,
        sourceId,
        sourceHash: sourceHash("shareholder_meeting_flow", { year, step, authoritativeDate, sourceKind, sourceId }),
        scope: "company",
        category: "governance",
        eventKind: step.kind,
        title: step.days === 0 ? step.label : `定時株主総会 / ${step.label}`,
        periodKey: `${year}年`,
        dueOn,
        dueYm: ymFromDate(dueOn),
        datePrecision: "day",
        dateKind: step.dateKind,
        amountStatus: "not_applicable",
        amountRole: "informational",
        ownerMemberId,
        sourceRefs: canonical ? [{ kind: "project_shareholder_meetings", ref: sourceRef }] : [],
        resolutionHref: "/admin/company",
        lifecycleStatus: "open",
        sourceObservedAt,
        metadata: {
          year,
          offsetDays: step.days,
          egovUrl: SHAREHOLDER_MEETING_EGOV_URL,
          asOf: SHAREHOLDER_MEETING_AS_OF,
          authoritativeDate,
          authoritativeSource: sourceKind,
          sourceRef,
          statutoryDeadline: false,
        },
      }));
    }
  }
  return rows;
}

function occurrencePriority(row: GeneratedOccurrence): number {
  if (row.source_kind === "company_payment_obligation") return 100;
  if (row.source_kind === "contracts") return 90;
  if (row.source_kind === "billing_cycles") return 80;
  if (row.source_kind === "contract_terms") return 70;
  if (row.source_kind === "action_items") return 60;
  return 50;
}

function dedupeOccurrences(rows: GeneratedOccurrence[]): GeneratedOccurrence[] {
  const byKey = new Map<string, GeneratedOccurrence>();
  for (const row of rows) {
    const current = byKey.get(row.occurrence_key);
    if (!current || occurrencePriority(row) > occurrencePriority(current)) byKey.set(row.occurrence_key, row);
  }
  return [...byKey.values()].sort((left, right) => {
    const leftDate = left.due_on ?? `${left.due_ym ?? "999999"}-99`;
    const rightDate = right.due_on ?? `${right.due_ym ?? "999999"}-99`;
    return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
  });
}

async function persistGeneratedOccurrences(
  db: ScheduleDb,
  generated: GeneratedOccurrence[],
  from: string,
  to: string,
): Promise<Pick<ScheduleGenerationResult, "inserted" | "updated" | "superseded" | "errors">> {
  const errors: string[] = [];
  const currentResult = await db.from("company_schedule_occurrences")
    .select("*")
    .eq("current_version", true)
    .limit(10000);
  if (currentResult.error) return { inserted: 0, updated: 0, superseded: 0, errors: [currentResult.error.message] };
  const currentRows = (currentResult.data ?? []) as RawRow[];
  const currentByKey = new Map(currentRows.map((row) => [String(row.occurrence_key), row]));
  const seenKeys = new Set<string>();
  let inserted = 0;
  let updated = 0;
  let superseded = 0;
  const now = new Date().toISOString();

  for (const item of generated) {
    seenKeys.add(item.occurrence_key);
    const current = currentByKey.get(item.occurrence_key);
    if (current && String(current.source_hash) === item.source_hash) {
      const { error } = await db.from("company_schedule_occurrences")
        .update({ ...item, current_version: true, superseded_at: null, last_seen_at: now, updated_at: now })
        .eq("occurrence_id", current.occurrence_id);
      if (error) errors.push(`${item.occurrence_key}: ${error.message}`);
      else updated += 1;
      continue;
    }
    if (current) {
      const { error } = await db.from("company_schedule_occurrences")
        .update({ current_version: false, lifecycle_status: "superseded", generation_state: "superseded", superseded_at: now, updated_at: now })
        .eq("occurrence_id", current.occurrence_id);
      if (error) {
        errors.push(`${item.occurrence_key}: supersede failed: ${error.message}`);
        continue;
      }
      superseded += 1;
    }
    const { error } = await db.from("company_schedule_occurrences")
      .insert({ ...item, current_version: true, superseded_at: null });
    if (error) errors.push(`${item.occurrence_key}: insert failed: ${error.message}`);
    else inserted += 1;
  }

  for (const current of currentRows) {
    if (seenKeys.has(String(current.occurrence_key))) continue;
    const currentDate = dateOnly(current.due_on);
    const inScope = dateInRange(currentDate, from, to) || ymInRange(text(current.due_ym), from, to) || (!currentDate && !current.due_ym);
    if (!inScope) continue;
    const { error } = await db.from("company_schedule_occurrences")
      .update({ current_version: false, lifecycle_status: "superseded", generation_state: "superseded", superseded_at: now, updated_at: now })
      .eq("occurrence_id", current.occurrence_id);
    if (error) errors.push(`${current.occurrence_key}: stale row failed: ${error.message}`);
    else superseded += 1;
  }
  return { inserted, updated, superseded, errors };
}

async function persistRuleChecks(db: ScheduleDb): Promise<string[]> {
  const errors: string[] = [];
  for (const rule of Object.values(OFFICIAL_RULES)) {
    const reference = rule.officialRefs[0];
    if (!reference) continue;
    const contentHash = stableHash({ ruleKey: rule.ruleKey, ruleVersion: rule.ruleVersion, officialRefs: rule.officialRefs });
    const { error } = await db.from("company_schedule_rule_checks").upsert({
      rule_key: rule.ruleKey,
      rule_version: rule.ruleVersion,
      official_url: reference.url,
      checked_at: `${reference.asOf}T00:00:00+09:00`,
      content_hash: contentHash,
      status: "reviewed",
      review_after: rule.reviewAfter,
      note: `実装時一次情報確認。一次情報確認日 ${reference.asOf}。本文hash自動監視は別writer。content_hashはlocal rule bundle hashであり公式本文hashではない。`,
    }, { onConflict: "rule_key,content_hash" });
    if (error) errors.push(`${rule.ruleKey}: ${error.message}`);
  }
  return errors;
}

export async function generateSchedule(db: ScheduleDb, options: ScheduleGenerationOptions = {}): Promise<ScheduleGenerationResult> {
  const today = todayJst(options.now);
  const defaultYear = Number(today.slice(0, 4));
  const from = options.from ?? `${defaultYear - 1}-01-01`;
  const to = options.to ?? `${defaultYear + 2}-12-31`;
  const errors: string[] = [];
  const fromYm = ymFromDate(from);
  const toYm = ymFromDate(to);
  if (!isIsoDate(from) || !isIsoDate(to) || !fromYm || !toYm || from > to) {
    return {
      ok: false,
      generated: 0,
      inserted: 0,
      updated: 0,
      superseded: 0,
      needsSource: 0,
      sourceCounts: {},
      errors: ["invalid schedule range: from/to must be ordered ISO dates with YYYYMM values"],
      from,
      to,
    };
  }
  const [factsResult, obligationsResult, contractsResult, projectsResult, projectMembersResult, reportsResult, actionsResult, membersResult, shareholderMeetingsResult] = await Promise.all([
    db.from("company_operating_facts").select("*").is("superseded_at", null).limit(1000),
    db.from("company_payment_obligations").select("*").in("status", GENERATED_STATUSES).in("category", ["tax", "social_insurance"]).limit(10000),
    db.from("contracts").select("*").eq("relationship_scope", "amd_contract").eq("registry_status", "accepted").limit(1000),
    db.from("projects").select("*").limit(5000),
    db.from("project_members").select("*").limit(10000),
    db.from("monthly_reports").select("*").gte("ym", fromYm).lte("ym", toYm).limit(20000),
    db.from("action_items").select("*").eq("review_status", "confirmed").in("status", ACTIVE_ACTION_STATUSES).not("due_at", "is", null).limit(10000),
    db.from("members").select("*").eq("status", "active").limit(1000),
    db.from("project_shareholder_meetings").select("*").eq("project_id", "p00").in("meeting_type", CANONICAL_SHAREHOLDER_MEETING_TYPES).limit(200),
  ]);
  const results = [
    ["company_operating_facts", factsResult],
    ["company_payment_obligations", obligationsResult],
    ["contracts", contractsResult],
    ["projects", projectsResult],
    ["project_members", projectMembersResult],
    ["monthly_reports", reportsResult],
    ["action_items", actionsResult],
    ["members", membersResult],
    ["project_shareholder_meetings", shareholderMeetingsResult],
  ] as const;
  for (const [table, result] of results) if (result.error) errors.push(`${table}: ${result.error.message}`);
  if (errors.length) {
    return { ok: false, generated: 0, inserted: 0, updated: 0, superseded: 0, needsSource: 0, sourceCounts: {}, errors, from, to };
  }
  const facts = currentFacts((factsResult.data ?? []) as RawRow[]);
  const obligations = (obligationsResult.data ?? []) as RawRow[];
  const contracts = (contractsResult.data ?? []) as RawRow[];
  const projects = (projectsResult.data ?? []) as RawRow[];
  const projectMembers = (projectMembersResult.data ?? []) as RawRow[];
  const monthlyReports = (reportsResult.data ?? []) as RawRow[];
  const actionItems = (actionsResult.data ?? []) as RawRow[];
  const members = (membersResult.data ?? []) as RawRow[];
  const shareholderMeetings = (shareholderMeetingsResult.data ?? []) as RawRow[];
  const ownerMemberId = kiyoId(members);
  const paymentObligationRows = generatePaymentObligations(obligations);
  const corporateTaxRows = generateCorporateTax(facts, obligations, ownerMemberId, from, to);
  const corporateTaxInterimRows = generateCorporateTaxInterim(facts, ownerMemberId, from, to);
  const withholdingRows = generateWithholding(facts, obligations, ownerMemberId, from, to);
  const socialInsuranceRows = generateSocialInsurance(facts, obligations, ownerMemberId, from, to);
  const laborInsuranceRows = generateLaborInsurance(facts, obligations, ownerMemberId, from, to);
  const generated = dedupeOccurrences([
    ...paymentObligationRows,
    ...addInternalPrepMilestones(paymentObligationRows, from, to),
    ...corporateTaxRows,
    ...corporateTaxInterimRows,
    ...withholdingRows,
    ...socialInsuranceRows,
    ...laborInsuranceRows,
    ...addInternalPrepMilestones([...corporateTaxRows, ...corporateTaxInterimRows], from, to),
    ...addInternalPrepMilestones(withholdingRows, from, to),
    ...addInternalPrepMilestones(socialInsuranceRows, from, to),
    ...addInternalPrepMilestones(laborInsuranceRows, from, to),
    ...generateYearEndAdjustment(facts, ownerMemberId, from, to),
    ...generateShareholderMeeting(facts, shareholderMeetings, ownerMemberId, from, to),
    ...generateContracts(contracts, projects, projectMembers, members, from, to),
    ...generateReports(contracts, projects, projectMembers, members, monthlyReports, from, to),
    ...generateActionItems(actionItems, obligations, projects, from, to),
  ]);
  const persistence = await persistGeneratedOccurrences(db, generated, from, to);
  const ruleCheckErrors = await persistRuleChecks(db);
  const sourceCounts = generated.reduce<Record<string, number>>((counts, row) => {
    counts[row.source_kind] = (counts[row.source_kind] ?? 0) + 1;
    return counts;
  }, {});
  return {
    ok: errors.length === 0 && persistence.errors.length === 0 && ruleCheckErrors.length === 0,
    generated: generated.length,
    inserted: persistence.inserted,
    updated: persistence.updated,
    superseded: persistence.superseded,
    needsSource: generated.filter((row) => row.lifecycle_status === "needs_source").length,
    sourceCounts,
    errors: [...errors, ...persistence.errors, ...ruleCheckErrors],
    from,
    to,
  };
}
