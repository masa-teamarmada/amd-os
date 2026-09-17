/**
 * ビジネスモデルのピクト図（「ビジネスモデル・ピクト図解」の形）の定義・検査・配置。
 *
 * 本文 (Markdown) の ```pictogram ブロックに JSON で書き、MarkdownView が PictogramDiagram で描く。
 * 3×3 の枠に「ヒト」（自社・企業・工場・大学・個人・店）を置き、モノの流れ（青）とお金の流れ（橙・¥の印）を
 * 別の矢印で結ぶ（2026-09-17 まさ「ビジネスモデルは、ちゃんとピクト図にしてほしい。カネとモノの流れを示す矢印は
 * それぞれ別の色にして、カネのところはお金っぽいアイコンを添えて」）。
 *
 * 配置は純関数。矢印の添え書きは、枠・ほかの矢印・ほかの添え書きに重ならない位置を候補から選び、
 * 重なりが残ったものは collisions に数える。契約チェック (scripts/check_pictogram.mts) が 0 件を確かめる。
 * 仕様: pwa/spec/3-20-project-technology-current-spec.md §5.6
 */

export const PICTOGRAM_CELLS = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"] as const;
export type PictogramCell = (typeof PICTOGRAM_CELLS)[number];

/** ヒトの種類。self は事業の主体（真ん中に置く自社）。 */
export const PICTOGRAM_ICONS = ["self", "company", "factory", "university", "person", "shop"] as const;
export type PictogramIcon = (typeof PICTOGRAM_ICONS)[number];

export type PictogramFlowKind = "goods" | "money";

export const PICTOGRAM_FLOW_LABEL: Record<PictogramFlowKind, string> = {
  goods: "モノ・サービス",
  money: "お金",
};

export interface PictogramNode {
  id: string;
  cell: PictogramCell;
  icon: PictogramIcon;
  label: string;
  note: string | null;
  /** 計画中・条件未定のヒト。枠を破線で描く。 */
  planned: boolean;
}

export interface PictogramFlow {
  from: string;
  to: string;
  kind: PictogramFlowKind;
  label: string;
  /** 計画中・条件未定の流れ。どちらかのヒトが planned でも破線になる。 */
  planned: boolean;
}

export interface Pictogram {
  nodes: PictogramNode[];
  flows: PictogramFlow[];
}

export type PictogramParse = { ok: true; pictogram: Pictogram } | { ok: false; error: string };

export const PICTOGRAM_NODE_LABEL_MAX = 10;
export const PICTOGRAM_NODE_NOTE_MAX = 22;
export const PICTOGRAM_FLOW_LABEL_MAX = 24;
const MAX_FLOWS = 40;
/** 1組のヒトのあいだに引ける矢印の本数。これを超えると枠の高さに収まらない。 */
const MAX_LANES = 3;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function pairKey(a: string, b: string): string {
  return JSON.stringify(a < b ? [a, b] : [b, a]);
}

