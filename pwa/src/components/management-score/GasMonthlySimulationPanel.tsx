"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import type { MonthlyPlInputs, MonthlyPlSimulationResult } from "@/lib/finance/monthly-pl-simulation";
import {
  projectCashFromAnchor,
  resolveCashAnchor,
  type CashAnchorKind,
} from "@/lib/finance/cash-anchor";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip
);

export type GasProjectListItem = {
  projectId: string;
  projectName: string;
  closerInternal: boolean;
};

export type GasProjectDetail = {
  projectId: string;
  revenue: number;
  /** 契約条件から解決した税抜の入金予定額。 */
  cashRevenue?: number;
  externalMember?: number;
  internalMember?: number;
  /** 別財布（別契約）売上の内訳。revenue にこの額が含まれる。 */
  extraRevenue?: number;
};

export type GasFixedCostDetail = {
  name: string;
  amount: number;
};

export type GasObligationDetail = {
  obligationId: string;
  title: string;
  category: string;
  amountYen: number | null;
  amountStatus: "exact" | "estimated" | "unknown";
  dueDate: string | null;
  expectedPaymentYm: number;
  cashflowTreatment: "additive" | "included_in_budget";
  status: "needs_review" | "open" | "scheduled" | "paid" | "cancelled";
  autoDebit: boolean | null;
};

export type GasMonthlyRow = {
  ym: number;
  actualStatus: "actual" | "missing" | "future";
  revenue: number;
  actualRevenue: number;
  confirmedDepositsGross: number;
  costMember: number;
  costCloser: number;
  grossProfit: number;
  fixedCost: number;
  actualFixedCost: number;
  socialIns: number;
  actualSocialIns: number;
  operatingProfit: number;
  loanPayment: number;
  actualLoanPayment: number;
  loanInterest: number;
  actualLoanInterest: number;
  ctaxPayment: number;
  actualCtaxPayment: number;
  corpTaxPayment: number;
  actualCorpTaxPayment: number;
  obligationPaymentTotal: number;
  obligationPaymentAdditive: number;
  actualSpotIncome: number;
  actualSpotExpense: number;
  netCashFlow: number;
  actualNetCashFlow: number;
  payoutNoticeNetTotal: number;
  payoutNoticeSentNetTotal: number;
  cashBalance: number;
  actualCashBalance: number | null;
  runway: number;
  loanDisbursement: number;
  actualLoanDisbursement: number;
  spotIncome: number;
  spotExpense: number;
  cashInflow: number;
  cashOutflow: number;
  actualCashInflow: number;
  actualCashOutflow: number;
  hasTransactionCashActual: boolean;
  pjDetails: GasProjectDetail[];
  fixedCostDetails: GasFixedCostDetail[];
  obligationDetails: GasObligationDetail[];
};

/**
 * 現預金の起点 (freee 実残高で置き換えた月) のメタ情報。
 * 「この現預金がいつ時点のものか」を画面に出すために使う。
 */
export type GasCashAnchorMeta = {
  ym: number;
  actualCash: number;
  /** アンカー置き換え前のモデル残高 */
  modelCash: number;
  variance: number;
  kind: CashAnchorKind;
  /** freee 取込時刻 (ISO) */
  asOf?: string | null;
  /** アンカーより後の月 (= 進行中の月) の口座残高。月末値ではない参考値 */
  inMonth?: { ym: number; actualCash: number; asOf?: string | null } | null;
};

export type GasSimulationResult = {
  params: { rateCloser?: number };
  rows: GasMonthlyRow[];
  projectList: GasProjectListItem[];
  cashAnchor?: GasCashAnchorMeta | null;
};

type SimulateResponse = {
  ok: boolean;
  error?: string;
  result?: MonthlyPlSimulationResult;
};

type ToggleState = {
  revenue: boolean;
  cashIn: boolean;
  cost: boolean;
  fixedCost: boolean;
  grossProfit: boolean;
  obligations: boolean;
};

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return Math.round(value).toLocaleString("ja-JP");
}

function fmtYm(ym: number): string {
  const year = Math.floor(ym / 100);
  const month = ym % 100;
  return `${year}年${month}月`;
}

function kpiYen(value: number): string {
  return `¥${fmt(value)}`;
}

/** ISO 文字列を JST の「M月D日 HH:MM」にする */
function fmtJstStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const jst = new Date(parsed.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${String(jst.getUTCHours()).padStart(2, "0")}:${String(
    jst.getUTCMinutes()
  ).padStart(2, "0")}`;
}

function signedYen(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}¥${fmt(Math.abs(value))}`;
}

