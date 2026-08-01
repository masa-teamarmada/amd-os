"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List as ListIcon, Maximize2, PenLine, Search } from "lucide-react";
import type { TheoryNodeKind, TheoryNodeLayer, TheoryNodeStatus, TheoryRelationType } from "@/lib/bzm-theory-graph";
import {
  BLUEPRINT,
  CHALLENGE_TYPES,
  GRAPHITE,
  GRAPHITE_MUTED,
  KIND_COLOR,
  ISSUE_TYPES,
  KIND_LABEL,
  KIND_SHAPE,
  LAYER_LABEL,
  LAYER_ORDER,
  MOSS,
  OCHRE,
  PAPER_BG,
  PAPER_BORDER,
  PAPER_PANEL,
  RELATION_COLOR,
  RELATION_LABEL,
  STATUS_LABEL,
  STATUS_RING_LABEL,
  STRUCTURAL_TYPES,
  SUPPORT_TYPES,
  TEST_TYPES,
  VERMILION,
  callTheoryMapApi,
  rgba,
  type NodeShape,
  type TheoryMapEdge,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";
import type { ComposerState } from "@/components/bzm/BzmTheoryComposerDialog";

export type { TheoryMapNode, TheoryMapEdge } from "@/lib/bzm-theory-map-ui";

interface GraphNode extends TheoryMapNode {
  val: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: TheoryRelationType;
  id: string | null;
  note: string | null;
  editable: boolean;
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
  linkHoverPrecision?: number;
  linkDirectionalArrowLength?: number;
  linkDirectionalArrowRelPos?: number;
  nodeCanvasObject?: (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => void;
  nodePointerAreaPaint?: (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => void;
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  onNodeDragEnd?: (node: GraphNode) => void;
  onBackgroundClick?: () => void;
  onLinkClick?: (link: GraphLink) => void;
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

const BzmTheoryComposerDialog = dynamic(
  () => import("@/components/bzm/BzmTheoryComposerDialog").then((module) => module.BzmTheoryComposerDialog),
  { ssr: false }
);

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

function drawStatusRing(
  ctx: CanvasRenderingContext2D,
  status: TheoryNodeStatus,
  x: number,
  y: number,
  radius: number
) {
  const ringRadius = radius + 3.5;
  ctx.save();
  ctx.strokeStyle = rgba(GRAPHITE, 0.78);
  ctx.lineWidth = 1.15;
  if (status === "conditional") ctx.setLineDash([4, 3]);
  if (status === "hypothesis") ctx.setLineDash([1, 3]);
  if (status === "unknown") ctx.setLineDash([6, 2, 1, 2]);
  ctx.beginPath();
  ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (status === "design-choice") {
    ctx.beginPath();
    ctx.arc(x, y, ringRadius + 2.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (status === "refuted") {
    const offset = radius * 0.72;
    ctx.beginPath();
    ctx.moveTo(x - offset, y + offset);
    ctx.lineTo(x + offset, y - offset);
    ctx.stroke();
  }
  ctx.restore();
}

function kindLegendClipPath(kind: TheoryNodeKind) {
  if (kind === "claim") return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  if (kind === "measure") return "inset(5%)";
  if (kind === "decision") return "polygon(50% 0, 100% 100%, 0 100%)";
  if (kind === "source") return "polygon(25% 7%, 75% 7%, 100% 50%, 75% 93%, 25% 93%, 0 50%)";
  return "circle(50%)";
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

function nodeRadius(node: Pick<GraphNode, "val">) {
  return Math.max(6, 4 + Math.sqrt(node.val) * 2.2);
}

export function BzmTheoryMapView({
  nodes: initialNodes,
  edges: initialEdges,
  errors,
  storageMode,
  canEdit,
}: {
  nodes: TheoryMapNode[];
  edges: TheoryMapEdge[];
  errors: string[];
  storageMode: "db" | "unavailable";
  canEdit: boolean;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [composerState, setComposerState] = useState<ComposerState | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [edgeToRemove, setEdgeToRemove] = useState<TheoryMapEdge | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string; key: number } | null>(null);
  const noticeCounter = useRef(0);

  const announce = useCallback((type: "success" | "error", message: string) => {
    noticeCounter.current += 1;
    setNotice({ type, message, key: noticeCounter.current });
  }, []);

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
  const [nodePositions, setNodePositions] = useState<
    Record<string, Pick<GraphNode, "x" | "y" | "fx" | "fy">>
  >({});
  const [size, setSize] = useState({ w: 900, h: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphHandle | null>(null);
  const draggedNodeClickRef = useRef<string | null>(null);
  const suppressBackgroundClickRef = useRef(false);
  const [graphReadyVersion, setGraphReadyVersion] = useState(0);

  const suppressNextBackgroundClick = useCallback(() => {
    suppressBackgroundClickRef.current = true;
    window.setTimeout(() => {
      suppressBackgroundClickRef.current = false;
    }, 0);
  }, []);

  const handleGraphRef = useCallback((handle: ForceGraphHandle | null) => {
    graphRef.current = handle;
    if (handle) setGraphReadyVersion((version) => version + 1);
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useEffect(() => {
    if (nodes.length === 0 || !window.matchMedia("(max-width: 767px)").matches) return;
    // Canvas map is intentionally optional on narrow screens; the list keeps
    // every node readable and keyboard-operable as the default mobile view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("list");
  }, [nodes.length]);

  const incomingByTarget = useMemo(() => {
    const map = new Map<string, TheoryMapEdge[]>();
    for (const edge of edges) {
      if (!map.has(edge.to)) map.set(edge.to, []);
      map.get(edge.to)!.push(edge);
    }
    return map;
  }, [edges]);

  const outgoingBySource = useMemo(() => {
    const map = new Map<string, TheoryMapEdge[]>();
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
    const gNodes: GraphNode[] = filteredNodes.map((n) => {
      const savedPosition = nodePositions[n.id];
      return {
        ...n,
        ...savedPosition,
        val: Math.max(1, degreeById.get(n.id) ?? 1),
      };
    });
    const gLinks: GraphLink[] = filteredEdges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
      id: edge.id,
      note: edge.note,
      editable: edge.editable,
    }));
    return { nodes: gNodes, links: gLinks };
  }, [filteredNodes, filteredEdges, degreeById, nodePositions]);

  const selected = nodeById.get(selectedId) ?? null;
  const panelOpen = composerState !== null || edgeToRemove !== null;
  const connectionSourceId =
    connectingFromId ?? (composerState?.type === "connect" ? selected?.id ?? null : null);
  const connectionTargetId = composerState?.type === "connect" ? composerState.targetId ?? null : null;

  const handleNodeDragEnd = useCallback((dragged: GraphNode) => {
    draggedNodeClickRef.current = dragged.id;
    window.setTimeout(() => {
      if (draggedNodeClickRef.current === dragged.id) draggedNodeClickRef.current = null;
    }, 240);
    if (!Number.isFinite(dragged.x) || !Number.isFinite(dragged.y)) return;
    dragged.fx = dragged.x;
    dragged.fy = dragged.y;
    setNodePositions((current) => ({
      ...current,
      [dragged.id]: {
        x: dragged.x,
        y: dragged.y,
        fx: dragged.x,
        fy: dragged.y,
      },
    }));
  }, []);

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
  }, [graphData, graphReadyVersion, panelOpen, view]);

  useEffect(() => {
    if (!connectingFromId || visibleIds.has(connectingFromId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectingFromId(null);
  }, [connectingFromId, visibleIds]);

  useEffect(() => {
    if (!connectingFromId) return;
    const cancelConnection = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnectingFromId(null);
    };
    window.addEventListener("keydown", cancelConnection);
    return () => window.removeEventListener("keydown", cancelConnection);
  }, [connectingFromId]);

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

  function handleNodeClick(node: GraphNode, event: MouseEvent) {
    suppressNextBackgroundClick();
    if (draggedNodeClickRef.current === node.id) {
      draggedNodeClickRef.current = null;
      return;
    }

    const modifierPressed = event.metaKey || event.ctrlKey;
    if (canEdit && modifierPressed) {
      setComposerState(null);
      setEdgeToRemove(null);
      if (!connectingFromId) {
        setSelectedId(node.id);
        setConnectingFromId(node.id);
        return;
      }
      if (connectingFromId === node.id) {
        announce("error", "同じノード同士は接続できないよ。別のノードを選んでね。");
        return;
      }
      setSelectedId(connectingFromId);
      setComposerState({ type: "connect", targetId: node.id, direction: "outgoing" });
      setConnectingFromId(null);
      return;
    }

    setConnectingFromId(null);
    setSelectedId(node.id);
    if (canEdit && node.editable) {
      setEdgeToRemove(null);
      setComposerState({ type: "edit", node });
    }
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
  const issueEdges = [...incomingForSelected, ...outgoingForSelected].filter((e) =>
    ISSUE_TYPES.includes(e.type)
  );
  const effectsOut = outgoingForSelected.filter(
    (e) => SUPPORT_TYPES.includes(e.type) || CHALLENGE_TYPES.includes(e.type)
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
            <Link href="/bzm" className="inline-flex min-h-11 items-center font-semibold hover:underline" style={{ color: BLUEPRINT }}>
              ← 教科書へ戻る
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">理論マップ — 論証台帳</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: GRAPHITE_MUTED }}>
            自分で理解した理論・文献・反証・未解決の論点を書き、関係を結びながら育てる台帳。
            空白クリックで新しいノード、ノードをクリックして編集。⌘を押しながら2つのノードを順に選ぶと接続できる。
          </p>
          {storageMode === "unavailable" && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: VERMILION, backgroundColor: rgba(VERMILION, 0.08), color: VERMILION }}
              role="alert"
            >
              理論マップを読み込めないため、編集を停止している。
            </div>
          )}
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
              className="h-11 w-full rounded-md border pl-9 pr-3 text-sm outline-none sm:h-9"
              style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_BG, color: GRAPHITE }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="層で絞り込み">
            {LAYER_ORDER.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => toggleInSet(layerFilter, layer, setLayerFilter)}
                className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
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
                className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
                style={{
                  borderColor: statusFilter.has(status) ? GRAPHITE : PAPER_BORDER,
                  borderStyle: status === "conditional" || status === "hypothesis" || status === "unknown" ? "dashed" : "solid",
                  backgroundColor: statusFilter.has(status) ? rgba(GRAPHITE, 0.08) : PAPER_BG,
                  color: statusFilter.has(status) ? GRAPHITE : GRAPHITE_MUTED,
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
                className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
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
              className="min-h-11 rounded-md border px-2.5 text-xs font-medium sm:min-h-8"
              style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
            >
              フィルタ解除
            </button>
            <button
              type="button"
              onClick={() => graphRef.current?.zoomToFit(400, 40)}
              disabled={view !== "map"}
              className="grid h-11 w-11 place-items-center rounded-md border disabled:opacity-40 sm:h-8 sm:w-8"
              style={{ borderColor: PAPER_BORDER }}
              title="全体を表示"
              aria-label="マップ全体を表示"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("map")}
              className="grid h-11 w-11 place-items-center rounded-md border sm:h-8 sm:w-8"
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
              disabled={panelOpen}
              className="grid h-11 w-11 place-items-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
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

        <section className={panelOpen ? "grid gap-4" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"}>
          <div
            className="min-w-0 overflow-hidden rounded-lg border"
            style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
          >
            {view === "map" ? (
              <div
                data-bzm-map-workspace="true"
                className={panelOpen ? "grid min-w-0 md:grid-cols-[minmax(0,1fr)_400px]" : "grid min-w-0"}
              >
                <div className="min-w-0" style={{ backgroundColor: PAPER_BG }}>
                  <div
                    ref={containerRef}
                    data-bzm-map-canvas="true"
                    className="relative h-[440px] w-full sm:h-[520px] lg:h-[680px]"
                    style={{ backgroundColor: PAPER_BG }}
                  >
                {connectingFromId && nodeById.has(connectingFromId) && (
                  <div
                    className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 shadow-md"
                    style={{ borderColor: BLUEPRINT, backgroundColor: rgba(PAPER_PANEL, 0.97), color: GRAPHITE }}
                    role="status"
                  >
                    <p className="min-w-0 truncate text-xs">
                      <span className="font-semibold">接続元:</span> {nodeById.get(connectingFromId)?.title}
                      <span className="ml-2" style={{ color: GRAPHITE_MUTED }}>⌘を押したまま接続先をクリック</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setConnectingFromId(null)}
                      className="min-h-9 shrink-0 rounded-md border px-3 text-xs font-semibold"
                      style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
                    >
                      解除
                    </button>
                  </div>
                )}
                <div
                  className={`pointer-events-none absolute inset-x-3 z-10 hidden grid-cols-7 gap-1 sm:grid ${connectingFromId ? "top-16" : "top-3"}`}
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
                  linkHoverPrecision={10}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const r = nodeRadius(node);
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const isSelected = selected?.id === node.id;
                    const isConnectionSource = connectionSourceId === node.id;
                    const isConnectionTarget = connectionTargetId === node.id;
                    const color = KIND_COLOR[node.kind];
                    ctx.save();
                    if (isSelected) {
                      ctx.beginPath();
                      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
                      ctx.fillStyle = rgba(BLUEPRINT, 0.14);
                      ctx.fill();
                    }
                    if (isConnectionSource || isConnectionTarget) {
                      ctx.beginPath();
                      ctx.arc(x, y, r + 9, 0, Math.PI * 2);
                      ctx.lineWidth = 3;
                      ctx.strokeStyle = isConnectionSource ? BLUEPRINT : MOSS;
                      ctx.setLineDash(isConnectionSource ? [4, 3] : []);
                      ctx.stroke();
                      ctx.setLineDash([]);
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
                    drawStatusRing(ctx, node.status, x, y, r);

                    const label = node.title.length > 15 ? `${node.title.slice(0, 14)}…` : node.title;
                    const textScale = Math.max(1, globalScale);
                    ctx.font = `600 ${10 / textScale}px ui-sans-serif, system-ui`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
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
                  onNodeClick={handleNodeClick}
                  onNodeDragEnd={(node) => {
                    suppressNextBackgroundClick();
                    handleNodeDragEnd(node);
                  }}
                  onBackgroundClick={() => {
                    if (suppressBackgroundClickRef.current) {
                      suppressBackgroundClickRef.current = false;
                      return;
                    }
                    if (connectingFromId) {
                      setConnectingFromId(null);
                      return;
                    }
                    if (canEdit && !composerState && !edgeToRemove) {
                      setComposerState({ type: "create" });
                    }
                  }}
                  onLinkClick={(link) => {
                    suppressNextBackgroundClick();
                    if (!canEdit || !link.id || !link.editable) return;
                    const edge = edges.find((candidate) => candidate.id === link.id);
                    if (edge) setEdgeToRemove(edge);
                  }}
                  onEngineStop={() => graphRef.current?.zoomToFit(400, 40)}
                />

                {graphData.nodes.length === 0 && !composerState && (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
                    <div
                      className="max-w-sm rounded-lg border border-dashed px-5 py-4 shadow-sm"
                      style={{ borderColor: PAPER_BORDER, backgroundColor: rgba(PAPER_PANEL, 0.92) }}
                    >
                      <div className="text-sm font-semibold" style={{ color: GRAPHITE }}>
                        {nodes.length === 0 ? "ここから、まさの理論マップが始まる" : "条件に合うノードがない"}
                      </div>
                      <p className="mt-1 text-xs leading-5" style={{ color: GRAPHITE_MUTED }}>
                        {canEdit && nodes.length === 0
                          ? "マップの空いている場所をクリックして、最初のノードを書いてみて。"
                          : nodes.length === 0
                            ? "まだノードはありません。"
                            : "フィルタを解除すると、すべてのノードを表示できます。"}
                      </p>
                    </div>
                  </div>
                )}

                {canEdit && selected && visibleIds.has(selected.id) && !composerState && !edgeToRemove && !connectingFromId && (
                  <div className="absolute inset-x-3 bottom-3 z-20 flex justify-center">
                    <div
                      className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border p-2 shadow-lg"
                      style={{ borderColor: PAPER_BORDER, backgroundColor: rgba(PAPER_PANEL, 0.96) }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <span className="max-w-48 truncate px-2 text-xs font-semibold" style={{ color: GRAPHITE }}>
                        {selected.title}
                      </span>
                      {selected.editable && (
                        <button
                          type="button"
                          onClick={() => setComposerState({ type: "edit", node: selected })}
                          className="flex min-h-11 items-center gap-1 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                          style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}
                        >
                          <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                          編集
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setComposerState({ type: "grow", preset: "support" })}
                        className="min-h-11 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                        style={{ borderColor: MOSS, color: MOSS, backgroundColor: rgba(MOSS, 0.06) }}
                      >
                        根拠
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerState({ type: "grow", preset: "challenge" })}
                        className="min-h-11 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                        style={{ borderColor: VERMILION, color: VERMILION, backgroundColor: rgba(VERMILION, 0.06) }}
                      >
                        異論
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerState({ type: "grow", preset: "question" })}
                        className="min-h-11 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                        style={{ borderColor: OCHRE, color: OCHRE, backgroundColor: rgba(OCHRE, 0.06) }}
                      >
                        論点
                      </button>
                      <span className="hidden px-2 text-[11px] sm:inline" style={{ color: GRAPHITE_MUTED }}>
                        ⌘＋クリックで2つ選ぶと接続
                      </span>
                    </div>
                  </div>
                )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2"
                    style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
                    aria-label="ノード表示の凡例"
                  >
                    <span className="text-[11px] font-semibold" style={{ color: GRAPHITE_MUTED }}>種類</span>
                    {(Object.keys(KIND_LABEL) as TheoryNodeKind[]).map((kind) => (
                      <span key={kind} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: GRAPHITE_MUTED }}>
                        <span
                          className="h-3 w-3 shrink-0"
                          style={{ backgroundColor: KIND_COLOR[kind], clipPath: kindLegendClipPath(kind) }}
                          aria-hidden="true"
                        />
                        {KIND_LABEL[kind]}
                      </span>
                    ))}
                    <span className="ml-auto text-[11px]" style={{ color: GRAPHITE_MUTED }}>
                      外周線＝状態（{(Object.keys(STATUS_LABEL) as TheoryNodeStatus[]).map((status) => `${STATUS_LABEL[status].split("・")[0]}:${STATUS_RING_LABEL[status]}`).join(" / ")}）
                    </span>
                  </div>
                </div>

                {edgeToRemove && (
                  <div
                    className="min-h-[360px] border-t p-4 md:min-h-0 md:border-l md:border-t-0"
                    data-bzm-map-panel="edge-delete"
                    style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
                  >
                    <div
                      role="dialog"
                      aria-modal="false"
                      aria-labelledby="bzm-edge-delete-title"
                      className="w-full p-1"
                      style={{ color: GRAPHITE }}
                    >
                      <h2 id="bzm-edge-delete-title" className="text-lg font-semibold">
                        この接続を削除する？
                      </h2>
                      <p className="mt-2 text-sm leading-6" style={{ color: GRAPHITE_MUTED }}>
                        {RELATION_LABEL[edgeToRemove.type]}: {nodeById.get(edgeToRemove.from)?.title ?? edgeToRemove.from} →{" "}
                        {nodeById.get(edgeToRemove.to)?.title ?? edgeToRemove.to}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: VERMILION }}>
                        この操作は取り消せません。
                      </p>
                      {removeError && (
                        <div
                          className="mt-3 rounded-md border px-3 py-2 text-xs"
                          style={{ borderColor: VERMILION, backgroundColor: rgba(VERMILION, 0.08), color: VERMILION }}
                          role="alert"
                        >
                          {removeError}
                        </div>
                      )}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEdgeToRemove(null);
                            setRemoveError(null);
                          }}
                          disabled={removePending}
                          className="min-h-11 rounded-md border px-4 text-sm font-semibold disabled:opacity-50"
                          style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!edgeToRemove.id) return;
                            setRemovePending(true);
                            setRemoveError(null);
                            const result = await callTheoryMapApi({
                              method: "DELETE",
                              query: `?edgeId=${encodeURIComponent(edgeToRemove.id)}`,
                            });
                            setRemovePending(false);
                            if (!result.ok) {
                              setRemoveError(result.error);
                              announce("error", result.error);
                              return;
                            }
                            const removedId = edgeToRemove.id;
                            setEdges((current) => current.filter((edge) => edge.id !== removedId));
                            setEdgeToRemove(null);
                            announce("success", "接続を削除しました。");
                          }}
                          disabled={removePending}
                          className="min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: VERMILION }}
                        >
                          {removePending ? "削除中…" : "削除する"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <BzmTheoryComposerDialog
                  state={composerState}
                  selected={selected}
                  nodes={nodes}
                  onClose={() => setComposerState(null)}
                  onNodeCreated={(node, edge) => {
                    setNodes((current) => [...current, node]);
                    if (edge) setEdges((current) => [...current, edge]);
                    setSelectedId(node.id);
                    setComposerState(null);
                    announce("success", `「${node.title}」を作成しました。`);
                  }}
                  onEdgeCreated={(edge) => {
                    setEdges((current) => [...current, edge]);
                    setComposerState(null);
                    announce("success", "接続を作成しました。");
                  }}
                  onNodeUpdated={(node) => {
                    setNodes((current) => current.map((candidate) => (candidate.id === node.id ? node : candidate)));
                    setComposerState(null);
                    announce("success", `「${node.title}」を更新しました。`);
                  }}
                  onError={(message) => announce("error", message)}
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
                      onClick={() => {
                        setSelectedId(node.id);
                        setConnectingFromId(null);
                        if (canEdit && node.editable) {
                          setView("map");
                          setComposerState({ type: "edit", node });
                        }
                      }}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2"
                      style={{
                        backgroundColor: selected?.id === node.id ? rgba(BLUEPRINT, 0.1) : "transparent",
                        outlineColor: BLUEPRINT,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: GRAPHITE_MUTED }}>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 font-semibold"
                          style={{ borderColor: PAPER_BORDER }}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: KIND_COLOR[node.kind] }} aria-hidden="true" />
                          {KIND_LABEL[node.kind]}
                        </span>
                        <span>{LAYER_LABEL[node.layer]}</span>
                        <span>{STATUS_LABEL[node.status]}（{STATUS_RING_LABEL[node.status]}）</span>
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

          {!panelOpen && <aside
            className="min-w-0 rounded-lg border"
            style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
          >
            {selected ? (
              <div className="flex h-full flex-col">
                <div className="border-b px-4 py-4" style={{ borderColor: PAPER_BORDER }}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                      style={{ borderColor: PAPER_BORDER, color: GRAPHITE_MUTED }}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: KIND_COLOR[selected.kind] }} aria-hidden="true" />
                      {KIND_LABEL[selected.kind]}
                    </span>
                    <span
                      className="rounded-full border px-2 py-0.5"
                      style={{ borderColor: GRAPHITE_MUTED, color: GRAPHITE_MUTED }}
                    >
                      {STATUS_LABEL[selected.status]}・{STATUS_RING_LABEL[selected.status]}
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
                      className="mt-3 inline-flex min-h-11 max-w-full items-center gap-1.5 break-words rounded-md border px-2.5 py-1 text-xs font-semibold [overflow-wrap:anywhere]"
                      style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}
                    >
                      出典を開く: {selected.sourceRef}
                    </Link>
                  ) : /^https?:\/\//i.test(selected.sourceRef) ? (
                    <a
                      href={selected.sourceRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-11 max-w-full items-center gap-1.5 break-words rounded-md border px-2.5 py-1 text-xs font-semibold [overflow-wrap:anywhere]"
                      style={{ borderColor: PAPER_BORDER, color: BLUEPRINT }}
                    >
                      出典を開く (外部サイト): {selected.sourceRef}
                    </a>
                  ) : (
                    <div className="mt-3 break-words text-xs [overflow-wrap:anywhere]" style={{ color: GRAPHITE_MUTED }}>
                      出典: {selected.sourceRef}
                    </div>
                  )}
                  <details className="mt-3 border-t pt-3" style={{ borderColor: PAPER_BORDER }}>
                    <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold" style={{ color: BLUEPRINT }}>
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
                    title="残っている論点"
                    color={OCHRE}
                    edges={issueEdges}
                    direction="either"
                    selfId={selected.id}
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
          </aside>}
        </section>

        <section
          className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-xs"
          style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL, color: GRAPHITE_MUTED }}
        >
          <span className="font-semibold" style={{ color: GRAPHITE }}>
            凡例
          </span>
          <span>塗り色 + 形 = 種別 (青○概念 赤紫◇主張 緑□測定 黄△決定 紫⬡ソース 茶○点線=問い)</span>
          <span>外周線 = ステータス (実線=現行採用 破線=条件付き 二重線=設計選択 点線=仮説 斜線=反証済み 一点鎖線=未解明)</span>
          <span>線 = 関係 (緑=支持系 オーカー=異議/論点 朱=反証 青=検証/依存 破線=依存・上書き)</span>
        </section>
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {notice?.message}
      </div>
      {notice && (
        <div
          key={notice.key}
          className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
        >
          <div
            className="pointer-events-auto rounded-md border px-4 py-2 text-sm font-medium shadow-lg"
            style={{
              borderColor: notice.type === "success" ? MOSS : VERMILION,
              backgroundColor: notice.type === "success" ? rgba(MOSS, 0.12) : rgba(VERMILION, 0.12),
              color: notice.type === "success" ? MOSS : VERMILION,
            }}
          >
            {notice.message}
          </div>
        </div>
      )}

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
  edges: TheoryMapEdge[];
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
                  className="flex min-h-11 w-full min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition"
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