/** ```pictogram の JSON を読む。読めないときは理由を返し、画面は元の文をそのまま出す。 */
export function parsePictogram(source: string): PictogramParse {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return { ok: false, error: "JSON として読めない" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "全体は { \"nodes\": [...], \"flows\": [...] } の形にする" };
  }
  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.nodes) || root.nodes.length === 0) return { ok: false, error: "nodes（ヒト）が1つもない" };
  if (root.nodes.length > PICTOGRAM_CELLS.length) {
    return { ok: false, error: `ヒトは ${PICTOGRAM_CELLS.length} つまで（3×3 の枠）` };
  }
  const flowsRaw = root.flows === undefined ? [] : root.flows;
  if (!Array.isArray(flowsRaw)) return { ok: false, error: "flows（流れ）は配列にする" };
  if (flowsRaw.length > MAX_FLOWS) return { ok: false, error: `流れは ${MAX_FLOWS} 本まで` };

  const nodes: PictogramNode[] = [];
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const [i, item] of root.nodes.entries()) {
    if (!item || typeof item !== "object") return { ok: false, error: `nodes[${i}] が形になっていない` };
    const n = item as Record<string, unknown>;
    const id = text(n.id);
    const label = text(n.label);
    const cell = text(n.cell);
    const icon = text(n.icon) ?? "company";
    if (!id) return { ok: false, error: `nodes[${i}] に id がない` };
    if (ids.has(id)) return { ok: false, error: `id「${id}」が重なっている` };
    if (!label) return { ok: false, error: `「${id}」に label（名前）がない` };
    if ([...label].length > PICTOGRAM_NODE_LABEL_MAX) {
      return { ok: false, error: `「${id}」の名前は ${PICTOGRAM_NODE_LABEL_MAX} 字まで` };
    }
    if (!cell || !(PICTOGRAM_CELLS as readonly string[]).includes(cell)) {
      return { ok: false, error: `「${id}」の cell は ${PICTOGRAM_CELLS.join(" / ")} のどれか` };
    }
    if (cells.has(cell)) return { ok: false, error: `cell「${cell}」に2つのヒトを置いている` };
    if (!(PICTOGRAM_ICONS as readonly string[]).includes(icon)) {
      return { ok: false, error: `「${id}」の icon は ${PICTOGRAM_ICONS.join(" / ")} のどれか` };
    }
    const note = text(n.note);
    if (note && [...note].length > PICTOGRAM_NODE_NOTE_MAX) {
      return { ok: false, error: `「${id}」の補足は ${PICTOGRAM_NODE_NOTE_MAX} 字まで` };
    }
    ids.add(id);
    cells.add(cell);
    nodes.push({ id, cell: cell as PictogramCell, icon: icon as PictogramIcon, label, note, planned: n.planned === true });
  }

  const plannedNode = new Set(nodes.filter((n) => n.planned).map((n) => n.id));
  const lanes = new Map<string, number>();
  const flows: PictogramFlow[] = [];
  for (const [i, item] of flowsRaw.entries()) {
    if (!item || typeof item !== "object") return { ok: false, error: `flows[${i}] が形になっていない` };
    const f = item as Record<string, unknown>;
    const from = text(f.from);
    const to = text(f.to);
    const kind = text(f.kind);
    const label = text(f.label);
    if (!from || !ids.has(from)) return { ok: false, error: `flows[${i}] の from「${from ?? ""}」というヒトがいない` };
    if (!to || !ids.has(to)) return { ok: false, error: `flows[${i}] の to「${to ?? ""}」というヒトがいない` };
    if (from === to) return { ok: false, error: `flows[${i}] が同じヒトへ戻っている` };
    if (kind !== "goods" && kind !== "money") {
      return { ok: false, error: `flows[${i}] の kind は goods（モノ）か money（お金）` };
    }
    if (!label) return { ok: false, error: `flows[${i}] に label（何が流れるか）がない` };
    if ([...label].length > PICTOGRAM_FLOW_LABEL_MAX) {
      return { ok: false, error: `flows[${i}] の label は ${PICTOGRAM_FLOW_LABEL_MAX} 字まで` };
    }
    const key = pairKey(from, to);
    const count = (lanes.get(key) ?? 0) + 1;
    if (count > MAX_LANES) return { ok: false, error: `同じ2者のあいだの流れは ${MAX_LANES} 本まで（flows[${i}]）` };
    lanes.set(key, count);
    flows.push({ from, to, kind, label, planned: f.planned === true || plannedNode.has(from) || plannedNode.has(to) });
  }
  return { ok: true, pictogram: { nodes, flows } };
}

// ---------------------------------------------------------------- 配置

