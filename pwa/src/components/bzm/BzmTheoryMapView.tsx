"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List as ListIcon, Maximize2, Search } from "lucide-react";
import type {
  TheoryEdge,
  TheoryNodeKind,
  TheoryNodeLayer,
  TheoryNodeStatus,
  TheoryRelationType,
} from "@/lib/bzm-theory-graph";

export interface TheoryMapNode {
  id: string;
  title: string;
  kind: TheoryNodeKind;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  summary: string;
  sourceRef: string;
  sourceHref: string | null;
  body: string;
}

interface GraphNode extends TheoryMapNode {
  val: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: TheoryRelationType;
}

interface ForceGraphProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  width: number;
  height: number;
  backgroundColor?: string;
  cooldownTicks?: number;
  linkColor?: (link: GraphLink) => string;
  linkWidth?: (link: GraphLink) => number;
  linkLineDash?: (link: GraphLink) => number[] | null;
  linkLabel?: (link: GraphLink) => string;
  linkDirectionalArrowLength?: number;
  linkDirectionalArrowRelPos?: number;
  nodeCanvasObject?: (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodePointerAreaPaint?: (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => void;
  onNodeClick?: (node: GraphNode) => void;
  onEngineStop?: () => void;
}

interface ForceGraphHandle {
  centerAt: (x?: number, y?: number, ms?: number) => void;
  zoom: (k?: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
}

// react-force-graph は Canvas 依存で SSR 不可
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as React.ComponentType<ForceGraphProps & { ref?: React.Ref<ForceGraphHandle> }>;

// パレット: 紙のベージュ地 / 黒鉛の文字 / 青写真の青 (構造) / 苔緑 (支持) / オーカー (未確定) / 朱 (反証)
const PAPER_BG = "#f4efe3";
const PAPER_PANEL = "#faf6ec";
const PAPER_BORDER = "#ccc2a8";
const GRAPHITE = "#2c2b28";
const GRAPHITE_MUTED = "#6b6656";
const BLUEPRINT = "#2952a3";
const MOSS = "#4a6b3d";
const OCHRE = "#7d5a13";
const VERMILION = "#b4402a";

const KIND_LABEL: Record<TheoryNodeKind, string> = {
  concept: "概念",
  claim: "主張",
  measure: "測定",
  decision: "決定",
  source: "外部ソース",
  question: "未解決問い",
};

const KIND_MARK: Record<TheoryNodeKind, string> = {
  concept: "概",
  claim: "主",
  measure: "測",
  decision: "決",
  source: "源",
  question: "問",
};

type NodeShape = "circle" | "diamond" | "square" | "triangle" | "hexagon" | "circle-dashed";

const KIND_SHAPE: Record<TheoryNodeKind, NodeShape> = {
  concept: "circle",
  claim: "diamond",
  measure: "square",
  decision: "triangle",
  source: "hexagon",
  question: "circle-dashed",
};

const LAYER_LABEL: Record<TheoryNodeLayer, string> = {
  "cross-layer": "横断",
  evidence: "根拠層",
  diagnosis: "診断層",
  prediction: "予測層",
  decision: "決定層",
  institution: "制度層",
  portfolio: "ポートフォリオ層",
};

const LAYER_ORDER: TheoryNodeLayer[] = [
  "cross-layer",
  "evidence",
  "diagnosis",
  "prediction",
  "decision",
  "institution",
  "portfolio",
];

const STATUS_LABEL: Record<TheoryNodeStatus, string> = {
  established: "現行採用・資料存在",
  conditional: "条件付き",
  "design-choice": "設計選択",
  hypothesis: "仮説",
  refuted: "反証済み",
  unknown: "未解明",
};

const STATUS_COLOR: Record<TheoryNodeStatus, string> = {
  established: MOSS,
  conditional: BLUEPRINT,
  "design-choice": GRAPHITE,
  hypothesis: OCHRE,
  refuted: VERMILION,
  unknown: OCHRE,
};

const RELATION_LABEL: Record<TheoryRelationType, string> = {
  defines: "定義する",
  supports: "支持する",
  challenges: "異議を唱える",
  refutes: "反証する",
  depends_on: "依存する",
  supersedes: "上書きする",
  operationalizes: "運用化する",
  tests: "検証する",
};

const RELATION_COLOR: Record<TheoryRelationType, string> = {
  defines: MOSS,
  supports: MOSS,
  operationalizes: MOSS,
  challenges: OCHRE,
  refutes: VERMILION,
  depends_on: BLUEPRINT,
  supersedes: GRAPHITE_MUTED,
  tests: BLUEPRINT,
};

const SUPPORT_TYPES: TheoryRelationType[] = ["supports", "defines", "operationalizes"];
const CHALLENGE_TYPES: TheoryRelationType[] = ["challenges", "refutes"];
const STRUCTURAL_TYPES: TheoryRelationType[] = ["depends_on", "supersedes"];
const TEST_TYPES: TheoryRelationType[] = ["tests"];

function rgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function textMatches(node: TheoryMapNode, query: string) {
  if (!query) return true;
  const haystack = [node.id, node.title, node.summary, node.sourceRef].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke: string,
  dashed: boolean
) {
  ctx.beginPath();
  if (dashed) ctx.setLineDash([r * 0.35, r * 0.35]);
  switch (shape) {
    case "circle":
    case "circle-dashed":
      ctx.arc(x, y, r, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case "square":
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case "triangle":
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.95, y + r * 0.75);
      ctx.lineTo(x - r * 0.95, y + r * 0.75);
      ctx.closePath();
      break;
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
  }
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.setLineDash([]);
}

function createLayerForce(getNodes: () => GraphNode[], columnWidth: number, rowHeight: number) {
  let nodes: GraphNode[] = [];
  let rowById = new Map<string, number>();
  const middle = (LAYER_ORDER.length - 1) / 2;
  const force = (alpha: number) => {
    for (const node of nodes) {
      const col = LAYER_ORDER.indexOf(node.layer);
      const targetX = (col < 0 ? 0 : col - middle) * columnWidth;
      const targetY = rowById.get(node.id) ?? 0;
      node.vx = (node.vx ?? 0) + (targetX - (node.x ?? 0)) * 0.18 * alpha;
      node.vy = (node.vy ?? 0) + (targetY - (node.y ?? 0)) * 0.2 * alpha;
    }
  };
  force.initialize = (initNodes: GraphNode[]) => {
    nodes = initNodes ?? getNodes();
    rowById = new Map();
    for (const layer of LAYER_ORDER) {
      const layerNodes = nodes.filter((node) => node.layer === layer).sort((a, b) => a.id.localeCompare(b.id));
      const rowMiddle = (layerNodes.length - 1) / 2;
      layerNodes.forEach((node, index) => rowById.set(node.id, (index - rowMiddle) * rowHeight));
    }
  };
  return force;
}

export function BzmTheoryMapView({
  nodes,
  edges,
  errors,
}: {
  nodes: TheoryMapNode[];
  edges: TheoryEdge[];
  errors: string[];
}) {
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [layerFilter, setLayerFilter] = useState<Set<TheoryNodeLayer>>(new Set(LAYER_ORDER));
  const [statusFilter, setStatusFilter] = useState<Set<TheoryNodeStatus>>(
    new Set(Object.keys(STATUS_LABEL) as TheoryNodeStatus[])
  );
  const [relationFilter, setRelationFilter] = useState<Set<TheoryRelationType>>(
    new Set(Object.keys(RELATION_LABEL) as TheoryRelationType[])
  );
  const [selectedId, setSelectedId] = useState(
    nodes.find((node) => node.id === "concept-six-layer-structure")?.id ?? nodes[0]?.id ?? ""
  );
  const [size, setSize] = useState({ w: 900, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphHandle | null>(null);
  const [graphReadyVersion, setGraphReadyVersion] = useState(0);

  const handleGraphRef = useCallback((handle: ForceGraphHandle | null) => {
    graphRef.current = handle;
    if (handle) setGraphReadyVersion((version) => version + 1);
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    // Canvas map is intentionally optional on narrow screens; the list keeps
    // every node readable and keyboard-operable as the default mobile view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("list");
  }, []);

  const incomingByTarget = useMemo(() => {
    const map = new Map<string, TheoryEdge[]>();
    for (const edge of edges) {
      if (!map.has(edge.to)) map.set(edge.to, []);
      map.get(edge.to)!.push(edge);
    }
    return map;
  }, [edges]);

  const outgoingBySource = useMemo(() => {
    const map = new Map<string, TheoryEdge[]>();
    for (const edge of edges) {
      if (!map.has(edge.from)) map.set(edge.from, []);
      map.get(edge.from)!.push(edge);
    }
    return map;
  }, [edges]);

  const degreeById = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.from, (map.get(edge.from) ?? 0) + 1);
      map.set(edge.to, (map.get(edge.to) ?? 0) + 1);
    }
    return map;
  }, [edges]);

  const filteredNodes = useMemo(() => {
    const q = deferredQuery.trim();
    return nodes.filter(
      (n) => layerFilter.has(n.layer) && statusFilter.has(n.status) && textMatches(n, q)
    );
  }, [nodes, layerFilter, statusFilter, deferredQuery]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () =>
      edges.filter(
        (e) => relationFilter.has(e.type) && visibleIds.has(e.from) && visibleIds.has(e.to)
      ),
    [edges, relationFilter, visibleIds]
  );

  const graphData = useMemo(() => {
    const gNodes: GraphNode[] = filteredNodes.map((n) => ({
      ...n,
      val: Math.max(1, degreeById.get(n.id) ?? 1),
    }));
    const gLinks: GraphLink[] = filteredEdges.map((e) => ({ source: e.from, target: e.to, type: e.type }));
    return { nodes: gNodes, links: gLinks };
  }, [filteredNodes, filteredEdges, degreeById]);

  const selected = nodeById.get(selectedId) ?? null;

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSize({ w: Math.max(320, rect.width), h: Math.max(420, rect.height) });
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

  useEffect(() => {
    if (view !== "map") return;
    const fg = graphRef.current as unknown as { d3Force: (n: string, f?: unknown) => void } | null;
    if (!fg) return;
    fg.d3Force("layerGrid", createLayerForce(() => graphData.nodes, 190, 92));
    const timer = window.setTimeout(() => graphRef.current?.zoomToFit(400, 40), 260);
    return () => window.clearTimeout(timer);
  }, [graphData, graphReadyVersion, view]);

  function toggleInSet<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function resetFilters() {
    setQuery("");
    setLayerFilter(new Set(LAYER_ORDER));
    setStatusFilter(new Set(Object.keys(STATUS_LABEL) as TheoryNodeStatus[]));
    setRelationFilter(new Set(Object.keys(RELATION_LABEL) as TheoryRelationType[]));
  }

  const incomingForSelected = selected ? incomingByTarget.get(selected.id) ?? [] : [];
  const outgoingForSelected = selected ? outgoingBySource.get(selected.id) ?? [] : [];

  const supportIn = incomingForSelected.filter((e) => SUPPORT_TYPES.includes(e.type));
  const challengeIn = incomingForSelected.filter((e) => CHALLENGE_TYPES.includes(e.type));
  const testEdges = [...incomingForSelected, ...outgoingForSelected].filter((e) =>
    TEST_TYPES.includes(e.type)
  );
  const structuralEdges = [...incomingForSelected, ...outgoingForSelected].filter((e) =>
    STRUCTURAL_TYPES.includes(e.type)
  );
  const effectsOut = outgoingForSelected.filter(
    (e) => SUPPORT_TYPES.includes(e.type) || CHALLENGE_TYPES.includes(e.type)
  );

  const gaps: string[] = [];
  if (selected && selected.kind !== "source") {
    const hasExternalSupport = incomingForSelected.some((e) => {
      const from = nodeById.get(e.from);
      return from?.kind === "source" && SUPPORT_TYPES.includes(e.type);
    });
    if (!hasExternalSupport) gaps.push("外部ソースによる支持がない");
    if (challengeIn.length === 0) gaps.push("異議・反証の接続がない");
    if (testEdges.length === 0) gaps.push("検証 (tests) の接続がない");
  }

  return (
    <div style={{ color: GRAPHITE }}>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
        <header
          className="rounded-lg border px-4 py-4"
          style={{ backgroundColor: PAPER_PANEL, borderColor: PAPER_BORDER }}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium" style={{ color: GRAPHITE_MUTED }}>
            <span
              className="rounded-full border px-2 py-0.5 font-mono"
              style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_BG }}
            >
              BZM 2.0 / 知識構造
            </span>
            <span>{nodes.length} ノード / {edges.length} 関係</span>
            <Link href="/bzm" className="ml-auto font-semibold hover:underline" style={{ color: BLUEPRINT }}>
              ← 教科書へ戻る
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">理論マップ — 論証台帳</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: GRAPHITE_MUTED }}>
            BZM 2.0 の主張・概念・測定・決定・外部ソース・未解決問いを、定義・支持・異議・反証・依存・上書き・運用化・検証の関係で結んだ台帳。
            件数は接続の本数を示すだけで、真偽や確信度を表さない。
          </p>
          {errors.length > 0 && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: VERMILION, backgroundColor: rgba(VERMILION, 0.08), color: VERMILION }}
            >
              <div className="font-semibold">読み込みエラー</div>
              <ul className="mt-1 list-disc pl-4">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </header>

        <section
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-3"
          style={{ backgroundColor: PAPER_PANEL, borderColor: PAPER_BORDER }}
        >
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="bzm-map-search" className="sr-only">
              理論ノードを検索
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: GRAPHITE_MUTED }}
            />
            <input
              id="bzm-map-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ノード検索 (id / タイトル / 要約)"
              className="h-9 w-full rounded-md border pl-9 pr-3 text-sm outline-none"
              style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_BG, color: GRAPHITE }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="層で絞り込み">
            {LAYER_ORDER.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => toggleInSet(layerFilter, layer, setLayerFilter)}
                className="h-8 rounded-md border px-2 text-[11px] font-medium transition"
                style={{
                  borderColor: PAPER_BORDER,
                  backgroundColor: layerFilter.has(layer) ? BLUEPRINT : PAPER_BG,
                  color: layerFilter.has(layer) ? "#fff" : GRAPHITE_MUTED,
                }}
                aria-pressed={layerFilter.has(layer)}
              >
                {LAYER_LABEL[layer]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="状態で絞り込み">
            {(Object.keys(STATUS_LABEL) as TheoryNodeStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleInSet(statusFilter, status, setStatusFilter)}
                className="h-8 rounded-md border px-2 text-[11px] font-medium transition"
                style={{
                  borderColor: STATUS_COLOR[status],
                  backgroundColor: statusFilter.has(status) ? rgba(STATUS_COLOR[status], 0.16) : PAPER_BG,
                  color: statusFilter.has(status) ? STATUS_COLOR[status] : GRAPHITE_MUTED,
                }}
                aria-pressed={statusFilter.has(status)}
              >
                {STATUS_LABEL[status].split(" ")[0]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="関係で絞り込み">
            {(Object.keys(RELATION_LABEL) as TheoryRelationType[]).map((rel) => (
              <button
                key={rel}
                type="button"
                onClick={() => toggleInSet(relationFilter, rel, setRelationFilter)}
                className="h-8 rounded-md border px-2 text-[11px] font-medium transition"
                style={{
                  borderColor: RELATION_COLOR[rel],
                  backgroundColor: relationFilter.has(rel) ? rgba(RELATION_COLOR[rel], 0.16) : PAPER_BG,
                  color: relationFilter.has(rel) ? RELATION_COLOR[rel] : GRAPHITE_MUTED,
                }}
                aria-pressed={relationFilter.has(rel)}
              >
                {RELATION_LABEL[rel]}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={resetFilters}
              className="h-8 rounded-md border px-2.5 text-xs font-medium"
              style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
            >
              フィルタ解除
            </button>
            <button
              type="button"
              onClick={() => graphRef.current?.zoomToFit(400, 40)}
              disabled={view !== "map"}
              className="grid h-8 w-8 place-items-center rounded-md border disabled:opacity-40"
              style={{ borderColor: PAPER_BORDER }}
              title="全体を表示"
              aria-label="マップ全体を表示"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className="grid h-8 w-8 place-items-center rounded-md border"
              style={{
                borderColor: PAPER_BORDER,
                backgroundColor: view === "map" ? BLUEPRINT : PAPER_BG,
                color: view === "map" ? "#fff" : GRAPHITE_MUTED,
              }}
              title="マップ表示"
              aria-label="マップ表示に切り替え"
              aria-pressed={view === "map"}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className="grid h-8 w-8 place-items-center rounded-md border"
              style={{
                borderColor: PAPER_BORDER,
                backgroundColor: view === "list" ? BLUEPRINT : PAPER_BG,
                color: view === "list" ? "#fff" : GRAPHITE_MUTED,
              }}
              title="一覧表示"
              aria-label="一覧表示に切り替え"
              aria-pressed={view === "list"}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div
            className="min-w-0 overflow-hidden rounded-lg border"
            style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
          >
            {view === "map" ? (
              <div
                ref={containerRef}
                className="relative h-[520px] w-full lg:h-[720px]"
                style={{ backgroundColor: PAPER_BG }}
              >
                <div
                  className="pointer-events-none absolute inset-x-3 top-3 z-10 hidden grid-cols-7 gap-1 sm:grid"
                  aria-hidden="true"
                >
                  {LAYER_ORDER.map((layer) => (
                    <span
                      key={layer}
                      className="rounded border px-1 py-0.5 text-center text-[9px] font-semibold"
                      style={{ borderColor: PAPER_BORDER, backgroundColor: rgba(PAPER_PANEL, 0.88), color: GRAPHITE_MUTED }}
                    >
                      {LAYER_LABEL[layer]}
                    </span>
                  ))}
                </div>
                <ForceGraph2D
                  ref={handleGraphRef}
                  graphData={graphData}
                  width={size.w}
                  height={size.h}
                  backgroundColor={PAPER_BG}
                  cooldownTicks={90}
                  linkColor={(link) => rgba(RELATION_COLOR[link.type], 0.55)}
                  linkWidth={(link) => (CHALLENGE_TYPES.includes(link.type) ? 1.6 : 1.1)}
                  linkLineDash={(link) => (STRUCTURAL_TYPES.includes(link.type) ? [4, 3] : null)}
                  linkLabel={(link) => RELATION_LABEL[link.type]}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const r = Math.max(6, 4 + Math.sqrt(node.val) * 2.2);
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const isSelected = selected?.id === node.id;
                    const color = STATUS_COLOR[node.status];
                    ctx.save();
                    if (isSelected) {
                      ctx.beginPath();
                      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
                      ctx.fillStyle = rgba(color, 0.2);
                      ctx.fill();
                    }
                    drawShape(
                      ctx,
                      KIND_SHAPE[node.kind],
                      x,
                      y,
                      r,
                      rgba(color, 0.85),
                      isSelected ? GRAPHITE : "rgba(255,255,255,0.9)",
                      node.kind === "question"
                    );
                    ctx.font = `700 ${9 / Math.max(1, globalScale)}px ui-sans-serif, system-ui`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#fff";
                    ctx.fillText(KIND_MARK[node.kind], x, y + 0.5);

                    const label = node.title.length > 15 ? `${node.title.slice(0, 14)}…` : node.title;
                    const textScale = Math.max(1, globalScale);
                    ctx.font = `600 ${10 / textScale}px ui-sans-serif, system-ui`;
                    const labelY = y + r + 8 / textScale;
                    const labelWidth = ctx.measureText(label).width;
                    ctx.fillStyle = rgba(PAPER_PANEL, 0.9);
                    ctx.fillRect(
                      x - labelWidth / 2 - 2 / textScale,
                      labelY - 6 / textScale,
                      labelWidth + 4 / textScale,
                      12 / textScale
                    );
                    ctx.fillStyle = GRAPHITE;
                    ctx.fillText(label, x, labelY);
                    ctx.restore();
                  }}
                  nodePointerAreaPaint={(node, color, ctx) => {
                    const r = Math.max(10, 6 + Math.sqrt(node.val) * 2.6);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
                    ctx.fill();
                  }}
                  onNodeClick={(node) => setSelectedId(node.id)}
                  onEngineStop={() => graphRef.current?.zoomToFit(400, 40)}
                />
              </div>
            ) : (
              <ul
                className="max-h-[720px] divide-y overflow-auto"
                style={{ borderColor: PAPER_BORDER }}
                role="listbox"
                aria-label="理論マップ ノード一覧"
              >
                {filteredNodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected?.id === node.id}
                      onClick={() => setSelectedId(node.id)}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2"
                      style={{
                        backgroundColor: selected?.id === node.id ? rgba(BLUEPRINT, 0.1) : "transparent",
                        outlineColor: BLUEPRINT,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: GRAPHITE_MUTED }}>
                        <span
                          className="rounded-full border px-1.5 py-0.5 font-semibold"
                          style={{ borderColor: PAPER_BORDER }}
                        >
                          {KIND_MARK[node.kind]} {KIND_LABEL[node.kind]}
                        </span>
                        <span>{LAYER_LABEL[node.layer]}</span>
                        <span style={{ color: STATUS_COLOR[node.status] }}>{STATUS_LABEL[node.status]}</span>
                        <span className="ml-auto font-mono">接続 {degreeById.get(node.id) ?? 0}</span>
                      </div>
                      <div className="font-semibold" style={{ color: GRAPHITE }}>
                        {node.title}
                      </div>
                      <div className="line-clamp-2 text-xs leading-5" style={{ color: GRAPHITE_MUTED }}>
                        {node.summary}
                      </div>
                    </button>
                  </li>
                ))}
                {filteredNodes.length === 0 && (
                  <li className="px-4 py-6 text-sm" style={{ color: GRAPHITE_MUTED }}>
                    条件に一致するノードがない。
                  </li>
                )}
              </ul>
            )}
          </div>

          <aside
            className="min-w-0 rounded-lg border"
            style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
          >
            {selected ? (
              <div className="flex h-full flex-col">
                <div className="border-b px-4 py-4" style={{ borderColor: PAPER_BORDER }}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
                    >
                      {KIND_MARK[selected.kind]} {KIND_LABEL[selected.kind]}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{ borderColor: STATUS_COLOR[selected.status], color: STATUS_COLOR[selected.status] }}
                    >
                      {STATUS_LABEL[selected.status]}
                    </span>
                    <span style={{ color: GRAPHITE_MUTED }}>{LAYER_LABEL[selected.layer]}</span>
                  </div>
                  <h2 className="text-lg font-semibold leading-tight">{selected.title}</h2>
                  <p className="mt-2 break-words text-sm leading-6 [overflow-wrap:anywhere]" style={{ color: GRAPHITE_MUTED }}>
                    {selected.summary}
                  </p>
                  {selected.sourceHref ? (
                    <Link
                      href={selected.sourceHref}
                      className="mt-3 inline-flex min-h-8 max-w-full items-center gap-1.5 break-words rounded-md border px-2.5 py-1 text-xs font-semibold [overflow-wrap:anywhere]"
                      style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}
                    >
                      出典を開く: {selected.sourceRef}
                    </Link>
                  ) : (
                    <div className="mt-3 break-words text-xs [overflow-wrap:anywhere]" style={{ color: GRAPHITE_MUTED }}>
                      出典: {selected.sourceRef}
                    </div>
                  )}
                  <details className="mt-3 border-t pt-3" style={{ borderColor: PAPER_BORDER }}>
                    <summary className="cursor-pointer text-xs font-semibold" style={{ color: BLUEPRINT }}>
                      ノード本文を読む
                    </summary>
                    <div
                      className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5"
                      style={{ color: GRAPHITE_MUTED }}
                    >
                      {selected.body}
                    </div>
                  </details>
                </div>

                {gaps.length > 0 && (
                  <div
                    className="mx-4 mt-4 rounded-md border px-3 py-2 text-xs"
                    style={{ borderColor: OCHRE, backgroundColor: rgba(OCHRE, 0.08), color: OCHRE }}
                  >
                    <div className="font-semibold">カバレッジの欠落</div>
                    <ul className="mt-1 list-disc pl-4">
                      {gaps.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <RelationGroup
                    title="支持・定義・具体化 (入力)"
                    color={MOSS}
                    edges={supportIn}
                    direction="from"
                    nodeById={nodeById}
                    onSelect={setSelectedId}
                  />
                  <RelationGroup
                    title="異議・反証 (入力)"
                    color={VERMILION}
                    edges={challengeIn}
                    direction="from"
                    nodeById={nodeById}
                    onSelect={setSelectedId}
                  />
                  <RelationGroup
                    title="検証 (tests)"
                    color={BLUEPRINT}
                    edges={testEdges}
                    direction="either"
                    selfId={selected.id}
                    nodeById={nodeById}
                    onSelect={setSelectedId}
                  />
                  <RelationGroup
                    title="依存・上書き"
                    color={GRAPHITE_MUTED}
                    edges={structuralEdges}
                    direction="either"
                    selfId={selected.id}
                    nodeById={nodeById}
                    onSelect={setSelectedId}
                  />
                  <RelationGroup
                    title="波及先 (このノードが支持/異議を及ぼす先)"
                    color={GRAPHITE_MUTED}
                    edges={effectsOut}
                    direction="to"
                    nodeById={nodeById}
                    onSelect={setSelectedId}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm" style={{ color: GRAPHITE_MUTED }}>
                ノードを選ぶと論証台帳が表示される。
              </div>
            )}
          </aside>
        </section>

        <section
          className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-xs"
          style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL, color: GRAPHITE_MUTED }}
        >
          <span className="font-semibold" style={{ color: GRAPHITE }}>
            凡例
          </span>
          <span>形 = 種別 (○概念 ◇主張 □測定 △決定 ⬡ソース ○点線=問い)</span>
          <span>色 = ステータス (緑=現行採用・資料存在 青=条件付き 黒鉛=設計選択 オーカー=仮説/未解明 朱=反証済み)</span>
          <span>線 = 関係 (緑=支持系 オーカー=異議 朱=反証 青=検証/依存 破線=依存・上書き)</span>
        </section>
      </div>
    </div>
  );
}

