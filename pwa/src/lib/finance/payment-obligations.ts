import { createHash } from "node:crypto";

export type PaymentObligationStatus = "needs_review" | "open" | "scheduled" | "paid" | "cancelled";
export type PaymentObligationAmountStatus = "exact" | "estimated" | "unknown";
export type PaymentObligationCashflowTreatment = "additive" | "included_in_budget";

export type CompanyPaymentObligation = {
  id: string;
  source_key: string;
  title: string;
  counterparty: string | null;
  category: string;
  amount_yen: number | null;
  amount_status: PaymentObligationAmountStatus;
  due_date: string | null;
  due_date_precision: "day" | "month" | "unknown";
  expected_payment_ym: string | null;
  status: PaymentObligationStatus;
  cashflow_treatment: PaymentObligationCashflowTreatment;
  budget_category: string | null;
  auto_debit: boolean | null;
  owner_member_id: string | null;
  source_kind: string;
  source_ref: string | null;
  confidence: number;
  paid_at: string | null;
  paid_amount_yen: number | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MonthlyPaymentObligation = {
  obligationId: string;
  title: string;
  category: string;
  amountYen: number | null;
  amountStatus: PaymentObligationAmountStatus;
  dueDate: string | null;
  expectedPaymentYm: number;
  cashflowTreatment: PaymentObligationCashflowTreatment;
  status: PaymentObligationStatus;
  autoDebit: boolean | null;
};

export function currentDateJst(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

export function currentYmJst(now = new Date()): string {
  return currentDateJst(now).slice(0, 7).replace("-", "");
}

export function addMonthsToYm(ym: string, delta: number): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function obligationToMonthlyInput(row: CompanyPaymentObligation): MonthlyPaymentObligation | null {
  if (row.status === "paid" || row.status === "cancelled") return null;
  const ym = row.expected_payment_ym ?? row.due_date?.slice(0, 7).replace("-", "") ?? null;
  if (!ym || !/^\d{6}$/.test(ym)) return null;
  return {
    obligationId: row.id,
    title: row.title,
    category: row.category,
    amountYen: row.amount_yen == null ? null : Number(row.amount_yen),
    amountStatus: row.amount_status,
    dueDate: row.due_date,
    expectedPaymentYm: Number(ym),
    cashflowTreatment: row.cashflow_treatment,
    status: row.status,
    autoDebit: row.auto_debit,
  };
}

const PAYMENT_KEYWORDS = [
  "納付", "納期限", "納付書", "督促", "支払", "お支払い", "請求", "振込", "口座振替", "引落", "税", "社会保険", "保険料", "源泉", "e-tax", "eltax",
];
const COMPLETION_ONLY = ["領収", "受領", "支払完了", "決済完了", "振込完了", "入金済", "納付完了"];
const NON_OBLIGATION_SUBJECT = [
  /振り込みのご確認/,
  /振込入金/,
  /入金(?:のご連絡|のお知らせ|を確認)/,
  /ポイント(?:付与|.*お知らせ)/,
  /請求書テンプレート/,
  /出展社募集/,
  /(?:api|システム).*(?:仕様変更|更新)/i,
];
const STRONG_PAYMENT_INTENT = /納付|納期限|納付書|督促|支払期限|支払期日|お支払い(?:のお願い|ください|が必要|予定)|引落予定|引き落とし|口座振替|請求書|社会保険料|源泉所得税|住民税/;

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractPaymentDueDate(text: string, referenceDate: string): string | null {
  const value = normalizeDigits(text);
  const full = value.match(/(20\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})\s*日?/);
  if (full) return validIsoDate(Number(full[1]), Number(full[2]), Number(full[3]));
  const short = value.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!short) return null;
  const refYear = Number(referenceDate.slice(0, 4));
  const refMonth = Number(referenceDate.slice(5, 7));
  let year = refYear;
  const month = Number(short[1]);
  if (refMonth >= 10 && month <= 3) year += 1;
  if (refMonth <= 3 && month >= 10) year -= 1;
  return validIsoDate(year, month, Number(short[2]));
}

export function extractPaymentAmount(text: string): number | null {
  const value = normalizeDigits(text).replace(/\s+/g, " ");
  const candidates: number[] = [];
  for (const match of value.matchAll(/(?:¥|￥)\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*円/g)) {
    const amount = Number(String(match[1] ?? match[2] ?? "").replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) candidates.push(Math.round(amount));
  }
  return candidates.length ? Math.max(...candidates) : null;
}

