import type { SupabaseClient } from "@supabase/supabase-js";
import { calcLoanSchedule, type MonthlyPlCashPlan, type MonthlyPlLoan } from "./monthly-pl-simulation.ts";
import { addMonthsToStatutoryYm, statutoryEndOfMonthDueDate } from "./statutory-payment-rules.ts";

type LedgerRow = { entry_date: string; withdrawal: number; counterparty: string | null; category: string | null; account_id: string };
type Profile = { member_name: string | null; code_name: string | null };
type Recurring = { display_name: string | null; item_kind: string | null; category: string | null; amount_yen: number | string | null; start_ym: string | null; end_ym: string | null };
type Loan = { loan_id: string; lender: string; principal_amount: number | null; annual_rate: number; term_months: number | null; first_due_on: string | null; drawdown_on: string | null; repayment_type: string };
type LoanEvent = { loan_id: string; event_date: string; kind: string; amount: number; principal_amount: number | null; interest_amount: number | null; is_planned: boolean };
type SocialObligation = { category: string; amount_yen: number | null; expected_payment_ym: string | null; payload: Record<string, unknown> | null; status: string };
const yen = (value: unknown) => Math.round(Number(value ?? 0)) || 0;
const clean = (value: string | null) => (value ?? "").normalize("NFKC").replace(/[\s:：・　]/g, "");
const month = (date: string) => date.slice(0, 7).replace("-", "");
const kind = (row: Recurring) => row.item_kind || row.category;

/** 登録済み入出金予定のうち給与手取り・カード決済・口座手数料だけを抽出する。
 * 報酬、社保、借入返済は別の正本から供給し、ここへ足さない。
 */
export function operatingCashBudget(rows: LedgerRow[], recurring: Recurring[], profiles: Profile[]) {
  const salary = recurring.filter((row) => ["salary", "executive"].includes(kind(row) ?? ""));
  const salaryProfiles = profiles.filter((profile) => salary.some((row) =>
    [profile.code_name, profile.member_name].some((name) => name && clean(row.display_name).includes(clean(name)))));
  const debt = recurring.filter((row) => ["loan", "loan_payment"].includes(kind(row) ?? ""));
  let payroll = 0, cards = 0, fees = 0;
  for (const row of rows) {
    const amount = yen(row.withdrawal), name = clean(row.counterparty);
    if (amount <= 0) continue;
    if (/カード|ｶｰﾄﾞ/.test(name)) { cards += amount; continue; }
    if (salaryProfiles.some((profile) => clean(profile.member_name) === name && name)) {
      const profile = salaryProfiles.find((candidate) => clean(candidate.member_name) === name)!;
      const isDebt = debt.some((item) => yen(item.amount_yen) === amount &&
        [profile.code_name, profile.member_name].some((n) => n && clean(item.display_name).includes(clean(n))));
      if (!isDebt) payroll += amount;
      continue;
    }
    if ((!name && amount <= 2000) || /経友会|振込手数料|口座手数料/.test(name)) fees += amount;
  }
  return { payroll, cards, fees, total: payroll + cards + fees, complete: payroll > 0 && cards > 0 };
}

/** loans / loan_events を優先し、登録のない将来返済だけ契約条件で見込む。 */
export function bankLoanCashPlans(loans: Loan[], events: LoanEvent[], yms: string[]): MonthlyPlCashPlan[] {
  const result = new Map(yms.map((ym) => [ym, { ym: Number(ym), bankLoanPaymentYen: 0, bankLoanInterestYen: 0, loanDisbursementYen: 0 } satisfies MonthlyPlCashPlan]));
  for (const loan of loans) {
    const own = events.filter((event) => event.loan_id === loan.loan_id).sort((a, b) => a.event_date.localeCompare(b.event_date));
    if (loan.repayment_type !== "revolving" && loan.principal_amount && loan.first_due_on && loan.term_months) {
      const model: MonthlyPlLoan = { loanId: loan.loan_id, loanName: loan.lender, principal: loan.principal_amount, annualRate: Number(loan.annual_rate), totalPayments: loan.term_months, startYm: Number(month(loan.first_due_on)), method: loan.repayment_type };
      const schedule = calcLoanSchedule(model);
      for (const ym of yms) {
        const target = result.get(ym)!;
        const payments = own.filter((event) => month(event.event_date) === ym && event.kind === "repayment");
        const registered = payments.some((event) => !event.is_planned) ? payments.filter((event) => !event.is_planned) : payments;
        const computed = schedule.find((entry) => entry.ym === Number(ym));
        target.bankLoanPaymentYen += registered.length ? registered.reduce((sum, event) => sum + yen(event.amount), 0) : computed?.payment ?? 0;
        target.bankLoanInterestYen += registered.length ? registered.reduce((sum, event) => sum + yen(event.interest_amount), 0) : computed?.interest ?? 0;
      }
      const drawYm = loan.drawdown_on ? month(loan.drawdown_on) : "";
      if (result.has(drawYm)) result.get(drawYm)!.loanDisbursementYen += loan.principal_amount;
    } else if (loan.repayment_type === "revolving") {
      let balance = 0;
      const lastPayment = own.filter((event) => event.kind === "repayment").at(-1);
      const firstYm = own[0] ? month(own[0].event_date) : yms[0];
      for (let ym = firstYm; ym <= yms.at(-1)!; ym = addMonthsToStatutoryYm(ym, 1)) {
        const current = own.filter((event) => month(event.event_date) === ym);
        const drawn = current.filter((event) => event.kind === "drawdown").reduce((sum, event) => sum + yen(event.amount), 0);
        balance += drawn;
        const payments = current.filter((event) => event.kind === "repayment");
        const payment = payments.length ? payments.reduce((sum, event) => sum + yen(event.amount), 0) : ym > month(lastPayment?.event_date ?? "9999-12") ? Math.min(balance + Math.round(balance * Number(loan.annual_rate) / 12), yen(lastPayment?.amount)) : 0;
        const interest = payments.length ? payments.reduce((sum, event) => sum + yen(event.interest_amount), 0) : payment ? Math.round(balance * Number(loan.annual_rate) / 12) : 0;
        balance = Math.max(0, balance - Math.max(0, payment - interest));
        const target = result.get(ym);
        if (target) { target.bankLoanPaymentYen += payment; target.bankLoanInterestYen += interest; target.loanDisbursementYen += drawn; }
      }
    }
  }
  return [...result.values()];
}

