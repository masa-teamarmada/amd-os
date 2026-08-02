"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import type {
  SxProjectOwnerLoad,
  SxProjectWorkUnit,
} from "@/lib/sx-project-owner-load";
import { sxFormatDate } from "./sx-visual-shared";

function metricTone(value: number, danger = false) {
  if (value === 0) return "border-[#e4ddd0] bg-white text-[#777166]";
  return danger
    ? "border-[#d8b0a8] bg-[#f9e4e1] text-[#8c3329]"
    : "border-[#e3c994] bg-[#fbf1dc] text-[#765022]";
}

function OwnerLoadColumn({
  loads,
  onSelectItem,
}: {
  loads: SxProjectOwnerLoad[];
  onSelectItem?: (item: SxProjectWorkUnit) => void;
}) {
  return (
    <div className="flex flex-col gap-px bg-[#d9cfde]">
      {loads.map((load) => (
        <details key={load.ownerLabel} className="group bg-[#fffdf7]">
          <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[minmax(100px,1fr)_repeat(5,auto)_18px] items-center gap-2 px-2.5 py-1.5 text-[10px] marker:content-none max-md:grid-cols-[minmax(0,1fr)_auto_auto_18px]">
            <span className="min-w-0">
              <b className="block truncate text-[11px] text-[#24231f]">
                {load.ownerLabel}
              </b>
              <small className="block truncate text-[9px] text-[#69665d]">
                影響工程 {load.impactedGates.length || 0}件
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
                <li key={`${item.kind}:${item.id}`}>
                  <button
                    type="button"
                    disabled={!onSelectItem}
                    onClick={() => onSelectItem?.(item)}
                    className="grid min-h-11 w-full grid-cols-1 items-start gap-x-2 gap-y-0.5 py-2 text-left text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38745d] enabled:hover:bg-[#f8f5ec] xl:grid-cols-[110px_minmax(160px,1fr)_120px_minmax(140px,0.8fr)] xl:gap-y-2"
                    aria-label={`${item.title}を編集`}
                    data-work-unit-kind={item.kind}
                    data-work-unit-id={item.id}
                  >
                    {/* 外側lg:grid-cols-2と組み合わさるlg/xl未満の幅では固定4列(合計554px)が入り
                        きらないため、xl未満は「種別+タイトル」「期限+影響工程」の2行1列へ折り、
                        xl以上だけ元の4列1行へ戻す(display:contentsで子要素を直接gridアイテム化)。 */}
                    <span className="flex min-w-0 items-baseline gap-1.5 xl:contents">
                      <span className="shrink-0 font-semibold text-[#5f4a66]">
                        {item.kindLabel}
                      </span>
                      <b className="min-w-0 truncate text-[#24231f]">
                        {item.title}
                      </b>
                    </span>
                    <span className="flex min-w-0 items-baseline gap-1.5 xl:contents">
                      <span
                        className={
                          item.blocked
                            ? "shrink-0 font-semibold text-[#8c3329]"
                            : "shrink-0 text-[#69665d]"
                        }
                      >
                        {item.blocked ? "停止・" : ""}
                        {item.dueDate ? sxFormatDate(item.dueDate) : "期限未設定"}
                      </span>
                      <span className="min-w-0 truncate text-[#69665d]">
                        {item.impactedGates.length > 0
                          ? `影響：${item.impactedGates.join(" / ")}`
                          : "影響工程 未接続"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}

export function SxProjectOwnerWorkload({
  loads,
  onSelectItem,
}: {
  loads: SxProjectOwnerLoad[];
  onSelectItem?: (item: SxProjectWorkUnit) => void;
}) {
  if (loads.length === 0) return null;
  // desktop(lg+)は左右独立の縦スタックへ分割する。round-robin(交互配置)ではなく前半/後半で
  // 分けるのは、mobile(1カラム)でこの2つの配列を単純に連結表示したとき、元の配列順序と
  // 完全一致させるため(round-robinだと連結時に順序が入れ替わってしまう)。
  const splitAt = Math.ceil(loads.length / 2);
  const leftLoads = loads.slice(0, splitAt);
  const rightLoads = loads.slice(splitAt);
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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d9cfde] px-2.5 py-1.5">
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
      {/* 左右は完全に独立したcolumn(flex-col)スタック。CSS gridの暗黙行で左右を同じ行に
          ペアリングすると、片側detailsの展開で共有行が伸び、反対列の後続カードのY座標まで
          動いてしまう(items-startは行の共有そのものを解消しない)。列ごとに高さが自己完結する
          よう、外側は2つのcolumn要素だけを持つgridにし、各column内の実itemsはflex-colで
          独立に積む。lg未満はgrid-cols-1になり、column要素2つがそのまま縦に並ぶため、
          leftLoads→rightLoadsの連結 = 元のloads順序と一致した1カラム表示になる。 */}
      <div className="grid gap-px bg-[#d9cfde] lg:grid-cols-2">
        <OwnerLoadColumn loads={leftLoads} onSelectItem={onSelectItem} />
        <OwnerLoadColumn loads={rightLoads} onSelectItem={onSelectItem} />
      </div>
    </section>
  );
}
