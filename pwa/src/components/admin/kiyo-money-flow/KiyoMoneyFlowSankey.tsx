"use client";

/**
 * 実寸固定のコンパクトな流れ図。ウィンドウを広げても図は拡大せず、
 * 余った幅は隣のカードと下の内訳表が使う (情報密度ルール)。
 * 見せるのは損益: 売上がどこから来て、何に使われて、いくら残ったか。
 */
import { useMemo } from "react";
import type { KiyoMoneyFlowCostGroup, KiyoMoneyFlowRevenueRow } from "@/lib/finance/kiyo-money-flow-types";
import { cn } from "@/lib/utils";
import { formatManYen } from "./format";
import { SANKEY_VIEW_WIDTH, SANKEY_NODE_WIDTH, layoutColumn, makePortAllocator, linkPath, linkStrokeWidth, spreadLabelYs, type SankeyNodeLayout } from "./sankey-layout";

const COLUMN_HEIGHT = 190;
const COLUMN_TOP = 8;
const BOTTOM_PAD = 8;
const LEFT_LABEL_RIGHT = 196;
const LEFT_NODE_X = 200;
const CENTER_W = 90;
const CENTER_X = (SANKEY_VIEW_WIDTH - CENTER_W) / 2;
const RIGHT_NODE_X = CENTER_X + CENTER_W + 99;
const RIGHT_LABEL_LEFT = RIGHT_NODE_X + SANKEY_NODE_WIDTH + 6;
const NAME_MAX_CHARS = 13;

