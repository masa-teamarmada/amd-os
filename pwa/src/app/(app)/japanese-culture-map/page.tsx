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
// react-simple-maps も SSR で d3-geo の DOM 依存を避けるため dynamic
const JapanMap = dynamic(() => import("./JapanMap"), { ssr: false });

type ViewMode = "mindmap" | "map";

// 大分類ごとの色 (depth 0 のラベルで割り当て、子は親色を継承)
const ROOT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#a855f7",
];

function colorForRoot(rootLabel: string, rootLabels: string[]): string {
  const idx = rootLabels.indexOf(rootLabel);
  return ROOT_COLORS[((idx < 0 ? 0 : idx) % ROOT_COLORS.length)];
}

// ---------------------------------------------------------------------------
// マインドマップ用のグラフノード
// ---------------------------------------------------------------------------
interface MapNode {
  id: string;
  label: string;
  depth: number; // -1=root, 0=大分類, 1=中分類, ...
  color: string;
  treeNode: CultureTreeNode | null; // カテゴリノードなら対応する tree node
  item: JpCultureItem | null; // 葉=コンテンツノードなら対応するアイテム
  val: number;
}
interface MapLink {
  source: string;
  target: string;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
                "text-[11px] px-3 py-1 rounded-md font-medium transition-colors",
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

      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-center">
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
    </div>
  );
}

