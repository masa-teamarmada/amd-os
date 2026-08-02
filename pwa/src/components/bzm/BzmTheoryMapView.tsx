"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutGrid,
  List as ListIcon,
  Maximize2,
  NotebookPen,
  PenLine,
  Search,
} from "lucide-react";
import type {
  TheoryNodeKind,
  TheoryNodeLayer,
  TheoryNodeStatus,
  TheoryRelationType,
} from "@/lib/bzm-theory-graph";
import {
  BLUEPRINT,
  CHALLENGE_TYPES,
  GRAPHITE,
  GRAPHITE_MUTED,
  KIND_COLOR,
  KIND_LABEL,
  KIND_SHAPE,
  LAYER_LABEL,
  LAYER_ORDER,
  MOSS,
  PAPER_BG,
  PAPER_BORDER,
  PAPER_PANEL,
  RELATION_COLOR,
  RELATION_LABEL,
  STATUS_LABEL,
  STRUCTURAL_TYPES,
  VERMILION,
  callTheoryMapApi,
  parseTheoryMapEdgeDto,
  rgba,
  type NodeShape,
  type TheoryMapEdge,
  type TheoryMapMemo,
  type TheoryMapNode,
} from "@/lib/bzm-theory-map-ui";
import type {
  ComposerState,
  DraftNodeFields,
} from "@/components/bzm/BzmTheoryComposerDialog";
import { BzmMathText } from "@/components/bzm/BzmMarkdown";

export type { TheoryMapNode, TheoryMapEdge, TheoryMapMemo } from "@/lib/bzm-theory-map-ui";

interface GraphNode extends TheoryMapNode {
  val: number;
  draft?: boolean;
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
  pending?: boolean;
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
  linkCanvasObject?: (
    link: GraphLink,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  linkCanvasObjectMode?:
    | "before"
    | "replace"
    | "after"
    | ((link: GraphLink) => "before" | "replace" | "after");
  linkPointerAreaPaint?: (
    link: GraphLink,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => void;
  linkDirectionalArrowLength?: number;
  linkDirectionalArrowRelPos?: number;
  nodeCanvasObject?: (
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  nodePointerAreaPaint?: (
    node: GraphNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => void;
  onNodeClick?: (node: GraphNode, event: MouseEvent) => void;
  onNodeDragEnd?: (node: GraphNode) => void;
  onBackgroundClick?: (event: MouseEvent) => void;
  onLinkClick?: (link: GraphLink) => void;
  onEngineStop?: () => void;
}

interface ForceGraphHandle {
  centerAt: (x?: number, y?: number, ms?: number) => void;
  zoom: (k?: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
  d3ReheatSimulation: () => void;
  graph2ScreenCoords: (x: number, y: number) => { x: number; y: number };
  screen2GraphCoords: (x: number, y: number) => { x: number; y: number };
}

// react-force-graph は Canvas 依存で SSR 不可
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as React.ComponentType<
  ForceGraphProps & { ref?: React.Ref<ForceGraphHandle> }
>;

const BzmTheoryComposerDialog = dynamic(
  () =>
    import("@/components/bzm/BzmTheoryComposerDialog").then(
      (module) => module.BzmTheoryComposerDialog,
    ),
  { ssr: false },
);

function textMatches(node: TheoryMapNode, query: string) {
  if (!query) return true;
  const haystack = [node.id, node.title, node.summary, node.sourceRef]
    .join(" ")
    .toLowerCase();
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
) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
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
}

function kindLegendClipPath(kind: TheoryNodeKind) {
  if (kind === "claim") return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
  if (kind === "measure") return "inset(5%)";
  if (kind === "decision") return "polygon(50% 0, 100% 100%, 0 100%)";
  if (kind === "source")
    return "polygon(25% 7%, 75% 7%, 100% 50%, 75% 93%, 25% 93%, 0 50%)";
  return "circle(50%)";
}

function createLayerForce(columnWidth: number, rowHeight: number) {
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
    nodes = initNodes;
    rowById = new Map();
    for (const layer of LAYER_ORDER) {
      const layerNodes = nodes
        .filter((node) => node.layer === layer)
        .sort((a, b) => a.id.localeCompare(b.id));
      const rowMiddle = (layerNodes.length - 1) / 2;
      layerNodes.forEach((node, index) =>
        rowById.set(node.id, (index - rowMiddle) * rowHeight),
      );
    }
  };
  return force;
}

function nodeRadius(node: Pick<GraphNode, "val">) {
  return Math.max(6, 4 + Math.sqrt(node.val) * 2.2);
}

function polygonVertices(shape: NodeShape, radius: number) {
  if (shape === "diamond") {
    return [
      { x: 0, y: -radius },
      { x: radius, y: 0 },
      { x: 0, y: radius },
      { x: -radius, y: 0 },
    ];
  }
  if (shape === "square") {
    const side = radius * 0.85;
    return [
      { x: -side, y: -side },
      { x: side, y: -side },
      { x: side, y: side },
      { x: -side, y: side },
    ];
  }
  if (shape === "triangle") {
    return [
      { x: 0, y: -radius },
      { x: radius * 0.95, y: radius * 0.75 },
      { x: -radius * 0.95, y: radius * 0.75 },
    ];
  }
  if (shape === "hexagon") {
    return Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index - Math.PI / 2;
      return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    });
  }
  return [];
}

function cross(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.y - a.y * b.x;
}

function nodeBoundaryDistance(
  node: GraphNode,
  direction: { x: number; y: number },
) {
  const radius = nodeRadius(node);
  const shape = KIND_SHAPE[node.kind];
  if (shape === "circle") return radius;
  const vertices = polygonVertices(shape, radius);
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    const segment = { x: end.x - start.x, y: end.y - start.y };
    const denominator = cross(direction, segment);
    if (Math.abs(denominator) < 1e-8) continue;
    const distance = cross(start, segment) / denominator;
    const segmentPosition = cross(start, direction) / denominator;
    if (distance >= 0 && segmentPosition >= 0 && segmentPosition <= 1) {
      nearest = Math.min(nearest, distance);
    }
  }
  return Number.isFinite(nearest) ? nearest : radius;
}

