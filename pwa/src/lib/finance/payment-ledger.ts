/**
 * 納付ページの読み取りモデル。
 *
 * 管理カレンダーは契約・報告・月次提出も同じ時間軸に並べるため、納付が埋もれる。
 * この層は税務署・都道府県・市町村・年金機構・労働局へ「いつ・いくら納めるか」だけを
 * 期限順に並べ、freeeの口座明細で見つかった出金を各行に添える。
 *
 * 金額・期日・納付済みの正本は `company_payment_obligations` のままで、ここでは作らない。
 */

import type { CompanyPaymentObligation } from "./payment-obligations";

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
  const statutory = obligations.filter(
    (row) => (row.category === "tax" || row.category === "social_insurance") && row.status !== "cancelled"
  );
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
