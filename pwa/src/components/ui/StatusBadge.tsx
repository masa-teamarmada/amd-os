import { billingStatusColor } from "@/lib/utils/status";

export function StatusBadge({ status }: { status: string }) {
  const c = billingStatusColor(status);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.text} ${c.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}
