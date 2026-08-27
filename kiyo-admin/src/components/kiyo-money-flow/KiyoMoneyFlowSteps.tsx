"use client";
// ⚠️ pwa/src/components/admin/kiyo-money-flow/ からのコピー。正本は pwa 側。
// これは「見せ方」だけの部品で、金額の計算は一切していない（数字は本体のAPIが返した値）。
// なのでズレても金額事故にはならないが、図の見た目が本体と食い違う。
// 本体側を直したらここも同じ内容にする。独自の見た目をここで足さないこと。


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
    <div className="h-1.5 w-full rounded-none bg-muted">
      <div
        className={cn("h-1.5 rounded-none", tone === "in" ? "bg-emerald-500" : "bg-amber-500")}
        style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
      />
    </div>
  );
}

function SectionHeader({ step, label, totalYen, tone }: { step: string; label: string; totalYen: number; tone: "in" | "out" | "wallet" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
        {step} {label}
      </h3>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "in" && "text-emerald-700 dark:text-emerald-400",
          tone === "out" && "text-amber-700 dark:text-amber-400",
          tone === "wallet" && "text-sky-700 dark:text-sky-400",
        )}
      >
        {formatManYen(totalYen)}
      </span>
    </div>
  );
}

function MemberDrilldown({ row }: { row: KiyoMoneyFlowMemberRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-1 text-left text-xs hover:bg-muted/40"
      >
        <span className="text-foreground">{row.memberName}</span>
        <span className="tabular-nums text-muted-foreground">{formatYen(row.amountYen)}</span>
      </button>
      {open ? (
        <div className="space-y-0.5 pb-1 pl-3 text-[11px] text-muted-foreground">
          {row.projectBreakdown.length === 0 ? (
            <p>この期間の発生ベース内訳データが無い。</p>
          ) : (
            row.projectBreakdown.map((p, i) => (
              <div key={`${p.projectId}-${p.ym}-${i}`} className="flex justify-between">
                <span>
                  {formatYmLabel(p.ym)} {p.projectName}
                </span>
                <span className="tabular-nums">{formatYen(p.totalPayYen)}（めやす）</span>
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
      <div className="mt-1">
        {category.rows.length === 0 ? <p className="text-xs text-muted-foreground">この期間の実振込記録が無い。</p> : null}
        {category.rows.map((row) => (
          <MemberDrilldown key={row.memberId} row={row} />
        ))}
      </div>
    );
  }
  if (category.key === "executive_pay") {
    return (
      <div className="mt-1 text-xs">
        {category.rows.map((row) => (
          <div key={row.ym} className="flex justify-between border-t border-border/60 py-1">
            <span className="text-muted-foreground">{formatYmLabel(row.ym)}</span>
            <span className="tabular-nums">{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (category.key === "social_insurance_tax") {
    return (
      <div className="mt-1 text-xs">
        {category.rows.map((row, i) => (
          <div key={`${row.title}-${i}`} className="flex justify-between gap-2 border-t border-border/60 py-1">
            <span className="min-w-0 truncate text-muted-foreground">
              {row.title}
              {row.date ? `（${row.date}）` : ""}
            </span>
            <span className="shrink-0 tabular-nums">{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (category.key === "opex") {
    return (
      <div className="mt-1 text-xs">
        {category.rows.map((row) => (
          <div key={row.accountName} className="flex justify-between border-t border-border/60 py-1">
            <span className="text-muted-foreground">{row.accountName}</span>
            <span className="tabular-nums">{formatYen(row.amountYen)}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-1 text-xs">
      {category.rows.map((row, i) => (
        <div key={`${row.vendorName}-${i}`} className="flex justify-between gap-2 border-t border-border/60 py-1">
          <span className="min-w-0 text-muted-foreground">
            {row.vendorName}（月額{formatYen(row.monthlyAmountYen)} × {row.monthsCounted}か月）
          </span>
          <span className="shrink-0 tabular-nums">{formatYen(row.amountYen)}</span>
        </div>
      ))}
    </div>
  );
}

export function KiyoMoneyFlowInflowCard({
  inflowProjects,
  expanded,
  onToggle,
}: {
  inflowProjects: KiyoMoneyFlowInflowProject[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const maxInflow = inflowProjects.reduce((max, p) => Math.max(max, p.totalYen), 0);
  const totalYen = inflowProjects.reduce((sum, p) => sum + p.totalYen, 0);
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader step="1" label="入ってきたお金" totalYen={totalYen} tone="in" />
      {inflowProjects.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">この期間の入金確認済みデータが無い。</p>
      ) : (
        inflowProjects.map((project) => {
          const isOpen = expanded.has(`in-${project.projectId}`);
          return (
            <div id={`mf-row-in-${project.projectId}`} key={project.projectId} className="border-t border-border/60 py-1.5 first:border-t-0">
              <button type="button" onClick={() => onToggle(`in-${project.projectId}`)} className="flex w-full flex-col gap-1 text-left">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                    {project.projectName}
                    {project.clientName ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">（{project.clientName}）</span> : null}
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-emerald-700 dark:text-emerald-400">{formatManYen(project.totalYen)}</span>
                </div>
                <Bar ratio={maxInflow > 0 ? project.totalYen / maxInflow : 0} tone="in" />
              </button>
              {isOpen ? (
                <div className="mt-1 text-xs">
                  {project.months.map((m, i) => (
                    <div key={`${m.ym}-${m.kind}-${i}`} className="flex justify-between gap-2 border-t border-border/60 py-1">
                      <span className="min-w-0 text-muted-foreground">
                        {formatYmLabel(m.ym)}分{m.kind === "extra" ? "（別財布）" : ""}
                        {m.confirmedAt ? `・入金確認 ${m.confirmedAt.slice(0, 10)}` : ""}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatYen(m.amountYen)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
      <p className="mt-1 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">請求書のうち入金を確認できたものだけを数えている。</p>
    </section>
  );
}

export function KiyoMoneyFlowWalletCard({
  walletBalanceYen,
  walletBalanceYm,
  inflowTotalYen,
  outflowTotalYen,
  netChangeYen,
  loanRemainingYen,
}: {
  walletBalanceYen: number | null;
  walletBalanceYm: string | null;
  inflowTotalYen: number;
  outflowTotalYen: number;
  netChangeYen: number;
  loanRemainingYen: number | null;
}) {
  const shortfallYen = Math.max(0, -netChangeYen);
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader step="2" label="AMDの財布" totalYen={walletBalanceYen ?? 0} tone="wallet" />
      <dl className="text-xs">
        <div className="flex justify-between border-t border-border/60 py-1 first:border-t-0">
          <dt className="text-muted-foreground">いまの残高</dt>
          <dd className="tabular-nums">{walletBalanceYen != null ? `${formatManYen(walletBalanceYen)}（${formatYmLabel(walletBalanceYm)}時点）` : "freee同期待ち"}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="text-muted-foreground">この期間に入ったお金</dt>
          <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatManYen(inflowTotalYen)}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="text-muted-foreground">この期間に使ったお金</dt>
          <dd className="tabular-nums text-amber-700 dark:text-amber-400">{formatManYen(outflowTotalYen)}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="text-muted-foreground">差引</dt>
          <dd className={cn("tabular-nums", netChangeYen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {netChangeYen >= 0 ? "+" : "▲"}
            {formatManYen(Math.abs(netChangeYen))}
            {shortfallYen > 0 ? "（財布の残りから出した分）" : ""}
          </dd>
        </div>
        {loanRemainingYen != null ? (
          <div className="flex justify-between border-t border-border/60 py-1">
            <dt className="text-muted-foreground">借りているお金の残り</dt>
            <dd className="tabular-nums">{formatManYen(loanRemainingYen)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function KiyoMoneyFlowOutflowCard({
  outflowCategories,
  expanded,
  onToggle,
}: {
  outflowCategories: KiyoMoneyFlowOutflowCategory[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const maxOutflow = outflowCategories.reduce((max, c) => Math.max(max, c.totalYen), 0);
  const totalYen = outflowCategories.reduce((sum, c) => sum + c.totalYen, 0);
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader step="3" label="使ったお金" totalYen={totalYen} tone="out" />
      {outflowCategories.map((category) => {
        const isOpen = expanded.has(`out-${category.key}`);
        return (
          <div id={`mf-row-out-${category.key}`} key={category.key} className="border-t border-border/60 py-1.5 first:border-t-0">
            <button type="button" onClick={() => onToggle(`out-${category.key}`)} className="flex w-full flex-col gap-1 text-left">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{category.label}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-amber-700 dark:text-amber-400">{formatManYen(category.totalYen)}</span>
              </div>
              <Bar ratio={maxOutflow > 0 ? category.totalYen / maxOutflow : 0} tone="out" />
            </button>
            {isOpen ? (
              <>
                <p className="mt-1 text-[11px] text-muted-foreground">{category.note}</p>
                <CategoryDrilldown category={category} />
              </>
            ) : null}
          </div>
        );
      })}
      <p className="mt-1 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">
        銀行から実際に出たお金・支払いを確認できた記録・freeeの仕訳から数えている。
      </p>
    </section>
  );
}
