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
  if (!Number.isFinite(n) || n === 0) return "¥0";
  return `¥${n.toLocaleString("ja-JP")}`;
}

function fmtSignedYen(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "¥0";
  return n < 0 ? `-¥${Math.abs(n).toLocaleString("ja-JP")}` : `+¥${n.toLocaleString("ja-JP")}`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function fmtRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}×`;
}

function fmtHours(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "0h";
  return `${(Math.round(n * 10) / 10).toLocaleString("ja-JP")}h`;
}

// ---- warning badges ---------------------------------------------------------

function WarningBadge({ tone, children, title }: { tone: "red" | "amber"; children: React.ReactNode; title?: string }) {
  const cls =
    tone === "red"
      ? "bg-red-500/15 text-red-600 dark:text-red-400"
      : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`} title={title}>
      {children}
    </span>
  );
}

// ---- member detail ---------------------------------------------------------

function MemberDetailTable({ row }: { row: ProjectProfitabilityRow }) {
  if (row.members.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">この期間の報酬データがない。</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[11px] text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left">メンバー</th>
            <th className="px-3 py-1.5 text-right">稼働需要額</th>
            <th className="px-3 py-1.5 text-right">実支払額</th>
            <th className="px-3 py-1.5 text-right">差額</th>
          </tr>
        </thead>
        <tbody>
          {row.members.map((m) => (
            <tr key={m.memberId} className="border-t border-border/60">
              <td className="px-3 py-1.5 font-medium">
                {m.memberName}
                {m.memberId === "ID001" ? (
                  <span className="ml-1.5 rounded bg-sky-500/15 px-1 py-0.5 text-[10px] text-sky-600 dark:text-sky-400">まさ</span>
                ) : null}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtYen(m.grossDueYen)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtYen(m.paidYen)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                <span className={m.deltaYen > 0 ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                  {fmtSignedYen(m.deltaYen)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- list --------------------------------------------------------------

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
    return <p className="text-sm text-muted-foreground">この年に billing_cycles が無い。</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">PJ</th>
            <th className="px-3 py-2 text-right">売上</th>
            <th className="px-3 py-2 text-right">外部支払</th>
            <th className="px-3 py-2 text-right">会社・役員留保</th>
            <th className="px-3 py-2 text-right">稼働需要総額</th>
            <th className="px-3 py-2 text-right">粗利率</th>
            <th className="px-3 py-2 text-right">需要/枠</th>
            <th className="px-3 py-2 text-right">まさ投下時間</th>
            <th className="px-3 py-2 text-right">まさ時間あたり売上</th>
            <th className="px-3 py-2 text-left">警報</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.projectId;
            const hasWarning = row.warnings.payoutGap || row.warnings.capOverage;
            return (
              <Fragment key={row.projectId}>
                <tr
                  className={
                    "border-t border-border cursor-pointer hover:bg-accent/40 " +
                    (row.warnings.payoutGap ? "bg-red-500/[0.05]" : hasWarning ? "bg-amber-500/[0.05]" : "")
                  }
                  onClick={() => onToggle(row.projectId)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.projectName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.projectId} · 実績{row.monthsActual}ヶ月
                      {row.monthsPlanned > 0 ? ` / 計画${row.monthsPlanned}ヶ月` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.billedYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.externalPaidYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.officerReserveYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.grossDueYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPct(row.grossMarginRate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={row.warnings.capOverage ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                      {fmtRatio(row.demandCapRatio)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtHours(row.masaHours)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.revenuePerMasaHour)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.warnings.payoutGap ? (
                        <WarningBadge tone="red" title="まさが自分の配分を放棄してメンバー分を捻出している月が続いている">
                          持ち出し {row.warnings.payoutGapMonths}ヶ月
                        </WarningBadge>
                      ) : null}
                      {row.warnings.capOverage ? (
                        <WarningBadge tone="amber" title="配分できる枠に対して稼働の需要が大きすぎる">
                          枠超過
                        </WarningBadge>
                      ) : null}
                      {!hasWarning ? <span className="text-[11px] text-muted-foreground">—</span> : null}
                    </div>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={10} className="p-0">
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

// ---- root ----------------------------------------------------------------

function currentYear(): number {
  return new Date().getFullYear();
}

export function AdminProjectProfitabilityClient() {
  const years = useMemo(() => {
    const y = currentYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);
  const [year, setYear] = useState<number>(currentYear());
  const [rows, setRows] = useState<ProjectProfitabilityRow[] | null>(() => peekProjectProfitability(currentYear())?.rows ?? null);
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
      .then((payload) => {
        setRows(payload.rows);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "PJ別利益構造を読み込めなかった");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 年切替時に前年の展開行を残さないための同期リセット
    setExpandedId(null);
    load(year);
  }, [year, load]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-semibold text-red-600 dark:text-red-400">持ち出し警報</span>
          ：まさが本来受け取るはずの分を3ヶ月以上ゼロにして、そのぶんを他のメンバーの支払に回している状態。
        </p>
        <p>
          <span className="font-semibold text-amber-600 dark:text-amber-400">枠超過警報</span>
          ：売上から確保できる配分枠に対して、実際に発生している稼働の請求可能額が1.5倍を超えている状態。
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
              (year === y ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
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
        <ProfitabilityTable
          rows={rows ?? []}
          expandedId={expandedId}
          onToggle={(projectId) => setExpandedId((prev) => (prev === projectId ? null : projectId))}
        />
      )}
    </div>
  );
}