function mergeActualRows(result: GasSimulationResult, baselineRows: GasMonthlyRow[]): GasSimulationResult {
  const actualByYm = new Map(baselineRows.map((row) => [row.ym, row]));
  return {
    ...result,
    rows: result.rows.map((row) => {
      const actual = actualByYm.get(row.ym);
      return {
        ...row,
        actualStatus: actual?.actualStatus ?? "future",
        actualRevenue: actual?.actualRevenue ?? 0,
        confirmedDepositsGross: actual?.confirmedDepositsGross ?? 0,
        actualFixedCost: actual?.actualFixedCost ?? 0,
        actualSocialIns: actual?.actualSocialIns ?? 0,
        actualSpotIncome: actual?.actualSpotIncome ?? 0,
        actualSpotExpense: actual?.actualSpotExpense ?? 0,
        actualLoanDisbursement: actual?.actualLoanDisbursement ?? 0,
        actualLoanPayment: actual?.actualLoanPayment ?? 0,
        actualLoanInterest: actual?.actualLoanInterest ?? 0,
        actualCtaxPayment: actual?.actualCtaxPayment ?? 0,
        actualCorpTaxPayment: actual?.actualCorpTaxPayment ?? 0,
        actualNetCashFlow: actual?.actualNetCashFlow ?? 0,
        actualCashInflow: actual?.actualCashInflow ?? 0,
        actualCashOutflow: actual?.actualCashOutflow ?? 0,
        hasTransactionCashActual: actual?.hasTransactionCashActual ?? false,
        payoutNoticeNetTotal: actual?.payoutNoticeNetTotal ?? 0,
        payoutNoticeSentNetTotal: actual?.payoutNoticeSentNetTotal ?? 0,
        actualCashBalance: actual?.actualCashBalance ?? null,
      };
    }),
  };
}

type CashProjection = {
  data: (number | null)[];
  anchor:
    | {
        ym: number;
        actualCash: number;
        variance: number;
      }
    | null;
  finalCash: number | null;
  lowestCash: { ym: number; cash: number } | null;
};

/**
 * 「実績接続見込み」系列。アンカーは締まった月に限定する (cash-anchor.ts 参照)。
 * 進行中の月の口座残高で打ち切ると、その月の未払い分が消えて残高が過大に出る。
 */
function buildActualConnectedCashProjection(
  rows: GasMonthlyRow[],
  meta?: GasCashAnchorMeta | null
): CashProjection {
  const point = resolveCashAnchor(
    rows.map((row) => ({ ym: row.ym, actualCash: row.actualCashBalance, modelCash: row.cashBalance }))
  );
  const data = projectCashFromAnchor(rows.map((row) => row.netCashFlow), point);
  if (!point) return { data, anchor: null, finalCash: null, lowestCash: null };

  let lowestCash = { ym: point.ym, cash: point.actualCash };
  for (let index = point.index + 1; index < rows.length; index += 1) {
    const cash = data[index];
    if (cash != null && cash < lowestCash.cash) lowestCash = { ym: rows[index].ym, cash };
  }

  return {
    data,
    anchor: {
      ym: point.ym,
      actualCash: point.actualCash,
      // rows[].cashBalance は既にアンカー適用済みなので差異は 0 になる。
      // サーバ側が置き換え前のモデル残高を渡してきたときだけ本来の差異を出す。
      variance: meta && meta.ym === point.ym ? meta.variance : point.variance,
    },
    finalCash: data[data.length - 1] ?? null,
    lowestCash,
  };
}

