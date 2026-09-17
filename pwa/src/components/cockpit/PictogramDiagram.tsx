"use client";

/**
 * 本文の ```pictogram ブロックを、ビジネスモデルのピクト図として描く。
 *
 * 3×3 の枠にヒト（自社・企業・工場・大学など）を置き、モノ・サービスの流れを青、お金の流れを橙の矢印で結ぶ。
 * お金の添え書きには ¥ の硬貨の印を付ける（2026-09-17 まさ「カネとモノの流れを示す矢印はそれぞれ別の色にして、
 * カネのところはお金っぽいアイコンを添えて」）。計画中・形が未定のヒトと流れは破線で描く。
 *
 * 配置は src/lib/pictogram.ts の純関数。図は 1000px で組み、枠が狭いときは枠の幅まで縮めて全体を見せる（「実寸で表示」で戻せる）。
 * スマホの幅では縮めずに枠の中で横に動かし、流れの一覧を図の下に出す。定義が読めないときは元の文をそのまま出す（MermaidDiagram と同じ考え方）。
 * 仕様: pwa/spec/3-20-project-technology-current-spec.md §5.6
 */

import { Building2, Factory, GraduationCap, JapaneseYen, Package, Store, User, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PICTOGRAM_FIT_MIN_WIDTH,
  PICTOGRAM_FLOW_LABEL,
  PICTOGRAM_LABEL_ICON,
  describePictogramFlow,
  layoutPictogram,
  parsePictogram,
  pictogramFitScale,
  pictogramGridLines,
  type PictogramFlowKind,
  type PictogramIcon,
  type PlacedPictogramFlow,
} from "@/lib/pictogram";

type Props = {
  code: string;
  tone?: "light" | "hud";
};

/** 流れの色。コスト試算タブの区分の色（白地で見分けを検査済み）の青と橙を使う。 */
export const PICTOGRAM_FLOW_COLOR: Record<PictogramFlowKind, string> = {
  goods: "#2a78d6",
  money: "#eb6834",
};

const NODE_ICON: Record<PictogramIcon, LucideIcon> = {
  self: Building2,
  company: Building2,
  factory: Factory,
  university: GraduationCap,
  person: User,
  shop: Store,
};

const ARROW_HEAD = 10;

