"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import type { SxProjectOwnerLoad } from "@/lib/sx-project-owner-load";
import { sxFormatDate } from "./sx-visual-shared";

function metricTone(value: number, danger = false) {
  if (value === 0) return "border-[#e4ddd0] bg-white text-[#777166]";
  return danger
    ? "border-[#d8b0a8] bg-[#f9e4e1] text-[#8c3329]"
    : "border-[#e3c994] bg-[#fbf1dc] text-[#765022]";
}

export function SxProjectOwnerWorkload({
  loads,
}: {
  loads: SxProjectOwnerLoad[];
}) {
  if (loads.length === 0) return null;
  const totals = loads.reduce(
    (sum, load) => ({
      open: sum.open + load.openCount,
      blocked: sum.blocked + load.blockedCount,
      overdue: sum.overdue + load.overdueCount,
      dueUnset: sum.dueUnset + load.dueUnsetCount,
    }),
    { open: 0, blocked: 0, overdue: 0, dueUnset: 0 },
  );
  return (
    <section
      className="border border-[#c9bfd0] bg-[#f7f3f7]"
      aria-labelledby="sx-project-owner-workload-title"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d9cfde] px-3 py-2">
        <div>
          <p className="text-[9px] font-semibold tracking-[0.14em] text-[#76637b]">
            WHO HOLDS WHAT
          </p>
          <h2
            id="sx-project-owner-workload-title"
            className="text-[12px] font-bold text-[#24231f]"
          >
            PJ全体の担当負荷・ボトルネック
          </h2>
        </div>
        <div className="flex flex-wrap gap-1 text-[9px] font-semibold">
          <span className={`border px-1.5 py-1 ${metricTone(totals.open)}`}>
            未完了 {totals.open}
          </span>
          <span
            className={`border px-1.5 py-1 ${metricTone(totals.blocked, true)}`}
          >
            停止 {totals.blocked}
          </span>
          <span
            className={`border px-1.5 py-1 ${metricTone(totals.overdue, true)}`}
          >
            超過 {totals.overdue}
          </span>
          <span className={`border px-1.5 py-1 ${metricTone(totals.dueUnset)}`}>
            期限なし {totals.dueUnset}
          </span>
        </div>
      </header>
      <div className="divide-y divide-[#d9cfde]">
        {loads.map((load) => (
          <details key={load.ownerLabel} className="group bg-[#fffdf7]">
            <summary className="grid min-h-12 cursor-pointer list-none grid-cols-[minmax(100px,1fr)_repeat(5,auto)_20px] items-center gap-2 px-3 py-2 text-[10px] marker:content-none max-md:grid-cols-[minmax(0,1fr)_auto_auto_20px]">
              <span className="min-w-0">
                <b className="block truncate text-[11px] text-[#24231f]">
                  {load.ownerLabel}
                </b>
                <small className="block truncate text-[9px] text-[#69665d]">
                  影響ゲート {load.impactedGates.length || 0}件
                </small>
              </span>
              <span className="whitespace-nowrap font-semibold text-[#514e47]">
                未完了 {load.openCount}
              </span>
              <span
                className={`whitespace-nowrap ${load.blockedCount > 0 ? "font-bold text-[#8c3329]" : "text-[#777166]"}`}
              >
                停止 {load.blockedCount}
              </span>
              <span
                className={`whitespace-nowrap max-md:hidden ${load.overdueCount > 0 ? "font-bold text-[#8c3329]" : "text-[#777166]"}`}
              >
                超過 {load.overdueCount}
              </span>
              <span className="whitespace-nowrap text-[#777166] max-md:hidden">
                7日内 {load.dueSoonCount}
              </span>
              <span
                className={`whitespace-nowrap max-md:hidden ${load.dueUnsetCount > 0 ? "font-semibold text-[#765022]" : "text-[#777166]"}`}
              >
                期限なし {load.dueUnsetCount}
              </span>
              <ChevronDown className="h-4 w-4 text-[#5f4a66] transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-[#eee9df] bg-white px-3 py-2">
              {load.dataGapCount > 0 && (
                <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-[#765022]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  担当・期限・構造化の不足 {load.dataGapCount}件
                </p>
              )}
              <ul className="max-h-72 divide-y divide-[#eee9df] overflow-y-auto border-y border-[#eee9df]">
                {load.items.map((item) => (
                  <li
                    key={`${item.kind}:${item.id}`}
                    className="grid grid-cols-[110px_minmax(160px,1fr)_120px_minmax(140px,0.8fr)] gap-2 py-2 text-[10px] max-md:grid-cols-1 max-md:gap-0.5"
                  >
                    <span className="font-semibold text-[#5f4a66]">
                      {item.kindLabel}
                    </span>
                    <b className="text-[#24231f]">{item.title}</b>
                    <span
                      className={
                        item.blocked
                          ? "font-semibold text-[#8c3329]"
                          : "text-[#69665d]"
                      }
                    >
                      {item.blocked ? "停止・" : ""}
                      {item.dueDate ? sxFormatDate(item.dueDate) : "期限未設定"}
                    </span>
                    <span className="text-[#69665d]">
                      {item.impactedGates.length > 0
                        ? `影響：${item.impactedGates.join(" / ")}`
                        : "影響ゲート 未接続"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
