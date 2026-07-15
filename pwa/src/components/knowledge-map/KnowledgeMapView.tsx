"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CircleDot,
  Database,
  ExternalLink,
  GitBranch,
  Layers3,
  Maximize2,
  Minimize2,
  Network,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  KnowledgeMapData,
  KnowledgeMapLink,
  KnowledgeMapNode,
  KnowledgeNodeKind,
  KnowledgeNodeStatus,
} from "@/lib/knowledge-map-data";

type GraphLink = KnowledgeMapLink & {
  source: string | KnowledgeMapNode;
  target: string | KnowledgeMapNode;
};

interface ForceGraphProps {
  graphData: {
    nodes: KnowledgeMapNode[];
    links: GraphLink[];
  };
  width: number;
  height: number;
  backgroundColor?: string;
  cooldownTicks?: number;
  linkColor?: (link: GraphLink) => string;
  linkWidth?: (link: GraphLink) => number;
  linkDirectionalParticles?: (link: GraphLink) => number;
  linkDirectionalParticleWidth?: (link: GraphLink) => number;
  nodeCanvasObject?: (
    node: KnowledgeMapNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number
  ) => void;
  nodePointerAreaPaint?: (
    node: KnowledgeMapNode,
    color: string,
    ctx: CanvasRenderingContext2D
  ) => void;
  onNodeClick?: (node: KnowledgeMapNode) => void;
  onEngineStop?: () => void;
}

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as React.ComponentType<ForceGraphProps & { ref?: React.Ref<ForceGraphHandle> }>;

interface ForceGraphHandle {
  centerAt: (x?: number, y?: number, ms?: number) => void;
  zoom: (k?: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  d3Force: (name: string, force?: unknown) => unknown;
}

type DomainFilter = "all" | string;

const KIND_LABEL: Record<KnowledgeNodeKind, string> = {
  root: "中心",
  domain: "領域",
  source: "正本",
  item: "項目",
  rule: "ルール",
  pack: "Pack",
};

const STATUS_LABEL: Record<KnowledgeNodeStatus, string> = {
  active: "active",
  candidate: "candidate",
  confirmed: "confirmed",
  review: "review",
  gap: "next",
  static: "static",
};

const STATUS_STYLE: Record<KnowledgeNodeStatus, string> = {
  active: "border-emerald-300/70 bg-emerald-50 text-emerald-800",
  candidate: "border-amber-300/80 bg-amber-50 text-amber-800",
  confirmed: "border-sky-300/80 bg-sky-50 text-sky-800",
  review: "border-rose-300/80 bg-rose-50 text-rose-800",
  gap: "border-slate-300 bg-slate-100 text-slate-700",
  static: "border-zinc-300 bg-zinc-50 text-zinc-700",
};

const STAT_STYLE: Record<KnowledgeMapData["stats"][number]["tone"], string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-sky-200 bg-sky-50 text-sky-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

function linkId(value: string | KnowledgeMapNode) {
  return typeof value === "string" ? value : value.id;
}

function rgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return `rgba(31, 41, 55, ${alpha})`;
  const n = Number.parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function textMatches(node: KnowledgeMapNode, query: string) {
  if (!query) return true;
  const haystack = [
    node.label,
    node.summary,
    node.sourceLabel,
    node.evidenceLabel,
    node.status,
    node.domain,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function KnowledgeMapView({ data, embedded = false }: { data: KnowledgeMapData; embedded?: boolean }) {
  const root = data.nodes.find((node) => node.id === "amd-knowledge") ?? data.nodes[0];
  const [selectedId, setSelectedId] = useState(root?.id ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["amd-knowledge", ...data.nodes.filter((node) => node.kind === "domain").map((node) => node.id)])
  );
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<DomainFilter>("all");
  const [size, setSize] = useState({ w: 920, h: 620 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphHandle | null>(null);

  const nodeById = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);

  const childrenById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of data.links) {
      const source = linkId(link.source);
      const target = linkId(link.target);
      if (!map.has(source)) map.set(source, []);
      map.get(source)!.push(target);
    }
    return map;
  }, [data.links]);

