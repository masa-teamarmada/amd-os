/**
 * 納付ページの読み取りモデル。
 *
 * 管理カレンダーは契約・報告・月次提出も同じ時間軸に並べるため、納付が埋もれる。
 * この層は税務署・都道府県・市町村・年金機構・労働局へ「いつ・いくら納めるか」だけを
 * 期限順に並べ、freeeの口座明細で見つかった出金を各行に添える。
 *
 * 金額・期日・納付済みの正本は `company_payment_obligations` のままで、ここでは作らない。
 */

import { isEligibleTaxSocialObligation } from "../admin-schedule/predicates.ts";
import type { CompanyPaymentObligation } from "./payment-obligations.ts";

export type PaymentLedgerState = "paid" | "overdue" | "due_today" | "due_soon" | "upcoming" | "needs_review";

export type PaymentSettlementCandidate = {
  date: string;
  amountYen: number;
  description: string | null;
  freeeStatus: number | null;
};

export type PaymentSettlement = {
  kind: string;
  from: string;
  to: string;
  matched: boolean;
  candidateCount: number;
  exactAmountCandidateCount: number;
  candidates: PaymentSettlementCandidate[];
};

export type PaymentPenaltyEstimate = {
  delinquencyYen: number | null;
  underpaymentPenaltyYen: number | null;
  totalYen: number | null;
  overdueDays: number | null;
  delinquencyKind: string | null;
};

export type PaymentLedgerRow = {
  id: string;
  sourceKey: string;
  title: string;
  counterparty: string | null;
  category: "tax" | "social_insurance";
  amountYen: number | null;
  amountStatus: "exact" | "estimated" | "unknown";
  dueDate: string | null;
  dueDatePrecision: string;
  expectedPaymentYm: string | null;
  state: PaymentLedgerState;
  overdueDays: number | null;
  paidAt: string | null;
  paidAmountYen: number | null;
  sourceRef: string | null;
  sourceKind: string;
  isPenalty: boolean;
  penaltyForSourceKey: string | null;
  settlement: PaymentSettlement | null;
  penaltyEstimate: PaymentPenaltyEstimate | null;
  /** この納付の遅れから生まれ、実際に通知書が届いた加算税・延滞税 */
  penaltyNotices: Array<{ title: string; amountYen: number | null; dueDate: string | null }>;
};

export type PaymentLedgerSummary = {
  overdueCount: number;
  overdueYen: number;
  upcomingCount: number;
  upcomingYen: number;
  paidCount: number;
  paidYen: number;
  unknownAmountCount: number;
  penaltyEstimateYen: number;
  penaltyNoticeYen: number;
  /** メール由来で人の確認が付いていないため、納付として数えなかった候補の件数 */
  unreviewedMailCandidateCount: number;
};

const PENALTY_TITLE_WORDS = ["加算税", "延滞税", "延滞金", "督促", "滞納処分"];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function parseSettlement(value: unknown): PaymentSettlement | null {
  const raw = record(value);
  const kind = textOrNull(raw.kind);
  const from = textOrNull(raw.from);
  const to = textOrNull(raw.to);
  if (!kind || !from || !to) return null;
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  return {
    kind,
    from,
    to,
    matched: raw.matched === true,
    candidateCount: numberOrNull(raw.candidateCount) ?? candidates.length,
    exactAmountCandidateCount: numberOrNull(raw.exactAmountCandidateCount) ?? 0,
    candidates: candidates.map((entry) => {
      const row = record(entry);
      return {
        date: textOrNull(row.date) ?? "",
        amountYen: numberOrNull(row.amountYen) ?? 0,
        description: textOrNull(row.description),
        freeeStatus: numberOrNull(row.freeeStatus),
      };
    }).filter((row) => row.date),
  };
}

function parsePenaltyEstimate(value: unknown): PaymentPenaltyEstimate | null {
  const raw = record(value);
  if (Object.keys(raw).length === 0) return null;
  return {
    delinquencyYen: numberOrNull(raw.delinquencyYen),
    underpaymentPenaltyYen: numberOrNull(raw.underpaymentPenaltyYen),
    totalYen: numberOrNull(raw.totalYen),
    overdueDays: numberOrNull(raw.overdueDays),
    delinquencyKind: textOrNull(raw.delinquencyKind),
  };
}

