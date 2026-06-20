"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MsOverviewPlanCycle,
  MsOverviewMilestone,
  MsOverviewMemberYearTotal,
} from "@/lib/admin/ms-overview-types";

// ---- バー色 (2026-06-20 ZMP MS設計再考セッションの widget から踏襲) -------
const BAR_NORMAL = "#1D9E75";
const BAR_ROUTINE = "#888780";
const BAR_CAP_EXTRA = "#7F77DD";

// メンバー年計バー: 本契約 (regular) は濃、別財布 (extra) は淡
const MEMBER_BAR_REGULAR = "#1D9E75";
const MEMBER_BAR_EXTRA = "#7F77DD";

function fmtYen(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  if (!Number.isFinite(v)) return "¥0";
  return `¥${v.toLocaleString("ja-JP")}`;
}

function fmtPt(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return (Math.round(v * 100) / 100).toLocaleString("ja-JP");
}

function fmtShare(n: number): string {
  return `${(Math.round(n * 1000) / 10).toLocaleString("ja-JP")}%`;
}

function fmtYm(ym: string | null | undefined): string {
  if (!ym || !/^\d{6}$/.test(ym)) return ym ?? "";
  return `${ym.slice(0, 4)}/${ym.slice(4, 6)}`;
}

function barColorForTag(tag: string, isCapExtra: boolean): string {
  if (isCapExtra) return BAR_CAP_EXTRA;
  const t = String(tag || "").toLowerCase();
  if (t === "routine") return BAR_ROUTINE;
  return BAR_NORMAL;
}

// ---- メトリクスカード -----------------------------------------------------

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

// ---- MS 行 (横バー付き) --------------------------------------------------

function MsRow({ ms, maxPtValue }: { ms: MsOverviewMilestone; maxPtValue: number }) {
  const widthPct = maxPtValue > 0 ? Math.max(2, Math.round((ms.ptValueYen / maxPtValue) * 100)) : 0;
  const color = barColorForTag(ms.tag, ms.isCapExtra);
  const period = ms.periodStartYm || ms.targetYm
    ? `${fmtYm(ms.periodStartYm)}${ms.targetYm ? `–${fmtYm(ms.targetYm)}` : ""}`
    : "";
  return (
    <div className="grid grid-cols-[1fr_72px_110px_1fr_180px] gap-3 items-center py-1.5 border-t border-border/60">
      <div className="min-w-0">
        <div className="text-sm truncate" title={ms.title}>{ms.title}</div>
        <div className="text-[10px] text-muted-foreground">
          {period}
          {period && ms.tag ? " · " : ""}
          <span style={{ color }}>{ms.isCapExtra ? "cap_extra" : ms.tag}</span>
        </div>
      </div>
      <div className="text-right text-sm tabular-nums">{fmtPt(ms.points)}pt</div>
      <div className="text-right text-sm tabular-nums">{fmtYen(ms.ptValueYen)}</div>
      <div>
        <div
          className="h-3 rounded-sm"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
          title={`${fmtYen(ms.ptValueYen)} (${widthPct}%)`}
        />
      </div>
      <div className="text-[11px] text-muted-foreground truncate" title={ms.responsibilities.map((r) => `${r.codeName} ${fmtShare(r.share)}`).join(" / ")}>
        {ms.responsibilities.length === 0
          ? <span className="text-red-500">担当未設定</span>
          : ms.responsibilities.map((r) => `${r.codeName} ${fmtShare(r.share)}`).join(" / ")}
      </div>
    </div>
  );
}

// ---- メンバー年計バー ------------------------------------------------------

function MemberYearRow({
  member,
  maxTotal,
}: {
  member: MsOverviewMemberYearTotal;
  maxTotal: number;
}) {
  const regWidth = maxTotal > 0 ? (member.regularYen / maxTotal) * 100 : 0;
  const extWidth = maxTotal > 0 ? (member.extraYen / maxTotal) * 100 : 0;
  return (
    <div className="grid grid-cols-[80px_1fr_140px] gap-3 items-center py-1">
      <div className="text-sm truncate">{member.codeName}</div>
      <div className="flex h-3 rounded-sm overflow-hidden bg-muted/30">
        {regWidth > 0 && (
          <div
            style={{ width: `${regWidth}%`, backgroundColor: MEMBER_BAR_REGULAR }}
            title={`本契約 ${fmtYen(member.regularYen)}`}
          />
        )}
        {extWidth > 0 && (
          <div
            style={{ width: `${extWidth}%`, backgroundColor: MEMBER_BAR_EXTRA, opacity: 0.65 }}
            title={`別財布 ${fmtYen(member.extraYen)}`}
          />
        )}
      </div>
      <div className="text-right text-sm tabular-nums">
        {fmtYen(member.totalYen)}
        {member.extraYen > 0 && (
          <span className="text-[10px] text-muted-foreground ml-1">
            (本{fmtYen(member.regularYen)} 別{fmtYen(member.extraYen)})
          </span>
        )}
      </div>
    </div>
  );
}

// ---- 1 PJ ブロック ---------------------------------------------------------

