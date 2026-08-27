"use client";
// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。


import { useMemo } from "react";
import type { KiyoMoneyFlowInflowProject, KiyoMoneyFlowOutflowCategory } from "@/lib/finance/kiyo-money-flow-types";
import { formatManYen } from "./format";
import {
  SANKEY_VIEW_WIDTH,
  SANKEY_NODE_WIDTH,
  layoutColumn,
  makePortAllocator,
  linkPath,
  linkStrokeWidth,
  type SankeyNodeLayout,
} from "./sankey-layout";

/**
 * 実寸固定のコンパクトな流れ図。ウィンドウを広げても図は拡大せず、
 * 余った幅は隣の財布パネルと下の内訳表が使う (情報密度ルール)。
 * ノードは細い棒 (16px)、ラベルは棒の外側横に「名前 金額」1行で置く。
 */
const COLUMN_HEIGHT = 190;
const COLUMN_TOP = 8;
const BOTTOM_PAD = 8;
const LEFT_LABEL_RIGHT = 196;
const LEFT_NODE_X = 200;
const WALLET_W = 90;
const WALLET_X = (SANKEY_VIEW_WIDTH - WALLET_W) / 2;
const RIGHT_NODE_X = WALLET_X + WALLET_W + 99;
const RIGHT_LABEL_LEFT = RIGHT_NODE_X + SANKEY_NODE_WIDTH + 6;
const NAME_MAX_CHARS = 13;

