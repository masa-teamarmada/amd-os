import type { MilestoneRow } from "@/types/dashboard";
import { SectionCard } from "@/components/ui/SectionCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { progressColor } from "@/lib/utils/status";

export function MilestoneTracker({
  milestones,
  currentYm,
}: {
  milestones: MilestoneRow[];
  currentYm: string;
}) {
  if (milestones.length === 0) {
    return (
      <SectionCard title="Milestone Tracker">
        <p className="text-xs text-gray-400 text-center py-4">
          No active milestones
        </p>
      </SectionCard>
    );
  }

  // Group by project
  const grouped = new Map<string, MilestoneRow[]>();
  for (const m of milestones) {
    const list = grouped.get(m.project_code) ?? [];
    list.push(m);
    grouped.set(m.project_code, list);
  }

  return (
    <SectionCard title="Milestone Tracker">
      <div className="space-y-3">
        {Array.from(grouped.entries()).map(([code, ms]) => (
          <div key={code}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px] font-semibold text-gray-600">
                {code}
              </span>
              <span className="text-[11px] text-gray-400">
                {ms[0].project_name}
              </span>
            </div>
            <div className="space-y-1 pl-1">
              {ms.map((m) => (
                <div
                  key={m.milestone_key}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="font-mono text-[10px] text-gray-400 w-10 shrink-0">
                    {m.milestone_key}
                  </span>
                  <span className="text-gray-700 truncate w-36 shrink-0">
                    {m.milestone_title}
                  </span>
                  <ProgressBar
                    percent={m.progress_pct ?? 0}
                    color={progressColor(m.target_ym, currentYm)}
                    className="w-24"
                  />
                  <span className="font-mono text-[11px] text-gray-600 w-8 text-right">
                    {m.progress_pct ?? 0}%
                  </span>
                  <span className="font-mono text-[10px] text-gray-400 w-14">
                    {m.target_ym ?? "—"}
                  </span>
                  <span className="text-[10px] text-gray-300">
                    {m.points}pt
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
