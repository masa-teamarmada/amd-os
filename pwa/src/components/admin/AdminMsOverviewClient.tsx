"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MsOverviewPlanCycle,
  MsOverviewMilestone,
  MsOverviewMemberYearTotal,
  ProjectHealthState,
} from "@/lib/admin/ms-overview-types";
import {
  effectiveEditableMilestonePoints,
  isCapExtraTag,
  recomputeMsOverview,
  toEditableMilestones,
  type EditableMilestoneInput,
} from "@/lib/admin/ms-overview-calc";

// ---- バー色 (2026-06-20 ZMP MS設計再考セッションの widget から踏襲) -------
const BAR_NORMAL = "#1D9E75";
const BAR_ROUTINE = "#888780";
const BAR_CAP_EXTRA = "#7F77DD";
const ROLE_OPTIONS = ["担当", "統括", "レビュー", "サポート"] as const;

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

function HealthChip({ state, projectStatus, freezeFromYm }: {
  state: ProjectHealthState;
  projectStatus: string;
  freezeFromYm: string | null;
}) {
  if (state === "healthy") return null;
  if (state === "frozen") {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400"
        title={freezeFromYm ? `freeze_from_ym=${freezeFromYm}` : "freeze 中"}
      >
        ❄ freeze{freezeFromYm ? ` ${fmtYm(freezeFromYm)}〜` : ""}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-500 dark:text-slate-400"
      title={`projects.status=${projectStatus}`}
    >
      ■ {projectStatus || "inactive"}
    </span>
  );
}

