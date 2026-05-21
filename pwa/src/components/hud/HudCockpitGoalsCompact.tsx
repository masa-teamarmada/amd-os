"use client";

import { useEffect, useState } from "react";
import { MilestoneGanttChart } from "@/components/cockpit/MilestoneGanttChart";

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
  memberMap: Record<string, string>;
  progress?: Progress[];
  currentYm?: string;
  onEdit?: () => void;
}

export function HudCockpitGoalsCompact({
  milestones,
  planCycle,
  projectId,
  subItems,
  responsibilities,
  memberMap,
  progress = [],
  currentYm,
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
      variant="hud"
      progress={progress}
      currentYm={currentYm}
      onEdit={onEdit}
    />
  );
}