export function isPenaltyObligationTitle(title: string): boolean {
  return PENALTY_TITLE_WORDS.some((word) => title.includes(word));
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function stateFor(obligation: CompanyPaymentObligation, today: string): { state: PaymentLedgerState; overdueDays: number | null } {
  if (obligation.status === "paid") return { state: "paid", overdueDays: null };
  const dueDate = obligation.due_date_precision === "day" ? obligation.due_date : null;
  if (!dueDate) return { state: "needs_review", overdueDays: null };
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { state: "overdue", overdueDays: -diff };
  if (obligation.status === "needs_review" || obligation.amount_status === "unknown") {
    return { state: "needs_review", overdueDays: null };
  }
  if (diff === 0) return { state: "due_today", overdueDays: null };
  if (diff <= 14) return { state: "due_soon", overdueDays: null };
  return { state: "upcoming", overdueDays: null };
}

/** 期限が無い行を最後に置きつつ、期限のある行は日付の昇順で並べる。 */
function sortKey(row: PaymentLedgerRow): string {
  if (row.dueDate) return `1:${row.dueDate}`;
  if (row.expectedPaymentYm) return `2:${row.expectedPaymentYm}`;
  return "3:";
}

/**
 * 支払義務台帳から、公的機関への納付だけを取り出して期限順に並べる。
 * 加算税・延滞税は、元になった納付の行へ紐づけたうえで独立した行としても残す。
 * 納期限が通知書で決まるため、金額と期日はその行が正本になる。
 */
export function buildPaymentLedger(
  obligations: readonly CompanyPaymentObligation[],
  today: string
): { rows: PaymentLedgerRow[]; summary: PaymentLedgerSummary } {
  const inScope = obligations.filter(
    (row) => (row.category === "tax" || row.category === "social_insurance") && row.status !== "cancelled"
  );
  // メール由来の候補は、人が確認した行だけを納付として扱う。件名の分類語だけで
  // 納税予定へ昇格させると、展示会の案内や宛名確認のお知らせが納付額に混ざる。
  const statutory = inScope.filter((row) => isEligibleTaxSocialObligation(row as unknown as Record<string, unknown>));
  const unreviewedMailCandidateCount = inScope.length - statutory.length;
  const noticesByParent = new Map<string, Array<{ title: string; amountYen: number | null; dueDate: string | null }>>();
  for (const row of statutory) {
    const parent = textOrNull(record(row.payload).penaltyForSourceKey);
    if (!parent) continue;
    const list = noticesByParent.get(parent) ?? [];
    list.push({ title: row.title, amountYen: row.amount_yen, dueDate: row.due_date });
    noticesByParent.set(parent, list);
  }

  const rows: PaymentLedgerRow[] = statutory.map((row) => {
    const payload = record(row.payload);
    const { state, overdueDays } = stateFor(row, today);
    return {
      id: row.id,
      sourceKey: row.source_key,
      title: row.title,
      counterparty: row.counterparty,
      category: row.category === "social_insurance" ? "social_insurance" : "tax",
      amountYen: row.amount_yen,
      amountStatus: row.amount_status,
      dueDate: row.due_date,
      dueDatePrecision: row.due_date_precision,
      expectedPaymentYm: row.expected_payment_ym,
      state,
      overdueDays,
      paidAt: row.paid_at,
      paidAmountYen: row.paid_amount_yen,
      sourceRef: row.source_ref,
      sourceKind: row.source_kind,
      isPenalty: isPenaltyObligationTitle(row.title),
      penaltyForSourceKey: textOrNull(payload.penaltyForSourceKey),
      settlement: parseSettlement(payload.settlementSearch),
      penaltyEstimate: parsePenaltyEstimate(payload.penaltyEstimate),
      penaltyNotices: noticesByParent.get(row.source_key) ?? [],
    };
  });
  rows.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title));

  const overdue = rows.filter((row) => row.state === "overdue" || row.state === "needs_review");
  const upcoming = rows.filter((row) => row.state === "due_today" || row.state === "due_soon" || row.state === "upcoming");
  const paid = rows.filter((row) => row.state === "paid");
  return {
    rows,
    summary: {
      overdueCount: overdue.length,
      overdueYen: overdue.reduce((sum, row) => sum + (row.amountYen ?? 0), 0),
      upcomingCount: upcoming.length,
      upcomingYen: upcoming.reduce((sum, row) => sum + (row.amountYen ?? 0), 0),
      paidCount: paid.length,
      paidYen: paid.reduce((sum, row) => sum + (row.paidAmountYen ?? row.amountYen ?? 0), 0),
      unknownAmountCount: rows.filter((row) => row.amountStatus === "unknown").length,
      penaltyEstimateYen: overdue.reduce((sum, row) => sum + (row.penaltyEstimate?.totalYen ?? 0), 0),
      penaltyNoticeYen: rows
        .filter((row) => row.isPenalty && row.state !== "paid")
        .reduce((sum, row) => sum + (row.amountYen ?? 0), 0),
      unreviewedMailCandidateCount,
    },
  };
}

