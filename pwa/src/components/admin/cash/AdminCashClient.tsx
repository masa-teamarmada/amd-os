"use client";

/**
 * `/admin/cash`「現金と融資」本体。正本は pwa/manual/6-13-cash-and-loans-spec.md。
 *
 * きよが手入力しているスプレッドシート「収支」の口座タブを移した表と、
 * PayPay銀行 / 商工中金 の借入残高、それに借入の利息を試す場所を1画面にまとめる。
 *
 * 【キャッシュ分類】参照系。データは lib/finance/cash-and-loans-client.ts 経由で読む
 * (spec 5-10)。初回描画で節が空から生えないよう peek を先に当てる。
 */
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CashAndLoansResult } from "@/lib/finance/cash-and-loans-types";
import { invalidateCashAndLoans, loadCashAndLoans, peekCashAndLoans } from "@/lib/finance/cash-and-loans-client";
import { CashAccountsPanel } from "./CashAccountsPanel";
import { CashLoansPanel } from "./CashLoansPanel";
import { LoanSimulatorPanel } from "./LoanSimulatorPanel";
import { yen } from "./format";

const TASKS = [
  { id: "accounts", step: "00", label: "口座のお金", description: "入ってきた額・出ていった額・残高" },
  { id: "loans", step: "01", label: "借りているお金", description: "PayPay銀行・商工中金の残高と返済" },
  { id: "simulator", step: "02", label: "利息の試算", description: "借りたら利子がいくら付くか" },
] as const;

export type CashTask = (typeof TASKS)[number]["id"];

export function AdminCashClient({ initialTask }: { initialTask: CashTask }) {
  const [task, setTask] = useState<CashTask>(initialTask);
  const [data, setData] = useState<CashAndLoansResult | null>(() => peekCashAndLoans() ?? null);
  const [loading, setLoading] = useState(!peekCashAndLoans());
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (force = false) => {
    if (force) invalidateCashAndLoans();
    setLoading(true);
    setError(null);
    try {
      const next = await loadCashAndLoans(force ? { force: true } : undefined);
      setData(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "読み込みに失敗した");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">現金と融資</h1>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground">
            口座にいくら残っていて、いくら借りているか。きよがスプレッドシート「収支」に手入力していた
            入出金をここへ移した。会計上のもうけは
            <a className="underline underline-offset-2 hover:text-foreground" href="/admin/kiyo?task=money-flow">
              きよ → お金の流れ
            </a>
            が正本で、数字が一致しないのは損益と現金が別物だから。
          </p>
        </div>
        {data ? (
          <dl className="flex shrink-0 items-end gap-4 text-right">
            <div>
              <dt className="text-[11px] text-muted-foreground">口座の残高</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {yen(data.totalActualBalance)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">借入の残高</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {yen(data.totalOutstanding)}
              </dd>
            </div>
            <button
              type="button"
              onClick={() => void reload(true)}
              className="h-8 shrink-0 rounded-none border border-border px-2 text-[11px] text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              最新に更新
            </button>
          </dl>
        ) : null}
      </header>

      <div className="mb-3">
        <div role="tablist" aria-label="現金と融資" className="flex overflow-x-auto sm:grid sm:grid-cols-3 sm:overflow-visible">
          {TASKS.map((item, index) => {
            const selected = item.id === task;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTask(item.id)}
                className={cn(
                  "flex min-h-11 w-[200px] shrink-0 flex-col justify-center gap-0.5 rounded-none border border-border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-full",
                  index > 0 && "-ml-px",
                  selected
                    ? "relative z-10 -mb-px border-t-2 border-t-foreground border-b-background bg-background"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{item.step}</span>
                  <span className={cn("text-sm", selected ? "font-semibold text-foreground" : "font-medium")}>
                    {item.label}
                  </span>
                </span>
                <span className="truncate text-[11px] text-muted-foreground">{item.description}</span>
              </button>
            );
          })}
        </div>

        <section className="rounded-none border border-border bg-background p-3">
          {error ? (
            <p className="border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
          ) : null}

          {task === "accounts" ? (
            <CashAccountsPanel data={data} loading={loading} onChanged={() => void reload(true)} />
          ) : null}
          {task === "loans" ? (
            <CashLoansPanel data={data} loading={loading} onChanged={() => void reload(true)} />
          ) : null}
          {task === "simulator" ? <LoanSimulatorPanel data={data} /> : null}
        </section>
      </div>
    </div>
  );
}
