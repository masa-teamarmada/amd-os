"use client";

import { useEffect, useRef, useState } from "react";
import type { CalcSegment, CalcTerm, ItemCalc } from "@/lib/cost-item-calc";
import { num } from "@/components/cockpit/CockpitCostModelParts";

// コスト試算（廃液・燃料）の明細の行の下に出す「計算」と「根拠」の行。
// まさ 2026-09-14「それぞれの項目が妥当なのかの確認をどうやってすればいいかが、これだと分からない。
// そもそも「数量」「単価」って何？単価の単位は/kg-DCWになっていて、これに数量をかけると右の「円/L」になる？ならないよね？」
// 数量 × 単価 から右端の額までの掛け算を式で出し、その数の出どころ（説明）を行の中で読めるようにする。

/** 式の中の数。大きい数は3桁カンマの整数、小さい数は有効数字を残す。 */
function calcNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a === 0) return "0";
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : Math.min(6, 3 - Math.floor(Math.log10(a)));
  return v.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

function termText(term: CalcTerm, first: boolean): string {
  const op = first && term.op === null ? "" : `${term.op ?? "×"} `;
  return `${op}${term.label ? `${term.label} ` : ""}${calcNumber(term.value)}${term.unit ? ` ${term.unit}` : ""}`;
}

function Segment({ segment, last }: { segment: CalcSegment; last: boolean }) {
  const r = segment.result;
  // 右端の額と同じ桁 (小数2桁) で終える。途中の答えは有効数字で出す。
  const value = last ? num(r.value, 2) : calcNumber(r.value);
  return (
    <span className="whitespace-normal">
      {segment.terms.map((t, i) => termText(t, i === 0)).join(" ")} ＝ {r.label ? `${r.label} ` : ""}
      <span className="font-semibold text-[#1d1d1f]">
        {value}
        {r.unit ? ` ${r.unit}` : ""}
      </span>
    </span>
  );
}

/** 数量 × 単価 から右端の額までの式。 */
export function ItemCalcLine({ calc }: { calc: ItemCalc | null }) {
  if (!calc || calc.segments.length === 0) return null;
  return (
    <div className="flex gap-1.5 text-[10px] leading-4 text-[#3c3c43]" data-testid="cost-item-calc">
      <span className="shrink-0 font-semibold text-[#6e6e73]">計算</span>
      <p className="min-w-0 tabular-nums">
        {calc.price && (
          <>
            単価 ＝ <Segment segment={calc.price} last={false} />
            {" ／ "}
          </>
        )}
        {calc.segments.map((segment, i) => (
          <span key={i}>
            {i > 0 && " → "}
            <Segment segment={segment} last={i === calc.segments.length - 1} />
          </span>
        ))}
        {calc.excluded && <span className="font-semibold text-[#b45309]">（{calc.excluded}）</span>}
      </p>
    </div>
  );
}

/** 明細の説明を「根拠」として行の中に出す。長い説明は2行で畳み、「続きを読む」で開く。 */
export function ItemNoteLine({ note }: { note: string | null }) {
  const text = note?.trim() ?? "";
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setOverflowing(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div className="flex gap-1.5 text-[10px] leading-4" data-testid="cost-item-note">
      <span className="shrink-0 font-semibold text-[#6e6e73]">根拠</span>
      {text ? (
        <div className="min-w-0">
          <p ref={ref} className={`whitespace-pre-line text-[#6e6e73] ${open ? "" : "line-clamp-2"}`}>
            {text}
          </p>
          {(open || overflowing) && (
            <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-semibold text-[#0267b2] hover:underline">
              {open ? "閉じる" : "続きを読む"}
            </button>
          )}
        </div>
      ) : (
        <span className="text-[#86868b]">書かれていない</span>
      )}
    </div>
  );
}
