"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleDollarSign, Clock, FilePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminInvoiceIssueDialog } from "@/components/admin/AdminInvoiceIssueDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export interface InvoiceProjectRow {
  project_id: string;
  project_name: string;
  status: string;
  project_type: string | null;
  end_ym: string | null;
}

export interface BillingCycleRow {
  id: string;
  project_id: string;
  project_name: string;
  project_type: string | null;
  ym: string;
  invoice_ym: string | null;
  invoice_base_lines_json: string | null;
  invoice_subject: string | null;
  freee_invoice_number: string | null;
  invoice_pdf_url: string | null;
  status: string;
  budget_yen: number | null;
  budget_reported_amount: number | null;
  budget_confirmed_at: string | null;
  meeting_event_id: string | null;
  meeting_start_at: string | null;
  report_fixed_at: string | null;
  invoice_issued_at: string | null;
  invoice_sent_at: string | null;
  payout_notice_uploaded_at: string | null;
  payment_confirmed_at: string | null;
  reward_paid_at: string | null;
}

export interface ReimbursementRow {
  project_id: string;
  date: string;
  status: string | null;
}

type QueueFilter = "unissued" | "issued" | "sent" | "paid" | "all";

interface Props {
  cycles: BillingCycleRow[];
  reimbursements: ReimbursementRow[];
}

type InvoiceState = {
  key: Exclude<QueueFilter, "all">;
  label: string;
  tone: "amber" | "emerald" | "sky" | "slate";
  Icon: typeof FilePlus;
};

const supabase = createClient();

function ymDisplay(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function shortYm(ym: string | null) {
  if (!ym || ym.length < 6) return "-";
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
}

function todayJstKey() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function nextYm(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 12 ? `${y + 1}01` : `${y}${String(m + 1).padStart(2, "0")}`;
}

function ymd(ym: string, day: number) {
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, "0")}`;
}

function adjustBusinessDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date.toISOString().slice(0, 10);
}

function reimbursementDeadline(ym: string) {
  return adjustBusinessDay(ymd(nextYm(ym), 4));
}

function reimbursementCompletionMap(rows: ReimbursementRow[], cycles: BillingCycleRow[]) {
  const map = new Map<string, boolean>();
  const today = todayJstKey();
  for (const cycle of cycles) {
    map.set(`${cycle.project_id}_${cycle.ym}`, today >= reimbursementDeadline(cycle.ym));
  }
  for (const row of rows) {
    if (!row.date || row.date.length < 7) continue;
    const ym = `${row.date.slice(0, 4)}${row.date.slice(5, 7)}`;
    const key = `${row.project_id}_${ym}`;
    if (!map.has(key)) map.set(key, today >= reimbursementDeadline(ym));
    const status = (row.status || "").toLowerCase();
    if (status === "submitted" || status === "pmapproved") map.set(key, false);
  }
  return map;
}

function parseInvoiceLines(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Array<{
      type?: string;
      quantity?: string | number;
      qty?: string | number;
      unit_price?: string | number;
      unitPrice?: string | number;
      amount?: string | number;
    }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function invoiceNetAmount(row: BillingCycleRow) {
  const totalFromLines = parseInvoiceLines(row.invoice_base_lines_json).reduce((sum, line) => {
    if (line.type === "text") return sum;
    const quantity = Number(line.quantity ?? line.qty ?? 1) || 1;
    const unitPrice = Number(line.unit_price ?? line.unitPrice ?? line.amount ?? 0) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  if (totalFromLines > 0) return Math.round(totalFromLines);
  if (typeof row.budget_reported_amount === "number" && row.budget_reported_amount > 0) return Math.round(row.budget_reported_amount);
  if (typeof row.budget_yen === "number" && row.budget_yen > 0) return Math.round(row.budget_yen / 0.65);
  return null;
}

function yen(value: number | null) {
  if (value === null) return "-";
  return `¥${value.toLocaleString()}`;
}

function invoiceState(row: BillingCycleRow): InvoiceState {
  if (row.payment_confirmed_at) {
    return { key: "paid", label: "入金確認済み", tone: "slate", Icon: CircleDollarSign };
  }
  if (row.invoice_sent_at) {
    return { key: "sent", label: "送付済み", tone: "sky", Icon: Send };
  }
  if (row.invoice_issued_at) {
    return { key: "issued", label: "発行済み", tone: "emerald", Icon: Check };
  }
  return { key: "unissued", label: "発行待ち", tone: "amber", Icon: FilePlus };
}

function stateClass(tone: InvoiceState["tone"]) {
  switch (tone) {
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function invoiceSort(a: BillingCycleRow, b: BillingCycleRow) {
  const stateOrder: Record<InvoiceState["key"], number> = { unissued: 0, issued: 1, sent: 2, paid: 3 };
  const stateDiff = stateOrder[invoiceState(a).key] - stateOrder[invoiceState(b).key];
  if (stateDiff !== 0) return stateDiff;
  const invoiceYmDiff = (b.invoice_ym || b.ym).localeCompare(a.invoice_ym || a.ym);
  if (invoiceYmDiff !== 0) return invoiceYmDiff;
  return a.project_id.localeCompare(b.project_id);
}

function prerequisiteItems(row: BillingCycleRow, reimbursementDone: boolean) {
  return [
    { label: "予算", done: Boolean(row.budget_confirmed_at) },
    { label: "報告書", done: Boolean(row.report_fixed_at) },
    { label: "立替", done: reimbursementDone },
  ];
}

function StatusPill({ state }: { state: InvoiceState }) {
  const Icon = state.Icon;
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${stateClass(state.tone)}`}>
      <Icon className="size-3" />
      {state.label}
    </span>
  );
}

