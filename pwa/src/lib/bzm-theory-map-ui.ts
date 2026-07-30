/**
 * Shared palette, labels and view-model types for the BZM theory map UI
 * (BzmTheoryMapView + BzmTheoryComposerDialog). Kept in one module with no
 * "use client" component exports so both client components can import it
 * without creating a circular dependency between them.
 */

import type {
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
  editable: boolean;
}

export interface TheoryMapEdge {
  from: string;
  to: string;
  type: TheoryRelationType;
  id: string | null;
  note: string | null;
  editable: boolean;
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

export const KIND_MARK: Record<TheoryNodeKind, string> = {
  concept: "概",
  claim: "主",
  measure: "測",
  decision: "決",
  source: "源",
  question: "問",
};

export type NodeShape = "circle" | "diamond" | "square" | "triangle" | "hexagon" | "circle-dashed";

export const KIND_SHAPE: Record<TheoryNodeKind, NodeShape> = {
  concept: "circle",
  claim: "diamond",
  measure: "square",
  decision: "triangle",
  source: "hexagon",
  question: "circle-dashed",
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

export const STATUS_COLOR: Record<TheoryNodeStatus, string> = {
  established: MOSS,
  conditional: BLUEPRINT,
  "design-choice": GRAPHITE,
  hypothesis: OCHRE,
  refuted: VERMILION,
  unknown: OCHRE,
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

  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

  if (!res.ok || !isRecord(payload) || payload.ok !== true) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : "サーバーとの通信に失敗しました。";
    return { ok: false, error: message };
  }

  return { ok: true, payload };
}
