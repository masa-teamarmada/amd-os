"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ValueMilestone, ValuePlanCycle } from "@/types/database";

function formatYm(ym: string) {
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

const TAG_COLORS: Record<string, string> = {
  normal: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  buffer: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  routine: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const PROGRESS_COLORS: Record<string, string> = {
  normal: "bg-blue-500",
  buffer: "bg-amber-500",
  routine: "bg-zinc-400",
};

interface CockpitGoalsProps {
  milestones: ValueMilestone[];
  progressMap: Map<string, number>;
  planCycle: ValuePlanCycle;
  projectId: string;
  currentYm: string;
}

export function CockpitGoals({
  milestones,
  progressMap,
  planCycle,
}: CockpitGoalsProps) {
  const totalPoints = milestones.reduce((sum, ms) => sum + ms.points, 0);
  if (milestones.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          マイルストーンが設定されていません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">年間マイルストーン</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatYm(planCycle.period_start_ym)} ～ {formatYm(planCycle.period_end_ym)}</span>
            <span>{totalPoints}pt</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
              {planCycle.status === "active" ? "固定" : "下書き"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {milestones.map((ms) => {
          const pct = progressMap.get(ms.milestone_id) ?? 0;
          return (
            <div
              key={ms.milestone_id}
              className="p-3 rounded-lg border border-border/50 hover:border-border transition-colors space-y-2"
            >
              {/* Top row: title + tag + points */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium flex-1">
                  {ms.title}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${TAG_COLORS[ms.tag] ?? ""}`}
                >
                  {ms.tag}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {ms.points}pt
                </span>
              </div>

              {/* Bottom row: progress bar + percentage */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${PROGRESS_COLORS[ms.tag] ?? "bg-primary"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                  {pct}%
                </span>
              </div>

              {/* Success criteria (if present) */}
              {ms.success_criteria && (
                <p className="text-xs text-muted-foreground">
                  {ms.success_criteria}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
