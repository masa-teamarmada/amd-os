"use client";

interface TimelineStep {
  label: string;
  status: "completed" | "current" | "pending";
  date?: string | null;
  actor?: string | null;
}

const STATUS_STYLES = {
  completed: {
    dot: "bg-emerald-500 border-emerald-500",
    line: "bg-emerald-300",
    text: "text-gray-900",
  },
  current: {
    dot: "bg-blue-500 border-blue-500 animate-pulse",
    line: "bg-gray-200",
    text: "text-blue-700 font-medium",
  },
  pending: {
    dot: "bg-white border-gray-300",
    line: "bg-gray-200",
    text: "text-gray-400",
  },
};

function formatTimelineDate(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function StatusTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const style = STATUS_STYLES[step.status];
        const isLast = i === steps.length - 1;
        return (
          <div key={step.label} className="flex gap-3">
            {/* Dot + Line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 ${style.dot} shrink-0 mt-0.5`}
              />
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[28px] ${style.line}`} />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <div className={`text-sm ${style.text}`}>{step.label}</div>
              {step.date && (
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {formatTimelineDate(step.date)}
                  {step.actor && ` · ${step.actor}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