export function AdminInvoiceIssueQueue({ cycles, reimbursements }: Props) {
  const [rows, setRows] = useState(cycles);
  const [filter, setFilter] = useState<QueueFilter>("unissued");
  const [selected, setSelected] = useState<BillingCycleRow | null>(null);
  const [issuingTarget, setIssuingTarget] = useState<BillingCycleRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reimburseMap] = useState(() => reimbursementCompletionMap(reimbursements, cycles));

  const counts = useMemo(() => {
    const initial: Record<QueueFilter, number> = { unissued: 0, issued: 0, sent: 0, paid: 0, all: rows.length };
    for (const row of rows) initial[invoiceState(row).key] += 1;
    return initial;
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) => filter === "all" || invoiceState(row).key === filter)
      .sort(invoiceSort);
  }, [filter, rows]);

  function applyLocalPatch(projectId: string, ym: string, patch: Partial<BillingCycleRow>) {
    setRows((prev) => prev.map((row) => row.project_id === projectId && row.ym === ym ? { ...row, ...patch } : row));
    setSelected((prev) => prev && prev.project_id === projectId && prev.ym === ym ? { ...prev, ...patch } : prev);
    setIssuingTarget((prev) => prev && prev.project_id === projectId && prev.ym === ym ? { ...prev, ...patch } : prev);
  }

  async function saveInvoiceYm(row: BillingCycleRow, invoiceYm: string) {
    const nextValue = invoiceYm.replace(/\D/g, "").slice(0, 6) || row.ym;
    applyLocalPatch(row.project_id, row.ym, { invoice_ym: nextValue });
    const { error } = await supabase
      .from("billing_cycles")
      .update({ invoice_ym: nextValue })
      .eq("project_id", row.project_id)
      .eq("ym", row.ym);
    if (error) setMessage(error.message);
  }

  const filterItems: Array<{ key: QueueFilter; label: string }> = [
    { key: "unissued", label: "未発行" },
    { key: "issued", label: "発行済み" },
    { key: "sent", label: "送付済み" },
    { key: "paid", label: "入金済み" },
    { key: "all", label: "すべて" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`h-9 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
              filter === item.key
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {item.label} {counts[item.key]}
          </button>
        ))}
      </div>

      {message && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{message}</p>}

      <section aria-label="請求書発行キュー" className="overflow-x-auto rounded-lg border border-border bg-background">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[minmax(180px,1.5fr)_96px_96px_120px_150px_minmax(180px,1fr)_132px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>PJ</span>
            <span>稼働月</span>
            <span>請求月</span>
            <span className="text-right">請求額</span>
            <span>状態</span>
            <span>発行前確認</span>
            <span />
          </div>
          {visibleRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              この条件の請求書はないよ。
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleRows.map((row) => {
                const state = invoiceState(row);
                const reimbursementDone = reimburseMap.get(`${row.project_id}_${row.ym}`) ?? true;
                const prerequisites = prerequisiteItems(row, reimbursementDone);
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(180px,1.5fr)_96px_96px_120px_150px_minmax(180px,1fr)_132px] items-center gap-3 px-3 py-3 text-[13px] hover:bg-muted/20"
                  >
                    <button type="button" onClick={() => setSelected(row)} className="min-w-0 text-left">
                      <p className="truncate font-medium">{row.project_name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{row.project_id}</p>
                    </button>
                    <span className="font-mono text-[12px] text-muted-foreground">{shortYm(row.ym)}</span>
                    <input
                      className="h-8 w-20 rounded-md border border-border bg-background px-2 text-center font-mono text-[12px]"
                      defaultValue={row.invoice_ym || row.ym}
                      maxLength={6}
                      onBlur={(event) => {
                        const currentValue = row.invoice_ym || row.ym;
                        if (event.target.value !== currentValue) void saveInvoiceYm(row, event.target.value);
                      }}
                    />
                    <span className="text-right font-mono text-[12px]">{yen(invoiceNetAmount(row))}</span>
                    <StatusPill state={state} />
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {prerequisites.map((item) => (
                        <span
                          key={item.label}
                          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold ${
                            item.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          {item.done ? <Check className="size-3" /> : <Clock className="size-3" />}
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {state.key === "unissued" && (
                        <Button type="button" size="sm" onClick={() => setIssuingTarget(row)}>
                          <FilePlus />
                          発行
                        </Button>
                      )}
                      <button type="button" onClick={() => setSelected(row)} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <InvoiceDetailDialog
        row={selected}
        reimbursementDone={selected ? reimburseMap.get(`${selected.project_id}_${selected.ym}`) ?? true : true}
        onClose={() => setSelected(null)}
        onIssue={(row) => {
          setSelected(null);
          setIssuingTarget(row);
        }}
      />

      {issuingTarget && (
        <AdminInvoiceIssueDialog
          projectId={issuingTarget.project_id}
          ym={issuingTarget.ym}
          open={!!issuingTarget}
          onClose={() => setIssuingTarget(null)}
          onIssued={(patch) => {
            applyLocalPatch(issuingTarget.project_id, issuingTarget.ym, {
              invoice_issued_at: patch.invoice_issued_at,
              freee_invoice_number: patch.freee_invoice_number,
              invoice_subject: patch.invoice_subject ?? issuingTarget.invoice_subject,
            });
            setMessage("請求書を発行したよ");
            setIssuingTarget(null);
          }}
        />
      )}
    </div>
  );
}

function InvoiceDetailDialog({
  row,
  reimbursementDone,
  onClose,
  onIssue,
}: {
  row: BillingCycleRow | null;
  reimbursementDone: boolean;
  onClose: () => void;
  onIssue: (row: BillingCycleRow) => void;
}) {
  if (!row) return null;
  const state = invoiceState(row);
  const prerequisites = prerequisiteItems(row, reimbursementDone);
  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.project_name} {ymDisplay(row.ym)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <section className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">請求状態</p>
                <div className="mt-1"><StatusPill state={state} /></div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>請求月 {shortYm(row.invoice_ym || row.ym)}</p>
                <p>請求額 {yen(invoiceNetAmount(row))}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border p-3">
            <p className="text-xs font-semibold text-muted-foreground">発行前確認</p>
            <div className="mt-2 grid gap-2">
              {prerequisites.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className={item.done ? "text-emerald-700" : "text-muted-foreground"}>
                    {item.done ? "完了" : "未完了"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">freee</p>
            <div className="mt-2 space-y-1">
              <p>請求書番号: {row.freee_invoice_number || "-"}</p>
              <p className="break-all">PDF: {row.invoice_pdf_url || "-"}</p>
              <p>件名: {row.invoice_subject || "-"}</p>
            </div>
          </section>

          {state.key === "unissued" && (
            <div className="flex justify-end">
              <Button type="button" onClick={() => { onClose(); onIssue(row); }}>
                <FilePlus />
                請求書を発行
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
