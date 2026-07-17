import type { JsonRecord } from "./types";

export type SchedulePaymentLike = {
  occurrence_id?: string;
  title?: string | null;
  source_kind?: string | null;
  amount_role?: string | null;
  category?: string | null;
  computed_status?: string | null;
  lifecycle_status?: string | null;
  due_on?: string | null;
  due_ym?: string | null;
  period_key?: string | null;
  amount_yen?: number | null;
  amount_status?: string | null;
  metadata_json?: JsonRecord | null;
};

export type PaymentAmountStatus = "exact" | "estimated" | "unknown";

export type MonthlyPaymentSummary = {
  key: string;
  month: number;
  amountYen: number;
  exactAmountYen: number;
  estimatedAmountYen: number;
  unknownCount: number;
  itemCount: number;
};

export type AnnualPaymentSummary<T extends SchedulePaymentLike = SchedulePaymentLike> = {
  year: number;
  items: T[];
  totalAmountYen: number;
  exactAmountYen: number;
  estimatedAmountYen: number;
  unknownCount: number;
  monthly: MonthlyPaymentSummary[];
  peakMonth: MonthlyPaymentSummary | null;
};

export type PaymentTimingSummary<T extends SchedulePaymentLike = SchedulePaymentLike> = {
  all: AnnualPaymentSummary<T>;
  paid: AnnualPaymentSummary<T>;
  reconcile: AnnualPaymentSummary<T>;
  upcoming: AnnualPaymentSummary<T>;
  actionableAmountYen: number;
};

function normalizedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function monthKeyFromValue(value: unknown): string | null {
  const text = normalizedText(value);
  if (!text) return null;
  const compact = text.replace("-", "");
  return /^\d{6}$/.test(compact) ? compact : null;
}

export function paymentMonthKey(item: Pick<SchedulePaymentLike, "due_on" | "due_ym" | "period_key">): string | null {
  const dueOn = normalizedText(item.due_on);
  if (dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return dueOn.slice(0, 7).replace("-", "");
  return monthKeyFromValue(item.due_ym) ?? monthKeyFromValue(item.period_key);
}

export function isAnnualStatutoryPayment(item: Pick<SchedulePaymentLike, "source_kind" | "amount_role" | "category" | "computed_status">): boolean {
  return item.source_kind === "company_payment_obligation"
    && item.amount_role === "outgoing"
    && (item.category === "tax" || item.category === "labor")
    && item.computed_status !== "cancelled";
}

export function paymentAmountStatus(item: Pick<SchedulePaymentLike, "amount_yen" | "amount_status">): PaymentAmountStatus {
  if (item.amount_status === "estimated") return "estimated";
  if (item.amount_status === "exact" && item.amount_yen != null) return "exact";
  return item.amount_yen == null || item.amount_status === "unknown" || item.amount_status === "not_applicable" ? "unknown" : "exact";
}

export function paymentStatusLabel(item: Pick<SchedulePaymentLike, "amount_yen" | "amount_status">): string {
  const status = paymentAmountStatus(item);
  return status === "exact" ? "確定" : status === "estimated" ? "概算" : "未取得";
}

export function formatScheduleYen(amountYen: number | null | undefined): string {
  return amountYen == null ? "金額未取得" : `${Math.round(amountYen).toLocaleString("ja-JP")}円`;
}

export function counterpartyFor(item: Pick<SchedulePaymentLike, "metadata_json">): string {
  const metadata = item.metadata_json ?? {};
  return normalizedText(metadata.counterparty) ?? "支払先未確定";
}

export function obligationStatusFor(item: Pick<SchedulePaymentLike, "metadata_json">): string | null {
  return normalizedText(item.metadata_json?.obligationStatus);
}

function isClosed(item: SchedulePaymentLike): boolean {
  const status = item.computed_status ?? item.lifecycle_status;
  return status === "completed" || status === "cancelled";
}

function isCompleted(item: SchedulePaymentLike): boolean {
  const status = item.computed_status ?? item.lifecycle_status;
  return status === "completed";
}

export function annualPaymentSummary<T extends SchedulePaymentLike>(items: readonly T[], year: number): AnnualPaymentSummary<T> {
  const yearPrefix = String(year);
  const paymentItems = items.filter((item) => isAnnualStatutoryPayment(item) && paymentMonthKey(item)?.startsWith(yearPrefix));
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const key = `${yearPrefix}${String(index + 1).padStart(2, "0")}`;
    const monthItems = paymentItems.filter((item) => paymentMonthKey(item) === key);
    const exactAmountYen = monthItems.reduce((sum, item) => paymentAmountStatus(item) === "exact" ? sum + (item.amount_yen ?? 0) : sum, 0);
    const estimatedAmountYen = monthItems.reduce((sum, item) => paymentAmountStatus(item) === "estimated" ? sum + (item.amount_yen ?? 0) : sum, 0);
    return { key, month: index + 1, amountYen: exactAmountYen + estimatedAmountYen, exactAmountYen, estimatedAmountYen, unknownCount: monthItems.filter((item) => paymentAmountStatus(item) === "unknown").length, itemCount: monthItems.length };
  });
  const exactAmountYen = monthly.reduce((sum, month) => sum + month.exactAmountYen, 0);
  const estimatedAmountYen = monthly.reduce((sum, month) => sum + month.estimatedAmountYen, 0);
  return {
    year,
    items: paymentItems,
    totalAmountYen: exactAmountYen + estimatedAmountYen,
    exactAmountYen,
    estimatedAmountYen,
    unknownCount: monthly.reduce((sum, month) => sum + month.unknownCount, 0),
    monthly,
    peakMonth: monthly.reduce<MonthlyPaymentSummary | null>((peak, month) => month.amountYen > (peak?.amountYen ?? 0) ? month : peak, null),
  };
}

