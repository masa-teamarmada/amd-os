"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { capExtraPointBasisForMilestone, pointBasisForPeriod, roundPt } from "@/lib/season-point-basis";
import { toggleSubItemStatus } from "@/lib/supabase-data";

/**
 * 「4-5」のような短い期間ラベル (まさ #19 2026-05-24)。
 * - 同じ月 → "4"
 * - 異なる月 → "4-5"
 * - 異なる年 → "2026/4-2027/3" (= 年またぎは年を出す)
 */
function compactPeriodLabel(startYm: string, endYm: string) {
  if (!startYm || startYm.length < 6 || !endYm || endYm.length < 6) {
    return `${formatYm(startYm)}-${formatYm(endYm)}`;
  }
  const sy = startYm.slice(0, 4);
  const sm = String(Number(startYm.slice(4, 6)));
  const ey = endYm.slice(0, 4);
  const em = String(Number(endYm.slice(4, 6)));
  if (sy === ey) {
    return sm === em ? sm : `${sm}-${em}`;
  }
  return `${sy}/${sm}-${ey}/${em}`;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function ymToIndex(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
  return y * 12 + (m - 1);
}

function indexToYm(index: number) {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function monthRange(startYm: string, endYm: string) {
  const start = ymToIndex(startYm);
  const end = ymToIndex(endYm);
  const months: string[] = [];
  for (let i = start; i <= end; i += 1) months.push(indexToYm(i));
  return months.length > 0 ? months : [startYm];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const CAP_EXTRA_TAGS = new Set([
  "cap_extra",
  "extra_contract",
  "contract_extra",
  "cap_outside",
  "uncapped",
]);

function isCapExtraTag(tag: string) {
  return CAP_EXTRA_TAGS.has(String(tag || "").trim().toLowerCase());
}

function effectiveMilestonePoints(ms: Milestone) {
  if (isCapExtraTag(ms.tag)) {
    const capExtraPoints = capExtraPointBasisForMilestone({
      points: ms.points,
      periodStartYm: ms.periodStartYm,
      targetYm: ms.targetYm,
    });
    if (capExtraPoints > 0) return capExtraPoints;
  }
  return roundPt(Math.max(0, ms.points));
}

function designAmountForPoints(points: number, pointBasis: number, budgetYen: number, roundedUnitYen: number) {
  const safeBudgetYen = toYenNumber(budgetYen);
  const safeUnitYen = toYenNumber(roundedUnitYen);
  if (pointBasis > 0 && safeBudgetYen > 0) return Math.round((Math.max(0, points) * safeBudgetYen) / pointBasis);
  return Math.round(Math.max(0, points) * safeUnitYen);
}

function toYenNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function formatYen(amount: number) {
  return `${toYenNumber(amount).toLocaleString("ja-JP")}円`;
}

type MsBudgetInfo = {
  designAmountYen: number;
  designUnitYen: number;
  effectivePoints: number;
  isCapExtra: boolean;
};

type Variant = "light" | "hud";

interface Milestone {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  successCriteria?: string;
  periodStartYm?: string | null;
  targetYm?: string | null;
}

interface SubItem {
  subItemId: string;
  milestoneId: string;
  title: string;
  weight: number;
  status: string;
  assignee: string;
}

interface Responsibility {
  milestoneId: string;
  memberId: string;
  share: number;
  role?: string;
  taskDescription?: string;
}

interface PlanCycle {
  budgetYen?: number;
  extraDesignBudgetYen?: number;
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
  status: string;
}

interface MsScheduleInfo {
  milestoneId: string;
  periodStartYm: string;
  targetYm: string;
  msMonths: number;
}

interface Progress {
  milestoneKey: string;
  ym: string;
  progressPct: number;
  source?: string | null;
  note?: string | null;
  confirmedAt?: string | null;
}

interface MemberMsActivity {
  memberId: string;
  milestoneId: string;
  ym: string;
  narrative?: string | null;
  learnedAddendum?: string | null;
  generatedAt?: string | null;
}

interface MemberActivity {
  id: string;
  memberId: string;
  projectId: string;
  ym: string;
  source: string;
  sourceItemId: string;
  milestoneId?: string | null;
  title?: string | null;
  contentPreview?: string | null;
  itemDate?: string | null;
  extractedAt: string;
}

interface Props {
  milestones: Milestone[];
  planCycle: PlanCycle;
  subItems: SubItem[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  schedules: Record<string, MsScheduleInfo>;
  variant?: Variant;
  progress?: Progress[];
  currentYm?: string;
  msActivities?: MemberMsActivity[];
  memberActivities?: MemberActivity[];
  onEdit?: () => void;
}

function tagLabel(tag: string) {
  const key = tag.toLowerCase();
  if (key === "routine") return "定常";
  if (key === "buffer") return "バッファ";
  return "年間";
}

function classes(variant: Variant) {
  if (variant === "hud") {
    return {
      section: "relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 px-4 py-3 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]",
      gridBg: "relative overflow-x-auto border border-cyan-300/22 bg-slate-950/72 font-mono [container-type:inline-size]",
      header: "border-b border-cyan-300/18 bg-cyan-300/8 text-cyan-100/68",
      row: "border-b border-cyan-300/14 hover:bg-cyan-300/6",
      left: "border-r border-cyan-300/18 bg-slate-950/84",
      month: "border-r border-cyan-300/12",
      title: "text-cyan-50",
      muted: "text-cyan-100/54",
      bar: "border border-cyan-300/42 bg-cyan-300/18 text-cyan-50 shadow-[0_0_14px_rgba(103,232,249,.2)]",
      chip: "border border-cyan-300/20 bg-slate-950/72 text-cyan-100/78",
      detail: "border-t border-cyan-300/18 text-cyan-50/78",
      edit: "border border-cyan-300/28 bg-cyan-300/8 px-1.5 py-0.5 text-[11px] font-bold text-cyan-100/70 transition-colors hover:bg-cyan-300/14 hover:text-white",
    };
  }
  return {
    section: "bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5",
    gridBg: "overflow-x-auto rounded-lg border border-[#e5e5e7] bg-white [container-type:inline-size]",
    header: "border-b border-[#e5e5e7] bg-[#fafafa] text-[#86868b]",
    row: "border-b border-[#f1f1f3] hover:bg-[#fafafa]",
    left: "border-r border-[#e5e5e7] bg-white",
    month: "border-r border-[#f1f1f3]",
    title: "text-[#1d1d1f]",
    muted: "text-[#86868b]",
    bar: "border border-[#b6d7ff] bg-[#eaf4ff] text-[#064f9e]",
    chip: "border border-white/70 bg-white/82 text-[#23527c]",
    detail: "border-t border-[#d1d5db] text-[#3c3c43]",
    edit: "text-[11px] text-[#86868b] hover:text-[#007aff] px-1.5 py-0.5 rounded hover:bg-[#007aff]/8 transition-colors",
  };
}

function tagClass(tag: string, variant: Variant) {
  const key = tag.toLowerCase();
  if (variant === "hud") {
    if (key === "routine") return "border-cyan-300/22 bg-cyan-300/10 text-cyan-100/70";
    if (key === "buffer") return "border-amber-300/32 bg-amber-300/12 text-amber-100";
    return "border-emerald-300/28 bg-emerald-300/12 text-emerald-100";
  }
  if (key === "routine") return "border-sky-200 bg-sky-50 text-sky-700";
  if (key === "buffer") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function compactSourceLabel(source: string) {
  const key = source.toLowerCase();
  if (key.includes("slack")) return "Slack";
  if (key.includes("gmail") || key.includes("mail")) return "Gmail";
  if (key.includes("calendar")) return "Calendar";
  if (key.includes("notion")) return "Notion";
  if (key.includes("drive")) return "Drive";
  if (key.includes("report")) return "Report";
  return source || "source";
}

function formatActivityDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function activityTimestamp(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function MilestoneGanttChart({
  milestones,
  planCycle,
  subItems,
  responsibilities,
  memberMap,
  schedules,
  variant = "light",
  progress = [],
  currentYm,
  msActivities = [],
  memberActivities = [],
  onEdit,
}: Props) {
  const c = classes(variant);
  const months = useMemo(
    () => monthRange(planCycle.periodStartYm, planCycle.periodEndYm),
    [planCycle.periodStartYm, planCycle.periodEndYm]
  );
  const orderedMs = useMemo(() => {
    const normal = milestones.filter((m) => {
      const tag = m.tag.toLowerCase();
      return tag !== "routine" && tag !== "buffer";
    });
    const routine = milestones.filter((m) => m.tag.toLowerCase() === "routine");
    const buffer = milestones.filter((m) => m.tag.toLowerCase() === "buffer");
    return [...normal, ...routine, ...buffer];
  }, [milestones]);

  const subItemMap = useMemo(() => {
    const map = new Map<string, SubItem[]>();
    for (const item of subItems) {
      const list = map.get(item.milestoneId) || [];
      list.push(item);
      map.set(item.milestoneId, list);
    }
    return map;
  }, [subItems]);

  const respMap = useMemo(() => {
    const map = new Map<string, Responsibility[]>();
    for (const item of responsibilities) {
      const list = map.get(item.milestoneId) || [];
      list.push(item);
      map.set(item.milestoneId, list);
    }
    return map;
  }, [responsibilities]);

  const progressYm = currentYm || planCycle.periodEndYm;
  const latestProgressByMilestone = useMemo(() => {
    const map = new Map<string, Progress>();
    for (const item of progress) {
      if (item.ym > progressYm) continue;
      const previous = map.get(item.milestoneKey);
      if (!previous || item.ym >= previous.ym) {
        map.set(item.milestoneKey, item);
      }
    }
    return map;
  }, [progress, progressYm]);

  const msActivityMap = useMemo(() => {
    const map = new Map<string, MemberMsActivity[]>();
    for (const item of msActivities) {
      const list = map.get(item.milestoneId) || [];
      list.push(item);
      map.set(item.milestoneId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.ym.localeCompare(a.ym) || activityTimestamp(b.generatedAt) - activityTimestamp(a.generatedAt));
    }
    return map;
  }, [msActivities]);

  const memberActivityMap = useMemo(() => {
    const map = new Map<string, MemberActivity[]>();
    for (const item of memberActivities) {
      if (!item.milestoneId) continue;
      const list = map.get(item.milestoneId) || [];
      list.push(item);
      map.set(item.milestoneId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => activityTimestamp(b.itemDate || b.extractedAt) - activityTimestamp(a.itemDate || a.extractedAt));
    }
    return map;
  }, [memberActivities]);

  const weightedAverage = orderedMs.length > 0
    ? Math.round(
        orderedMs.reduce((sum, ms) => sum + (latestProgressByMilestone.get(ms.milestoneId)?.progressPct ?? 0) * Math.max(1, ms.points), 0) /
          Math.max(1, orderedMs.reduce((sum, ms) => sum + Math.max(1, ms.points), 0))
      )
    : 0;
  const totalPts = orderedMs.reduce((sum, ms) => sum + ms.points, 0);
  const budgetInfoByMilestone = useMemo(() => {
    const regularPointBasis = pointBasisForPeriod(planCycle.periodStartYm, planCycle.periodEndYm);
    const regularDesignBudgetYen = toYenNumber(planCycle.budgetYen);
    const extraPoints = roundPt(
      milestones.filter((ms) => isCapExtraTag(ms.tag)).reduce((sum, ms) => sum + effectiveMilestonePoints(ms), 0)
    );
    const extraDesignBudgetYen = toYenNumber(planCycle.extraDesignBudgetYen);
    const regularDesignUnitYen = regularPointBasis > 0 ? Math.round(regularDesignBudgetYen / regularPointBasis) : 0;
    const extraDesignUnitYen = extraPoints > 0 && extraDesignBudgetYen > 0 ? Math.round(extraDesignBudgetYen / extraPoints) : 0;
    const map = new Map<string, MsBudgetInfo>();
    for (const ms of milestones) {
      const isExtra = isCapExtraTag(ms.tag);
      const effectivePoints = effectiveMilestonePoints(ms);
      const pointBasis = isExtra ? extraPoints : regularPointBasis;
      const designUnitYen = isExtra ? extraDesignUnitYen : regularDesignUnitYen;
      const budgetYen = isExtra ? extraDesignBudgetYen : regularDesignBudgetYen;
      map.set(ms.milestoneId, {
        designAmountYen: designAmountForPoints(effectivePoints, pointBasis, budgetYen, designUnitYen),
        designUnitYen,
        effectivePoints,
        isCapExtra: isExtra,
      });
    }
    return map;
  }, [milestones, planCycle.budgetYen, planCycle.extraDesignBudgetYen, planCycle.periodEndYm, planCycle.periodStartYm]);
  const gridTemplateColumns = `300px repeat(${months.length}, minmax(62px, 1fr))`;
  const minWidth = 300 + months.length * 72;

  return (
    <section className={c.section}>
      {variant === "hud" && (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:44px_100%,100%_8px]" />
      )}
      <div className="relative mb-3 flex items-center gap-2 text-[13px]">
        <span className={variant === "hud" ? "text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100" : "font-medium"}>
          {variant === "hud" ? "Milestone Gantt" : "年間マイルストーン"}
        </span>
        <span className={`ml-auto text-[12px] ${c.muted}`}>
          {formatYm(planCycle.periodStartYm)} 〜 {formatYm(planCycle.periodEndYm)}
        </span>
        <span className={`text-[12px] ${c.muted}`}>|</span>
        <span className="text-[12px]">{totalPts}pt</span>
        <span className={`text-[12px] ${c.muted}`}>|</span>
        <span className="text-[12px]">{(planCycle.status === "active" || planCycle.status === "fixed" || planCycle.status === "confirmed") ? "確定" : "下書き"}</span>
        {progress.length > 0 && (
          <>
            <span className={`text-[12px] ${c.muted}`}>|</span>
            <span className="text-[12px] font-semibold">{weightedAverage}%</span>
          </>
        )}
        {onEdit && (
          <button onClick={onEdit} className={c.edit}>
            {variant === "hud" ? "EDIT" : "編集"}
          </button>
        )}
      </div>

      <div className={c.gridBg}>
        <div style={{ minWidth }}>
          <div className={`grid ${c.header}`} style={{ gridTemplateColumns }}>
            <div className={`sticky left-0 z-10 px-3 py-2 text-[11px] font-medium ${c.left}`}>MS / effort / 設計額</div>
            {months.map((month) => (
              <div key={month} className={`px-2 py-2 text-center text-[10px] font-medium ${c.month}`}>
                {formatYm(month)}
              </div>
            ))}
          </div>
          {orderedMs.map((ms, idx) => (
            <GanttRow
              key={ms.milestoneId}
              order={idx + 1}
              ms={ms}
              months={months}
              planCycle={planCycle}
              schedule={schedules[ms.milestoneId]}
              resps={respMap.get(ms.milestoneId) || []}
              subItems={subItemMap.get(ms.milestoneId) || []}
              progress={latestProgressByMilestone.get(ms.milestoneId)}
              msActivities={msActivityMap.get(ms.milestoneId) || []}
              memberActivities={memberActivityMap.get(ms.milestoneId) || []}
              budgetInfo={budgetInfoByMilestone.get(ms.milestoneId)}
              memberMap={memberMap}
              gridTemplateColumns={gridTemplateColumns}
              variant={variant}
              c={c}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function GanttRow({
  order,
  ms,
  months,
  planCycle,
  schedule,
  resps,
  subItems,
  progress,
  msActivities,
  memberActivities,
  budgetInfo,
  memberMap,
  gridTemplateColumns,
  variant,
  c,
}: {
  order: number;
  ms: Milestone;
  months: string[];
  planCycle: PlanCycle;
  schedule?: MsScheduleInfo;
  resps: Responsibility[];
  subItems: SubItem[];
  progress?: Progress;
  msActivities: MemberMsActivity[];
  memberActivities: MemberActivity[];
  budgetInfo?: MsBudgetInfo;
  memberMap: Record<string, string>;
  gridTemplateColumns: string;
  variant: Variant;
  c: ReturnType<typeof classes>;
}) {
  const [expanded, setExpanded] = useState(false);
  const startYm = ms.periodStartYm || schedule?.periodStartYm || planCycle.periodStartYm;
  const endYm = ms.targetYm || schedule?.targetYm || planCycle.periodEndYm;
  const planStart = ymToIndex(months[0] || planCycle.periodStartYm);
  const planEnd = ymToIndex(months[months.length - 1] || planCycle.periodEndYm);
  const startIndex = clamp(ymToIndex(startYm), planStart, planEnd) - planStart;
  const endIndex = clamp(ymToIndex(endYm), planStart, planEnd) - planStart;
  const gridColumn = `${startIndex + 2} / ${endIndex + 3}`;
  const doneCount = subItems.filter((item) => item.status === "done").length;
  const openCount = subItems.length - doneCount;
  const ownerTasks = resps.filter((resp) => resp.taskDescription?.trim());
  const currentNotes = [
    progress?.note?.trim() ? progress.note.trim() : null,
    ...msActivities
      .map((activity) => activity.narrative?.trim() || activity.learnedAddendum?.trim() || null)
      .filter((value): value is string => Boolean(value)),
  ].slice(0, 3);
  const recentActivities = memberActivities
    .filter((activity) => activity.title?.trim() || activity.contentPreview?.trim())
    .slice(0, 4);
  const taskCardClass = variant === "hud"
    ? "rounded-md border border-cyan-300/16 bg-slate-900/50 px-2 py-1.5 text-[11px] leading-snug text-cyan-50/74"
    : "rounded-md border border-slate-200/70 bg-white/70 px-2 py-1.5 text-[11px] leading-snug text-slate-700";
  const taskOwnerClass = variant === "hud" ? "font-medium text-cyan-50/88" : "font-medium text-slate-800";
  const currentTextClass = variant === "hud" ? "text-[11px] leading-snug text-cyan-50/76 whitespace-pre-wrap" : "text-[11px] leading-snug text-slate-700 whitespace-pre-wrap";
  const dividerClass = variant === "hud" ? "mt-2 border-t border-cyan-300/18 pt-2" : "mt-2 border-t border-slate-200/70 pt-2";
  const activityTextClass = variant === "hud" ? "text-[10px] leading-snug text-cyan-50/64" : "text-[10px] leading-snug text-slate-600";
  const activityStrongClass = variant === "hud" ? "font-medium text-cyan-50/82" : "font-medium text-slate-700";
  const activityMetaClass = variant === "hud" ? "text-cyan-100/42" : "text-slate-400";
  const budgetTextClass = variant === "hud" ? "font-semibold text-cyan-50/88" : "font-semibold text-[#1d1d1f]";
  const budgetTitle = budgetInfo
    ? `設計額 ${formatYen(budgetInfo.designAmountYen)} / ${budgetInfo.isCapExtra ? "別財布" : "本契約"} / 有効pt ${budgetInfo.effectivePoints} / 単価 ${formatYen(budgetInfo.designUnitYen)}`
    : "";

  return (
    <div className={c.row}>
      <div className="grid min-h-[54px]" style={{ gridTemplateColumns }}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={`${ms.title} の進捗詳細を${expanded ? "閉じる" : "開く"}`}
          className={`sticky left-0 z-10 flex min-w-0 items-center gap-2 px-3 py-2 text-left ${c.left}`}
        >
          <span className={`w-5 shrink-0 text-right text-[11px] ${c.muted}`}>{order}.</span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[12px] font-semibold ${c.title}`}>{ms.title}</span>
            <span className={`mt-0.5 flex flex-wrap items-center gap-1 text-[10px] ${c.muted}`}>
              <span>{ms.points}pt</span>
              <span className={`rounded border px-1 py-0.5 ${tagClass(ms.tag, variant)}`}>{tagLabel(ms.tag)}</span>
              {subItems.length > 0 && <span>{doneCount}/{subItems.length}</span>}
              {budgetInfo && (
                <span className={budgetTextClass} title={budgetTitle}>
                  設計額 {formatYen(budgetInfo.designAmountYen)}
                </span>
              )}
              {progress && <span>{Math.round(progress.progressPct)}%</span>}
            </span>
          </span>
          <span className={`shrink-0 text-[10px] ${c.muted}`}>{expanded ? "▼" : "▶"}</span>
        </button>
        {months.map((month) => (
          <div key={month} className={c.month} />
        ))}
        {/* MS Gantt bar — まさ #19 (2026-05-24):
              - 期間表示は「4-5」のみ (年・0 padding なし)、同じ月なら「4」だけ
              - メンバー/pt chip は期間表示の右ではなく改行下に置いて、短い MS でも見えるように
              - バーからはみ出ても表示可能 (overflow visible)、min-w-0 で flex 子の縮みも許可 */}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-label={`${ms.title} の進捗詳細を${expanded ? "閉じる" : "開く"}`}
          className={`z-[1] my-2 flex min-w-0 flex-col items-start gap-0.5 px-2 py-1 text-left ${c.bar}`}
          style={{ gridColumn, gridRow: 1, overflow: "visible" }}
          title={`${ms.title}: ${formatYm(startYm)} - ${formatYm(endYm)}${budgetInfo ? ` / ${budgetTitle}` : ""}`}
        >
          <span className="shrink-0 text-[10px] font-semibold whitespace-nowrap">
            {compactPeriodLabel(startYm, endYm)}
          </span>
          <span className="flex flex-wrap items-center gap-1 whitespace-nowrap">
            {resps.length === 0 ? (
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.chip}`}>未割当</span>
            ) : (
              resps.map((resp) => (
                <span key={`${resp.memberId}-${resp.role || ""}`} className={`rounded px-1.5 py-0.5 text-[10px] ${c.chip}`}>
                  {memberMap[resp.memberId] || "PM"} {Math.round(resp.share * 100)}% / {Math.round(ms.points * resp.share * 10) / 10}pt
                </span>
              ))
            )}
          </span>
        </button>
      </div>
      {expanded && (
        <div className={`sticky left-0 box-border w-[100cqw] max-w-[100cqw] px-3 py-3 text-[12px] ${c.detail}`}>
          <div className="grid gap-2 xl:grid-cols-3">
            <DetailPanel title="ゴール" variant={variant}>
              <p className={`text-[11px] leading-snug whitespace-pre-wrap ${ms.successCriteria ? "" : c.muted}`}>
                {ms.successCriteria?.trim() || "完了条件は未設定。MS編集から success criteria を入れると、ここが追跡の基準になる。"}
              </p>
              <div className={`mt-2 flex flex-wrap gap-1.5 text-[10px] ${c.muted}`}>
                <span>{formatYm(startYm)} - {formatYm(endYm)}</span>
                <span>{ms.points}pt</span>
                <span>{tagLabel(ms.tag)}</span>
              </div>
              {resps.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {resps.map((resp) => (
                    <span key={`${resp.memberId}-${resp.role || ""}`} className={`rounded px-2 py-1 text-[10px] ${c.chip}`}>
                      {memberMap[resp.memberId] || resp.memberId} {Math.round(resp.share * 100)}%
                      {resp.role ? ` / ${resp.role}` : ""}
                    </span>
                  ))}
                </div>
              )}
              {budgetInfo && (
                <div className={`mt-2 flex flex-wrap gap-1.5 text-[10px] ${c.muted}`} title={budgetTitle}>
                  <span>設計額 {formatYen(budgetInfo.designAmountYen)}</span>
                  <span>単価 {formatYen(budgetInfo.designUnitYen)}</span>
                  <span>{budgetInfo.isCapExtra ? "別財布" : "本契約"}</span>
                </div>
              )}
            </DetailPanel>

            <DetailPanel title="TODO" variant={variant}>
              {ownerTasks.length > 0 && (
                <div className="mb-2 space-y-1">
                  {ownerTasks.map((resp) => (
                    <div key={`${resp.memberId}-${resp.role || ""}-task`} className={taskCardClass}>
                      <span className={taskOwnerClass}>{memberMap[resp.memberId] || resp.memberId}: </span>
                      {resp.taskDescription}
                    </div>
                  ))}
                </div>
              )}
              {subItems.length > 0 ? (
                <>
                  <div className={`mb-1.5 text-[10px] ${c.muted}`}>
                    open {openCount} / done {doneCount}
                  </div>
                  <SubItemList subItems={subItems} />
                </>
              ) : ownerTasks.length === 0 ? (
                <p className={`text-[11px] ${c.muted}`}>TODO未設定。MSのサブアイテムか担当タスクを入れるとここに出る。</p>
              ) : null}
            </DetailPanel>

            <DetailPanel title="現状" variant={variant}>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[18px] font-semibold text-[#0066cc]">{Math.round(progress?.progressPct ?? 0)}%</span>
                {progress?.ym && <span className={`text-[10px] ${c.muted}`}>{formatYm(progress.ym)} 時点</span>}
                {progress?.source && <span className={`rounded px-1.5 py-0.5 text-[10px] ${c.chip}`}>{progress.source}</span>}
              </div>
              {currentNotes.length > 0 ? (
                <div className="space-y-1.5">
                  {currentNotes.map((note, index) => (
                    <p key={`${ms.milestoneId}-note-${index}`} className={currentTextClass}>
                      {note}
                    </p>
                  ))}
                </div>
              ) : (
                <p className={`text-[11px] ${c.muted}`}>進捗メモはまだ薄い。月次モーダルで修正依頼すると、ここに判断材料が残る。</p>
              )}
              {recentActivities.length > 0 && (
                <div className={dividerClass}>
                  <div className={`mb-1 text-[10px] font-medium ${c.muted}`}>最近の材料</div>
                  <div className="space-y-1.5">
                    {recentActivities.map((activity) => {
                      const body = activity.title?.trim() && activity.contentPreview?.trim()
                        ? `${activity.title.trim()} - ${activity.contentPreview.trim()}`
                        : activity.contentPreview?.trim() || activity.title?.trim() || "";
                      return (
                        <div key={activity.id} className={activityTextClass}>
                          <span className={activityStrongClass}>{memberMap[activity.memberId] || activity.memberId}</span>
                          <span className={activityMetaClass}> / {compactSourceLabel(activity.source)}</span>
                          {formatActivityDate(activity.itemDate || activity.extractedAt) && (
                            <span className={activityMetaClass}> / {formatActivityDate(activity.itemDate || activity.extractedAt)}</span>
                          )}
                          <div className="mt-0.5 line-clamp-2">{body}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </DetailPanel>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ title, variant, children }: { title: string; variant: Variant; children: ReactNode }) {
  const panelClass = variant === "hud"
    ? "rounded-md border border-cyan-300/18 bg-slate-950/58 px-3 py-2"
    : "rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2";
  const titleClass = variant === "hud"
    ? "mb-1.5 text-[10px] font-semibold uppercase text-cyan-100/70"
    : "mb-1.5 text-[10px] font-semibold uppercase text-slate-500";
  return (
    <div className={panelClass}>
      <div className={titleClass}>{title}</div>
      {children}
    </div>
  );
}

function SubItemList({ subItems: initialItems }: { subItems: SubItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleToggle = useCallback(async (item: SubItem) => {
    const newStatus = item.status === "done" ? "open" : "done";
    setToggling(item.subItemId);
    setItems((prev) => prev.map((s) => s.subItemId === item.subItemId ? { ...s, status: newStatus } : s));
    const ok = await toggleSubItemStatus(item.subItemId, newStatus);
    if (!ok) {
      setItems((prev) => prev.map((s) => s.subItemId === item.subItemId ? { ...s, status: item.status } : s));
    }
    setToggling(null);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => (
        <button
          key={item.subItemId}
          onClick={() => handleToggle(item)}
          disabled={toggling === item.subItemId}
          className={`flex items-center gap-2 rounded px-2 py-1 text-left text-[11px] transition-colors ${
            item.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span className="shrink-0">{item.status === "done" ? "✓" : "□"}</span>
          <span className="flex-1">{item.title}</span>
          {item.assignee && <span className="text-[10px] opacity-70">{item.assignee}</span>}
        </button>
      ))}
    </div>
  );
}
