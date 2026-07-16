/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase schema varies across applied migrations; runtime rows stay narrow at adapter boundaries. */
import { createHash } from "node:crypto";
import { computePaymentDueDateByRule } from "@/lib/payment-rules";
import {
  addMonthsYm,
  adjustToNextBusinessDay,
  dateAtDay,
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
} from "@/lib/admin-schedule/date";
import { OFFICIAL_RULES, officialRule, ruleRefs } from "@/lib/admin-schedule/rules/official";
import type {
  AmountRole,
  AmountStatus,
  DatePrecision,
  GeneratedOccurrence,
  JsonRecord,
  LifecycleStatus,
  OperatingFact,
  ScheduleCategory,
} from "@/lib/admin-schedule/types";
import {
  isAcceptedAmdContract,
  isContractSigningExpected,
  isCurrentAmdContract,
  isScheduleActionItem,
} from "./predicates.ts";
export { isAcceptedAmdContract, isContractSigningExpected, isCurrentAmdContract, isScheduleActionItem } from "./predicates.ts";

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
    notification_owner: input.notificationOwner ?? "company_schedule",
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

function isRequired(value: unknown): boolean {
  if (value === true) return true;
  const textValue = String(value ?? "").trim().toLowerCase();
  if (!textValue || /なし|不要|false|no|対象外/.test(textValue)) return false;
  return /あり|必須|毎月|monthly|annual|年次|true|yes/.test(textValue);
}

function reportRule(terms: JsonRecord): { mode: "day" | "month"; day?: number; nextMonth?: boolean } | null {
  const raw = terms.monthlyReportSubmissionDeadline ?? terms.monthly_report_submission_deadline ?? terms.monthlyReportSubmissionTiming ?? terms.monthly_report_submission_timing;
  const rawText = String(raw ?? "").trim();
  if (!rawText) return null;
  if (/末|月末|翌月末|end/i.test(rawText)) return { mode: "month", nextMonth: /翌月|next_month/i.test(rawText) };
  const day = readDeadlineDay(rawText);
  return day ? { mode: "day", day, nextMonth: /翌月|next_month/i.test(rawText) } : null;
}

function projectTerms(project: RawRow, contract: RawRow | null): JsonRecord {
  const projectTerms = record(project.contract_terms_json);
  const contractTerms = record(contract?.operational_terms_json);
  return { ...project, ...projectTerms, ...contractTerms };
}

function invoiceAmount(cycle: RawRow): number | null {
  const raw = cycle.invoice_base_lines_json ?? cycle.invoice_lines_json ?? cycle.invoice_items_json;
  if (!Array.isArray(raw)) return null;
  const amounts = raw.map((line) => {
    const item = record(line);
    return numberValue(item.amount_yen ?? item.amount_tax_excl ?? item.amountTaxExcl ?? item.total_yen);
  }).filter((value): value is number => value != null);
  return amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null;
}

function contractAmount(contract: RawRow, terms: JsonRecord): number | null {
  return numberValue(contract.contract_value_yen)
    ?? numberValue(terms.amountTaxExclTotal)
    ?? numberValue(terms.monthlyFeeYen);
}

function resolveInvoiceDue(ym: string, rule: unknown): string | null {
  const raw = String(rule ?? "").trim();
  if (!raw) return null;
  if (/翌月末|next_month_eom/.test(raw)) return nextMonthEnd(ym);
  if (/月末|当月末|current_month_eom/.test(raw)) return adjustToNextBusinessDay(lastDayOfYm(ym));
  const day = readDeadlineDay(raw);
  if (day == null) return null;
  return /翌月|next_month/.test(raw) ? nextMonthDay(ym, day) : dateAtDay(ym, day);
}

