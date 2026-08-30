"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CompanySeasonRow,
  IncompleteSeasonRow,
  PersonalFeeRow,
  ProjectProfitabilitySnapshot,
  UnfundedProjectRow,
} from "@/lib/project-profitability";
import {
  MASA_HOURLY_RATE_MAX_YEN,
  MASA_HOURLY_RATE_MIN_YEN,
} from "@/lib/project-profitability";
import { loadProjectProfitability, peekProjectProfitability } from "@/lib/project-profitability-client";

type Snapshot = Omit<ProjectProfitabilitySnapshot, "storedAt">;

// ---- 表示のかたち ----------------------------------------------------------

function fmtYen(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return "—";
  return `${n < 0 ? "−" : ""}¥${Math.abs(n).toLocaleString("ja-JP")}`;
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

/** "2025-08-31" → "25年8月" */
function fmtDateYm(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return `${date.slice(2, 4)}年${Number(date.slice(5, 7))}月`;
}

const RATE_STORAGE_KEY = "amd-os:project-profitability:masa-hourly-rate";

function profitClass(yen: number): string {
  return yen >= 0
    ? "text-emerald-700 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

// ---- 請求額の行き先バー -----------------------------------------------------

/**
 * 請求額を100として、実費・社外へ出た現金・まさの労働の対価・残った利益を1本で見せる。
 * 4つを足すと請求額になる。利益が赤字のときは赤で右へはみ出す。
 */
function BreakdownBar({
  bufferYen,
  externalYen,
  masaCostYen,
  profitYen,
}: {
  bufferYen: number;
  externalYen: number;
  masaCostYen: number;
  profitYen: number;
}) {
  const total = bufferYen + externalYen + masaCostYen + Math.max(0, profitYen);
  if (total <= 0) return <span className="text-muted-foreground">—</span>;
  const pct = (v: number) => `${Math.max(0, (v / total) * 100)}%`;
  return (
    <div className="flex h-2 w-full min-w-[110px] overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-slate-400/70" style={{ width: pct(bufferYen) }} title={`実費 ${fmtYen(bufferYen)}`} />
      <div
        className="h-full bg-amber-500/80"
        style={{ width: pct(externalYen) }}
        title={`社外へ現金 ${fmtYen(externalYen)}`}
      />
      <div
        className="h-full bg-sky-500/80"
        style={{ width: pct(masaCostYen) }}
        title={`まさの労働の対価 ${fmtYen(masaCostYen)}`}
      />
      <div
        className={`h-full ${profitYen >= 0 ? "bg-emerald-500/80" : "bg-red-500/80"}`}
        style={{ width: pct(Math.abs(profitYen)) }}
        title={`まさ込み利益 ${fmtYen(profitYen)}`}
      />
    </div>
  );
}

// ---- 1. 会社の売上があるシーズン ---------------------------------------------

type SortKey = "profit" | "perHour";

type ScoredSeason = CompanySeasonRow & {
  masaCostYen: number;
  profitYen: number;
  perHourYen: number | null;
};

function scoreSeason(row: CompanySeasonRow, rate: number): ScoredSeason {
  const masaCostYen = Math.round(row.masaHours * rate);
  const profitYen = row.companyCashLeftYen - masaCostYen;
  return {
    ...row,
    masaCostYen,
    profitYen,
    perHourYen: row.masaHours > 0 ? profitYen / row.masaHours : null,
  };
}

function CompanySeasonTable({ rows, sortKey }: { rows: ScoredSeason[]; sortKey: SortKey }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
        報酬計算が全月そろっているシーズンが無い。
      </p>
    );
  }
  const total = rows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenueYen,
      buffer: a.buffer + r.contractBufferYen,
      external: a.external + r.externalCashOutYen,
      cash: a.cash + r.companyCashLeftYen,
      hours: a.hours + r.masaHours,
      cost: a.cost + r.masaCostYen,
      profit: a.profit + r.profitYen,
    }),
    { revenue: 0, buffer: 0, external: 0, cash: 0, hours: 0, cost: 0, profit: 0 },
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[1180px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ / シーズン</th>
            <th className="px-3 py-2 text-right font-normal">
              請求額<span className="ml-0.5 text-[10px]">(推定)</span>
            </th>
            <th className="px-3 py-2 text-right font-normal">実費</th>
            <th className="px-3 py-2 text-right font-normal">社外へ現金</th>
            <th className="px-3 py-2 text-right font-normal">会社に残る現金</th>
            <th className="px-3 py-2 text-right font-normal">まさ時間</th>
            <th className="px-3 py-2 text-right font-normal">まさの労働の対価</th>
            <th className="px-3 py-2 text-right font-normal">まさ込み利益</th>
            <th className="px-3 py-2 text-right font-normal">まさ1時間あたり</th>
            <th className="px-3 py-2 text-left font-normal">請求額の行き先</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.planCycleId} className="border-t border-border hover:bg-accent/40">
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{row.projectName}</span>
                  {row.cycleStatus === "active" ? (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-400">
                      進行中
                    </span>
                  ) : null}
                  {row.extraPoolYen > 0 ? (
                    <span
                      className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400"
                      title={`本契約とは別の受託 ${fmtYen(Math.round(row.extraPoolYen / 0.65))} を含む`}
                    >
                      別契約あり
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.projectId} · {fmtYm(row.periodStartYm)}〜{fmtYm(row.periodEndYm)} · {row.months}ヶ月
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.revenueYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {row.contractBufferYen > 0 ? fmtYen(row.contractBufferYen) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                {row.externalCashOutYen > 0 ? fmtYen(row.externalCashOutYen) : "¥0"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.companyCashLeftYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(row.masaHours)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-sky-700 dark:text-sky-400">
                {fmtYen(row.masaCostYen)}
              </td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${profitClass(row.profitYen)}`}>
                {fmtYen(row.profitYen)}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums ${
                  sortKey === "perHour" ? `font-semibold ${profitClass(row.profitYen)}` : ""
                }`}
              >
                {row.perHourYen === null ? "—" : fmtYen(row.perHourYen)}
              </td>
              <td className="px-3 py-2">
                <BreakdownBar
                  bufferYen={row.contractBufferYen}
                  externalYen={row.externalCashOutYen}
                  masaCostYen={row.masaCostYen}
                  profitYen={row.profitYen}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/30 text-xs">
          <tr>
            <td className="px-3 py-2 font-medium">合計 {rows.length}シーズン</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtYen(total.revenue)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtYen(total.buffer)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
              {fmtYen(total.external)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtYen(total.cash)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtHours(total.hours)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-sky-700 dark:text-sky-400">{fmtYen(total.cost)}</td>
            <td className={`px-3 py-2 text-right font-semibold tabular-nums ${profitClass(total.profit)}`}>
              {fmtYen(total.profit)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {total.hours > 0 ? fmtYen(total.profit / total.hours) : "—"}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---- 2. まさ個人へ支払われるPJ -----------------------------------------------

function PersonalFeeTable({ rows, rate }: { rows: PersonalFeeRow[]; rate: number }) {
  if (rows.length === 0) return null;
  const scored = rows
    .map((r) => {
      const masaCostYen = Math.round(r.masaHours * rate);
      const profitYen = r.personalIncomeYen - masaCostYen;
      return { ...r, masaCostYen, profitYen };
    })
    .sort((a, b) => b.profitYen - a.profitYen);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ / 期間</th>
            <th className="px-3 py-2 text-right font-normal">月額</th>
            <th className="px-3 py-2 text-right font-normal">まさ個人への報酬</th>
            <th className="px-3 py-2 text-right font-normal">まさ時間</th>
            <th className="px-3 py-2 text-right font-normal">まさの労働の対価</th>
            <th className="px-3 py-2 text-right font-normal">差引</th>
            <th className="px-3 py-2 text-right font-normal">まさ1時間あたり</th>
          </tr>
        </thead>
        <tbody>
          {scored.map((row) => (
            <tr key={row.projectId} className="border-t border-border hover:bg-accent/40">
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{row.projectName}</span>
                  {row.ongoing ? (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-400">
                      継続中
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.projectId} · {fmtYm(row.startYm)}〜{fmtYm(row.endYm)} · {row.months}ヶ月分
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtYen(row.monthlyFeeYen)}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtYen(row.personalIncomeYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(row.masaHours)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-sky-700 dark:text-sky-400">
                {fmtYen(row.masaCostYen)}
              </td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${profitClass(row.profitYen)}`}>
                {fmtYen(row.profitYen)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.masaHours > 0 ? fmtYen(row.personalIncomeYen / row.masaHours) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- 3. 収入の記録が無いPJ ---------------------------------------------------

function UnfundedTable({ rows, rate }: { rows: UnfundedProjectRow[]; rate: number }) {
  if (rows.length === 0) return null;
  const totalHours = rows.reduce((s, r) => s + r.masaHours, 0);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ</th>
            <th className="px-3 py-2 text-right font-normal">まさ時間</th>
            <th className="px-3 py-2 text-right font-normal">まさの労働の対価</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.projectId} className="border-t border-border hover:bg-accent/40">
              <td className="px-3 py-2">
                <span className="font-medium">{row.projectName}</span>
                <span className="ml-1.5 text-[11px] text-muted-foreground">{row.projectId}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtHours(row.masaHours)}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                {fmtYen(-Math.round(row.masaHours * rate))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-border bg-muted/30 text-xs">
          <tr>
            <td className="px-3 py-2 font-medium">合計 {rows.length}件</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtHours(totalHours)}</td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
              {fmtYen(-Math.round(totalHours * rate))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---- 4. 報酬計算データがそろっていないシーズン --------------------------------

function IncompleteTable({ rows }: { rows: IncompleteSeasonRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-normal">PJ / シーズン</th>
            <th className="px-3 py-2 text-right font-normal">シーズンの月数</th>
            <th className="px-3 py-2 text-right font-normal">報酬計算ができている月</th>
            <th className="px-3 py-2 text-left font-normal">足りていないもの</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.planCycleId} className="border-t border-border">
              <td className="px-3 py-2">
                <span className="font-medium">{row.projectName}</span>
                <div className="text-[11px] text-muted-foreground">
                  {row.projectId} · {fmtYm(row.periodStartYm)}〜{fmtYm(row.periodEndYm)}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.months}ヶ月</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.hasSeasonPool ? `${row.monthsWithRewardCalc}ヶ月` : "—"}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {!row.hasSeasonPool
                  ? "シーズンの原資がOSに登録されていない"
                  : row.monthsWithRewardCalc === 0
                    ? "報酬計算が一度も動いていない"
                    : `${row.months - row.monthsWithRewardCalc}ヶ月分の報酬計算がOSに無い`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- 見出し ----------------------------------------------------------------

function SectionHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-[11px] text-muted-foreground">{note}</span>
    </div>
  );
}

// ---- root ------------------------------------------------------------------

export function AdminProjectProfitabilityClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => peekProjectProfitability()?.snapshot ?? null);
  const [loading, setLoading] = useState(snapshot === null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("profit");

  const load = useCallback(() => {
    setError(null);
    loadProjectProfitability()
      .then((payload) => setSnapshot(payload.snapshot))
      .catch((err) => setError(err instanceof Error ? err.message : "PJ別利益構造を読み込めなかった"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 既定はサーバが返す実績由来の単価。前回動かした値があればそれを復元する。
  useEffect(() => {
    if (rate !== null || !snapshot) return;
    let stored: number | null = null;
    try {
      const raw = window.localStorage.getItem(RATE_STORAGE_KEY);
      const parsed = raw === null ? NaN : Number(raw);
      if (Number.isFinite(parsed) && parsed >= MASA_HOURLY_RATE_MIN_YEN && parsed <= MASA_HOURLY_RATE_MAX_YEN) {
        stored = parsed;
      }
    } catch {
      stored = null;
    }
    setRate(stored ?? snapshot.defaultHourlyRateYen);
  }, [snapshot, rate]);

  const onRateChange = useCallback((next: number) => {
    setRate(next);
    try {
      window.localStorage.setItem(RATE_STORAGE_KEY, String(next));
    } catch {
      // 保存できなくても表示は成立する
    }
  }, []);

  const effectiveRate = rate ?? snapshot?.defaultHourlyRateYen ?? 0;

  const seasons = useMemo(() => {
    if (!snapshot) return [];
    const scored = snapshot.companySeasons.map((r) => scoreSeason(r, effectiveRate));
    return scored.sort((a, b) =>
      sortKey === "profit"
        ? b.profitYen - a.profitYen
        : (b.perHourYen ?? Number.NEGATIVE_INFINITY) - (a.perHourYen ?? Number.NEGATIVE_INFINITY),
    );
  }, [snapshot, effectiveRate, sortKey]);

  const grandTotal = useMemo(() => {
    if (!snapshot) return null;
    const seasonProfit = seasons.reduce((s, r) => s + r.profitYen, 0);
    const personalProfit = snapshot.personalFees.reduce(
      (s, r) => s + r.personalIncomeYen - Math.round(r.masaHours * effectiveRate),
      0,
    );
    const unfundedCost = snapshot.unfundedProjects.reduce(
      (s, r) => s + Math.round(r.masaHours * effectiveRate),
      0,
    );
    const hours =
      seasons.reduce((s, r) => s + r.masaHours, 0) +
      snapshot.personalFees.reduce((s, r) => s + r.masaHours, 0) +
      snapshot.unfundedProjects.reduce((s, r) => s + r.masaHours, 0);
    return { total: seasonProfit + personalProfit - unfundedCost, seasonProfit, personalProfit, unfundedCost, hours };
  }, [snapshot, seasons, effectiveRate]);

  return (
    <div className="space-y-5">
      {/* 読み方 */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">まさ込み利益</span>
          ＝ 会社に残る現金 −（まさの投下時間 × 時間単価）。
          現金が出ていかないだけの状態を利益と呼ばない。それはまさの労働の対価を会社へ付け替えているだけで、
          まさの時間は有限だから。
        </p>
        <p className="mt-1.5">
          請求額は
          <span className="font-medium text-slate-600 dark:text-slate-300">実費（旅費・営業費）</span>、
          <span className="font-medium text-amber-700 dark:text-amber-400">社外メンバーへの現金支払</span>、
          <span className="font-medium text-sky-700 dark:text-sky-400">まさの労働の対価</span>、
          <span className="font-medium text-emerald-700 dark:text-emerald-400">残った利益</span>
          の4つに分かれる。AMD運営費30%とクローザー報酬5%は会社に入る扱い（クローザーは全PJまさなので社外へ出ない）。
        </p>
        <p className="mt-1.5">
          この画面は
          <span className="font-medium text-foreground">まさ以外のメンバーの労働を引いていない</span>。
          りり・あき・きよへの配分は現金で出ていかないので、会社に残る現金の中に入ったままになる。
          その人たちの投下時間はOSに記録が無いため、時間で引くことができない。
        </p>
      </div>

      {/* 時間単価 */}
      <div className="rounded-lg border border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">まさの時間単価</span>
            <span className="text-lg font-semibold tabular-nums text-sky-700 dark:text-sky-400">
              {fmtYen(effectiveRate)}
            </span>
            <span className="text-xs text-muted-foreground">/ 時</span>
          </div>
          <input
            type="range"
            min={MASA_HOURLY_RATE_MIN_YEN}
            max={MASA_HOURLY_RATE_MAX_YEN}
            step={1000}
            value={effectiveRate}
            onChange={(e) => onRateChange(Number(e.target.value))}
            className="h-1.5 min-w-[220px] flex-1 cursor-pointer accent-sky-600"
            aria-label="まさの時間単価"
          />
          {snapshot && effectiveRate !== snapshot.defaultHourlyRateYen ? (
            <button
              type="button"
              onClick={() => onRateChange(snapshot.defaultHourlyRateYen)}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              既定へ戻す
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          既定の{snapshot ? fmtYen(snapshot.defaultHourlyRateYen) : "—"}
          は、OSがまさの労働へ実際に配賦している額を同じ期間のまさの投下時間で割った実績平均（25,514円/時）を丸めた値。
          PJごとに変えるとPJ間の比較に配分設計の差が混ざるので、全PJで同じ単価を使う。動かすと下の順位も変わる。
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {snapshot === null && loading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">読み込み中…</div>
      ) : snapshot === null ? null : (
        <>
          {/* 総合 */}
          {grandTotal ? (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
              {[
                { label: "全体のまさ込み利益", value: fmtYen(grandTotal.total), cls: profitClass(grandTotal.total) },
                { label: "会社の売上があるPJ", value: fmtYen(grandTotal.seasonProfit), cls: profitClass(grandTotal.seasonProfit) },
                { label: "まさ個人への報酬PJ", value: fmtYen(grandTotal.personalProfit), cls: profitClass(grandTotal.personalProfit) },
                { label: "収入の記録が無いPJ", value: fmtYen(-grandTotal.unfundedCost), cls: profitClass(-grandTotal.unfundedCost) },
              ].map((cell) => (
                <div key={cell.label} className="bg-background px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground">{cell.label}</div>
                  <div className={`mt-0.5 text-base font-semibold tabular-nums ${cell.cls}`}>{cell.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 1. 会社の売上があるシーズン */}
          <section>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <SectionHeading
                title="会社の売上があるPJ"
                note="報酬計算が全月そろっているシーズンだけ。金額の判断に使えるのはここ"
              />
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-muted-foreground">並び順</span>
                {(
                  [
                    { key: "profit" as const, label: "利益順" },
                    { key: "perHour" as const, label: "時給順" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSortKey(opt.key)}
                    className={`rounded border px-2 py-0.5 ${
                      sortKey === opt.key
                        ? "border-sky-600 bg-sky-500/10 font-medium text-sky-700 dark:text-sky-400"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <CompanySeasonTable rows={seasons} sortKey={sortKey} />
          </section>

          {/* 2. まさ個人への報酬 */}
          {snapshot.personalFees.length > 0 ? (
            <section>
              <SectionHeading
                title="まさ個人へ報酬が支払われるPJ"
                note="会社の売上ではなく、まさ個人へ直接振り込まれる分。期間はPJの開始月から数えている"
              />
              <PersonalFeeTable rows={snapshot.personalFees} rate={effectiveRate} />
            </section>
          ) : null}

          {/* 3. 収入の記録が無いPJ */}
          {snapshot.unfundedProjects.length > 0 ? (
            <section>
              <SectionHeading
                title="まさが時間を使っているのに、収入の記録がOSに無いPJ"
                note="請求も個人への報酬も登録されていない。まさの時間だけが出ている状態"
              />
              <UnfundedTable rows={snapshot.unfundedProjects} rate={effectiveRate} />
            </section>
          ) : null}

          {/* 4. 報酬計算がそろっていないシーズン */}
          {snapshot.incompleteSeasons.length > 0 ? (
            <section>
              <SectionHeading
                title="報酬計算のデータがそろっていないシーズン"
                note="OSで計算ができていないだけで、報酬の支払が済んでいないという意味ではない。金額は出さない"
              />
              <IncompleteTable rows={snapshot.incompleteSeasons} />
            </section>
          ) : null}

          <p className="text-[11px] leading-4 text-muted-foreground">
            まさの投下時間はtally（まさ専用の週次記録）から読んでいる。
            {snapshot.masaHoursRecordedFrom
              ? `記録があるのは${fmtDateYm(snapshot.masaHoursRecordedFrom)}以降なので、それより前の稼働は0時間として出る。`
              : ""}
            請求額はシーズン原資からの逆算で、月額固定のPJでは契約書の月額×月数と一致することを確認している。
            期末の未払残を検算したいときは <span className="font-medium">/admin/season-pl</span> を見る。
          </p>
        </>
      )}
    </div>
  );
}
