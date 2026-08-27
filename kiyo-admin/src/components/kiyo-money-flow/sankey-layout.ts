// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。

/**
 * お金の流れ (A案) の SVG レイアウト計算。純粋関数のみ、DOM/React 非依存。
 * 左=PJ別の入り、中央=AMDの財布、右=使い道5分類。実際のお金は fungible で
 * 「どのPJのお金が何に使われたか」は追跡できないため、帯は PJ→財布・財布→分類の
 * 2段構成にする (財布ノードを経由する典型的なサンキー形)。
 */

/**
 * 実寸表示が前提 (SVG は width 実寸固定・拡大禁止)。幅いっぱいに伸ばすと
 * 文字と余白だけが膨らんで情報密度が落ちるため、コンテナ側で max-w-full 縮小のみ許す。
 * ノードは細い棒、ラベルは棒の外側横 (d3-sankey 標準形)。
 */
export const SANKEY_VIEW_WIDTH = 720;
export const SANKEY_NODE_WIDTH = 16;
export const SANKEY_GAP = 5;
export const SANKEY_MIN_NODE_HEIGHT = 2;

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

/**
 * 1列のノードを縦に積む。値0は積まない (呼び出し側で除く想定)。
 * 高さは (value / scaleTotal) × scaleHeight — 全列で同じ縮尺 (円→px) を使い、
 * 帯の太さ (linkStrokeWidth) と厳密に一致させる。列ごとの正規化はしない
 * (列内正規化にすると帯幅の基準とズレて、帯がノードからはみ出す)。
 */
export function layoutColumn(nodes: SankeyNodeInput[], x: number, scaleHeight: number, scaleTotal: number): SankeyNodeLayout[] {
  const filtered = nodes.filter((n) => n.value > 0);
  let y = 0;
  const out: SankeyNodeLayout[] = [];
  for (const node of filtered) {
    const raw = scaleTotal > 0 ? (node.value / scaleTotal) * scaleHeight : 0;
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

/**
 * ラベルの縦位置。ノード中心を基準にしつつ、隣のラベルと minGap 未満なら押し下げる。
 * 金額が極端に小さいノードが連続すると、ノード中心のままではラベルが重なるため。
 */
export function spreadLabelYs(nodes: SankeyNodeLayout[], minGap: number, bottomLimit: number): number[] {
  const ys = nodes.map((n) => n.y + n.height / 2);
  for (let i = 1; i < ys.length; i += 1) {
    if (ys[i] - ys[i - 1] < minGap) ys[i] = ys[i - 1] + minGap;
  }
  const overflow = ys.length > 0 ? ys[ys.length - 1] - bottomLimit : 0;
  if (overflow > 0) {
    for (let i = ys.length - 1; i >= 0; i -= 1) {
      ys[i] -= overflow;
      if (i > 0 && ys[i] - ys[i - 1] >= minGap) break;
    }
  }
  return ys;
}