export const PICTOGRAM_WIDTH = 1000;
export const PICTOGRAM_HEIGHT = 680;
export const PICTOGRAM_CARD_W = 148;
export const PICTOGRAM_SELF_CARD_W = 168;
export const PICTOGRAM_CARD_H = 108;
export const PICTOGRAM_LABEL_FONT = 11;
export const PICTOGRAM_LABEL_LINE = 15;
/** 添え書きの頭に付ける印（モノの箱・お金の ¥）の幅と、その後ろの間隔。 */
export const PICTOGRAM_LABEL_ICON = 20;
/** 添え書きの左右の余白の合計と、上下の余白の合計（どちらも枠線 1px ずつを含む）。 */
export const PICTOGRAM_LABEL_PAD_X = 10;
export const PICTOGRAM_LABEL_PAD_Y = 6;
/** 行の折り返しで字がはみ出さないための余裕。 */
const LABEL_SLACK = 3;
/** 矢印の線から添え書きまでの間隔。 */
const LABEL_GAP = 5;
/** 矢印の端とヒトの枠の間隔。 */
const ARROW_GAP = 6;
/** 線の上に置く添え書きの両脇に残す、矢印の見える長さ。 */
const CENTER_LABEL_MARGIN = 20;
/** 添え書きとほかの矢印・添え書きの間隔。LABEL_CLEARANCE までは広いほどよく、LABEL_CLEARANCE_MIN より狭いと重なりに数える。 */
const LABEL_CLEARANCE = 20;
const LABEL_CLEARANCE_MIN = 3;

export type PictogramLabelAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface PictogramRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedPictogramNode {
  node: PictogramNode;
  cx: number;
  cy: number;
  rect: PictogramRect;
}

export interface PlacedPictogramFlow {
  flow: PictogramFlow;
  /** 矢印の始点（from 側）と終点（to 側・矢じり）。 */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 添え書きの箱。描画もこの箱の位置と大きさで行う。 */
  label: PictogramRect & { anchor: PictogramLabelAnchor; lines: number };
  /** 添え書きがほかの要素と重なった数（0 が正常）。 */
  collisions: number;
}

export interface PictogramLayout {
  width: number;
  height: number;
  nodes: PlacedPictogramNode[];
  flows: PlacedPictogramFlow[];
  /** 矢印がほかのヒトの枠を横切った数（0 が正常）。 */
  laneCrossings: number;
}

const CELL_POS: Record<PictogramCell, [number, number]> = {
  tl: [0, 0], t: [1, 0], tr: [2, 0],
  l: [0, 1], c: [1, 1], r: [2, 1],
  bl: [0, 2], b: [1, 2], br: [2, 2],
};

/** 文字の幅の見積もり。全角は字の大きさ、半角はその 0.62 倍（大文字の英字でも足りる幅）。 */
export function estimateTextWidth(value: string, fontSize = PICTOGRAM_LABEL_FONT): number {
  let w = 0;
  for (const ch of value) w += /[\u0000-\u00ff]/.test(ch) ? fontSize * 0.62 : fontSize;
  return w;
}

/** 添え書きの箱の大きさ。maxWidth を超える文は折り返し、行頭禁則で1字早く折れる分も見込む。 */
export function estimateLabelBox(value: string, maxWidth: number): { w: number; h: number; lines: number } {
  const raw = estimateTextWidth(value);
  const inner = maxWidth - PICTOGRAM_LABEL_PAD_X - PICTOGRAM_LABEL_ICON - LABEL_SLACK;
  const lines = raw <= inner ? 1 : Math.ceil(raw / Math.max(PICTOGRAM_LABEL_FONT * 2, inner - PICTOGRAM_LABEL_FONT));
  const w = lines === 1 ? raw + PICTOGRAM_LABEL_ICON + LABEL_SLACK + PICTOGRAM_LABEL_PAD_X : maxWidth;
  return { w: Math.ceil(w), h: lines * PICTOGRAM_LABEL_LINE + PICTOGRAM_LABEL_PAD_Y, lines };
}

export function anchoredRect(x: number, y: number, w: number, h: number, anchor: PictogramLabelAnchor): PictogramRect {
  switch (anchor) {
    case "center": return { x: x - w / 2, y: y - h / 2, w, h };
    case "top": return { x: x - w / 2, y, w, h };
    case "bottom": return { x: x - w / 2, y: y - h, w, h };
    case "left": return { x, y: y - h / 2, w, h };
    case "right": return { x: x - w, y: y - h / 2, w, h };
    case "top-left": return { x, y, w, h };
    case "top-right": return { x: x - w, y, w, h };
    case "bottom-left": return { x, y: y - h, w, h };
    case "bottom-right": return { x: x - w, y: y - h, w, h };
  }
}