function clippedLinkPoints(link: GraphLink) {
  if (typeof link.source === "string" || typeof link.target === "string")
    return null;
  const source = link.source;
  const target = link.target;
  const sourceX = source.x ?? 0;
  const sourceY = source.y ?? 0;
  const targetX = target.x ?? 0;
  const targetY = target.y ?? 0;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return null;
  const direction = { x: dx / distance, y: dy / distance };
  const sourceOffset = nodeBoundaryDistance(source, direction);
  const targetOffset = nodeBoundaryDistance(target, {
    x: -direction.x,
    y: -direction.y,
  });
  if (distance <= sourceOffset + targetOffset) return null;
  return {
    start: {
      x: sourceX + direction.x * sourceOffset,
      y: sourceY + direction.y * sourceOffset,
    },
    end: {
      x: targetX - direction.x * targetOffset,
      y: targetY - direction.y * targetOffset,
    },
    direction,
  };
}

function drawClippedLink(
  link: GraphLink,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
) {
  const points = clippedLinkPoints(link);
  if (!points) return;
  const scale = Math.max(0.6, globalScale);
  const color = RELATION_COLOR[link.type];
  ctx.save();
  ctx.strokeStyle = rgba(color, link.pending ? 0.92 : 0.58);
  ctx.fillStyle = rgba(color, link.pending ? 0.92 : 0.72);
  ctx.lineWidth =
    (link.pending ? 2.2 : CHALLENGE_TYPES.includes(link.type) ? 1.6 : 1.1) /
    scale;
  ctx.setLineDash(
    !link.pending && STRUCTURAL_TYPES.includes(link.type)
      ? [4 / scale, 3 / scale]
      : [],
  );
  ctx.beginPath();
  ctx.moveTo(points.start.x, points.start.y);
  ctx.lineTo(points.end.x, points.end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const arrowLength = 6 / scale;
  const arrowHalfWidth = 3.2 / scale;
  const base = {
    x: points.end.x - points.direction.x * arrowLength,
    y: points.end.y - points.direction.y * arrowLength,
  };
  const normal = { x: -points.direction.y, y: points.direction.x };
  ctx.beginPath();
  ctx.moveTo(points.end.x, points.end.y);
  ctx.lineTo(
    base.x + normal.x * arrowHalfWidth,
    base.y + normal.y * arrowHalfWidth,
  );
  ctx.lineTo(
    base.x - normal.x * arrowHalfWidth,
    base.y - normal.y * arrowHalfWidth,
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintClippedLinkPointerArea(
  link: GraphLink,
  color: string,
  ctx: CanvasRenderingContext2D,
) {
  const points = clippedLinkPoints(link);
  if (!points) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(points.start.x, points.start.y);
  ctx.lineTo(points.end.x, points.end.y);
  ctx.stroke();
  ctx.restore();
}

function draftNode(id: string): TheoryMapNode {
  return {
    id,
    title: "新しいノード",
    summary: "",
    kind: "concept",
    layer: "cross-layer",
    status: "hypothesis",
    sourceRef: "",
    sourceHref: null,
    body: "",
    editable: true,
  };
}

export function BzmTheoryMapView({
  nodes: initialNodes,
  edges: initialEdges,
  memos: initialMemos,
  errors,
  storageMode,
  canEdit,
}: {
  nodes: TheoryMapNode[];
  edges: TheoryMapEdge[];
  memos: TheoryMapMemo[];
  errors: string[];
  storageMode: "db" | "unavailable";
  canEdit: boolean;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [memos, setMemos] = useState(initialMemos);
  const [composerState, setComposerState] = useState<ComposerState | null>(
    null,
  );
  const [composerAnchor, setComposerAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectingRelationType, setConnectingRelationType] =
    useState<TheoryRelationType>("supports");
  const [connectingPending, setConnectingPending] = useState(false);
  const [pendingEdge, setPendingEdge] = useState<TheoryMapEdge | null>(null);
  const [edgeToRemove, setEdgeToRemove] = useState<TheoryMapEdge | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
    key: number;
  } | null>(null);
  const noticeCounter = useRef(0);

  const announce = useCallback((type: "success" | "error", message: string) => {
    noticeCounter.current += 1;
    setNotice({ type, message, key: noticeCounter.current });
  }, []);

  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [layerFilter, setLayerFilter] = useState<Set<TheoryNodeLayer>>(
    new Set(LAYER_ORDER),
  );
  const [statusFilter, setStatusFilter] = useState<Set<TheoryNodeStatus>>(
    new Set(Object.keys(STATUS_LABEL) as TheoryNodeStatus[]),
  );
  const [relationFilter, setRelationFilter] = useState<Set<TheoryRelationType>>(
    new Set(Object.keys(RELATION_LABEL) as TheoryRelationType[]),
  );
  const [selectedId, setSelectedId] = useState(
    nodes.find((node) => node.id === "concept-six-layer-structure")?.id ??
      nodes[0]?.id ??
      "",
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
    if (nodes.length === 0 || !window.matchMedia("(max-width: 767px)").matches)
      return;
    // Canvas map is intentionally optional on narrow screens; the list keeps
    // every node readable and keyboard-operable as the default mobile view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("list");
  }, [nodes.length]);

  const degreeById = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of edges) {
      map.set(edge.from, (map.get(edge.from) ?? 0) + 1);
      map.set(edge.to, (map.get(edge.to) ?? 0) + 1);
    }
    return map;
  }, [edges]);

  const activeDraftId =
    composerState && composerState.type === "create"
      ? composerState.draftId
      : null;

  const filteredNodes = useMemo(() => {
    const q = deferredQuery.trim();
    return nodes.filter(
      (n) =>
        n.id === activeDraftId ||
        (layerFilter.has(n.layer) &&
          statusFilter.has(n.status) &&
          textMatches(n, q)),
    );
  }, [nodes, layerFilter, statusFilter, deferredQuery, activeDraftId]);

  const visibleIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const displayEdges = useMemo(
    () => (pendingEdge ? [...edges, pendingEdge] : edges),
    [edges, pendingEdge],
  );

  const filteredEdges = useMemo(
    () =>
      displayEdges.filter(
        (e) =>
          (e.id?.startsWith("pending-") || relationFilter.has(e.type)) &&
          visibleIds.has(e.from) &&
          visibleIds.has(e.to),
      ),
    [displayEdges, relationFilter, visibleIds],
  );

  const graphData = useMemo(() => {
    const initialPositionById = new Map<
      string,
      Pick<GraphNode, "x" | "y" | "fx" | "fy">
    >();
    for (const [columnIndex, layer] of LAYER_ORDER.entries()) {
      const layerNodes = filteredNodes
        .filter((node) => node.layer === layer)
        .sort((a, b) => a.id.localeCompare(b.id));
      const rowMiddle = (layerNodes.length - 1) / 2;
      layerNodes.forEach((node, rowIndex) => {
        const x = (columnIndex - (LAYER_ORDER.length - 1) / 2) * 190;
        const y = (rowIndex - rowMiddle) * 92;
        initialPositionById.set(node.id, {
          x,
          y,
          fx: x,
          fy: y,
        });
      });
    }
    const gNodes: GraphNode[] = filteredNodes.map((n) => {
      const savedPosition = nodePositions[n.id];
      return {
        ...n,
        ...initialPositionById.get(n.id),
        ...savedPosition,
        val: Math.max(1, degreeById.get(n.id) ?? 1),
        draft:
          composerState?.type === "create" && composerState.draftId === n.id,
      };
    });
    const gLinks: GraphLink[] = filteredEdges.map((edge) => ({
      source: edge.from,
      target: edge.to,
      type: edge.type,
      id: edge.id,
      note: edge.note,
      editable: edge.editable,
      pending: edge.id?.startsWith("pending-") === true,
    }));
    return { nodes: gNodes, links: gLinks };
  }, [filteredNodes, filteredEdges, degreeById, nodePositions, composerState]);

  const selected = nodeById.get(selectedId) ?? null;
  const sidePanelOpen = edgeToRemove !== null;
  const interactionOpen = composerState !== null || edgeToRemove !== null;
  const connectionSourceId = connectingFromId;
  const connectionTargetId = pendingEdge?.to ?? null;

  const handleNodeDragEnd = useCallback((dragged: GraphNode) => {
    draggedNodeClickRef.current = dragged.id;
    window.setTimeout(() => {
      if (draggedNodeClickRef.current === dragged.id)
        draggedNodeClickRef.current = null;
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
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("layerGrid", createLayerForce(190, 92));
    fg.d3ReheatSimulation();
    const timer = window.setTimeout(
      () => graphRef.current?.zoomToFit(400, 40),
      260,
    );
    return () => window.clearTimeout(timer);
  }, [graphReadyVersion, sidePanelOpen, size.h, size.w, view]);

  useEffect(() => {
    if (!connectingFromId || visibleIds.has(connectingFromId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectingFromId(null);
  }, [connectingFromId, visibleIds]);

  useEffect(() => {
    if (!connectingFromId) return;
    const cancelConnection = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !connectingPending)
        setConnectingFromId(null);
    };
    window.addEventListener("keydown", cancelConnection);
    return () => window.removeEventListener("keydown", cancelConnection);
  }, [connectingFromId, connectingPending]);

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
    setRelationFilter(
      new Set(Object.keys(RELATION_LABEL) as TheoryRelationType[]),
    );
  }

  const updateDraftNode = useCallback(
    (draftId: string, fields: DraftNodeFields) => {
      setNodes((current) => {
        const title = fields.title.trim() || "新しいノード";
        const draft = current.find((node) => node.id === draftId);
        if (
          !draft ||
          (draft.title === title &&
            draft.kind === fields.kind &&
            draft.layer === fields.layer &&
            draft.status === fields.status)
        ) {
          return current;
        }
        return current.map((node) =>
          node.id === draftId
            ? {
                ...node,
                title,
                kind: fields.kind,
                layer: fields.layer,
                status: fields.status,
              }
            : node,
        );
      });
    },
    [],
  );

  function discardDraft(draftId: string) {
    setNodes((current) => current.filter((node) => node.id !== draftId));
    setNodePositions((current) => {
      const next = { ...current };
      delete next[draftId];
      return next;
    });
  }

  function closeComposer() {
    if (composerState && composerState.type === "create")
      discardDraft(composerState.draftId);
    setComposerState(null);
    setComposerAnchor(null);
  }

  function openDraftComposer(
    graphPoint: { x: number; y: number },
    anchor: { x: number; y: number },
  ) {
    const draftId = `draft-${crypto.randomUUID()}`;
    const nextDraft = draftNode(draftId);
    setNodes((current) => [...current, nextDraft]);
    setNodePositions((current) => ({
      ...current,
      [draftId]: {
        x: graphPoint.x,
        y: graphPoint.y,
        fx: graphPoint.x,
        fy: graphPoint.y,
      },
    }));
    setConnectingFromId(null);
    setEdgeToRemove(null);
    setComposerAnchor(anchor);
    setComposerState({ type: "create", draftId });
  }

  // メモ追加はノードもエッジも作らない。draft node は生成せず、選択ノードの
  // 内側へ積む記録用フォームだけをマップ内オーバーレイで開く。
  function openMemoComposer() {
    if (!selected) return;
    const graphNode = graphData.nodes.find((node) => node.id === selected.id);
    const sourcePoint = { x: graphNode?.x ?? 0, y: graphNode?.y ?? 0 };
    const screenPoint = graphRef.current?.graph2ScreenCoords(
      sourcePoint.x,
      sourcePoint.y,
    ) ?? {
      x: size.w / 2,
      y: size.h / 2,
    };
    setConnectingFromId(null);
    setEdgeToRemove(null);
    setComposerAnchor(screenPoint);
    setComposerState({ type: "memo", node: selected });
  }

  function openEditComposer(
    node: TheoryMapNode,
    anchor?: { x: number; y: number },
  ) {
    const graphNode = graphData.nodes.find(
      (candidate) => candidate.id === node.id,
    );
    const screenPoint = anchor ??
      (graphNode && Number.isFinite(graphNode.x) && Number.isFinite(graphNode.y)
        ? graphRef.current?.graph2ScreenCoords(
            graphNode.x ?? 0,
            graphNode.y ?? 0,
          )
        : null) ?? { x: size.w / 2, y: 80 };
    setConnectingFromId(null);
    setEdgeToRemove(null);
    setComposerAnchor(screenPoint);
    setComposerState({ type: "edit", node });
  }

  async function createDirectEdge(from: string, to: string) {
    const relationType = connectingRelationType;
    const optimisticEdge: TheoryMapEdge = {
      id: `pending-${crypto.randomUUID()}`,
      from,
      to,
      type: relationType,
      note: null,
      editable: false,
    };
    setConnectingPending(true);
    setPendingEdge(optimisticEdge);
    setSelectedId(to);
    const result = await callTheoryMapApi({
      method: "POST",
      body: { action: "create_edge", from, to, type: relationType },
    });
    setConnectingPending(false);
    if (!result.ok) {
      setPendingEdge(null);
      announce("error", result.error);
      return;
    }
    const edge = parseTheoryMapEdgeDto(result.payload.edge);
    if (!edge) {
      setPendingEdge(null);
      announce("error", "サーバーの応答を解釈できませんでした。");
      return;
    }
    setEdges((current) =>
      current.some((candidate) => candidate.id === edge.id)
        ? current
        : [...current, edge],
    );
    setPendingEdge(null);
    setSelectedId(to);
    setConnectingFromId(null);
    announce("success", `${RELATION_LABEL[edge.type]} で接続しました。`);
  }

  function handleNodeClick(node: GraphNode, event: MouseEvent) {
    suppressNextBackgroundClick();
    if (node.draft) return;
    if (draggedNodeClickRef.current === node.id) {
      draggedNodeClickRef.current = null;
      return;
    }

    const modifierPressed = event.metaKey || event.ctrlKey;
    if (canEdit && modifierPressed) {
      if (connectingPending) return;
      // composer が下書き作成中だった場合は、接続モードへ入る前に下書きを
      // 破棄する（そうしないと nodes/positions に孤児 draft node が残る）。
      closeComposer();
      setEdgeToRemove(null);
      if (!connectingFromId) {
        setSelectedId(node.id);
        setConnectingFromId(node.id);
        return;
      }
      if (connectingFromId === node.id) {
        announce(
          "error",
          "同じノード同士は接続できないよ。別のノードを選んでね。",
        );
        return;
      }
      void createDirectEdge(connectingFromId, node.id);
      return;
    }

    setConnectingFromId(null);
    setSelectedId(node.id);
    if (canEdit && node.editable) {
      // composer が別ノードの下書き作成中だった場合は、切替前に下書きを破棄する。
      if (composerState && composerState.type === "create")
        discardDraft(composerState.draftId);
      openEditComposer(node, { x: event.offsetX, y: event.offsetY });
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const composerOverlayStyle: React.CSSProperties =
    size.w < 640
      ? {
          left: 12,
          right: 12,
          ...(composerAnchor && composerAnchor.y > size.h / 2
            ? { top: 12 }
            : { bottom: 12 }),
          maxHeight: Math.max(180, size.h / 2 - 28),
        }
      : (() => {
          const panelWidth = Math.min(360, size.w - 24);
          const anchor = composerAnchor ?? { x: size.w / 2, y: 80 };
          const nodeGap = 72;
          const fitsRight =
            anchor.x + nodeGap + panelWidth <= size.w - 12;
          const left = fitsRight
            ? anchor.x + nodeGap
            : Math.max(12, anchor.x - panelWidth - nodeGap);
          const top = Math.max(12, Math.min(anchor.y - 64, size.h - 360));
          // top を確定させた後の残り可視高だけを maxHeight にする。size.h - 24
          // 固定だと top > 12 のとき bottom (= top + maxHeight) が viewport を
          // 超え、親 overflow で panel 下部が clip され内部 scroll も実際の
          // 可視高を認識できない。
          const maxHeight = Math.max(180, size.h - top - 12);
          return { left, top, width: panelWidth, maxHeight };
        })();

  return (
    <div style={{ color: GRAPHITE }}>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
        <header
          className="rounded-lg border px-4 py-4"
          style={{ backgroundColor: PAPER_PANEL, borderColor: PAPER_BORDER }}
        >
          <div
            className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium"
            style={{ color: GRAPHITE_MUTED }}
          >
            <span
              className="rounded-full border px-2 py-0.5 font-mono"
              style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_BG }}
            >
              BZM 2.0 / 知識構造
            </span>
            <span>
              {nodes.length} ノード / {edges.length} 関係
            </span>
            <Link
              href="/bzm"
              className="inline-flex min-h-11 items-center font-semibold hover:underline"
              style={{ color: BLUEPRINT }}
            >
              ← 教科書へ戻る
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            理論マップ — 論証台帳
          </h1>
          <p
            className="mt-2 max-w-3xl text-sm leading-6"
            style={{ color: GRAPHITE_MUTED }}
          >
            自分で理解した理論・文献・反証・未解決の論点を書き、関係を結びながら育てる台帳。
            空白クリックで新しいノード、ノードをクリックして編集。⌘を押しながら2つのノードを順に選ぶと接続できる。
          </p>
          {storageMode === "unavailable" && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: VERMILION,
                backgroundColor: rgba(VERMILION, 0.08),
                color: VERMILION,
              }}
              role="alert"
            >
              理論マップを読み込めないため、編集を停止している。
            </div>
          )}
          {errors.length > 0 && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              style={{
                borderColor: VERMILION,
                backgroundColor: rgba(VERMILION, 0.08),
                color: VERMILION,
              }}
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
              style={{
                borderColor: PAPER_BORDER,
                backgroundColor: PAPER_BG,
                color: GRAPHITE,
              }}
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="層で絞り込み"
          >
            {LAYER_ORDER.map((layer) => (
              <button
                key={layer}
                type="button"
                onClick={() => toggleInSet(layerFilter, layer, setLayerFilter)}
                className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
                style={{
                  borderColor: PAPER_BORDER,
                  backgroundColor: layerFilter.has(layer)
                    ? BLUEPRINT
                    : PAPER_BG,
                  color: layerFilter.has(layer) ? "#fff" : GRAPHITE_MUTED,
                }}
                aria-pressed={layerFilter.has(layer)}
              >
                {LAYER_LABEL[layer]}
              </button>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="状態で絞り込み"
          >
            {(Object.keys(STATUS_LABEL) as TheoryNodeStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() =>
                  toggleInSet(statusFilter, status, setStatusFilter)
                }
                className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
                style={{
                  borderColor: statusFilter.has(status)
                    ? GRAPHITE
                    : PAPER_BORDER,
                  backgroundColor: statusFilter.has(status)
                    ? rgba(GRAPHITE, 0.08)
                    : PAPER_BG,
                  color: statusFilter.has(status) ? GRAPHITE : GRAPHITE_MUTED,
                }}
                aria-pressed={statusFilter.has(status)}
              >
                {STATUS_LABEL[status].split(" ")[0]}
              </button>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label="関係で絞り込み"
          >
            {(Object.keys(RELATION_LABEL) as TheoryRelationType[]).map(
              (rel) => (
                <button
                  key={rel}
                  type="button"
                  onClick={() =>
                    toggleInSet(relationFilter, rel, setRelationFilter)
                  }
                  className="min-h-11 rounded-md border px-2 text-[11px] font-medium transition sm:min-h-8"
                  style={{
                    borderColor: RELATION_COLOR[rel],
                    backgroundColor: relationFilter.has(rel)
                      ? rgba(RELATION_COLOR[rel], 0.16)
                      : PAPER_BG,
                    color: relationFilter.has(rel)
                      ? RELATION_COLOR[rel]
                      : GRAPHITE_MUTED,
                  }}
                  aria-pressed={relationFilter.has(rel)}
                >
                  {RELATION_LABEL[rel]}
                </button>
              ),
            )}
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
              disabled={interactionOpen}
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

        <section className="grid gap-4">
          <div
            className="min-w-0 overflow-hidden rounded-lg border"
            style={{ borderColor: PAPER_BORDER, backgroundColor: PAPER_PANEL }}
          >
            {view === "map" ? (
              <div
                data-bzm-map-workspace="true"
                className={
                  sidePanelOpen
                    ? "grid min-w-0 md:grid-cols-[minmax(0,1fr)_400px]"
                    : "grid min-w-0"
                }
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
                        className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2 rounded-full border px-3 py-2 shadow-md"
                        style={{
                          borderColor: rgba(BLUEPRINT, 0.5),
                          backgroundColor: rgba(PAPER_PANEL, 0.97),
                          color: GRAPHITE,
                        }}
                        role="status"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <span className="max-w-52 truncate text-xs font-semibold">
                          <BzmMathText
                            source={nodeById.get(connectingFromId)?.title ?? ""}
                          />
                        </span>
                        <span aria-hidden="true" style={{ color: BLUEPRINT }}>
                          →
                        </span>
                        <select
                          aria-label="作成する関係"
                          value={connectingRelationType}
                          onChange={(event) =>
                            setConnectingRelationType(
                              event.target.value as TheoryRelationType,
                            )
                          }
                          disabled={connectingPending}
                          className="h-8 rounded-full border px-2 text-xs font-semibold outline-none disabled:opacity-60"
                          style={{
                            borderColor: PAPER_BORDER,
                            backgroundColor: PAPER_BG,
                            color: BLUEPRINT,
                          }}
                        >
                          {(
                            Object.keys(RELATION_LABEL) as TheoryRelationType[]
                          ).map((relation) => (
                            <option key={relation} value={relation}>
                              {RELATION_LABEL[relation]}
                            </option>
                          ))}
                        </select>
                        <span
                          className="text-xs"
                          style={{ color: GRAPHITE_MUTED }}
                        >
                          {connectingPending
                            ? "線を表示済み・保存中…"
                            : "⌘＋次のノードで即接続・Escで解除"}
                        </span>
                      </div>
                    )}
                    <div
                      className="pointer-events-none absolute inset-x-3 top-3 z-10 hidden grid-cols-7 gap-1 sm:grid"
                      aria-hidden="true"
                    >
                      {LAYER_ORDER.map((layer) => (
                        <span
                          key={layer}
                          className="rounded border px-1 py-0.5 text-center text-[9px] font-semibold"
                          style={{
                            borderColor: PAPER_BORDER,
                            backgroundColor: rgba(PAPER_PANEL, 0.88),
                            color: GRAPHITE_MUTED,
                          }}
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
                      linkColor={(link) =>
                        rgba(RELATION_COLOR[link.type], 0.55)
                      }
                      linkWidth={(link) =>
                        CHALLENGE_TYPES.includes(link.type) ? 1.6 : 1.1
                      }
                      linkLineDash={(link) =>
                        STRUCTURAL_TYPES.includes(link.type) ? [4, 3] : null
                      }
                      linkLabel={(link) => RELATION_LABEL[link.type]}
                      linkHoverPrecision={10}
                      linkCanvasObject={drawClippedLink}
                      linkCanvasObjectMode="replace"
                      linkPointerAreaPaint={paintClippedLinkPointerArea}
                      nodeCanvasObject={(node, ctx, globalScale) => {
                        const r = nodeRadius(node);
                        const x = node.x ?? 0;
                        const y = node.y ?? 0;
                        const isSelected = selected?.id === node.id;
                        const isConnectionSource =
                          connectionSourceId === node.id;
                        const isConnectionTarget =
                          connectionTargetId === node.id;
                        const color = KIND_COLOR[node.kind];
                        ctx.save();
                        if (isConnectionSource) {
                          ctx.beginPath();
                          ctx.arc(x, y, r + 5, 0, Math.PI * 2);
                          ctx.lineWidth = 2;
                          ctx.strokeStyle = BLUEPRINT;
                          ctx.shadowColor = rgba(BLUEPRINT, 0.55);
                          ctx.shadowBlur = 10;
                          ctx.stroke();
                          ctx.shadowBlur = 0;
                        } else if (isConnectionTarget || isSelected) {
                          ctx.beginPath();
                          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
                          ctx.fillStyle = rgba(
                            BLUEPRINT,
                            isConnectionTarget ? 0.2 : 0.12,
                          );
                          ctx.fill();
                        }
                        drawShape(
                          ctx,
                          KIND_SHAPE[node.kind],
                          x,
                          y,
                          r,
                          rgba(color, node.draft ? 0.42 : 0.85),
                          isSelected ? GRAPHITE : "rgba(255,255,255,0.9)",
                        );

                        const label =
                          node.title.length > 15
                            ? `${node.title.slice(0, 14)}…`
                            : node.title;
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
                          12 / textScale,
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
                      onBackgroundClick={(event) => {
                        if (suppressBackgroundClickRef.current) {
                          suppressBackgroundClickRef.current = false;
                          return;
                        }
                        if (connectingFromId) {
                          if (!connectingPending) setConnectingFromId(null);
                          return;
                        }
                        if (composerState) {
                          closeComposer();
                          return;
                        }
                        if (canEdit && !edgeToRemove) {
                          const screenPoint = {
                            x: event.offsetX,
                            y: event.offsetY,
                          };
                          const graphPoint =
                            graphRef.current?.screen2GraphCoords(
                              screenPoint.x,
                              screenPoint.y,
                            ) ?? { x: 0, y: 0 };
                          openDraftComposer(graphPoint, screenPoint);
                        }
                      }}
                      onLinkClick={(link) => {
                        suppressNextBackgroundClick();
                        if (
                          !canEdit ||
                          composerState ||
                          !link.id ||
                          !link.editable
                        )
                          return;
                        const edge = edges.find(
                          (candidate) => candidate.id === link.id,
                        );
                        if (edge) setEdgeToRemove(edge);
                      }}
                    />

                    {graphData.nodes.length === 0 && !composerState && (
                      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
                        <div
                          className="max-w-sm rounded-lg border border-dashed px-5 py-4 shadow-sm"
                          style={{
                            borderColor: PAPER_BORDER,
                            backgroundColor: rgba(PAPER_PANEL, 0.92),
                          }}
                        >
                          <div
                            className="text-sm font-semibold"
                            style={{ color: GRAPHITE }}
                          >
                            {nodes.length === 0
                              ? "ここから、まさの理論マップが始まる"
                              : "条件に合うノードがない"}
                          </div>
                          <p
                            className="mt-1 text-xs leading-5"
                            style={{ color: GRAPHITE_MUTED }}
                          >
                            {canEdit && nodes.length === 0
                              ? "マップの空いている場所をクリックして、最初のノードを書いてみて。"
                              : nodes.length === 0
                                ? "まだノードはありません。"
                                : "フィルタを解除すると、すべてのノードを表示できます。"}
                          </p>
                        </div>
                      </div>
                    )}

                    {canEdit &&
                      selected &&
                      visibleIds.has(selected.id) &&
                      !composerState &&
                      !edgeToRemove &&
                      !connectingFromId && (
                        <div className="absolute inset-x-3 bottom-3 z-20 flex justify-center">
                          <div
                            className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-lg border p-2 shadow-lg"
                            style={{
                              borderColor: PAPER_BORDER,
                              backgroundColor: rgba(PAPER_PANEL, 0.96),
                            }}
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <span
                              className="max-w-48 truncate px-2 text-xs font-semibold"
                              style={{ color: GRAPHITE }}
                            >
                              <BzmMathText source={selected.title} />
                            </span>
                            {selected.editable && (
                              <button
                                type="button"
                                onClick={() => openEditComposer(selected)}
                                className="flex min-h-11 items-center gap-1 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                                style={{
                                  borderColor: PAPER_BORDER,
                                  color: BLUEPRINT,
                                }}
                              >
                                <PenLine
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                編集
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openMemoComposer()}
                              className="flex min-h-11 items-center gap-1 rounded-md border px-3 text-xs font-semibold sm:min-h-9"
                              style={{
                                borderColor: BLUEPRINT,
                                color: BLUEPRINT,
                                backgroundColor: rgba(BLUEPRINT, 0.06),
                              }}
                            >
                              <NotebookPen
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              メモを追加
                            </button>
                            <span
                              className="hidden px-2 text-[11px] sm:inline"
                              style={{ color: GRAPHITE_MUTED }}
                            >
                              ⌘＋クリックで2つ選ぶと接続
                            </span>
                          </div>
                        </div>
                      )}

                    {composerState && (
                      <div
                        className="pointer-events-auto absolute z-30"
                        data-bzm-map-overlay-host="composer"
                        style={composerOverlayStyle}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <BzmTheoryComposerDialog
                          state={composerState}
                          onClose={closeComposer}
                          onDraftChange={updateDraftNode}
                          onNodeCreated={(node, edge) => {
                            const draftId =
                              composerState.type === "create"
                                ? composerState.draftId
                                : null;
                            setNodes((current) =>
                              draftId
                                ? current.map((candidate) =>
                                    candidate.id === draftId ? node : candidate,
                                  )
                                : [...current, node],
                            );
                            if (draftId) {
                              setNodePositions((current) => {
                                const next = { ...current };
                                const draftPosition = next[draftId];
                                delete next[draftId];
                                if (draftPosition)
                                  next[node.id] = draftPosition;
                                return next;
                              });
                            }
                            if (edge) setEdges((current) => [...current, edge]);
                            setSelectedId(node.id);
                            setComposerState(null);
                            setComposerAnchor(null);
                            announce(
                              "success",
                              `「${node.title}」を作成しました。`,
                            );
                          }}
                          onNodeUpdated={(node) => {
                            setNodes((current) =>
                              current.map((candidate) =>
                                candidate.id === node.id ? node : candidate,
                              ),
                            );
                            setComposerState(null);
                            setComposerAnchor(null);
                            announce(
                              "success",
                              `「${node.title}」を更新しました。`,
                            );
                          }}
                          onMemoCreated={(memo) => {
                            setMemos((current) => [...current, memo]);
                            setComposerState(null);
                            setComposerAnchor(null);
                            announce("success", "メモを追加しました。");
                          }}
                          onNodeDeleted={(nodeId) => {
                            setNodes((current) =>
                              current.filter((node) => node.id !== nodeId),
                            );
                            setEdges((current) =>
                              current.filter(
                                (edge) =>
                                  edge.from !== nodeId && edge.to !== nodeId,
                              ),
                            );
                            setMemos((current) =>
                              current.filter((memo) => memo.nodeId !== nodeId),
                            );
                            setNodePositions((current) => {
                              const next = { ...current };
                              delete next[nodeId];
                              return next;
                            });
                            setSelectedId("");
                            setComposerState(null);
                            setComposerAnchor(null);
                            announce("success", "ノードを削除しました。");
                          }}
                          getConnectionCount={(nodeId) =>
                            degreeById.get(nodeId) ?? 0
                          }
                          getMemoCount={(nodeId) =>
                            memos.filter((memo) => memo.nodeId === nodeId)
                              .length
                          }
                          onError={(message) => announce("error", message)}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2"
                    style={{
                      borderColor: PAPER_BORDER,
                      backgroundColor: PAPER_PANEL,
                    }}
                    aria-label="ノード表示の凡例"
                  >
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: GRAPHITE_MUTED }}
                    >
                      種類
                    </span>
                    {(Object.keys(KIND_LABEL) as TheoryNodeKind[]).map(
                      (kind) => (
                        <span
                          key={kind}
                          className="inline-flex items-center gap-1.5 text-[11px]"
                          style={{ color: GRAPHITE_MUTED }}
                        >
                          <span
                            className="h-3 w-3 shrink-0"
                            style={{
                              backgroundColor: KIND_COLOR[kind],
                              clipPath: kindLegendClipPath(kind),
                            }}
                            aria-hidden="true"
                          />
                          {KIND_LABEL[kind]}
                        </span>
                      ),
                    )}
                    <span
                      className="ml-auto text-[11px]"
                      style={{ color: GRAPHITE_MUTED }}
                    >
                      状態は一覧表示・編集オーバーレイのラベルで確認
                    </span>
                  </div>
                </div>

                {edgeToRemove && (
                  <div
                    className="min-h-[360px] border-t p-4 md:min-h-0 md:border-l md:border-t-0"
                    data-bzm-map-panel="edge-delete"
                    style={{
                      borderColor: PAPER_BORDER,
                      backgroundColor: PAPER_PANEL,
                    }}
                  >
                    <div
                      role="dialog"
                      aria-modal="false"
                      aria-labelledby="bzm-edge-delete-title"
                      className="w-full p-1"
                      style={{ color: GRAPHITE }}
                    >
                      <h2
                        id="bzm-edge-delete-title"
                        className="text-lg font-semibold"
                      >
                        この接続を削除する？
                      </h2>
                      <p
                        className="mt-2 text-sm leading-6"
                        style={{ color: GRAPHITE_MUTED }}
                      >
                        {RELATION_LABEL[edgeToRemove.type]}:{" "}
                        {nodeById.get(edgeToRemove.from)?.title ??
                          edgeToRemove.from}{" "}
                        →{" "}
                        {nodeById.get(edgeToRemove.to)?.title ??
                          edgeToRemove.to}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: VERMILION }}>
                        この操作は取り消せません。
                      </p>
                      {removeError && (
                        <div
                          className="mt-3 rounded-md border px-3 py-2 text-xs"
                          style={{
                            borderColor: VERMILION,
                            backgroundColor: rgba(VERMILION, 0.08),
                            color: VERMILION,
                          }}
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
                          style={{
                            borderColor: PAPER_BORDER,
                            color: GRAPHITE_MUTED,
                          }}
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
                            setEdges((current) =>
                              current.filter((edge) => edge.id !== removedId),
                            );
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
                          openEditComposer(node);
                        }
                      }}
                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2"
                      style={{
                        backgroundColor:
                          selected?.id === node.id
                            ? rgba(BLUEPRINT, 0.1)
                            : "transparent",
                        outlineColor: BLUEPRINT,
                      }}
                    >
                      <div
                        className="flex flex-wrap items-center gap-2 text-xs"
                        style={{ color: GRAPHITE_MUTED }}
                      >
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-0.5 font-semibold"
                          style={{ borderColor: PAPER_BORDER }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: KIND_COLOR[node.kind] }}
                            aria-hidden="true"
                          />
                          {KIND_LABEL[node.kind]}
                        </span>
                        <span>{LAYER_LABEL[node.layer]}</span>
                        <span>{STATUS_LABEL[node.status]}</span>
                        <span className="ml-auto font-mono">
                          接続 {degreeById.get(node.id) ?? 0}
                        </span>
                      </div>
                      <div
                        className="font-semibold"
                        style={{ color: GRAPHITE }}
                      >
                        <BzmMathText source={node.title} />
                      </div>
                      <div
                        className="line-clamp-2 text-xs leading-5"
                        style={{ color: GRAPHITE_MUTED }}
                      >
                        <BzmMathText source={node.summary} />
                      </div>
                    </button>
                  </li>
                ))}
                {filteredNodes.length === 0 && (
                  <li
                    className="px-4 py-6 text-sm"
                    style={{ color: GRAPHITE_MUTED }}
                  >
                    条件に一致するノードがない。
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        <section
          className="flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-xs"
          style={{
            borderColor: PAPER_BORDER,
            backgroundColor: PAPER_PANEL,
            color: GRAPHITE_MUTED,
          }}
        >
          <span className="font-semibold" style={{ color: GRAPHITE }}>
            凡例
          </span>
          <span>
            塗り色 + 形 = 種別 (青○概念 赤紫◇主張 緑□測定 黄△決定 紫⬡ソース
            茶○問い)
          </span>
          <span>状態 = 一覧表示・編集オーバーレイのラベル</span>
          <span>
            線 = 関係 (緑=支持系 オーカー=異議/論点 朱=反証 青=検証/依存
            破線=依存・上書き)
          </span>
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
              backgroundColor:
                notice.type === "success"
                  ? rgba(MOSS, 0.12)
                  : rgba(VERMILION, 0.12),
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
