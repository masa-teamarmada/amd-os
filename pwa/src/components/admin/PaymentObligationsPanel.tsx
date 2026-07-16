"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Save } from "lucide-react";
import type { CompanyPaymentObligation } from "@/lib/finance/payment-obligations";

type Props = { initialObligations: CompanyPaymentObligation[] };

type Draft = {
  title: string;
  counterparty: string;
  category: string;
  amount_yen: number | null;
  amount_status: "exact" | "estimated" | "unknown";
  due_date: string;
  due_date_precision: "day" | "month" | "unknown";
  expected_payment_ym: string;
  cashflow_treatment: "additive" | "included_in_budget";
  auto_debit: boolean | null;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  counterparty: "",
  category: "other",
  amount_yen: null,
  amount_status: "unknown",
  due_date: "",
  due_date_precision: "unknown",
  expected_payment_ym: "",
  cashflow_treatment: "additive",
  auto_debit: null,
};

function yen(value: number | null): string {
  return value == null ? "未確認" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function dueLabel(row: CompanyPaymentObligation): string {
  if (row.due_date) return row.due_date;
  if (row.expected_payment_ym) return `${row.expected_payment_ym.slice(0, 4)}-${row.expected_payment_ym.slice(4, 6)}`;
  return "未確認";
}

function statusTone(status: string): string {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "needs_review") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-border bg-muted text-muted-foreground";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

export function PaymentObligationsPanel({ initialObligations }: Props) {
  const [rows, setRows] = useState(initialObligations);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const totals = useMemo(() => {
    const active = rows.filter((row) => row.status !== "paid" && row.status !== "cancelled");
    return {
      active: active.length,
      needsReview: active.filter((row) => row.status === "needs_review").length,
      additiveYen: active.reduce((sum, row) => sum + (row.cashflow_treatment === "additive" ? Number(row.amount_yen ?? 0) : 0), 0),
    };
  }, [rows]);

  const patchRow = (id: string, patch: Partial<CompanyPaymentObligation>) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  const save = async (row: CompanyPaymentObligation, override: Partial<CompanyPaymentObligation> = {}) => {
    setBusyId(row.id);
    setMessage("");
    try {
      const payload = { ...row, ...override };
      const response = await fetch("/api/admin/finance/obligations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      setRows((current) => current.map((item) => item.id === row.id ? json.obligation : item));
      setMessage("保存した");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    if (!draft.title.trim()) return;
    setCreating(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/finance/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || `HTTP ${response.status}`);
      setRows((current) => [...json.obligations, ...current]);
      setDraft(EMPTY_DRAFT);
      setMessage("追加した");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <section id="payment-obligations" className="space-y-3 border-b border-border pb-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-[15px] font-semibold">支払義務</h2>
          <div className="mt-1 flex gap-3 text-[12px] text-muted-foreground">
            <span>未完了 {totals.active}</span>
            <span className={totals.needsReview > 0 ? "font-medium text-amber-700" : ""}>要確認 {totals.needsReview}</span>
            <span>追加流出 {yen(totals.additiveYen)}</span>
          </div>
        </div>
        {message && <div className="ml-auto text-[12px] text-muted-foreground">{message}</div>}
      </div>

      <div className="grid gap-2 border-y border-border bg-muted/20 py-3 lg:grid-cols-[1.4fr_1fr_120px_130px_130px_150px_auto]">
        <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="支払内容" className="rounded border border-border bg-background px-2 py-1.5 text-[12px]" />
        <input value={draft.counterparty} onChange={(event) => setDraft((current) => ({ ...current, counterparty: event.target.value }))} placeholder="支払先" className="rounded border border-border bg-background px-2 py-1.5 text-[12px]" />
        <input type="number" value={draft.amount_yen ?? ""} onChange={(event) => setDraft((current) => ({ ...current, amount_yen: event.target.value ? Number(event.target.value) : null, amount_status: event.target.value ? "exact" : "unknown" }))} placeholder="金額" className="rounded border border-border bg-background px-2 py-1.5 text-[12px]" />
        <input type="date" value={draft.due_date} onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value, due_date_precision: event.target.value ? "day" : "unknown", expected_payment_ym: event.target.value ? event.target.value.slice(0, 7).replace("-", "") : current.expected_payment_ym }))} className="rounded border border-border bg-background px-2 py-1.5 text-[12px]" />
        <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} className="rounded border border-border bg-background px-2 py-1.5 text-[12px]">
          <option value="tax">税金</option><option value="social_insurance">社会保険</option><option value="invoice">請求</option><option value="reimbursement">経費精算</option><option value="reward">報酬</option><option value="subscription">継続支払</option><option value="loan">借入返済</option><option value="other">その他</option>
        </select>
        <select value={draft.cashflow_treatment} onChange={(event) => setDraft((current) => ({ ...current, cashflow_treatment: event.target.value as Draft["cashflow_treatment"] }))} className="rounded border border-border bg-background px-2 py-1.5 text-[12px]">
          <option value="additive">追加流出</option><option value="included_in_budget">予算内</option>
        </select>
        <button onClick={create} disabled={creating || !draft.title.trim()} className="inline-flex items-center justify-center gap-1 rounded bg-foreground px-3 py-1.5 text-[12px] text-background disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}追加
        </button>
      </div>

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[1080px] text-[12px]">
          <thead className="border-b border-border bg-muted/40">
            <tr><th className="px-3 py-2 text-left font-medium">支払内容</th><th className="px-3 py-2 text-left font-medium">金額</th><th className="px-3 py-2 text-left font-medium">期日</th><th className="px-3 py-2 text-left font-medium">区分</th><th className="px-3 py-2 text-left font-medium">資金繰り</th><th className="px-3 py-2 text-left font-medium">状態</th><th className="px-3 py-2 text-right font-medium">操作</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">支払義務はまだない</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-muted/20">
                <td className="px-3 py-2"><input value={row.title} onChange={(event) => patchRow(row.id, { title: event.target.value })} className="w-full min-w-56 rounded border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-border focus:border-border" /><input value={row.counterparty ?? ""} onChange={(event) => patchRow(row.id, { counterparty: event.target.value || null })} placeholder="支払先未確認" className="mt-1 w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-muted-foreground hover:border-border focus:border-border" /></td>
                <td className="px-3 py-2"><input type="number" value={row.amount_yen ?? ""} onChange={(event) => patchRow(row.id, { amount_yen: event.target.value ? Number(event.target.value) : null, amount_status: event.target.value ? row.amount_status === "estimated" ? "estimated" : "exact" : "unknown" })} className="w-28 rounded border border-border bg-background px-2 py-1 text-right font-mono" /><select value={row.amount_status} onChange={(event) => patchRow(row.id, { amount_status: event.target.value as CompanyPaymentObligation["amount_status"] })} className="mt-1 w-28 rounded border border-border bg-background px-2 py-1 text-[11px]"><option value="exact">確定</option><option value="estimated">概算</option><option value="unknown">未確認</option></select></td>
                <td className="px-3 py-2"><input type="date" value={row.due_date ?? ""} onChange={(event) => patchRow(row.id, { due_date: event.target.value || null, due_date_precision: event.target.value ? "day" : row.expected_payment_ym ? "month" : "unknown", expected_payment_ym: event.target.value ? event.target.value.slice(0, 7).replace("-", "") : row.expected_payment_ym })} className="w-36 rounded border border-border bg-background px-2 py-1" /><div className="mt-1 text-[11px] text-muted-foreground">{dueLabel(row)}</div></td>
                <td className="px-3 py-2"><select value={row.category} onChange={(event) => patchRow(row.id, { category: event.target.value })} className="w-32 rounded border border-border bg-background px-2 py-1"><option value="tax">税金</option><option value="social_insurance">社会保険</option><option value="payroll">給与</option><option value="invoice">請求</option><option value="reimbursement">経費精算</option><option value="reward">報酬</option><option value="subscription">継続支払</option><option value="loan">借入返済</option><option value="card_payment">カード支払</option><option value="other">その他</option></select><div className="mt-1 max-w-32 truncate font-mono text-[10px] text-muted-foreground">{row.source_kind}</div></td>
                <td className="px-3 py-2"><select value={row.cashflow_treatment} onChange={(event) => patchRow(row.id, { cashflow_treatment: event.target.value as CompanyPaymentObligation["cashflow_treatment"] })} className="w-32 rounded border border-border bg-background px-2 py-1"><option value="additive">追加流出</option><option value="included_in_budget">予算内</option></select></td>
                <td className="px-3 py-2"><select value={row.status} onChange={(event) => patchRow(row.id, { status: event.target.value as CompanyPaymentObligation["status"] })} className={`w-32 rounded border px-2 py-1 ${statusTone(row.status)}`}><option value="needs_review">要確認</option><option value="open">未払い</option><option value="scheduled">支払予定</option><option value="paid">支払済み</option><option value="cancelled">取消</option></select></td>
                <td className="px-3 py-2"><div className="flex justify-end gap-1"><button title="保存" onClick={() => save(row)} disabled={busyId === row.id} className="inline-flex h-8 w-8 items-center justify-center rounded border border-border hover:bg-muted disabled:opacity-50">{busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}</button>{row.status !== "paid" && row.status !== "cancelled" && <button title="支払済みにする" onClick={() => save(row, { status: "paid", paid_at: new Date().toISOString(), paid_amount_yen: row.amount_yen })} disabled={busyId === row.id} className="inline-flex h-8 w-8 items-center justify-center rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /></button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