/** freee公式の処理状態を日本語にする。納めたのに口座で消込が済んでいない状態を見分ける。 */
export function freeeStatusLabel(status: number | null): string | null {
  if (status == null) return null;
  if (status === 1) return "freeeで消込待ち";
  if (status === 2) return "freeeで消込済み";
  if (status === 3) return "freeeで無視";
  if (status === 4) return "freeeで消込中";
  if (status === 6) return "freeeで対象外";
  return null;
}

// ── 月 × 種類の集計 ────────────────────────────────────────
// 期限順の一覧は同じ名前が何十行も続き、どの税がいつ・いくら残っているかを掴めない。
// 行を年月、列を税・保険料の種類にして、支払済みと未納を色で分け、種類ごとの
// 今期合計を最後に置く。

export type PaymentKindKey =
  | "withholding"
  | "social_insurance"
  | "labor_insurance"
  | "consumption_tax"
  | "corporate_tax"
  | "resident_tax"
  | "penalty"
  | "other";

export const PAYMENT_KINDS: Array<{ key: PaymentKindKey; label: string; payee: string }> = [
  { key: "withholding", label: "源泉所得税", payee: "税務署" },
  { key: "social_insurance", label: "社会保険料", payee: "日本年金機構" },
  { key: "labor_insurance", label: "労働保険料", payee: "労働局" },
  { key: "consumption_tax", label: "消費税", payee: "税務署" },
  { key: "corporate_tax", label: "法人税等", payee: "税務署・県・市" },
  { key: "resident_tax", label: "住民税", payee: "市区町村" },
  { key: "penalty", label: "加算税・延滞税", payee: "税務署・年金機構" },
  { key: "other", label: "その他", payee: "—" },
];

/** 納付の種類。法定ルールの source_key を先に見て、手で登録した納付書は名前で拾う。 */
export function paymentKindOf(row: Pick<PaymentLedgerRow, "sourceKey" | "title" | "isPenalty">): PaymentKindKey {
  if (row.isPenalty) return "penalty";
  const key = row.sourceKey;
  if (key.includes("withholding-income-tax")) return "withholding";
  if (key.includes("social-insurance")) return "social_insurance";
  if (key.includes("labor-insurance")) return "labor_insurance";
  if (key.includes("consumption-tax")) return "consumption_tax";
  if (key.includes("corporate-tax")) return "corporate_tax";
  if (key.includes("resident-tax")) return "resident_tax";
  const title = row.title;
  if (title.includes("源泉所得税") || title.includes("源泉徴収")) return "withholding";
  if (title.includes("社会保険") || title.includes("厚生年金") || title.includes("健康保険")) return "social_insurance";
  if (title.includes("労働保険") || title.includes("雇用保険") || title.includes("労災")) return "labor_insurance";
  if (title.includes("消費税")) return "consumption_tax";
  if (title.includes("法人税") || title.includes("県民税") || title.includes("市民税") || title.includes("事業税")) return "corporate_tax";
  if (title.includes("住民税")) return "resident_tax";
  return "other";
}

export type PaymentMatrixCellState = "none" | "paid" | "overdue" | "review" | "scheduled";

export type PaymentMatrixCell = {
  state: PaymentMatrixCellState;
  totalYen: number;
  paidYen: number;
  unpaidYen: number;
  unknownAmountCount: number;
  count: number;
  paidCount: number;
  overdueCount: number;
  reviewCount: number;
  /** セルに入った納付の内訳。同じ月に2件以上入るとき何が入っているかを示す */
  entries: Array<{ title: string; amountYen: number | null; state: PaymentLedgerState; dueDate: string | null }>;
};

export type PaymentMatrixTotals = {
  totalYen: number;
  paidYen: number;
  unpaidYen: number;
  unknownAmountCount: number;
  count: number;
};

export type PaymentMatrix = {
  startYm: string;
  endYm: string;
  months: Array<{ ym: string; cells: Record<PaymentKindKey, PaymentMatrixCell>; totals: PaymentMatrixTotals }>;
  kindTotals: Record<PaymentKindKey, PaymentMatrixTotals>;
  totals: PaymentMatrixTotals;
  /** 今期の外に期日がある、または期日も対象月も取れていない行の件数 */
  outsideCount: number;
};

