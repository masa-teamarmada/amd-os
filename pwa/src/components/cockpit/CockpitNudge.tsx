"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface Nudge {
  message: string;
  status: string;
  level: string;
  postedAt: string | null;
}

const LEVEL_BG: Record<string, string> = {
  info: "bg-blue-50 border-blue-200",
  warn: "bg-amber-50 border-amber-200",
  danger: "bg-red-50 border-red-200",
  ok: "bg-emerald-50 border-emerald-200",
};

const LEVEL_ICON_BG: Record<string, string> = {
  info: "bg-blue-100 text-blue-600",
  warn: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
  ok: "bg-emerald-100 text-emerald-600",
};

interface Props {
  nudges: Nudge[];
}

export function CockpitNudge({ nudges }: Props) {
  return (
    <Card className="border-[#e5e5e7]">
      <CardHeader className="pb-2 pt-3 px-3">
        <h3 className="text-[13px] font-medium">🌙 つくよみメモ</h3>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2.5">
        {nudges.length === 0 ? (
          <p className="text-[12px] text-[#86868b] py-2">
            🌙 今は特に気になることないよ。順調！
          </p>
        ) : (
          nudges.map((n, i) => (
            <div key={i} className="relative pl-10">
              {/* Icon circle — left positioned */}
              <div
                className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center text-[14px] ${
                  LEVEL_ICON_BG[n.level] ?? "bg-zinc-100 text-zinc-500"
                }`}
              >
                🌙
              </div>
              {/* Card body */}
              <div
                className={`rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed ${
                  LEVEL_BG[n.level] ?? "bg-white border-[#e5e5e7]"
                }`}
              >
                {n.message}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
