import {
  adjustToNextBusinessDay,
  dateAtDay,
  lastDayOfYm,
  nextMonthDay,
  nextMonthEnd,
} from "./date.ts";
import type { JsonRecord } from "./types.ts";

export type MonthlyReportRule = { mode: "day" | "month"; day?: number; nextMonth?: boolean };

export type MonthlyReportSchedulePlan =
  | { kind: "none"; rawRuleText: string | null; rule: null }
  | { kind: "expanded"; rawRuleText: string | null; rule: MonthlyReportRule }
  | { kind: "contract_gap"; rawRuleText: string | null; rule: null; missingReason: string };

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

function monthlyReportRequirementValue(terms: JsonRecord): unknown {
  return terms.monthlyReportRequired
    ?? terms.monthly_report_required
    ?? terms.reportRequired
    ?? terms.report_required
    ?? terms.monthlyReportSubmissionRule
    ?? terms.monthly_report_submission_rule;
}

function monthlyReportRuleText(terms: JsonRecord): string | null {
  return text(
    terms.monthlyReportSubmissionDeadline
    ?? terms.monthly_report_submission_deadline
    ?? terms.monthlyReportSubmissionTiming
    ?? terms.monthly_report_submission_timing
    ?? terms.monthlyReportSubmissionRule
    ?? terms.monthly_report_submission_rule,
  );
}

function unresolvedMonthlyReportReason(rawRuleText: string | null): string {
  if (!rawRuleText) return "契約上の月次報告義務はあるが、カレンダー日付ルールが正本に未設定";
  if (/請求書提出時|invoice/i.test(rawRuleText)) return "契約上の月次報告義務はあるが、提出期限が請求書提出時連動でカレンダー日付へ解決できない";
  if (/指定なし|未定|不明|要確認|要相談/.test(rawRuleText)) return "契約上の月次報告義務はあるが、カレンダー日付ルールが正本で未確定";
  return `契約上の月次報告義務はあるが、提出期限ルール「${rawRuleText}」をカレンダー日付へ解決できない`;
}

export function reportRule(terms: JsonRecord): MonthlyReportRule | null {
  const raw = terms.monthlyReportSubmissionDeadline ?? terms.monthly_report_submission_deadline ?? terms.monthlyReportSubmissionTiming ?? terms.monthly_report_submission_timing;
  const rawText = String(raw ?? "").trim();
  if (!rawText) return null;
  if (/末|月末|翌月末|end/i.test(rawText)) return { mode: "month", nextMonth: /翌月|next_month/i.test(rawText) };
  const day = readDeadlineDay(rawText);
  return day ? { mode: "day", day, nextMonth: /翌月|next_month/i.test(rawText) } : null;
}

export function deadlineForReportYm(reportYm: string, rule: MonthlyReportRule): string | null {
  if (rule.mode === "month") {
    return rule.nextMonth ? nextMonthEnd(reportYm) : adjustToNextBusinessDay(lastDayOfYm(reportYm));
  }
  if (rule.day == null) return null;
  return rule.nextMonth ? nextMonthDay(reportYm, rule.day) : dateAtDay(reportYm, rule.day);
}

export function planMonthlyReportSchedule(terms: JsonRecord, sampleYm = "202601"): MonthlyReportSchedulePlan {
  const rule = reportRule(terms);
  const rawRuleText = monthlyReportRuleText(terms);
  const required = isRequired(monthlyReportRequirementValue(terms)) || Boolean(rule);
  if (!required) return { kind: "none", rawRuleText, rule: null };
  if (rule && deadlineForReportYm(sampleYm, rule)) return { kind: "expanded", rawRuleText, rule };
  return {
    kind: "contract_gap",
    rawRuleText,
    rule: null,
    missingReason: unresolvedMonthlyReportReason(rawRuleText),
  };
}