function categoryForText(text: string): string {
  const lower = text.toLowerCase();
  if (/社会保険|厚生年金|健康保険|保険料/.test(text)) return "social_insurance";
  if (/税|源泉|e-tax|eltax/.test(lower)) return "tax";
  if (/給与|賞与/.test(text)) return "payroll";
  if (/請求|invoice/.test(lower)) return "invoice";
  return "other";
}

export type ParsedPaymentEmail = {
  title: string;
  category: string;
  amountYen: number | null;
  amountStatus: PaymentObligationAmountStatus;
  dueDate: string | null;
  dueDatePrecision: "day" | "unknown";
  expectedPaymentYm: string | null;
  status: PaymentObligationStatus;
  confidence: number;
  matchedKeywords: string[];
};

export function parsePaymentEmail(subject: string, snippet: string, referenceDate: string): ParsedPaymentEmail | null {
  const compactSubject = subject.replace(/\s+/g, " ").trim().slice(0, 160) || "支払義務候補";
  const text = `${compactSubject}\n${snippet.replace(/\s+/g, " ").slice(0, 800)}`;
  const lower = text.toLowerCase();
  if (NON_OBLIGATION_SUBJECT.some((pattern) => pattern.test(compactSubject))) return null;
  const matchedKeywords = PAYMENT_KEYWORDS.filter((keyword) => lower.includes(keyword.toLowerCase()));
  if (!matchedKeywords.length) return null;
  if (COMPLETION_ONLY.some((keyword) => text.includes(keyword)) && !/期限|期日|納期限|支払日|引落日/.test(text)) return null;
  const amountYen = extractPaymentAmount(text);
  const dueDate = extractPaymentDueDate(text, referenceDate);
  if (amountYen == null && dueDate == null && !STRONG_PAYMENT_INTENT.test(text)) return null;
  const complete = amountYen != null && dueDate != null;
  return {
    title: compactSubject,
    category: categoryForText(text),
    amountYen,
    amountStatus: amountYen == null ? "unknown" : "exact",
    dueDate,
    dueDatePrecision: dueDate ? "day" : "unknown",
    expectedPaymentYm: dueDate?.slice(0, 7).replace("-", "") ?? null,
    status: complete ? "open" : "needs_review",
    confidence: complete ? 0.9 : amountYen != null || dueDate != null ? 0.7 : 0.5,
    matchedKeywords,
  };
}

function normalizedSourceTitle(title: string): string {
  return normalizeDigits(title)
    .toLowerCase()
    .replace(/^(?:re|fw|fwd)\s*[:：]\s*/i, "")
    .replace(/20\d{2}[年/.-]\d{1,2}[月/.-]\d{1,2}日?/g, "")
    .replace(/\d{1,2}月\d{1,2}日/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 120);
}

export function gmailObligationSourceKey(input: {
  senderDomain: string;
  title: string;
  category: string;
  amountYen: number | null;
  dueDate: string | null;
  referenceDate: string;
}): string {
  const sender = input.category === "card_payment" ? "aggregate-card-statement" : input.senderDomain.toLowerCase() || "unknown";
  const identity = input.amountYen != null && input.dueDate
    ? [sender, input.category, input.amountYen, input.dueDate]
    : [sender, input.category, normalizedSourceTitle(input.title), input.referenceDate.slice(0, 7)];
  return `gmail-obligation:${createHash("sha256").update(identity.join(":"), "utf8").digest("hex")}`;
}

export function notificationStage(
  obligation: Pick<CompanyPaymentObligation, "status" | "due_date" | "due_date_precision" | "expected_payment_ym" | "amount_status">,
  today = currentDateJst()
): { scheduleKey: string; stage: string } | null {
  if (obligation.status === "paid" || obligation.status === "cancelled") return null;
  if (obligation.status === "needs_review" || obligation.amount_status === "unknown" || obligation.due_date_precision === "unknown") {
    return { scheduleKey: obligation.due_date ?? obligation.expected_payment_ym ?? "unknown", stage: "needs-review" };
  }
  if (obligation.due_date_precision === "month") {
    const ym = obligation.expected_payment_ym ?? obligation.due_date?.slice(0, 7).replace("-", "");
    return ym === today.slice(0, 7).replace("-", "") ? { scheduleKey: ym, stage: "current-month" } : null;
  }
  if (!obligation.due_date) return null;
  const due = Date.parse(`${obligation.due_date}T00:00:00+09:00`);
  const current = Date.parse(`${today}T00:00:00+09:00`);
  const days = Math.round((due - current) / 86400000);
  if ([30, 14, 7, 1, 0].includes(days)) return { scheduleKey: obligation.due_date, stage: days === 0 ? "due-today" : `${days}-days-before` };
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return { scheduleKey: obligation.due_date, stage: `overdue-${overdueDays}-days` };
  }
  return null;
}
