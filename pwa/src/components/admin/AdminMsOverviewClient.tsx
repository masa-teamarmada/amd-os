"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MsOverviewPlanCycle,
  MsOverviewMilestone,
  MsOverviewMemberYearTotal,
} from "@/lib/admin/ms-overview-types";
import {
  recomputeMsOverview,
  sliderRange,
  toEditableMilestones,
  type EditableMilestoneInput,
} from "@/lib/admin/ms-overview-calc";

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

// ---- MS 行 (横バー: 閲覧モード) ------------------------------------------

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

// ---- MS 行 (スライダー: 編集モード) --------------------------------------

function MsSliderRow({
  ms,
  current,
  ptValueYen,
  onChange,
}: {
  ms: MsOverviewMilestone;
  current: EditableMilestoneInput;
  ptValueYen: number;
  onChange: (next: number) => void;
}) {
  const color = barColorForTag(ms.tag, ms.isCapExtra);
  const { min, max } = sliderRange(ms.points);
  const period = ms.periodStartYm || ms.targetYm
    ? `${fmtYm(ms.periodStartYm)}${ms.targetYm ? `–${fmtYm(ms.targetYm)}` : ""}`
    : "";
  const shareText = ms.responsibilities.length === 0
    ? "担当未設定"
    : ms.responsibilities.map((r) => `${r.codeName} ${fmtShare(r.share)}`).join(" / ");
  const changed = Math.round(current.points * 100) !== Math.round(ms.points * 100);
  return (
    <div
      className="rounded-md border bg-card/60 px-3 py-2 mb-1.5"
      style={{ borderColor: "var(--border, #2a2a2a)", borderWidth: "0.5px" }}
    >
      <div className="flex items-baseline justify-between gap-2.5 mb-1">
        <span className="font-medium text-[13px] truncate" title={ms.title}>
          {ms.title}
          {period && <span className="text-[10px] text-muted-foreground ml-2">{period}</span>}
        </span>
        <span className="text-[11px] text-muted-foreground truncate ml-2" title={shareText}>
          {ms.responsibilities.length === 0
            ? <span className="text-red-500">担当未設定</span>
            : shareText}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block flex-shrink-0"
          style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }}
          aria-hidden
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.round(current.points)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 h-8 cursor-pointer"
          style={{ accentColor: color, minHeight: 32 }}
          aria-label={`${ms.title} のpt`}
        />
        <span
          className={`text-[13px] font-medium tabular-nums min-w-[40px] text-right ${changed ? "text-amber-500" : ""}`}
        >
          {fmtPt(current.points)}pt
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums min-w-[80px] text-right">
          {fmtYen(ptValueYen)}
        </span>
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

type SaveStatus = "idle" | "saving" | "error" | "success";

