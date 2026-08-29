"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { ProjectProfitabilityRow } from "@/lib/project-profitability";
import {
  loadProjectProfitability,
  peekProjectProfitability,
  prefetchProjectProfitability,
} from "@/lib/project-profitability-client";

// ---- formatters ------------------------------------------------------------

function fmtYen(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return "—";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}×`;
}

function fmtHours(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "—";
  return `${(Math.round(n * 10) / 10).toLocaleString("ja-JP")}h`;
}

// ---- 会社に残った率のバー ---------------------------------------------------

function RetentionBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.max(0, Math.min(100, rate * 100));
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right tabular-nums">{fmtPct(rate)}</span>
    </div>
  );
}

// ---- メンバー明細 -----------------------------------------------------------

function MemberDetailTable({ row }: { row: ProjectProfitabilityRow }) {
  if (row.members.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">この年は、まだ報酬計算が回っていない。</p>;
  }
  return (
    <div className="overflow-x-auto py-1 pl-6">
      <table className="w-[620px] max-w-full text-xs">
        <thead className="text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left font-normal">メンバー</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">稼働需要額</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">現金で支払</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">会社に残った</th>
          </tr>
        </thead>
        <tbody>
          {row.members.map((m) => (
            <tr key={m.memberId} className="border-t border-border/60">
              <td className="px-3 py-1.5">
                <span className="font-medium">{m.memberName}</span>
                {m.payoutExcluded ? (
                  <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                    会社に残る区分
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtYen(m.grossDueYen)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtYen(m.paidYen)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmtYen(m.retainedYen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- 一覧 ------------------------------------------------------------------

const COLS = 9;

function ProfitabilityTable({
  rows,
  expandedId,
  onToggle,
}: {
  rows: ProjectProfitabilityRow[];
  expandedId: string | null;
  onToggle: (projectId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">この年に配分枠のある PJ が無い。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[1040px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ</th>
            <th className="px-3 py-2 text-right font-normal">
              請求額<span className="ml-0.5 text-[10px]">(推定)</span>
            </th>
            <th className="px-3 py-2 text-right font-normal">配分枠 65%</th>
            <th className="px-3 py-2 text-right font-normal">外部へ支払</th>
            <th className="px-3 py-2 text-right font-normal">会社に残った</th>
            <th className="px-3 py-2 text-right font-normal">残った率</th>
            <th className="px-3 py-2 text-right font-normal">需要/枠</th>
            <th className="px-3 py-2 text-right font-normal">まさ時間</th>
            <th className="px-3 py-2 text-right font-normal">まさ1時間あたり</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.projectId;
            return (
              <Fragment key={row.projectId}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-accent/40"
                  onClick={() => onToggle(row.projectId)}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{row.projectName}</span>
                      {row.warnings.capOverage ? (
                        <span
                          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                          title="発生した稼働が、配れる枠の1.5倍を超えている"
                        >
                          稼働が枠超え
                        </span>
                      ) : null}
                      {row.warnings.noRewardCalc ? (
                        <span
                          className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                          title="配分枠はあるが、この年の報酬計算がまだ動いていない"
                        >
                          報酬計算まだ
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.projectId} · 実績{row.monthsActual}ヶ月
                      {row.monthsPlanned > 0 ? ` / 計画${row.monthsPlanned}ヶ月` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.estimatedRevenueYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.capBudgetYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.externalPaidYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                    {fmtYen(row.retainedYen)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <RetentionBar rate={row.retentionRate} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className={
                        row.warnings.capOverage ? "font-semibold text-amber-700 dark:text-amber-400" : undefined
                      }
                    >
                      {fmtRatio(row.demandCapRatio)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtHours(row.masaHours)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.revenuePerMasaHour === null ? "—" : fmtYen(row.revenuePerMasaHour)}
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={COLS} className="p-0">
                      <MemberDetailTable row={row} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- root ------------------------------------------------------------------

function currentYear(): number {
  return new Date().getFullYear();
}

export function AdminProjectProfitabilityClient() {
  const years = useMemo(() => {
    const y = currentYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);
  const [year, setYear] = useState<number>(currentYear());
  const [rows, setRows] = useState<ProjectProfitabilityRow[] | null>(
    () => peekProjectProfitability(currentYear())?.rows ?? null,
  );
  const [loading, setLoading] = useState(rows === null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback((y: number) => {
    const cached = peekProjectProfitability(y);
    if (cached) {
      setRows(cached.rows);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    loadProjectProfitability(y)
      .then((payload) => setRows(payload.rows))
      .catch((err) => setError(err instanceof Error ? err.message : "PJ別利益構造を読み込めなかった"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(year);
    setExpandedId(null);
  }, [year, load]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p>
          クライアントへの請求額のうち<span className="font-medium text-foreground">65%がメンバーへの配分枠</span>
          で、メンバーはマイルストーンのポイントを消化してこの枠を分け合う。
          まさがポイントを多く取るほど外部メンバーへ配る額が減り、その分が
          <span className="font-medium text-emerald-700 dark:text-emerald-400">会社に残る</span>。
          <span className="font-medium text-foreground">残った率が高いPJほど、現金が出ていっていない</span>。
        </p>
        <p className="mt-1.5">
          <span className="font-medium text-amber-700 dark:text-amber-400">稼働が枠超え</span>
          ：実際に発生した稼働が、配れる枠の1.5倍を超えている。誰かの分が翌月以降へ繰り越されている。
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            onMouseEnter={() => prefetchProjectProfitability(y)}
            onFocus={() => prefetchProjectProfitability(y)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (year === y
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
            }
          >
            {y}年
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {rows === null && loading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">読み込み中…</div>
      ) : (
        <>
          <ProfitabilityTable
            rows={rows ?? []}
            expandedId={expandedId}
            onToggle={(projectId) => setExpandedId((prev) => (prev === projectId ? null : projectId))}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            行をクリックすると、そのPJのメンバー別の内訳が開く。請求額は配分枠から逆算した推定値で、
            契約バッファ（旅費・営業費）を先取りしている月はやや大きく出る。
          </p>
        </>
      )}
    </div>
  );
}
