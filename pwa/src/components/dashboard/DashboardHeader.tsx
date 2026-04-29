import type { HeaderKPIs } from "@/types/dashboard";
import { formatYen } from "@/lib/utils/format";

export function DashboardHeader({ kpis }: { kpis: HeaderKPIs }) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-gray-900">
          {kpis.current_ym}
        </span>
        <span className="text-gray-300">|</span>
        <span className="text-[11px] text-gray-400">Dashboard</span>
      </div>
      <div className="flex items-center gap-6">
        <KpiBlock label="Projects" value={String(kpis.project_count)} />
        <KpiBlock label="Active MS" value={String(kpis.active_ms_count)} />
        <KpiBlock
          label="Pipeline"
          value={formatYen(kpis.billing_pipeline_yen)}
        />
      </div>
    </div>
  );
}

function KpiBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}
