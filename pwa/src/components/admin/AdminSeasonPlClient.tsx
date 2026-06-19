"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  SeasonPl,
  SeasonPlListRow,
  SeasonPlMember,
} from "@/lib/season-pl";

// ---- formatters ----------------------------------------------------------

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

function fmtPt(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 100) / 100).toLocaleString("ja-JP");
}

function fmtYm(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4, 6)}`;
}

// ---- check badge ---------------------------------------------------------

function CheckBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium " +
        (ok
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/15 text-red-600 dark:text-red-400")
      }
      title={label}
    >
      <span>{ok ? "✓" : "✗"}</span>
      {label}
    </span>
  );
}

// ---- list ---------------------------------------------------------------

function SeasonPlList({
  rows,
  onSelect,
  loading,
}: {
  rows: SeasonPlListRow[];
  onSelect: (planCycleId: string) => void;
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">active な plan cycle がない。</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">PJ / シーズン</th>
            <th className="px-3 py-2 text-right">請求額</th>
            <th className="px-3 py-2 text-right">バッファ</th>
            <th className="px-3 py-2 text-right">原資</th>
            <th className="px-3 py-2 text-right">pt単価</th>
            <th className="px-3 py-2 text-center">閉じ</th>
            <th className="px-3 py-2 text-center">未割当pt</th>
            <th className="px-3 py-2 text-center">原資=Σcap</th>
            <th className="px-3 py-2 text-center">役員収束</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.planCycleId}
              className={
                "border-t border-border cursor-pointer hover:bg-accent/40 " +
                (row.hasWarning ? "bg-red-500/[0.04]" : "")
              }
              onClick={() => onSelect(row.planCycleId)}
            >
              <td className="px-3 py-2">
                <div className="font-medium">{row.projectName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtYm(row.periodStartYm)}–{fmtYm(row.periodEndYm)} · {row.totalPoints}pt · {row.status}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.invoiceTotalYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.bufferTotalYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.memberBudgetYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtYen(row.ptUnitYen)}</td>
              <td className="px-3 py-2 text-center">{row.closes ? "✓" : <span className="text-red-500 font-bold">✗</span>}</td>
              <td className="px-3 py-2 text-center">
                {row.ptFullyAssigned ? "✓" : <span className="text-red-500 font-bold" title="未割当pt">{fmtPt(row.unassignedPt)}pt</span>}
              </td>
              <td className="px-3 py-2 text-center">
                {row.budgetMatchesMonthlyCaps ? "✓" : <span className="text-red-500 font-bold" title="原資≠Σ月cap">{fmtSignedYen(row.budgetVsMonthlyCapsDeltaYen)}</span>}
              </td>
              <td className="px-3 py-2 text-center">{row.officerStockConverges ? "✓" : <span className="text-red-500 font-bold" title="役員stock非収束">✗</span>}</td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground">詳細 →</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- detail -------------------------------------------------------------

function Row({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <div className="text-sm text-muted-foreground">
        {label}
        {sub ? <span className="ml-2 text-[11px] opacity-70">{sub}</span> : null}
      </div>
      <div className={"tabular-nums " + (strong ? "text-base font-semibold" : "text-sm")}>{value}</div>
    </div>
  );
}

function MemberRow({ m }: { m: SeasonPlMember }) {
  const converged = Math.abs(m.convergenceDeltaYen) <= 5;
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <Link
          href={`/mypage?memberId=${encodeURIComponent(m.memberId)}`}
          className="font-medium hover:underline"
        >
          {m.memberName}
        </Link>
        {m.isOfficer ? <span className="ml-1.5 text-[10px] rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5">役員=会社留保</span> : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtPt(m.earnedPt)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtYen(m.budgetShareYen)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtYen(m.paidYen)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtYen(m.finalStockYen)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <span className={converged ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 font-semibold"}>
          {fmtSignedYen(m.convergenceDeltaYen)}
        </span>
      </td>
    </tr>
  );
}

function SeasonPlDetail({ pl, onBack }: { pl: SeasonPl; onBack: () => void }) {
  const c = pl.checks;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
            ← 一覧へ戻る
          </button>
          <h2 className="text-base font-semibold mt-1">
            {pl.projectName} <span className="text-sm font-normal text-muted-foreground">{pl.clientName}</span>
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {pl.planCycleId} · {fmtYm(pl.periodStartYm)}–{fmtYm(pl.periodEndYm)} ({pl.cycleMonths}ヶ月) · {pl.status}
          </p>
        </div>
      </div>

      {/* 検算サマリ */}
      <div className="flex flex-wrap gap-2">
        <CheckBadge ok={c.closes} label={`閉じ検算${c.closes ? "" : ` (差${fmtSignedYen(c.closeDeltaYen)})`}`} />
        <CheckBadge
          ok={c.ptFullyAssigned}
          label={`未割当pt${c.ptFullyAssigned ? "" : ` ${fmtPt(c.unassignedPt)}pt${c.unownedMilestones.length > 0 ? ` +担当無${c.unownedMilestones.length}` : ""}`}`}
        />
        <CheckBadge ok={c.budgetMatchesMonthlyCaps} label={`原資=Σ月cap${c.budgetMatchesMonthlyCaps ? "" : ` (差${fmtSignedYen(c.budgetVsMonthlyCapsDeltaYen)})`}`} />
        <CheckBadge ok={c.ptUnitConsistent} label={`pt単価${c.ptUnitConsistent ? "" : ` (期待${fmtYen(c.ptUnitExpected)})`}`} />
        <CheckBadge ok={c.officerStockConverges} label={`役員stock収束${c.officerStockConverges ? "" : ` (残${fmtYen(c.officerFinalStockYen)})`}`} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* ① 収入 */}
        <section className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold mb-2">① 収入 (税抜・シーズン合計)</h3>
          <Row label="請求額 (予算)" value={fmtYen(pl.invoiceTotalYen)} strong />
          <Row label="入金確認済み (実績)" value={fmtYen(pl.invoiceConfirmedYen)} />
        </section>

        {/* ② 配分 */}
        <section className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold mb-2">② 配分 (請求額の内訳)</h3>
          {pl.bufferItems.length > 0 ? (
            pl.bufferItems.map((item, i) => (
              <Row key={i} label={`バッファ: ${item.label}`} value={fmtYen(item.amount)} />
            ))
          ) : (
            <Row
              label="バッファ (内訳未設定)"
              value={fmtYen(pl.bufferTotalYen)}
              sub="原資から逆算"
            />
          )}
          {pl.bufferItems.length > 0 ? (
            <Row label="バッファ 合計" value={fmtYen(pl.bufferTotalYen)} sub={pl.bufferBreakdownSet ? "" : "逆算"} />
          ) : null}
          <Row label="メンバー原資 (= PJ予算)" value={fmtYen(pl.memberBudgetYen)} strong sub="(請求−バッファ)×65%" />
          <Row label="AMD マージン (35%)" value={fmtYen(pl.amdMarginYen)} />
          <div className="mt-2 pt-2 border-t border-border">
            <Row
              label="合計 (バッファ+原資+マージン)"
              value={fmtYen(pl.bufferTotalYen + pl.memberBudgetYen + pl.amdMarginYen)}
              strong
              sub={c.closes ? "= 請求額 ✓" : `≠ 請求額 (差 ${fmtSignedYen(c.closeDeltaYen)})`}
            />
          </div>
        </section>
      </div>

      {/* pt メタ */}
      <section className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold mb-2">pt 単価 / 消化</h3>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
          <Row label="総pt (pt単価分母)" value={`${fmtPt(pl.totalPoints)}pt`} />
          <Row label="MS points 合計" value={`${fmtPt(pl.msPointsSum)}pt`} sub={c.ptFullyAssigned ? "" : `未割当 ${fmtPt(c.unassignedPt)}pt`} />
          <Row label="消化pt合計 (累計)" value={`${fmtPt(pl.earnedPtSum)}pt`} />
          <Row label="pt単価" value={fmtYen(pl.ptUnitYen)} sub="原資÷総pt" />
          <Row label="pt単価 期待値" value={fmtYen(c.ptUnitExpected)} sub={c.ptUnitConsistent ? "一致" : "過大/過小"} />
          <Row label="Σ月cap (billing)" value={fmtYen(pl.monthlyCapsSumYen)} />
          <Row label="原資 − Σ月cap" value={fmtSignedYen(pl.checks.budgetVsMonthlyCapsDeltaYen)} sub={c.budgetMatchesMonthlyCaps ? "整合" : "ZMP歪み"} />
        </div>
        {c.unownedMilestones.length > 0 ? (
          <p className="mt-2 text-[11px] text-red-500">
            担当者未設定で pt が宙吊りの MS: {c.unownedMilestones.join(", ")}
          </p>
        ) : null}
      </section>

      {/* ③ メンバー別 pt 比予実 */}
      <section className="rounded-lg border border-border">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-sm font-semibold">③ メンバー別 (pt比 予算 vs 実績)</h3>
          <p className="text-[11px] text-muted-foreground">
            予算取り分 = 獲得pt × pt単価。差 = (実支払 + 未払い残) − 予算取り分。最終的に 0 が正 (= pt比に収束)。
            役員は「会社留保」、非役員は「現金支払」。
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">メンバー</th>
                <th className="px-3 py-2 text-right">獲得pt</th>
                <th className="px-3 py-2 text-right">予算取り分</th>
                <th className="px-3 py-2 text-right">実支払 累計</th>
                <th className="px-3 py-2 text-right">最終 未払い残</th>
                <th className="px-3 py-2 text-right">差 (収束)</th>
              </tr>
            </thead>
            <tbody>
              {pl.members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground text-xs">
                    メンバー報酬データなし (MS進捗 / 担当比率 未設定)
                  </td>
                </tr>
              ) : (
                pl.members.map((m) => <MemberRow key={m.memberId} m={m} />)
              )}
            </tbody>
            {pl.members.length > 0 ? (
              <tfoot className="border-t-2 border-border text-xs font-medium">
                <tr>
                  <td className="px-3 py-2">合計</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPt(pl.earnedPtSum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(pl.members.reduce((s, m) => s + m.budgetShareYen, 0))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(pl.paidSumYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtYen(pl.finalStockSumYen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtSignedYen(pl.members.reduce((s, m) => s + m.convergenceDeltaYen, 0))}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}

// ---- root ---------------------------------------------------------------

export function AdminSeasonPlClient() {
  const [rows, setRows] = useState<SeasonPlListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState<SeasonPl | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/season-pl", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setRows(json.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "一覧を読み込めなかった");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (planCycleId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/season-pl?planCycleId=${encodeURIComponent(planCycleId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDetail(json.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "詳細を読み込めなかった");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {detail ? (
        detailLoading ? (
          <p className="text-sm text-muted-foreground">読み込み中…</p>
        ) : (
          <SeasonPlDetail pl={detail} onBack={() => setDetail(null)} />
        )
      ) : detailLoading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <SeasonPlList rows={rows} loading={listLoading} onSelect={loadDetail} />
      )}
    </div>
  );
}