export function FlowKindBadge({ kind, size = 16 }: { kind: PictogramFlowKind; size?: number }) {
  const Icon = kind === "money" ? JapaneseYen : Package;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white ${
        kind === "money" ? "bg-[#eb6834] ring-2 ring-[#fbd3bf]" : "bg-[#2a78d6]"
      }`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.62)} strokeWidth={kind === "money" ? 3 : 2.4} />
    </span>
  );
}

export function PictogramDiagram({ code, tone = "light" }: Props) {
  const parsed = useMemo(() => parsePictogram(code), [code]);
  const layout = useMemo(() => (parsed.ok ? layoutPictogram(parsed.pictogram) : null), [parsed]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [actualSize, setActualSize] = useState(false);
  const [avail, setAvail] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isHud = tone === "hud";

  // 図の枠の幅を測り、狭ければ縮める（枠の幅は画面の幅とトピック一覧の有無で変わる）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setAvail(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [parsed.ok]);

  if (!parsed.ok || !layout) {
    return (
      <div className="my-2">
        <p className={`mb-1 text-[11px] ${isHud ? "text-amber-200" : "text-[#8a5a00]"}`}>
          ピクト図の定義を読めない：{parsed.ok ? "配置できない" : parsed.error}
        </p>
        <pre
          className={`overflow-x-auto rounded p-3 text-[11px] font-mono ${
            isHud ? "bg-slate-900/70 text-cyan-50" : "bg-[#f5f5f7] text-[#1d1d1f]"
          }`}
        >
          {code}
        </pre>
      </div>
    );
  }

  const { pictogram } = parsed;
  const selfNode = pictogram.nodes.find((n) => n.icon === "self");
  const related = (f: PlacedPictogramFlow) => !focusId || f.flow.from === focusId || f.flow.to === focusId;
  const grid = pictogramGridLines();
  const gridColor = isHud ? "rgba(165,243,252,0.14)" : "#ececf0";
  const fitScale = pictogramFitScale(avail, layout.width);
  const scale = actualSize ? 1 : fitScale;
  const narrow = avail !== null && avail < PICTOGRAM_FIT_MIN_WIDTH;

  return (
    <figure
      data-testid="pictogram-diagram"
      className={`my-3 overflow-hidden rounded-lg border ${
        isHud ? "border-cyan-300/30 bg-slate-900/40" : "border-[#d2d2d7] bg-white"
      }`}
    >
      <figcaption
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-[11px] ${
          isHud ? "border-cyan-300/20 text-cyan-50/80" : "border-[#e5e5ea] text-[#48484a]"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <FlowKindBadge kind="goods" />
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" stroke={PICTOGRAM_FLOW_COLOR.goods} strokeWidth="2.5" />
          </svg>
          モノ・サービスの流れ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FlowKindBadge kind="money" />
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" stroke={PICTOGRAM_FLOW_COLOR.money} strokeWidth="2.5" />
          </svg>
          お金の流れ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="25" y2="4" stroke={isHud ? "#cbd5e1" : "#6e6e73"} strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          破線は計画中・形が未定
        </span>
        <span className={`hidden sm:inline ${isHud ? "text-cyan-50/60" : "text-[#8e8e93]"}`}>
          ヒトにカーソルを合わせると、そのヒトの流れだけを濃く表示
        </span>
        {fitScale < 1 && (
          <button
            type="button"
            data-testid="pictogram-size-toggle"
            aria-pressed={actualSize}
            onClick={() => setActualSize((v) => !v)}
            className={`ml-auto inline-flex min-h-8 items-center rounded-md border px-2 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#027FDC] ${
              isHud ? "border-cyan-300/40 text-cyan-100 hover:bg-cyan-300/10" : "border-[#7cbceb] text-[#0267b2] hover:bg-[#e8f3fc]"
            }`}
          >
            {actualSize ? "枠に合わせて表示" : "実寸で表示"}
          </button>
        )}
      </figcaption>

      {/* 図の実寸 (1000px) で親の幅を押し広げないよう、幅は親から受け取る。縮めた図が枠に収まらない分は、この枠の中で横に動かす */}
      <div ref={scrollRef} className="overflow-x-auto [contain:inline-size]" data-testid="pictogram-scroll">
        <div className="mx-auto" style={{ width: layout.width * scale, height: layout.height * scale }}>
          <div
            aria-hidden="true"
            data-scale={scale}
            className="relative origin-top-left"
            style={{ width: layout.width, height: layout.height, transform: scale === 1 ? undefined : `scale(${scale})` }}
            onMouseLeave={() => setFocusId(null)}
          >
            <svg className="absolute inset-0" width={layout.width} height={layout.height}>
              {/* 3×3 の枠 */}
              {grid.xs.map((x) => (
                <line key={`col-${x}`} x1={x} y1={8} x2={x} y2={layout.height - 8} stroke={gridColor} strokeDasharray="3 5" />
              ))}
              {grid.ys.map((y) => (
                <line key={`row-${y}`} x1={8} y1={y} x2={layout.width - 8} y2={y} stroke={gridColor} strokeDasharray="3 5" />
              ))}
              {layout.flows.map((f, i) => {
                const dx = f.x2 - f.x1;
                const dy = f.y2 - f.y1;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                const bx = f.x2 - ux * ARROW_HEAD;
                const by = f.y2 - uy * ARROW_HEAD;
                const color = PICTOGRAM_FLOW_COLOR[f.flow.kind];
                const head = `${f.x2},${f.y2} ${bx - uy * 5.5},${by + ux * 5.5} ${bx + uy * 5.5},${by - ux * 5.5}`;
                return (
                  <g
                    key={i}
                    data-flow-kind={f.flow.kind}
                    style={{ opacity: related(f) ? 1 : 0.14, transition: "opacity 120ms" }}
                  >
                    <line
                      x1={f.x1}
                      y1={f.y1}
                      x2={bx + ux * 1}
                      y2={by + uy * 1}
                      stroke={color}
                      strokeWidth={2.5}
                      strokeDasharray={f.flow.planned ? "7 5" : undefined}
                    />
                    <polygon points={head} fill={color} />
                  </g>
                );
              })}
            </svg>

            {layout.nodes.map(({ node, rect }) => {
              const Icon = NODE_ICON[node.icon];
              const isSelf = node.icon === "self";
              const dim = focusId !== null && focusId !== node.id
                && !layout.flows.some((f) => (f.flow.from === focusId && f.flow.to === node.id) || (f.flow.to === focusId && f.flow.from === node.id));
              return (
                <div
                  key={node.id}
                  data-pictogram-node={node.id}
                  onMouseEnter={() => setFocusId(node.id)}
                  className={`absolute flex flex-col items-center rounded-xl px-2 pb-1.5 pt-2 text-center ${
                    isSelf
                      ? isHud
                        ? "border-2 border-sky-300 bg-sky-400/15"
                        : "border-2 border-[#027FDC] bg-[#e8f3fc] shadow-[0_2px_8px_rgba(2,127,220,0.18)]"
                      : node.planned
                        ? isHud
                          ? "border border-dashed border-slate-400 bg-slate-900/60"
                          : "border border-dashed border-[#8e8e93] bg-[#fafafc]"
                        : isHud
                          ? "border border-cyan-300/30 bg-slate-900/70"
                          : "border border-[#c7c7cc] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  }`}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                    opacity: dim ? 0.35 : 1,
                    transition: "opacity 120ms",
                  }}
                >
                  {node.planned && (
                    <span
                      className={`absolute right-1.5 top-1.5 rounded px-1 text-[9.5px] leading-[15px] ${
                        isHud ? "bg-slate-700 text-slate-200" : "bg-[#f2f2f7] text-[#6e6e73]"
                      }`}
                    >
                      計画中
                    </span>
                  )}
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isSelf
                        ? "bg-[#027FDC] text-white"
                        : isHud
                          ? "bg-slate-700 text-cyan-50"
                          : "bg-[#f2f2f7] text-[#3a3a3c]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span
                    className={`mt-1 w-full truncate text-[12.5px] font-semibold leading-[17px] ${
                      isSelf ? (isHud ? "text-sky-100" : "text-[#0267b2]") : isHud ? "text-cyan-50" : "text-[#1d1d1f]"
                    }`}
                  >
                    {node.label}
                  </span>
                  {node.note && (
                    <span
                      className={`mt-0.5 line-clamp-2 text-[10.5px] leading-[14px] ${
                        isHud ? "text-cyan-50/70" : "text-[#6e6e73]"
                      }`}
                    >
                      {node.note}
                    </span>
                  )}
                </div>
              );
            })}

            {layout.flows.map((f, i) => (
              <div
                key={`label-${i}`}
                data-pictogram-label={f.flow.kind}
                className={`absolute flex items-start rounded-md border px-1 py-0.5 text-[11px] leading-[15px] ${
                  isHud ? "bg-slate-900/90 text-cyan-50" : "bg-white/95 text-[#1d1d1f]"
                } ${f.flow.kind === "money" ? "border-[#eb6834]/40" : "border-[#2a78d6]/35"}`}
                style={{
                  left: f.label.x,
                  top: f.label.y,
                  width: f.label.w,
                  minHeight: f.label.h,
                  gap: PICTOGRAM_LABEL_ICON - 15,
                  opacity: related(f) ? 1 : 0.14,
                  transition: "opacity 120ms",
                }}
              >
                <span className="mt-[-0.5px] flex h-[15px] items-center">
                  <FlowKindBadge kind={f.flow.kind} size={15} />
                </span>
                <span className="min-w-0 break-words">{f.flow.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        data-testid="pictogram-flow-list"
        className={`border-t px-3 py-2 ${narrow ? "" : "sm:sr-only"} ${isHud ? "border-cyan-300/20" : "border-[#e5e5ea]"}`}
      >
        <p className={`mb-1 text-[11px] font-semibold ${isHud ? "text-cyan-50/80" : "text-[#48484a]"}`}>
          {selfNode ? `${selfNode.label}を中心にした流れの一覧` : "流れの一覧"}
        </p>
        <ul className="space-y-1">
          {pictogram.flows.map((flow, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px] leading-[18px]">
              <span className="mt-[1px]">
                <FlowKindBadge kind={flow.kind} />
              </span>
              <span>
                <span className="sr-only">{PICTOGRAM_FLOW_LABEL[flow.kind]}：</span>
                {describePictogramFlow(pictogram, flow)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
