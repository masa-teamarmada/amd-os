import type { BillingRow } from "@/types/dashboard";
import { SectionCard } from "@/components/ui/SectionCard";

const STAGES = ["open", "budgeted", "invoiced", "paid", "closed"] as const;

function stageIndex(status: string): number {
  return STAGES.indexOf(status as (typeof STAGES)[number]);
}

export function BillingPipeline({ billing }: { billing: BillingRow[] }) {
  if (billing.length === 0) {
    return (
      <SectionCard title="Billing Pipeline">
        <p className="text-xs text-gray-400 text-center py-4">
          No billing data
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Billing Pipeline">
      <div className="space-y-2">
        {billing.map((b) => {
          const idx = stageIndex(b.status);
          return (
            <div
              key={b.project_code}
              className="flex items-center gap-2"
            >
              <span className="font-mono text-[11px] font-medium text-gray-600 w-12 shrink-0">
                {b.project_code}
              </span>
              <div className="flex items-center gap-0.5 flex-1">
                {STAGES.map((stage, i) => (
                  <div key={stage} className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        i < idx
                          ? "bg-emerald-500"
                          : i === idx
                            ? "bg-blue-500 ring-2 ring-blue-200"
                            : "bg-gray-200"
                      }`}
                    />
                    {i < STAGES.length - 1 && (
                      <div
                        className={`w-4 h-px ${i < idx ? "bg-emerald-300" : "bg-gray-200"}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-gray-400 w-14 text-right">
                {b.status}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
        {STAGES.map((s) => (
          <span key={s} className="text-[9px] text-gray-300 uppercase">
            {s}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}
