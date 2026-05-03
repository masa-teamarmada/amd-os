"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

interface Milestone {
  milestoneId: string;
  title: string;
  points: number;
  tag: string;
  goalLevel: string;
  successCriteria: string;
  sortOrder: number;
}

interface PlanCycle {
  planCycleId: string;
  status: string;
  budgetYen: number;
  totalPoints: number;
  periodStartYm: string;
  periodEndYm: string;
}

interface Props {
  milestones: Milestone[];
  progressMap: Map<string, number>;
  planCycle: PlanCycle;
}

export function CockpitGoalsGas({ milestones, progressMap, planCycle }: Props) {
  const totalPoints = milestones.reduce((sum, ms) => sum + ms.points, 0);
  const annualMs = milestones.filter((ms) => ms.tag !== "routine");
  const routineMs = milestones.filter((ms) => ms.tag === "routine");

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
          <h3 className="text-sm font-medium">年間マイルストーン</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {formatYm(planCycle.periodStartYm)} ～{" "}
              {formatYm(planCycle.periodEndYm)}
            </span>
            <span>{totalPoints}pt</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">
              {planCycle.status === "active" ? "固定" : "下書き"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 🎯 年間目標 */}
        {annualMs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              🎯 年間目標
            </p>
            {annualMs.map((ms) => (
              <MsItem key={ms.milestoneId} ms={ms} progressMap={progressMap} />
            ))}
          </div>
        )}

        {/* 🔄 定常業務 */}
        {routineMs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              🔄 定常業務
            </p>
            {routineMs.map((ms) => (
              <MsItem key={ms.milestoneId} ms={ms} progressMap={progressMap} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MsItem({
  ms,
  progressMap,
}: {
  ms: Milestone;
  progressMap: Map<string, number>;
}) {
  const pct = progressMap.get(ms.milestoneId) ?? 0;

  return (
    <div className="p-3 rounded-lg border border-border/50 hover:border-border transition-colors space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium flex-1">{ms.title}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${TAG_COLORS[ms.tag] ?? ""}`}
        >
          {ms.tag}
        </Badge>
        <span className="text-xs text-muted-foreground">{ms.points}pt</span>
      </div>

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

      {ms.successCriteria && (
        <p className="text-xs text-muted-foreground">{ms.successCriteria}</p>
      )}
    </div>
  );
}
