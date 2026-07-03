"use client";

import type { CockpitSeasonFinance as CockpitSeasonFinanceData } from "@/lib/supabase-data";

type Props = {
  finance: CockpitSeasonFinanceData | null | undefined;
};

const yenFormatter = new Intl.NumberFormat("ja-JP");

function formatYen(value: number) {
  return `¥${yenFormatter.format(Math.round(value || 0))}`;
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function amountTone(value: number, dangerWhenPositive = false) {
  if (dangerWhenPositive && value > 0) return "text-red-700";
  if (!dangerWhenPositive && value < 0) return "text-red-700";
  if (!dangerWhenPositive && value > 0) return "text-emerald-700";
  return "text-[#3c3c43]";
}

function summaryTone(finance: CockpitSeasonFinanceData) {
  if (finance.totals.sourceBudgetOverrunYen > 0) {
    return {
      label: `原資超過 ${formatYen(finance.totals.sourceBudgetOverrunYen)}`,
      className: "border-red-200 bg-red-50 text-red-800",
    };
  }
  if (finance.totals.finalUnpaidStockYen > 0 || finance.totals.finalRemainingYen < 0) {
    return {
      label: `不足 ${formatYen(Math.max(finance.totals.finalUnpaidStockYen, -finance.totals.finalRemainingYen))}`,
      className: "border-red-200 bg-red-50 text-red-800",
    };
  }
  return {
    label: `ゼロ着地 / 残 ${formatYen(finance.totals.finalRemainingYen)}`,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
}

export function CockpitSeasonFinance({ finance }: Props) {
  if (!finance) return null;
  const status = summaryTone(finance);
  const months = finance.months;
  const dangerAmount = Math.max(
    finance.totals.sourceBudgetOverrunYen,
    finance.totals.finalUnpaidStockYen,
    -finance.totals.finalRemainingYen,
  );
  const isDanger = dangerAmount > 0;
  const totalRows = [
    { label: "クライアント支払", value: finance.totals.clientPaymentYen },
    { label: "バッファ", value: finance.totals.bufferYen },
    { label: "原資上限", value: finance.totals.sourceBudgetYen },
    { label: "PJ予算", value: finance.totals.pjBudgetYen },
    { label: "メンバー支払", value: finance.totals.memberPayoutYen },
    { label: "会社留保", value: finance.totals.companyReserveYen },
    { label: "期末未払", value: finance.totals.finalUnpaidStockYen, dangerWhenPositive: true },
  ];

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f0f0f2] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">今シーズン収支</h2>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            {formatYm(finance.periodStartYm)} - {formatYm(finance.periodEndYm)}
          </p>
        </div>
        <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      {isDanger && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-800">
          <div className="font-semibold">シーズン収支が閉じていない</div>
          <div className="mt-0.5">
            期末未払・予算不足・原資超過のいずれかが {formatYen(dangerAmount)} 残っているため、MS編集側で保存を止める対象。
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-[#f0f0f2] sm:grid-cols-3">
        {totalRows.map((row) => (
          <div key={row.label} className="bg-white px-4 py-3">
            <div className="text-[11px] text-[#86868b]">{row.label}</div>
            <div className={`mt-1 text-[15px] font-semibold tabular-nums ${amountTone(row.value, row.dangerWhenPositive)}`}>
              {formatYen(row.value)}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-left text-[12px]">
          <thead className="bg-[#f5f5f7] text-[11px] text-[#6e6e73]">
            <tr>
              <th className="px-4 py-2 font-semibold">月</th>
              <th className="px-3 py-2 text-right font-semibold">クライアント支払</th>
              <th className="px-3 py-2 text-right font-semibold">バッファ</th>
              <th className="px-3 py-2 text-right font-semibold">原資上限</th>
              <th className="px-3 py-2 text-right font-semibold">PJ予算</th>
              <th className="px-3 py-2 text-right font-semibold">メンバー支払</th>
              <th className="px-3 py-2 text-right font-semibold">会社留保</th>
              <th className="px-3 py-2 text-right font-semibold">未払残</th>
              <th className="px-4 py-2 text-right font-semibold">残</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f2]">
            {months.map((month) => (
              <tr key={month.ym}>
                <td className="px-4 py-2 font-semibold text-[#1d1d1f]">{formatYm(month.ym)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatYen(month.clientPaymentYen)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatYen(month.bufferYen)}</td>
                <td className="px-3 py-2 text-right text-[#8e8e93]">-</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatYen(month.pjBudgetYen)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatYen(month.memberPayoutYen)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatYen(month.companyReserveYen)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${amountTone(month.unpaidStockYen, true)}`}>
                  {formatYen(month.unpaidStockYen)}
                </td>
                <td className={`px-4 py-2 text-right font-semibold tabular-nums ${amountTone(month.remainingAfterObligationYen)}`}>
                  {formatYen(month.remainingAfterObligationYen)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-[#d6d6da] bg-[#fafafa] text-[12px]">
            <tr>
              <th className="px-4 py-2 font-semibold">合計</th>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.clientPaymentYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.bufferYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.sourceBudgetYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.pjBudgetYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.memberPayoutYen)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatYen(finance.totals.companyReserveYen)}</td>
              <td className={`px-3 py-2 text-right font-semibold tabular-nums ${amountTone(finance.totals.finalUnpaidStockYen, true)}`}>
                {formatYen(finance.totals.finalUnpaidStockYen)}
              </td>
              <td className={`px-4 py-2 text-right font-semibold tabular-nums ${amountTone(finance.totals.finalRemainingYen)}`}>
                {formatYen(finance.totals.finalRemainingYen)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
