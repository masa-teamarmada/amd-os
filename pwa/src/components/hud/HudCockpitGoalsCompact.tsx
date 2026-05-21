"use client";

import { useEffect, useState, useCallback } from "react";
import { toggleSubItemStatus } from "@/lib/supabase-data";

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

interface Milestone {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
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

interface Progress {
  milestoneKey: string;
  ym: string;
  progressPct: number;
}

interface MsScheduleInfo {
  milestoneId: string;
  periodStartYm: string;
  targetYm: string;
  msMonths: number;
}

interface Props {
  milestones: Milestone[];
  planCycle: PlanCycle;
  projectId: string;
  subItems: SubItem[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>; // memberId → codeName
  progress?: Progress[];
  currentYm?: string;
  onEdit?: () => void;
}

export function HudCockpitGoalsCompact({ milestones, planCycle, projectId, subItems, responsibilities, memberMap, progress = [], currentYm, onEdit }: Props) {
  const totalPts = milestones.reduce((s, m) => s + m.points, 0);
  const annualMs = milestones.filter((m) => m.tag === "normal");
  const routineMs = milestones.filter((m) => m.tag === "routine");
  const bufferMs = milestones.filter((m) => m.tag === "buffer");
  const matrixRows = [...annualMs, ...routineMs, ...bufferMs];
  const [schedules, setSchedules] = useState<Record<string, MsScheduleInfo>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadSchedules() {
      if (!projectId || !planCycle.periodStartYm) {
        setSchedules({});
        return;
      }
      try {
        const res = await fetch(`/api/progress/ms-schedule?projectId=${projectId}&startYm=${planCycle.periodStartYm}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "schedule load failed");
        const map: Record<string, MsScheduleInfo> = {};
        for (const item of data.schedules || []) {
          map[item.milestoneId] = item;
        }
        if (!cancelled) setSchedules(map);
      } catch {
        if (!cancelled) setSchedules({});
      }
    }
    loadSchedules();
    return () => {
      cancelled = true;
    };
  }, [projectId, planCycle.periodStartYm]);

  // サブアイテムをMS別にグループ化
  const subItemMap = new Map<string, SubItem[]>();
  for (const si of subItems) {
    const arr = subItemMap.get(si.milestoneId) || [];
    arr.push(si);
    subItemMap.set(si.milestoneId, arr);
  }

  // 責任者をMS別にグループ化
  const respMap = new Map<string, Responsibility[]>();
  for (const r of responsibilities) {
    const arr = respMap.get(r.milestoneId) || [];
    arr.push(r);
    respMap.set(r.milestoneId, arr);
  }
  const progressYm = currentYm || planCycle.periodEndYm;
  const progressByMilestone = new Map<string, number>();
  for (const item of progress) {
    if (item.ym > progressYm) continue;
    const key = item.milestoneKey;
    const prev = progressByMilestone.get(`${key}:ym`) as number | undefined;
    if (!prev || Number(item.ym) >= prev) {
      progressByMilestone.set(key, item.progressPct);
      progressByMilestone.set(`${key}:ym`, Number(item.ym));
    }
  }
  const weightedAverage = matrixRows.length > 0
    ? Math.round(
        matrixRows.reduce((sum, ms) => sum + (progressByMilestone.get(ms.milestoneId) ?? 0) * Math.max(1, ms.points), 0) /
          Math.max(1, matrixRows.reduce((sum, ms) => sum + Math.max(1, ms.points), 0))
      )
    : 0;

  return (
    <section className="relative overflow-hidden border border-cyan-300/35 bg-slate-950/88 px-4 py-3 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:44px_100%,100%_8px]" />
      {/* Header: info bar */}
      <div className="relative mb-2 flex items-center gap-2 text-[13px]">
        <span className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">Milestone Matrix</span>
        <span className="ml-auto font-mono text-[12px] tabular-nums text-cyan-100/70">
          {formatYm(planCycle.periodStartYm)} 〜 {formatYm(planCycle.periodEndYm)}
        </span>
        <span className="text-[12px] text-cyan-100/35">|</span>
        <span className="font-mono text-[12px] tabular-nums text-cyan-50">{totalPts}pt</span>
        <span className="text-[12px] text-cyan-100/35">|</span>
        <span className="text-[12px] font-bold text-cyan-100/82">{(planCycle.status === "active" || planCycle.status === "fixed" || planCycle.status === "confirmed") ? "確定" : "下書き"}</span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="border border-cyan-300/28 bg-cyan-300/8 px-1.5 py-0.5 text-[11px] font-bold text-cyan-100/70 transition-colors hover:bg-cyan-300/14 hover:text-white"
          >
            EDIT
          </button>
        )}
      </div>
      <div className="relative overflow-hidden border border-cyan-300/22 bg-slate-950/72 px-3 py-2 font-mono">
        {annualMs.length > 0 && (
          <div className="mb-2">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/58">Annual Goals</p>
            {annualMs.map((ms, idx) => (
              <MsRow
                key={ms.milestoneId}
                ms={ms}
                order={idx + 1}
                subItems={subItemMap.get(ms.milestoneId) || []}
                resps={respMap.get(ms.milestoneId) || []}
                memberMap={memberMap}
                schedule={schedules[ms.milestoneId]}
                planStartYm={planCycle.periodStartYm}
                planEndYm={planCycle.periodEndYm}
              />
            ))}
          </div>
        )}

        {routineMs.length > 0 && (
          <div className="mb-2">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/58">Routine</p>
            {routineMs.map((ms, idx) => (
              <MsRow
                key={ms.milestoneId}
                ms={ms}
                order={annualMs.length + idx + 1}
                subItems={subItemMap.get(ms.milestoneId) || []}
                resps={respMap.get(ms.milestoneId) || []}
                memberMap={memberMap}
                schedule={schedules[ms.milestoneId]}
                planStartYm={planCycle.periodStartYm}
                planEndYm={planCycle.periodEndYm}
              />
            ))}
          </div>
        )}

        {bufferMs.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/58">Buffer</p>
            {bufferMs.map((ms, idx) => (
              <MsRow
                key={ms.milestoneId}
                ms={ms}
                order={annualMs.length + routineMs.length + idx + 1}
                subItems={subItemMap.get(ms.milestoneId) || []}
                resps={respMap.get(ms.milestoneId) || []}
                memberMap={memberMap}
                schedule={schedules[ms.milestoneId]}
                planStartYm={planCycle.periodStartYm}
                planEndYm={planCycle.periodEndYm}
              />
            ))}
          </div>
        )}
      </div>
      <div className="relative mt-2 grid grid-cols-[170px_1fr_54px] items-center gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Weighted MS Average</div>
        <div className="h-2 border border-cyan-300/20 bg-slate-950">
          <div className="h-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.75)]" style={{ width: `${Math.min(100, weightedAverage)}%` }} />
        </div>
        <div className="text-right font-mono text-[15px] font-black text-cyan-100">{weightedAverage}%</div>
      </div>
    </section>
  );
}

function MsRow({
  ms, order, subItems, resps, memberMap, schedule, planStartYm, planEndYm,
}: {
  ms: Milestone;
  order: number;
  subItems: SubItem[];
  resps: Responsibility[];
  memberMap: Record<string, string>;
  schedule?: MsScheduleInfo;
  planStartYm: string;
  planEndYm: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = true;
  const doneCount = subItems.filter((s) => s.status === "done").length;
  const startYm = schedule?.periodStartYm || planStartYm;
  const endYm = schedule?.targetYm || planEndYm;

  return (
    <div className="border-b border-cyan-300/16 last:border-0">
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 py-[5px] text-left text-[13px] ${hasDetail ? "cursor-pointer hover:bg-cyan-300/8" : "cursor-default"}`}
      >
        <span className="w-5 shrink-0 text-right font-mono text-cyan-200/55">{order}.</span>
        <span className="min-w-0 flex-1 text-cyan-50">
          {ms.title}
          {subItems.length > 0 && (
            <span className="ml-1.5 font-mono text-[11px] text-cyan-100/50">
              ({doneCount}/{subItems.length})
            </span>
          )}
        </span>
        {ms.tag === "buffer" && (
          <span className="shrink-0 border border-amber-300/32 bg-amber-300/12 px-1.5 text-[11px] text-amber-100">buffer</span>
        )}
        {ms.points > 0 && (
          <span className="w-8 shrink-0 text-right font-mono text-[12px] text-cyan-100/62">{ms.points}pt</span>
        )}
        {hasDetail && (
          <span className={`shrink-0 text-[10px] text-cyan-100/58 transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
        )}
      </button>

      {expanded && (
        <div className="ml-7 flex flex-wrap items-center gap-2 border-l border-cyan-300/18 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100/58">
          <span className="text-cyan-300/68">Period</span>
          <span className="text-cyan-50/78">{formatYm(startYm)}</span>
          <span className="text-cyan-100/32">to</span>
          <span className="text-cyan-50/78">{formatYm(endYm)}</span>
        </div>
      )}

      {/* 展開: 責任者詳細（role/taskDescription） */}
      {expanded && resps.some((r) => r.role || r.taskDescription) && (
        <div className="ml-7 space-y-1 border-l border-cyan-300/18 px-3 pb-1.5">
          {resps.map((r) => (
            <div key={`${r.memberId}-${r.role}`} className="flex items-start gap-2 text-[12px]">
              <span className="min-w-[44px] font-bold text-cyan-100">
                {memberMap[r.memberId] || "PM"}
              </span>
              <span className="shrink-0 border border-cyan-300/18 bg-slate-900/80 px-1.5 py-0.5 text-[11px] text-cyan-100/62">
                {r.role || "担当"}
              </span>
              {r.taskDescription && (
                <span className="flex-1 text-[12px] text-cyan-50/78">{r.taskDescription}</span>
              )}
              {r.share > 0 && (
                <span className="shrink-0 font-mono text-[11px] text-cyan-100/42">
                  {Math.round(r.share * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && !resps.some((r) => r.role || r.taskDescription) && subItems.length === 0 && (
        <div className="ml-7 grid gap-1.5 border-l border-cyan-300/18 px-3 py-2 text-[12px] text-cyan-50/70">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-cyan-300/18 bg-cyan-300/8 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100/72">
              {ms.milestoneId}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100/50">
              {ms.tag || "normal"} / {ms.points || 0}pt
            </span>
          </div>
          <p className="text-cyan-50/72">このMSには未分解のサブタスクはまだ登録されていません。</p>
        </div>
      )}

      {/* サブアイテム展開 */}
      {expanded && subItems.length > 0 && (
        <SubItemList subItems={subItems} />
      )}
    </div>
  );
}

function SubItemList({ subItems: initialItems }: { subItems: SubItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = useCallback(async (si: SubItem) => {
    const newStatus = si.status === "done" ? "open" : "done";
    setToggling(si.subItemId);

    // Optimistic update
    setItems((prev) =>
      prev.map((s) =>
        s.subItemId === si.subItemId ? { ...s, status: newStatus } : s
      )
    );

    const ok = await toggleSubItemStatus(si.subItemId, newStatus);
    if (!ok) {
      // Revert on failure
      setItems((prev) =>
        prev.map((s) =>
          s.subItemId === si.subItemId ? { ...s, status: si.status } : s
        )
      );
    }
    setToggling(null);
  }, []);

  return (
    <div className="ml-7 space-y-0.5 pb-2">
      {items.map((si) => (
        <button
          key={si.subItemId}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(si);
          }}
          disabled={toggling === si.subItemId}
          className="flex w-full items-center gap-1.5 px-0.5 py-0.5 text-left text-[12px] transition-colors hover:bg-cyan-300/8 disabled:opacity-50"
        >
          <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors ${
            si.status === "done"
              ? "border-emerald-300 bg-emerald-300 text-slate-950"
              : "border-cyan-300/35 hover:border-cyan-100"
          }`}>
            {si.status === "done" && (
              <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span className={si.status === "done" ? "text-cyan-100/42 line-through" : "text-cyan-50/88"}>
            {si.title}
          </span>
        </button>
      ))}
    </div>
  );
}
