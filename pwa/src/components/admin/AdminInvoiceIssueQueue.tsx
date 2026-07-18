"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, CircleDollarSign, Clock, FilePlus, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminInvoiceIssueDialog } from "@/components/admin/AdminInvoiceIssueDialog";
import { FreeePartnerPicker, type FreeePartnerOption } from "@/components/admin/FreeePartnerPicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface InvoiceProjectRow {
  project_id: string;
  project_name: string;
  client_name: string | null;
  status: string;
  project_type: string | null;
  start_ym: string | null;
  end_ym: string | null;
  freeze_from_ym: string | null;
  fee_type: string | null;
  fee_amount: number | null;
  freee_partner_id: string | null;
  monthly_report_required: boolean;
  monthly_report_scope: string | null;
}

export interface BillingCycleRow {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  fee_type: string | null;
  fee_amount: number | null;
  freee_partner_id: string | null;
  monthly_report_required: boolean;
  monthly_report_scope: string | null;
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

type StateKey = "ready" | "needs_check" | "setup_missing" | "backlog" | "issued" | "sent" | "paid";
type QueueFilter = "open" | StateKey | "all";

interface Props {
  cycles: BillingCycleRow[];
  targetYm: string;
}

type InvoiceState = {
  key: StateKey;
  label: string;
  tone: "amber" | "emerald" | "sky" | "slate" | "red";
  Icon: typeof FilePlus;
};

type ResolutionItem = {
  key: "freee_partner" | "amount";
  label: string;
  done: boolean;
  status: string;
  detail: string;
  blockerLabel: string;
};

function ymDisplay(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function shortYm(ym: string | null) {
  if (!ym || ym.length < 6) return "-";
  return `${ym.slice(2, 4)}.${ym.slice(4, 6)}`;
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
  if (row.fee_type === "monthly_fixed" && typeof row.fee_amount === "number" && row.fee_amount > 0) return Math.round(row.fee_amount);
  return null;
}

function effectiveInvoiceYm(row: BillingCycleRow) {
  return row.invoice_ym || row.ym;
}

function yen(value: number | null) {
  if (value === null) return "-";
  return `¥${value.toLocaleString()}`;
}

function prerequisiteItems(row: BillingCycleRow) {
  const amount = invoiceNetAmount(row);
  return [
    { label: "取引先", done: Boolean(row.freee_partner_id), note: row.freee_partner_id ? "設定済み" : "未設定" },
    { label: "金額", done: amount !== null && amount > 0, note: amount !== null && amount > 0 ? yen(amount) : "未入力" },
  ];
}

function resolutionItems(row: BillingCycleRow): ResolutionItem[] {
  const amount = invoiceNetAmount(row);
  return [
    {
      key: "freee_partner",
      label: "freee取引先",
      done: Boolean(row.freee_partner_id),
      status: row.freee_partner_id ? "設定済み" : "未設定",
      detail: row.freee_partner_id
        ? "この請求先のfreee取引先は保存済み。"
        : "freee取引先を選んで保存すると、この設定不足は解消される。",
      blockerLabel: "freee取引先未設定",
    },
    {
      key: "amount",
      label: "請求額",
      done: amount !== null && amount > 0,
      status: amount !== null && amount > 0 ? yen(amount) : "未入力",
      detail: amount !== null && amount > 0
        ? "請求明細、確定請求額、契約月額のどれかから請求額を読めている。"
        : "請求明細、確定請求額、契約月額のどれも入っていない。案件の契約条件か請求明細を確認する。",
      blockerLabel: "請求額なし",
    },
  ];
}

function blockerItems(row: BillingCycleRow) {
  return resolutionItems(row).filter((item) => !item.done);
}

function blockerLabels(row: BillingCycleRow) {
  return blockerItems(row).map((item) => item.blockerLabel);
}

function invoiceState(row: BillingCycleRow, targetYm: string): InvoiceState {
  if (row.payment_confirmed_at) {
    return { key: "paid", label: "入金確認済み", tone: "slate", Icon: CircleDollarSign };
  }
  if (row.invoice_sent_at) {
    return { key: "sent", label: "送付済み", tone: "sky", Icon: Send };
  }
  if (row.invoice_issued_at) {
    return { key: "issued", label: "発行済み", tone: "emerald", Icon: Check };
  }
  if (effectiveInvoiceYm(row) < targetYm) {
    return { key: "backlog", label: "過去滞留", tone: "red", Icon: AlertTriangle };
  }
  const blockers = blockerItems(row);
  if (blockers.some((item) => item.key === "freee_partner")) {
    return { key: "setup_missing", label: "設定不足", tone: "red", Icon: AlertTriangle };
  }
  if (blockers.length > 0) {
    return { key: "needs_check", label: "要確認", tone: "slate", Icon: Clock };
  }
  return { key: "ready", label: "発行待ち", tone: "amber", Icon: FilePlus };
}

function stateClass(tone: InvoiceState["tone"]) {
  switch (tone) {
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "sky":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "red":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function invoiceSort(a: BillingCycleRow, b: BillingCycleRow, targetYm: string) {
  const stateOrder: Record<StateKey, number> = { ready: 0, needs_check: 1, setup_missing: 2, backlog: 3, issued: 4, sent: 5, paid: 6 };
  const stateDiff = stateOrder[invoiceState(a, targetYm).key] - stateOrder[invoiceState(b, targetYm).key];
  if (stateDiff !== 0) return stateDiff;
  const invoiceYmDiff = (a.invoice_ym || a.ym).localeCompare(b.invoice_ym || b.ym);
  if (invoiceYmDiff !== 0) return invoiceYmDiff;
  return a.project_id.localeCompare(b.project_id);
}

function invoiceRecipientName(row: Pick<BillingCycleRow, "client_name">) {
  return row.client_name?.trim() || "取引先未設定";
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

export function AdminInvoiceIssueQueue({ cycles, targetYm }: Props) {
  const [rows, setRows] = useState(cycles);
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [selected, setSelected] = useState<BillingCycleRow | null>(null);
  const [issuingTarget, setIssuingTarget] = useState<BillingCycleRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const counts = useMemo(() => {
    const initial: Record<QueueFilter, number> = { open: 0, ready: 0, needs_check: 0, setup_missing: 0, backlog: 0, issued: 0, sent: 0, paid: 0, all: rows.length };
    for (const row of rows) {
      const state = invoiceState(row, targetYm).key;
      initial[state] += 1;
      if (state === "ready" || state === "needs_check" || state === "setup_missing" || state === "backlog") {
        initial.open += 1;
      }
    }
    return initial;
  }, [rows, targetYm]);

  const visibleRows = useMemo(() => {
    return rows
      .filter((row) => {
        const state = invoiceState(row, targetYm).key;
        if (filter === "all") return true;
        if (filter === "open") return state === "ready" || state === "needs_check" || state === "setup_missing" || state === "backlog";
        return state === filter;
      })
      .sort((a, b) => invoiceSort(a, b, targetYm));
  }, [filter, rows, targetYm]);

  function applyLocalPatch(projectId: string, ym: string, patch: Partial<BillingCycleRow>) {
    setRows((prev) => prev.map((row) => row.project_id === projectId && row.ym === ym ? { ...row, ...patch } : row));
    setSelected((prev) => prev && prev.project_id === projectId && prev.ym === ym ? { ...prev, ...patch } : prev);
    setIssuingTarget((prev) => prev && prev.project_id === projectId && prev.ym === ym ? { ...prev, ...patch } : prev);
  }

  function applyProjectPatch(projectId: string, patch: Partial<BillingCycleRow>) {
    setRows((prev) => prev.map((row) => row.project_id === projectId ? { ...row, ...patch } : row));
    setSelected((prev) => prev && prev.project_id === projectId ? { ...prev, ...patch } : prev);
    setIssuingTarget((prev) => prev && prev.project_id === projectId ? { ...prev, ...patch } : prev);
  }

  async function saveInvoiceYm(row: BillingCycleRow, invoiceYm: string) {
    const nextValue = invoiceYm.replace(/\D/g, "").slice(0, 6) || row.ym;
    try {
      const res = await fetch("/api/admin/invoices/invoice-ym", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: row.project_id, ym: row.ym, invoiceYm: nextValue }),
      });
      const payload = await res.json() as {
        ok?: boolean;
        error?: string;
        updatedCycle?: { projectId?: string; ym?: string; invoiceYm?: string | null };
      };
      if (!res.ok || payload.ok !== true || !payload.updatedCycle) {
        throw new Error(payload.error || `請求月を保存できなかった (${res.status})`);
      }
      if (payload.updatedCycle.projectId !== row.project_id || payload.updatedCycle.ym !== row.ym) {
        throw new Error("請求月の保存結果を確認できなかった");
      }
      applyLocalPatch(row.project_id, row.ym, { invoice_ym: payload.updatedCycle.invoiceYm ?? row.ym });
      setMessage(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "請求月を保存できなかった");
    }
  }

  const filterItems: Array<{ key: QueueFilter; label: string }> = [
    { key: "open", label: "未完了" },
    { key: "ready", label: "発行待ち" },
    { key: "needs_check", label: "要確認" },
    { key: "setup_missing", label: "設定不足" },
    { key: "backlog", label: "過去滞留" },
    { key: "issued", label: "発行済み" },
    { key: "sent", label: "送付済み" },
    { key: "paid", label: "入金済み" },
    { key: "all", label: "すべて" },
  ];

  const summaryItems: Array<{ label: string; value: number; className: string; filter: QueueFilter }> = [
    { label: "未完了", value: counts.open, className: "border-slate-200 bg-slate-50 text-slate-900", filter: "open" },
    { label: "発行待ち", value: counts.ready, className: "border-amber-200 bg-amber-50 text-amber-900", filter: "ready" },
    { label: "要確認", value: counts.needs_check, className: "border-slate-200 bg-slate-50 text-slate-800", filter: "needs_check" },
    { label: "設定不足", value: counts.setup_missing, className: "border-red-200 bg-red-50 text-red-800", filter: "setup_missing" },
    { label: "過去滞留", value: counts.backlog, className: "border-red-200 bg-red-50 text-red-800", filter: "backlog" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-5">
        {summaryItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setFilter(item.filter)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors hover:brightness-[0.98] ${item.className}`}
          >
            <p className="text-[11px] font-semibold">{item.label}</p>
            <p className="mt-1 text-xl font-semibold leading-none">{item.value}</p>
          </button>
        ))}
      </div>

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
          <div className="grid grid-cols-[minmax(180px,1.5fr)_96px_96px_120px_150px_minmax(160px,0.8fr)_132px] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>請求先</span>
            <span>稼働月</span>
            <span>請求月</span>
            <span className="text-right">請求額</span>
            <span>状態</span>
            <span>発行条件</span>
            <span />
          </div>
          {visibleRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              この条件の請求書はないよ。
            </div>
          ) : (
            <div className="divide-y divide-border">
              {visibleRows.map((row) => {
                const state = invoiceState(row, targetYm);
                const prerequisites = prerequisiteItems(row);
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[minmax(180px,1.5fr)_96px_96px_120px_150px_minmax(160px,0.8fr)_132px] items-center gap-3 px-3 py-3 text-[13px] hover:bg-muted/20"
                  >
                    <button type="button" onClick={() => setSelected(row)} className="min-w-0 text-left">
                      <p className="truncate font-medium">{invoiceRecipientName(row)}</p>
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
                    <button type="button" onClick={() => setSelected(row)} className="text-left">
                      <StatusPill state={state} />
                    </button>
                    <div className="flex min-w-0 flex-wrap gap-1">
                      {prerequisites.map((item) => (
                        <span
                          key={item.label}
                          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold ${
                            item.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                          title={item.note}
                        >
                          {item.done ? <Check className="size-3" /> : <Clock className="size-3" />}
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {state.key === "ready" ? (
                        <Button type="button" size="sm" onClick={() => setIssuingTarget(row)}>
                          <FilePlus />
                          発行
                        </Button>
                      ) : (state.key === "needs_check" || state.key === "setup_missing" || state.key === "backlog") && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelected(row)}>
                          {state.key === "setup_missing" ? "設定" : "確認"}
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
        targetYm={targetYm}
        onClose={() => setSelected(null)}
        onIssue={(row) => {
          setSelected(null);
          setIssuingTarget(row);
        }}
        onProjectPatch={applyProjectPatch}
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
  targetYm,
  onClose,
  onIssue,
  onProjectPatch,
}: {
  row: BillingCycleRow | null;
  targetYm: string;
  onClose: () => void;
  onIssue: (row: BillingCycleRow) => void;
  onProjectPatch: (projectId: string, patch: Partial<BillingCycleRow>) => void;
}) {
  const [freeePartnerDraft, setFreeePartnerDraft] = useState("");
  const [selectedFreeePartner, setSelectedFreeePartner] = useState<FreeePartnerOption | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    setFreeePartnerDraft(row?.freee_partner_id ?? "");
    setSelectedFreeePartner(null);
    setSettingsMessage(null);
  }, [row?.project_id, row?.freee_partner_id]);

  if (!row) return null;
  const activeRow = row;
  const state = invoiceState(row, targetYm);
  const blockers = blockerLabels(row);
  const resolution = resolutionItems(row);
  const missingFreeePartner = resolution.some((item) => item.key === "freee_partner" && !item.done);
  const isBacklog = state.key === "backlog";
  const canIssue = state.key === "ready";

  async function saveFreeePartner() {
    const nextValue = freeePartnerDraft.trim();
    if (!nextValue) {
      setSettingsMessage("freee取引先を選んでね");
      return;
    }
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/admin/invoices/freee-partner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeRow.project_id, freeePartnerId: nextValue }),
      });
      const payload = await res.json() as {
        ok?: boolean;
        error?: string;
        updatedProject?: { projectId?: string; freeePartnerId?: string | null };
      };
      if (!res.ok || payload.ok !== true || !payload.updatedProject) {
        throw new Error(payload.error || `freee取引先を保存できなかった (${res.status})`);
      }
      if (payload.updatedProject.projectId !== activeRow.project_id || payload.updatedProject.freeePartnerId !== nextValue) {
        throw new Error("freee取引先の保存結果を確認できなかった");
      }
      onProjectPatch(activeRow.project_id, { freee_partner_id: nextValue });
      setSettingsMessage(`${selectedFreeePartner?.name || "freee取引先"}を保存したよ。この請求先の未発行行を再判定したよ。`);
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : "freee取引先を保存できなかった");
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{invoiceRecipientName(row)} {ymDisplay(row.ym)}</DialogTitle>
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

          <section className={`rounded-lg border p-3 text-sm ${blockers.length > 0 || isBacklog ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">発行前チェック</p>
              <span className={`text-xs font-semibold ${blockers.length > 0 || isBacklog ? "text-amber-800" : "text-emerald-700"}`}>
                {blockers.length > 0 || isBacklog ? "解消待ち" : "全部OK"}
              </span>
            </div>
            <div className="mt-2 grid gap-2">
              {resolution.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-md border bg-background/80 px-3 py-2 ${
                    item.done ? "border-emerald-200" : "border-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {item.done ? <Check className="size-3 text-emerald-700" /> : <Clock className="size-3 text-amber-700" />}
                      {item.label}
                    </span>
                    <span className={item.done ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-800"}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
              {isBacklog && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-red-800">
                      <AlertTriangle className="size-3" />
                      過去滞留
                    </span>
                    <span className="text-xs font-semibold text-red-800">請求月 {shortYm(effectiveInvoiceYm(row))}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-red-800">
                    請求月が現在の対象月（{ymDisplay(targetYm)}）より前で、発行・送付・入金の記録が入っていない。請求月が違うなら上の請求月を直す。
                  </p>
                </div>
              )}
            </div>
          </section>

          {missingFreeePartner && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
              <p className="font-semibold text-red-900">設定不足を解消</p>
              <p className="mt-1 text-xs leading-5 text-red-800">
                取引先名でfreee取引先を選ぶと、同じ請求先の未発行行もまとめて再判定される。
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <FreeePartnerPicker
                  value={freeePartnerDraft || null}
                  initialQuery={row.client_name ?? ""}
                  placeholder="freee取引先を選択"
                  className="flex-1"
                  onSelect={(partner) => {
                    setFreeePartnerDraft(partner.id);
                    setSelectedFreeePartner(partner);
                  }}
                />
                <Button type="button" onClick={saveFreeePartner} disabled={settingsSaving} className="shrink-0">
                  <Save />
                  {settingsSaving ? "保存中" : "保存"}
                </Button>
              </div>
              {settingsMessage && <p className="mt-2 text-xs text-red-800">{settingsMessage}</p>}
            </section>
          )}

          <section className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">freee</p>
            <div className="mt-2 space-y-1">
              <p>freee取引先: {row.freee_partner_id ? (selectedFreeePartner?.name || "設定済み") : "未設定"}</p>
              <p>請求書番号: {row.freee_invoice_number || "-"}</p>
              <p className="break-all">PDF: {row.invoice_pdf_url || "-"}</p>
              <p>件名: {row.invoice_subject || "-"}</p>
            </div>
          </section>

          {canIssue && (
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
