"use client";

/**
 * きよ「00 お金の流れ」の内訳表。左=売上がどこから、右=何に使ったか、別枠で口座のお金。
 * 情報密度を落とさないため、カードのグリッドではなく密な行リストで出す。
 */
import { cn } from "@/lib/utils";
import type {
  KiyoMoneyFlowCostGroup,
  KiyoMoneyFlowMonthRow,
  KiyoMoneyFlowRevenueRow,
} from "@/lib/finance/kiyo-money-flow-types";
import { formatManYen, formatYen, formatYmLabel } from "./format";

function Bar({ ratio, tone }: { ratio: number; tone: "in" | "out" }) {
  return (
    <div className="h-1.5 w-full rounded-none bg-muted">
      <div
        className={cn("h-1.5 rounded-none", tone === "in" ? "bg-emerald-500" : "bg-amber-500")}
        style={{ width: `${ratio <= 0 ? 0 : Math.max(2, Math.min(100, ratio * 100))}%` }}
      />
    </div>
  );
}

function SectionHeader({ label, totalYen, tone, suffix }: { label: string; totalYen: number; tone: "in" | "out" | "wallet"; suffix?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 border-b border-border pb-1">
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "in" && "text-emerald-700 dark:text-emerald-400",
          tone === "out" && "text-amber-700 dark:text-amber-400",
          tone === "wallet" && "text-sky-700 dark:text-sky-400",
        )}
      >
        {formatManYen(totalYen)}
        {suffix ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">{suffix}</span> : null}
      </span>
    </div>
  );
}

export function KiyoMoneyFlowRevenueCard({
  revenueByPartner,
  revenueTotalYen,
  otherIncomeYen,
}: {
  revenueByPartner: KiyoMoneyFlowRevenueRow[];
  revenueTotalYen: number;
  otherIncomeYen: number;
}) {
  const max = revenueByPartner.reduce((m, row) => Math.max(m, row.amountYen), 0);
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader label="売上（どこから）" totalYen={revenueTotalYen + otherIncomeYen} tone="in" />
      {revenueByPartner.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">この期間、freee会計に計上された売上がまだ無い。請求書を発行すると立つ。</p>
      ) : (
        revenueByPartner.map((row) => (
          <div key={row.name} className="border-t border-border/60 py-1.5 first:border-t-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[13px] text-foreground">{row.name}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-emerald-700 dark:text-emerald-400">{formatManYen(row.amountYen)}</span>
            </div>
            <Bar ratio={max > 0 ? row.amountYen / max : 0} tone="in" />
          </div>
        ))
      )}
      {otherIncomeYen > 0 ? (
        <div className="flex justify-between border-t border-border/60 py-1 text-xs text-muted-foreground">
          <span>受取利息・雑収入</span>
          <span className="tabular-nums">{formatYen(otherIncomeYen)}</span>
        </div>
      ) : null}
      <p className="mt-1 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">税抜。freee会計の収入取引を取引先ごとに集計している。</p>
    </section>
  );
}

