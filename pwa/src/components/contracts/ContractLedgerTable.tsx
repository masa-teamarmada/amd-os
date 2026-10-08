"use client";

import { useState } from "react";

export type ContractTableRow = {
  id: string;
  project: string;
  title: string;
  counterparty: string;
  type: string;
  status: string;
  signature: string;
  signatureTone: "complete" | "needs_proof" | "incomplete";
  signedDate: string;
  startDate: string;
  endDate: string;
  renewal: string;
  renewalNotice: string;
  totalAmount: string;
  monthlyAmount: string;
  payment: string;
  tax: string;
  scope: string;
  deliverables: string;
  acceptance: string;
  expense: string;
  report: string;
  ip: string;
  usage: string;
  confidentiality: string;
  subcontracting: string;
  exclusivity: string;
  termination: string;
  liability: string;
  jurisdiction: string;
  owner: string;
  current: string;
  review: string;
  reviewCount: number;
  document: { label: string; url: string } | null;
};

type TextKey = Exclude<keyof ContractTableRow, "id" | "signatureTone" | "reviewCount" | "document">;
type Column = { key: TextKey | "document"; label: string; width: number; numeric?: boolean };
export type ContractTableView = "basic" | "terms" | "all";

// Each column has one meaning. Dates, status and signature evidence stay independent.
const COLUMNS: Column[] = [
  { key: "project", label: "PJ", width: 112 },
  { key: "title", label: "契約名", width: 260 },
  { key: "counterparty", label: "相手先", width: 220 },
  { key: "type", label: "種別", width: 96 },
  { key: "status", label: "状態", width: 120 },
  { key: "signature", label: "押印証跡", width: 104 },
  { key: "signedDate", label: "締結日", width: 112 },
  { key: "startDate", label: "開始日", width: 112 },
  { key: "endDate", label: "終了日", width: 112 },
  { key: "renewal", label: "更新条件", width: 220 },
  { key: "renewalNotice", label: "更新通知期限", width: 120 },
  { key: "totalAmount", label: "契約額", width: 148, numeric: true },
  { key: "monthlyAmount", label: "月額", width: 128, numeric: true },
  { key: "payment", label: "支払条件", width: 220 },
  { key: "tax", label: "税・源泉", width: 180 },
  { key: "scope", label: "業務範囲・目的", width: 260 },
  { key: "deliverables", label: "成果物", width: 220 },
  { key: "acceptance", label: "検収", width: 200 },
  { key: "expense", label: "立替・実費", width: 200 },
  { key: "report", label: "報告義務", width: 200 },
  { key: "ip", label: "知財帰属", width: 200 },
  { key: "usage", label: "利用権", width: 200 },
  { key: "confidentiality", label: "秘密保持", width: 240 },
  { key: "subcontracting", label: "再委託", width: 200 },
  { key: "exclusivity", label: "独占・競業", width: 200 },
  { key: "termination", label: "解除条件", width: 220 },
  { key: "liability", label: "責任・賠償", width: 220 },
  { key: "jurisdiction", label: "準拠法・管轄", width: 200 },
  { key: "owner", label: "担当", width: 120 },
  { key: "current", label: "PJ現行", width: 96 },
  { key: "document", label: "契約書", width: 200 },
  { key: "review", label: "確認事項", width: 220 },
];
const BASIC_KEYS = new Set<Column["key"]>(["project", "title", "counterparty", "type", "status", "signature", "signedDate", "startDate", "endDate", "totalAmount", "monthlyAmount", "payment", "document", "review"]);
const TERMS_KEYS = new Set<Column["key"]>(["project", "title", "counterparty", "renewal", "renewalNotice", "totalAmount", "monthlyAmount", "payment", "tax", "scope", "deliverables", "acceptance", "expense", "report", "ip", "usage", "confidentiality", "subcontracting", "exclusivity", "termination", "liability", "jurisdiction", "owner", "current", "document", "review"]);
const VIEWS: Array<{ value: ContractTableView; label: string }> = [{ value: "basic", label: "基本情報" }, { value: "terms", label: "実務条件" }, { value: "all", label: "全項目" }];