export async function loadLiveCashPlans(db: SupabaseClient, yms: string[], recurring: Recurring[], profiles: Profile[], obligations: SocialObligation[], now = new Date()) {
  const currentYm = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(now).replace("-", "");
  const nextMonth = addMonthsToStatutoryYm(currentYm, 1);
  const [ledger, loans, events] = await Promise.all([
    db.from("cash_ledger_entries").select("entry_date,withdrawal,counterparty,category,account_id").eq("is_planned", true).gte("entry_date", `${addMonthsToStatutoryYm(currentYm, -3).slice(0,4)}-${addMonthsToStatutoryYm(currentYm,-3).slice(4)}-01`).lt("entry_date", `${nextMonth.slice(0,4)}-${nextMonth.slice(4)}-01`).order("entry_date").limit(1000),
    db.from("loans").select("loan_id,lender,principal_amount,annual_rate,term_months,first_due_on,drawdown_on,repayment_type").eq("is_active", true).limit(100),
    db.from("loan_events").select("loan_id,event_date,kind,amount,principal_amount,interest_amount,is_planned").order("event_date").limit(1000),
  ]);
  for (const response of [ledger, loans, events]) if (response.error) throw new Error(`支出予定を取得できない: ${response.error.message}`);
  if (ledger.data?.length === 1000 || events.data?.length === 1000) throw new Error("支出予定の読取上限に達したため更新を停止");
  const cashPlans = bankLoanCashPlans((loans.data ?? []) as Loan[], (events.data ?? []) as LoanEvent[], yms);
  const warnings: string[] = [];
  const rows = (ledger.data ?? []) as LedgerRow[];
  const candidates = [...new Set(rows.map((row) => month(row.entry_date)))].sort().reverse();
  const sourceYm = candidates.find((ym) => operatingCashBudget(rows.filter((row) => month(row.entry_date) === ym), recurring, profiles).complete);
  if (!sourceYm) warnings.push("給与手取り・カード支払の月次予定が不足。固定支出は従来の発生額で仮置き。");
  const budget = sourceYm ? operatingCashBudget(rows.filter((row) => month(row.entry_date) === sourceYm), recurring, profiles) : null;
  const social = obligations.filter((row) => row.category === "social_insurance" && yen(row.amount_yen) > 0 && row.status !== "cancelled");
  const socialAmount = [...social].sort((a,b) => (b.expected_payment_ym ?? "").localeCompare(a.expected_payment_ym ?? ""))[0]?.amount_yen;
  const socialByDue = new Map<string, number>();
  if (socialAmount) {
    for (let source = addMonthsToStatutoryYm(currentYm, -2); source <= yms.at(-1)!; source = addMonthsToStatutoryYm(source, 1)) {
      const known = social.find((row) => String(row.payload?.sourceYm ?? row.payload?.source_ym ?? "") === source);
      const dueYm = known?.expected_payment_ym ?? month(statutoryEndOfMonthDueDate(addMonthsToStatutoryYm(source, 1)));
      socialByDue.set(dueYm, (socialByDue.get(dueYm) ?? 0) + yen(known?.amount_yen ?? socialAmount));
    }
  }
  for (const plan of cashPlans) {
    if (String(plan.ym) < currentYm) continue;
    if (budget && sourceYm) { plan.operatingPaymentYen = budget.total; plan.sourceYm = sourceYm; plan.memo = "登録済みの給与手取り・カード・口座手数料の月額見込み。報酬・社保・借入は別計上"; }
    if (socialAmount) plan.socialInsurancePaymentYen = socialByDue.get(String(plan.ym)) ?? 0;
  }
  if (budget && sourceYm) warnings.push(`${sourceYm.slice(0,4)}年${Number(sourceYm.slice(4))}月の登録予定を継続見込み：給与手取り${budget.payroll.toLocaleString("ja-JP")}円、カード${budget.cards.toLocaleString("ja-JP")}円、会費・口座手数料${budget.fees.toLocaleString("ja-JP")}円。カード確定額で更新が必要。`);
  warnings.push("借入は融資台帳を反映。未登録の返済月は契約条件、リボ払いは直近返済額で見込み。金利・利息は推定を含む。");
  if (socialAmount) warnings.push(`社会保険は登録済み月額${yen(socialAmount).toLocaleString("ja-JP")}円を支払期限へ移動。将来分は同額見込み。`);
  return { cashPlans, warnings, hasLiveLoans: Boolean(loans.data?.length) };
}
