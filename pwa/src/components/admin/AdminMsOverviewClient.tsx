"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  MsOverviewPlanCycle,
  MsOverviewMilestone,
  MsOverviewMemberPointTotal,
  ProjectHealthState,
} from "@/lib/admin/ms-overview-types";
import {
  effectiveEditableMilestonePoints,
  isCapExtraTag,
  recomputeMsOverview,
  sliderRange,
  toEditableMilestones,
  type EditableMilestoneInput,
} from "@/lib/admin/ms-overview-calc";

// ---- バー色 (2026-06-20 ZMP MS設計再考セッションの widget から踏襲) -------
const BAR_NORMAL = "#1D9E75";
const BAR_ROUTINE = "#888780";
const BAR_CAP_EXTRA = "#7F77DD";
const ROLE_OPTIONS = ["担当", "統括", "レビュー", "サポート"] as const;

// メンバーpt配分バー: 本契約 (regular) は濃、別財布 (extra) は淡
const MEMBER_BAR_REGULAR = "#1D9E75";
const MEMBER_BAR_EXTRA = "#7F77DD";

function fmtPt(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return (Math.round(v * 100) / 100).toLocaleString("ja-JP");
}

function fmtRevisionYen(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0円";
  return `${Math.round(v).toLocaleString("ja-JP")}円`;
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

function MsRow({ ms, maxPoints }: { ms: MsOverviewMilestone; maxPoints: number }) {
  const widthPct = maxPoints > 0 ? Math.max(2, Math.round((ms.points / maxPoints) * 100)) : 0;
  const color = barColorForTag(ms.tag, ms.isCapExtra);
  const period = ms.periodStartYm || ms.targetYm
    ? `${fmtYm(ms.periodStartYm)}${ms.targetYm ? `–${fmtYm(ms.targetYm)}` : ""}`
    : "";
  return (
    <div className="grid grid-cols-[1fr_72px_1fr_180px] gap-3 items-center py-1.5 border-t border-border/60">
      <div className="min-w-0">
        <div className="text-sm truncate" title={ms.title}>{ms.title}</div>
        <div className="text-[10px] text-muted-foreground">
          {period}
          {period && ms.tag ? " · " : ""}
          <span style={{ color }}>{ms.isCapExtra ? "cap_extra" : ms.tag}</span>
        </div>
      </div>
      <div className="text-right text-sm tabular-nums">{fmtPt(ms.points)}pt</div>
      <div>
        <div
          className="h-3 rounded-sm"
          style={{ width: `${widthPct}%`, backgroundColor: color }}
          title={`${fmtPt(ms.points)}pt (${widthPct}%)`}
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
  pointRange,
  onChange,
  onRemove,
}: {
  current: EditableMilestoneInput;
  projectMembers: MsOverviewPlanCycle["projectMembers"];
  pointRange: ReturnType<typeof sliderRange>;
  onChange: (patch: Partial<EditableMilestoneInput>) => void;
  onRemove: () => void;
}) {
  const color = barColorForTag(current.tag, current.isCapExtra);
  const shareSum = current.responsibilities.reduce((sum, resp) => sum + resp.share, 0);
  const responsibilityByMember = new Map(current.responsibilities.map((resp) => [resp.memberId, resp]));
  const derivedPoints = effectiveEditableMilestonePoints(current);
  const usesPeriodPoints = current.isCapExtra && derivedPoints > 0;
  const displayPoints = usesPeriodPoints ? derivedPoints : current.points;
  const rowPointRange = usesPeriodPoints ? sliderRange(displayPoints) : pointRange;
  const updatePoints = (points: number) => {
    if (!usesPeriodPoints) onChange({ points });
  };

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
      className="mb-2 rounded-md border bg-card/60 p-3"
      style={{ borderColor: "var(--border, #2a2a2a)", borderWidth: "0.5px" }}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(280px,420px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
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

          <div className="grid grid-cols-[76px_minmax(112px,1fr)] gap-2 sm:grid-cols-[76px_minmax(112px,1fr)_88px_88px]">
            <div className="space-y-1">
              <input
                type="number"
                min={0}
                step={1}
                value={displayPoints}
                onChange={(event) => updatePoints(Number(event.target.value))}
                disabled={usesPeriodPoints}
                className="w-full rounded border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground"
                aria-label="pt"
                title={usesPeriodPoints ? "cap_extra pt = MS期間の月数×10pt" : "pt"}
              />
              <input
                type="range"
                min={rowPointRange.min}
                max={rowPointRange.max}
                step={1}
                value={Math.min(rowPointRange.max, Math.max(rowPointRange.min, displayPoints))}
                onChange={(event) => updatePoints(Number(event.target.value))}
                disabled={usesPeriodPoints}
                className="block h-3 w-full accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="pt配分スライダー"
                title={usesPeriodPoints ? "cap_extra pt = MS期間の月数×10pt" : "pt配分スライダー"}
              />
            </div>
            <select
              value={current.tag}
              onChange={(event) => {
                const tag = event.target.value;
                onChange({ tag, isCapExtra: isCapExtraTag(tag) });
              }}
              className="min-w-0 rounded border border-border bg-background px-2 py-1 text-[12px]"
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
          </div>

          <div className="rounded bg-muted/30 px-2 py-1 text-right text-[12px] text-muted-foreground tabular-nums">
            {fmtPt(displayPoints)}pt
          </div>

          <textarea
            value={current.successCriteria}
            onChange={(event) => onChange({ successCriteria: event.target.value })}
            rows={3}
            className="w-full resize-y rounded border border-border bg-background px-2 py-1 text-[12px]"
            placeholder="完了条件"
            aria-label="完了条件"
          />
        </div>

        <div className="min-w-0 rounded border border-border/60 bg-background/35 p-2">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>担当share / 担当pt</span>
            <span className={Math.abs(shareSum - 1) <= 0.001 ? "text-emerald-500" : "text-amber-500"}>
              合計 {fmtShare(shareSum)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[650px]">
              <div className="grid grid-cols-[88px_64px_76px_92px_minmax(180px,360px)] items-center gap-1.5 px-1 pb-1 text-[10px] text-muted-foreground">
                <span>メンバー</span>
                <span className="text-right">share</span>
                <span>役割</span>
                <span className="text-right">担当pt</span>
                <span>担当タスク</span>
              </div>
              {projectMembers.map((member) => {
                const resp = responsibilityByMember.get(member.memberId);
                const sharePct = Math.round((resp?.share ?? 0) * 1000) / 10;
                const memberPt = Math.round(displayPoints * (resp?.share ?? 0) * 100) / 100;
                return (
                  <div
                    key={member.memberId}
                    className="grid grid-cols-[88px_64px_76px_92px_minmax(180px,360px)] items-center gap-1.5 border-t border-border/50 px-1 py-1.5"
                  >
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
                    <span
                      className={
                        "rounded bg-muted/35 px-2 py-1 text-right text-[12px] tabular-nums " +
                        (memberPt > 0 ? "text-foreground" : "text-muted-foreground")
                      }
                      title={`${member.codeName}: ${fmtPt(displayPoints)}pt × ${fmtShare(resp?.share ?? 0)}`}
                      aria-label={`${member.codeName} 担当pt`}
                    >
                      {fmtPt(memberPt)}pt
                    </span>
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
      </div>
    </div>
  );
}

// ---- メンバーpt配分バー ----------------------------------------------------

function MemberPointRow({
  member,
  maxTotal,
}: {
  member: MsOverviewMemberPointTotal;
  maxTotal: number;
}) {
  const regWidth = maxTotal > 0 ? (member.regularPt / maxTotal) * 100 : 0;
  const extWidth = maxTotal > 0 ? (member.extraPt / maxTotal) * 100 : 0;
  return (
    <div className="grid grid-cols-[80px_1fr_140px] gap-3 items-center py-1">
      <div className="text-sm truncate">{member.codeName}</div>
      <div className="flex h-3 rounded-sm overflow-hidden bg-muted/30">
        {regWidth > 0 && (
          <div
            style={{ width: `${regWidth}%`, backgroundColor: MEMBER_BAR_REGULAR }}
            title={`本契約 ${fmtPt(member.regularPt)}pt`}
          />
        )}
        {extWidth > 0 && (
          <div
            style={{ width: `${extWidth}%`, backgroundColor: MEMBER_BAR_EXTRA, opacity: 0.65 }}
            title={`別財布 ${fmtPt(member.extraPt)}pt`}
          />
        )}
      </div>
      <div className="text-right text-sm tabular-nums">
        {fmtPt(member.totalPt)}pt
        {member.extraPt > 0 && (
          <span className="text-[10px] text-muted-foreground ml-1">
            (本{fmtPt(member.regularPt)}pt 別{fmtPt(member.extraPt)}pt)
          </span>
        )}
      </div>
    </div>
  );
}

// ---- 1 PJ ブロック ---------------------------------------------------------

type SaveStatus = "idle" | "saving" | "error" | "success";
type PointSummary = {
  allocatedRegularPoints: number;
  regularPoints: number;
  remainingRegularPoints: number;
};

type RewardRevisionSummary = {
  protectedCycleCount: number;
  offsetCount: number;
  totalOffsetYen: number;
  positiveOffsetYen: number;
  negativeOffsetYen: number;
  missingApplyYmCount: number;
  skippedMissingBeforeSummaryCount: number;
  voidedPreviousOffsetCount: number;
  sourceYms: string[];
  applyYms: string[];
};

function EditSaveButtons({
  isDirty,
  saveStatus,
  onReset,
  onSave,
  compact = false,
}: {
  isDirty: boolean;
  saveStatus: SaveStatus;
  onReset: () => void;
  onSave: () => void;
  compact?: boolean;
}) {
  const buttonHeight = compact ? "h-7" : "h-8";
  const buttonPadding = compact ? "px-2.5" : "px-3";
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        disabled={!isDirty || saveStatus === "saving"}
        className={`${buttonHeight} rounded border border-border ${buttonPadding} text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40`}
        title="現状DB値に戻す"
      >
        ↻ DB値に戻す
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!isDirty || saveStatus === "saving"}
        className={`${buttonHeight} rounded bg-emerald-600 ${buttonPadding} text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {saveStatus === "saving" ? "保存中…" : compact ? "保存" : "保存して DB へ反映"}
      </button>
    </div>
  );
}

function EditActionBar({
  isDirty,
  saveStatus,
  saveError,
  pointSummary,
  rewardRevision,
  onReset,
  onSave,
  className = "",
}: {
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  pointSummary?: PointSummary;
  rewardRevision?: RewardRevisionSummary | null;
  onReset: () => void;
  onSave: () => void;
  className?: string;
}) {
  const statusLabel = saveStatus === "saving" ? "保存中" : isDirty ? "未保存あり" : "変更なし";
  const statusClass =
    saveStatus === "saving"
      ? "bg-sky-500/15 text-sky-600 dark:text-sky-300"
      : isDirty
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300";

  return (
    <div
      className={
        "flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-background/95 px-3 py-2 shadow-sm " +
        className
      }
      data-testid="admin-ms-overview-edit-save-bar"
    >
      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>{statusLabel}</span>
      <span className="text-[11px] text-muted-foreground">保存先 DB / protected月は差額精算</span>
      {pointSummary && (
        <span
          className={
            "rounded px-2 py-0.5 text-[11px] tabular-nums " +
            (pointSummary.remainingRegularPoints >= 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "bg-red-500/10 text-red-500")
          }
          title={`本契約 ${fmtPt(pointSummary.allocatedRegularPoints)}pt / ${fmtPt(pointSummary.regularPoints)}pt`}
        >
          残り割り振り可能pt {fmtPt(pointSummary.remainingRegularPoints)}pt
        </span>
      )}
      {saveStatus === "success" && (
        <span className="text-[11px] text-emerald-500">✓ 保存完了 → reward 再計算済</span>
      )}
      {rewardRevision && rewardRevision.protectedCycleCount > 0 && (
        <span
          className={
            "rounded px-2 py-0.5 text-[11px] tabular-nums " +
            (rewardRevision.offsetCount > 0
              ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
              : "bg-muted text-muted-foreground")
          }
          title={`保護済み月 ${rewardRevision.sourceYms.join(", ")} / 反映月 ${rewardRevision.applyYms.join(", ") || "未定"}`}
        >
          差額精算 {rewardRevision.offsetCount}件 / 追加 {fmtRevisionYen(rewardRevision.positiveOffsetYen)}
          {rewardRevision.negativeOffsetYen < 0 ? ` / 回収 ${fmtRevisionYen(Math.abs(rewardRevision.negativeOffsetYen))}` : ""}
          {rewardRevision.missingApplyYmCount > 0 ? ` / 反映先未定 ${rewardRevision.missingApplyYmCount}件` : ""}
        </span>
      )}
      {rewardRevision && rewardRevision.skippedMissingBeforeSummaryCount > 0 && (
        <span className="text-[11px] text-amber-500">
          旧rewardなし {rewardRevision.skippedMissingBeforeSummaryCount}月は差額未作成
        </span>
      )}
      {saveStatus === "error" && (
        <span className="min-w-0 text-[11px] text-red-500">保存失敗: {saveError}</span>
      )}
      <div className="ml-auto">
        <EditSaveButtons
          isDirty={isDirty}
          saveStatus={saveStatus}
          onReset={onReset}
          onSave={onSave}
        />
      </div>
    </div>
  );
}

function RewardRevisionSafetyPanel({
  isDirty,
  saveStatus,
  rewardRevision,
  onReset,
  onSave,
}: {
  isDirty: boolean;
  saveStatus: SaveStatus;
  rewardRevision: RewardRevisionSummary | null;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-sky-500/25 bg-sky-500/5 px-3 py-2"
      data-testid="admin-ms-overview-reward-revision-guard"
    >
      <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
        支払保護 ON
      </span>
      <span className="rounded bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
        protected月: 過去明細保持
      </span>
      <span className="rounded bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground">
        差額: 本人別に次回精算
      </span>
      {rewardRevision && rewardRevision.protectedCycleCount > 0 && (
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] tabular-nums text-emerald-700 dark:text-emerald-300">
          前回保存: 差額 {rewardRevision.offsetCount}件
        </span>
      )}
      <div className="ml-auto">
        <EditSaveButtons
          isDirty={isDirty}
          saveStatus={saveStatus}
          onReset={onReset}
          onSave={onSave}
          compact
        />
      </div>
    </div>
  );
}

function AllMsPointSliders({
  rows,
  pointSummary,
  pointRange,
  onChange,
}: {
  rows: EditableMilestoneInput[];
  pointSummary: PointSummary;
  pointRange: ReturnType<typeof sliderRange>;
  onChange: (milestoneId: string, points: number) => void;
}) {
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja")),
    [rows],
  );

  return (
    <div className="rounded-md border border-border/70 bg-background/55 p-3" aria-label="全MS pt配分スライダー一覧">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold">全MS pt配分スライダー</span>
        <span
          className={
            "rounded px-2 py-0.5 text-[11px] tabular-nums " +
            (pointSummary.remainingRegularPoints >= 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "bg-red-500/10 text-red-500")
          }
          title={`本契約 ${fmtPt(pointSummary.allocatedRegularPoints)}pt / ${fmtPt(pointSummary.regularPoints)}pt`}
        >
          残り割り振り可能pt {fmtPt(pointSummary.remainingRegularPoints)}pt
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[500px] space-y-1">
          <div className="grid grid-cols-[minmax(130px,1fr)_58px_minmax(150px,2fr)_72px] items-center gap-2 px-2 pb-0.5 text-[10px] text-muted-foreground">
            <span>MS</span>
            <span className="text-right">pt</span>
            <span>配分</span>
            <span className="text-right">現在pt</span>
          </div>
          {sortedRows.map((row) => {
            const color = barColorForTag(row.tag, row.isCapExtra);
            const derivedPoints = effectiveEditableMilestonePoints(row);
            const usesPeriodPoints = row.isCapExtra && derivedPoints > 0;
            const displayPoints = usesPeriodPoints ? derivedPoints : row.points;
            const rowPointRange = usesPeriodPoints ? sliderRange(displayPoints) : pointRange;
            return (
              <div
                key={row.milestoneId}
                className="grid grid-cols-[minmax(130px,1fr)_58px_minmax(150px,2fr)_72px] items-center gap-2 rounded border border-border/45 bg-card/45 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="inline-block flex-shrink-0"
                      style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="truncate text-[12px] font-medium" title={row.title}>
                      {row.title || "無題MS"}
                    </span>
                  </div>
                  <div className="truncate pl-[14px] text-[10px] text-muted-foreground" title={row.tag}>
                    {row.isCapExtra ? "cap_extra / 期間×10pt固定" : row.tag || "normal"}
                  </div>
                </div>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={displayPoints}
                  onChange={(event) => onChange(row.milestoneId, Number(event.target.value))}
                  disabled={usesPeriodPoints}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-right text-[12px] tabular-nums disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground"
                  aria-label={`${row.title || "無題MS"} pt`}
                  title={usesPeriodPoints ? "cap_extra pt = MS期間の月数×10pt" : "pt"}
                />
                <input
                  type="range"
                  min={rowPointRange.min}
                  max={rowPointRange.max}
                  step={1}
                  value={Math.min(rowPointRange.max, Math.max(rowPointRange.min, displayPoints))}
                  onChange={(event) => onChange(row.milestoneId, Number(event.target.value))}
                  disabled={usesPeriodPoints}
                  className="block h-3 w-full accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label={`${row.title || "無題MS"} pt配分スライダー`}
                  title={usesPeriodPoints ? "cap_extra pt = MS期間の月数×10pt" : "pt配分スライダー"}
                />
                <div
                  className="text-right tabular-nums"
                  title={`${fmtPt(displayPoints)}pt`}
                  aria-label={`${row.title || "無題MS"} 現在pt`}
                >
                  <div className="text-[12px] text-muted-foreground">{fmtPt(displayPoints)}pt</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [lastRewardRevision, setLastRewardRevision] = useState<RewardRevisionSummary | null>(null);
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
    /* eslint-disable react-hooks/set-state-in-effect -- 保存後の再fetchで、ローカル編集バッファをDB値に戻すための同期。 */
    setEditing(toEditableMilestones(cycle));
    setDeletedIds([]);
    setSaveStatus("idle");
    setSaveError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [cycle]);

  const activeEditing = useMemo(
    () => editing.filter((row) => !deletedIds.includes(row.milestoneId)),
    [editing, deletedIds],
  );
  const pointSliderRange = useMemo(() => {
    const baseRows = toEditableMilestones(cycle);
    const editableRows = baseRows.filter((row) => !row.isCapExtra);
    const referenceRows = editableRows.length > 0 ? editableRows : baseRows;
    const maxReferencePoints = referenceRows.reduce(
      (max, row) => Math.max(max, effectiveEditableMilestonePoints(row)),
      0,
    );
    return sliderRange(maxReferencePoints > 0 ? maxReferencePoints : 10);
  }, [cycle]);

  // ---- リアルタイム再計算 -------------------------------------------------
  const recomputed = useMemo(() => {
    return recomputeMsOverview({
      regularPointBasis: cycle.regularPoints,
      milestones: activeEditing,
    });
  }, [cycle.regularPoints, activeEditing]);

  // 表示用 (= 編集モードなら recomputed、閲覧モードなら cycle の値) -----
  const displayTotalPoints = editMode ? recomputed.totalPoints : cycle.totalPoints;
  const displayRegularPoints = editMode ? recomputed.regularPoints : cycle.regularPoints;
  const displayExtraPoints = editMode ? recomputed.extraPoints : cycle.extraPoints;
  const displayMemberTotals = editMode ? recomputed.memberPointTotals : cycle.memberPointTotals;

  const topMember = displayMemberTotals[0];
  const secondMember = displayMemberTotals[1];

  const maxMilestonePoints = useMemo(
    () => cycle.milestones.reduce((max, ms) => Math.max(max, ms.points), 0),
    [cycle.milestones],
  );

  const maxMemberTotal = useMemo(
    () => displayMemberTotals.reduce((max, m) => Math.max(max, m.totalPt), 0),
    [displayMemberTotals],
  );

  const baseEditingKey = useMemo(() => normalizeEditableRows(toEditableMilestones(cycle)), [cycle]);
  const currentEditingKey = useMemo(() => normalizeEditableRows(activeEditing), [activeEditing]);
  const isDirty = deletedIds.length > 0 || baseEditingKey !== currentEditingKey;
  const pointSummary = useMemo(() => {
    const allocatedRegularPoints = Math.round(
      activeEditing
        .filter((row) => !row.isCapExtra)
        .reduce((sum, row) => sum + effectiveEditableMilestonePoints(row), 0) * 100,
    ) / 100;
    const regularPoints = Math.round(recomputed.regularPoints * 100) / 100;
    return {
      allocatedRegularPoints,
      regularPoints,
      remainingRegularPoints: Math.round((regularPoints - allocatedRegularPoints) * 100) / 100,
    };
  }, [activeEditing, recomputed.regularPoints]);

  const handleMilestoneChange = useCallback((milestoneId: string, patch: Partial<EditableMilestoneInput>) => {
    setEditing((prev) =>
      prev.map((row) => (row.milestoneId === milestoneId ? normalizeCapExtraPoint({ ...row, ...patch }) : row)),
    );
  }, []);

  const handleMilestonePointsChange = useCallback((milestoneId: string, points: number) => {
    handleMilestoneChange(milestoneId, { points });
  }, [handleMilestoneChange]);

  const handleResetToDb = useCallback(() => {
    setEditing(toEditableMilestones(cycle));
    setDeletedIds([]);
    setLastRewardRevision(null);
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
    setLastRewardRevision(null);
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
      setLastRewardRevision((body.rewardRevision ?? null) as RewardRevisionSummary | null);
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
          total {fmtPt(displayTotalPoints)}pt / 本契約 {fmtPt(displayRegularPoints)}pt
          {displayExtraPoints > 0 && (
            <span className="text-[#7F77DD] ml-2">別財布 {fmtPt(displayExtraPoints)}pt</span>
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

          {editMode && (
            <EditActionBar
              isDirty={isDirty}
              saveStatus={saveStatus}
              saveError={saveError}
              pointSummary={pointSummary}
              rewardRevision={lastRewardRevision}
              onReset={handleResetToDb}
              onSave={handleSave}
              className="sticky top-2 z-10"
            />
          )}

          {/* ① メトリクスカード 4 枚 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard
              label="合計pt"
              value={`${fmtPt(displayTotalPoints)}pt`}
              sub={`本契約 ${fmtPt(displayRegularPoints)} / 別財布 ${fmtPt(displayExtraPoints)}`}
            />
            <MetricCard
              label="本契約pt"
              value={`${fmtPt(displayRegularPoints)}pt`}
              sub={`割当 ${fmtPt(pointSummary.allocatedRegularPoints)} / 残 ${fmtPt(pointSummary.remainingRegularPoints)}`}
            />
            <MetricCard
              label="別財布pt"
              value={displayExtraPoints > 0 ? `${fmtPt(displayExtraPoints)}pt` : "—"}
              sub={displayExtraPoints > 0 ? "cap_extra MS" : "別財布 MS なし"}
            />
            <MetricCard
              label={
                topMember && secondMember
                  ? `主要メンバー: ${topMember.codeName} vs ${secondMember.codeName}`
                  : "主要メンバー"
              }
              value={
                topMember && secondMember
                  ? `${fmtPt(topMember.totalPt)}pt : ${fmtPt(secondMember.totalPt)}pt`
                  : topMember
                    ? `${topMember.codeName} ${fmtPt(topMember.totalPt)}pt`
                    : "—"
              }
              sub={
                topMember && secondMember && secondMember.totalPt > 0
                  ? `比 ${(topMember.totalPt / secondMember.totalPt).toFixed(2)}x`
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
                <span
                  className={
                    "rounded px-2 py-0.5 text-[11px] tabular-nums " +
                    (pointSummary.remainingRegularPoints >= 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                      : "bg-red-500/10 text-red-500")
                  }
                  title={`本契約 ${fmtPt(pointSummary.allocatedRegularPoints)}pt / ${fmtPt(pointSummary.regularPoints)}pt`}
                >
                  残り割り振り可能pt {fmtPt(pointSummary.remainingRegularPoints)}pt
                </span>
              )}
              {editMode && (
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <EditSaveButtons
                    isDirty={isDirty}
                    saveStatus={saveStatus}
                    onReset={handleResetToDb}
                    onSave={handleSave}
                    compact
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="h-7 rounded border border-border px-2.5 text-[11px] text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                  >
                    ＋ MS追加
                  </button>
                </div>
              )}
            </div>
            {editMode ? (
              <div>
                {activeEditing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">MS が登録されていない。</p>
                ) : (
                  <div className="space-y-3">
                    <RewardRevisionSafetyPanel
                      isDirty={isDirty}
                      saveStatus={saveStatus}
                      rewardRevision={lastRewardRevision}
                      onReset={handleResetToDb}
                      onSave={handleSave}
                    />
                    <AllMsPointSliders
                      rows={activeEditing}
                      pointSummary={pointSummary}
                      pointRange={pointSliderRange}
                      onChange={handleMilestonePointsChange}
                    />
                    <div>
                      {[...activeEditing]
                        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ja"))
                        .map((row) => (
                          <MsEditorRow
                            key={row.milestoneId}
                            current={row}
                            projectMembers={cycle.projectMembers}
                            pointRange={pointSliderRange}
                            onChange={(patch) => handleMilestoneChange(row.milestoneId, patch)}
                            onRemove={() => handleRemoveMilestone(row.milestoneId)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_72px_1fr_180px] gap-3 text-[10px] text-muted-foreground uppercase tracking-wider pb-1">
                  <div>MS名 / 期間 / tag</div>
                  <div className="text-right">pt</div>
                  <div>pt比</div>
                  <div>担当share</div>
                </div>
                {currentMs.map((ms) => (
                  <MsRow key={ms.milestoneId} ms={ms} maxPoints={maxMilestonePoints} />
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
                          <MsRow key={ms.milestoneId} ms={ms} maxPoints={maxMilestonePoints} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ③ メンバー別 pt配分 */}
          <div>
            <h3 className="text-sm font-semibold mb-1">メンバー別 pt配分 (plannedShare)</h3>
            {displayMemberTotals.length === 0 ? (
              <p className="text-xs text-muted-foreground">担当が割り当てられていない。</p>
            ) : (
              <div>
                {displayMemberTotals.map((m) => (
                  <MemberPointRow key={m.memberId} member={m} maxTotal={maxMemberTotal} />
                ))}
              </div>
            )}
          </div>

          {/* ④ 編集モードフッター (保存 / 戻す) */}
          {editMode && (
            <div className="pt-3 border-t border-border/60">
              <EditActionBar
                isDirty={isDirty}
                saveStatus={saveStatus}
                saveError={saveError}
                pointSummary={pointSummary}
                rewardRevision={lastRewardRevision}
                onReset={handleResetToDb}
                onSave={handleSave}
              />
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
