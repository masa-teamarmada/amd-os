import type { ProtocolRow } from "@/types/dashboard";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatDate } from "@/lib/utils/format";

const IMP_DOT: Record<string, string> = {
  high: "bg-red-500",
  mid: "bg-amber-500",
  low: "bg-gray-300",
};

export function RecentProtocols({
  protocols,
}: {
  protocols: ProtocolRow[];
}) {
  if (protocols.length === 0) {
    return (
      <SectionCard title="Recent Protocols">
        <p className="text-xs text-gray-400 text-center py-4">
          No protocols yet
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Recent Protocols">
      <table className="w-full">
        <thead>
          <tr className="text-[10px] font-medium uppercase tracking-wider text-gray-400 border-b border-gray-100">
            <th className="text-left pb-1.5 w-14">Date</th>
            <th className="text-left pb-1.5 w-16">Project</th>
            <th className="text-left pb-1.5">Decision Point</th>
            <th className="text-left pb-1.5 w-24">Tags</th>
            <th className="text-center pb-1.5 w-8">Imp</th>
            <th className="text-left pb-1.5 w-16">Status</th>
          </tr>
        </thead>
        <tbody>
          {protocols.map((p, i) => (
            <tr key={i} className="text-xs hover:bg-gray-50/50">
              <td className="py-1 font-mono text-[11px] text-gray-400">
                {formatDate(p.created_at)}
              </td>
              <td className="py-1 font-mono text-[11px] font-medium text-gray-600">
                {p.project_code}
              </td>
              <td className="py-1 text-gray-700 truncate max-w-[200px]">
                {p.decision_point}
              </td>
              <td className="py-1">
                <div className="flex gap-0.5 flex-wrap">
                  {p.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-1 text-center">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${IMP_DOT[p.importance ?? "low"] ?? "bg-gray-300"}`}
                />
              </td>
              <td className="py-1 text-[11px] text-gray-500">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
