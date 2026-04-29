"use client";

interface MonthSelectorProps {
  ym: string; // "YYYY-MM"
  onChange: (ym: string) => void;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatYmLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

export default function MonthSelector({ ym, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <button
        onClick={() => onChange(shiftMonth(ym, -1))}
        className="text-gray-400 active:text-gray-700 px-3 py-1 rounded-lg text-lg"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-gray-700">
        {formatYmLabel(ym)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(ym, 1))}
        className="text-gray-400 active:text-gray-700 px-3 py-1 rounded-lg text-lg"
      >
        ›
      </button>
    </div>
  );
}
