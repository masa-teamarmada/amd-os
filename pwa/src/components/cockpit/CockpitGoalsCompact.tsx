"use client";

import { useEffect, useState } from "react";
import { MilestoneGanttChart } from "./MilestoneGanttChart";

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
  projectId: string;
  subItems: SubItem[];
  responsibilities: Responsibility[];
  memberMap: Record<string, string>;
  progress?: Progress[];
  currentYm?: string;
  msActivities?: MemberMsActivity[];
  memberActivities?: MemberActivity[];
  onEdit?: () => void;
}

export function CockpitGoalsCompact({
  milestones,
  planCycle,
  projectId,
  subItems,
  responsibilities,
  memberMap,
  progress = [],
  currentYm,
  msActivities = [],
  memberActivities = [],
  onEdit,
}: Props) {
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

  return (
    <MilestoneGanttChart
      milestones={milestones}
      planCycle={planCycle}
      subItems={subItems}
      responsibilities={responsibilities}
      memberMap={memberMap}
      schedules={schedules}
      progress={progress}
      currentYm={currentYm}
      msActivities={msActivities}
      memberActivities={memberActivities}
      onEdit={onEdit}
    />
  );
}
