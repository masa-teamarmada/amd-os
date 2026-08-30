"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { ProjectProfitabilityRow } from "@/lib/project-profitability";
import { loadProjectProfitability, peekProjectProfitability } from "@/lib/project-profitability-client";

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

/** "202604" → "26年4月" */
function fmtYm(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(2, 4)}年${Number(ym.slice(4, 6))}月`;
}

// ---- 配分の内訳バー ---------------------------------------------------------

/** 原資を100として、外部へ出た分・会社に残った分・まだ配っていない分を1本で見せる。 */
function AllocationBar({ row }: { row: ProjectProfitabilityRow }) {
  if (row.seasonBudgetYen <= 0) return <span className="text-muted-foreground">—</span>;
  const ext = Math.max(0, Math.min(100, (row.externalPaidYen / row.seasonBudgetYen) * 100));
  const ret = Math.max(0, Math.min(100 - ext, (row.retainedYen / row.seasonBudgetYen) * 100));
  return (
    <div className="flex h-2 w-full min-w-[90px] overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-amber-500/80" style={{ width: `${ext}%` }} title="外部へ現金" />
      <div className="h-full bg-emerald-500/80" style={{ width: `${ret}%` }} title="会社に残る" />
    </div>
  );
}

// ---- メンバー明細 -----------------------------------------------------------

function MemberDetailTable({ row }: { row: ProjectProfitabilityRow }) {
  if (row.members.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">このシーズンは、まだ報酬計算が回っていない。</p>;
  }
  return (
    <div className="overflow-x-auto py-1 pl-6">
      <table className="w-[620px] max-w-full text-xs">
        <thead className="text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left font-normal">メンバー</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">稼働需要額</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">現金で支払</th>
            <th className="w-[130px] px-3 py-1.5 text-right font-normal">会社に残る</th>
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
  onToggle: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">原資の入ったシーズンが無い。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[1120px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ / シーズン</th>
            <th className="px-3 py-2 text-right font-normal">
              請求額<span className="ml-0.5 text-[10px]">(推定)</span>
            </th>
            <th className="px-3 py-2 text-right font-normal">シーズン原資</th>
            <th className="px-3 py-2 text-right font-normal">外部へ現金</th>
            <th className="px-3 py-2 text-right font-normal">会社に残る</th>
            <th className="px-3 py-2 text-left font-normal">配分</th>
            <th className="px-3 py-2 text-right font-normal">残る率</th>
            <th className="px-3 py-2 text-right font-normal">まさ時間</th>
            <th className="px-3 py-2 text-right font-normal">まさ1時間あたり</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.planCycleId;
            const unallocated = Math.max(0, row.seasonBudgetYen - row.allocatedYen);
            return (
              <Fragment key={row.planCycleId}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-accent/40"
                  onClick={() => onToggle(row.planCycleId)}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{row.projectName}</span>
                      {row.cycleStatus === "active" ? (
                        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-400">
                          進行中
                        </span>
                      ) : null}
                      {row.warnings.demandOverBudget ? (
                        <span
                          className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                          title="ポイントの消化量がシーズン原資の1.5倍を超えている。マイルストーンの設定が原資に対して大きすぎる"
                        >
                          需要 {fmtRatio(row.demandBudgetRatio)}
                        </span>
                      ) : null}
                      {row.warnings.noRewardCalc ? (
                        <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          報酬計算まだ
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.projectId} · {fmtYm(row.periodStartYm)}〜{fmtYm(row.periodEndYm)}
                      {row.monthsUnconfirmed > 0 ? ` · 未確定${row.monthsUnconfirmed}ヶ月を含む見込み` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.estimatedRevenueYen)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtYen(row.seasonBudgetYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                    {fmtYen(row.externalPaidYen)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {fmtYen(row.retainedYen)}
                  </td>
                  <td className="px-3 py-2">
                    <AllocationBar row={row} />
                    {unallocated > 0 ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">未配分 {fmtYen(unallocated)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtPct(row.retentionRate)}</td>
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

export function AdminProjectProfitabilityClient() {
  const [rows, setRows] = useState<ProjectProfitabilityRow[] | null>(
    () => peekProjectProfitability()?.rows ?? null,
  );
  const [loading, setLoading] = useState(rows === null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    loadProjectProfitability()
      .then((payload) => setRows(payload.rows))
      .catch((err) => setError(err instanceof Error ? err.message : "PJ別利益構造を読み込めなかった"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">シーズン原資</span>
          ＝そのシーズンでメンバーに配ると決まっている総額（請求額から契約バッファを引いた65%）。
          月ごとの支払は<span className="font-medium text-foreground">いつ払うか</span>を決めているだけで、
          総額は最初から動かない。だからこの画面は月ではなくシーズンで通して見る。
        </p>
        <p className="mt-1.5">
          原資は
          <span className="font-medium text-amber-700 dark:text-amber-400">外部メンバーへの現金</span>と
          <span className="font-medium text-emerald-700 dark:text-emerald-400">会社に残る分</span>
          に分かれる。まさがポイントを多く取るほど外部へ配る額が減り、会社に残る。
          <span className="font-medium text-foreground">残る率が高いシーズンほど利益が出ている</span>。
        </p>
        <p className="mt-1.5">
          <span className="font-medium text-amber-700 dark:text-amber-400">需要 N×</span>
          ：ポイントの消化量が原資の1.5倍を超えている。マイルストーンの設定が原資に対して大きすぎる。
        </p>
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
            onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          />
          <p className="text-[11px] leading-4 text-muted-foreground">
            行をクリックすると、そのシーズンのメンバー別の内訳が開く。進行中のシーズンは未確定の月も見込みとして
            合算している。請求額は原資から逆算した推定値で、契約バッファ（旅費・営業費）のぶん実際より小さく出る。
          </p>
        </>
      )}
    </div>
  );
}
