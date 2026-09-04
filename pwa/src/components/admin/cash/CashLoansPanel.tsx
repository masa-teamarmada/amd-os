"use client";

/**
 * 「01 借りているお金」。PayPay銀行と商工中金の借入残高、返済の予定と実績。
 *
 * PayPay銀行は枠の中で何度でも借りて返す使い方なので、借りるたび・返すたびにここへ1行足す。
 * 残高と、その残高に付く利息が自動で更新される。
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CashAndLoansResult, LoanView } from "@/lib/finance/cash-and-loans-types";
import { amount, longDate, percent, shortDate, todayIso, yen } from "./format";

type Draft = {
  loanId: string;
  eventDate: string;
  kind: "drawdown" | "repayment";
  amount: string;
  interestAmount: string;
  note: string;
};

function LoanCard({ loan }: { loan: LoanView }) {
  // 今の残高に、これから1か月そのまま借り続けたら付く利息。借り換えの判断材料。
  const monthlyCost = Math.floor((loan.outstanding * loan.annualRate * 30) / loan.dayCountBasis);

  const rows: { label: string; value: string; hint?: string; strong?: boolean }[] = [
    { label: "いま借りている額", value: loan.outstanding > 0 ? yen(loan.outstanding) : "0円（まだ借りていない）", strong: true },
    { label: "年利", value: percent(loan.annualRate), hint: `1年そのままなら ${yen(Math.floor(loan.outstanding * loan.annualRate))}` },
    { label: "このまま30日で付く利子", value: monthlyCost > 0 ? yen(monthlyCost) : "—" },
    { label: "次の返済", value: loan.nextDue ? `${longDate(loan.nextDue.date)}　${yen(loan.nextDue.amount)}` : "予定なし" },
    { label: "返し終わる予定", value: loan.finalDueOn ? longDate(loan.finalDueOn) : "—" },
    { label: "これまでに払った利子", value: yen(loan.paidInterest) },
    { label: "これから払う予定の利子", value: loan.plannedInterest > 0 ? yen(loan.plannedInterest) : "—" },
  ];

  return (
    <div className="border border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
        <div>
          <span className="text-sm font-semibold text-foreground">{loan.shortName}</span>
          <span className="ml-2 text-[11px] text-muted-foreground">{loan.lender}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {loan.repaymentType === "revolving" ? "枠の中で何度でも借りて返す" : "毎月おなじ元金を返す"}
          {loan.accountName ? `・引き落とし ${loan.accountName}` : ""}
        </span>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="w-[46%] px-2 py-1 text-left text-[11px] font-normal text-muted-foreground">{r.label}</th>
              <td className={cn("px-2 py-1 text-right font-mono text-xs tabular-nums", r.strong ? "text-sm font-semibold text-foreground" : "text-foreground")}>
                {r.value}
                {r.hint ? <span className="ml-1 block text-[10px] font-normal text-muted-foreground">{r.hint}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loan.note ? <p className="border-t border-border px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">{loan.note}</p> : null}
    </div>
  );
}

export function CashLoansPanel({
  data,
  loading,
  onChanged,
}: {
  data: CashAndLoansResult | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const loans = data?.loans ?? [];
  const today = data?.today ?? todayIso();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cash-loan-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: draft.loanId,
          eventDate: draft.eventDate,
          kind: draft.kind,
          amount: draft.amount,
          interestAmount: draft.kind === "repayment" ? draft.interestAmount : null,
          isPlanned: draft.eventDate > today,
          note: draft.note,
        }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "保存に失敗した");
      setDraft(null);
      onChanged();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "保存に失敗した");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/cash-loan-events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "削除に失敗した");
      onChanged();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "削除に失敗した");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-foreground">借入ごとの状態</h2>
          <button
            type="button"
            onClick={() => setDraft({ loanId: loans[0]?.loanId ?? "", eventDate: todayIso(), kind: "drawdown", amount: "", interestAmount: "", note: "" })}
            className="h-7 rounded-none border border-border px-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            借入・返済を記録する
          </button>
        </div>

        {loading && loans.length === 0 ? (
          <p className="border border-border p-6 text-center text-xs text-muted-foreground">読み込み中…</p>
        ) : null}

        <div className="grid gap-2 lg:grid-cols-2">
          {loans.map((loan) => <LoanCard key={loan.loanId} loan={loan} />)}
        </div>
      </section>

      {message ? <p className="border border-destructive/40 bg-destructive/5 p-1.5 text-[11px] text-destructive">{message}</p> : null}

      {draft ? (
        <section className="flex flex-wrap items-end gap-2 border border-border bg-muted/20 p-2">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            どこから
            <select value={draft.loanId} onChange={(e) => setDraft({ ...draft, loanId: e.target.value })}
              className="h-8 w-[160px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground">
              {loans.map((l) => <option key={l.loanId} value={l.loanId}>{l.shortName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            種類
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
              className="h-8 w-[120px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground">
              <option value="drawdown">借りた</option>
              <option value="repayment">返した</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            日付
            <input type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
              className="h-8 w-[140px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            {draft.kind === "drawdown" ? "借りた額" : "口座から出た額"}
            <input inputMode="numeric" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              className="h-8 w-[140px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground" />
          </label>
          {draft.kind === "repayment" ? (
            <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
              うち利子
              <input inputMode="numeric" value={draft.interestAmount} onChange={(e) => setDraft({ ...draft, interestAmount: e.target.value })}
                className="h-8 w-[120px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground" />
            </label>
          ) : null}
          <label className="flex min-w-[200px] flex-1 flex-col gap-0.5 text-[11px] text-muted-foreground">
            備考
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              className="h-8 w-full rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
          </label>
          <button type="button" disabled={saving} onClick={() => void save()}
            className="h-8 rounded-none border border-foreground bg-foreground px-3 text-xs text-background disabled:opacity-50">
            {saving ? "保存中…" : "保存"}
          </button>
          <button type="button" onClick={() => setDraft(null)}
            className="h-8 rounded-none border border-border px-2 text-xs text-muted-foreground hover:bg-accent">やめる</button>
          <p className="w-full text-[11px] text-muted-foreground">
            返済で「うち利子」を空にすると、出た額を全部そのまま元金を減らしたものとして数える。
          </p>
        </section>
      ) : null}

      {/* ── 借入ごとの出入り ── */}
      {loans.map((loan) => (
        <section key={loan.loanId}>
          <h2 className="mb-1 text-xs font-semibold text-foreground">
            {loan.shortName} の出入り
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              借りた総額 {yen(loan.totalDrawdown)}・返した元金 {yen(loan.repaidPrincipal)}
            </span>
          </h2>
          <div className="max-h-[420px] overflow-auto border border-border">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/95">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th scope="col" className="px-2 py-1 text-left font-medium">日付</th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">種類</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">口座の出入り</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">うち元金</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">うち利子</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">残りの借入</th>
                  <th scope="col" className="px-2 py-1 text-left font-medium">備考</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {loan.events.length === 0 ? (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-xs text-muted-foreground">まだ記録が無い</td></tr>
                ) : null}
                {loan.events.map((e) => (
                  <tr key={e.id} className={cn("border-b border-border last:border-b-0 hover:bg-accent/30", e.isPlanned && "bg-muted/20")}>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-xs tabular-nums text-foreground">
                      {shortDate(e.eventDate)}
                      {e.isPlanned ? <span className="ml-1 text-[10px] text-muted-foreground">予定</span> : null}
                    </td>
                    <td className="px-2 py-1 text-xs text-foreground">
                      {e.kind === "drawdown" ? "借りた" : e.kind === "repayment" ? "返した" : "手数料"}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{amount(e.amount)}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">{amount(e.principalAmount)}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted-foreground">{amount(e.interestAmount)}</td>
                    <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{e.balanceAfter.toLocaleString("ja-JP")}</td>
                    <td className="max-w-[300px] px-2 py-1 text-[11px] leading-snug text-muted-foreground">{e.note}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right">
                      <button type="button" onClick={() => void remove(e.id)}
                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive">消す</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loan.repaymentType === "equal_principal" ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              元金と利子の内訳は、借りた額を回数で割った推定。銀行から来る返済予定表と1円まで合わせたいときは、
              契約書の数字でこの表を直す。口座から実際に引き落とされる額（いちばん左の列）はスプレッドシートの実額そのまま。
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
