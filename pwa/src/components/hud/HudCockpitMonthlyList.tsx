"use client";

import { useState } from "react";

interface BillingCycle {
  ym: string;
  status: string;
  budgetYen: number;
  meetingStartAt: string | null;
  reportFixedAt: string | null;
  invoiceSentAt: string | null;
  paymentConfirmedAt: string | null;
  budgetReportedAmount: number;
  reportExcerpt?: string;
  reportNeedsReview?: boolean;
  msProgressSummaryJson?: unknown;
}

interface MsItem {
  title: string;
  tag: string;
  points: number;
  progressPct: number;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

const BADGES = [
  { key: "meetingStartAt" as const, label: "会議" },
  { key: "reportFixedAt" as const, label: "報告" },
  { key: "invoiceSentAt" as const, label: "請求" },
  { key: "paymentConfirmedAt" as const, label: "入金" },
];

function parseMsProgress(bc: BillingCycle): { pct: number; tone: string; items: MsItem[] } | null {
  let items: MsItem[] = [];
  try {
    if (bc.msProgressSummaryJson) {
      const parsed = typeof bc.msProgressSummaryJson === "string" ? JSON.parse(bc.msProgressSummaryJson) : bc.msProgressSummaryJson;
      items = Array.isArray(parsed) ? parsed : parsed?.items || [];
    }
  } catch {
    // ignore malformed legacy summaries
  }
  if (items.length === 0) return null;

  const totalPt = items.reduce((s, m) => s + (m.points || 0), 0);
  if (totalPt === 0) return null;
  const weightedPct = items.reduce((s, m) => s + (m.progressPct || 0) * (m.points || 0), 0) / totalPt;
  const pct = Math.round(weightedPct);
  if (pct >= 80) return { pct, tone: "emerald", items };
  if (pct >= 40) return { pct, tone: "amber", items };
  if (pct > 0) return { pct, tone: "rose", items };
  return { pct: 0, tone: "slate", items };
}

function barClass(tone: string): string {
  if (tone === "emerald") return "bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.65)]";
  if (tone === "amber") return "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]";
  if (tone === "rose") return "bg-rose-300 shadow-[0_0_12px_rgba(253,164,175,0.55)]";
  return "bg-cyan-200/45";
}

function textClass(tone: string): string {
  if (tone === "emerald") return "text-emerald-100";
  if (tone === "amber") return "text-amber-100";
  if (tone === "rose") return "text-rose-100";
  return "text-cyan-100/65";
}

interface Props {
  billingCycles: BillingCycle[];
  currentYm: string;
  progressByYm?: Record<string, MsItem[]>;
  onOpenModal: (ym: string) => void;
}

export function HudCockpitMonthlyList({ billingCycles, currentYm, progressByYm = {}, onOpenModal }: Props) {
  const [expandedYm, setExpandedYm] = useState<string | null>(null);

  const curY = parseInt(currentYm.substring(0, 4));
  const curM = parseInt(currentYm.substring(4, 6));
  const nextM = curM === 12 ? 1 : curM + 1;
  const nextY = curM === 12 ? curY + 1 : curY;
  const nextYm = String(nextY) + String(nextM).padStart(2, "0");

  const sorted = [...billingCycles]
    .filter((bc) => bc.ym <= nextYm && bc.ym >= "202512")
    .sort((a, b) => b.ym.localeCompare(a.ym));

  return (
    <section className="space-y-2.5">
      {sorted.map((bc) => {
        const isCurrent = bc.ym === currentYm;
        const badges = BADGES.map(({ key, label }) => ({ label, done: !!bc[key] }));
        const liveItems = progressByYm[bc.ym] || [];
        const signal = liveItems.length > 0 ? parseMsProgress({ ...bc, msProgressSummaryJson: liveItems }) : parseMsProgress(bc);
        const isExpanded = expandedYm === bc.ym;

        return (
          <div
            key={bc.ym}
            className={`overflow-hidden border bg-slate-950/88 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.10)] ${
              isCurrent ? "border-cyan-200/80 shadow-[0_0_24px_rgba(103,232,249,0.22)]" : "border-cyan-300/28"
            }`}
          >
            <button onClick={() => onOpenModal(bc.ym)} className="w-full text-left transition-colors hover:bg-cyan-300/8">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="w-[62px] shrink-0 font-mono text-[13px] font-black tabular-nums text-white">{formatYm(bc.ym)}</span>

                {bc.reportNeedsReview && <span className="h-2 w-2 shrink-0 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.75)]" />}

                <div className="flex gap-1">
                  {badges.map(({ label, done }) => (
                    <span
                      key={label}
                      className={`border px-1.5 py-0.5 text-[10px] font-bold ${
                        done ? "border-emerald-300/45 bg-emerald-300/12 text-emerald-100" : "border-cyan-300/18 bg-slate-900/70 text-cyan-100/38"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <span className="flex-1" />

                {bc.budgetReportedAmount > 0 && (
                  <span className="font-mono text-[12px] tabular-nums text-cyan-100/72">¥{bc.budgetReportedAmount.toLocaleString()}</span>
                )}
              </div>
            </button>

            {signal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedYm(isExpanded ? null : bc.ym);
                }}
                className="flex w-full items-center gap-2 px-4 pb-2.5 text-left transition-colors hover:bg-cyan-300/8"
              >
                <span className={`w-12 font-mono text-[11px] font-black tabular-nums ${textClass(signal.tone)}`}>{signal.pct}%</span>
                <div className="h-2 flex-1 overflow-hidden border border-cyan-300/20 bg-slate-900/88">
                  <div className={`h-full ${barClass(signal.tone)}`} style={{ width: `${Math.min(signal.pct, 100)}%` }} />
                </div>
                {signal.items.length > 0 && <span className={`text-[10px] text-cyan-200/70 transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>}
              </button>
            )}

            {isExpanded && signal && signal.items.length > 0 && (
              <div className="space-y-1.5 border-t border-cyan-300/18 px-4 pb-3 pt-2">
                {signal.items.map((item, idx) => {
                  const tone = item.progressPct >= 80 ? "emerald" : item.progressPct >= 40 ? "amber" : item.progressPct > 0 ? "rose" : "slate";
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-cyan-50/82">{item.title}</span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-cyan-100/60">{item.points}pt</span>
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden border border-cyan-300/18 bg-slate-900/88">
                        <div className={`h-full ${barClass(tone)}`} style={{ width: `${Math.min(item.progressPct, 100)}%` }} />
                      </div>
                      <span className={`w-8 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums ${textClass(tone)}`}>{item.progressPct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
