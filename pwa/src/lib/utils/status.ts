type StatusColor = {
  text: string;
  bg: string;
  dot: string;
};

const BILLING_STATUS_COLORS: Record<string, StatusColor> = {
  open: { text: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
  budgeted: { text: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500" },
  invoiced: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
  },
  paid: {
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
  },
  closed: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    dot: "bg-emerald-600",
  },
};

export function billingStatusColor(status: string): StatusColor {
  return (
    BILLING_STATUS_COLORS[status] ?? {
      text: "text-gray-500",
      bg: "bg-gray-100",
      dot: "bg-gray-400",
    }
  );
}

export function healthColor(
  health: "green" | "blue" | "amber" | "red"
): string {
  const map = {
    green: "border-l-emerald-500",
    blue: "border-l-blue-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
  };
  return map[health];
}

export function progressColor(
  targetYm: string | null,
  currentYm: string
): string {
  if (!targetYm) return "bg-blue-500";
  if (targetYm > currentYm) return "bg-emerald-500";
  if (targetYm === currentYm) return "bg-amber-500";
  return "bg-red-500";
}