/** 決算月から今期の期首・期末を出す。12月決算なら1月から12月。 */
export function fiscalWindowFor(today: string, fiscalYearEndMonth: number): { startYm: string; endYm: string } {
  const month = Number(today.slice(5, 7));
  const year = Number(today.slice(0, 4));
  const endYear = month <= fiscalYearEndMonth ? year : year + 1;
  const startMonth = (fiscalYearEndMonth % 12) + 1;
  const startYear = fiscalYearEndMonth === 12 ? endYear : endYear - 1;
  return {
    startYm: `${startYear}${String(startMonth).padStart(2, "0")}`,
    endYm: `${endYear}${String(fiscalYearEndMonth).padStart(2, "0")}`,
  };
}

function emptyTotals(): PaymentMatrixTotals {
  return { totalYen: 0, paidYen: 0, unpaidYen: 0, unknownAmountCount: 0, count: 0 };
}

function emptyCell(): PaymentMatrixCell {
  return { state: "none", totalYen: 0, paidYen: 0, unpaidYen: 0, unknownAmountCount: 0, count: 0, paidCount: 0, overdueCount: 0, reviewCount: 0, entries: [] };
}

function addToTotals(totals: PaymentMatrixTotals, row: PaymentLedgerRow): void {
  const amount = row.amountYen ?? 0;
  totals.count += 1;
  totals.totalYen += amount;
  if (row.state === "paid") totals.paidYen += row.paidAmountYen ?? amount;
  else totals.unpaidYen += amount;
  if (row.amountStatus === "unknown") totals.unknownAmountCount += 1;
}

function ymOf(row: PaymentLedgerRow): string | null {
  if (row.dueDate) return row.dueDate.slice(0, 7).replace("-", "");
  return row.expectedPaymentYm;
}

export function buildPaymentMatrix(
  rows: readonly PaymentLedgerRow[],
  today: string,
  fiscalYearEndMonth: number,
  window?: { startYm: string; endYm: string }
): PaymentMatrix {
  const { startYm, endYm } = window ?? fiscalWindowFor(today, fiscalYearEndMonth);
  const months: PaymentMatrix["months"] = [];
  for (let ym = startYm; ym <= endYm; ) {
    const cells = Object.fromEntries(PAYMENT_KINDS.map((kind) => [kind.key, emptyCell()])) as Record<PaymentKindKey, PaymentMatrixCell>;
    months.push({ ym, cells, totals: emptyTotals() });
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(4, 6));
    const next = new Date(Date.UTC(year, month, 1));
    ym = `${next.getUTCFullYear()}${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const monthByYm = new Map(months.map((row) => [row.ym, row]));
  const kindTotals = Object.fromEntries(PAYMENT_KINDS.map((kind) => [kind.key, emptyTotals()])) as Record<PaymentKindKey, PaymentMatrixTotals>;
  const totals = emptyTotals();
  let outsideCount = 0;

  for (const row of rows) {
    const ym = ymOf(row);
    const month = ym ? monthByYm.get(ym) : undefined;
    if (!month) {
      outsideCount += 1;
      continue;
    }
    const kind = paymentKindOf(row);
    const cell = month.cells[kind];
    const amount = row.amountYen ?? 0;
    cell.count += 1;
    cell.totalYen += amount;
    if (row.state === "paid") cell.paidYen += row.paidAmountYen ?? amount;
    else cell.unpaidYen += amount;
    if (row.amountStatus === "unknown") cell.unknownAmountCount += 1;
    if (row.state === "paid") cell.paidCount += 1;
    if (row.state === "overdue") cell.overdueCount += 1;
    if (row.state === "needs_review") cell.reviewCount += 1;
    cell.entries.push({ title: row.title, amountYen: row.amountYen, state: row.state, dueDate: row.dueDate });
    addToTotals(month.totals, row);
    addToTotals(kindTotals[kind], row);
    addToTotals(totals, row);
  }
  // 期限を過ぎているものを最優先で見せる。期限前でも金額や期日が未確認なら要確認として分ける。
  // 全件が納付済みのときだけ済とする。
  for (const month of months) {
    for (const kind of PAYMENT_KINDS) {
      const cell = month.cells[kind.key];
      if (cell.count === 0) cell.state = "none";
      else if (cell.overdueCount > 0) cell.state = "overdue";
      else if (cell.reviewCount > 0) cell.state = "review";
      else if (cell.paidCount === cell.count) cell.state = "paid";
      else cell.state = "scheduled";
    }
  }
  return { startYm, endYm, months, kindTotals, totals, outsideCount };
}