function PlanCycleBlock({ cycle, openByDefault }: { cycle: MsOverviewPlanCycle; openByDefault: boolean }) {
  const [open, setOpen] = useState<boolean>(openByDefault);

  const topMember = cycle.memberYearTotals[0];
  const secondMember = cycle.memberYearTotals[1];
  const maxPtValue = useMemo(
    () => cycle.milestones.reduce((max, ms) => Math.max(max, ms.ptValueYen), 0),
    [cycle.milestones],
  );
  const maxMemberTotal = useMemo(
    () => cycle.memberYearTotals.reduce((max, m) => Math.max(max, m.totalYen), 0),
    [cycle.memberYearTotals],
  );

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/30"
      >
        <span className="text-xs text-muted-foreground tabular-nums">{open ? "▾" : "▸"}</span>
        <span className="font-semibold">{cycle.projectName}</span>
        <span className="text-xs text-muted-foreground">
          {fmtYm(cycle.periodStartYm)}–{fmtYm(cycle.periodEndYm)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          原資 {fmtYen(cycle.budgetYen)} / total {fmtPt(cycle.totalPoints)}pt / 単価 {fmtYen(cycle.regularPtUnitYen)}
          {cycle.extraPtUnitYen > 0 && (
            <span className="text-[#7F77DD] ml-2">別 {fmtYen(cycle.extraPtUnitYen)}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* ① メトリクスカード 4 枚 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard
              label="合計pt"
              value={`${fmtPt(cycle.totalPoints)}pt`}
              sub={`本契約 ${fmtPt(cycle.regularPoints)} / 別財布 ${fmtPt(cycle.extraPoints)}`}
            />
            <MetricCard
              label="本契約 pt単価"
              value={fmtYen(cycle.regularPtUnitYen)}
              sub={`原資 ${fmtYen(cycle.budgetYen)} ÷ ${fmtPt(cycle.regularPoints)}pt`}
            />
            <MetricCard
              label="別財布 pt単価"
              value={cycle.extraPtUnitYen > 0 ? fmtYen(cycle.extraPtUnitYen) : "—"}
              sub={
                cycle.extraPtUnitYen > 0
                  ? `${fmtYen(cycle.extraPoolBudgetYen)} ÷ ${fmtPt(cycle.extraPoints)}pt`
                  : "別財布 MS なし"
              }
            />
            <MetricCard
              label={
                topMember && secondMember
                  ? `主要メンバー: ${topMember.codeName} vs ${secondMember.codeName}`
                  : "主要メンバー"
              }
              value={
                topMember && secondMember
                  ? `${fmtYen(topMember.totalYen)} : ${fmtYen(secondMember.totalYen)}`
                  : topMember
                    ? `${topMember.codeName} ${fmtYen(topMember.totalYen)}`
                    : "—"
              }
              sub={
                topMember && secondMember && secondMember.totalYen > 0
                  ? `比 ${(topMember.totalYen / secondMember.totalYen).toFixed(2)}x`
                  : undefined
              }
            />
          </div>

          {/* ② 全MS (pt順) */}
          <div>
            <h3 className="text-sm font-semibold mb-1">全MS (pt順)</h3>
            {cycle.milestones.length === 0 ? (
              <p className="text-xs text-muted-foreground">MS が登録されていない。</p>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_72px_110px_1fr_180px] gap-3 text-[10px] text-muted-foreground uppercase tracking-wider pb-1">
                  <div>MS名 / 期間 / tag</div>
                  <div className="text-right">pt</div>
                  <div className="text-right">pt価値</div>
                  <div>原資比</div>
                  <div>担当share</div>
                </div>
                {cycle.milestones.map((ms) => (
                  <MsRow key={ms.milestoneId} ms={ms} maxPtValue={maxPtValue} />
                ))}
              </div>
            )}
          </div>

          {/* ③ メンバー別 年計 */}
          <div>
            <h3 className="text-sm font-semibold mb-1">メンバー別 年計 (plannedShare 理論値)</h3>
            {cycle.memberYearTotals.length === 0 ? (
              <p className="text-xs text-muted-foreground">担当が割り当てられていない。</p>
            ) : (
              <div>
                {cycle.memberYearTotals.map((m) => (
                  <MemberYearRow key={m.memberId} member={m} maxTotal={maxMemberTotal} />
                ))}
              </div>
            )}
          </div>

          {/* ④ tag 凡例 */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
            <span>凡例:</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_NORMAL }} />
              normal (本契約)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_ROUTINE }} />
              routine
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BAR_CAP_EXTRA }} />
              cap_extra (別財布)
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

// ---- ルート --------------------------------------------------------------

export function AdminMsOverviewClient() {
  const [cycles, setCycles] = useState<MsOverviewPlanCycle[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch("/api/admin/ms-overview", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (aborted) return;
        if (!body?.ok) {
          setError(body?.error || "load failed");
          return;
        }
        setCycles(body.planCycles as MsOverviewPlanCycle[]);
      })
      .catch((err) => {
        if (!aborted) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      aborted = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-500">読み込みに失敗: {error}</p>;
  }
  if (cycles === null) {
    return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (cycles.length === 0) {
    return <p className="text-sm text-muted-foreground">active な plan cycle がない。</p>;
  }

  return (
    <div className="space-y-3" data-testid="admin-ms-overview-root">
      {cycles.map((cycle, idx) => (
        <PlanCycleBlock
          key={cycle.planCycleId}
          cycle={cycle}
          openByDefault={idx === 0}
        />
      ))}
    </div>
  );
}
