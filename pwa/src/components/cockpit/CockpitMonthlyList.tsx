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
  isReportOnly?: boolean;
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

function parseMsProgress(bc: BillingCycle): { pct: number; emoji: string; color: string; barColor: string; items: MsItem[] } | null {
  let items: MsItem[] = [];
  try {
    if (bc.msProgressSummaryJson) {
      const parsed = typeof bc.msProgressSummaryJson === "string"
        ? JSON.parse(bc.msProgressSummaryJson)
        : bc.msProgressSummaryJson;
      items = Array.isArray(parsed) ? parsed : parsed?.items || [];
    }
  } catch { /* ignore */ }
  if (items.length === 0) return null;

  const totalPt = items.reduce((s, m) => s + (m.points || 0), 0);
  if (totalPt === 0) return null;
  const weightedPct = items.reduce((s, m) => s + ((m.progressPct || 0) * (m.points || 0)), 0) / totalPt;
  const pct = Math.round(weightedPct);

  if (pct >= 80) return { pct, emoji: "🟢", color: "text-emerald-600", barColor: "bg-emerald-500", items };
  if (pct >= 40) return { pct, emoji: "🟡", color: "text-amber-600", barColor: "bg-amber-400", items };
  if (pct > 0)   return { pct, emoji: "🔴", color: "text-red-600", barColor: "bg-red-500", items };
  return { pct: 0, emoji: "⚪", color: "text-[#86868b]", barColor: "bg-[#d1d5db]", items };
}

function getBarColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-400";
  if (pct > 0) return "bg-red-500";
  return "bg-[#d1d5db]";
}

function getTextColor(pct: number): string {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  if (pct > 0) return "text-red-600";
  return "text-[#86868b]";
}

interface Props {
  billingCycles: BillingCycle[];
  reports?: Array<{
    ym: string;
    hasDraft: boolean;
    hasFinal: boolean;
    status: string;
  }>;
  currentYm: string;
  progressByYm?: Record<string, MsItem[]>;
  onOpenModal: (ym: string) => void;
}

export function CockpitMonthlyList({ billingCycles, reports = [], currentYm, progressByYm = {}, onOpenModal }: Props) {
  const [expandedYm, setExpandedYm] = useState<string | null>(null);

  // 翌月の計算
  const curY = parseInt(currentYm.substring(0, 4));
  const curM = parseInt(currentYm.substring(4, 6));
  const nextM = curM === 12 ? 1 : curM + 1;
  const nextY = curM === 12 ? curY + 1 : curY;
  const nextYm = String(nextY) + String(nextM).padStart(2, "0");

  const billingByYm = new Map(billingCycles.map((bc) => [bc.ym, bc]));
  const reportOnlyCycles: BillingCycle[] = reports
    .filter((report) => (report.hasDraft || report.hasFinal) && !billingByYm.has(report.ym))
    .map((report) => ({
      ym: report.ym,
      status: report.status || "draft",
      budgetYen: 0,
      meetingStartAt: null,
      reportFixedAt: report.hasFinal ? "done" : null,
      invoiceSentAt: null,
      paymentConfirmedAt: null,
      budgetReportedAmount: 0,
      isReportOnly: true,
    }));

  // 翌月まで + 202512以降を表示。請求月がなくても monthly_reports がある月は表示する。
  const sorted = [...billingCycles, ...reportOnlyCycles]
    .filter((bc) => bc.ym <= nextYm && bc.ym >= "202512")
    .sort((a, b) => b.ym.localeCompare(a.ym));

  return (
    <section>
      <div className="space-y-2.5">
        {sorted.map((bc) => {
          const isCurrent = bc.ym === currentYm;
          const badges = BADGES.map(({ key, label }) => ({ label, done: !!bc[key] }));
          const liveItems = progressByYm[bc.ym] || [];
          const signal = liveItems.length > 0
            ? parseMsProgress({ ...bc, msProgressSummaryJson: liveItems })
            : parseMsProgress(bc);
          const isExpanded = expandedYm === bc.ym;

          return (
            <div
              key={bc.ym}
              className={`w-full bg-white rounded-xl border overflow-hidden ${
                isCurrent ? "border-[#007aff] border-2" : "border-[#e5e5e7]"
              }`}
            >
              {/* Clickable header → opens modal */}
              <button
                onClick={() => onOpenModal(bc.ym)}
                className="w-full text-left hover:bg-[#f9f9f9] transition-colors"
              >
                {/* Header row */}
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-[13px] font-semibold w-[60px] shrink-0">{formatYm(bc.ym)}</span>

                  {bc.isReportOnly && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      月次のみ
                    </span>
                  )}

                  {bc.reportNeedsReview && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}

                  <div className="flex gap-1">
                    {badges.map(({ label, done }) => (
                      <span
                        key={label}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          done ? "bg-emerald-500/15 text-emerald-700" : "bg-[#f5f5f7] text-[#c5c5c7]"
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <span className="flex-1" />

                  {bc.budgetReportedAmount > 0 && (
                    <span className="text-[12px] text-[#86868b]">
                      ¥{bc.budgetReportedAmount.toLocaleString()}
                    </span>
                  )}
                </div>
              </button>

              {/* MS Progress bar */}
              {signal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedYm(isExpanded ? null : bc.ym);
                  }}
                  className="w-full px-4 pb-2.5 flex items-center gap-2 text-left hover:bg-[#f9f9f9] transition-colors"
                >
                  <span className="text-[13px]">{signal.emoji}</span>
                  <div className="flex-1 h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${signal.barColor}`}
                      style={{ width: `${Math.min(signal.pct, 100)}%` }}
                    />
                  </div>
                  <span className={`text-[12px] font-semibold ${signal.color}`}>
                    {signal.pct}%
                  </span>
                  {signal.items.length > 0 && (
                    <span className={`text-[10px] text-[#86868b] transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                  )}
                </button>
              )}

              {/* MS別内訳（展開時） */}
              {isExpanded && signal && signal.items.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5 border-t border-[#f5f5f7] pt-2">
                  {signal.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[11px] flex-1 min-w-0 truncate text-[#3c3c43]">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-[#86868b] shrink-0">{item.points}pt</span>
                      <div className="w-16 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden shrink-0">
                        <div
                          className={`h-full rounded-full ${getBarColor(item.progressPct)}`}
                          style={{ width: `${Math.min(item.progressPct, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-medium w-8 text-right shrink-0 ${getTextColor(item.progressPct)}`}>
                        {item.progressPct}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
