import type { ActionItem } from "@/types/dashboard";
import { SectionCard } from "@/components/ui/SectionCard";

const TYPE_ICONS: Record<string, string> = {
  billing: "¥",
  milestone: "◎",
  protocol: "⚙",
  meeting: "▤",
};

export function ActionItems({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <SectionCard title="Action Items">
        <p className="text-xs text-emerald-600 text-center py-4">
          All clear
        </p>
      </SectionCard>
    );
  }

  const shown = items.slice(0, 6);
  const overflow = items.length - 6;

  return (
    <SectionCard
      title="Action Items"
      action={
        <span className="text-[10px] font-mono text-red-500">
          {items.length}
        </span>
      }
    >
      <div className="space-y-1">
        {shown.map((item, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 px-2 py-1.5 rounded border-l-2 ${
              item.severity === "high"
                ? "border-l-red-500 bg-red-50/50"
                : "border-l-amber-500 bg-amber-50/50"
            }`}
          >
            <span className="text-[10px] opacity-50 mt-0.5">
              {TYPE_ICONS[item.type] ?? "•"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 leading-tight truncate">
                {item.description}
              </p>
            </div>
            <span className="font-mono text-[10px] text-gray-400 shrink-0">
              {item.project_code}
            </span>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          +{overflow} more
        </p>
      )}
    </SectionCard>
  );
}
