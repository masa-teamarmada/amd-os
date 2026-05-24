"use client";

import { useCallback, useMemo, useState } from "react";
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

type Variant = "light" | "hud";

interface Milestone {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
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
      gridBg: "relative overflow-x-auto border border-cyan-300/22 bg-slate-950/72 font-mono",
      header: "border-b border-cyan-300/18 bg-cyan-300/8 text-cyan-100/68",
      row: "border-b border-cyan-300/14 hover:bg-cyan-300/6",
      left: "border-r border-cyan-300/18 bg-slate-950/84",
      month: "border-r border-cyan-300/12",
      title: "text-cyan-50",
      muted: "text-cyan-100/54",
      bar: "border border-cyan-300/42 bg-cyan-300/18 text-cyan-50 shadow-[0_0_14px_rgba(103,232,249,.2)]",
      chip: "border border-cyan-300/20 bg-slate-950/72 text-cyan-100/78",
      detail: "border-l border-cyan-300/18 text-cyan-50/78",
      edit: "border border-cyan-300/28 bg-cyan-300/8 px-1.5 py-0.5 text-[11px] font-bold text-cyan-100/70 transition-colors hover:bg-cyan-300/14 hover:text-white",
    };
  }
  return {
    section: "bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5",
    gridBg: "overflow-x-auto rounded-lg border border-[#e5e5e7] bg-white",
    header: "border-b border-[#e5e5e7] bg-[#fafafa] text-[#86868b]",
    row: "border-b border-[#f1f1f3] hover:bg-[#fafafa]",
    left: "border-r border-[#e5e5e7] bg-white",
    month: "border-r border-[#f1f1f3]",
    title: "text-[#1d1d1f]",
    muted: "text-[#86868b]",
    bar: "border border-[#b6d7ff] bg-[#eaf4ff] text-[#064f9e]",
    chip: "border border-white/70 bg-white/82 text-[#23527c]",
    detail: "border-l border-[#d1d5db] text-[#3c3c43]",
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
  const progressByMilestone = new Map<string, number>();
  for (const item of progress) {
    if (item.ym > progressYm) continue;
    const previousYm = progressByMilestone.get(`${item.milestoneKey}:ym`) as number | undefined;
    if (!previousYm || Number(item.ym) >= previousYm) {
      progressByMilestone.set(item.milestoneKey, item.progressPct);
      progressByMilestone.set(`${item.milestoneKey}:ym`, Number(item.ym));
    }
  }
  const weightedAverage = orderedMs.length > 0
    ? Math.round(
        orderedMs.reduce((sum, ms) => sum + (progressByMilestone.get(ms.milestoneId) ?? 0) * Math.max(1, ms.points), 0) /
          Math.max(1, orderedMs.reduce((sum, ms) => sum + Math.max(1, ms.points), 0))
      )
    : 0;
  const totalPts = orderedMs.reduce((sum, ms) => sum + ms.points, 0);
  const gridTemplateColumns = `260px repeat(${months.length}, minmax(62px, 1fr))`;
  const minWidth = 260 + months.length * 72;

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
            <div className={`sticky left-0 z-10 px-3 py-2 text-[11px] font-medium ${c.left}`}>MS / effort</div>
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

  return (
    <div className={c.row}>
      <div className="grid min-h-[54px]" style={{ gridTemplateColumns }}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={`sticky left-0 z-10 flex min-w-0 items-center gap-2 px-3 py-2 text-left ${c.left}`}
        >
          <span className={`w-5 shrink-0 text-right text-[11px] ${c.muted}`}>{order}.</span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[12px] font-semibold ${c.title}`}>{ms.title}</span>
            <span className={`mt-0.5 flex flex-wrap items-center gap-1 text-[10px] ${c.muted}`}>
              <span>{ms.points}pt</span>
              <span className={`rounded border px-1 py-0.5 ${tagClass(ms.tag, variant)}`}>{tagLabel(ms.tag)}</span>
              {subItems.length > 0 && <span>{doneCount}/{subItems.length}</span>}
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
          className={`z-[1] my-2 flex min-w-0 flex-col items-start gap-0.5 px-2 py-1 text-left ${c.bar}`}
          style={{ gridColumn, gridRow: 1, overflow: "visible" }}
          title={`${ms.title}: ${formatYm(startYm)} - ${formatYm(endYm)}`}
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
        <div className={`ml-[260px] px-3 py-2 text-[12px] ${c.detail}`}>
          {resps.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {resps.map((resp) => (
                <span key={`${resp.memberId}-${resp.role || ""}`} className={`rounded px-2 py-1 text-[11px] ${c.chip}`}>
                  {memberMap[resp.memberId] || "PM"}: {Math.round(resp.share * 100)}% / {Math.round(ms.points * resp.share * 10) / 10}pt
                  {resp.role ? ` / ${resp.role}` : ""}
                  {resp.taskDescription ? ` / ${resp.taskDescription}` : ""}
                </span>
              ))}
            </div>
          )}
          {subItems.length > 0 ? (
            <SubItemList subItems={subItems} />
          ) : (
            <p className={`text-[11px] ${c.muted}`}>サブMSなし</p>
          )}
        </div>
      )}
    </div>
  );
}

function SubItemList({ subItems: initialItems }: { subItems: SubItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [toggling, setToggling] = useState<string | null>(null);

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
