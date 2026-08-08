"use client";

import { useMemo } from "react";
import type { LongRangeProjection, LongRangeAnnualRow } from "@/lib/finance/longrange-projection";

function m(value: number): string {
  return (value / 1_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
}
function oku(value: number): string {
  return (value / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

type RowDef = {
  key: string;
  label: string;
  get: (r: LongRangeAnnualRow) => number;
  fmt?: (r: LongRangeAnnualRow) => string;
  kind?: "bold" | "sub" | "neg" | "highlight" | "cash";
};

const PL_ROWS: RowDef[] = [
  { key: "revenue", label: "売上", get: (r) => r.revenue, kind: "bold" },
  { key: "fundFee", label: "└ うちファンド管理報酬", get: (r) => r.fundFee, kind: "sub" },
  { key: "varCost", label: "変動費（業務原価）", get: (r) => -r.varCost, kind: "neg" },
  { key: "grossProfit", label: "粗利", get: (r) => r.grossProfit, kind: "bold" },
  { key: "grossMargin", label: "└ 粗利率", get: (r) => r.grossMarginPct, fmt: (r) => `${r.grossMarginPct}%`, kind: "sub" },
  { key: "fixedCost", label: "固定費（体制・SG&A）", get: (r) => -r.fixedCost, kind: "neg" },
  { key: "operatingProfit", label: "営業利益", get: (r) => r.operatingProfit, kind: "bold" },
  { key: "tax", label: "税", get: (r) => -r.tax, kind: "neg" },
  { key: "fcf", label: "FCF（年次）", get: (r) => r.fcf, kind: "highlight" },
  { key: "cashEnd", label: "期末キャッシュ（累計）", get: (r) => r.cashEnd, kind: "cash" },
];

const KPI_ROWS: RowDef[] = [
  { key: "os", label: "OS導入機関数", get: (r) => r.osInstitutions, fmt: (r) => `${r.osInstitutions}` },
  { key: "partner", label: "連携機関数", get: (r) => r.partnerInstitutions, fmt: (r) => `${r.partnerInstitutions}` },
  { key: "aum", label: "ファンド運用額（億円）", get: (r) => r.fundAum, fmt: (r) => (r.fundAum > 0 ? oku(r.fundAum) : "–") },
  { key: "papers", label: "査読論文（累積）", get: (r) => r.papersCumulative, fmt: (r) => `${r.papersCumulative}` },
];

export function LongRangeProjectionPanel({ projection }: { projection: LongRangeProjection }) {
  const { annual, monthly, totals } = projection;

  const spark = useMemo(() => {
    if (monthly.length === 0) return null;
    const w = 720;
    const h = 90;
    const pad = 4;
    const cash = monthly.map((p) => p.cashBalance);
    const min = Math.min(0, ...cash);
    const max = Math.max(...cash, 1);
    const x = (i: number) => pad + (i / (monthly.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    const line = cash.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `${line} L${x(cash.length - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;
    const fyTicks = annual.map((row, idx) => ({ label: `'${String(row.fy).slice(2)}`, xPos: x(idx * 12) }));
    return { w, h, line, area, fyTicks, zeroY: y(0), showZero: min < 0 };
  }, [monthly, annual]);

  const cell = (r: RowDef, row: LongRangeAnnualRow) => {
    const raw = r.get(row);
    const text = r.fmt ? r.fmt(row) : m(raw);
    const cls = ["num", r.kind === "bold" || r.kind === "highlight" || r.kind === "cash" ? "b" : "", r.kind === "sub" ? "sub" : "", r.kind === "neg" ? "neg" : "", r.kind === "highlight" ? "hl" : ""].filter(Boolean).join(" ");
    return (
      <td key={`${r.key}_${row.fy}`} className={cls}>
        {text}
      </td>
    );
  };

  return (
    <section className="lr-panel">
      <style jsx>{`
        .lr-panel {
          background: #fff;
          border: 1px solid #e0e4ec;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
          font-family: "Yu Gothic", "Meiryo", sans-serif;
          color: #1a1a1a;
        }
        .lr-head {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 4px;
        }
        .lr-title {
          font-size: 15px;
          font-weight: 700;
          color: #1b3a6b;
        }
        .lr-unit {
          font-size: 11px;
          color: #888;
        }
        .lr-sub {
          font-size: 12px;
          color: #667085;
          line-height: 1.6;
          margin: 0 0 12px;
        }
        .lr-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 0 0 14px;
        }
        .lr-kpi {
          border: 1px solid #e0e4ec;
          border-radius: 8px;
          background: #f8f9fc;
          padding: 9px 11px;
        }
        .lr-kpi .k {
          font-size: 10px;
          color: #777;
        }
        .lr-kpi .v {
          font-size: 18px;
          font-weight: 700;
          color: #1b3a6b;
          font-variant-numeric: tabular-nums;
          margin-top: 1px;
        }
        .spark-wrap {
          margin: 0 0 14px;
        }
        .spark-label {
          font-size: 11px;
          color: #777;
          margin-bottom: 3px;
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
          background: #1b3a6b;
          padding: 7px 10px;
          white-space: nowrap;
          text-align: right;
          position: sticky;
          top: 0;
        }
        th.item {
          text-align: left;
          left: 0;
          z-index: 3;
          min-width: 176px;
        }
        td {
          padding: 6px 10px;
          border-bottom: 1px solid #eef0f4;
          white-space: nowrap;
        }
        td.item {
          position: sticky;
          left: 0;
          background: #fff;
          z-index: 1;
          color: #333;
        }
        .num {
          text-align: right;
          font-family: "Consolas", "SFMono-Regular", monospace;
          font-variant-numeric: tabular-nums;
        }
        .b {
          font-weight: 700;
        }
        td.item.b {
          color: #111;
        }
        .sub td,
        td.sub {
          color: #8a90a0;
          font-size: 11px;
        }
        tr.sub td.item {
          color: #8a90a0;
          padding-left: 18px;
          font-size: 11px;
        }
        .neg {
          color: #c0392b;
        }
        .hl {
          color: #0f6b45;
        }
        tr.hl-row td {
          background: #f2fbf6;
        }
        tr.cash-row td {
          background: #f5f8ff;
          border-top: 1px solid #d8e0ea;
        }
        .kpi-divider td {
          background: #fafbfd;
          color: #99a;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 5px 10px;
          border-top: 2px solid #e0e4ec;
        }
        .lr-foot {
          margin-top: 12px;
          font-size: 11px;
          color: #667085;
          line-height: 1.7;
        }
        .lr-foot b {
          color: #1b3a6b;
        }
        @media (max-width: 900px) {
          .lr-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="lr-head">
        <div className="lr-title">長期戦略試算表 — FY2026〜FY2035（月次モデル・年次集計）</div>
        <div className="lr-unit">単位: 百万円（ファンド運用額のみ億円）</div>
      </div>
      <p className="lr-sub">
        中期経営計画の KPI 目標（売上・フリーCF）をアンカーに、原価・固定費を整合させたトップダウンの長期試算表。
        上の運用試算表（18ヶ月・freee実績連動・積み上げ）とは独立で、近未来のキャッシュ管理には影響しない。
      </p>

      <div className="lr-strip">
        <div className="lr-kpi">
          <div className="k">FY2035 売上</div>
          <div className="v">¥{m(annual.at(-1)?.revenue ?? 0)}M</div>
        </div>
        <div className="lr-kpi">
          <div className="k">FY2035 FCF</div>
          <div className="v">¥{m(annual.at(-1)?.fcf ?? 0)}M</div>
        </div>
        <div className="lr-kpi">
          <div className="k">累積FCF（10年）</div>
          <div className="v">¥{m(totals.cumFcf)}M</div>
        </div>
        <div className="lr-kpi">
          <div className="k">FY2035 期末キャッシュ</div>
          <div className="v">¥{m(totals.cashEnd)}M</div>
        </div>
      </div>

      {spark && (
        <div className="spark-wrap">
          <div className="spark-label">月次キャッシュ推移（120ヶ月・FY2026-01 → FY2035-12）</div>
          <svg viewBox={`0 0 ${spark.w} ${spark.h}`} width="100%" height={spark.h} preserveAspectRatio="none" role="img" aria-label="月次キャッシュ推移">
            <path d={spark.area} fill="rgba(27,58,107,0.08)" stroke="none" />
            {spark.showZero && <line x1="0" x2={spark.w} y1={spark.zeroY} y2={spark.zeroY} stroke="#d0d5dd" strokeWidth="1" strokeDasharray="3 3" />}
            <path d={spark.line} fill="none" stroke="#1b3a6b" strokeWidth="2" />
            {spark.fyTicks.map((t) => (
              <text key={t.label} x={t.xPos} y={spark.h - 1} fontSize="8" fill="#9aa3b2" textAnchor="middle">
                {t.label}
              </text>
            ))}
          </svg>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="item">項目</th>
              {annual.map((row) => (
                <th key={row.fy}>FY{String(row.fy).slice(2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PL_ROWS.map((r) => (
              <tr key={r.key} className={r.kind === "highlight" ? "hl-row" : r.kind === "cash" ? "cash-row" : r.kind === "sub" ? "sub" : ""}>
                <td className={`item ${r.kind === "bold" || r.kind === "highlight" || r.kind === "cash" ? "b" : ""}`}>{r.label}</td>
                {annual.map((row) => cell(r, row))}
              </tr>
            ))}
            <tr className="kpi-divider">
              <td className="item">KPI 併記</td>
              {annual.map((row) => (
                <td key={`kd_${row.fy}`} />
              ))}
            </tr>
            {KPI_ROWS.map((r) => (
              <tr key={r.key}>
                <td className="item">{r.label}</td>
                {annual.map((row) => cell(r, row))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lr-foot">
        年次FCFは戦略デック（amd_strategy）準拠で <b>FY2026 +¥2M → FY2035 +¥50M</b>、10年累積 <b>¥{m(totals.cumFcf)}M</b>。
        売上とFCFの2つを目標に固定し、変動費（物差しシフトで逓減）・固定費（体制拡大の残差）を整合させて導出している。
        目標値の編集は <code>company_longrange_targets</code>、原価率などの前提は <code>longrange-projection.ts</code>。
      </div>
    </section>
  );
}