export function GasMonthlySimulationPanel({ result, inputs }: { result: GasSimulationResult; inputs?: MonthlyPlInputs | null }) {
  const [displayResult, setDisplayResult] = useState<GasSimulationResult>(result);
  const [scenarioId, setScenarioId] = useState("");
  const [simRunning, setSimRunning] = useState(false);
  const [simStatus, setSimStatus] = useState("");
  const [toggleState, setToggleState] = useState<ToggleState>({
    revenue: false,
    cashIn: false,
    cost: false,
    fixedCost: false,
    grossProfit: false,
    obligations: false,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const rows = displayResult.rows;
  const pjList = displayResult.projectList;
  const scenarioOptions = useMemo(() => {
    const seen = new Set<string>();
    return (inputs?.scenarios ?? [])
      .filter((row) => {
        if (!row.scenarioId || seen.has(row.scenarioId)) return false;
        seen.add(row.scenarioId);
        return true;
      })
      .map((row) => ({
        id: row.scenarioId,
        name: row.scenarioName || row.scenarioId,
      }));
  }, [inputs]);

  const cashAnchorMeta = result.cashAnchor ?? null;
  const cashProjection = useMemo(
    () => buildActualConnectedCashProjection(rows, cashAnchorMeta),
    [rows, cashAnchorMeta]
  );

  /**
   * 「この現預金がいつ時点のものか」を明示する注記。
   * 起点が締まった月なら月末確定値、当月しか無いなら月中値である旨を警告として出す。
   */
  const cashAnchorNote = useMemo(() => {
    const anchor = cashProjection.anchor;
    if (!anchor) return null;
    const kind = cashAnchorMeta && cashAnchorMeta.ym === anchor.ym ? cashAnchorMeta.kind : "settled_month_end";
    const anchorStamp = cashAnchorMeta && cashAnchorMeta.ym === anchor.ym ? fmtJstStamp(cashAnchorMeta.asOf) : null;
    const nextYmIndex = rows.findIndex((row) => row.ym === anchor.ym) + 1;
    const nextYm = rows[nextYmIndex]?.ym ?? null;

    if (kind === "in_month_balance") {
      return {
        warn: true,
        main: `⚠ 現預金の起点が${fmtYm(anchor.ym)}の口座残高${anchorStamp ? `（${anchorStamp} 時点）` : ""}です。月末が確定した月の実残高がまだ無いため、${fmtYm(anchor.ym)}にこれから出ていく支払いは残高に反映されていません。`,
        sub: "この状態の見込み残高は実態より高く出ます。freee の月末残高が取り込まれると自動で解消します。",
      };
    }

    const inMonth = cashAnchorMeta?.inMonth ?? null;
    const inMonthStamp = fmtJstStamp(inMonth?.asOf);
    return {
      warn: false,
      main: `現預金の起点は${fmtYm(anchor.ym)}末の実残高 ${kpiYen(anchor.actualCash)}（freee・月末確定）。${nextYm ? `${fmtYm(nextYm)}以降` : "以降"}はモデルの月次キャッシュフローを積み上げた見込みで、まだ動く数字です。`,
      sub: inMonth
        ? `参考: ${fmtYm(inMonth.ym)}の口座残高は ${kpiYen(inMonth.actualCash)}${inMonthStamp ? `（${inMonthStamp} 時点）` : ""}。月中の値なので、その月の未払い分は差し引かれていません。`
        : null,
    };
  }, [cashProjection.anchor, cashAnchorMeta, rows]);

  const kpis = useMemo(() => {
    const totalRev = rows.reduce((sum, row) => sum + row.revenue, 0);
    const totalProfit = rows.reduce((sum, row) => sum + row.operatingProfit, 0);
    const totalCf = rows.reduce((sum, row) => sum + row.netCashFlow, 0);
    const avgRev = rows.length ? Math.round(totalRev / rows.length) : 0;
    const avgProfit = rows.length ? Math.round(totalProfit / rows.length) : 0;
    const avgCf = rows.length ? Math.round(totalCf / rows.length) : 0;
    const last = rows[rows.length - 1] ?? null;
    return {
      avgRev,
      avgProfit,
      avgCf,
      cash: cashProjection.finalCash ?? last?.cashBalance ?? 0,
      runway: rows[0]?.runway ?? null,
    };
  }, [cashProjection.finalCash, rows]);

  useEffect(() => {
    if (!canvasRef.current || rows.length === 0) return;
    chartRef.current?.destroy();
    const labels = rows.map((row) => fmtYm(row.ym));
    const actualBalanceData = rows.map((row) => row.actualCashBalance);
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "当初計画残高",
            data: rows.map((row) => row.cashBalance),
            borderColor: "#7b8794",
            backgroundColor: "rgba(123,135,148,0.05)",
            borderDash: [5, 3],
            fill: false,
            borderWidth: 2,
            pointRadius: 2,
            order: 3,
          },
          {
            label: "実績残高",
            data: actualBalanceData,
            borderColor: "#27ae60",
            backgroundColor: "rgba(39,174,96,0.04)",
            fill: false,
            spanGaps: false,
            borderWidth: 2.5,
            pointRadius: 3,
            order: 1,
          },
          {
            label: "実績接続見込み",
            data: cashProjection.data,
            borderColor: "#1f6feb",
            backgroundColor: "rgba(31,111,235,0.06)",
            fill: false,
            spanGaps: false,
            borderWidth: 3,
            pointRadius: 2.5,
            order: 0,
          },
          {
            label: "収入",
            data: rows.map((row) => row.cashInflow || 0),
            type: "bar",
            backgroundColor: "rgba(39,174,96,0.3)",
            borderWidth: 0,
            yAxisID: "cf",
            stack: "cf",
            barPercentage: 0.6,
            order: 4,
          },
          {
            label: "支出",
            data: rows.map((row) => -(row.cashOutflow || 0)),
            type: "bar",
            backgroundColor: "rgba(192,57,43,0.3)",
            borderWidth: 0,
            yAxisID: "cf",
            stack: "cf",
            barPercentage: 0.6,
            order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: "キャッシュフロー推移", font: { size: 12 } },
          legend: { labels: { font: { size: 10 } } },
        },
        scales: {
          y: {
            position: "left",
            ticks: {
              callback(value) {
                return `${(Number(value) / 10000).toFixed(0)}万`;
              },
              font: { size: 10 },
            },
          },
          cf: {
            position: "right",
            stacked: true,
            grid: { drawOnChartArea: false },
            ticks: {
              callback(value) {
                return `${(Number(value) / 10000).toFixed(0)}万`;
              },
              font: { size: 10 },
            },
          },
          x: {
            stacked: true,
            ticks: { maxRotation: 45, font: { size: 9 } },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [cashProjection.data, rows]);

  const switchToggle = (key: keyof ToggleState) => {
    setToggleState((current) => ({ ...current, [key]: !current[key] }));
  };

  const runScenario = async () => {
    if (!inputs) {
      setSimStatus("入力データなし");
      return;
    }
    setSimRunning(true);
    setSimStatus("");
    try {
      const res = await fetch("/api/management-score/finance/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs,
          scenarioId: scenarioId || null,
          persist: false,
          version: "interactive-preview",
          sourceRef: "/management-score",
        }),
      });
      const json = (await res.json()) as SimulateResponse;
      if (!res.ok || !json.ok || !json.result) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setDisplayResult(mergeActualRows(json.result as unknown as GasSimulationResult, result.rows));
      setSimStatus(scenarioId ? `${scenarioId} を反映` : "ベースラインを再計算");
    } catch (err) {
      setSimStatus(`実行エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSimRunning(false);
    }
  };

  const detailRow = (label: string, getValue: (row: GasMonthlyRow) => number) => (
    <tr key={label}>
      <td className="gas-detail-label">{label}</td>
      {rows.map((row) => {
        const value = getValue(row);
        return [
          <td key={`${label}_${row.ym}_budget`} className="num gas-detail-num budget-num">
            {value > 0 ? fmt(value) : "-"}
          </td>,
          <td key={`${label}_${row.ym}_actual`} className="num gas-detail-num table-blank">
            -
          </td>,
          <td key={`${label}_${row.ym}_variance`} className="num gas-detail-num table-blank">
            -
          </td>,
        ];
      })}
    </tr>
  );

  const obligationDetails = Array.from(
    new Map(rows.flatMap((row) => row.obligationDetails ?? []).map((detail) => [detail.obligationId, detail])).values()
  );

  const actualCashOutflow = (row: GasMonthlyRow) =>
    row.hasTransactionCashActual
      ? row.actualCashOutflow
      : Math.max(
          0,
          Math.round(row.payoutNoticeSentNetTotal * 1.1) +
            row.actualFixedCost +
            row.actualSocialIns +
            row.actualSpotExpense -
            row.actualSpotIncome +
            row.actualLoanPayment +
            row.actualCtaxPayment +
            row.actualCorpTaxPayment
        );

  const actualGrossProfit = (row: GasMonthlyRow) => row.actualRevenue - row.payoutNoticeSentNetTotal;
  const actualOperatingProfit = (row: GasMonthlyRow) =>
    actualGrossProfit(row) - row.actualFixedCost - row.actualSocialIns + row.actualSpotIncome - row.actualSpotExpense;

  const actualValueState = (row: GasMonthlyRow, value: number | null | undefined) => {
    if (value == null) return "unlinked";
    if (row.actualStatus === "future") return "future";
    if (row.actualStatus === "missing" && value === 0) return "missing";
    return "actual";
  };

  const actualDisplay = (row: GasMonthlyRow, value: number | null | undefined, refund = false) => {
    const state = actualValueState(row, value);
    if (state === "future") return "未確定";
    if (state === "missing") return "未反映";
    if (state === "unlinked") return "未連携";
    const numeric = value ?? 0;
    if (refund && numeric < 0) return `${fmt(Math.abs(numeric))}（還付）`;
    return fmt(numeric);
  };

  const diffDisplay = (row: GasMonthlyRow, budget: number, actual: number | null | undefined) => {
    if (actualValueState(row, actual) !== "actual") return "-";
    const diff = (actual ?? 0) - budget;
    return diff > 0 ? `+${fmt(diff)}` : fmt(diff);
  };

  const actualCellClass = (row: GasMonthlyRow, value: number | null | undefined, baseClass = "") => {
    const state = actualValueState(row, value);
    return ["num", baseClass, state !== "actual" ? "actual-pending" : ""].filter(Boolean).join(" ");
  };

  const varianceCellClass = (row: GasMonthlyRow, actual: number | null | undefined, budget: number) => {
    const state = actualValueState(row, actual);
    const diff = (actual ?? 0) - budget;
    return [
      "num",
      "variance-num",
      state !== "actual" ? "actual-pending" : "",
      state === "actual" && diff > 0 ? "variance-positive" : "",
      state === "actual" && diff < 0 ? "variance-negative" : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const renderComparisonGroup = ({
    id,
    label,
    budget,
    actual,
    source,
    bold,
    refund,
    onToggle,
  }: {
    id: string;
    label: string;
    budget: (row: GasMonthlyRow) => number;
    actual?: (row: GasMonthlyRow) => number | null;
    source: string;
    bold?: boolean;
    highlight?: boolean;
    refund?: boolean;
    onToggle?: () => void;
  }) => (
    <tr key={id} className={`comparison-row ${bold ? "comparison-row-bold" : ""}`}>
      <td className={`group-label ${bold ? "bold-label" : ""} ${onToggle ? "toggleable" : ""}`} onClick={onToggle}>
        <span>{label}</span>
        <span className="source-chip">{source}</span>
      </td>
      {rows.flatMap((row) => {
        const budgetValue = budget(row);
        const actualValue = actual?.(row) ?? null;
        const budgetDisplay = refund && budgetValue < 0 ? `${fmt(Math.abs(budgetValue))}（還付）` : fmt(budgetValue);
        return [
          <td
            key={`${id}_budget_${row.ym}`}
            className={`num budget-num ${bold ? "bold-label" : ""}`}
          >
            {budgetDisplay}
          </td>,
          <td key={`${id}_actual_${row.ym}`} className={actualCellClass(row, actualValue, "gas-actual-num")}>
            {actualDisplay(row, actualValue, refund)}
          </td>,
          <td key={`${id}_variance_${row.ym}`} className={varianceCellClass(row, actualValue, budgetValue)}>
            {diffDisplay(row, budgetValue, actualValue)}
          </td>,
        ];
      })}
    </tr>
  );

  return (
    <section className="gas-sim-panel">
      <style jsx>{`
        .gas-sim-panel {
          background: #fff;
          border-radius: 0 8px 8px 8px;
          padding: 16px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          font-family: "Yu Gothic", "Meiryo", sans-serif;
          font-size: 13px;
          color: #1a1a1a;
        }
        .sim-bar {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }
        .scenario-select {
          height: 29px;
          border: 1px solid #999;
          border-radius: 2px;
          background: #fff;
          font-size: 14px;
        }
        .btn-sim {
          background: #27ae60;
          color: #fff;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn-sim:hover {
          background: #2ecc71;
        }
        .btn-sim:disabled {
          background: #9aa7b4;
          cursor: not-allowed;
          opacity: 0.75;
        }
        .scenario-select:disabled {
          color: #777;
          background: #f5f5f5;
        }
        .sim-status {
          color: #555;
          font-size: 12px;
        }
        .sim-top-row {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }
        .kpi-col {
          flex: 0 0 180px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kpi {
          flex: 1;
          background: #f8f9fc;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          border: 1px solid #e0e4ec;
        }
        .kpi .label {
          font-size: 11px;
          color: #888;
        }
        .kpi .value {
          font-size: 20px;
          font-weight: bold;
          color: #1b3a6b;
          margin-top: 2px;
        }
        .kpi .value.negative {
          color: #c0392b;
        }
        .chart-wrap {
          flex: 1;
          min-width: 0;
        }
        .chart-frame {
          height: 220px;
        }
        .projection-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 8px;
        }
        .projection-item {
          min-width: 0;
          border: 1px solid #e0e4ec;
          border-radius: 8px;
          background: #f8f9fc;
          padding: 8px 10px;
        }
        .projection-label {
          color: #777;
          font-size: 10px;
          white-space: nowrap;
        }
        .projection-value {
          margin-top: 2px;
          color: #1a1a1a;
          font-family: "Consolas", monospace;
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;
        }
        .projection-value.positive {
          color: #118ab2;
        }
        .projection-value.negative {
          color: #d84d7a;
        }
        .cash-anchor-note {
          margin-top: 8px;
          padding: 7px 10px;
          border: 1px solid #e0e4ec;
          border-left: 3px solid #1b3a6b;
          border-radius: 6px;
          background: #f8f9fc;
          color: #444;
          font-size: 11px;
          line-height: 1.6;
        }
        .cash-anchor-note.warn {
          border-left-color: #d84d7a;
          background: #fdf3f6;
          color: #8a2f4c;
        }
        .cash-anchor-sub {
          color: #777;
          margin-top: 2px;
        }
        .cash-anchor-note.warn .cash-anchor-sub {
          color: #a4566e;
        }
        .table-wrap {
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12px;
        }
        th {
          color: #fff;
          padding: 6px 8px;
          white-space: nowrap;
        }
        td {
          padding: 5px 8px;
          border-bottom: 1px solid #e8e8e8;
          white-space: nowrap;
        }
        .gas-sim-panel :global(td) {
          padding: 5px 8px;
          border-bottom: 1px solid #e8e8e8;
          white-space: nowrap;
        }
        tr:hover td {
          background: #f0f4ff;
        }
        .num {
          text-align: right;
          font-family: "Consolas", monospace;
          font-variant-numeric: tabular-nums;
        }
        .gas-sim-panel :global(.num) {
          text-align: right;
          font-family: "Consolas", monospace;
          font-variant-numeric: tabular-nums;
        }
        .head-item {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 3;
          background: #1b3a6b;
          min-width: 120px;
          text-align: left;
          vertical-align: middle;
        }
        .head-month {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #1b3a6b;
          min-width: 210px;
          text-align: center;
          border-left: 1px solid rgba(255, 255, 255, 0.16);
        }
        .head-sub {
          position: sticky;
          top: 30px;
          z-index: 2;
          min-width: 70px;
          text-align: right;
          font-size: 10px;
          letter-spacing: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
        }
        .head-budget {
          background: #243f67;
          color: #cfd6df;
          border-left: 1px solid rgba(255, 255, 255, 0.12);
        }
        .head-actual {
          background: #1b3a6b;
          color: #fff;
        }
        .head-variance {
          background: #213552;
          color: #dce8f4;
        }
        .toggle-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #fff;
          font-weight: bold;
          cursor: pointer;
        }
        .gas-sim-panel :global(.group-label) {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #fff;
          border-top: 2px solid #d8e0ea;
          font-weight: 700;
        }
        .gas-sim-panel :global(.group-label.toggleable) {
          cursor: pointer;
        }
        .gas-sim-panel :global(.group-label span) {
          display: inline-flex;
          align-items: center;
        }
        .gas-sim-panel :global(.comparison-row td) {
          border-top: 2px solid #d8e0ea;
        }
        .gas-sim-panel :global(.comparison-row-bold td:not(:first-child)) {
          font-weight: 700;
        }
        .gas-sim-panel :global(.source-chip) {
          margin-left: 8px;
          border: 1px solid currentColor;
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 9px;
          font-weight: 700;
          opacity: 0.78;
        }
        .gas-sim-panel :global(.budget-num) {
          color: #7f8792;
        }
        .gas-sim-panel :global(.table-blank) {
          color: #b5bbc4;
        }
        .gas-sim-panel :global(.variance-num) {
          color: #7f8792;
        }
        .gas-sim-panel :global(.variance-positive) {
          color: #118ab2;
        }
        .gas-sim-panel :global(.variance-negative) {
          color: #d84d7a;
        }
        .gas-sim-panel :global(.actual-pending) {
          color: #8a8f98;
          font-family: "Yu Gothic", "Meiryo", sans-serif;
          font-size: 10px;
        }
        .plain-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #fff;
        }
        .gas-sim-panel :global(.bold-label) {
          font-weight: bold;
        }
        .gas-sim-panel :global(.gas-detail-label) {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f8f9fc;
          padding-left: 20px;
          color: #555;
          font-size: 11px;
        }
        .gas-sim-panel :global(.gas-detail-num) {
          color: #7f8792;
          font-size: 11px;
        }
        .gas-actual-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f4fbf8;
          padding-left: 20px;
          color: #0f6b45;
          font-size: 11px;
        }
        .gas-sim-panel :global(.gas-actual-num) {
          color: #1a1a1a;
          font-size: 11px;
        }
        .gas-payment-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f5f8ff;
          padding-left: 20px;
          color: #1b4f9c;
          font-size: 11px;
        }
        .gas-payment-num {
          color: #1b4f9c;
          font-size: 11px;
          background: #f5f8ff;
        }
        .gas-sim-panel :global(.gas-cost-label) {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f8f9fc;
          padding-left: 30px;
          color: #c0392b;
          font-size: 10px;
        }
        .gas-sim-panel :global(.gas-cost-num) {
          color: #7f8792;
          font-size: 10px;
        }
        .gas-sim-panel :global(.indent-label) {
          padding-left: 20px;
          color: #888;
          font-size: 11px;
        }
        .gas-sim-panel :global(.negative) {
          color: #d84d7a;
        }
        .gas-sim-panel :global(.refund) {
          color: #118ab2;
        }
        @media (max-width: 900px) {
          .sim-top-row {
            flex-direction: column;
          }
          .kpi-col {
            flex: auto;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .projection-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="sim-bar">
        <select
          className="scenario-select"
          value={scenarioId}
          onChange={(event) => setScenarioId(event.target.value)}
          disabled={!inputs || simRunning}
        >
          <option value="">ベースライン</option>
          {scenarioOptions.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
        <button className="btn-sim" type="button" onClick={runScenario} disabled={!inputs || simRunning}>
          {simRunning ? "実行中…" : "シミュレーション実行"}
        </button>
        <span className="sim-status">{simStatus || (!inputs ? "入力データなし" : "")}</span>
      </div>

      <div className="sim-top-row">
        <div className="kpi-col">
          <div className="kpi">
            <div className="label">月平均売上</div>
            <div className="value">{kpiYen(kpis.avgRev)}</div>
          </div>
          <div className="kpi">
            <div className="label">月平均営業利益</div>
            <div className={`value ${kpis.avgProfit < 0 ? "negative" : ""}`}>{kpiYen(kpis.avgProfit)}</div>
          </div>
          <div className="kpi">
            <div className="label">最終見込み残高</div>
            <div className={`value ${kpis.cash < 0 ? "negative" : ""}`}>{kpiYen(kpis.cash)}</div>
          </div>
          <div className="kpi">
            <div className="label">現在のランウェイ</div>
            <div className="value">{kpis.runway == null ? "-" : `${kpis.runway}ヶ月`}</div>
          </div>
        </div>
        <div className="chart-wrap">
          <div className="chart-frame">
            <canvas ref={canvasRef} height="220" />
          </div>
          <div className="projection-strip">
            <div className="projection-item">
              <div className="projection-label">現預金の起点</div>
              <div className="projection-value">
                {cashProjection.anchor ? `${fmtYm(cashProjection.anchor.ym)} ${kpiYen(cashProjection.anchor.actualCash)}` : "-"}
              </div>
            </div>
            <div className="projection-item">
              <div className="projection-label">当初計画差分</div>
              <div
                className={`projection-value ${
                  (cashProjection.anchor?.variance ?? 0) < 0
                    ? "negative"
                    : (cashProjection.anchor?.variance ?? 0) > 0
                      ? "positive"
                      : ""
                }`}
              >
                {cashProjection.anchor ? signedYen(cashProjection.anchor.variance) : "-"}
              </div>
            </div>
            <div className="projection-item">
              <div className="projection-label">最終見込み</div>
              <div className={`projection-value ${(cashProjection.finalCash ?? 0) < 0 ? "negative" : ""}`}>
                {cashProjection.finalCash == null ? "-" : kpiYen(cashProjection.finalCash)}
              </div>
            </div>
            <div className="projection-item">
              <div className="projection-label">最低見込み</div>
              <div className={`projection-value ${(cashProjection.lowestCash?.cash ?? 0) < 0 ? "negative" : ""}`}>
                {cashProjection.lowestCash ? `${fmtYm(cashProjection.lowestCash.ym)} ${kpiYen(cashProjection.lowestCash.cash)}` : "-"}
              </div>
            </div>
          </div>
          {cashAnchorNote ? (
            <div className={`cash-anchor-note ${cashAnchorNote.warn ? "warn" : ""}`}>
              <div>{cashAnchorNote.main}</div>
              {cashAnchorNote.sub ? <div className="cash-anchor-sub">{cashAnchorNote.sub}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="head-item" rowSpan={2}>
                項目
              </th>
              {rows.map((row) => (
                <th key={row.ym} className="head-month" colSpan={3}>
                  {fmtYm(row.ym)}
                </th>
              ))}
            </tr>
            <tr>
              {rows.flatMap((row) => [
                <th key={`${row.ym}_budget_head`} className="head-sub head-budget">
                  予算
                </th>,
                <th key={`${row.ym}_actual_head`} className="head-sub head-actual">
                  実績
                </th>,
                <th key={`${row.ym}_variance_head`} className="head-sub head-variance">
                  差分
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {renderComparisonGroup({
              id: "revenue",
              label: `${toggleState.revenue ? "▼" : "▶"} 売上計`,
              budget: (row) => row.revenue,
              actual: (row) => row.actualRevenue,
              source: "freee PL",
              bold: true,
              onToggle: () => switchToggle("revenue"),
            })}
            {renderComparisonGroup({
              id: "cash_in",
              label: `${toggleState.cashIn ? "▼" : "▶"} 入金`,
              budget: (row) => row.cashInflow,
              actual: (row) => row.confirmedDepositsGross,
              source: "billing確認済(税込)",
              bold: true,
              onToggle: () => switchToggle("cashIn"),
            })}
            {toggleState.cashIn &&
              pjList.flatMap((pj, pi) => {
                const hasCashReceipt = rows.some((row) => (row.pjDetails[pi]?.cashRevenue || 0) > 0);
                if (!hasCashReceipt) return [];
                return detailRow(`${pj.projectName}・入金予定（税込）`, (row) =>
                  Math.round((row.pjDetails[pi]?.cashRevenue || 0) * 1.1)
                );
              })}
            {toggleState.revenue &&
              pjList.flatMap((pj, pi) => {
                const hasExtra = rows.some((row) => (row.pjDetails[pi]?.extraRevenue || 0) > 0);
                const revenueLabel = hasExtra ? `${pj.projectName} 🔵別財布込` : pj.projectName;
                const revenueRow = detailRow(revenueLabel, (row) => row.pjDetails[pi]?.revenue || 0);
                const costRow = (
                  <tr key={`${pj.projectId}_cost`}>
                    <td className="gas-cost-label">原価</td>
                    {rows.map((row) => {
                      const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0 };
                      const closerExt = det.revenue > 0 && !pj.closerInternal ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05)) : 0;
                      const cost = (det.externalMember || 0) + closerExt;
                      return [
                        <td key={`${pj.projectId}_cost_${row.ym}_budget`} className="num gas-cost-num budget-num">
                          {cost > 0 ? `-${fmt(cost)}` : "-"}
                        </td>,
                        <td key={`${pj.projectId}_cost_${row.ym}_actual`} className="num gas-cost-num table-blank">
                          -
                        </td>,
                        <td key={`${pj.projectId}_cost_${row.ym}_variance`} className="num gas-cost-num table-blank">
                          -
                        </td>,
                      ];
                    })}
                  </tr>
                );
                return [revenueRow, costRow];
              })}

            {renderComparisonGroup({
              id: "cost",
              label: `${toggleState.cost ? "▼" : "▶"} 売上原価`,
              budget: (row) => row.costMember + row.costCloser,
              actual: (row) => row.payoutNoticeSentNetTotal,
              source: "支払通知書送付済(税抜)",
              onToggle: () => switchToggle("cost"),
            })}
            {toggleState.cost &&
              pjList.flatMap((pj, pi) => {
                const hasValue = rows.some((row) => {
                  const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0, internalMember: 0 };
                  const closerExt =
                    det.revenue > 0 && !pj.closerInternal ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05)) : 0;
                  return (det.internalMember || 0) + (det.externalMember || 0) + closerExt > 0;
                });
                if (!hasValue) return [];
                const internalRow = detailRow(`${pj.projectName}・内製`, (row) => {
                  const det = row.pjDetails[pi] || { internalMember: 0 };
                  return det.internalMember || 0;
                });
                const externalRow = (
                  <tr key={`${pj.projectId}_cost_ext`}>
                    <td className="gas-detail-label">{pj.projectName}・外注</td>
                    {rows.map((row) => {
                      const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0 };
                      const closerExt =
                        det.revenue > 0 && !pj.closerInternal
                          ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05))
                          : 0;
                      const ext = (det.externalMember || 0) + closerExt;
                      return [
                        <td key={`${pj.projectId}_cost_ext_${row.ym}_budget`} className="num gas-detail-num budget-num">
                          {ext > 0 ? fmt(ext) : "-"}
                        </td>,
                        <td key={`${pj.projectId}_cost_ext_${row.ym}_actual`} className="num gas-detail-num table-blank">
                          -
                        </td>,
                        <td key={`${pj.projectId}_cost_ext_${row.ym}_variance`} className="num gas-detail-num table-blank">
                          -
                        </td>,
                      ];
                    })}
                  </tr>
                );
                return [internalRow, externalRow];
              })}

            {renderComparisonGroup({
              id: "gross_profit",
              label: `${toggleState.grossProfit ? "▼" : "▶"} 粗利`,
              budget: (row) => row.grossProfit,
              actual: (row) => actualGrossProfit(row),
              source: "freee PL - 支払通知",
              bold: true,
              highlight: true,
              onToggle: () => switchToggle("grossProfit"),
            })}
            {toggleState.grossProfit &&
              pjList.map((pj, pi) =>
                detailRow(pj.projectName, (row) => {
                  const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0 };
                  const closerExt = det.revenue > 0 && !pj.closerInternal ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05)) : 0;
                  return det.revenue - (det.externalMember || 0) - closerExt;
                })
              )}

            {renderComparisonGroup({
              id: "fixed_cost",
              label: `${toggleState.fixedCost ? "▼" : "▶"} 固定費`,
              budget: (row) => row.fixedCost,
              actual: (row) => row.actualFixedCost,
              source: "freee PL",
              bold: true,
              onToggle: () => switchToggle("fixedCost"),
            })}
            {toggleState.fixedCost &&
              Array.from(new Set(rows.flatMap((row) => row.fixedCostDetails.map((detail) => detail.name)))).map((name) =>
                detailRow(name, (row) => row.fixedCostDetails.find((detail) => detail.name === name)?.amount || 0)
              )}

            {renderComparisonGroup({
              id: "payment_obligations",
              label: `${toggleState.obligations ? "▼" : "▶"} 支払義務`,
              budget: (row) => row.obligationPaymentTotal || 0,
              source: "義務台帳・追加分のみCF反映",
              bold: true,
              onToggle: () => switchToggle("obligations"),
            })}
            {toggleState.obligations && obligationDetails.map((detail) => {
              const due = detail.dueDate ?? `${String(detail.expectedPaymentYm).slice(0, 4)}年${Number(String(detail.expectedPaymentYm).slice(4, 6))}月`;
              const treatment = detail.cashflowTreatment === "additive" ? "追加流出" : "予算内";
              const amountState = detail.amountStatus === "unknown" ? "・金額確認中" : detail.amountStatus === "estimated" ? "・概算" : "";
              return detailRow(`${detail.title}・${due}・${treatment}${amountState}`, (row) =>
                row.obligationDetails?.find((item) => item.obligationId === detail.obligationId)?.amountYen ?? 0
              );
            })}

            {[
              { label: "社保", key: "socialIns" as const, actualKey: "actualSocialIns" as const },
              { label: "臨時収入", key: "spotIncome" as const, actualKey: "actualSpotIncome" as const },
              { label: "臨時支出", key: "spotExpense" as const, actualKey: "actualSpotExpense" as const },
              { label: "営業利益", key: "operatingProfit" as const, actual: actualOperatingProfit, bold: true, highlight: true },
              { label: "融資実行", key: "loanDisbursement" as const, actualKey: "actualLoanDisbursement" as const },
              { label: "借入返済", key: "loanPayment" as const, actualKey: "actualLoanPayment" as const },
              { label: "（うち利息）", key: "loanInterest" as const, actualKey: "actualLoanInterest" as const },
              { label: "消費税", key: "ctaxPayment" as const, actualKey: "actualCtaxPayment" as const, refund: true },
              { label: "法人税", key: "corpTaxPayment" as const, actualKey: "actualCorpTaxPayment" as const },
              { label: "月次CF", key: "netCashFlow" as const, bold: true, highlight: true, actualKey: "actualNetCashFlow" as const },
              { label: "支払い", key: "cashOutflow" as const, actual: actualCashOutflow, bold: true },
              { label: "キャッシュ", key: "cashBalance" as const, bold: true },
            ].map((def) =>
              renderComparisonGroup({
                id: def.key,
                label: def.label,
                budget: (row) => row[def.key],
                actual:
                  "actual" in def
                    ? def.actual
                    : "actualKey" in def
                      ? (row) => Number(row[def.actualKey as keyof GasMonthlyRow] ?? 0)
                      : def.key === "cashBalance"
                        ? (row) => row.actualCashBalance
                      : undefined,
                source:
                  def.key === "netCashFlow"
                    ? "入金確認 - 支払/費用"
                    : def.key === "cashOutflow"
                      ? "freee取引履歴（未分類を含む）"
                      : def.key === "cashBalance"
                        ? "freee口座残高"
                      : "actualKey" in def
                        ? "freee仕訳・取引履歴"
                        : "未連携",
                bold: def.bold,
                highlight: def.highlight,
                refund: def.refund,
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
