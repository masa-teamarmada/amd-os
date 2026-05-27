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
  externalMember?: number;
  internalMember?: number;
};

export type GasFixedCostDetail = {
  name: string;
  amount: number;
};

export type GasMonthlyRow = {
  ym: number;
  revenue: number;
  costMember: number;
  costCloser: number;
  grossProfit: number;
  fixedCost: number;
  socialIns: number;
  operatingProfit: number;
  loanPayment: number;
  loanInterest: number;
  ctaxPayment: number;
  corpTaxPayment: number;
  netCashFlow: number;
  cashBalance: number;
  runway: number;
  loanDisbursement: number;
  spotIncome: number;
  spotExpense: number;
  cashInflow: number;
  cashOutflow: number;
  pjDetails: GasProjectDetail[];
  fixedCostDetails: GasFixedCostDetail[];
};

export type GasSimulationResult = {
  params: { rateCloser?: number };
  rows: GasMonthlyRow[];
  projectList: GasProjectListItem[];
};

type SimulateResponse = {
  ok: boolean;
  error?: string;
  result?: MonthlyPlSimulationResult;
};

type ToggleState = {
  revenue: boolean;
  fixedCost: boolean;
  grossProfit: boolean;
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

export function GasMonthlySimulationPanel({ result, inputs }: { result: GasSimulationResult; inputs?: MonthlyPlInputs | null }) {
  const [displayResult, setDisplayResult] = useState<GasSimulationResult>(result);
  const [scenarioId, setScenarioId] = useState("");
  const [simRunning, setSimRunning] = useState(false);
  const [simStatus, setSimStatus] = useState("");
  const [toggleState, setToggleState] = useState<ToggleState>({
    revenue: false,
    fixedCost: false,
    grossProfit: false,
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
      cash: last?.cashBalance ?? 0,
      runway: rows[0]?.runway ?? null,
    };
  }, [rows]);

  useEffect(() => {
    if (!canvasRef.current || rows.length === 0) return;
    chartRef.current?.destroy();
    const labels = rows.map((row) => fmtYm(row.ym));
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "キャッシュ残高",
            data: rows.map((row) => row.cashBalance),
            borderColor: "#1b3a6b",
            backgroundColor: "rgba(27,58,107,0.05)",
            fill: true,
            borderWidth: 2.5,
            pointRadius: 2,
            order: 1,
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
            order: 2,
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
            order: 2,
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
  }, [rows]);

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
      setDisplayResult(json.result);
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
        return (
          <td key={`${label}_${row.ym}`} className="num gas-detail-num">
            {value > 0 ? fmt(value) : "-"}
          </td>
        );
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
          height: 220px;
        }
        .table-wrap {
          overflow-x: auto;
          max-height: 500px;
          overflow-y: auto;
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
        tr:hover td {
          background: #f0f4ff;
        }
        .num {
          text-align: right;
          font-family: "Consolas", monospace;
        }
        .head-item {
          position: sticky;
          left: 0;
          top: 0;
          z-index: 3;
          background: #1b3a6b;
          min-width: 120px;
          text-align: left;
        }
        .head-month {
          position: sticky;
          top: 0;
          z-index: 2;
          background: #1b3a6b;
          min-width: 90px;
          text-align: right;
        }
        .toggle-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #fff;
          font-weight: bold;
          cursor: pointer;
        }
        .plain-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #fff;
        }
        .bold-label {
          font-weight: bold;
        }
        .gas-detail-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f8f9fc;
          padding-left: 20px;
          color: #555;
          font-size: 11px;
        }
        .gas-detail-num {
          color: #555;
          font-size: 11px;
        }
        .gas-cost-label {
          position: sticky;
          left: 0;
          z-index: 1;
          background: #f8f9fc;
          padding-left: 30px;
          color: #c0392b;
          font-size: 10px;
        }
        .gas-cost-num {
          color: #c0392b;
          font-size: 10px;
        }
        .indent-label {
          padding-left: 20px;
          color: #888;
          font-size: 11px;
        }
        .negative {
          color: #c0392b;
        }
        .refund {
          color: #2980b9;
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
            <div className="label">最終キャッシュ残高</div>
            <div className={`value ${kpis.cash < 0 ? "negative" : ""}`}>{kpiYen(kpis.cash)}</div>
          </div>
          <div className="kpi">
            <div className="label">現在のランウェイ</div>
            <div className="value">{kpis.runway == null ? "-" : `${kpis.runway}ヶ月`}</div>
          </div>
        </div>
        <div className="chart-wrap">
          <canvas ref={canvasRef} height="220" />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="head-item">項目</th>
              {rows.map((row) => (
                <th key={row.ym} className="head-month">
                  {fmtYm(row.ym)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="toggle-label" onClick={() => switchToggle("revenue")}>
                {toggleState.revenue ? "▼" : "▶"} 売上計
              </td>
              {rows.map((row) => (
                <td key={`revenue_${row.ym}`} className={`num ${row.revenue < 0 ? "negative" : ""}`} style={{ fontWeight: "bold" }}>
                  {fmt(row.revenue)}
                </td>
              ))}
            </tr>
            {toggleState.revenue &&
              pjList.flatMap((pj, pi) => {
                const revenueRow = detailRow(pj.projectName, (row) => row.pjDetails[pi]?.revenue || 0);
                const costRow = (
                  <tr key={`${pj.projectId}_cost`}>
                    <td className="gas-cost-label">原価</td>
                    {rows.map((row) => {
                      const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0 };
                      const closerExt = det.revenue > 0 && !pj.closerInternal ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05)) : 0;
                      const cost = (det.externalMember || 0) + closerExt;
                      return (
                        <td key={`${pj.projectId}_cost_${row.ym}`} className="num gas-cost-num">
                          {cost > 0 ? `-${fmt(cost)}` : "-"}
                        </td>
                      );
                    })}
                  </tr>
                );
                return [revenueRow, costRow];
              })}

            <tr>
              <td className="plain-label">売上原価</td>
              {rows.map((row) => (
                <td key={`cost_${row.ym}`} className="num">
                  {fmt(row.costMember + row.costCloser)}
                </td>
              ))}
            </tr>

            <tr>
              <td className="toggle-label" onClick={() => switchToggle("grossProfit")}>
                {toggleState.grossProfit ? "▼" : "▶"} 粗利
              </td>
              {rows.map((row) => (
                <td key={`gross_${row.ym}`} className={`num ${row.grossProfit < 0 ? "negative" : ""}`} style={{ fontWeight: "bold" }}>
                  {fmt(row.grossProfit)}
                </td>
              ))}
            </tr>
            {toggleState.grossProfit &&
              pjList.map((pj, pi) =>
                detailRow(pj.projectName, (row) => {
                  const det = row.pjDetails[pi] || { revenue: 0, externalMember: 0 };
                  const closerExt = det.revenue > 0 && !pj.closerInternal ? Math.round(det.revenue * (result.params.rateCloser ?? 0.05)) : 0;
                  return det.revenue - (det.externalMember || 0) - closerExt;
                })
              )}

            <tr>
              <td className="toggle-label" onClick={() => switchToggle("fixedCost")}>
                {toggleState.fixedCost ? "▼" : "▶"} 固定費
              </td>
              {rows.map((row) => (
                <td key={`fixed_${row.ym}`} className={`num ${row.fixedCost < 0 ? "negative" : ""}`} style={{ fontWeight: "bold" }}>
                  {fmt(row.fixedCost)}
                </td>
              ))}
            </tr>
            {toggleState.fixedCost &&
              Array.from(new Set(rows.flatMap((row) => row.fixedCostDetails.map((detail) => detail.name)))).map((name) =>
                detailRow(name, (row) => row.fixedCostDetails.find((detail) => detail.name === name)?.amount || 0)
              )}

            {[
              { label: "社保", key: "socialIns" as const },
              { label: "臨時収入", key: "spotIncome" as const },
              { label: "臨時支出", key: "spotExpense" as const },
              { label: "営業利益", key: "operatingProfit" as const, bold: true, highlight: true },
              { label: "融資実行", key: "loanDisbursement" as const },
              { label: "借入返済", key: "loanPayment" as const },
              { label: "（うち利息）", key: "loanInterest" as const, indent: true },
              { label: "消費税", key: "ctaxPayment" as const, refund: true },
              { label: "法人税", key: "corpTaxPayment" as const },
              { label: "月次CF", key: "netCashFlow" as const, bold: true, highlight: true },
              { label: "キャッシュ", key: "cashBalance" as const, bold: true },
            ].map((def) => (
              <tr key={def.key}>
                <td className={`plain-label ${def.bold ? "bold-label" : ""} ${def.indent ? "indent-label" : ""}`}>{def.label}</td>
                {rows.map((row) => {
                  const value = row[def.key];
                  const className = [
                    "num",
                    def.highlight && value < 0 ? "negative" : "",
                    def.refund && value < 0 ? "refund" : "",
                    def.bold ? "bold-label" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  const display = def.refund && value < 0 ? `${fmt(Math.abs(value))}（還付）` : fmt(value);
                  return (
                    <td key={`${def.key}_${row.ym}`} className={className}>
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
