"use client";

/**
 * 「00 口座のお金」。きよのスプレッドシート「収支」の口座タブを置き換える表。
 *
 * 残高は2つ出す。スプシに書かれていた値 (原本) と、OSが期首から積み上げた値。
 * 手入力なので途中で式が切れている箇所があり、両方並べないとどこで狂ったか分からない。
 * 食い違う行には印を付けて、きよが直せるようにする。
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { CashAccountView, CashAndLoansResult, CashLedgerEntry } from "@/lib/finance/cash-and-loans-types";
import { amount, longDate, shortDate, todayIso, yen } from "./format";

type Draft = {
  id?: string;
  entryDate: string;
  counterparty: string;
  withdrawal: string;
  deposit: string;
  note: string;
};

const EMPTY_DRAFT: Draft = { entryDate: todayIso(), counterparty: "", withdrawal: "", deposit: "", note: "" };

function SummaryRow({ account }: { account: CashAccountView }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className="px-2 py-1.5 text-left align-top">
        <span className="text-xs font-semibold text-foreground">{account.shortName}</span>
        <span className="ml-1 text-[11px] text-muted-foreground">{account.institution}</span>
      </th>
      <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">
        {account.actualBalance == null ? "—" : yen(account.actualBalance)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {account.actualAsOf ? longDate(account.actualAsOf) : "—"}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {account.plannedBalance == null ? "—" : yen(account.plannedBalance)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
        {account.lowestPlanned ? (
          <span className={account.lowestPlanned.balance < 0 ? "font-semibold text-destructive" : "text-foreground"}>
            {yen(account.lowestPlanned.balance)}
            <span className="ml-1 text-[11px] text-muted-foreground">{shortDate(account.lowestPlanned.date)}</span>
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {account.entryCount}件
        {account.gapCount > 0 ? <span className="ml-1 text-amber-600 dark:text-amber-500">要確認{account.gapCount}</span> : null}
      </td>
    </tr>
  );
}

export function CashAccountsPanel({
  data,
  loading,
  onChanged,
}: {
  data: CashAndLoansResult | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const [accountId, setAccountId] = useState<string | null>(null);
  // 明細は1000行を超えるので、既定は今月だけ出す。月の行を押すとその月、「ぜんぶ」で全期間。
  const [ym, setYm] = useState<string | "all" | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const active = useMemo(
    () => accounts.find((a) => a.accountId === (accountId ?? accounts[0]?.accountId)) ?? null,
    [accounts, accountId],
  );

  // 未選択なら今月。その口座に今月の行が無ければ、いちばん新しい月にする。
  const effectiveYm = useMemo(() => {
    if (ym) return ym;
    if (!active || active.monthly.length === 0) return "all";
    const current = (data?.today ?? todayIso()).slice(0, 7);
    return active.monthly.some((m) => m.ym === current) ? current : active.monthly[active.monthly.length - 1].ym;
  }, [ym, active, data]);

  const rows = useMemo(() => {
    if (!active) return [] as CashLedgerEntry[];
    const filtered =
      effectiveYm === "all" ? active.entries : active.entries.filter((e) => e.entryDate.slice(0, 7) === effectiveYm);
    return [...filtered].reverse();
  }, [active, effectiveYm]);

  async function save() {
    if (!draft || !active) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/cash-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          accountId: active.accountId,
          entryDate: draft.entryDate,
          counterparty: draft.counterparty,
          withdrawal: draft.withdrawal,
          deposit: draft.deposit,
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
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/cash-entries?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
      {/* ── 口座ごとの今の状態 ── */}
      <section>
        <h2 className="mb-1 text-xs font-semibold text-foreground">口座のいま</h2>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left font-medium">口座</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">いまの残高</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">その残高の日</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">予定を全部足すと</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">いちばん低くなる日</th>
                <th scope="col" className="px-2 py-1 text-right font-medium">明細</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 && loading ? (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-muted-foreground">読み込み中…</td></tr>
              ) : null}
              {accounts.map((a) => <SummaryRow key={a.accountId} account={a} />)}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          「いまの残高」は今日までに実際に動いた分。「予定を全部足すと」は、きよが先の予定として入れてある行まで
          反映した見通し。「いちばん低くなる日」がマイナスなら、その前に入金か借入が要る。
        </p>
      </section>

      {/* ── 口座の切り替え ── */}
      <section>
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {accounts.map((a) => (
            <button
              key={a.accountId}
              type="button"
              onClick={() => { setAccountId(a.accountId); setYm(null); setDraft(null); }}
              className={cn(
                "h-7 rounded-none border border-border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active?.accountId === a.accountId ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {a.shortName}
            </button>
          ))}
          <span className="ml-2 text-[11px] text-muted-foreground">{active?.purpose}</span>
        </div>

        {active ? (
          <>
            {/* 月ごとの動き */}
            <div className="mb-2 overflow-x-auto border border-border">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] text-muted-foreground">
                    <th scope="col" className="px-2 py-1 text-left font-medium">月</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">入ってきた</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">出ていった</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">差引</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">月末の残高</th>
                  </tr>
                </thead>
                <tbody>
                  {active.monthly.map((m) => (
                    <tr
                      key={m.ym}
                      className={cn(
                        "cursor-pointer border-b border-border last:border-b-0 hover:bg-accent/40",
                        effectiveYm === m.ym && "bg-accent/60",
                      )}
                      onClick={() => setYm(effectiveYm === m.ym ? "all" : m.ym)}
                    >
                      <td className="px-2 py-1 text-xs text-foreground">
                        {m.label}
                        {m.hasPlanned ? <span className="ml-1 text-[10px] text-muted-foreground">予定</span> : null}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{amount(m.inflow)}</td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{amount(m.outflow)}</td>
                      <td className={cn("px-2 py-1 text-right font-mono text-xs tabular-nums", m.net < 0 ? "text-destructive" : "text-foreground")}>
                        {m.net === 0 ? "" : m.net.toLocaleString("ja-JP")}
                      </td>
                      <td className={cn("px-2 py-1 text-right font-mono text-xs tabular-nums", m.endBalance < 0 ? "font-semibold text-destructive" : "text-foreground")}>
                        {m.endBalance.toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 明細 */}
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold text-foreground">
                {active.shortName} の明細
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  {effectiveYm === "all"
                    ? `全期間 ${rows.length}件`
                    : `${effectiveYm.replace("-", "年")}月 ${rows.length}件（上の月の行を押すと切り替わる）`}
                </span>
              </h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setYm(effectiveYm === "all" ? null : "all")}
                  className="h-7 rounded-none border border-border px-2 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {effectiveYm === "all" ? "今月だけ" : "ぜんぶ"}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...EMPTY_DRAFT })}
                  className="h-7 rounded-none border border-border px-2 text-xs text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  行を足す
                </button>
              </div>
            </div>

            {message ? <p className="mb-1 border border-destructive/40 bg-destructive/5 p-1.5 text-[11px] text-destructive">{message}</p> : null}

            {draft ? (
              <div className="mb-2 flex flex-wrap items-end gap-2 border border-border bg-muted/20 p-2">
                <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  日付
                  <input type="date" value={draft.entryDate} onChange={(e) => setDraft({ ...draft, entryDate: e.target.value })}
                    className="h-8 w-[140px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
                </label>
                <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  相手先
                  <input value={draft.counterparty} onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })}
                    className="h-8 w-[160px] rounded-none border border-border bg-background px-1.5 text-xs text-foreground" />
                </label>
                <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  出ていった額
                  <input inputMode="numeric" value={draft.withdrawal} onChange={(e) => setDraft({ ...draft, withdrawal: e.target.value })}
                    className="h-8 w-[120px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground" />
                </label>
                <label className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                  入ってきた額
                  <input inputMode="numeric" value={draft.deposit} onChange={(e) => setDraft({ ...draft, deposit: e.target.value })}
                    className="h-8 w-[120px] rounded-none border border-border bg-background px-1.5 text-right font-mono text-xs tabular-nums text-foreground" />
                </label>
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
                  className="h-8 rounded-none border border-border px-2 text-xs text-muted-foreground hover:bg-accent">
                  やめる
                </button>
              </div>
            ) : null}

            <div className="max-h-[600px] overflow-auto border border-border">
              <table className="w-full min-w-[880px] border-collapse">
                <thead className="sticky top-0 z-10 bg-muted/95">
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th scope="col" className="px-2 py-1 text-left font-medium">日付</th>
                    <th scope="col" className="px-2 py-1 text-left font-medium">相手先</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">出ていった</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">入ってきた</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">残高</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium">OSの計算</th>
                    <th scope="col" className="px-2 py-1 text-left font-medium">備考</th>
                    <th scope="col" className="px-2 py-1 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-2 py-6 text-center text-xs text-muted-foreground">
                      {loading ? "読み込み中…" : "この期間の明細はまだ無い"}
                    </td></tr>
                  ) : null}
                  {rows.map((e) => (
                    <tr key={e.id} className={cn("border-b border-border last:border-b-0 hover:bg-accent/30", e.isPlanned && "bg-muted/20")}>
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-xs tabular-nums text-foreground">
                        {shortDate(e.entryDate)}
                        {e.isPlanned ? <span className="ml-1 text-[10px] text-muted-foreground">予定</span> : null}
                      </td>
                      <td className="px-2 py-1 text-xs text-foreground">
                        {e.counterparty ?? <span className="text-muted-foreground">—</span>}
                        {e.transferName && e.transferName !== e.counterparty ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">{e.transferName}</span>
                        ) : null}
                        {e.category ? <span className="ml-1 text-[10px] text-muted-foreground">{e.category}</span> : null}
                        {e.targetMonth ? <span className="ml-1 text-[10px] text-muted-foreground">{e.targetMonth}</span> : null}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{amount(e.withdrawal)}</td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">{amount(e.deposit)}</td>
                      <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-foreground">
                        {e.sheetBalance == null ? <span className="text-muted-foreground">—</span> : e.sheetBalance.toLocaleString("ja-JP")}
                      </td>
                      <td className={cn(
                        "px-2 py-1 text-right font-mono text-xs tabular-nums",
                        e.balanceGap != null && e.balanceGap !== 0 ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300" : "text-muted-foreground",
                      )}>
                        {e.runningBalance.toLocaleString("ja-JP")}
                        {e.balanceGap != null && e.balanceGap !== 0 ? (
                          <span className="ml-1 text-[10px]">差{e.balanceGap.toLocaleString("ja-JP")}</span>
                        ) : null}
                      </td>
                      <td className="max-w-[280px] px-2 py-1 text-[11px] leading-snug text-muted-foreground">{e.note}</td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        <button type="button" onClick={() => setDraft({
                          id: e.id, entryDate: e.entryDate, counterparty: e.counterparty ?? "",
                          withdrawal: e.withdrawal ? String(e.withdrawal) : "", deposit: e.deposit ? String(e.deposit) : "",
                          note: e.note ?? "",
                        })} className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                          直す
                        </button>
                        <button type="button" onClick={() => void remove(e.id)}
                          className="ml-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-destructive">
                          消す
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {active.gapCount > 0 ? (
              <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-500">
                黄色の行は、スプレッドシートに書いてあった残高と、OSが1行ずつ足し引きした結果が食い違っているところ。
                元の表で式が切れていた箇所なので、正しい方に直すときはここを見て。（{active.gapCount}件）
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
