"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
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

const VIEW_HEIGHT = 460;
const COLUMN_HEIGHT = 400;
const COLUMN_TOP = 20;
const LEFT_X = 8;
const CENTER_X = (SANKEY_VIEW_WIDTH - SANKEY_NODE_WIDTH) / 2;
const RIGHT_X = SANKEY_VIEW_WIDTH - SANKEY_NODE_WIDTH - 8;

const yen0k = formatManYen;

export function KiyoMoneyFlowSankey({
  inflowProjects,
  outflowCategories,
  walletBalanceYen,
  walletBalanceYm,
  netChangeYen,
  onSelectProject,
  onSelectCategory,
}: {
  inflowProjects: KiyoMoneyFlowInflowProject[];
  outflowCategories: KiyoMoneyFlowOutflowCategory[];
  walletBalanceYen: number | null;
  walletBalanceYm: string | null;
  netChangeYen: number;
  onSelectProject: (projectId: string) => void;
  onSelectCategory: (key: string) => void;
}) {
  const inflowTotal = inflowProjects.reduce((sum, p) => sum + p.totalYen, 0);
  const outflowTotal = outflowCategories.reduce((sum, c) => sum + c.totalYen, 0);
  const shortfallYen = Math.max(0, outflowTotal - inflowTotal);

  const layout = useMemo(() => {
    const leftNodes = layoutColumn(
      inflowProjects.map((p) => ({ id: `in-${p.projectId}`, label: p.clientName ? `${p.projectName}（${p.clientName}）` : p.projectName, value: p.totalYen })),
      LEFT_X,
      COLUMN_HEIGHT,
    );
    const rightNodes = layoutColumn(
      outflowCategories.map((c) => ({ id: `out-${c.key}`, label: c.label, value: Math.max(c.totalYen, 1) })),
      RIGHT_X,
      COLUMN_HEIGHT,
    );
    const walletNode: SankeyNodeLayout = { id: "wallet", label: "AMDの財布", value: Math.max(inflowTotal, outflowTotal, 1), x: CENTER_X, y: 0, height: COLUMN_HEIGHT };

    const inAllocator = makePortAllocator([{ ...walletNode, value: inflowTotal || 1 }]);
    const outAllocator = makePortAllocator([{ ...walletNode, value: outflowTotal || 1 }]);

    const inflowLinks = inflowProjects
      .filter((p) => p.totalYen > 0)
      .map((p) => {
        const sourceNode = leftNodes.find((n) => n.id === `in-${p.projectId}`);
        if (!sourceNode) return null;
        const targetY = inAllocator("wallet", p.totalYen, inflowTotal || 1, COLUMN_HEIGHT);
        return {
          id: `in-${p.projectId}`,
          sourceX: sourceNode.x + SANKEY_NODE_WIDTH,
          sourceY: sourceNode.y + sourceNode.height / 2,
          targetX: CENTER_X,
          targetY,
          width: linkStrokeWidth(p.totalYen, inflowTotal || 1, COLUMN_HEIGHT),
          projectId: p.projectId,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const outflowLinks = outflowCategories
      .filter((c) => c.totalYen > 0)
      .map((c) => {
        const targetNode = rightNodes.find((n) => n.id === `out-${c.key}`);
        if (!targetNode) return null;
        const sourceY = outAllocator("wallet", c.totalYen, outflowTotal || 1, COLUMN_HEIGHT);
        return {
          id: `out-${c.key}`,
          sourceX: CENTER_X + SANKEY_NODE_WIDTH,
          sourceY,
          targetX: targetNode.x,
          targetY: targetNode.y + targetNode.height / 2,
          width: linkStrokeWidth(c.totalYen, outflowTotal || 1, COLUMN_HEIGHT),
          key: c.key,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    return { leftNodes, rightNodes, walletNode, inflowLinks, outflowLinks };
  }, [inflowProjects, outflowCategories, inflowTotal, outflowTotal]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${SANKEY_VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full min-w-[720px]"
        style={{ height: "auto" }}
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
              <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={node.height} className="fill-emerald-600/80 dark:fill-emerald-500/80" rx={2} />
              <text x={node.x} y={node.y - 4} className="fill-foreground text-[10px] font-medium">
                <tspan>{node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}</tspan>
              </text>
              <text x={node.x} y={node.y + node.height / 2 + 3} className="fill-white text-[10px] font-semibold" textAnchor="start" dx={4}>
                {node.height >= 18 ? yen0k(node.value) : ""}
              </text>
            </g>
          ))}

          <g>
            <rect x={layout.walletNode.x} y={layout.walletNode.y} width={SANKEY_NODE_WIDTH} height={layout.walletNode.height} className="fill-sky-600/80 dark:fill-sky-500/80" rx={2} />
            <text x={layout.walletNode.x + SANKEY_NODE_WIDTH / 2} y={layout.walletNode.y + layout.walletNode.height / 2 - 10} textAnchor="middle" className="fill-white text-[11px] font-semibold">
              AMDの財布
            </text>
            <text x={layout.walletNode.x + SANKEY_NODE_WIDTH / 2} y={layout.walletNode.y + layout.walletNode.height / 2 + 8} textAnchor="middle" className="fill-white text-[13px] font-bold">
              {walletBalanceYen != null ? yen0k(walletBalanceYen) : "同期待ち"}
            </text>
            <text x={layout.walletNode.x + SANKEY_NODE_WIDTH / 2} y={layout.walletNode.y + layout.walletNode.height / 2 + 22} textAnchor="middle" className="fill-white/80 text-[9px]">
              {walletBalanceYm ? `${walletBalanceYm.slice(0, 4)}年${walletBalanceYm.slice(4, 6)}月時点` : ""}
            </text>
          </g>

          {layout.rightNodes.map((node, index) => (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => onSelectCategory(outflowCategories[index]?.key ?? node.id.replace("out-", ""))}
            >
              <rect x={node.x} y={node.y} width={SANKEY_NODE_WIDTH} height={node.height} className="fill-amber-600/80 dark:fill-amber-500/80" rx={2} />
              <text x={node.x} y={node.y - 4} className="fill-foreground text-[10px] font-medium">
                {node.label}
              </text>
              <text x={node.x} y={node.y + node.height / 2 + 3} className="fill-white text-[10px] font-semibold" textAnchor="start" dx={4}>
                {node.height >= 18 ? yen0k(node.value) : ""}
              </text>
            </g>
          ))}

          {shortfallYen > 0 ? (
            <g transform={`translate(${CENTER_X}, ${COLUMN_HEIGHT + 16})`}>
              <rect
                x={0}
                y={0}
                width={SANKEY_NODE_WIDTH}
                height={28}
                className="fill-transparent stroke-amber-500 dark:stroke-amber-400"
                strokeDasharray="4 3"
                rx={2}
              />
              <text x={SANKEY_NODE_WIDTH / 2} y={18} textAnchor="middle" className="fill-amber-600 dark:fill-amber-400 text-[9px]">
                {yen0k(shortfallYen)}は財布の残りから
              </text>
            </g>
          ) : null}
        </g>
      </svg>
      <p className={cn("mt-1 text-[10px] text-muted-foreground", netChangeYen < 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
        この期間の増減: {netChangeYen >= 0 ? "+" : ""}
        {yen0k(netChangeYen)}
      </p>
    </div>
  );
}
