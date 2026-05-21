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
  onEdit?: () => void;
}

export function CockpitGoalsCompact({ milestones, planCycle, projectId, subItems, responsibilities, memberMap, onEdit }: Props) {
  const totalPts = milestones.reduce((s, m) => s + m.points, 0);
  const annualMs = milestones.filter((m) => m.tag === "normal");
  const routineMs = milestones.filter((m) => m.tag === "routine");
  const bufferMs = milestones.filter((m) => m.tag === "buffer");
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

  return (
    <section className="bg-white rounded-xl border border-[#e5e5e7] px-4 py-3.5">
      {/* Header: info bar */}
      <div className="flex items-center gap-2 mb-3 text-[13px]">
        <span className="font-medium">年間マイルストーン</span>
        <span className="text-[#86868b] text-[12px] ml-auto">
          {formatYm(planCycle.periodStartYm)} 〜 {formatYm(planCycle.periodEndYm)}
        </span>
        <span className="text-[#86868b] text-[12px]">|</span>
        <span className="text-[12px]">{totalPts}pt</span>
        <span className="text-[#86868b] text-[12px]">|</span>
        <span className="text-[12px]">{(planCycle.status === "active" || planCycle.status === "fixed" || planCycle.status === "confirmed") ? "確定" : "下書き"}</span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[11px] text-[#86868b] hover:text-[#007aff] px-1.5 py-0.5 rounded hover:bg-[#007aff]/8 transition-colors"
          >
            ✏ 編集
          </button>
        )}
      </div>

      {/* 🎯 Annual goals */}
      {annualMs.length > 0 && (
        <div className="mb-2">
          <p className="text-[12px] text-[#86868b] mb-1.5 font-medium">🎯 年間目標</p>
          {annualMs.map((ms, idx) => (
            <MsRow
              key={ms.milestoneId}
              ms={ms}
              order={idx + 1}
              subItems={subItemMap.get(ms.milestoneId) || []}
              resps={respMap.get(ms.milestoneId) || []}
              memberMap={memberMap}
              schedule={schedules[ms.milestoneId]}
            />
          ))}
        </div>
      )}

      {/* 🔄 Routine */}
      {routineMs.length > 0 && (
        <div className="mb-2">
          <p className="text-[12px] text-[#86868b] mb-1.5 font-medium">🔄 定常業務</p>
          {routineMs.map((ms, idx) => (
            <MsRow
              key={ms.milestoneId}
              ms={ms}
              order={annualMs.length + idx + 1}
              subItems={subItemMap.get(ms.milestoneId) || []}
              resps={respMap.get(ms.milestoneId) || []}
              memberMap={memberMap}
              schedule={schedules[ms.milestoneId]}
            />
          ))}
        </div>
      )}

      {/* 🛡 Buffer */}
      {bufferMs.length > 0 && (
        <div>
          <p className="text-[12px] text-[#86868b] mb-1.5 font-medium">🛡 バッファ（予期せぬタスク用）</p>
          {bufferMs.map((ms, idx) => (
            <MsRow
              key={ms.milestoneId}
              ms={ms}
              order={annualMs.length + routineMs.length + idx + 1}
              subItems={subItemMap.get(ms.milestoneId) || []}
              resps={respMap.get(ms.milestoneId) || []}
              memberMap={memberMap}
              schedule={schedules[ms.milestoneId]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MsRow({
  ms, order, subItems, resps, memberMap, schedule,
}: {
  ms: Milestone;
  order: number;
  subItems: SubItem[];
  resps: Responsibility[];
  memberMap: Record<string, string>;
  schedule?: MsScheduleInfo;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = subItems.length > 0 || resps.length > 0;
  const doneCount = subItems.filter((s) => s.status === "done").length;

  return (
    <div className="border-b border-[#f5f5f7] last:border-0">
      {/* Main row */}
      <button
        onClick={() => hasDetail && setExpanded(!expanded)}
        className={`w-full flex items-baseline gap-2 py-[4px] text-[13px] text-left ${hasDetail ? "cursor-pointer hover:bg-[#fafafa]" : "cursor-default"}`}
      >
        <span className="text-[#86868b] w-5 text-right shrink-0">{order}.</span>
        <span className="flex-1 min-w-0">
          {ms.title}
          {subItems.length > 0 && (
            <span className="text-[11px] text-[#86868b] ml-1.5">
              ({doneCount}/{subItems.length})
            </span>
          )}
          {schedule && (
            <span
              className="ml-2 text-[10px] text-[#86868b] bg-[#f5f5f7] px-1.5 py-0.5 rounded align-middle whitespace-nowrap"
              title={schedule.periodStartYm === schedule.targetYm
                ? `MS期間: ${formatYm(schedule.targetYm)}`
                : `MS期間: ${formatYm(schedule.periodStartYm)} 〜 ${formatYm(schedule.targetYm)}`}
            >
              {schedule.periodStartYm === schedule.targetYm
                ? `${formatYm(schedule.targetYm)}まで`
                : `${formatYm(schedule.periodStartYm)}〜${formatYm(schedule.targetYm)}`}
            </span>
          )}
        </span>

        {/* 責任者バッジ */}
        {resps.length > 0 && (
          <span className="flex gap-0.5 shrink-0 flex-wrap">
            {resps.map((r) => (
              <span key={`${r.memberId}-${r.role}`} className="text-[10px] text-[#007aff] bg-[#007aff]/8 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <span>{memberMap[r.memberId] || "PM"}</span>
                {r.role && r.role !== "担当" && (
                  <span className="text-[9px] text-[#007aff]/60">{r.role}</span>
                )}
                {resps.length > 1 && r.share > 0 && (
                  <span className="text-[9px] opacity-50">{Math.round(r.share * 100)}%</span>
                )}
              </span>
            ))}
          </span>
        )}

        {ms.tag === "buffer" && (
          <span className="text-[11px] text-amber-500 bg-amber-50 px-1.5 rounded shrink-0">buffer</span>
        )}
        {ms.points > 0 && (
          <span className="text-[12px] text-[#86868b] w-8 text-right shrink-0">{ms.points}pt</span>
        )}
        {hasDetail && (
          <span className={`text-[10px] text-[#86868b] shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
        )}
      </button>

      {/* 展開: 責任者詳細（role/taskDescription） */}
      {expanded && resps.some((r) => r.role || r.taskDescription) && (
        <div className="ml-7 py-1.5 space-y-1">
          {resps.map((r) => (
            <div key={`${r.memberId}-${r.role}`} className="flex items-start gap-2 text-[12px]">
              <span className="text-[#007aff] font-medium min-w-[44px]">
                {memberMap[r.memberId] || "PM"}
              </span>
              <span className="text-[#86868b] text-[11px] bg-[#f5f5f7] px-1.5 py-0.5 rounded shrink-0">
                {r.role || "担当"}
              </span>
              {r.taskDescription && (
                <span className="text-[#3c3c43] text-[12px] flex-1">{r.taskDescription}</span>
              )}
              {r.share > 0 && (
                <span className="text-[11px] text-[#aeaeb2] shrink-0">
                  {Math.round(r.share * 100)}%
                </span>
              )}
            </div>
          ))}
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
    <div className="ml-7 pb-2 space-y-0.5">
      {items.map((si) => (
        <button
          key={si.subItemId}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(si);
          }}
          disabled={toggling === si.subItemId}
          className="flex items-center gap-1.5 text-[12px] w-full text-left hover:bg-[#fafafa] rounded px-0.5 py-0.5 transition-colors disabled:opacity-50"
        >
          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
            si.status === "done"
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-[#d1d5db] hover:border-[#007aff]"
          }`}>
            {si.status === "done" && (
              <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span className={si.status === "done" ? "line-through text-[#86868b]" : ""}>
            {si.title}
          </span>
        </button>
      ))}
    </div>
  );
}
