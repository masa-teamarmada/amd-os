"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  KiyoMoneyFlowInflowProject,
  KiyoMoneyFlowOutflowCategory,
  KiyoMoneyFlowMemberRow,
} from "@/lib/finance/kiyo-money-flow-types";
import { formatManYen, formatYen, formatYmLabel } from "./format";

function Bar({ ratio, tone }: { ratio: number; tone: "in" | "out" }) {
  return (
    <div className="h-2 w-full rounded-none bg-muted">
      <div
        className={cn("h-2 rounded-none", tone === "in" ? "bg-emerald-500" : "bg-amber-500")}
        style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
      />
    </div>
  );
}

function MemberDrilldown({ row }: { row: KiyoMoneyFlowMemberRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border/60 py-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs"
      >
        <span className="font-medium text-foreground">{row.memberName}</span>
        <span className="text-muted-foreground">{formatYen(row.amountYen)}</span>
      </button>
      {open ? (
        <div className="mt-1 space-y-0.5 pl-3 text-[11px] text-muted-foreground">
          {row.projectBreakdown.length === 0 ? (
            <p>この期間の発生ベース内訳データが無い。</p>
          ) : (
            row.projectBreakdown.map((p, i) => (
              <div key={`${p.projectId}-${p.ym}-${i}`} className="flex justify-between">
                <span>
                  {formatYmLabel(p.ym)} {p.projectName}
                </span>
                <span>{formatYen(p.totalPayYen)}（めやす）</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function CategoryDrilldown({ category }: { category: KiyoMoneyFlowOutflowCategory }) {
  if (category.key === "member_reward") {
    return (
      <div className="mt-2">
        {category.rows.length === 0 ? <p className="text-xs text-muted-foreground">この期間の実振込記録が無い。</p> : null}
        {category.rows.map((row) => (
          <MemberDrilldown key={row.memberId} row={row} />
        ))}
      </div>
    );
  }
  if (category.key === "executive_pay") {
    return (
      <div className="mt-2 space-y-1 text-xs">
        {category.rows.map((row) => (
          <div key={row.ym} className="flex justify-between border-t border-border/60 py-1">
            <span className="text-muted-foreground">{formatYmLabel(row.ym)}</span>
            <span>{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (category.key === "social_insurance_tax") {
    return (
      <div className="mt-2 space-y-1 text-xs">
        {category.rows.map((row, i) => (
          <div key={`${row.title}-${i}`} className="flex justify-between border-t border-border/60 py-1">
            <span className="text-muted-foreground">
              {row.title}
              {row.date ? `（${row.date}）` : ""}
            </span>
            <span>{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (category.key === "opex") {
    return (
      <div className="mt-2 space-y-1 text-xs">
        {category.rows.map((row) => (
          <div key={row.accountName} className="flex justify-between border-t border-border/60 py-1">
            <span className="text-muted-foreground">{row.accountName}</span>
            <span>{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1 text-xs">
      {category.rows.map((row, i) => (
        <div key={`${row.vendorName}-${i}`} className="flex justify-between border-t border-border/60 py-1">
          <span className="text-muted-foreground">
            {row.vendorName}（月額{formatYen(row.monthlyAmountYen)} × {row.monthsCounted}か月）
          </span>
          <span>{formatYen(row.amountYen)}</span>
        </div>
      ))}
    </div>
  );
}

function InflowProjectRow({
  project,
  maxYen,
  isOpen,
  onToggle,
}: {
  project: KiyoMoneyFlowInflowProject;
  maxYen: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div id={`mf-row-in-${project.projectId}`} className="border-t border-border/60 py-2 first:border-t-0">
      <button type="button" onClick={onToggle} className="flex w-full flex-col gap-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {project.projectName}
            {project.clientName ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">（{project.clientName}）</span> : null}
          </span>
          <span className="text-sm tabular-nums text-emerald-700 dark:text-emerald-400">{formatManYen(project.totalYen)}</span>
        </div>
        <Bar ratio={maxYen > 0 ? project.totalYen / maxYen : 0} tone="in" />
      </button>
      {isOpen ? (
        <div className="mt-2 space-y-1 pl-1 text-xs">
          {project.months.map((m, i) => (
            <div key={`${m.ym}-${m.kind}-${i}`} className="flex justify-between border-t border-border/60 py-1">
              <span className="text-muted-foreground">
                {formatYmLabel(m.ym)}分
                {m.kind === "extra" ? "（別財布）" : ""}
                {m.confirmedAt ? `・入金確認 ${m.confirmedAt.slice(0, 10)}` : ""}
              </span>
              <span>{formatYen(m.amountYen)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OutflowCategoryRow({
  category,
  maxYen,
  isOpen,
  onToggle,
}: {
  category: KiyoMoneyFlowOutflowCategory;
  maxYen: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div id={`mf-row-out-${category.key}`} className="border-t border-border/60 py-2 first:border-t-0">
      <button type="button" onClick={onToggle} className="flex w-full flex-col gap-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{category.label}</span>
          <span className="text-sm tabular-nums text-amber-700 dark:text-amber-400">{formatManYen(category.totalYen)}</span>
        </div>
        <Bar ratio={maxYen > 0 ? category.totalYen / maxYen : 0} tone="out" />
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">{category.note}</p>
      {isOpen ? <CategoryDrilldown category={category} /> : null}
    </div>
  );
}

export function KiyoMoneyFlowSteps({
  inflowProjects,
  outflowCategories,
  walletBalanceYen,
  walletBalanceYm,
  netChangeYen,
  loanRemainingYen,
  expanded,
  onToggle,
}: {
  inflowProjects: KiyoMoneyFlowInflowProject[];
  outflowCategories: KiyoMoneyFlowOutflowCategory[];
  walletBalanceYen: number | null;
  walletBalanceYm: string | null;
  netChangeYen: number;
  loanRemainingYen: number | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const maxInflow = inflowProjects.reduce((max, p) => Math.max(max, p.totalYen), 0);
  const maxOutflow = outflowCategories.reduce((max, c) => Math.max(max, c.totalYen), 0);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <section className="rounded-none border border-border bg-background p-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">1 入ってきたお金</h3>
        <div className="mt-1">
          {inflowProjects.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">この期間の入金確認済みデータが無い。</p>
          ) : (
            inflowProjects.map((project) => (
              <InflowProjectRow
                key={project.projectId}
                project={project}
                maxYen={maxInflow}
                isOpen={expanded.has(`in-${project.projectId}`)}
                onToggle={() => onToggle(`in-${project.projectId}`)}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-none border border-border bg-background p-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">2 AMDの財布</h3>
        <div className="mt-3 flex flex-col items-center justify-center gap-1 py-4">
          <span className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-400">
            {walletBalanceYen != null ? formatManYen(walletBalanceYen) : "同期待ち"}
          </span>
          <span className="text-[11px] text-muted-foreground">{walletBalanceYm ? `${formatYmLabel(walletBalanceYm)}時点の残高` : "freee同期待ち"}</span>
        </div>
        <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">この期間の増減</span>
            <span className={cn("tabular-nums", netChangeYen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
              {netChangeYen >= 0 ? "+" : ""}
              {formatManYen(netChangeYen)}
            </span>
          </div>
          {loanRemainingYen != null ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">借りているお金の残り</span>
              <span className="tabular-nums">{formatManYen(loanRemainingYen)}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-none border border-border bg-background p-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">3 使ったお金</h3>
        <div className="mt-1">
          {outflowCategories.map((category) => (
            <OutflowCategoryRow
              key={category.key}
              category={category}
              maxYen={maxOutflow}
              isOpen={expanded.has(`out-${category.key}`)}
              onToggle={() => onToggle(`out-${category.key}`)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
