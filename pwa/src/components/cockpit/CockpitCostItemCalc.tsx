"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
    <CostDetailLine label="計算" testId="cost-item-calc" signature={JSON.stringify(calc)}>
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
    </CostDetailLine>
  );
}

/** 長い計算・根拠も全文を保持し、必要な行だけ開ける。 */
function CostDetailLine({ label, testId, signature, children }: { label: string; testId: string; signature: string; children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [signature]);
  return (
    <div className="flex items-start gap-1.5 text-[10px] leading-4" data-testid={testId}>
      <span className="shrink-0 font-semibold text-[#6e6e73]">{label}</span>
      <p ref={ref} className={`min-w-0 flex-1 whitespace-pre-line tabular-nums text-[#6e6e73] ${open ? "" : "line-clamp-2 xl:line-clamp-1"}`}>
        {children}
      </p>
      {(open || overflowing) && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${label}を${open ? "閉じる" : "全文表示"}`} className="min-h-8 shrink-0 font-semibold text-[#0267b2] hover:underline xl:min-h-0">
          {open ? "閉じる" : "全文"}
        </button>
      )}
    </div>
  );
}

/** 明細の説明。省略は表示だけで、根拠本文を削らない。 */
export function ItemNoteLine({ note }: { note: string | null }) {
  const text = note?.trim() ?? "";
  return <CostDetailLine label="根拠" testId="cost-item-note" signature={text}>{text || "書かれていない"}</CostDetailLine>;
}