  const parentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of data.links) {
      map.set(linkId(link.target), linkId(link.source));
    }
    return map;
  }, [data.links]);

  const domains = useMemo(
    () => data.nodes.filter((node) => node.kind === "domain").sort((a, b) => a.label.localeCompare(b.label, "ja")),
    [data.nodes]
  );

  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    const isVisibleByExpansion = (id: string) => {
      let cursor = parentById.get(id);
      while (cursor) {
        if (!expanded.has(cursor)) return false;
        cursor = parentById.get(cursor);
      }
      return true;
    };

    for (const node of data.nodes) {
      if (domain !== "all" && node.domain !== domain && node.id !== "amd-knowledge" && node.kind !== "domain") {
        continue;
      }
      if (domain !== "all" && node.kind === "domain" && node.id !== domain) continue;
      if (!isVisibleByExpansion(node.id)) continue;
      if (!textMatches(node, query.trim())) {
        const children = childrenById.get(node.id) ?? [];
        if (!children.some((childId) => textMatches(nodeById.get(childId)!, query.trim()))) continue;
      }
      visible.add(node.id);
    }
    return visible;
  }, [childrenById, data.nodes, domain, expanded, nodeById, parentById, query]);

  const graphData = useMemo(() => {
    const nodes = data.nodes.filter((node) => visibleIds.has(node.id));
    const links = data.links.filter((link) => visibleIds.has(linkId(link.source)) && visibleIds.has(linkId(link.target)));
    return { nodes, links: links as GraphLink[] };
  }, [data.links, data.nodes, visibleIds]);

  const selected = nodeById.get(selectedId) ?? root;
  const selectedChildren = (childrenById.get(selected?.id ?? "") ?? [])
    .map((id) => nodeById.get(id))
    .filter((node): node is KnowledgeMapNode => Boolean(node));

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
    const timer = window.setTimeout(() => graphRef.current?.zoomToFit(500, 44), 250);
    return () => window.clearTimeout(timer);
  }, [domain, query, expanded]);

  const toggleNode = (node: KnowledgeMapNode) => {
    setSelectedId(node.id);
    if (!childrenById.has(node.id)) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(data.nodes.map((node) => node.id)));
  const collapseToDomains = () =>
    setExpanded(new Set(["amd-knowledge", ...data.nodes.filter((node) => node.kind === "domain").map((node) => node.id)]));

  return (
    <div className={cn("text-zinc-950", embedded ? "bg-transparent" : "min-h-[calc(100vh-2.75rem)] bg-[#f7f8f6]")}>
      <div className={cn("mx-auto flex w-full max-w-[1680px] flex-col gap-4", embedded ? "" : "px-4 py-4 sm:px-5 sm:py-5")}>
        <header className={cn("grid gap-4 border-b border-zinc-200 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end", embedded && "border border-[#c9c1b4] bg-[#fbf8f2] p-4")}>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-500">
              <span className="rounded-full border border-zinc-300 bg-white px-2 py-1 font-mono text-zinc-700">
                source-limited map
              </span>
              <span>生成: {formatDate(data.generatedAt)}</span>
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              {embedded ? "AMDのノウハウ地図" : "AMD Knowledge Map"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              OS内のL2とmanual/specを、判断・PJ・人・会議・根拠・教科書化へ束ねた読み取り専用マップ。
              ノードを押すと展開し、右側で根拠の置き場所を確認できる。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            {data.stats.map((stat) => (
              <div
                key={stat.label}
                className={cn("min-w-[104px] rounded-lg border px-3 py-2", STAT_STYLE[stat.tone])}
              >
                <div className="font-mono text-lg font-semibold leading-none">{stat.value.toLocaleString("ja-JP")}</div>
                <div className="mt-1 text-[11px] font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid min-h-[720px] gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="flex min-h-0 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ノード検索"
                    className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none transition focus:border-zinc-400 focus:bg-white"
                  />
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDomain("all")}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-medium transition",
                      domain === "all"
                        ? "bg-zinc-950 text-white"
                        : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                    )}
                  >
                    全体
                  </button>
                  {domains.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setDomain(item.id)}
                      className={cn(
                        "h-8 max-w-[150px] rounded-md px-3 text-xs font-medium transition",
                        domain === item.id
                          ? "text-white"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                      )}
                      style={domain === item.id ? { backgroundColor: item.color } : undefined}
                      title={item.label}
                    >
                      <span className="block truncate">{item.label}</span>
                    </button>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => graphRef.current?.zoomToFit(500, 44)}
                    className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                    title="全体を表示"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={expandAll}
                    className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                    title="全部展開"
                  >
                    <Layers3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={collapseToDomains}
                    className="grid h-9 w-9 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950"
                    title="代表ノードまで畳む"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div ref={containerRef} className="h-[620px] min-h-[480px] w-full bg-[#fbfbf8] lg:h-[760px]">
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  width={size.w}
                  height={size.h}
                  backgroundColor="#fbfbf8"
                  cooldownTicks={80}
                  linkColor={(link) => {
                    const source = nodeById.get(linkId(link.source));
                    return rgba(source?.color ?? "#71717a", 0.28);
                  }}
                  linkWidth={(link) => {
                    const source = nodeById.get(linkId(link.source));
                    return source?.kind === "root" ? 1.6 : 1;
                  }}
                  linkDirectionalParticles={(link) => {
                    const target = nodeById.get(linkId(link.target));
                    return target?.status === "candidate" ? 2 : 0;
                  }}
                  linkDirectionalParticleWidth={() => 1.6}
                  nodeCanvasObject={(node, ctx, globalScale) => {
                    const radius = Math.max(5, Math.sqrt(node.val) * 1.8);
                    const x = node.x ?? 0;
                    const y = node.y ?? 0;
                    const isSelected = selected?.id === node.id;
                    const isExpandable = childrenById.has(node.id);
                    const fontSize =
                      node.kind === "root" ? 14 : node.kind === "domain" ? 12 : node.kind === "source" ? 10 : 8.5;
                    const label = node.label.length > 34 ? `${node.label.slice(0, 33)}…` : node.label;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x, y, radius + (isSelected ? 6 : 3), 0, Math.PI * 2);
                    ctx.fillStyle = rgba(node.color, isSelected ? 0.2 : 0.09);
                    ctx.fill();

                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = node.kind === "item" ? rgba(node.color, 0.72) : node.color;
                    ctx.fill();
                    ctx.lineWidth = isSelected ? 2.4 : 1.2;
                    ctx.strokeStyle = isSelected ? "#111827" : "rgba(255,255,255,0.88)";
                    ctx.stroke();

                    if (isExpandable) {
                      ctx.beginPath();
                      ctx.arc(x + radius * 0.75, y - radius * 0.75, 3.5, 0, Math.PI * 2);
                      ctx.fillStyle = expanded.has(node.id) ? "#111827" : "#ffffff";
                      ctx.fill();
                      ctx.strokeStyle = rgba(node.color, 0.9);
                      ctx.lineWidth = 1;
                      ctx.stroke();
                    }

                    const textScale = Math.max(1, globalScale);
                    ctx.font = `${node.kind === "root" || node.kind === "domain" ? 600 : 500} ${fontSize / textScale}px ui-sans-serif, system-ui, -apple-system`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "top";
                    ctx.fillStyle = node.kind === "item" ? "rgba(39,39,42,0.78)" : "#18181b";
                    ctx.fillText(label, x, y + radius + 5 / textScale);

                    if (typeof node.count === "number" && node.kind !== "item") {
                      ctx.font = `500 ${8 / textScale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
                      ctx.fillStyle = "rgba(82,82,91,0.76)";
                      ctx.fillText(node.count.toLocaleString("ja-JP"), x, y + radius + 19 / textScale);
                    }
                    ctx.restore();
                  }}
                  nodePointerAreaPaint={(node, color, ctx) => {
                    const radius = Math.max(12, Math.sqrt(node.val) * 2.2);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
                    ctx.fill();
                  }}
                  onNodeClick={(node) => toggleNode(node)}
                  onEngineStop={() => graphRef.current?.zoomToFit(450, 44)}
                />
              </div>
            </div>
          </div>

          <aside className="min-w-0 rounded-lg border border-zinc-200 bg-white">
            {selected ? (
              <div className="flex h-full min-h-[560px] flex-col">
                <div className="border-b border-zinc-200 px-4 py-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
                      style={{ borderColor: rgba(selected.color, 0.42), color: selected.color, backgroundColor: rgba(selected.color, 0.08) }}
                    >
                      <CircleDot className="h-3 w-3" />
                      {KIND_LABEL[selected.kind]}
                    </span>
                    {selected.status && (
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold",
                          STATUS_STYLE[selected.status]
                        )}
                      >
                        {STATUS_LABEL[selected.status]}
                      </span>
                    )}
                  </div>

                  <h2 className="text-pretty text-xl font-semibold leading-tight text-zinc-950">{selected.label}</h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">{selected.summary}</p>

                  {selected.href && (
                    <Link
                      href={selected.href}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
                    >
                      <ExternalLink className="h-4 w-4" />
                      正本を開く
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-zinc-200 p-4">
                  <MetaTile icon={<Database className="h-4 w-4" />} label="件数" value={selected.count?.toLocaleString("ja-JP") ?? "-"} />
                  <MetaTile icon={<Network className="h-4 w-4" />} label="接続" value={`${selectedChildren.length}`} />
                  <MetaTile icon={<BookOpen className="h-4 w-4" />} label="source" value={selected.sourceLabel ?? "-"} />
                  <MetaTile icon={<GitBranch className="h-4 w-4" />} label="更新" value={formatDate(selected.updatedAt)} />
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase text-zinc-500">つながるノード</h3>
                    {childrenById.has(selected.id) && (
                      <button
                        type="button"
                        onClick={() => toggleNode(selected)}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
                      >
                        {expanded.has(selected.id) ? <Minimize2 className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}
                        {expanded.has(selected.id) ? "畳む" : "展開"}
                      </button>
                    )}
                  </div>

                  {selectedChildren.length > 0 ? (
                    <div className="space-y-2">
                      {selectedChildren.map((child) => (
                        <button
                          type="button"
                          key={child.id}
                          onClick={() => setSelectedId(child.id)}
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-left transition hover:border-zinc-300 hover:bg-white"
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: child.color }}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-zinc-900">{child.label}</div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">{child.summary}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
                      これ以上の子ノードはまだ無い。
                    </div>
                  )}

                  {data.errors.length > 0 && selected.kind === "root" && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold text-amber-900">読み取りエラー</div>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
                        {data.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-zinc-500">ノードを選んでね。</div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}

function MetaTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 truncate font-mono text-sm font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
