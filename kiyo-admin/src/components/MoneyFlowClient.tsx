"use client";

/**
 * 「00 お金の流れ」— AMD OS 本体が集計した結果を並べるだけ。
 *
 * 数字はすべて本体の /api/admin/kiyo/money-flow が返したものをそのまま出している。
 * ここで足し算・按分・推計をしないこと（合計も本体が返した totalYen を使う）。
 * 仕様正本: pwa/manual/6-11-kiyo-money-flow-spec.md
 */

import { useCallback, useEffect, useState } from "react";

type Period = "month" | "season" | "all";

type InflowProject = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  contractYen: number;
  extraYen: number;
  totalYen: number;
  months: Array<{ ym: string; amountYen: number; kind: "contract" | "extra"; confirmedAt: string | null }>;
};

type OutflowCategory = {
  key: string;
  label: string;
  totalYen: number;
  note: string;
  rows: Array<Record<string, unknown>>;
};

type MoneyFlow = {
  ok?: boolean;
  error?: string;
  range: { kind: Period; label: string; startYm: string | null; endYm: string | null };
  wallet: {
    balanceYen: number | null;
    balanceYm: string | null;
    netChangeYen: number;
    loanRemainingYen: number | null;
  };
  inflow: { totalYen: number; byProject: InflowProject[] };
  outflow: { totalYen: number; categories: OutflowCategory[] };
  summaryText: string;
  note: string;
  warnings: string[];
  computedAtIso: string;
};

const yen = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : "—";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "month", label: "今月" },
  { value: "season", label: "今シーズン" },
  { value: "all", label: "全期間" },
];

/** カテゴリごとに行の見え方が違うので、表示用の文字列だけここで組む（金額は触らない）。 */
function outflowRowLabel(categoryKey: string, row: Record<string, unknown>): string {
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
  switch (categoryKey) {
    case "member_reward":
      return text("memberName") || text("memberId");
    case "executive_pay":
      return text("ym") ? `${text("ym").slice(0, 4)}年${Number(text("ym").slice(4, 6))}月` : "";
    case "social_insurance_tax":
      return [text("title"), text("date")].filter(Boolean).join(" / ");
    case "opex":
      return text("accountName");
    case "loan_payment":
      return text("vendorName");
    default:
      return "";
  }
}

function outflowRowAmount(row: Record<string, unknown>): number {
  const value = row.amountYen ?? row.totalPayYen ?? row.monthlyAmountYen;
  return typeof value === "number" ? value : 0;
}

export function MoneyFlowClient() {
  const [period, setPeriod] = useState<Period>("season");
  const [data, setData] = useState<MoneyFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openProject, setOpenProject] = useState<string | null>(null);

  const load = useCallback(async (targetPeriod: Period, fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/kiyo/money-flow?period=${targetPeriod}${fresh ? "&fresh=1" : ""}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as MoneyFlow;
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "読み込みに失敗した");
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗した");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              onClick={() => setPeriod(item.value)}
              className={
                item.value === period
                  ? "rounded bg-slate-900 px-3 py-1 text-sm text-white"
                  : "rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load(period, true)}
          disabled={loading}
          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "読み込み中..." : "最新に更新"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      {data && (
        <>
          {data.summaryText && (
            <p className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800">
              {data.summaryText}
            </p>
          )}

          {data.warnings?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {data.warnings.map((warning, index) => (
                <li
                  key={index}
                  className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
                >
                  {warning}
                </li>
              ))}
            </ul>
          )}

          <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Box label="財布の残高" value={yen(data.wallet.balanceYen)} sub={data.wallet.balanceYm ?? undefined} />
            <Box
              label="期間の増減"
              value={yen(data.wallet.netChangeYen)}
              sub={data.range.label}
              tone={data.wallet.netChangeYen < 0 ? "negative" : "positive"}
            />
            <Box label="入ってきた" value={yen(data.inflow.totalYen)} sub={`${data.inflow.byProject.length}件のPJ`} />
            <Box label="出ていった" value={yen(data.outflow.totalYen)} sub={`${data.outflow.categories.length}分類`} />
          </section>

          {typeof data.wallet.loanRemainingYen === "number" && (
            <p className="mt-2 text-xs text-slate-600">
              借入の残り: <span className="font-medium tabular-nums">{yen(data.wallet.loanRemainingYen)}</span>
            </p>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white">
              <h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
                入ってきたお金{" "}
                <span className="ml-1 font-normal tabular-nums text-slate-600">{yen(data.inflow.totalYen)}</span>
              </h3>
              {data.inflow.byProject.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">この期間の入金はない</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.inflow.byProject.map((project) => (
                    <li key={project.projectId}>
                      <button
                        onClick={() =>
                          setOpenProject(openProject === project.projectId ? null : project.projectId)
                        }
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{project.projectName}</span>
                          {project.clientName && (
                            <span className="block truncate text-[11px] text-slate-500">
                              {project.clientName}
                            </span>
                          )}
                        </span>
                        <span className="ml-2 shrink-0 text-sm font-medium tabular-nums">
                          {yen(project.totalYen)}
                        </span>
                      </button>
                      {openProject === project.projectId && (
                        <ul className="bg-slate-50 px-3 pb-2 text-xs text-slate-600">
                          {project.months.map((month, index) => (
                            <li key={`${month.ym}:${index}`} className="flex justify-between py-0.5">
                              <span>
                                {month.ym.slice(0, 4)}年{Number(month.ym.slice(4, 6))}月分
                                {month.kind === "extra" && (
                                  <span className="ml-1 rounded bg-slate-200 px-1 text-[10px]">追加</span>
                                )}
                              </span>
                              <span className="tabular-nums">{yen(month.amountYen)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded border border-slate-200 bg-white">
              <h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">
                出ていったお金{" "}
                <span className="ml-1 font-normal tabular-nums text-slate-600">{yen(data.outflow.totalYen)}</span>
              </h3>
              {data.outflow.categories.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">この期間の支出はない</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.outflow.categories.map((category) => (
                    <li key={category.key}>
                      <button
                        onClick={() => setOpenCategory(openCategory === category.key ? null : category.key)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{category.label}</span>
                          {category.note && (
                            <span className="block truncate text-[11px] text-slate-500">{category.note}</span>
                          )}
                        </span>
                        <span className="ml-2 shrink-0 text-sm font-medium tabular-nums">
                          {yen(category.totalYen)}
                        </span>
                      </button>
                      {openCategory === category.key && (
                        <ul className="bg-slate-50 px-3 pb-2 text-xs text-slate-600">
                          {category.rows.length === 0 ? (
                            <li className="py-1 text-slate-400">内訳なし</li>
                          ) : (
                            category.rows.map((row, index) => (
                              <li key={index} className="flex justify-between gap-2 py-0.5">
                                <span className="min-w-0 truncate">
                                  {outflowRowLabel(category.key, row) || "—"}
                                </span>
                                <span className="shrink-0 tabular-nums">{yen(outflowRowAmount(row))}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {data.note}
            {data.computedAtIso && (
              <> — AMD OS 本体が {new Date(data.computedAtIso).toLocaleString("ja-JP")} に集計した結果</>
            )}
          </p>
        </>
      )}
    </div>
  );
}

function Box({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={
          tone === "negative"
            ? "text-base font-semibold tabular-nums text-rose-700"
            : "text-base font-semibold tabular-nums"
        }
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
