/**
 * Shared palette, labels and view-model types for the BZM theory map UI
 * (BzmTheoryMapView + BzmTheoryComposerDialog). Kept in one module with no
 * "use client" component exports so both client components can import it
 * without creating a circular dependency between them.
 */

import type {
  TheoryMemoType,
  TheoryNodeKind,
  TheoryNodeLayer,
  TheoryNodeStatus,
  TheoryRelationType,
} from "@/lib/bzm-theory-graph";
import {
  THEORY_MEMO_TYPES,
  THEORY_NODE_KINDS,
  THEORY_NODE_LAYERS,
  THEORY_NODE_STATUSES,
  THEORY_RELATION_TYPES,
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
  positionX: number | null;
  positionY: number | null;
  editable: boolean;
}

export function parseTheoryMapNodeDto(value: unknown): TheoryMapNode | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.layer !== "string" ||
    typeof value.status !== "string" ||
    !(THEORY_NODE_KINDS as readonly string[]).includes(value.kind) ||
    !(THEORY_NODE_LAYERS as readonly string[]).includes(value.layer) ||
    !(THEORY_NODE_STATUSES as readonly string[]).includes(value.status)
  )
    return null;
  const positionX = typeof value.positionX === "number" && Number.isFinite(value.positionX)
    ? value.positionX
    : null;
  const positionY = typeof value.positionY === "number" && Number.isFinite(value.positionY)
    ? value.positionY
    : null;
  return {
    id: value.id,
    title: value.title,
    kind: value.kind as TheoryNodeKind,
    layer: value.layer as TheoryNodeLayer,
    status: value.status as TheoryNodeStatus,
    summary: typeof value.summary === "string" ? value.summary : "",
    sourceRef: typeof value.sourceRef === "string" ? value.sourceRef : "",
    sourceHref: typeof value.sourceHref === "string" ? value.sourceHref : null,
    body: typeof value.body === "string" ? value.body : "",
    positionX,
    positionY,
    editable: value.editable === true,
  };
}

export interface TheoryMapEdge {
  from: string;
  to: string;
  type: TheoryRelationType;
  id: string | null;
  note: string | null;
  editable: boolean;
}

export interface TheoryMapMemo {
  id: string;
  nodeId: string;
  memoType: TheoryMemoType;
  body: string;
  createdAt: string;
}

// パレット: 紙のベージュ地 / 黒鉛の文字 / 青写真の青 (構造) / 苔緑 (支持) / オーカー (未確定) / 朱 (反証)
export const PAPER_BG = "#f4efe3";
export const PAPER_PANEL = "#faf6ec";
export const PAPER_BORDER = "#ccc2a8";
export const GRAPHITE = "#2c2b28";
export const GRAPHITE_MUTED = "#6b6656";
export const BLUEPRINT = "#2952a3";
export const MOSS = "#4a6b3d";
export const OCHRE = "#7d5a13";
export const VERMILION = "#b4402a";

export function rgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const KIND_LABEL: Record<TheoryNodeKind, string> = {
  concept: "概念",
  claim: "主張",
  measure: "測定",
  decision: "決定",
  source: "外部ソース",
  question: "未解決問い",
};

export type NodeShape = "circle" | "diamond" | "square" | "triangle" | "hexagon";

export const KIND_SHAPE: Record<TheoryNodeKind, NodeShape> = {
  concept: "circle",
  claim: "diamond",
  measure: "square",
  decision: "triangle",
  source: "hexagon",
  question: "circle",
};

// 種類は塗り色で瞬時に見分け、形でも同じ意味を担保する。
export const KIND_COLOR: Record<TheoryNodeKind, string> = {
  concept: "#315ca8",
  claim: "#a34555",
  measure: "#2f756a",
  decision: "#a2661e",
  source: "#6c5794",
  question: "#6f665a",
};

export const LAYER_LABEL: Record<TheoryNodeLayer, string> = {
  "cross-layer": "横断",
  evidence: "根拠層",
  diagnosis: "診断層",
  prediction: "予測層",
  decision: "決定層",
  institution: "制度層",
  portfolio: "ポートフォリオ層",
};