function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS - 1)}…` : name;
}

export function KiyoMoneyFlowSankey({
  revenueByPartner,
  costGroups,
  profitYen,
  onSelectCost,
}: {
  revenueByPartner: KiyoMoneyFlowRevenueRow[];
  costGroups: KiyoMoneyFlowCostGroup[];
  profitYen: number;
  onSelectCost: (key: string) => void;
}) {
  const revenueTotal = revenueByPartner.reduce((sum, row) => sum + row.amountYen, 0);
  const rightItems = useMemo(() => {
    const items: Array<{ id: string; label: string; value: number }> = costGroups
      .filter((group) => group.amountYen > 0)
      .map((group) => ({ id: String(group.key), label: group.label, value: group.amountYen }));
    if (profitYen > 0) items.push({ id: "__profit__", label: "残ったお金", value: profitYen });
    return items;
  }, [costGroups, profitYen]);
  const rightTotal = rightItems.reduce((sum, item) => sum + item.value, 0);

  const layout = useMemo(() => {
    const scaleTotal = Math.max(revenueTotal, rightTotal, 1);
    const leftNodes = layoutColumn(
      revenueByPartner.map((row) => ({ id: `in-${row.name}`, label: row.name, value: row.amountYen })),
      LEFT_NODE_X,
      COLUMN_HEIGHT,
      scaleTotal,
    );
    const rightNodes = layoutColumn(
      rightItems.map((item) => ({ id: `out-${item.id}`, label: item.label, value: item.value })),
      RIGHT_NODE_X,
      COLUMN_HEIGHT,
      scaleTotal,
    );
    const centerNode: SankeyNodeLayout = { id: "center", label: "AMD", value: scaleTotal, x: CENTER_X, y: 0, height: COLUMN_HEIGHT };
    const columnBottom = (nodes: SankeyNodeLayout[]) => nodes.reduce((max, n) => Math.max(max, n.y + n.height), 0);
    const contentHeight = Math.max(columnBottom(leftNodes), columnBottom(rightNodes), COLUMN_HEIGHT);

    const inAllocator = makePortAllocator([centerNode]);
    const outAllocator = makePortAllocator([{ ...centerNode }]);

    const inflowLinks = revenueByPartner
      .filter((row) => row.amountYen > 0)
      .map((row) => {
        const sourceNode = leftNodes.find((n) => n.id === `in-${row.name}`);
        if (!sourceNode) return null;
        return {
          id: `in-${row.name}`,
          sourceX: sourceNode.x + SANKEY_NODE_WIDTH,
          sourceY: sourceNode.y + sourceNode.height / 2,
          targetX: CENTER_X,
          targetY: inAllocator("center", row.amountYen, scaleTotal, COLUMN_HEIGHT),
          width: linkStrokeWidth(row.amountYen, scaleTotal, COLUMN_HEIGHT),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const outflowLinks = rightItems
      .map((item) => {
        const targetNode = rightNodes.find((n) => n.id === `out-${item.id}`);
        if (!targetNode) return null;
        return {
          id: `out-${item.id}`,
          key: item.id,
          sourceX: CENTER_X + CENTER_W,
          sourceY: outAllocator("center", item.value, scaleTotal, COLUMN_HEIGHT),
          targetX: targetNode.x,
          targetY: targetNode.y + targetNode.height / 2,
          width: linkStrokeWidth(item.value, scaleTotal, COLUMN_HEIGHT),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    return {
      leftNodes,
      rightNodes,
      centerNode,
      inflowLinks,
      outflowLinks,
      contentHeight,
      leftLabelYs: spreadLabelYs(leftNodes, 13, COLUMN_HEIGHT),
      rightLabelYs: spreadLabelYs(rightNodes, 13, COLUMN_HEIGHT),
    };
  }, [revenueByPartner, rightItems, revenueTotal, rightTotal]);

  const viewHeight = COLUMN_TOP + layout.contentHeight + BOTTOM_PAD;

  return (
    <svg viewBox={`0 0 ${SANKEY_VIEW_WIDTH} ${viewHeight}`} width={SANKEY_VIEW_WIDTH} height={viewHeight} className="shrink-0" role="img" aria-label="事業のもうけの流れ図">
      <g transform={`translate(0, ${COLUMN_TOP})`}>
        {layout.inflowLinks.map((link) => (
          <path
            key={link.id}
            d={linkPath(link.sourceX, link.sourceY, link.targetX, link.targetY)}
            stroke="currentColor"
            className="text-emerald-500/35 dark:text-emerald-400/30"
            strokeWidth={link.width}
            fill="none"
          />
        ))}
        {layout.outflowLinks.map((link) => (
          <path
            key={link.id}
            d={linkPath(link.sourceX, link.sourceY, link.targetX, link.targetY)}
            stroke="currentColor"
            className={cn("cursor-pointer", link.key === "__profit__" ? "text-sky-500/35 hover:text-sky-500/60" : "text-amber-500/35 hover:text-amber-500/60 dark:text-amber-400/30")}
            strokeWidth={link.width}
            fill="none"
            onClick={() => onSelectCost(link.key)}
          />
        ))}

        {layout.leftNodes.map((node, index) => (
          <g key={node.id}>
            <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={node.height} className="fill-emerald-600/85 dark:fill-emerald-500/85" rx={1.5} />
            <text x={LEFT_LABEL_RIGHT} y={layout.leftLabelYs[index]} textAnchor="end" dominantBaseline="central" className="fill-foreground text-[11px]">
              <tspan className="fill-muted-foreground">{truncateName(node.label)}</tspan>
              <tspan className="font-semibold tabular-nums" dx={5}>{formatManYen(node.value)}</tspan>
            </text>
          </g>
        ))}

        <g>
          <rect x={layout.centerNode.x} y={layout.centerNode.y} width={CENTER_W} height={layout.centerNode.height} className="fill-sky-600/85 dark:fill-sky-500/85" rx={2} />
          <text x={layout.centerNode.x + CENTER_W / 2} y={layout.centerNode.y + layout.centerNode.height / 2 - 8} textAnchor="middle" className="fill-white text-[11px] font-medium">
            売上
          </text>
          <text x={layout.centerNode.x + CENTER_W / 2} y={layout.centerNode.y + layout.centerNode.height / 2 + 8} textAnchor="middle" className="fill-white text-[13px] font-bold tabular-nums">
            {formatManYen(revenueTotal)}
          </text>
        </g>

        {layout.rightNodes.map((node, index) => {
          const key = node.id.replace("out-", "");
          return (
            <g key={node.id} className="cursor-pointer" onClick={() => onSelectCost(key)}>
              <rect
                x={node.x}
                y={node.y}
                width={SANKEY_NODE_WIDTH}
                height={node.height}
                className={cn(key === "__profit__" ? "fill-sky-600/85 dark:fill-sky-500/85" : "fill-amber-600/85 dark:fill-amber-500/85")}
                rx={1.5}
              />
              <text x={RIGHT_LABEL_LEFT} y={layout.rightLabelYs[index]} textAnchor="start" dominantBaseline="central" className="fill-foreground text-[11px]">
                <tspan className="fill-muted-foreground">{truncateName(node.label)}</tspan>
                <tspan className="font-semibold tabular-nums" dx={5}>{formatManYen(node.value)}</tspan>
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