export function KiyoMoneyFlowCostCard({
  costGroups,
  costTotalYen,
  expanded,
  onToggle,
}: {
  costGroups: KiyoMoneyFlowCostGroup[];
  costTotalYen: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const max = costGroups.reduce((m, group) => Math.max(m, group.amountYen), 0);
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader label="費用（何に使ったか）" totalYen={costTotalYen} tone="out" />
      {costGroups.map((group) => {
        const isOpen = expanded.has(`cost-${group.key}`);
        return (
          <div id={`mf-row-cost-${group.key}`} key={group.key} className="border-t border-border/60 py-1.5 first:border-t-0">
            <button type="button" onClick={() => onToggle(`cost-${group.key}`)} className="flex w-full flex-col gap-1 text-left">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{group.label}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-amber-700 dark:text-amber-400">{formatManYen(group.amountYen)}</span>
              </div>
              <Bar ratio={max > 0 ? group.amountYen / max : 0} tone="out" />
            </button>
            {isOpen ? (
              <div className="mt-1 text-xs">
                <p className="text-[11px] text-muted-foreground">{group.note}</p>
                {group.rows.map((row) => (
                  <div key={row.name} className="flex justify-between border-t border-border/60 py-1">
                    <span className="text-muted-foreground">{row.name}</span>
                    <span className="tabular-nums">{formatYen(row.amountYen)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="mt-1 border-t border-border/60 pt-1 text-[11px] text-muted-foreground">freee会計の試算表。法人税の納付や借入の返済は費用ではないのでここには入らない。</p>
    </section>
  );
}

export function KiyoMoneyFlowCashCard({
  inflowYen,
  outflowYen,
  netYen,
  balanceYen,
  balanceYm,
  profitYen,
  complete,
}: {
  inflowYen: number;
  outflowYen: number;
  netYen: number;
  balanceYen: number | null;
  balanceYm: string | null;
  profitYen: number;
  complete: boolean;
}) {
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <SectionHeader label="口座のお金（もうけとは別）" totalYen={balanceYen ?? 0} tone="wallet" suffix={balanceYm ? `${formatYmLabel(balanceYm)}末の残高` : undefined} />
      <dl className="text-xs">
        <div className="flex justify-between border-t border-border/60 py-1 first:border-t-0">
          <dt className="text-muted-foreground">口座に入ったお金</dt>
          <dd className="tabular-nums text-emerald-700 dark:text-emerald-400">{formatManYen(inflowYen)}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="text-muted-foreground">口座から出たお金</dt>
          <dd className="tabular-nums text-amber-700 dark:text-amber-400">{formatManYen(outflowYen)}</dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="font-medium text-foreground">口座の増減</dt>
          <dd className={cn("font-medium tabular-nums", netYen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {netYen >= 0 ? "+" : "▲"}
            {formatManYen(Math.abs(netYen))}
          </dd>
        </div>
        <div className="flex justify-between border-t border-border/60 py-1">
          <dt className="text-muted-foreground">事業のもうけ（参考）</dt>
          <dd className={cn("tabular-nums", profitYen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {profitYen >= 0 ? "+" : "▲"}
            {formatManYen(Math.abs(profitYen))}
          </dd>
        </div>
      </dl>
      <p className="mt-1 border-t border-border/60 pt-1 text-[11px] leading-snug text-muted-foreground">
        もうけと口座の増減がずれるのは、入金が後から来る／口座から出るが費用でないもの（前年の税金・立替の返済・カードの引き落とし）がある／費用だがまだ出ていないもの（翌月25日払いの役員報酬）があるため。
        {complete ? "" : " この期間は取引履歴がそろっていない月がある。"}
      </p>
    </section>
  );
}

export function KiyoMoneyFlowMonthlyTable({ monthly }: { monthly: KiyoMoneyFlowMonthRow[] }) {
  if (monthly.length === 0) return null;
  return (
    <section className="rounded-none border border-border bg-background p-2.5">
      <div className="mb-1.5 border-b border-border pb-1 text-[13px] font-semibold text-foreground">月ごとの推移</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="py-1 text-left font-normal">月</th>
              <th className="py-1 text-right font-normal">売上</th>
              <th className="py-1 text-right font-normal">費用</th>
              <th className="py-1 text-right font-normal">もうけ</th>
              <th className="py-1 text-right font-normal">口座の増減</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.ym} className="border-t border-border/60">
                <td className="py-1 text-left">
                  {formatYmLabel(row.ym)}
                  {row.officerPayMissing ? <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">役員報酬未計上</span> : null}
                </td>
                <td className="py-1 text-right text-emerald-700 dark:text-emerald-400">{formatManYen(row.revenueYen)}</td>
                <td className="py-1 text-right text-amber-700 dark:text-amber-400">{formatManYen(row.costYen)}</td>
                <td className={cn("py-1 text-right font-medium", row.profitYen >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  {row.profitYen >= 0 ? "+" : "▲"}
                  {formatManYen(Math.abs(row.profitYen))}
                </td>
                <td className={cn("py-1 text-right", row.cashNetYen >= 0 ? "text-muted-foreground" : "text-muted-foreground")}>
                  {row.cashNetYen >= 0 ? "+" : "▲"}
                  {formatManYen(Math.abs(row.cashNetYen))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