export const LAYER_ORDER: TheoryNodeLayer[] = [
  "cross-layer",
  "evidence",
  "diagnosis",
  "prediction",
  "decision",
  "institution",
  "portfolio",
];

export const STATUS_LABEL: Record<TheoryNodeStatus, string> = {
  established: "現行採用・資料存在",
  conditional: "条件付き",
  "design-choice": "設計選択",
  hypothesis: "仮説",
  refuted: "反証済み",
  unknown: "未解明",
};

export const RELATION_LABEL: Record<TheoryRelationType, string> = {
  defines: "定義する",
  supports: "支持する",
  challenges: "異議を唱える",
  refutes: "反証する",
  depends_on: "依存する",
  supersedes: "上書きする",
  operationalizes: "運用化する",
  tests: "検証する",
  raises: "論点を残す",
};

export const RELATION_COLOR: Record<TheoryRelationType, string> = {
  defines: MOSS,
  supports: MOSS,
  operationalizes: MOSS,
  challenges: OCHRE,
  refutes: VERMILION,
  depends_on: BLUEPRINT,
  supersedes: GRAPHITE_MUTED,
  tests: BLUEPRINT,
  raises: OCHRE,
};

export const SUPPORT_TYPES: TheoryRelationType[] = ["supports", "defines", "operationalizes"];
export const CHALLENGE_TYPES: TheoryRelationType[] = ["challenges", "refutes"];
export const STRUCTURAL_TYPES: TheoryRelationType[] = ["depends_on", "supersedes"];
export const TEST_TYPES: TheoryRelationType[] = ["tests"];
export const ISSUE_TYPES: TheoryRelationType[] = ["raises"];

// メモの役割: 選択ノードの内側へ積むメモがどう働くかのラベル。エッジではないので
// 向きや接続先ノードの既定値を持たない。9 relation のうち、向きが用途依存で
// 一律の既定値を決められない defines/depends_on/supersedes/operationalizes は
// メモの役割に出さず、既存の Cmd/Ctrl+click 直接接続 (9 relationすべて) から選ぶ。
export const MEMO_TYPE_OPTIONS: TheoryMemoType[] = [...THEORY_MEMO_TYPES];

export const MEMO_TYPE_LABEL: Record<TheoryMemoType, string> = {
  supports: "支持",
  challenges: "異議",
  refutes: "反証",
  raises: "論点",
  tests: "検証",
};

export const MEMO_TYPE_COLOR: Record<TheoryMemoType, string> = {
  supports: MOSS,
  challenges: OCHRE,
  refutes: VERMILION,
  raises: OCHRE,
  tests: BLUEPRINT,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseTheoryMapEdgeDto(value: unknown): TheoryMapEdge | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    typeof value.type !== "string" ||
    !(THEORY_RELATION_TYPES as readonly string[]).includes(value.type)
  ) return null;
  return {
    from: value.from,
    to: value.to,
    type: value.type as TheoryRelationType,
    id: typeof value.id === "string" ? value.id : null,
    note: typeof value.note === "string" ? value.note : null,
    editable: value.editable === true,
  };
}

export function parseTheoryMapMemoDto(value: unknown): TheoryMapMemo | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.nodeId !== "string" ||
    typeof value.memoType !== "string" ||
    !(THEORY_MEMO_TYPES as readonly string[]).includes(value.memoType) ||
    typeof value.body !== "string" ||
    typeof value.createdAt !== "string"
  ) return null;
  return {
    id: value.id,
    nodeId: value.nodeId,
    memoType: value.memoType as TheoryMemoType,
    body: value.body,
    createdAt: value.createdAt,
  };
}

/** safe fetch wrapper for /api/bzm/theory-map mutations: never throws on bad JSON, always returns a typed result. */
export async function callTheoryMapApi(input: {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: string;
}): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(`/api/bzm/theory-map${input.query ?? ""}`, {
      method: input.method,
      headers: input.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
    });
  } catch {
    return { ok: false, error: "通信に失敗しました。ネットワーク接続を確認してください。" };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || !isRecord(payload) || payload.ok !== true) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : "サーバーとの通信に失敗しました。";
    return { ok: false, error: message };
  }

  return { ok: true, payload };
}