function PlanCycleBlock({
  cycle,
  openByDefault,
  onSaved,
}: {
  cycle: MsOverviewPlanCycle;
  openByDefault: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState<boolean>(openByDefault);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<EditableMilestoneInput[]>(() => toEditableMilestones(cycle));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // 元データが差し替わったら (= 保存後の再fetch) 編集状態を巻き戻す
  useEffect(() => {
    setEditing(toEditableMilestones(cycle));
    setSaveStatus("idle");
    setSaveError(null);
  }, [cycle]);

  // ---- リアルタイム再計算 -------------------------------------------------
  const recomputed = useMemo(() => {
    return recomputeMsOverview({
      budgetYen: cycle.budgetYen,
      extraPoolBudgetYen: cycle.extraPoolBudgetYen,
      milestones: editing,
    });
  }, [cycle.budgetYen, cycle.extraPoolBudgetYen, editing]);

  // 表示用 (= 編集モードなら recomputed、閲覧モードなら cycle の値) -----
  const displayTotalPoints = editMode ? recomputed.totalPoints : cycle.totalPoints;
  const displayRegularPoints = editMode ? recomputed.regularPoints : cycle.regularPoints;
  const displayExtraPoints = editMode ? recomputed.extraPoints : cycle.extraPoints;
  const displayRegularUnit = editMode ? recomputed.regularPtUnitYen : cycle.regularPtUnitYen;
  const displayExtraUnit = editMode ? recomputed.extraPtUnitYen : cycle.extraPtUnitYen;
  const displayMemberTotals = editMode ? recomputed.memberYearTotals : cycle.memberYearTotals;

  const topMember = displayMemberTotals[0];
  const secondMember = displayMemberTotals[1];

  const maxPtValue = useMemo(() => {
    if (editMode) {
      let max = 0;
      for (const v of recomputed.ptValueYenByMs.values()) if (v > max) max = v;
      return max;
    }
    return cycle.milestones.reduce((max, ms) => Math.max(max, ms.ptValueYen), 0);
  }, [editMode, recomputed.ptValueYenByMs, cycle.milestones]);

  const maxMemberTotal = useMemo(
    () => displayMemberTotals.reduce((max, m) => Math.max(max, m.totalYen), 0),
    [displayMemberTotals],
  );

  // 元の MS 並びを keep するため、editing は milestoneId 引きの map を作る
  const editingByMs = useMemo(() => {
    const m = new Map<string, EditableMilestoneInput>();
    for (const e of editing) m.set(e.milestoneId, e);
    return m;
  }, [editing]);

  const isDirty = useMemo(() => {
    for (const ms of cycle.milestones) {
      const cur = editingByMs.get(ms.milestoneId);
      if (!cur) continue;
      if (Math.round(cur.points * 100) !== Math.round(ms.points * 100)) return true;
    }
    return false;
  }, [cycle.milestones, editingByMs]);

  const handleSliderChange = useCallback((milestoneId: string, next: number) => {
    setEditing((prev) =>
      prev.map((row) => (row.milestoneId === milestoneId ? { ...row, points: next } : row)),
    );
  }, []);

  const handleResetToDb = useCallback(() => {
    setEditing(toEditableMilestones(cycle));
  }, [cycle]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const payload = {
        milestones: editing
          .filter((row) => {
            const orig = cycle.milestones.find((m) => m.milestoneId === row.milestoneId);
            if (!orig) return false;
            return Math.round(row.points * 100) !== Math.round(orig.points * 100);
          })
          .map((row) => ({ milestoneId: row.milestoneId, points: Math.round(row.points) })),
      };
      if (payload.milestones.length === 0) {
        setSaveStatus("idle");
        setEditMode(false);
        return;
      }
      const res = await fetch(`/api/admin/ms-overview/${encodeURIComponent(cycle.planCycleId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        setSaveStatus("error");
        setSaveError(body?.error || `HTTP ${res.status}`);
        return;
      }
      setSaveStatus("success");
      setEditMode(false);
      onSaved();
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [cycle, editing, onSaved]);

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
          原資 {fmtYen(cycle.budgetYen)} / total {fmtPt(displayTotalPoints)}pt / 単価 {fmtYen(displayRegularUnit)}
          {displayExtraUnit > 0 && (
            <span className="text-[#7F77DD] ml-2">別 {fmtYen(displayExtraUnit)}</span>
          )}
          {editMode && isDirty && (
            <span className="text-amber-500 ml-2">●未保存</span>
          )}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* 編集モードトグル */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={
                "text-xs px-2.5 py-1 rounded border transition-colors " +
                (editMode
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/30")
              }
            >
              {editMode ? "✏ 編集モード ON" : "✏ 編集モードに切替"}
            </button>
            {editMode && (
              <span className="text-[10px] text-muted-foreground">
                スライダーで pt を動かすと メトリクス / メンバー年計 が即時再計算される。保存ボタン押下まで DB は書き換わらない。
              </span>
            )}
          </div>

          {/* ① メトリクスカード 4 枚 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard
              label="合計pt"
              value={`${fmtPt(displayTotalPoints)}pt`}
              sub={`本契約 ${fmtPt(displayRegularPoints)} / 別財布 ${fmtPt(displayExtraPoints)}`}
            />
            <MetricCard
              label="本契約 pt単価"
              value={fmtYen(displayRegularUnit)}
              sub={`原資 ${fmtYen(cycle.budgetYen)} ÷ ${fmtPt(displayRegularPoints)}pt`}
            />
            <MetricCard
              label="別財布 pt単価"
              value={displayExtraUnit > 0 ? fmtYen(displayExtraUnit) : "—"}
              sub={
                displayExtraUnit > 0
                  ? `${fmtYen(cycle.extraPoolBudgetYen)} ÷ ${fmtPt(displayExtraPoints)}pt`
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

          {/* ② 全MS (閲覧 = pt順横バー / 編集 = スライダー) */}
          <div>
            <h3 className="text-sm font-semibold mb-1">
              全MS {editMode ? "(編集モード)" : "(pt順)"}
            </h3>
            {cycle.milestones.length === 0 ? (
              <p className="text-xs text-muted-foreground">MS が登録されていない。</p>
            ) : editMode ? (
              <div>
                {cycle.milestones.map((ms) => {
                  const cur = editingByMs.get(ms.milestoneId);
                  if (!cur) return null;
                  const ptValueYen = recomputed.ptValueYenByMs.get(ms.milestoneId) ?? 0;
                  return (
                    <MsSliderRow
                      key={ms.milestoneId}
                      ms={ms}
                      current={cur}
                      ptValueYen={ptValueYen}
                      onChange={(next) => handleSliderChange(ms.milestoneId, next)}
                    />
                  );
                })}
              </div>
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
            {displayMemberTotals.length === 0 ? (
              <p className="text-xs text-muted-foreground">担当が割り当てられていない。</p>
            ) : (
              <div>
                {displayMemberTotals.map((m) => (
                  <MemberYearRow key={m.memberId} member={m} maxTotal={maxMemberTotal} />
                ))}
              </div>
            )}
          </div>

          {/* ④ 編集モードフッター (保存 / 戻す) */}
          {editMode && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={handleResetToDb}
                disabled={!isDirty || saveStatus === "saving"}
                className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
                title="現状DB値に全スライダーを戻す"
              >
                ↻ 推奨値に戻す
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saveStatus === "saving"}
                className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveStatus === "saving" ? "保存中…" : "💾 保存して DB へ反映"}
              </button>
              {saveStatus === "success" && (
                <span className="text-[11px] text-emerald-500">✓ 保存完了 → reward 再計算済</span>
              )}
              {saveStatus === "error" && (
                <span className="text-[11px] text-red-500">保存失敗: {saveError}</span>
              )}
            </div>
          )}

          {/* ⑤ tag 凡例 */}
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
  const [reloadKey, setReloadKey] = useState(0);

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
        setError(null);
        setCycles(body.planCycles as MsOverviewPlanCycle[]);
      })
      .catch((err) => {
        if (!aborted) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      aborted = true;
    };
  }, [reloadKey]);

  const handleSaved = useCallback(() => {
    setReloadKey((k) => k + 1);
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
          onSaved={handleSaved}
        />
      ))}
    </div>
  );
}
