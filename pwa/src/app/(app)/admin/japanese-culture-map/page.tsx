"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchJpCultureItems,
  buildCultureTree,
  groupByGeography,
  type JpCultureItem,
  type CultureTreeNode,
  type PrefectureGroup,
} from "@/lib/jp-culture";
import { cn } from "@/lib/utils";

// react-force-graph は Canvas 依存で SSR 不可 (atlas/map と同方針)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as React.ComponentType<any>;
// 地図データはclient fetchし、ResizeObserverで描画領域を確定するためdynamic
const JapanMap = dynamic(() => import("./JapanMap"), { ssr: false });

type ViewMode = "mindmap" | "map";

// ---------------------------------------------------------------------------
// 大分類ごとの色 (atlas の domainColor 相当)
// ---------------------------------------------------------------------------
const ROOT_PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#a855f7",
  "#84cc16", "#f59e0b", "#10b981", "#6366f1", "#0ea5e9",
];

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(103, 232, 249, ${alpha})`;
  const n = Number.parseInt(normalized, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// マインドマップ用グラフノード (atlas の StoryNode 相当)
// ---------------------------------------------------------------------------
interface CultureNode {
  id: string;
  kind: "category" | "item";
  name: string;
  depth: number; // 0=大分類, 1=中分類, ...  item は親 depth+1
  color: string;
  treeNode: CultureTreeNode | null; // カテゴリノードなら対応する tree node
  item: JpCultureItem | null; // コンテンツノードなら対応するアイテム
  val: number;
  expandable: boolean;
  rootLabel: string;
}
interface GLink {
  source: string;
  target: string;
}

export default function JapaneseCultureMapPage() {
  const [view, setView] = useState<ViewMode>("mindmap");
  const [items, setItems] = useState<JpCultureItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchJpCultureItems()
      .then((rows) => {
        if (alive) setItems(rows);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const tree = useMemo(() => buildCultureTree(items), [items]);
  const geo = useMemo(() => groupByGeography(items), [items]);

  return (
    <div className="h-[calc(100vh-2.75rem)] flex flex-col">
      {/* Header / tabs */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 shrink-0 flex-wrap">
        <h1 className="text-sm font-bold">🇯🇵 日本文化マップ</h1>
        <span className="text-[10px] text-muted-foreground">
          {items.length} コンテンツ
        </span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {(
            [
              ["mindmap", "🧠 マインドマップ"],
              ["map", "🗾 日本地図"],
            ] as [ViewMode, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cn(
                "min-h-11 rounded-md px-3 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-0",
                view === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              まだ文化コンテンツがありません
            </p>
            <p className="text-xs text-muted-foreground/60">
              jp_culture_items テーブルにコンテンツを追加してください
            </p>
          </div>
        </div>
      ) : view === "mindmap" ? (
        <MindMapView tree={tree} />
      ) : (
        <MapView geo={geo} />
      )}
    </div>
  );
}

// ===========================================================================
// マインドマップ表示 (atlas/map をそのまま土台に、データ源だけ差し替え)
// ===========================================================================
function MindMapView({ tree }: { tree: CultureTreeNode }) {
  const [selected, setSelected] = useState<CultureNode | null>(null);
  // 展開済みカテゴリノード id の集合。初期は root の直下 (= 大分類) だけ見える
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["__root__"]));
  const [size, setSize] = useState({ w: 800, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const rootLabels = useMemo(() => tree.children.map((c) => c.label), [tree]);
  const colorForRoot = (rootLabel: string): string => {
    const idx = rootLabels.indexOf(rootLabel);
    return ROOT_PALETTE[(idx < 0 ? 0 : idx) % ROOT_PALETTE.length];
  };

  // expanded から表示するノード/リンクを構築
  const data = useMemo(() => {
    const nodes: CultureNode[] = [];
    const links: GLink[] = [];

    const walk = (node: CultureTreeNode, parentId: string | null) => {
      const isRoot = node.id === "__root__";
      const rootLabel = isRoot ? "" : node.id.split("/")[0];
      const color = isRoot ? "#94a3b8" : colorForRoot(rootLabel);

      if (!isRoot) {
        const expandable = node.children.length > 0 || node.items.length > 0;
        nodes.push({
          id: node.id,
          kind: "category",
          name: node.label,
          depth: node.depth,
          color,
          treeNode: node,
          item: null,
          // 大分類ほど大きく。atlas の val 体系 (sqrt で半径化) に合わせる
          val: 6 + Math.min(40, node.totalItems * 6) - node.depth * 2,
          expandable,
          rootLabel,
        });
        if (parentId) links.push({ source: parentId, target: node.id });
      }

      const myId = isRoot ? "__root__" : node.id;
      if (expanded.has(myId)) {
        for (const child of node.children) {
          walk(child, isRoot ? null : node.id);
        }
        for (const item of node.items) {
          const leafId = `item:${item.id}`;
          nodes.push({
            id: leafId,
            kind: "item",
            name: item.title,
            depth: node.depth + 1,
            color: hexToRgba(color, 0.9),
            treeNode: null,
            item,
            val: 4,
            expandable: false,
            rootLabel,
          });
          if (!isRoot) links.push({ source: node.id, target: leafId });
        }
      }
    };

    walk(tree, null);
    return { nodes, links };
  }, [tree, expanded, rootLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  // size 追従 (atlas と同じ)
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

  const focusNode = (node: CultureNode) => {
    if (!fgRef.current) return;
    const x = (node as unknown as { x?: number }).x ?? 0;
    const y = (node as unknown as { y?: number }).y ?? 0;
    fgRef.current.centerAt(x, y, 600);
    fgRef.current.zoom(2.5, 600);
  };

  // ---------------------------------------------------------------------------
  // force チューニング (atlas/map の「直径×8 hard constraint + radial」を
  // ツリー向けに移植。radial は「大分類ごとに角度を割り当て」で扇状に散らす)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return;

    // 大分類 (rootLabel) ごとに角度を割り当て
    const uniqueRoots = Array.from(
      new Set(data.nodes.map((n) => n.rootLabel || "_"))
    ).sort();
    const rootAngles = new Map<string, number>();
    uniqueRoots.forEach((d, i) => {
      rootAngles.set(d, (i / Math.max(1, uniqueRoots.length)) * 2 * Math.PI);
    });
    // depth が深いほど中心から遠く配置 (大分類=内側、葉=外側)
    const radiusForDepth = (depth: number) => 600 + depth * 700;

    // 初期座標を上書き (pin は尊重)
    for (const node of data.nodes) {
      const m = node as unknown as {
        x?: number;
        y?: number;
        fx?: number | null;
        fy?: number | null;
        rootLabel: string;
        depth: number;
      };
      if (m.fx != null && m.fy != null) continue;
      const ang =
        (rootAngles.get(m.rootLabel || "_") ?? 0) +
        (Math.random() - 0.5) * (Math.PI / 8);
      const r = radiusForDepth(m.depth) + (Math.random() - 0.5) * 400;
      m.x = Math.cos(ang) * r;
      m.y = Math.sin(ang) * r;
    }

    // Radial force: 各ノードを「自 大分類の角度 × depth半径」へ引っ張る
    const radialForce = (alpha: number) => {
      for (const node of data.nodes as unknown as {
        x: number;
        y: number;
        vx: number;
        vy: number;
        rootLabel: string;
        depth: number;
      }[]) {
        const ang = rootAngles.get(node.rootLabel || "_") ?? 0;
        const r = radiusForDepth(node.depth);
        const tx = Math.cos(ang) * r;
        const ty = Math.sin(ang) * r;
        node.vx += (tx - node.x) * 0.12 * alpha;
        node.vy += (ty - node.y) * 0.12 * alpha;
      }
    };

    // 「直径×6」hard constraint collide (atlas の直径×8 を少し緩めた版)
    const collisionForce = () => {
      const nodes = data.nodes as unknown as {
        x: number;
        y: number;
        vx: number;
        vy: number;
        val: number;
      }[];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const ra = Math.sqrt(a.val || 4) * 1.6;
          const rb = Math.sqrt(b.val || 4) * 1.6;
          const minDist = (ra + rb) * 6;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < minDist * minDist && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            const overlap = (minDist - d) * 0.7;
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
    fg.d3Force("center", null);
    fg.d3Force("radial", radialForce);
    fg.d3Force("collide", collisionForce);
    if (fg.d3Force("charge")) fg.d3Force("charge").strength(-8000);
    if (fg.d3Force("link")) {
      // 親子リンクはやや強めに保ち、ツリー構造を維持
      fg.d3Force("link").distance(220).strength(0.3);
    }
    fg.d3ReheatSimulation();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // 「5秒後に縮小」現象根絶のため engineStop は空 (atlas と同じ)
  const handleEngineStop = () => {};

  const toggleExpand = (node: CultureNode) => {
    if (!node.expandable) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  return (
    <div className="flex-1 relative" ref={containerRef}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={size.w}
        height={size.h}
        nodeRelSize={4}
        nodeLabel={(n: CultureNode) =>
          n.kind === "item"
            ? n.name
            : `${n.name} · ${n.treeNode?.totalItems ?? 0} コンテンツ`
        }
        nodeCanvasObject={(
          node: CultureNode,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          const x = (node as unknown as { x: number }).x;
          const y = (node as unknown as { y: number }).y;
          const scale = Number.isFinite(globalScale) && globalScale > 0 ? globalScale : 1;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          const isItem = node.kind === "item";
          const r = Math.sqrt(node.val || 4) * 1.6;
          const nodeGlow = hexToRgba(node.color, 0.55);

          // glow (atlas と同じ放射グラデ)
          const glow = ctx.createRadialGradient(x, y, r * 0.35, x, y, r * 3.4);
          glow.addColorStop(0, nodeGlow);
          glow.addColorStop(0.42, hexToRgba(node.color, 0.2));
          glow.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.beginPath();
          ctx.arc(x, y, r * 3.4, 0, 2 * Math.PI, false);
          ctx.fillStyle = glow;
          ctx.fill();

          // 本体 (atlas と同じ shadow + stroke)
          ctx.save();
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 18 / scale;
          ctx.beginPath();
          if (isItem) {
            // コンテンツは菱形で区別
            ctx.moveTo(x, y - r);
            ctx.lineTo(x + r, y);
            ctx.lineTo(x, y + r);
            ctx.lineTo(x - r, y);
            ctx.closePath();
          } else {
            ctx.arc(x, y, r, 0, 2 * Math.PI, false);
          }
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.lineWidth = 1.2 / scale;
          ctx.strokeStyle = "rgba(236, 254, 255, 0.52)";
          ctx.stroke();
          ctx.restore();

          // 中心ハイライト (カテゴリのみ)
          if (!isItem) {
            ctx.beginPath();
            ctx.arc(x, y, r * 0.45, 0, 2 * Math.PI, false);
            ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
            ctx.fill();
          }

          // ピン留め (atlas と同じ)
          if ((node as unknown as { fx: number | null }).fx != null) {
            ctx.lineWidth = 0.8 / scale;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.stroke();
          }

          // 展開可能 & 未展開のカテゴリには「＋」を中心に表示
          if (node.expandable && !expanded.has(node.id)) {
            const fz = r * 0.9;
            ctx.font = `bold ${fz}px sans-serif`;
            ctx.fillStyle = "rgba(255,255,255,0.92)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("＋", x, y + fz * 0.05);
          }

          // ラベル (atlas と同じ stroke 縁取り。大分類/中分類は常時)
          const showLabel = node.depth <= 1 || scale > 1.15 || isItem;
          if (showLabel) {
            const fontSize = Math.max(7, (isItem ? 8 : 11 - node.depth) / scale);
            ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const label =
              node.name.length > 20 ? node.name.slice(0, 20) + "…" : node.name;
            ctx.lineWidth = Math.max(2.2, 3 / scale);
            ctx.strokeStyle = "rgba(2, 8, 23, 0.96)";
            ctx.strokeText(label, x, y + r + 2);
            ctx.fillStyle = isItem
              ? "rgba(207, 250, 254, 0.9)"
              : "rgba(254, 240, 138, 0.96)";
            ctx.fillText(label, x, y + r + 1);
          }
        }}
        linkColor={() => "rgba(103, 232, 249, 0.18)"}
        linkWidth={() => 0.8}
        cooldownTime={8000}
        d3VelocityDecay={0.18}
        warmupTicks={150}
        autoPauseRedraw={false}
        onEngineStop={handleEngineStop}
        onNodeClick={(node: CultureNode) => {
          if (node.kind === "item") {
            setSelected(node);
            focusNode(node);
          } else {
            toggleExpand(node);
            focusNode(node);
          }
        }}
        onNodeDragEnd={(node: CultureNode) => {
          // 他のピン留めをすべて解除 (atlas と同じ)
          data.nodes.forEach((n) => {
            if (n.id !== node.id) {
              const m = n as unknown as { fx: number | null; fy: number | null };
              m.fx = null;
              m.fy = null;
            }
          });
          const n = node as unknown as { x: number; y: number; fx: number; fy: number };
          n.fx = n.x;
          n.fy = n.y;
        }}
      />

      {/* Legend (atlas と同じ位置・スタイル) */}
      <div className="absolute bottom-3 left-3 bg-background/85 backdrop-blur-sm rounded-lg border border-border p-2.5 text-[10px] shadow-sm max-w-[220px]">
        <p className="font-semibold text-foreground/80 mb-1.5">大分類</p>
        <div className="space-y-0.5">
          {rootLabels.map((label) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: colorForRoot(label) }}
              />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-border text-[9px] text-muted-foreground/70 leading-snug">
          ● カテゴリ (＋=展開可)
          <br />◆ コンテンツ (クリックで詳細)
          <br />ドラッグで位置固定
        </div>
      </div>

      {/* detail panel */}
      {selected && selected.item && (
        <ItemDetailPanel item={selected.item} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ===========================================================================
// 日本地図表示
// ===========================================================================
function MapView({ geo }: { geo: Map<string, PrefectureGroup> }) {
  const [selectedPref, setSelectedPref] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<JpCultureItem | null>(null);

  const prefGroup = selectedPref ? geo.get(selectedPref) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      {/* map */}
      <div className="relative min-h-0 w-full flex-1 md:min-w-0">
        <JapanMap
          activePrefectures={new Set(geo.keys())}
          selectedPrefecture={selectedPref}
          onSelectPrefecture={(p) => {
            setSelectedPref(p);
            setSelectedItem(null);
          }}
        />
        <div className="absolute left-3 right-3 top-3 rounded-lg border border-border bg-background/85 px-3 py-2 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm sm:right-auto sm:max-w-sm">
          色のついた都道府県にコンテンツがあります。クリックで一覧表示
        </div>
      </div>

      {/* side list */}
      <div className="h-44 w-full shrink-0 overflow-y-auto border-t border-border bg-background/40 md:h-auto md:w-80 md:border-l md:border-t-0">
        {!selectedPref ? (
          <div className="p-4 text-sm text-muted-foreground">
            都道府県を選択してください
          </div>
        ) : !prefGroup ? (
          <div className="p-4 space-y-1">
            <p className="text-sm font-bold">{selectedPref}</p>
            <p className="text-xs text-muted-foreground">
              この都道府県のコンテンツはまだありません
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{selectedPref}</p>
              <span className="text-[10px] text-muted-foreground">
                {prefGroup.items.length} 件
              </span>
            </div>
            {prefGroup.cities.map((cg) => (
              <div key={cg.city} className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground border-b border-border/60 pb-0.5">
                  {cg.city}
                  <span className="ml-1 opacity-60">{cg.items.length}</span>
                </p>
                <ul className="space-y-1">
                  {cg.items.map((it) => (
                    <li key={it.id}>
                      <button
                        onClick={() => setSelectedItem(it)}
                        className="min-h-11 w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <span className="font-medium">{it.title}</span>
                        {it.category_path.length > 0 && (
                          <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
                            {it.category_path.join(" › ")}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <ItemDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}

// ===========================================================================
// コンテンツ詳細パネル (atlas の StoryDetailPanel と同じ枠・位置)
// ===========================================================================
function ItemDetailPanel({
  item,
  onClose,
}: {
  item: JpCultureItem;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-3 right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-auto space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-3 shadow-xl sm:left-auto sm:w-96">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.category_path.map((c, i) => (
            <span
              key={i}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
            >
              {c}
            </span>
          ))}
          {(item.prefecture || item.city) && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              📍 {[item.prefecture, item.city].filter(Boolean).join(" ")}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="閉じる"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <h3 className="text-sm font-bold leading-snug">{item.title}</h3>

      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image_url}
          alt={item.title}
          className="w-full rounded-lg border border-border"
        />
      )}

      {item.description && (
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {item.description}
        </p>
      )}

      {item.links.length > 0 && (
        <div className="space-y-1 pt-1.5 border-t border-border/50">
          {item.links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-primary/80 hover:text-primary truncate"
            >
              {l.label || l.url}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
