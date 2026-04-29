import type { ProjectSummary } from "@/types/dashboard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatYen, formatDate } from "@/lib/utils/format";
import { healthColor } from "@/lib/utils/status";

export function ProjectStatusGrid({
  projects,
}: {
  projects: ProjectSummary[];
}) {
  if (projects.length === 0) {
    return (
      <SectionCard title="Project Status">
        <p className="text-xs text-gray-400 text-center py-4">
          No project data for this period
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Project Status">
      <table className="w-full">
        <thead>
          <tr className="text-[11px] font-medium uppercase tracking-wider text-gray-400 border-b border-gray-200">
            <th className="text-left pb-2 pl-3 w-20">Code</th>
            <th className="text-left pb-2">Name</th>
            <th className="text-left pb-2 w-24">Billing</th>
            <th className="text-right pb-2 w-20">Budget</th>
            <th className="text-left pb-2 pl-3 w-32">MS Progress</th>
            <th className="text-center pb-2 w-14">MS</th>
            <th className="text-center pb-2 w-14">Proto</th>
            <th className="text-left pb-2 w-16">Mtg</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.project_code}
              className={`text-xs border-l-3 ${healthColor(p.health)} hover:bg-gray-50/80 transition-colors`}
            >
              <td className="py-1.5 pl-3 font-mono font-medium text-gray-700">
                {p.project_code}
              </td>
              <td className="py-1.5 text-gray-700 truncate max-w-[160px]">
                {p.project_name}
              </td>
              <td className="py-1.5">
                <StatusBadge status={p.billing_status} />
              </td>
              <td className="py-1.5 text-right font-mono text-gray-700">
                {formatYen(p.budget_total)}
              </td>
              <td className="py-1.5 pl-3">
                <div className="flex items-center gap-2">
                  <ProgressBar
                    percent={p.ms_progress_avg}
                    className="w-16"
                  />
                  <span className="font-mono text-[11px] text-gray-600 w-8 text-right">
                    {p.ms_progress_avg}%
                  </span>
                </div>
              </td>
              <td className="py-1.5 text-center font-mono text-gray-600">
                {p.active_ms_count}
              </td>
              <td className="py-1.5 text-center font-mono text-gray-600">
                {p.protocol_count}
              </td>
              <td className="py-1.5 font-mono text-[11px] text-gray-500">
                {formatDate(p.next_meeting)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
