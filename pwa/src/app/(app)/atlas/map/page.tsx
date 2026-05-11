"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAtlasSignals,
  fetchAtlasStories,
  type AtlasSignal,
  type AtlasStory,
} from "@/lib/supabase-data";
import { tagColorClass } from "@/lib/atlas-tags";
import {
  domainColor,
  domainLabel,
  domainKey,
} from "@/lib/atlas-domains";
import { cn } from "@/lib/utils";

// react-force-graph は Canvas 依存で SSR 不可
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as React.ComponentType<any>;

interface StoryWithSignals extends AtlasStory {
  signals: AtlasSignal[];
}

interface StoryNode {
  id: string;
  kind: "story";
  name: string;
  story: StoryWithSignals;
  val: number;
  color: string;
  recent: boolean;
}

type GNode = StoryNode;

interface GLink {
  source: string;
  target: string;
  weight: number; // 共通タグ数
}

type TimeRange = "all" | "30d" | "7d" | "24h";
const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  all: "全期間",
  "30d": "30日",
  "7d": "7日",
  "24h": "24h",
};
const TIME_RANGE_HOURS: Record<TimeRange, number | null> = {
  all: null,
  "30d": 24 * 30,
  "7d": 24 * 7,
  "24h": 24,
};
const RECENT_HOURS = 24; // 直近24時間で更新があったストーリーを NEW 扱い