// ===========================================================================
// マインドマップ表示 (展開式)
// ===========================================================================
function MindMapView({ tree }: { tree: CultureTreeNode }) {
  const fgRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  // 展開済みカテゴリノード id の集合。初期は root の直下 (= 大分類) だけ見える
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["__root__"]));
  const [selected, setSelected] = useState<JpCultureItem | null>(null);

  const rootLabels = useMemo(
    () => tree.children.map((c) => c.label),
    [tree]
  );

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // expanded 集合から表示するノード/リンクを構築
  const data = useMemo(() => {
    const nodes: MapNode[] = [];
    const links: MapLink[] = [];

    const walk = (node: CultureTreeNode, parentId: string | null) => {
      const isRoot = node.id === "__root__";
      const rootLabel = isRoot
        ? ""
        : node.id.split("/")[0];
      const color = isRoot ? "#94a3b8" : colorForRoot(rootLabel, rootLabels);

      if (!isRoot) {
        nodes.push({
          id: node.id,
          label: node.label,
          depth: node.depth,
          color,
          treeNode: node,
          item: null,
          val: 6 + Math.min(20, node.totalItems * 2) - node.depth * 1.5,
        });
        if (parentId) links.push({ source: parentId, target: node.id });
      }

      // このノードが展開されている時だけ子を出す
      const myId = isRoot ? "__root__" : node.id;
      if (expanded.has(myId)) {
        for (const child of node.children) {
          walk(child, isRoot ? null : node.id);
        }
        // 葉カテゴリ (= 自分に直接アイテムがある) も展開時にコンテンツノード表示
        for (const item of node.items) {
          const leafId = `item:${item.id}`;
          nodes.push({
            id: leafId,
            label: item.title,
            depth: node.depth + 1,
            color: hexToRgba(color, 0.85),
            treeNode: null,
            item,
            val: 4,
          });
          if (!isRoot) links.push({ source: node.id, target: leafId });
        }
      }
    };

    walk(tree, null);
    return { nodes, links };
  }, [tree, expanded, rootLabels]);

  // force チューニング (atlas/map を参考に、ツリー向けに緩めに)
  useEffect(() => {
    if (!fgRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg = fgRef.current as any;
    if (fg.d3Force("charge")) fg.d3Force("charge").strength(-420);
    if (fg.d3Force("link")) fg.d3Force("link").distance(70).strength(1);
    fg.d3ReheatSimulation?.();
  }, [data]);

  const toggleNode = (node: MapNode) => {
    if (node.item) {
      setSelected(node.item);
      return;
    }
    if (!node.treeNode) return;
    const hasChildren =
      node.treeNode.children.length > 0 || node.treeNode.items.length > 0;
    if (!hasChildren) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  return (
    <div className="absolute inset-0" ref={containerRef}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={size.w}
        height={size.h}
        nodeRelSize={4}
        cooldownTime={4000}
        d3VelocityDecay={0.3}
        warmupTicks={80}
        autoPauseRedraw={false}
        linkColor={() => "rgba(148, 163, 184, 0.35)"}
        linkWidth={1}
        onNodeClick={(node: MapNode) => toggleNode(node)}
        nodeCanvasObject={(
          node: MapNode,
          ctx: CanvasRenderingContext2D,
          globalScale: number
        ) => {
          const x = (node as unknown as { x: number }).x;
          const y = (node as unknown as { y: number }).y;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          const scale = Number.isFinite(globalScale) && globalScale > 0 ? globalScale : 1;
          const isItem = !!node.item;
          const r = isItem ? 3.2 : Math.max(4, Math.sqrt(node.val) * 1.7);

          // glow
          const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3);
          glow.addColorStop(0, hexToRgba(node.color, 0.5));
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(x, y, r * 3, 0, 2 * Math.PI, false);
          ctx.fillStyle = glow;
          ctx.fill();

          // body
          ctx.save();
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 12 / scale;
          ctx.beginPath();
          if (isItem) {
            // コンテンツノードは菱形で区別
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
          ctx.lineWidth = 1 / scale;
          ctx.strokeStyle = "rgba(236, 254, 255, 0.6)";
          ctx.stroke();
          ctx.restore();

          // 展開可能で未展開のカテゴリには「+」を出す
          const treeNode = node.treeNode;
          const expandable =
            treeNode &&
            (treeNode.children.length > 0 || treeNode.items.length > 0);

          // ラベル (大分類 / 中分類は常時、その他は zoom で)
          const showLabel = node.depth <= 1 || scale > 1.1 || isItem;
          if (showLabel) {
            const fontSize = Math.max(7, (isItem ? 8 : 11 - node.depth) / scale);
            ctx.font = `${isItem ? "500" : "700"} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            const label =
              node.label.length > 18 ? node.label.slice(0, 18) + "…" : node.label;
            ctx.lineWidth = Math.max(2, 3 / scale);
            ctx.strokeStyle = "rgba(2, 8, 23, 0.95)";
            ctx.strokeText(label, x, y + r + 2);
            ctx.fillStyle = "rgba(226, 232, 240, 0.95)";
            ctx.fillText(label, x, y + r + 2);
          }
        }}
        nodeLabel={(n: MapNode) =>
          n.item
            ? n.item.title
            : `${n.label} (${n.treeNode?.totalItems ?? 0})`
        }
      />

      {/* hint */}
      <div className="absolute top-3 left-3 bg-background/85 backdrop-blur-sm rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
        ノードをクリックで展開 / ◆ コンテンツをクリックで詳細
      </div>

      {/* detail panel */}
      {selected && (
        <ItemDetailPanel item={selected} onClose={() => setSelected(null)} />
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
    <div className="absolute inset-0 flex">
      {/* map */}
      <div className="flex-1 relative min-w-0">
        <JapanMap
          activePrefectures={new Set(geo.keys())}
          selectedPrefecture={selectedPref}
          onSelectPrefecture={(p) => {
            setSelectedPref(p);
            setSelectedItem(null);
          }}
        />
        <div className="absolute top-3 left-3 bg-background/85 backdrop-blur-sm rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
          色のついた都道府県にコンテンツがあります。クリックで一覧表示
        </div>
      </div>

      {/* side list */}
      <div className="w-80 border-l border-border overflow-y-auto shrink-0 bg-background/40">
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
                        className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
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
// コンテンツ詳細パネル (両ビュー共通)
// ===========================================================================
function ItemDetailPanel({
  item,
  onClose,
}: {
  item: JpCultureItem;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-0 right-0 h-full w-80 max-w-[90vw] border-l border-border bg-background/95 backdrop-blur-sm shadow-xl overflow-y-auto z-10">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold leading-snug">{item.title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {item.category_path.map((c, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground"
            >
              {c}
            </span>
          ))}
          {(item.prefecture || item.city) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              📍 {[item.prefecture, item.city].filter(Boolean).join(" ")}
            </span>
          )}
        </div>

        {item.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full rounded-lg border border-border"
          />
        )}

        {item.description && (
          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {item.description}
          </p>
        )}

        {item.links.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              リンク
            </p>
            {item.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-primary hover:underline truncate"
              >
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