function grow(r: PictogramRect, m: number): PictogramRect {
  return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
}

export function rectsOverlap(a: PictogramRect, b: PictogramRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 線分が箱に触れるか（Liang–Barsky）。 */
export function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: PictogramRect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

function pointRectDistance(px: number, py: number, r: PictogramRect): number {
  return Math.hypot(Math.max(r.x - px, 0, px - (r.x + r.w)), Math.max(r.y - py, 0, py - (r.y + r.h)));
}

function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** 2つの箱の最短距離（重なれば 0）。 */
export function rectDistance(a: PictogramRect, b: PictogramRect): number {
  return Math.hypot(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

/** 線分と箱の最短距離（触れれば 0）。離れた凸図形の最短距離は、どちらかの頂点ともう一方の辺のあいだに出る。 */
export function segmentRectDistance(x1: number, y1: number, x2: number, y2: number, r: PictogramRect): number {
  if (segmentHitsRect(x1, y1, x2, y2, r)) return 0;
  let d = Math.min(pointRectDistance(x1, y1, r), pointRectDistance(x2, y2, r));
  for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) {
    d = Math.min(d, pointSegmentDistance(cx, cy, x1, y1, x2, y2));
  }
  return d;
}

/** 箱の中心から向き u へ進んで箱の縁を出る点（少し外へ離す）。 */
function exitPoint(box: PlacedPictogramNode, sx: number, sy: number, ux: number, uy: number) {
  const hw = box.rect.w / 2;
  const hh = box.rect.h / 2;
  const tx = Math.abs(ux) < 1e-9 ? Infinity : (hw - Math.sign(ux) * (sx - box.cx)) / Math.abs(ux);
  const ty = Math.abs(uy) < 1e-9 ? Infinity : (hh - Math.sign(uy) * (sy - box.cy)) / Math.abs(uy);
  const t = Math.min(tx, ty) + ARROW_GAP;
  return { x: sx + ux * t, y: sy + uy * t };
}

interface Lane {
  flow: PictogramFlow;
  count: number;
  length: number;
  offset: number;
  /** 組の先頭 (a) 側から b 側への線分。 */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  nx: number;
  ny: number;
  orientation: "h" | "v" | "d";
  /** 2つの枠のあいだの空き（横並びなら横幅、縦並びなら高さ、斜めなら中心間の距離）。 */
  span: number;
}

/** 添え書きを置く位置の候補（矢印の長さに対する割合）。 */
const T_CANDIDATES = Array.from({ length: 25 }, (_, i) => 0.14 + i * 0.03);

function laneGap(count: number): number {
  return count >= 3 ? 40 : 34;
}

const ROW_Y = [PICTOGRAM_CARD_H / 2 + 8, PICTOGRAM_HEIGHT / 2, PICTOGRAM_HEIGHT - PICTOGRAM_CARD_H / 2 - 8];

/** 3×3 の枠の区切り線の位置（縦線の x と横線の y）。 */
export function pictogramGridLines(): { xs: number[]; ys: number[] } {
  return {
    xs: [PICTOGRAM_WIDTH / 3, (PICTOGRAM_WIDTH * 2) / 3],
    ys: [(ROW_Y[0] + ROW_Y[1]) / 2, (ROW_Y[1] + ROW_Y[2]) / 2],
  };
}

export function layoutPictogram(p: Pictogram): PictogramLayout {
  const width = PICTOGRAM_WIDTH;
  const height = PICTOGRAM_HEIGHT;
  const colW = width / 3;

  const placed = new Map<string, PlacedPictogramNode>();
  for (const node of p.nodes) {
    const [col, row] = CELL_POS[node.cell];
    const w = node.icon === "self" ? PICTOGRAM_SELF_CARD_W : PICTOGRAM_CARD_W;
    const cx = colW * col + colW / 2;
    const cy = ROW_Y[row];
    placed.set(node.id, { node, cx, cy, rect: { x: cx - w / 2, y: cy - PICTOGRAM_CARD_H / 2, w, h: PICTOGRAM_CARD_H } });
  }

  // 同じ2者のあいだの流れは、書いた順に平行の矢印にする
  const pairs = new Map<string, PictogramFlow[]>();
  for (const f of p.flows) {
    const key = pairKey(f.from, f.to);
    pairs.set(key, [...(pairs.get(key) ?? []), f]);
  }

  const lanes: Lane[] = [];
  const arrows = new Map<PictogramFlow, { x1: number; y1: number; x2: number; y2: number }>();
  for (const [key, list] of pairs) {
    const [aId, bId] = JSON.parse(key) as [string, string];
    const a = placed.get(aId)!;
    const b = placed.get(bId)!;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const orientation = Math.abs(uy) < 1e-6 ? "h" : Math.abs(ux) < 1e-6 ? "v" : "d";
    // 先に書いた流れほど上（縦並びなら左）の矢印にする。id の並びに左右されないよう法線の向きをそろえる
    const flip = orientation === "v" ? uy > 0 : ux < 0;
    const nx = flip ? uy : -uy;
    const ny = flip ? -ux : ux;
    const span = orientation === "h"
      ? Math.abs(dx) - (a.rect.w + b.rect.w) / 2
      : orientation === "v"
        ? Math.abs(dy) - (a.rect.h + b.rect.h) / 2
        : len;
    const gap = laneGap(list.length);
    list.forEach((flow, index) => {
      const offset = (index - (list.length - 1) / 2) * gap;
      const p1 = exitPoint(a, a.cx + nx * offset, a.cy + ny * offset, ux, uy);
      const p2 = exitPoint(b, b.cx + nx * offset, b.cy + ny * offset, -ux, -uy);
      const length = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      lanes.push({ flow, count: list.length, length, offset, ax: p1.x, ay: p1.y, bx: p2.x, by: p2.y, nx, ny, orientation, span });
      arrows.set(flow, flow.from === aId ? { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y } : { x1: p2.x, y1: p2.y, x2: p1.x, y2: p1.y });
    });
  }

  let laneCrossings = 0;
  for (const lane of lanes) {
    for (const node of placed.values()) {
      if (node.node.id === lane.flow.from || node.node.id === lane.flow.to) continue;
      if (segmentHitsRect(lane.ax, lane.ay, lane.bx, lane.by, grow(node.rect, 2))) laneCrossings += 1;
    }
  }

  const cards = [...placed.values()].map((n) => grow(n.rect, 4));
  const bounds: PictogramRect = { x: 2, y: 2, w: width - 4, h: height - 4 };
  const labels = new Map<Lane, PlacedPictogramFlow["label"] & { collisions: number }>();
  const placedBoxes: PictogramRect[] = [];

  const blocked = (box: PictogramRect): boolean =>
    box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h
    || cards.some((c) => rectsOverlap(box, c));
  /** 箱と、ほかの矢印・置いた添え書きとの最短距離（重なれば 0）。 */
  const clearanceOf = (box: PictogramRect, own: Lane): number => {
    let d = Infinity;
    for (const other of placedBoxes) d = Math.min(d, rectDistance(box, other));
    for (const lane of lanes) {
      if (lane !== own) d = Math.min(d, segmentRectDistance(lane.ax, lane.ay, lane.bx, lane.by, box));
    }
    return d;
  };

  const candidatesFor = (lane: Lane) => {
    const out: { x: number; y: number; t: number; side: number; anchor: PictogramLabelAnchor; maxWidth: number }[] = [];
    const sideMax = lane.orientation === "h" ? Math.max(72, Math.min(170, lane.span - 10)) : lane.orientation === "v" ? 132 : 150;
    // 線の上に置くときは、両脇に矢印（矢じりを含む）が見える幅に抑える
    const centerMax = Math.max(72, Math.min(sideMax, lane.length - CENTER_LABEL_MARGIN * 2));
    // 真ん中の矢印は線の上に、ほかは矢印の外側に置く。1本だけの組は線の上と両脇を比べる
    const sides = lane.offset === 0 ? (lane.count === 1 ? [0, 1, -1] : [0]) : [Math.sign(lane.offset)];
    for (const side of sides) {
      for (const t of T_CANDIDATES) {
        const px = lane.ax + (lane.bx - lane.ax) * t;
        const py = lane.ay + (lane.by - lane.ay) * t;
        if (side === 0) {
          out.push({ x: px, y: py, t, side, anchor: "center", maxWidth: centerMax });
          continue;
        }
        const dirx = side * lane.nx;
        const diry = side * lane.ny;
        const x = px + dirx * LABEL_GAP;
        const y = py + diry * LABEL_GAP;
        let anchor: PictogramLabelAnchor;
        if (lane.orientation === "d") anchor = `${diry < 0 ? "bottom" : "top"}-${dirx > 0 ? "left" : "right"}` as PictogramLabelAnchor;
        else if (lane.orientation === "h") anchor = diry < 0 ? "bottom" : "top";
        else anchor = dirx > 0 ? "left" : "right";
        out.push({ x, y, t, side, anchor, maxWidth: sideMax });
      }
    }
    return out;
  };

  // 狭いところ（矢印の多い組・横並び）から先に置く
  const rank = (l: Lane) => (l.orientation === "h" ? 0 : l.orientation === "v" ? 1 : 2);
  const order = lanes
    .map((lane, i) => ({ lane, i }))
    .sort((x, y) => y.lane.count - x.lane.count || rank(x.lane) - rank(y.lane) || x.i - y.i)
    .map(({ lane }) => lane);
  for (const lane of order) {
    let best: (PlacedPictogramFlow["label"] & { collisions: number }) | null = null;
    let bestScore = -Infinity;
    for (const c of candidatesFor(lane)) {
      const size = estimateLabelBox(lane.flow.label, c.maxWidth);
      const box = anchoredRect(c.x, c.y, size.w, size.h, c.anchor);
      const isBlocked = blocked(box);
      const clear = isBlocked ? -1 : clearanceOf(box, lane);
      // ほかの矢印・添え書きから LABEL_CLEARANCE まで離れているほどよい（自分の矢印の 5px よりはっきり遠くないと、
      // どの矢印の添え書きか読み違える）。同じなら矢印の真ん中に近く、1本だけの組は線の上をとる
      const score = Math.min(clear, LABEL_CLEARANCE) * 100 - Math.abs(c.t - 0.5) * 10 - (c.side === 0 ? 0 : 0.5);
      if (score > bestScore) {
        bestScore = score;
        best = { ...box, anchor: c.anchor, lines: size.lines, collisions: (isBlocked ? 1 : 0) + (clear < LABEL_CLEARANCE_MIN ? 1 : 0) };
      }
    }
    labels.set(lane, best!);
    placedBoxes.push(best!);
  }

  const flows: PlacedPictogramFlow[] = lanes.map((lane) => {
    const { collisions, ...label } = labels.get(lane)!;
    return { flow: lane.flow, ...arrows.get(lane.flow)!, label, collisions };
  });
  // 書いた順に並べ直す（読み上げと検査の順をそろえる）
  flows.sort((f1, f2) => p.flows.indexOf(f1.flow) - p.flows.indexOf(f2.flow));
  return { width, height, nodes: [...placed.values()], flows, laneCrossings };
}

/** 画面の読み上げ・狭い画面の一覧・契約チェック用に、流れを1行の文にする。 */
export function describePictogramFlow(p: Pictogram, f: PictogramFlow): string {
  const name = (id: string) => p.nodes.find((n) => n.id === id)?.label ?? id;
  return `${name(f.from)} → ${name(f.to)}：${f.label}${f.planned ? "（これから）" : ""}`;
}
