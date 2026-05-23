import { adjustToPreviousBusinessDay } from "@/lib/japanese-holidays";

export type PaymentDueRule =
  | "current_month_eom"
  | "current_month_25"
  | "next_month_eom"
  | "next_month_25"
  | "second_month_eom"
  | "second_month_25"
  | "issue_month_eom"
  | "issue_month_25"
  | "issue_month_25th"
  | "next_month_15";

export const DEFAULT_PAYMENT_DUE_RULE = "next_month_eom";

export const PAYMENT_DUE_RULE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "current_month_eom", label: "当月末" },
  { value: "current_month_25", label: "当月25日" },
  { value: "next_month_eom", label: "翌月末" },
  { value: "next_month_25", label: "翌月25日" },
  { value: "second_month_eom", label: "翌々月末" },
  { value: "second_month_25", label: "翌々月25日" },
];

function addMonthsYm(ym: string, delta: number): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(ym: string): number {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoForYmDay(ym: string, day: number): string {
  const safeDay = Math.max(1, Math.min(day, lastDayOfMonth(ym)));
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(safeDay).padStart(2, "0")}`;
}

export function normalizePaymentDueRule(rule: string | null | undefined): PaymentDueRule | null {
  const value = (rule ?? "").trim();
  if (!value) return null;
  if (
    value === "current_month_eom" ||
    value === "current_month_25" ||
    value === "issue_month_eom" ||
    value === "issue_month_25" ||
    value === "issue_month_25th" ||
    value === "next_month_eom" ||
    value === "next_month_25" ||
    value === "second_month_eom" ||
    value === "second_month_25" ||
    value === "next_month_15"
  ) {
    return value;
  }
  return null;
}

export function paymentDueRuleLabel(rule: string | null | undefined, legacyDueDay?: number | null): string {
  const normalized = normalizePaymentDueRule(rule);
  if (normalized === "current_month_eom") return "当月末";
  if (normalized === "current_month_25") return "当月25日";
  if (normalized === "issue_month_eom") return "翌月末";
  if (normalized === "issue_month_25" || normalized === "issue_month_25th") return "翌月25日";
  if (normalized === "next_month_eom") return "翌月末";
  if (normalized === "next_month_25" || normalized === "next_month_15") return "翌月25日";
  if (normalized === "second_month_eom") return "翌々月末";
  if (normalized === "second_month_25") return "翌々月25日";
  if (legacyDueDay && legacyDueDay > 0) return `翌月${legacyDueDay}日`;
  return "翌月末";
}

export function computePaymentDueDateByRule(
  bizYm: string,
  rule: string | null | undefined,
  legacyDueDay?: number | null
): string {
  if (!/^\d{6}$/.test(bizYm)) return new Date().toISOString().slice(0, 10);

  const normalized = normalizePaymentDueRule(rule);
  let paymentYm = addMonthsYm(bizYm, 1);
  let day = lastDayOfMonth(paymentYm);

  if (normalized === "current_month_eom") {
    paymentYm = bizYm;
    day = lastDayOfMonth(paymentYm);
  } else if (normalized === "current_month_25") {
    paymentYm = bizYm;
    day = 25;
  } else if (normalized === "next_month_eom" || normalized === "issue_month_eom") {
    paymentYm = addMonthsYm(bizYm, 1);
    day = lastDayOfMonth(paymentYm);
  } else if (
    normalized === "next_month_25" ||
    normalized === "next_month_15" ||
    normalized === "issue_month_25" ||
    normalized === "issue_month_25th"
  ) {
    paymentYm = addMonthsYm(bizYm, 1);
    day = 25;
  } else if (normalized === "second_month_eom") {
    paymentYm = addMonthsYm(bizYm, 2);
    day = lastDayOfMonth(paymentYm);
  } else if (normalized === "second_month_25") {
    paymentYm = addMonthsYm(bizYm, 2);
    day = 25;
  } else if (legacyDueDay && legacyDueDay > 0) {
    paymentYm = addMonthsYm(bizYm, 1);
    day = legacyDueDay;
  }

  return adjustToPreviousBusinessDay(isoForYmDay(paymentYm, day));
}

export function computePaymentYmByRule(
  bizYm: string,
  rule: string | null | undefined,
  legacyDueDay?: number | null
): string {
  return computePaymentDueDateByRule(bizYm, rule, legacyDueDay).slice(0, 7).replace("-", "");
}
