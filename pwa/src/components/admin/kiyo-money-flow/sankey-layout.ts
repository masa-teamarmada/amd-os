/**
 * お金の流れ (A案) の SVG レイアウト計算。純粋関数のみ、DOM/React 非依存。
 * 左=PJ別の入り、中央=AMDの財布、右=使い道5分類。実際のお金は fungible で
 * 「どのPJのお金が何に使われたか」は追跡できないため、帯は PJ→財布・財布→分類の
 * 2段構成にする (財布ノードを経由する典型的なサンキー形)。
 */

export const SANKEY_VIEW_WIDTH = 960;
export const SANKEY_NODE_WIDTH = 132;
export const SANKEY_GAP = 6;
export const SANKEY_MIN_NODE_HEIGHT = 16;

export type SankeyNodeInput = { id: string; label: string; value: number };

export type SankeyNodeLayout = {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  height: number;
};

export type SankeyLinkLayout = {
  id: string;
  sourceId: string;
  targetId: string;
  value: number;
  sourceY: number;
  targetY: number;
  height: number;
};

/** 1列のノードを縦に積む。値0は積まない (呼び出し側で除く想定)。 */
export function layoutColumn(nodes: SankeyNodeInput[], x: number, totalHeight: number): SankeyNodeLayout[] {
  const filtered = nodes.filter((n) => n.value > 0);
  const total = filtered.reduce((sum, n) => sum + n.value, 0);
  const gapTotal = SANKEY_GAP * Math.max(0, filtered.length - 1);
  const usable = Math.max(0, totalHeight - gapTotal);
  let y = 0;
  const out: SankeyNodeLayout[] = [];
  for (const node of filtered) {
    const raw = total > 0 ? (node.value / total) * usable : 0;
    const height = Math.max(SANKEY_MIN_NODE_HEIGHT, raw);
    out.push({ id: node.id, label: node.label, value: node.value, x, y, height });
    y += height + SANKEY_GAP;
  }
  return out;
}

/** ノード内でリンクが積み上がる縦位置を順番に払い出す。 */
export function makePortAllocator(nodes: SankeyNodeLayout[]) {
  const cursor = new Map(nodes.map((n) => [n.id, n.y]));
  return (nodeId: string, value: number, nodeValue: number, nodeHeight: number): number => {
    const start = cursor.get(nodeId) ?? 0;
    const portHeight = nodeValue > 0 ? (value / nodeValue) * nodeHeight : 0;
    cursor.set(nodeId, start + portHeight);
    return start + portHeight / 2;
  };
}

/** 2ノード間の帯パス (三次ベジェ)。y は帯の中心線。 */
export function linkPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

export function linkStrokeWidth(value: number, nodeValue: number, nodeHeight: number): number {
  if (nodeValue <= 0) return 0;
  return Math.max(1.5, (value / nodeValue) * nodeHeight);
}