function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS - 1)}…` : name;
}

export function KiyoMoneyFlowSankey({
  inflowProjects,
  outflowCategories,
  walletBalanceYen,
  onSelectProject,
  onSelectCategory,
}: {
  inflowProjects: KiyoMoneyFlowInflowProject[];
  outflowCategories: KiyoMoneyFlowOutflowCategory[];
  walletBalanceYen: number | null;
  onSelectProject: (projectId: string) => void;
  onSelectCategory: (key: string) => void;
}) {
  const inflowTotal = inflowProjects.reduce((sum, p) => sum + p.totalYen, 0);
  const outflowTotal = outflowCategories.reduce((sum, c) => sum + c.totalYen, 0);

  const layout = useMemo(() => {
    // 全列共通の縮尺: 大きい側の合計が COLUMN_HEIGHT に収まる。帯幅=ノード高さが厳密に一致する。
    const scaleTotal = Math.max(inflowTotal, outflowTotal, 1);
    const leftNodes = layoutColumn(
      inflowProjects.map((p) => ({ id: `in-${p.projectId}`, label: p.clientName ? `${p.projectName}（${p.clientName}）` : p.projectName, value: p.totalYen })),
      LEFT_NODE_X,
      COLUMN_HEIGHT,
      scaleTotal,
    );
    const rightNodes = layoutColumn(
      outflowCategories.map((c) => ({ id: `out-${c.key}`, label: c.label, value: Math.max(c.totalYen, 1) })),
      RIGHT_NODE_X,
      COLUMN_HEIGHT,
      scaleTotal,
    );
    const columnBottom = (nodes: SankeyNodeLayout[]) => nodes.reduce((max, n) => Math.max(max, n.y + n.height), 0);
    // 財布は総量ノード (高さ = scaleTotal ぶん)。入りが出より少ない期間は、財布下部に
    // 入り帯の无い領域が残る = 財布の残りから出した分が視覚的に見える。
    const walletNode: SankeyNodeLayout = { id: "wallet", label: "AMDの財布", value: scaleTotal, x: WALLET_X, y: 0, height: COLUMN_HEIGHT };
    const contentHeight = Math.max(columnBottom(leftNodes), columnBottom(rightNodes), COLUMN_HEIGHT);

    const inAllocator = makePortAllocator([walletNode]);
    const outAllocator = makePortAllocator([{ ...walletNode }]);

    const inflowLinks = inflowProjects
      .filter((p) => p.totalYen > 0)
      .map((p) => {
        const sourceNode = leftNodes.find((n) => n.id === `in-${p.projectId}`);
        if (!sourceNode) return null;
        const targetY = inAllocator("wallet", p.totalYen, scaleTotal, COLUMN_HEIGHT);
        return {
          id: `in-${p.projectId}`,
          sourceX: sourceNode.x + SANKEY_NODE_WIDTH,
          sourceY: sourceNode.y + sourceNode.height / 2,
          targetX: WALLET_X,
          targetY,
          width: linkStrokeWidth(p.totalYen, scaleTotal, COLUMN_HEIGHT),
          projectId: p.projectId,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const outflowLinks = outflowCategories
      .filter((c) => c.totalYen > 0)
      .map((c) => {
        const targetNode = rightNodes.find((n) => n.id === `out-${c.key}`);
        if (!targetNode) return null;
        const sourceY = outAllocator("wallet", c.totalYen, scaleTotal, COLUMN_HEIGHT);
        return {
          id: `out-${c.key}`,
          sourceX: WALLET_X + WALLET_W,
          sourceY,
          targetX: targetNode.x,
          targetY: targetNode.y + targetNode.height / 2,
          width: linkStrokeWidth(c.totalYen, scaleTotal, COLUMN_HEIGHT),
          key: c.key,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    return { leftNodes, rightNodes, walletNode, inflowLinks, outflowLinks, contentHeight };
  }, [inflowProjects, outflowCategories, inflowTotal, outflowTotal]);

  const viewHeight = COLUMN_TOP + layout.contentHeight + BOTTOM_PAD;

  return (
    <svg
      viewBox={`0 0 ${SANKEY_VIEW_WIDTH} ${viewHeight}`}
      width={SANKEY_VIEW_WIDTH}
      height={viewHeight}
      className="shrink-0"
      role="img"
      aria-label="お金の流れ図"
    >
      <g transform={`translate(0, ${COLUMN_TOP})`}>
        {layout.inflowLinks.map((link) => (
          <path
            key={link.id}
            d={linkPath(link.sourceX, link.sourceY, link.targetX, link.targetY)}
            stroke="currentColor"
            className="cursor-pointer text-emerald-500/35 hover:text-emerald-500/60 dark:text-emerald-400/30 dark:hover:text-emerald-400/55"
            strokeWidth={link.width}
            fill="none"
            onClick={() => onSelectProject(link.projectId)}
          />
        ))}
        {layout.outflowLinks.map((link) => (
          <path
            key={link.id}
            d={linkPath(link.sourceX, link.sourceY, link.targetX, link.targetY)}
            stroke="currentColor"
            className="cursor-pointer text-amber-500/35 hover:text-amber-500/60 dark:text-amber-400/30 dark:hover:text-amber-400/55"
            strokeWidth={link.width}
            fill="none"
            onClick={() => onSelectCategory(link.key)}
          />
        ))}

        {layout.leftNodes.map((node, index) => (
          <g
            key={node.id}
            className="cursor-pointer"
            onClick={() => onSelectProject(inflowProjects[index]?.projectId ?? node.id.replace("in-", ""))}
          >
            <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={node.height} className="fill-emerald-600/85 dark:fill-emerald-500/85" rx={1.5} />
            <text x={LEFT_LABEL_RIGHT} y={node.y + node.height / 2} textAnchor="end" dominantBaseline="central" className="fill-foreground text-[11px]">
              <tspan className="fill-muted-foreground">{truncateName(node.label)}</tspan>
              <tspan className="font-semibold tabular-nums" dx={5}>{formatManYen(node.value)}</tspan>
            </text>
          </g>
        ))}

        <g>
          <rect x={layout.walletNode.x} y={layout.walletNode.y} width={WALLET_W} height={layout.walletNode.height} className="fill-sky-600/85 dark:fill-sky-500/85" rx={2} />
          <text x={layout.walletNode.x + WALLET_W / 2} y={layout.walletNode.y + layout.walletNode.height / 2 - 8} textAnchor="middle" className="fill-white text-[11px] font-medium">
            AMDの財布
          </text>
          <text x={layout.walletNode.x + WALLET_W / 2} y={layout.walletNode.y + layout.walletNode.height / 2 + 8} textAnchor="middle" className="fill-white text-[13px] font-bold tabular-nums">
            {walletBalanceYen != null ? formatManYen(walletBalanceYen) : "同期待ち"}
          </text>
        </g>

        {layout.rightNodes.map((node, index) => (
          <g
            key={node.id}
            className="cursor-pointer"
            onClick={() => onSelectCategory(outflowCategories[index]?.key ?? node.id.replace("out-", ""))}
          >
            <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={node.height} className="fill-amber-600/85 dark:fill-amber-500/85" rx={1.5} />
            <text x={RIGHT_LABEL_LEFT} y={node.y + node.height / 2} textAnchor="start" dominantBaseline="central" className="fill-foreground text-[11px]">
              <tspan className="fill-muted-foreground">{truncateName(node.label)}</tspan>
              <tspan className="font-semibold tabular-nums" dx={5}>{formatManYen(node.value)}</tspan>
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