function RelationGroup({
  title,
  color,
  edges,
  direction,
  selfId,
  nodeById,
  onSelect,
}: {
  title: string;
  color: string;
  edges: TheoryEdge[];
  direction: "from" | "to" | "either";
  selfId?: string;
  nodeById: Map<string, TheoryMapNode>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold" style={{ color }}>
        {title}
        <span className="rounded-full border px-1.5 py-0.5 font-mono text-[10px]" style={{ borderColor: color }}>
          {edges.length} 件
        </span>
      </div>
      {edges.length === 0 ? (
        <div
          className="rounded-md border border-dashed px-3 py-2 text-xs"
          style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
        >
          接続なし
        </div>
      ) : (
        <ul className="space-y-1">
          {edges.map((edge) => {
            const otherId = direction === "to" ? edge.to : direction === "from" ? edge.from : edge.from === selfId ? edge.to : edge.from;
            const other = nodeById.get(otherId);
            if (!other) return null;
            return (
              <li key={`${edge.from}-${edge.type}-${edge.to}`}>
                <button
                  type="button"
                  onClick={() => onSelect(other.id)}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition"
                  style={{ borderColor: PAPER_BORDER }}
                >
                  <span className="shrink-0 font-mono" style={{ color: RELATION_COLOR[edge.type] }}>
                    {RELATION_LABEL[edge.type]}
                  </span>
                  <span className="min-w-0 flex-1 truncate" style={{ color: GRAPHITE }}>
                    {other.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