/** JST 起点の今月 YYYYMM (ブラウザ TZ に依存しない: UTC+9) */
function currentYmJst(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const jst = new Date(utcMs + 9 * 60 * 60 * 1000);
  return `${jst.getFullYear()}${String(jst.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * MS が「過去分 (= 完了済シーズン)」か判定する。
 * `target_ym` (なければ `period_start_ym`) が現在月より厳密に過去なら history。
 * 期間情報がない MS は「現役」として扱う (隠れない方が安全)。
 */
function isHistoryMilestone(ms: MsOverviewMilestone, currentYm: string): boolean {
  const ref = ms.targetYm || ms.periodStartYm || "";
  if (!ref || !/^\d{6}$/.test(ref)) return false;
  return ref < currentYm;
}

function barColorForTag(tag: string, isCapExtra: boolean): string {
  if (isCapExtra) return BAR_CAP_EXTRA;
  const t = String(tag || "").toLowerCase();
  if (t === "routine") return BAR_ROUTINE;
  return BAR_NORMAL;
}

function isDraftMilestoneId(milestoneId: string): boolean {
  return milestoneId.startsWith("draft-");
}

function normalizeEditableRows(rows: EditableMilestoneInput[]): string {
  return JSON.stringify(
    rows
      .map((row) => ({
        milestoneId: isDraftMilestoneId(row.milestoneId) ? "draft" : row.milestoneId,
        title: row.title.trim(),
        points: Math.round(row.points * 100) / 100,
        tag: row.tag.trim(),
        goalLevel: row.goalLevel.trim(),
        successCriteria: row.successCriteria.trim(),
        periodStartYm: row.periodStartYm || "",
        targetYm: row.targetYm || "",
        sortOrder: row.sortOrder,
        responsibilities: row.responsibilities
          .filter((resp) => resp.share > 0)
          .map((resp) => ({
            memberId: resp.memberId,
            share: Math.round(resp.share * 10000) / 10000,
            role: resp.role.trim(),
            taskDescription: resp.taskDescription?.trim() || "",
          }))
          .sort((a, b) => a.memberId.localeCompare(b.memberId)),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.milestoneId.localeCompare(b.milestoneId)),
  );
}

function normalizeCapExtraPoint(row: EditableMilestoneInput): EditableMilestoneInput {
  const points = effectiveEditableMilestonePoints(row);
  return row.isCapExtra && points > 0 ? { ...row, points } : row;
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

// ---- MS 行 (編集モード) ---------------------------------------------------

function MsEditorRow({
  current,
  projectMembers,
  ptValueYen,
  onChange,
  onRemove,
}: {
  current: EditableMilestoneInput;
  projectMembers: MsOverviewPlanCycle["projectMembers"];
  ptValueYen: number;
  onChange: (patch: Partial<EditableMilestoneInput>) => void;
  onRemove: () => void;
}) {
  const color = barColorForTag(current.tag, current.isCapExtra);
  const shareSum = current.responsibilities.reduce((sum, resp) => sum + resp.share, 0);
  const responsibilityByMember = new Map(current.responsibilities.map((resp) => [resp.memberId, resp]));
  const derivedPoints = effectiveEditableMilestonePoints(current);
  const usesPeriodPoints = current.isCapExtra && derivedPoints > 0;
  const displayPoints = usesPeriodPoints ? derivedPoints : current.points;

  const updateResponsibility = (
    member: MsOverviewPlanCycle["projectMembers"][number],
    patch: Partial<EditableMilestoneInput["responsibilities"][number]>,
  ) => {
    const existing = responsibilityByMember.get(member.memberId) ?? {
      memberId: member.memberId,
      codeName: member.codeName,
      share: 0,
      role: "担当",
      taskDescription: null,
    };
    const next = { ...existing, ...patch, codeName: member.codeName };
    const responsibilities = [
      ...current.responsibilities.filter((resp) => resp.memberId !== member.memberId),
      next,
    ]
      .filter((resp) => resp.share > 0 || resp.role.trim() !== "担当" || !!resp.taskDescription?.trim())
      .sort((a, b) => b.share - a.share || a.codeName.localeCompare(b.codeName, "ja"));
    onChange({ responsibilities });
  };

  return (
    <div
      className="rounded-md border bg-card/60 px-3 py-3 mb-2"
      style={{ borderColor: "var(--border, #2a2a2a)", borderWidth: "0.5px" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block flex-shrink-0"
          style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color }}
          aria-hidden
        />
        <input
          value={current.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[13px] font-medium"
          aria-label="MS名"
        />
        <button
          type="button"
          onClick={onRemove}
          className="h-8 w-8 rounded border border-border text-[13px] text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
          title="MSを無効化"
          aria-label="MSを無効化"
        >
          ×
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[88px_128px_96px_96px_1fr]">
        <input
          type="number"
          min={0}
          step={1}
          value={displayPoints}
          onChange={(event) => {
            if (!usesPeriodPoints) onChange({ points: Number(event.target.value) });
          }}
          disabled={usesPeriodPoints}
          className="rounded border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground"
          aria-label="pt"
          title={usesPeriodPoints ? "cap_extra pt = MS期間の月数×10pt" : "pt"}
        />
        <select
          value={current.tag}
          onChange={(event) => {
            const tag = event.target.value;
            onChange({ tag, isCapExtra: isCapExtraTag(tag) });
          }}
          className="rounded border border-border bg-background px-2 py-1 text-[12px]"
          aria-label="tag"
        >
          <option value="normal">normal</option>
          <option value="routine">routine</option>
          <option value="buffer">buffer</option>
          <option value="cap_extra">cap_extra</option>
        </select>
        <input
          value={current.periodStartYm ?? ""}
          onChange={(event) => onChange({ periodStartYm: event.target.value || null })}
          placeholder="開始"
          inputMode="numeric"
          className="rounded border border-border bg-background px-2 py-1 text-[12px] tabular-nums"
          aria-label="MS開始"
        />
        <input
          value={current.targetYm ?? ""}
          onChange={(event) => onChange({ targetYm: event.target.value || null })}
          placeholder="終了"
          inputMode="numeric"
          className="rounded border border-border bg-background px-2 py-1 text-[12px] tabular-nums"
          aria-label="MS終了"
        />
        <div className="text-right text-[12px] text-muted-foreground tabular-nums">
          {fmtPt(displayPoints)}pt / {fmtYen(ptValueYen)}
        </div>
      </div>

      <textarea
        value={current.successCriteria}
        onChange={(event) => onChange({ successCriteria: event.target.value })}
        rows={2}
        className="mt-2 w-full resize-y rounded border border-border bg-background px-2 py-1 text-[12px]"
        placeholder="完了条件"
        aria-label="完了条件"
      />

      <div className="mt-2 border-t border-border/60 pt-2">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>担当share</span>
          <span className={Math.abs(shareSum - 1) <= 0.001 ? "text-emerald-500" : "text-amber-500"}>
            合計 {fmtShare(shareSum)}
          </span>
        </div>
        <div className="grid gap-1.5 md:grid-cols-2">
          {projectMembers.map((member) => {
            const resp = responsibilityByMember.get(member.memberId);
            const sharePct = Math.round((resp?.share ?? 0) * 1000) / 10;
            return (
              <div key={member.memberId} className="grid grid-cols-[72px_72px_88px_1fr] items-center gap-1.5">
                <span className="truncate text-[12px]" title={member.codeName}>{member.codeName}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={sharePct}
                  onChange={(event) => updateResponsibility(member, { share: Number(event.target.value) / 100 })}
                  className="rounded border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums"
                  aria-label={`${member.codeName} share`}
                />
                <select
                  value={resp?.role ?? "担当"}
                  onChange={(event) => updateResponsibility(member, { role: event.target.value })}
                  className="rounded border border-border bg-background px-2 py-1 text-[12px]"
                  aria-label={`${member.codeName} 役割`}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <input
                  value={resp?.taskDescription ?? ""}
                  onChange={(event) => updateResponsibility(member, { taskDescription: event.target.value || null })}
                  className="min-w-0 rounded border border-border bg-background px-2 py-1 text-[12px]"
                  placeholder="担当タスク"
                  aria-label={`${member.codeName} 担当タスク`}
                />
              </div>
            );
          })}
        </div>
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
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // 過去分 (target_ym/period_start_ym が今月より過去) を折りたたむか
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // 現役 / 過去分の分割。"今月" は JST 起点 (= AMD OS のシーズン軸と一致)。
  const currentYm = useMemo(() => currentYmJst(), []);
  const { currentMs, historyMs } = useMemo(() => {
    const cur: MsOverviewMilestone[] = [];
    const hist: MsOverviewMilestone[] = [];
    for (const ms of cycle.milestones) {
      if (isHistoryMilestone(ms, currentYm)) hist.push(ms);
      else cur.push(ms);
    }
    return { currentMs: cur, historyMs: hist };
  }, [cycle.milestones, currentYm]);

  // 元データが差し替わったら (= 保存後の再fetch) 編集状態を巻き戻す
  useEffect(() => {
    setEditing(toEditableMilestones(cycle));
    setDeletedIds([]);
    setSaveStatus("idle");
    setSaveError(null);
  }, [cycle]);

  const activeEditing = useMemo(
    () => editing.filter((row) => !deletedIds.includes(row.milestoneId)),
    [editing, deletedIds],
  );

  // ---- リアルタイム再計算 -------------------------------------------------
  const recomputed = useMemo(() => {
    return recomputeMsOverview({
      budgetYen: cycle.budgetYen,
      regularPointBasis: cycle.regularPoints,
      extraPoolBudgetYen: cycle.extraPoolBudgetYen,
      milestones: activeEditing,
    });
  }, [cycle.budgetYen, cycle.extraPoolBudgetYen, cycle.regularPoints, activeEditing]);

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

  const baseEditingKey = useMemo(() => normalizeEditableRows(toEditableMilestones(cycle)), [cycle]);
  const currentEditingKey = useMemo(() => normalizeEditableRows(activeEditing), [activeEditing]);
  const isDirty = deletedIds.length > 0 || baseEditingKey !== currentEditingKey;

  const handleMilestoneChange = useCallback((milestoneId: string, patch: Partial<EditableMilestoneInput>) => {
    setEditing((prev) =>
      prev.map((row) => (row.milestoneId === milestoneId ? normalizeCapExtraPoint({ ...row, ...patch }) : row)),
    );
  }, []);

  const handleResetToDb = useCallback(() => {
    setEditing(toEditableMilestones(cycle));
    setDeletedIds([]);
  }, [cycle]);

  const handleAddMilestone = useCallback(() => {
    const nextOrder = activeEditing.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
    setEditing((prev) => [
      ...prev,
      {
        milestoneId: `draft-${cycle.planCycleId}-${Date.now()}`,
        title: "新しいMS",
        points: 10,
        tag: "normal",
        goalLevel: "season",
        successCriteria: "",
        periodStartYm: cycle.periodStartYm,
        targetYm: cycle.periodEndYm,
        sortOrder: nextOrder,
        isCapExtra: false,
        responsibilities: [],
      },
    ]);
    setEditMode(true);
  }, [activeEditing, cycle.planCycleId, cycle.periodEndYm, cycle.periodStartYm]);

  const handleRemoveMilestone = useCallback((milestoneId: string) => {
    setEditing((prev) => prev.filter((row) => row.milestoneId !== milestoneId));
    if (!isDraftMilestoneId(milestoneId)) {
      setDeletedIds((prev) => (prev.includes(milestoneId) ? prev : [...prev, milestoneId]));
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const payload = {
        milestones: activeEditing.map((row, index) => ({
          milestoneId: isDraftMilestoneId(row.milestoneId) ? null : row.milestoneId,
          title: row.title,
          points: Math.round(effectiveEditableMilestonePoints(row) * 100) / 100,
          tag: row.tag,
          goalLevel: row.goalLevel,
          successCriteria: row.successCriteria,
          periodStartYm: row.periodStartYm,
          targetYm: row.targetYm,
          sortOrder: row.sortOrder || index + 1,
          responsibilities: row.responsibilities
            .filter((resp) => resp.share > 0)
            .map((resp) => ({
              memberId: resp.memberId,
              share: Math.round(resp.share * 10000) / 10000,
              role: resp.role,
              taskDescription: resp.taskDescription,
            })),
        })),
        deletedMilestoneIds: deletedIds,
      };
      if (!isDirty) {
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
  }, [activeEditing, cycle.planCycleId, deletedIds, isDirty, onSaved]);

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-accent/30"
      >
        <span className="text-xs text-muted-foreground tabular-nums">{open ? "▾" : "▸"}</span>
        <span className="font-semibold">{cycle.projectName}</span>
        <HealthChip
          state={cycle.healthState}
          projectStatus={cycle.projectStatus}
          freezeFromYm={cycle.projectFreezeFromYm}
        />
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
                MS名・期間・pt・担当shareを編集できる。保存ボタン押下まで DB は書き換わらない。
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

          {/* ② 全MS (閲覧 = pt順横バー / 編集 = MS設計エディタ)
                現役 (target_ym ≥ 今月 or 期間未設定) を常時表示、過去分はトグル */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                全MS {editMode ? "(編集モード)" : "(pt順)"}
                <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                  現役 {currentMs.length}件 / 過去分 {historyMs.length}件
                </span>
              </h3>
              {editMode && (
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="ml-auto rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                >
                  ＋ MS追加
                </button>
              )}
            </div>
            {editMode ? (
              <div>
                {activeEditing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">MS が登録されていない。</p>
                ) : (
                  [...activeEditing]
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja"))
                    .map((row) => (
                      <MsEditorRow
                        key={row.milestoneId}
                        current={row}
                        projectMembers={cycle.projectMembers}
                        ptValueYen={recomputed.ptValueYenByMs.get(row.milestoneId) ?? 0}
                        onChange={(patch) => handleMilestoneChange(row.milestoneId, patch)}
                        onRemove={() => handleRemoveMilestone(row.milestoneId)}
                      />
                    ))
                )}
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
                {currentMs.map((ms) => (
                  <MsRow key={ms.milestoneId} ms={ms} maxPtValue={maxPtValue} />
                ))}
                {historyMs.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setShowHistory((prev) => !prev)}
                      className="text-[11px] text-muted-foreground hover:text-foreground py-1"
                    >
                      {showHistory ? "▾" : "▸"} 過去分 ({historyMs.length}件) {showHistory ? "を隠す" : "を表示"}
                    </button>
                    {showHistory && (
                      <div className="opacity-70">
                        {historyMs.map((ms) => (
                          <MsRow key={ms.milestoneId} ms={ms} maxPtValue={maxPtValue} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                title="現状DB値に戻す"
              >
                ↻ DB値に戻す
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saveStatus === "saving"}
                className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveStatus === "saving" ? "保存中…" : "保存して DB へ反映"}
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

// ---- PJ グループ (同一 PJ の複数 plan_cycle を集約) --------------------

/**
 * 同じ PJ で plan_cycle が複数あるとき、最新 (period_end_ym 降順で先頭) を
 * 「現役シーズン」、それ以外を「過去シーズン」として扱い、過去シーズンは
 * トグルでだけ展開する。`/admin/ms-overview` の閲覧版は 1 cycle = 1 block で
 * 並ぶため、SX や CX のように同じ PJ で active + fixed の 2 cycle がある PJ
 * はこのままだと block が重複していたのを 1 PJ = 1 block に集約する。
 */
function ProjectCycleGroup({
  projectId,
  projectName,
  cycles,
  openByDefault,
  onSaved,
}: {
  projectId: string;
  projectName: string;
  cycles: MsOverviewPlanCycle[];
  openByDefault: boolean;
  onSaved: () => void;
}) {
  const [showPastSeasons, setShowPastSeasons] = useState(false);
  // 同一 PJ 内の cycle 並び順: period_end_ym 降順 → period_start_ym 降順 → planCycleId。
  const sorted = useMemo(() => {
    return [...cycles].sort((a, b) => {
      if (a.periodEndYm !== b.periodEndYm) return b.periodEndYm.localeCompare(a.periodEndYm);
      if (a.periodStartYm !== b.periodStartYm) return b.periodStartYm.localeCompare(a.periodStartYm);
      return a.planCycleId.localeCompare(b.planCycleId);
    });
  }, [cycles]);
  const [current, ...past] = sorted;
  if (!current) return null;
  return (
    <div className="space-y-2" data-pj={projectId} data-pj-name={projectName}>
      <PlanCycleBlock cycle={current} openByDefault={openByDefault} onSaved={onSaved} />
      {past.length > 0 && (
        <div className="pl-3">
          <button
            type="button"
            onClick={() => setShowPastSeasons((prev) => !prev)}
            className="text-[11px] text-muted-foreground hover:text-foreground py-1"
          >
            {showPastSeasons ? "▾" : "▸"} 過去シーズン ({past.length}件) {showPastSeasons ? "を隠す" : "を表示"}
          </button>
          {showPastSeasons && (
            <div className="space-y-2 opacity-80">
              {past.map((cycle) => (
                <PlanCycleBlock
                  key={cycle.planCycleId}
                  cycle={cycle}
                  openByDefault={false}
                  onSaved={onSaved}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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

  // PJ 単位にグループ化 (= 同じ projectId の cycle を 1 まとめ)。
  // 並び順: healthy → frozen → inactive、層内は budget_yen 降順 → project_id 昇順。
  // (= route の sort と整合)。
  const projectGroups = useMemo(() => {
    if (!cycles) return null;
    type Group = { projectId: string; projectName: string; cycles: MsOverviewPlanCycle[] };
    const byPj = new Map<string, Group>();
    for (const c of cycles) {
      const g = byPj.get(c.projectId) ?? { projectId: c.projectId, projectName: c.projectName, cycles: [] };
      g.cycles.push(c);
      byPj.set(c.projectId, g);
    }
    const groups = [...byPj.values()];
    const maxBudgetIn = (g: Group) => g.cycles.reduce((max, c) => Math.max(max, c.budgetYen), 0);
    const healthRank: Record<ProjectHealthState, number> = { healthy: 0, frozen: 1, inactive: 2 };
    // グループの health は「PJ 内で最も良い state」(= 健全な cycle が 1 つでもあれば healthy)。
    const groupHealthRank = (g: Group): number => {
      let best = healthRank.inactive;
      for (const c of g.cycles) {
        const rank = healthRank[c.healthState];
        if (rank < best) best = rank;
      }
      return best;
    };
    groups.sort((a, b) => {
      const ha = groupHealthRank(a);
      const hb = groupHealthRank(b);
      if (ha !== hb) return ha - hb;
      return maxBudgetIn(b) - maxBudgetIn(a) || a.projectId.localeCompare(b.projectId);
    });
    return groups;
  }, [cycles]);

  if (error) {
    return <p className="text-sm text-red-500">読み込みに失敗: {error}</p>;
  }
  if (cycles === null || projectGroups === null) {
    return <p className="text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (projectGroups.length === 0) {
    return <p className="text-sm text-muted-foreground">active な plan cycle がない。</p>;
  }

  return (
    <div className="space-y-3" data-testid="admin-ms-overview-root">
      {projectGroups.map((group, idx) => (
        <ProjectCycleGroup
          key={group.projectId}
          projectId={group.projectId}
          projectName={group.projectName}
          cycles={group.cycles}
          openByDefault={idx === 0}
          onSaved={handleSaved}
        />
      ))}
    </div>
  );
}