function resolvePaymentDue(ym: string, rule: unknown, day: unknown): string | null {
  const normalizedRule = String(rule ?? "").trim();
  const dueDay = readDeadlineDay(day) ?? readDeadlineDay(rule);
  if (/next_month_eom|翌月末/.test(normalizedRule)) {
    return nextMonthEnd(ym);
  }
  if (/月末|当月末|current_month_eom/.test(normalizedRule)) {
    return computePaymentDueDateByRule(ym, "current_month_eom");
  }
  if (dueDay != null) return computePaymentDueDateByRule(ym, null, dueDay);
  return null;
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

function generatePaymentObligations(obligations: RawRow[]): GeneratedOccurrence[] {
  return obligations.map((row) => {
    const dueOn = text(row.due_date);
    const dueYm = text(row.expected_payment_ym) || ymFromDate(dueOn);
    const precision = row.due_date_precision === "month" || (!dueOn && dueYm) ? "month" : dueOn ? "day" : "unknown";
    const amountYen = numberValue(row.amount_yen);
    const amountStatus: AmountStatus = row.amount_status === "estimated" ? "estimated" : amountYen == null ? "unknown" : "exact";
    return occurrence({
      key: `company:payment:${row.id}`,
      source: "company_payment_obligation",
      sourceId: row.id,
      sourceHash: sourceHash("company_payment_obligation", row),
      scope: "company",
      category: "payment",
      eventKind: "payment_due",
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
        cashflowTreatment: row.cashflow_treatment || null,
        autoDebit: row.auto_debit ?? null,
        paidAt: row.paid_at || null,
        paidAmountYen: row.paid_amount_yen ?? null,
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
    if (officialDeadline && findObligation(obligations, ["労働保険", "年度更新"], officialDeadline, ymFromDate(officialDeadline))) return [];
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

function deadlineForReportYm(reportYm: string, rule: { mode: "day" | "month"; day?: number; nextMonth?: boolean }): string | null {
  if (rule.mode === "month") {
    return rule.nextMonth ? nextMonthEnd(reportYm) : adjustToNextBusinessDay(lastDayOfYm(reportYm));
  }
  if (rule.day == null) return null;
  return rule.nextMonth ? nextMonthDay(reportYm, rule.day) : dateAtDay(reportYm, rule.day);
}

function reportCompletion(report: RawRow | null): boolean {
  if (!report) return false;
  if (report.fixed_at || report.completed_at || report.confirmed_at || report.published_at) return true;
  return /fixed|confirmed|complete|approved|published|確定|承認済/.test(normalized(report.status));
}

function generateContracts(
  contracts: RawRow[],
  projects: RawRow[],
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
    const ownerMemberId = ownerIdByName(contract.owner_member_id ?? contract.business_owner, members);
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
  const currentContracts = contracts.filter(isAcceptedAmdContract);
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
    const monthlyRule = reportRule(terms);
    const monthlyRequired = isRequired(terms.monthlyReportRequired ?? terms.monthly_report_required ?? terms.reportRequired ?? terms.report_required ?? terms.monthlyReportSubmissionRule ?? terms.monthly_report_submission_rule) || Boolean(monthlyRule);
    if (!monthlyRequired) continue;
    const ownerMemberId = projectOwnerId(projectId, project, contract, projectMembers, members);
    const ownerMissing = !ownerMemberId ? "報告提出担当者が正本に未設定" : null;
    for (const reportYm of targetMonths) {
      const report = reportByKey.get(`${projectId}:${reportYm}`) ?? null;
      const dueOn = monthlyRule ? deadlineForReportYm(reportYm, monthlyRule) : null;
      const missingReason = ownerMissing ?? (!monthlyRule ? "月次報告の提出期限ルールが正本に未設定" : null);
      const completed = reportCompletion(report);
      const dueYm = dueOn ? ymFromDate(dueOn) : reportYm;
      const occurrenceRow = occurrence({
        key: `project:report:monthly:${projectId}:${reportYm}`,
        source: "contract_terms",
        sourceId: String(contract.contract_id ?? contract.id),
        sourceHash: sourceHash("monthly_report", { project, contract, reportYm, rule: monthlyRule }),
        scope: "project",
        category: "report",
        eventKind: "monthly_report_submission",
        title: `${projectLabel(project, projectId)} / 月次報告提出（${reportYm.slice(0, 4)}年${Number(reportYm.slice(4, 6))}月分）`,
        periodKey: reportYm,
        dueOn,
        dueYm,
        datePrecision: monthlyRule ? (dueOn ? "day" : "period") : "period",
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
        lifecycleStatus: completed ? "completed" : missingReason ? "needs_source" : "open",
        missingReason,
        sourceObservedAt: text(report?.updated_at ?? contract.updated_at),
        metadata: { reportYm, contractId: contract.contract_id ?? contract.id, reportId: report?.report_id ?? report?.id ?? null },
      });
      rows.push(occurrenceRow);
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

function cycleDate(cycle: RawRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = dateOnly(cycle[key]);
    if (value) return value;
  }
  return null;
}

function generateBilling(
  billingCycles: RawRow[],
  projects: RawRow[],
  from: string,
  to: string,
): GeneratedOccurrence[] {
  const rows: GeneratedOccurrence[] = [];
  const projectById = new Map(projects.map((project) => [String(project.project_id), project]));
  for (const cycle of billingCycles) {
    const projectId = text(cycle.project_id);
    const project = projectById.get(String(projectId)) ?? null;
    const ym = String(cycle.ym ?? cycle.invoice_ym ?? "").replace("-", "");
    if (!projectId || !isYm(ym)) continue;
    const terms = projectTerms(project ?? {}, null);
    const invoiceRule = cycle.invoice_send_deadline_rule ?? cycle.invoice_due_rule ?? project?.invoice_send_deadline_rule ?? terms.invoiceSendDeadlineRule ?? terms.invoice_send_deadline_rule ?? terms.invoiceDueRule ?? terms.invoice_due_rule;
    const paymentRule = cycle.payment_due_rule ?? project?.payment_due_rule ?? terms.paymentDueRule ?? terms.payment_due_rule;
    const paymentDay = cycle.payment_due_day ?? project?.payment_due_day ?? terms.paymentDueDay ?? terms.payment_due_day;
    const amountYen = invoiceAmount(cycle);
    const amountStatus: AmountStatus = amountYen == null ? "unknown" : "exact";
    const projectName = projectLabel(project, projectId);
    const ownerMemberId = text(cycle.owner_member_id ?? project?.owner_member_id ?? project?.business_owner_member_id);
    const invoiceActual = cycleDate(cycle, "invoice_sent_at", "invoice_issued_at", "invoice_date");
    const invoiceDue = invoiceActual ?? resolveInvoiceDue(ym, invoiceRule);
    const invoiceMissing = !invoiceDue ? "請求書の発行期限ルールが正本に未設定" : (!ownerMemberId ? "請求担当者が正本に未設定" : null);
    rows.push(occurrence({
      key: `project:billing:invoice:${projectId}:${ym}`,
      source: "billing_cycles",
      sourceId: String(cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? `${projectId}:${ym}`),
      sourceHash: sourceHash("billing_invoice", { cycle, project, invoiceRule }),
      scope: "project",
      category: "invoice",
      eventKind: "invoice_sent",
      title: `${projectName} / 請求書発行`,
      periodKey: ym,
      dueOn: invoiceDue,
      dueYm: invoiceDue ? ymFromDate(invoiceDue) : ym,
      datePrecision: invoiceDue ? "day" : "month",
      dateKind: invoiceActual ? "実績日" : "請求ルール期限",
      ...amountFields(amountYen, amountStatus, "incoming"),
      projectId,
      ownerMemberId,
      sourceRefs: [{ kind: "billing_cycle", ref: cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? `${projectId}:${ym}` }],
      resolutionHref: "/admin/invoices",
      lifecycleStatus: invoiceActual ? "completed" : invoiceMissing ? "needs_source" : "open",
      missingReason: invoiceMissing,
      sourceObservedAt: text(cycle.updated_at),
      metadata: { billingCycleId: cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? null, ym, invoiceRule: invoiceRule ?? null },
    }));

    const paymentActual = cycleDate(cycle, "payment_confirmed_at", "payment_received_at", "paid_at");
    const paymentDue = paymentActual ?? cycleDate(cycle, "payment_due_at", "payment_due_date") ?? resolvePaymentDue(ym, paymentRule, paymentDay);
    const paymentMissing = !paymentDue ? "入金予定日ルールが正本に未設定" : (!ownerMemberId ? "入金担当者が正本に未設定" : null);
    rows.push(occurrence({
      key: `project:billing:payment-due:${projectId}:${ym}`,
      source: "billing_cycles",
      sourceId: String(cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? `${projectId}:${ym}`),
      sourceHash: sourceHash("billing_payment_due", { cycle, project, paymentRule, paymentDay }),
      scope: "project",
      category: "receipt",
      eventKind: "payment_received",
      title: `${projectName} / 入金確認`,
      periodKey: ym,
      dueOn: paymentDue,
      dueYm: paymentDue ? ymFromDate(paymentDue) : ym,
      datePrecision: paymentDue ? "day" : "month",
      dateKind: paymentActual ? "実績日" : "入金予定期限",
      ...amountFields(amountYen, amountStatus, "incoming"),
      projectId,
      ownerMemberId,
      sourceRefs: [{ kind: "billing_cycle", ref: cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? `${projectId}:${ym}` }],
      resolutionHref: "/admin/invoices",
      lifecycleStatus: paymentActual ? "completed" : paymentMissing ? "needs_source" : "open",
      missingReason: paymentMissing,
      sourceObservedAt: text(cycle.updated_at),
      metadata: { billingCycleId: cycle.billing_cycle_id ?? cycle.cycle_id ?? cycle.id ?? null, ym, paymentRule: paymentRule ?? null, paymentDay: paymentDay ?? null },
    }));
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
  const from = options.from ?? `${defaultYear}-01-01`;
  const to = options.to ?? `${defaultYear + 1}-12-31`;
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
  const [factsResult, obligationsResult, contractsResult, projectsResult, projectMembersResult, reportsResult, billingResult, actionsResult, membersResult] = await Promise.all([
    db.from("company_operating_facts").select("*").is("superseded_at", null).limit(1000),
    db.from("company_payment_obligations").select("*").in("status", GENERATED_STATUSES).limit(10000),
    db.from("contracts").select("*").limit(5000),
    db.from("projects").select("*").limit(5000),
    db.from("project_members").select("*").limit(10000),
    db.from("monthly_reports").select("*").gte("ym", fromYm).lte("ym", toYm).limit(20000),
    db.from("billing_cycles").select("*").gte("ym", fromYm).lte("ym", toYm).limit(20000),
    db.from("action_items").select("*").eq("review_status", "confirmed").in("status", ACTIVE_ACTION_STATUSES).not("due_at", "is", null).limit(10000),
    db.from("members").select("*").eq("status", "active").limit(1000),
  ]);
  const results = [
    ["company_operating_facts", factsResult],
    ["company_payment_obligations", obligationsResult],
    ["contracts", contractsResult],
    ["projects", projectsResult],
    ["project_members", projectMembersResult],
    ["monthly_reports", reportsResult],
    ["billing_cycles", billingResult],
    ["action_items", actionsResult],
    ["members", membersResult],
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
  const billingCycles = (billingResult.data ?? []) as RawRow[];
  const actionItems = (actionsResult.data ?? []) as RawRow[];
  const members = (membersResult.data ?? []) as RawRow[];
  const ownerMemberId = kiyoId(members);
  const generated = dedupeOccurrences([
    ...generatePaymentObligations(obligations),
    ...generateCorporateTax(facts, obligations, ownerMemberId, from, to),
    ...generateCorporateTaxInterim(facts, ownerMemberId, from, to),
    ...generateWithholding(facts, obligations, ownerMemberId, from, to),
    ...generateSocialInsurance(facts, obligations, ownerMemberId, from, to),
    ...generateLaborInsurance(facts, obligations, ownerMemberId, from, to),
    ...generateYearEndAdjustment(facts, ownerMemberId, from, to),
    ...generateContracts(contracts, projects, members, from, to),
    ...generateReports(contracts, projects, projectMembers, members, monthlyReports, from, to),
    ...generateBilling(billingCycles, projects, from, to),
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