export function ContractLedgerTable({ rows, onOpen, loading = false, initialView = "basic" }: { rows: ContractTableRow[]; onOpen: (id: string) => void; loading?: boolean; initialView?: ContractTableView }) {
  const [view, setView] = useState<ContractTableView>(initialView);
  const columns = COLUMNS.filter(column => view === "all" || (view === "basic" ? BASIC_KEYS : TERMS_KEYS).has(column.key));
  const width = columns.reduce((sum, column) => sum + column.width, 0);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2" role="group" aria-label="表の表示項目">
          <span className="text-xs text-slate-600">表示項目</span>
          <div className="flex rounded-md border border-slate-200 p-0.5">
            {VIEWS.map(option => <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => setView(option.value)} className={`min-h-11 rounded px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 sm:min-h-8 ${view === option.value ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{option.label}</button>)}
          </div>
        </div>
        <span className="text-xs text-slate-500">{rows.length}件 · 横にスクロールして比較</span>
      </div>
      <div className="[--contract-title-width:180px] sm:[--contract-title-width:260px] [scroll-padding-left:var(--contract-title-width)] sm:[scroll-padding-left:calc(var(--contract-title-width)+112px)] isolate max-h-[70vh] w-full overflow-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500" role="region" aria-label="契約台帳の比較表" tabIndex={0} aria-busy={loading}>
        <table className="table-fixed border-collapse text-left text-xs leading-5" style={{ width: `calc(${width - 260}px + var(--contract-title-width))` }}>
          <caption className="sr-only">契約台帳。1行1契約、項目ごとの列で比較。契約名から詳細を開く。</caption>
          <colgroup>{columns.map(column => <col key={column.key} style={{ width: column.key === "title" ? "var(--contract-title-width)" : column.width }} />)}</colgroup>
          <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600">
            <tr>{columns.map(column => <th key={column.key} scope="col" className={`border-b border-r border-slate-200 px-3 py-2 font-semibold ${column.key === "project" ? "sm:sticky sm:left-0 z-30 bg-slate-100" : column.key === "title" ? "sticky left-0 sm:left-28 z-30 bg-slate-100 shadow-[4px_0_6px_-5px_rgba(15,23,42,0.4)]" : ""} ${column.numeric ? "text-right" : ""}`}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(row => <tr key={row.id} className="group bg-white even:bg-slate-50 hover:bg-slate-100 focus-within:bg-slate-100">
              {columns.map(column => {
                const value = column.key === "document" ? row.document?.label || "未登録" : row[column.key];
                const color = column.key === "signature" ? (row.signatureTone === "complete" ? "text-emerald-700" : row.signatureTone === "needs_proof" ? "text-rose-700" : "text-slate-600") : column.key === "review" && row.reviewCount > 0 ? "text-amber-800" : "text-slate-800";
                return <td key={column.key} className={`border-b border-r border-slate-200 px-3 py-2 align-middle ${column.key === "project" ? "sm:sticky sm:left-0 z-10 bg-white group-even:bg-slate-50 group-hover:bg-slate-100 group-focus-within:bg-slate-100" : column.key === "title" ? "sticky left-0 sm:left-28 z-10 bg-white shadow-[4px_0_6px_-5px_rgba(15,23,42,0.4)] group-even:bg-slate-50 group-hover:bg-slate-100 group-focus-within:bg-slate-100" : ""} ${column.numeric ? "text-right tabular-nums" : ""}`}>
                  {column.key === "title" ? <button type="button" onClick={() => onOpen(row.id)} aria-label={`${row.project} ${row.title} の詳細を開く`} title={row.title} className="flex min-h-11 w-full items-center text-left font-semibold text-slate-900 underline-offset-4 hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500"><span className="line-clamp-2">{row.title}</span></button>
                    : column.key === "document" && row.document ? <a href={row.document.url} target="_blank" rel="noreferrer" title={row.document.label} className="flex min-h-11 items-center text-sky-800 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"><span className="line-clamp-2">{row.document.label}</span></a>
                      : <span title={value} className={`line-clamp-2 break-words ${color}`}>{value}</span>}
                </td>;
              })}
            </tr>)}
            {rows.length === 0 && <tr><td colSpan={columns.length} className="h-24 px-3 text-slate-500">{loading ? "契約を読み込み中…" : "該当する契約なし"}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