/**
 * 年間の法定納付を「過去に払った額」と「今から備える口座流出」に混ぜずに見るための区分。
 * 日付を過ぎた未完了・日付未確定で当月以前のものだけを要照合へ置き、未来分は予定として残す。
 */
export function paymentTimingSummary<T extends SchedulePaymentLike>(
  items: readonly T[],
  year: number,
  today: string
): PaymentTimingSummary<T> {
  const all = annualPaymentSummary(items, year);
  const currentYm = today.slice(0, 7).replace("-", "");
  const paidItems = all.items.filter((item) => isCompleted(item));
  const reconcileItems = all.items.filter((item) => {
    if (isClosed(item)) return false;
    if (item.due_on && /^\d{4}-\d{2}-\d{2}$/.test(item.due_on)) return item.due_on <= today;
    const ym = paymentMonthKey(item);
    // 日付も対象月も取れない未完了の法定納付は、将来の予定として
    // 見せると見落とすため、金額・期限の照合対象に残す。
    return !ym || ym <= currentYm;
  });
  const reconcileIds = new Set(reconcileItems.map((item) => item.occurrence_id ?? item));
  const upcomingItems = all.items.filter((item) => !isClosed(item) && !reconcileIds.has(item.occurrence_id ?? item));
  const paid = annualPaymentSummary(paidItems, year);
  const reconcile = annualPaymentSummary(reconcileItems, year);
  const upcoming = annualPaymentSummary(upcomingItems, year);
  return {
    all,
    paid,
    reconcile,
    upcoming,
    actionableAmountYen: reconcile.totalAmountYen + upcoming.totalAmountYen,
  };
}

export function nextPayment(items: readonly SchedulePaymentLike[], today: string): SchedulePaymentLike | null {
  return items
    .filter((item) => isAnnualStatutoryPayment(item) && !isClosed(item) && typeof item.due_on === "string" && item.due_on >= today)
    .sort((left, right) => String(left.due_on).localeCompare(String(right.due_on)))[0] ?? null;
}