function formatYmd(ts: string) {
  return new Date(ts).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

const sourceTypeLabel: Record<string, string> = {
  news: "NEWS",
  report: "REPORT",
  data: "DATA",
  manual: "MEMO",
};

export default function AtlasMapPage() {
  const [stories, setStories] = useState<StoryWithSignals[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StoryNode | null>(null);
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [domainFilterKeys, setDomainFilterKeys] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const toggleSetItem = (s: Set<string>, item: string): Set<string> => {
    const next = new Set(s);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };
  const [size, setSize] = useState({ w: 800, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  useEffect(() => {
    Promise.all([
      fetchAtlasStories({ limit: 500 }),
      fetchAtlasSignals("accepted"),
    ]).then(([sts, sigs]) => {
      const byStory = new Map<string, AtlasSignal[]>();
      sigs.forEach((s) => {
        if (s.story_id) {
          const arr = byStory.get(s.story_id) || [];
          arr.push(s);
          byStory.set(s.story_id, arr);
        }
      });
      byStory.forEach((arr) =>
        arr.sort(
          (a, b) =>
            new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
        )
      );
      const enriched: StoryWithSignals[] = sts
        .map((st) => ({ ...st, signals: byStory.get(st.id) || [] }))
        .filter((st) => st.signals.length > 0);
      setStories(enriched);
      setLoading(false);
    });
  }, []);

  // 期間フィルタ後の stories（last_updated_at で判定）
  const periodFiltered = useMemo(() => {
    const hours = TIME_RANGE_HOURS[timeRange];
    if (hours == null) return stories;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return stories.filter(
      (st) => new Date(st.last_updated_at).getTime() >= cutoff
    );
  }, [stories, timeRange]);

  const domainCounts = useMemo(() => {
    const m = new Map<string, number>();
    periodFiltered.forEach((st) => {
      const k = domainKey(st.primary_domain);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [periodFiltered]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    periodFiltered.forEach((st) => {
      const tagSet = new Set<string>([
        ...(st.tags || []),
        ...st.signals.flatMap((s) => s.suggested_tags),
      ]);
      tagSet.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [periodFiltered]);

  const data = useMemo(
    () => buildGraph(periodFiltered, tagFilters, domainFilterKeys),
    [periodFiltered, tagFilters, domainFilterKeys]
  );

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.max(320, rect.width), h: Math.max(400, rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const focusNode = (node: GNode) => {
    if (!fgRef.current) return;
    const x = (node as unknown as { x?: number }).x ?? 0;
    const y = (node as unknown as { y?: number }).y ?? 0;
    fgRef.current.centerAt(x, y, 600);
    fgRef.current.zoom(2.5, 600);
  };

  // 完全均一分散化 (2026-05-11 5 ラウンド目 — 4 ラウンドかけても直らないため圧倒的に拡大):
  //   ★ 5 秒後の縮小現象 = engineStop 時に zoomToFit が走るのが原因 → zoomToFit を完全に撤廃
  //   ★ 中央密集 = ForceGraph2D が内部で勝手に x=0,y=0 周辺に初期座標を割り当ててる
  //       → useEffect で **常に上書き** (= 既に座標があっても初期化、pin 以外)
  //   ★ ノード間距離が変わらない = 力場の絶対値が小さすぎた
  //       → RADIUS 600→2400, collide 80→220, charge -4000→-18000, link 450→1200
  //       → velocityDecay 0.25→0.18 (動き止まりにくく)
  //       → cooldownTime 3000→8000 (8 秒は force 動かす)

  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return;

    // domain 角度マッピング: 出現する domain key を sort して 0..2π に均等割り
    const uniqueDomains = Array.from(
      new Set(
        data.nodes.map((n) => domainKey(n.story.primary_domain) ?? "_")
      )
    ).sort();
    const domainAngles = new Map<string, number>();
    uniqueDomains.forEach((d, i) => {
      domainAngles.set(
        d,
        (i / Math.max(1, uniqueDomains.length)) * 2 * Math.PI
      );
    });
    const RADIUS = 2400; // 旧 600 → 4 倍

    // 初期座標を **常に上書き** (= ForceGraph2D が割り当てた x=0 付近をリセット)。
    // ただし、ユーザーがドラッグで pin したノード (fx/fy 持ち) は触らない。
    for (const node of data.nodes) {
      const m = node as unknown as {
        x?: number;
        y?: number;
        fx?: number | null;
        fy?: number | null;
        story: StoryWithSignals;
      };
      if (m.fx != null && m.fy != null) continue; // pin は尊重
      const dk = domainKey(m.story.primary_domain) ?? "_";
      const ang = domainAngles.get(dk) ?? 0;
      // 半径方向にもジッタを入れて (RADIUS ± 600)、円周上の薄い帯にしない
      const r = RADIUS + (Math.random() - 0.5) * 1200;
      // 角度方向にもジッタ (±15°) で同 domain 内も完全均一にしない
      const angJitter = ang + (Math.random() - 0.5) * (Math.PI / 12);
      m.x = Math.cos(angJitter) * r;
      m.y = Math.sin(angJitter) * r;
    }

    // Radial domain force: 各ノードを「自 domain の角度 × 半径 RADIUS」に強めに引っ張る。
    const radialDomainForce = (alpha: number) => {
      for (const node of data.nodes as unknown as {
        x: number;
        y: number;
        vx: number;
        vy: number;
        story: StoryWithSignals;
      }[]) {
        const dk = domainKey(node.story.primary_domain) ?? "_";
        const ang = domainAngles.get(dk) ?? 0;
        const tx = Math.cos(ang) * RADIUS;
        const ty = Math.sin(ang) * RADIUS;
        node.vx += (tx - node.x) * 0.08 * alpha; // 旧 0.05 → 0.08
        node.vy += (ty - node.y) * 0.08 * alpha;
      }
    };

    // Collision: 最小距離 220 (旧 80 の約 3 倍) でラベル重なりを完全に防ぐ。
    const collisionForce = (alpha: number) => {
      const nodes = data.nodes as unknown as { x: number; y: number; vx: number; vy: number }[];
      const minDist = 220;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist * minDist && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const overlap = (minDist - d) * 0.5 * alpha;
            const ux = dx / d;
            const uy = dy / d;
            a.vx -= ux * overlap;
            a.vy -= uy * overlap;
            b.vx += ux * overlap;
            b.vy += uy * overlap;
          }
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg = fgRef.current as any;
    // 旧 force は全部 null
    fg.d3Force("isolatedCenter", null);
    fg.d3Force("center", null); // ForceGraph2D の default center force を完全に撤去
    fg.d3Force("radialDomain", radialDomainForce);
    fg.d3Force("collide", collisionForce);
    // 反発を圧倒的に強める (-4000 → -18000)
    if (fg.d3Force("charge")) fg.d3Force("charge").strength(-18000);
    // リンク距離も圧倒的に拡大 (450 → 1200)
    if (fg.d3Force("link")) fg.d3Force("link").distance(1200);
    fg.d3ReheatSimulation();
  }, [data]);

  // 「5 秒後に縮小」現象を根絶するため、engineStop ハンドラを完全に空にする。
  // (= zoomToFit を呼ばない = 自動の zoom 補正なし = ユーザーは初期 zoom のまま見る)
  const handleEngineStop = () => {
    // intentionally empty — see comment above.
  };

  return (
    <div className="h-[calc(100vh-2.75rem)] flex flex-col">
      {/* Header bar */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 shrink-0 flex-wrap">
        <Link href="/atlas" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Atlas
        </Link>
        <h1 className="text-sm font-bold">Atlas Map</h1>
        <span className="text-[10px] text-muted-foreground">
          {data.nodes.length} stories · {data.links.length} 共通テーマ接続
        </span>

        {/* Time range */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {(Object.keys(TIME_RANGE_LABEL) as TimeRange[]).map((k) => (
            <button
              key={k}
              onClick={() => setTimeRange(k)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-md font-medium transition-colors",
                timeRange === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {TIME_RANGE_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar (複数選択可) */}
      <div className="px-4 py-2 border-b border-border flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            分野 <span className="font-normal text-muted-foreground/60">(複数可)</span>
          </span>
          {Array.from(domainCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([k, c]) => {
              const active = domainFilterKeys.has(k);
              return (
                <button
                  key={k}
                  onClick={() => setDomainFilterKeys((s) => toggleSetItem(s, k))}
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full transition-all flex items-center gap-1",
                    active
                      ? "ring-2 ring-offset-1 ring-offset-background"
                      : "opacity-70 hover:opacity-100"
                  )}
                  style={{ background: domainColor(k), color: "white" }}
                >
                  {domainLabel(k)}
                  <span className="text-[10px] opacity-80">{c}</span>
                </button>
              );
            })}
          {(tagFilters.size > 0 || domainFilterKeys.size > 0) && (
            <button
              onClick={() => {
                setTagFilters(new Set());
                setDomainFilterKeys(new Set());
              }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
            >
              ✕ フィルタ解除
            </button>
          )}
        </div>

        {tagCounts.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
              タグ <span className="font-normal text-muted-foreground/60">(複数可)</span>
            </span>
            {tagCounts.slice(0, 14).map(([t, c]) => {
              const active = tagFilters.has(t);
              return (
                <button
                  key={t}
                  onClick={() => setTagFilters((s) => toggleSetItem(s, t))}
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full transition-all",
                    active ? "" : "opacity-70 hover:opacity-100",
                    tagColorClass(t, active)
                  )}
                >
                  #{t} <span className="opacity-60 ml-0.5 text-[10px]">{c}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 relative" ref={containerRef}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">表示できるストーリーがありません</p>
              <p className="text-xs text-muted-foreground/60">期間を広げるかフィルタを解除してください</p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={data}
            width={size.w}
            height={size.h}
            nodeRelSize={4}
            nodeLabel={(n: GNode) =>
              `${n.story.signals.length} signals · ${domainLabel(n.story.primary_domain)} · ${n.name}`
            }
            nodeCanvasObject={(
              node: GNode,
              ctx: CanvasRenderingContext2D,
              globalScale: number
            ) => {
              const x = (node as unknown as { x: number }).x;
              const y = (node as unknown as { y: number }).y;
              const r = Math.sqrt(node.val || 4) * 1.6;

              // パルス: HIGH かつ signal_count ≥ 3 のガチ重要ストーリー
              // 円ノード本体の前に下層として描画
              const showPulse =
                node.story.importance === "high" && node.story.signals.length >= 3;
              if (showPulse) {
                const t = (Date.now() % 1600) / 1600; // 1.6秒周期
                const pulseR = r + r * 1.2 * t;
                const alpha = 0.55 * (1 - t);
                ctx.beginPath();
                ctx.arc(x, y, pulseR, 0, 2 * Math.PI, false);
                ctx.fillStyle = `rgba(251, 191, 36, ${alpha * 0.4})`;
                ctx.fill();
                ctx.lineWidth = 1.6 / globalScale;
                ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
                ctx.stroke();
              }

              // 本体: 円
              ctx.beginPath();
              ctx.arc(x, y, r, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.color;
              ctx.fill();
              // ピン留めされてるノードは細い縁を追加
              if ((node as unknown as { fx: number | null }).fx != null) {
                ctx.lineWidth = 0.8 / globalScale;
                ctx.strokeStyle = "rgba(255,255,255,0.7)";
                ctx.stroke();
              }

              // NEW: 直近24h のみ。右上に赤バッジ
              if (node.recent) {
                const fz = r * 0.7; // ノードに比例
                ctx.font = `bold ${fz}px sans-serif`;
                const text = "NEW";
                const tw = ctx.measureText(text).width;
                const padX = r * 0.15;
                const padY = r * 0.1;
                const bw = tw + padX * 2;
                const bh = fz + padY * 2;
                const bx = x + r * 0.7;
                const by = y - r * 0.85;
                // 軽い影
                ctx.fillStyle = "rgba(0,0,0,0.3)";
                ctx.fillRect(
                  bx - bw / 2 + r * 0.04,
                  by - bh / 2 + r * 0.04,
                  bw,
                  bh
                );
                // 本体
                ctx.fillStyle = "#dc2626";
                ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(text, bx, by);
              }

              // ラベル
              const showLabel =
                globalScale > 1.0 ||
                node.story.importance === "high" ||
                node.story.signals.length >= 3;
              if (showLabel) {
                const fontSize = 10 / globalScale;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "rgba(60,60,60,0.92)";
                const label = node.name;
                const trimmed = label.length > 26 ? label.slice(0, 26) + "…" : label;
                ctx.fillText(trimmed, x, y + r + 1);
              }
            }}
            linkColor={() => "rgba(120,120,120,0.22)"}
            linkWidth={(l: GLink) => 0.4 + Math.min(2.4, (l.weight || 1) * 0.4)}
            cooldownTime={8000}
            d3VelocityDecay={0.18}
            warmupTicks={150}
            autoPauseRedraw={false}
            onEngineStop={handleEngineStop}
            onNodeClick={(node: GNode) => {
              focusNode(node);
              setSelected(node);
            }}
            onNodeDragEnd={(node: GNode) => {
              // 他のピン留めをすべて解除（古い固定が増え続けないように）
              data.nodes.forEach((n) => {
                if (n.id !== node.id) {
                  const m = n as unknown as { fx: number | null; fy: number | null };
                  m.fx = null;
                  m.fy = null;
                }
              });
              // 自分だけピン留め
              const n = node as unknown as { x: number; y: number; fx: number; fy: number };
              n.fx = n.x;
              n.fy = n.y;
            }}
          />
        )}

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-background/85 backdrop-blur-sm rounded-lg border border-border p-2.5 text-[10px] shadow-sm max-w-[200px]">
          <p className="font-semibold text-foreground/80 mb-1.5">凡例</p>
          <div className="space-y-0.5">
            {Array.from(domainCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([k, c]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: domainColor(k) }}
                  />
                  <span className="text-muted-foreground">{domainLabel(k)}</span>
                  <span className="text-muted-foreground/60 ml-auto">{c}</span>
                </div>
              ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="relative w-3 h-3 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
                <span className="absolute inset-[3px] rounded-full bg-amber-400" />
              </span>
              <span className="text-muted-foreground">最重要 (パルス)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-bold px-1 py-0 rounded bg-red-600 text-white">
                NEW
              </span>
              <span className="text-muted-foreground">直近24h更新</span>
            </div>
            <div className="text-[9px] text-muted-foreground/70 pt-0.5 leading-snug">
              ● ストーリー (色=分野・サイズ=signal数)
              <br />― 共通タグ2個以上で接続
              <br />ドラッグで位置固定 (他をドラッグすると解除)
            </div>
          </div>
        </div>

        {/* Story detail panel */}
        {selected && selected.kind === "story" && (
          <StoryDetailPanel
            story={selected.story}
            onClose={() => setSelected(null)}
            onTagClick={(t) => setTagFilters((s) => toggleSetItem(s, t))}
            activeTags={tagFilters}
          />
        )}
      </div>
    </div>
  );
}

function StoryDetailPanel({
  story,
  onClose,
  onTagClick,
  activeTags,
}: {
  story: StoryWithSignals;
  onClose: () => void;
  onTagClick: (t: string) => void;
  activeTags: Set<string>;
}) {
  const dKey = domainKey(story.primary_domain);
  const dColor = dKey ? domainColor(dKey) : "#94a3b8";
  return (
    <div className="absolute top-3 right-3 w-96 bg-background rounded-lg border border-border shadow-xl p-3 space-y-3 max-h-[calc(100%-1.5rem)] overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {dKey && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
              style={{ background: dColor }}
            >
              {domainLabel(dKey)}
            </span>
          )}
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded",
              story.importance === "high"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : story.importance === "medium"
                  ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  : "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            )}
          >
            {story.importance.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground/70 font-medium">
            {story.signals.length} signals
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1 shrink-0"
          aria-label="閉じる"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <h3 className="text-sm font-bold leading-snug">{story.title}</h3>
      {story.summary && (
        <p className="text-xs text-muted-foreground leading-relaxed">{story.summary}</p>
      )}

      {/* Timeline */}
      {story.signals.length > 0 && (
        <ol className="space-y-2 relative ml-2 pl-3 border-l border-border">
          {story.signals.map((s) => (
            <li key={s.id} className="relative">
              <span
                className="absolute -left-[15px] top-1.5 w-2 h-2 rounded-full"
                style={{ background: dColor }}
              />
              <div className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground/60 font-mono">
                  {formatYmd(s.submitted_at)}
                </span>
                <p className="text-xs font-medium leading-snug">{s.title}</p>
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary truncate max-w-full"
                  >
                    <span className="text-[9px] font-mono px-1 py-0 rounded bg-muted text-muted-foreground/80">
                      {s.source_type ? sourceTypeLabel[s.source_type] : "MEMO"}
                    </span>
                    <span className="truncate">{s.source_url}</span>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Story tags */}
      {story.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/50">
          {story.tags.slice(0, 10).map((t) => (
            <button
              key={t}
              onClick={() => onTagClick(t)}
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                tagColorClass(t, activeTags.has(t))
              )}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <Link
        href="/atlas"
        className="block w-full text-center text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
      >
        Atlas で詳細を見る →
      </Link>
    </div>
  );
}

function buildGraph(
  stories: StoryWithSignals[],
  tagFilters: Set<string>,
  domainFilterKeys: Set<string>
): { nodes: GNode[]; links: GLink[] } {
  const filtered = stories.filter((st) => {
    if (domainFilterKeys.size > 0) {
      const k = domainKey(st.primary_domain);
      if (!k || !domainFilterKeys.has(k)) return false;
    }
    if (tagFilters.size > 0) {
      const stTagSet = new Set<string>([
        ...(st.tags || []),
        ...st.signals.flatMap((s) => s.suggested_tags),
      ]);
      // OR: いずれかのタグにマッチすれば表示
      let matched = false;
      for (const t of tagFilters) {
        if (stTagSet.has(t)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  });

  // 各ストーリーのタグセット
  const tagSets = new Map<string, Set<string>>();
  filtered.forEach((st) => {
    tagSets.set(
      st.id,
      new Set<string>([
        ...(st.tags || []),
        ...st.signals.flatMap((s) => s.suggested_tags),
      ])
    );
  });

  const recentCutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000;
  const nodes: GNode[] = filtered.map((st) => {
    // recent判定: ストーリー内の最新 signal の submitted_at で見る
    // (last_updated_at はバッチ処理で全件更新されることがあるため信頼しない)
    const latestSignalAt = st.signals.length
      ? Math.max(...st.signals.map((s) => new Date(s.submitted_at).getTime()))
      : 0;
    return {
      id: `s:${st.id}`,
      kind: "story" as const,
      name: st.title,
      story: st,
      val: 4 + st.signals.length * 4 + (st.importance === "high" ? 6 : 0),
      color: domainColor(st.primary_domain),
      recent: latestSignalAt >= recentCutoff,
    };
  });

  // ストーリー間: 共通タグ ≥3 のペアにエッジ。各ストーリーから類似度上位 2 件まで
  // 旧: MIN_OVERLAP=2, TOP_K=3 では link 数が 300+ になって中央に密集していたため、
  // まさ要望「分散させて見やすく」を反映して link 数を半減 (2026-05-11)
  const links: GLink[] = [];
  const seen = new Set<string>();
  const MIN_OVERLAP = 3;
  const TOP_K = 2;
  filtered.forEach((st) => {
    const myTags = tagSets.get(st.id)!;
    const candidates: { id: string; overlap: number }[] = [];
    filtered.forEach((other) => {
      if (other.id === st.id) return;
      const ot = tagSets.get(other.id)!;
      let overlap = 0;
      myTags.forEach((t) => {
        if (ot.has(t)) overlap++;
      });
      if (overlap >= MIN_OVERLAP) candidates.push({ id: other.id, overlap });
    });
    candidates.sort((a, b) => b.overlap - a.overlap);
    candidates.slice(0, TOP_K).forEach((c) => {
      const key = [st.id, c.id].sort().join("__");
      if (seen.has(key)) return;
      seen.add(key);
      links.push({
        source: `s:${st.id}`,
        target: `s:${c.id}`,
        weight: c.overlap,
      });
    });
  });

  return { nodes, links };
}
