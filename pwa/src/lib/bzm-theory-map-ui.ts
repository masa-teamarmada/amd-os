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
import { THEORY_RELATION_TYPES } from "@/lib/bzm-theory-graph";

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

// メモ追加 (grow) 用: 役割として選べる5種。支持・異議・反証・未解決論点・検証に絞る。
// defines/depends_on/supersedes/operationalizes は方向が用途依存で一律の既定値を
// 決められないため、メモ役割には出さず、既存の Cmd/Ctrl+click 直接接続から選ぶ。
export const RELATION_ROLE_OPTIONS: TheoryRelationType[] = [
  "supports",
  "challenges",
  "refutes",
  "raises",
  "tests",
];

/** メモの役割 (relation type) から、新規ノードの既定 kind/layer/status を決める。 */
export function relationRoleDefaults(relationType: TheoryRelationType): {
  kind: TheoryNodeKind;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
} {
  if (relationType === "raises") {
    return { kind: "question", layer: "cross-layer", status: "unknown" };
  }
  return { kind: "source", layer: "evidence", status: "established" };
}

/**
 * メモの役割から接続の向きの既定値を決める。raises だけ「選択ノードが新規の問いを生む」
 * (selected -> new) で、それ以外は「新規メモが選択ノードへ向く」(new -> selected)。
 * メモ役割の選択肢は supports/challenges/refutes/raises/tests の5種に限るため、
 * 向きが用途依存で決めがたい defines/depends_on/supersedes/operationalizes は
 * この関数の対象外 (Cmd/Ctrl+click 直接接続でユーザーが都度向きを選ぶ)。
 */
export function relationDirection(
  relationType: TheoryRelationType,
): "outgoing" | "incoming" {
  return relationType === "raises" ? "incoming" : "outgoing";
}

/** メモ本文の先頭行、または安全な短縮からノード内部タイトルを派生する。 */
export function deriveNoteTitle(memo: string): string {
  const firstLine = memo
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "新しいメモ";
  return firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine;
}

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
