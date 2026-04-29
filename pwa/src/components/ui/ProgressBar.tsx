export function ProgressBar({
  percent,
  color = "bg-blue-500",
  className = "",
}: {
  percent: number;
  color?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`bg-gray-200 rounded-full h-1.5 w-full ${className}`}>
      <div
        className={`${color} rounded-full h-1.5 transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
