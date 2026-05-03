"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface BillingCycle {
  ym: string;
  status: string;
  budgetYen: number;
  meetingStartAt: string | null;
  reportFixedAt: string | null;
  invoiceSentAt: string | null;
  paymentConfirmedAt: string | null;
  budgetReportedAmount: number;
}

const STATUS_KEYS = [
  { key: "meetingStartAt" as const, label: "会議" },
  { key: "reportFixedAt" as const, label: "報告" },
  { key: "invoiceSentAt" as const, label: "請求" },
  { key: "paymentConfirmedAt" as const, label: "入金" },
];

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

interface Props {
  billingCycles: BillingCycle[];
  currentYm: string;
  onCardClick: (ym: string) => void;
}

export function CockpitMonthlyCards({
  billingCycles,
  currentYm,
  onCardClick,
}: Props) {
  // Show most recent 12 months
  const sorted = [...billingCycles]
    .sort((a, b) => b.ym.localeCompare(a.ym))
    .slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h3 className="text-sm font-medium">月次タイムライン</h3>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sorted.map((bc) => {
            const isCurrent = bc.ym === currentYm;
            return (
              <button
                key={bc.ym}
                onClick={() => onCardClick(bc.ym)}
                className={`shrink-0 w-36 rounded-lg border p-3 text-left transition-colors hover:border-primary/40 ${
                  isCurrent
                    ? "border-primary/60 border-2 bg-primary/5"
                    : "border-border/60"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {formatYm(bc.ym)}
                  </span>
                  {bc.budgetReportedAmount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ¥{(bc.budgetReportedAmount / 10000).toFixed(0)}万
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {STATUS_KEYS.map(({ key, label }) => {
                    const done = !!bc[key];
                    return (
                      <span
                        key={key}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          done
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
