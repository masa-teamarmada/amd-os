"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingCycle } from "@/types/database";

interface CockpitRoutineProps {
  billing: BillingCycle | null;
  currentYm: string;
}

const ROUTINE_ITEMS = [
  { key: "report_fixed_at", label: "月次レポート確認" },
] as const;

export function CockpitRoutine({ billing, currentYm }: CockpitRoutineProps) {
  const ymLabel = `${currentYm.slice(0, 4)}/${currentYm.slice(4)}`;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Routine — {ymLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {ROUTINE_ITEMS.map((item) => {
          const value = billing?.[item.key] as string | null | undefined;
          const isDone = !!value;
          return (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <span
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-600"
                    : "border-muted-foreground/30"
                }`}
              >
                {isDone && "✓"}
              </span>
              <span
                className={
                  isDone ? "text-muted-foreground line-through" : "text-foreground"
                }
              >
                {item.label}
              </span>
              {isDone && (
                <span className="ml-auto text-muted-foreground">
                  {new Date(value!).toLocaleDateString("ja-JP")}
                </span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
