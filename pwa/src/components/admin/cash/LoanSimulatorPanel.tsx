"use client";

/**
 * 「02 利息の試算」。PayPay銀行から年利14.0%で借りるときに、利子がいくら付くかを見る。
 *
 * 数え方は日割り。
 *   利子 ＝ 借りている元金 × 年利 ÷ 365 × 借りていた日数
 * 何度も借りて返す使い方だと、月ごとの利子は一定にならない。借りた額と、その額が
 * 何日残っていたかで決まる。だから「借りた日」「返した日」を並べて数える。
 *
 * 入力は localStorage に残す (この端末だけ)。DB には保存しない。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CashAndLoansResult } from "@/lib/finance/cash-and-loans-types";
import { computeDailyInterest, simpleInterest, type LoanFlow } from "@/lib/finance/loan-interest";
import { addDaysIso, longDate, shortDate, todayIso, yen } from "./format";

const STORAGE_KEY = "admin-cash:simulator:v1";
const QUICK_AMOUNTS = [1_000_000, 3_000_000, 5_000_000, 10_000_000];
const QUICK_DAYS = [7, 30, 60, 90, 180, 365];

type PlanRow = { id: string; date: string; kind: "drawdown" | "repayment"; amount: string; label: string };

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultPlan(): PlanRow[] {
  const today = todayIso();
  return [
    { id: newId(), date: today, kind: "drawdown", amount: "5000000", label: "運転資金として借りる" },
    { id: newId(), date: addDaysIso(today, 90), kind: "repayment", amount: "5000000", label: "入金が入ったら全額返す" },
  ];
}

function readStored(): { ratePercent?: string; rows?: PlanRow[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { ratePercent?: string; rows?: PlanRow[] }) : null;
  } catch {
    // 保存が読めなくても既定の内容で使えればよい。
    return null;
  }
}

export function LoanSimulatorPanel({ data }: { data: CashAndLoansResult | null }) {
  const paypay = data?.loans.find((l) => l.loanId === "paypay_2026") ?? data?.loans.find((l) => l.repaymentType === "revolving");
  const defaultRate = paypay ? paypay.annualRate * 100 : 14;

  // 年利と計画は1つの state にまとめる。保存値の復元を1回の更新で済ませるため。
  const [plan, setPlan] = useState<{ ratePercent: string; rows: PlanRow[] }>(() => ({
    ratePercent: String(defaultRate),
    rows: defaultPlan(),
  }));
  const { ratePercent, rows } = plan;
  const setRatePercent = (value: string) => setPlan((prev) => ({ ...prev, ratePercent: value }));
  const setRows = (updater: PlanRow[] | ((prev: PlanRow[]) => PlanRow[])) =>
    setPlan((prev) => ({ ...prev, rows: typeof updater === "function" ? updater(prev.rows) : updater }));

  // 保存値を読み込む前に書き戻すと、既定の内容で上書きしてしまう。読み込み済みかは ref で持つ。
  const hydrated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStored();
    hydrated.current = true;
    if (stored) {
      setPlan({
        ratePercent: stored.ratePercent ?? String(defaultRate),
        rows: stored.rows && stored.rows.length > 0 ? stored.rows : defaultPlan(),
      });
    }
  // defaultRate は data から決まるが、この復元はマウント時の1回だけでよい。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hydrated.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ratePercent, rows }));
    } catch {
      // 保存できない環境でも計算はできる。
    }
  }, [ratePercent, rows]);

  const rate = useMemo(() => {
    const n = Number(ratePercent.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n / 100 : 0;
  }, [ratePercent]);

  const flows: LoanFlow[] = useMemo(
    () =>
      rows
        .map((r) => ({
          date: r.date,
          kind: r.kind,
          amount: Number(r.amount.replace(/[^\d]/g, "")) || 0,
          label: r.label,
        }))
        .filter((f) => f.amount > 0),
    [rows],
  );

  const lastDate = useMemo(() => flows.reduce((max, f) => (f.date > max ? f.date : max), todayIso()), [flows]);
  const result = useMemo(() => computeDailyInterest(flows, rate, lastDate), [flows, rate, lastDate]);

  // PayPay銀行口座の予定で、いちばん低くなる日と額。いくら借りれば足りるかの目安に使う。
  const paypayAccount = data?.accounts.find((a) => a.accountId === "paypay");
  const shortage = paypayAccount?.lowestPlanned ?? null;

  function update(id: string, patch: Partial<PlanRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-4">
      {/* ── 数え方 ── */}
      <section className="border border-border bg-muted/20 p-2">
        <h2 className="text-xs font-semibold text-foreground">利子の数え方</h2>
        <p className="mt-1 text-xs leading-relaxed text-foreground">
          利子 ＝ <span className="font-semibold">借りている元金</span> ×{" "}
          <span className="font-semibold">年利</span> ÷ 365 ×{" "}
          <span className="font-semibold">借りていた日数</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          日割りなので、早く返せばその分だけ利子は減る。逆に借りたままにすると、返済日が来ていなくても毎日増える。
          1年の日数は365日で数える（うるう年も365で数える契約が多い）。実際に請求される額は銀行側の
          端数処理で数円ずれることがある。
        </p>
      </section>

      {/* ── 早見表 ── */}
      <section>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold text-foreground">早見表</h2>
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            年利
            <input
              inputMode="decimal"
              value={ratePercent}
              onChange={(e) => setRatePercent(e.target.value)}
              className="h-7 w-[70px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground"
            />
            %
          </label>
          <span className="text-[11px] text-muted-foreground">
            借りた額をそのまま置いておいたときに、何日でいくらの利子が付くか
          </span>
        </div>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left font-medium">借りる額</th>
                {QUICK_DAYS.map((d) => (
                  <th key={d} scope="col" className="px-2 py-1 text-right font-medium">{d}日</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUICK_AMOUNTS.map((principal) => (
                <tr key={principal} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-2 py-1 text-left font-mono text-xs font-normal tabular-nums text-foreground">
                    {yen(principal)}
                  </th>
                  {QUICK_DAYS.map((d) => (
                    <td key={d} className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">
                      {simpleInterest(principal, rate, d).toLocaleString("ja-JP")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          単位は円。たとえば年利{(rate * 100).toFixed(1)}%で500万円を90日借りると、利子は{" "}
          <span className="font-mono font-semibold text-foreground">{yen(simpleInterest(5_000_000, rate, 90))}</span>。
        </p>
      </section>

      {/* ── 借入・返済の計画 ── */}
      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-foreground">借りたり返したりの計画</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { id: newId(), date: lastDate, kind: "repayment", amount: "", label: "" }])}
              className="h-7 rounded-none border border-border px-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              行を足す
            </button>
            <button
              type="button"
              onClick={() => setRows(defaultPlan())}
              className="h-7 rounded-none border border-border px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              はじめに戻す
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left font-medium">日付</th>
                <th scope="col" className="px-2 py-1 text-left font-medium">どうする</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">金額</th>
                <th scope="col" className="px-2 py-1 text-left font-medium">メモ</th>
                <th scope="col" className="px-2 py-1 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-1">
                    <input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })}
                      className="h-8 w-[140px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
                  </td>
                  <td className="px-2 py-1">
                    <select value={r.kind} onChange={(e) => update(r.id, { kind: e.target.value as PlanRow["kind"] })}
                      className="h-8 w-[100px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground">
                      <option value="drawdown">借りる</option>
                      <option value="repayment">返す</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input inputMode="numeric" value={r.amount} onChange={(e) => update(r.id, { amount: e.target.value })}
                      className="h-8 w-[140px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })}
                      className="h-8 w-full min-w-[160px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive">消す</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 結果 ── */}
      <section className="grid gap-2 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="border border-border">
          <h2 className="border-b border-border bg-muted/40 px-2 py-1.5 text-xs font-semibold text-foreground">この計画だと</h2>
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-normal text-muted-foreground">払う利子の合計</th>
                <td className="px-2 py-1.5 text-right font-mono text-lg font-semibold tabular-nums text-foreground">
                  {yen(result.totalInterest)}
                </td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-normal text-muted-foreground">借りる総額</th>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">{yen(result.totalDrawdown)}</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-normal text-muted-foreground">返す元金の総額</th>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">{yen(result.totalRepayment)}</td>
              </tr>
              <tr className="border-b border-border">
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-normal text-muted-foreground">いちばん多く借りている額</th>
                <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">{yen(result.maxBalance)}</td>
              </tr>
              <tr>
                <th scope="row" className="px-2 py-1.5 text-left text-[11px] font-normal text-muted-foreground">
                  {longDate(lastDate)}に残る元金
                </th>
                <td className={cn("px-2 py-1.5 text-right font-mono text-xs tabular-nums", result.finalBalance > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {yen(result.finalBalance)}
                </td>
              </tr>
            </tbody>
          </table>
          {shortage ? (
            <p className="border-t border-border px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
              いまの予定だと PayPay銀行の残高は {shortDate(shortage.date)} に{" "}
              <span className={cn("font-mono font-semibold", shortage.balance < 0 ? "text-destructive" : "text-foreground")}>
                {yen(shortage.balance)}
              </span>{" "}
              まで下がる。ここを埋めるのに必要な額を「借りる」に入れて試すといい。
            </p>
          ) : null}
        </div>

        <div className="border border-border">
          <h2 className="border-b border-border bg-muted/40 px-2 py-1.5 text-xs font-semibold text-foreground">
            月ごとの利子
          </h2>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-muted/95">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th scope="col" className="px-2 py-1 text-left font-medium">月</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">その月の利子</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">月末に借りている額</th>
                </tr>
              </thead>
              <tbody>
                {result.byMonth.length === 0 ? (
                  <tr><td colSpan={3} className="px-2 py-6 text-center text-xs text-muted-foreground">
                    上の表に「借りる」を1行入れると、ここに利子が出る
                  </td></tr>
                ) : null}
                {result.byMonth.map((m) => (
                  <tr key={m.ym} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1 font-mono text-xs tabular-nums text-foreground">
                      {m.ym.slice(0, 4)}年{Number(m.ym.slice(5, 7))}月
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">
                      {m.interest.toLocaleString("ja-JP")}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {m.endBalance.toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 期間ごとの内訳 ── */}
      {result.segments.length > 0 ? (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-foreground">どの期間にいくら付いたか</h2>
          <div className="max-h-[280px] overflow-auto border border-border">
            <table className="w-full min-w-[600px] border-collapse">
              <thead className="sticky top-0 bg-muted/95">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th scope="col" className="px-2 py-1 text-left font-medium">はじまり</th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">おわり</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">日数</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">その間の借入</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">付いた利子</th>
                </tr>
              </thead>
              <tbody>
                {result.segments.map((s) => (
                  <tr key={`${s.from}-${s.to}`} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1 font-mono text-xs tabular-nums text-foreground">{shortDate(s.from)}</td>
                    <td className="px-2 py-1 font-mono text-xs tabular-nums text-foreground">{shortDate(s.to)}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">{s.days}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{s.balance.toLocaleString("ja-JP")}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{Math.floor(s.interest).toLocaleString("ja-JP")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
