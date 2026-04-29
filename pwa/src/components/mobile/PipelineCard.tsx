"use client";

import type { BillingRow } from "@/types/dashboard";
import { formatYen } from "@/lib/utils/format";

const STAGES = ["open", "budgeted", "invoiced", "paid", "closed"] as const;
const STAGE_LABELS: Record<string, string> = {
  open: "予算",
  budgeted: "確定",
  invoiced: "請求",
  paid: "入金",
  closed: "完了",
};

const STAGE_COLORS: Record<string, string> = {
  completed: "bg-emerald-500",
  current: "bg-blue-500 animate-pulse",
  pending: "bg-gray-200",
};

function getNextAction(status: string): string {
  switch (status) {
    case "open":
      return "予算確定が必要";
    case "budgeted":
      return "請求書を作成";
    case "invoiced":
      return "入金確認待ち";
    case "paid":
      return "クローズ可能";
    case "closed":
      return "完了";
    default:
      return "";
  }
}

export default function PipelineCard({
  billing,
  onClick,
}: {
  billing: BillingRow;
  onClick?: () => void;
}) {
  const currentIdx = STAGES.indexOf(
    billing.status as (typeof STAGES)[number]
  );

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left active:bg-gray-50 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-bold text-gray-900">
            {billing.project_code}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {billing.project_name}
          </span>
        </div>
        <span className="text-sm font-mono text-gray-600">
          {formatYen(billing.budget_total)}
        </span>
      </div>

      {/* Pipeline dots */}
      <div className="flex items-center gap-1 mb-3">
        {STAGES.map((stage, i) => {
          let color = STAGE_COLORS.pending;
          if (i < currentIdx) color = STAGE_COLORS.completed;
          if (i === currentIdx) color = STAGE_COLORS.current;

          return (
            <div key={stage} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-[9px] text-gray-400 mt-0.5">
                  {STAGE_LABELS[stage]}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 -mx-0.5 ${
                    i < currentIdx ? "bg-emerald-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next action */}
      <div className="text-xs text-gray-500">
        → {getNextAction(billing.status)}
      </div>
    </button>
  );
}
