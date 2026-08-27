"use client";

/**
 * 「02 請求書」— 状態の確認だけ。
 *
 * 本体が billing_cycles に書いた請求書の状態をそのまま出す。
 * 発行（freee に実際の請求書を作る操作）はここに置かない。本体の
 * /admin/kiyo?task=invoices でやる。ここは「出したか / 送ったか / 入金したか」を見る画面。
 */

import { useCallback, useEffect, useState } from "react";
import { shiftYm, ymLabel } from "@/lib/ym";

type Row = {
  projectId: string;
  projectName: string;
  clientName: string | null;
  ym: string;
  invoiceYm: string | null;
  status: string | null;
  amountYen: number;
  subject: string | null;
  freeeInvoiceNumber: string | null;
  issuedAt: string | null;
  sentAt: string | null;
  paymentConfirmedAt: string | null;
};

type ApiData = {
  ok?: boolean;
  error?: string;
  ym: string;
  rows: Row[];
  summary: {
    cycleCount: number;
    issuedCount: number;
    sentCount: number;
    paidCount: number;
    totalAmountYen: number;
  };
};

const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const jstDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ja-JP") : null);

export function InvoicesClient({ initialYm }: { initialYm: string }) {
  const [ym, setYm] = useState(initialYm);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetYm: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kiyo/invoices?ym=${encodeURIComponent(targetYm)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiData;
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
    void load(initialYm);
  }, [initialYm, load]);

  const goYm = (next: string) => {
    setYm(next);
    void load(next);
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goYm(shiftYm(ym, -1))}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          >
            ←
          </button>
          <span className="w-28 text-center text-sm font-medium">{ymLabel(ym)}</span>
          <button
            onClick={() => goYm(shiftYm(ym, 1))}
            className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100"
          >
            →
          </button>
        </div>
        <button
          onClick={() => void load(ym)}
          disabled={loading}
          className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "読み込み中..." : "最新に更新"}
        </button>
      </div>

      <div className="mt-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
        ここは<strong>確認だけ</strong>。請求書を出す操作は AMD OS 本体でやる
        （freee に本物の請求書を作るため）。
      </div>

      {error && (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Box label="対象PJ-月" value={`${summary?.cycleCount ?? 0}件`} sub={`前後1ヶ月ぶんを含む`} />
        <Box label="発行済み" value={`${summary?.issuedCount ?? 0}件`} />
        <Box label="送付済み" value={`${summary?.sentCount ?? 0}件`} />
        <Box label="入金確認済み" value={`${summary?.paidCount ?? 0}件`} sub={yen(summary?.totalAmountYen ?? 0)} />
      </section>

      <section className="mt-3 overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">PJ / クライアント</th>
              <th className="px-3 py-2 text-left font-medium">対象月</th>
              <th className="px-3 py-2 text-right font-medium">金額</th>
              <th className="px-3 py-2 text-left font-medium">freee</th>
              <th className="px-3 py-2 text-left font-medium">発行 / 送付 / 入金</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  {loading ? "読み込み中..." : `${ymLabel(ym)} 前後の請求はない`}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.projectId}:${row.ym}`} className="align-top">
                  <td className="px-3 py-3">
                    <div className="text-sm">{row.projectName}</div>
                    {row.clientName && (
                      <div className="text-[11px] text-slate-500">{row.clientName}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <div>{ymLabel(row.ym)}分</div>
                    {row.invoiceYm && row.invoiceYm !== row.ym && (
                      <div className="text-[11px] text-slate-500">請求 {ymLabel(row.invoiceYm)}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums">{yen(row.amountYen)}</td>
                  <td className="px-3 py-3 text-xs">
                    {row.freeeInvoiceNumber ? (
                      <span className="font-mono text-[11px]">{row.freeeInvoiceNumber}</span>
                    ) : (
                      <span className="text-slate-400">未発行</span>
                    )}
                    {row.subject && (
                      <div className="truncate text-[11px] text-slate-500">{row.subject}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[11px]">
                    <Step label="発行" at={jstDate(row.issuedAt)} />
                    <Step label="送付" at={jstDate(row.sentAt)} />
                    <Step label="入金" at={jstDate(row.paymentConfirmedAt)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Step({ label, at }: { label: string; at: string | null }) {
  return (
    <div className={at ? "text-slate-700" : "text-slate-400"}>
      {at ? "✓" : "—"} {label}
      {at && <span className="ml-1 text-slate-500">{at}</span>}
    </div>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
