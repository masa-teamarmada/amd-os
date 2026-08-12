"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CircleDollarSign, Clock, FilePlus, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminInvoiceIssueDialog } from "@/components/admin/AdminInvoiceIssueDialog";
import { FreeePartnerPicker, type FreeePartnerOption } from "@/components/admin/FreeePartnerPicker";
import { contractBackedClientAmount } from "@/lib/contract-money";
import { expenseReimbursementBillingRule } from "@/lib/project-contract-terms";
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
  payment_due_rule: string | null;
  payment_due_day: number | null;
  contract_terms_json?: unknown;
}

export interface ReimbursementRow {
  reimbursement_id: string;
  project_id: string;
  date: string | null;
  category: string | null;
  amount: number;
  description: string | null;
  status: string;
  created_by_label: string;
  receipt_count: number;
  ym: string;
}

export interface BillingCycleRow {
  id: string;
  cycle_exists: boolean;
  project_id: string;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  fee_type: string | null;
  fee_amount: number | null;
  start_ym: string | null;
  end_ym: string | null;
  contract_terms_json?: unknown;
  freee_partner_id: string | null;
  monthly_report_required: boolean;
  monthly_report_scope: string | null;
  payment_due_rule: string | null;
  payment_due_day: number | null;
  ym: string;
  invoice_ym: string | null;
  invoice_base_lines_json: string | null;
  invoice_subject: string | null;
  freee_invoice_number: string | null;
  invoice_pdf_url: string | null;
  status: string;
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
  reimbursements: ReimbursementRow[];
}

type StateKey = "ready" | "needs_check" | "setup_missing" | "backlog" | "issued" | "sent" | "paid";

interface Props {
  cycles: BillingCycleRow[];
  targetYm: string;
  viewerIsAdmin: boolean;
  viewerPmProjectIds: string[];
}

type InvoiceState = {
  key: StateKey;
  label: string;
  tone: "amber" | "emerald" | "sky" | "slate" | "red";
  Icon: typeof FilePlus;
};

type ResolutionItem = {
  key: "cycle" | "freee_partner" | "amount" | "expense_rule" | "reimbursement" | "report";
  label: string;
  done: boolean;
  status: string;
  detail: string;
  blockerLabel: string;
};

const UNAPPROVED_STATUSES = new Set(["submitted", "pmApproved", "pmapproved"]);
const APPROVED_STATUSES = new Set(["approved", "paid"]);

const REIMBURSE_STATUS_LABEL: Record<string, string> = {
  submitted: "申請中",
  pmApproved: "PM承認済",
  pmapproved: "PM承認済",
  approved: "承認済",
  rejected: "却下",
  paid: "支払済",
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

function baseInvoiceAmount(row: BillingCycleRow) {
  const totalFromLines = parseInvoiceLines(row.invoice_base_lines_json).reduce((sum, line) => {
    if (line.type === "text") return sum;
    const quantity = Number(line.quantity ?? line.qty ?? 1) || 1;
    const unitPrice = Number(line.unit_price ?? line.unitPrice ?? line.amount ?? 0) || 0;
    return sum + quantity * unitPrice;
  }, 0);
  if (totalFromLines > 0) return Math.round(totalFromLines);
  // 明細行が無い場合は contract-money.ts の正本ロジックへ委譲する。budget_yen は使わない。
  return contractBackedClientAmount({
    ym: row.ym,
    project: { fee_type: row.fee_type, fee_amount: row.fee_amount, contract_terms_json: row.contract_terms_json },
    reportedAmount: row.budget_reported_amount,
    cycleStatus: row.status,
  });
}

function invoiceNetAmount(row: BillingCycleRow) {
  const base = baseInvoiceAmount(row);
  return base > 0 ? base : null;
}

function approvedReimbursementTotal(row: BillingCycleRow) {
  return row.reimbursements.filter((r) => APPROVED_STATUSES.has(r.status)).reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

function billableApprovedReimbursementTotal(row: BillingCycleRow) {
  return expenseReimbursementBillingRule(row.contract_terms_json).allowed === true
    ? approvedReimbursementTotal(row)
    : 0;
}

function unapprovedReimbursementTotal(row: BillingCycleRow) {
  return row.reimbursements.filter((r) => UNAPPROVED_STATUSES.has(r.status)).reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

function invoiceCandidateAmount(row: BillingCycleRow) {
  return (invoiceNetAmount(row) ?? 0) + billableApprovedReimbursementTotal(row);
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
  const expenseRule = expenseReimbursementBillingRule(row.contract_terms_json);
  const invoiceRelevantReimbursements = row.reimbursements.filter((item) => item.status !== "rejected");
  const items: ResolutionItem[] = [];
  if (!row.cycle_exists) {
    items.push({
      key: "cycle",
      label: "月次台帳",
      done: false,
      status: "未生成",
      detail: "この稼働月のbilling cycleが無い。月次台帳を生成してから請求する。",
      blockerLabel: "月次台帳未生成",
    });
  }
  items.push(
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
        ? "請求明細、確定請求額、契約条件のどれかから請求額を読めている。"
        : "請求明細、確定請求額、契約条件のどれも入っていない。案件の契約条件か請求明細を確認する。",
      blockerLabel: "請求額なし",
    },
  );
  if (invoiceRelevantReimbursements.length > 0 && expenseRule.allowed === null) {
    items.push({
      key: "expense_rule",
      label: "立替の請求上乗せ",
      done: false,
      status: "未抽出",
      detail: "このPJの立替をクライアント請求へ上乗せできるか、契約条件から確定していない。契約台帳で可否を抽出してから請求額を確定する。",
      blockerLabel: "立替上乗せ条件未抽出",
    });
  }
  const pending = row.reimbursements.filter((r) => UNAPPROVED_STATUSES.has(r.status));
  if (expenseRule.allowed === true && pending.length > 0) {
    items.push({
      key: "reimbursement",
      label: "立替承認",
      done: false,
      status: `${pending.length}件未承認`,
      detail: "申請中またはPM承認済みの立替が残っている。この画面の立替一覧から必要な承認を終える。",
      blockerLabel: `立替未承認 ${pending.length}件`,
    });
  }
  if (row.monthly_report_required && !row.report_fixed_at) {
    items.push({
      key: "report",
      label: "月報確定",
      done: false,
      status: "未確定",
      detail: "契約上必要な月報がまだ確定していない。月報を確定してから請求する。",
      blockerLabel: "月報未確定",
    });
  }
  return items;
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
  const blockers = blockerItems(row);
  if (blockers.some((item) => item.key === "cycle" || item.key === "freee_partner")) {
    return { key: "setup_missing", label: "設定不足", tone: "red", Icon: AlertTriangle };
  }
  if (blockers.length > 0) {
    return { key: "needs_check", label: "要確認", tone: "slate", Icon: Clock };
  }
  if (effectiveInvoiceYm(row) < targetYm) {
    return { key: "backlog", label: "過去滞留", tone: "red", Icon: AlertTriangle };
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

function invoiceRecipientName(row: Pick<BillingCycleRow, "client_name">) {
  return row.client_name?.trim() || "取引先未設定";
}

function cockpitSummary(terms: unknown): Record<string, string> {
  if (!terms || typeof terms !== "object") return {};
  const currentContracts = (terms as { currentContracts?: unknown }).currentContracts;
  const first = Array.isArray(currentContracts) ? currentContracts[0] : null;
  const summary = (first && typeof first === "object" ? (first as { terms?: { cockpitSummary?: unknown } }).terms?.cockpitSummary : null)
    ?? (terms as { cockpitSummary?: unknown }).cockpitSummary;
  if (!summary || typeof summary !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(summary as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

function contractFacts(row: BillingCycleRow) {
  const source = row.contract_terms_json && typeof row.contract_terms_json === "object"
    ? row.contract_terms_json as Record<string, unknown>
    : {};
  const currentContracts = Array.isArray(source.currentContracts) ? source.currentContracts : [];
  const current = currentContracts[0] && typeof currentContracts[0] === "object"
    ? currentContracts[0] as Record<string, unknown>
    : {};
  const terms = current.terms && typeof current.terms === "object"
    ? current.terms as Record<string, unknown>
    : source;
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = terms[key] ?? current[key] ?? source[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
      if (typeof candidate === "number") return candidate.toLocaleString();
      if (typeof candidate === "boolean") return candidate ? "あり" : "なし";
    }
    return null;
  };
  const period = [value("contractStartYm", "startYm"), value("contractEndYm", "endYm")].filter(Boolean).join(" - ")
    || [row.start_ym, row.end_ym].filter(Boolean).map((ym) => shortYm(ym)).join(" - ");
  const fee = value("monthlyFee", "monthlyAmount", "feeAmount", "contractAmount")
    ?? (row.fee_amount ? yen(row.fee_amount) : null);
  const due = value("paymentTerms", "paymentTiming")
    ?? (row.payment_due_rule === "end_of_following_month" ? "翌月末払い" : row.payment_due_day ? `毎月${row.payment_due_day}日払い` : null);
  const expenseRule = expenseReimbursementBillingRule(row.contract_terms_json);
  const expenseRuleValue = expenseRule.allowed === true
    ? `上乗せ可${expenseRule.note ? ` · ${expenseRule.note}` : ""}`
    : expenseRule.allowed === false
      ? `上乗せ不可${expenseRule.note ? ` · ${expenseRule.note}` : ""}`
      : "未抽出（契約書確認が必要）";
  const facts: Array<[string, string | null]> = [
    ["契約", value("currentContractTitle", "title", "contractTitle")],
    ["期間", period || null],
    ["基本報酬", fee],
    ["請求配分", value("billingDistribution", "billingRule", "invoiceTiming")],
    ["支払条件", due],
    ["立替の請求上乗せ", expenseRuleValue],
    ["月報", value("monthlyReportSubmissionRule", "monthlyReportDeadline", "reportRule")],
  ];
  return facts.filter((fact): fact is [string, string] => Boolean(fact[1]));
}

function StatusPill({ state }: { state: InvoiceState }) {
  const Icon = state.Icon;
  return (
    <span className={`inline-flex h-6 items-center gap-1 border px-2 text-[10px] font-semibold ${stateClass(state.tone)}`}>
      <Icon className="size-3" />
      {state.label}
    </span>
  );
}

export function AdminInvoiceIssueQueue({ cycles, targetYm, viewerIsAdmin, viewerPmProjectIds }: Props) {
  const [rows, setRows] = useState(cycles);
  const [selected, setSelected] = useState<BillingCycleRow | null>(null);
  const [issuingTarget, setIssuingTarget] = useState<BillingCycleRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [decidingReimbursementId, setDecidingReimbursementId] = useState<string | null>(null);

  const projects = useMemo(() => {
    const map = new Map<string, { project_id: string; name: string; client: string; rows: BillingCycleRow[] }>();
    for (const row of rows) {
      const entry = map.get(row.project_id) ?? { project_id: row.project_id, name: row.project_name, client: invoiceRecipientName(row), rows: [] };
      entry.rows.push(row);
      map.set(row.project_id, entry);
    }
    return Array.from(map.values())
      .map((entry) => ({ ...entry, rows: entry.rows.slice().sort((a, b) => b.ym.localeCompare(a.ym)) }))
      .sort((a, b) => {
        const order: Record<StateKey, number> = { ready: 0, backlog: 1, needs_check: 2, setup_missing: 3, issued: 4, sent: 5, paid: 6 };
        const rankA = Math.min(...a.rows.map((row) => order[invoiceState(row, targetYm).key]));
        const rankB = Math.min(...b.rows.map((row) => order[invoiceState(row, targetYm).key]));
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [rows, targetYm]);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) setActiveProjectId(projects[0].project_id);
  }, [activeProjectId, projects]);

  const activeProject = projects.find((p) => p.project_id === activeProjectId) ?? projects[0] ?? null;

  const [activeYm, setActiveYm] = useState<string | null>(null);
  useEffect(() => {
    if (!activeProject) return;
    const stillPresent = activeProject.rows.some((r) => r.ym === activeYm);
    if (!stillPresent) {
      const firstOpen = activeProject.rows.find((r) => ["ready", "needs_check", "setup_missing", "backlog"].includes(invoiceState(r, targetYm).key));
      setActiveYm((firstOpen ?? activeProject.rows[0])?.ym ?? null);
    }
  }, [activeProject, activeYm, targetYm]);

  const activeRow = activeProject?.rows.find((r) => r.ym === activeYm) ?? null;

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
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "請求月を保存できなかった");
      return false;
    }
  }

  async function approveReimbursement(row: BillingCycleRow, reimbursement: ReimbursementRow) {
    const action = reimbursement.status === "submitted" ? "reimb_approve" : "reimb_admin_approve";
    setDecidingReimbursementId(reimbursement.reimbursement_id);
    setMessage(null);
    try {
      const res = await fetch("/api/reimbursements/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reimbursementId: reimbursement.reimbursement_id }),
      });
      const payload = await res.json() as { ok?: boolean; error?: string; status?: string };
      if (!res.ok || payload.ok !== true || !payload.status) {
        throw new Error(payload.error || `立替を承認できなかった (${res.status})`);
      }
      const patchReimbursements = (items: ReimbursementRow[]) => items.map((item) =>
        item.reimbursement_id === reimbursement.reimbursement_id ? { ...item, status: payload.status! } : item
      );
      applyLocalPatch(row.project_id, row.ym, { reimbursements: patchReimbursements(row.reimbursements) });
      setMessage(payload.status === "approved" ? "admin承認したよ。請求候補額へ反映したよ" : "PM承認したよ");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "立替を承認できなかった");
    } finally {
      setDecidingReimbursementId(null);
    }
  }

  const openTotal = rows.filter((r) => ["ready", "needs_check", "setup_missing", "backlog"].includes(invoiceState(r, targetYm).key)).length;

  return (
    <div className="grid gap-3 lg:h-[calc(100vh-228px)] lg:min-h-[480px] lg:grid-cols-[230px_1fr]">
      {/* 左列: PJ選択リスト */}
      <section aria-label="請求先PJ一覧" className="flex flex-col border border-border bg-background lg:overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-[12px] font-semibold">請求先 PJ</p>
          <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">未完了 {openTotal}</span>
        </div>
        {projects.length > 0 && (
          <select
            aria-label="請求先PJを選択"
            className="m-2 h-10 w-[calc(100%-16px)] border border-border bg-background px-2 text-sm lg:hidden"
            value={activeProject?.project_id ?? ""}
            onChange={(event) => setActiveProjectId(event.target.value)}
          >
            {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.name} / {project.client}</option>)}
          </select>
        )}
        <div className="hidden divide-y divide-border overflow-y-auto lg:block lg:flex-1">
          {projects.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">対象PJが無いよ。</p>
          ) : (
            projects.map((p) => {
              const open = p.rows.filter((r) => ["ready", "needs_check", "setup_missing", "backlog"].includes(invoiceState(r, targetYm).key));
              const worstTone = open.some((r) => invoiceState(r, targetYm).key === "setup_missing" || invoiceState(r, targetYm).key === "backlog")
                ? "red"
                : open.length > 0 ? "amber" : "slate";
              return (
                <button
                  key={p.project_id}
                  type="button"
                  onClick={() => setActiveProjectId(p.project_id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-muted/40 ${
                    activeProject?.project_id === p.project_id ? "bg-muted/60 font-semibold" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-[10px] font-normal text-muted-foreground">{p.client}</span>
                  </span>
                  {open.length > 0 && (
                    <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold ${stateClass(worstTone)}`}>
                      {open.length}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* 右列: 作業面 */}
      <section aria-label="請求書発行キュー" className="flex flex-col gap-3 overflow-y-auto lg:pr-1">
        {message && <p className="border-l-2 border-amber-500 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">{message}</p>}

        {!activeProject ? (
          <div className="border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
            左のPJ一覧から選択してね。
          </div>
        ) : (
          <>
            {/* 契約条件 */}
            <ContractTermsPanel row={activeProject.rows[0]} />

            {/* 13か月請求台帳 */}
            <section className="overflow-x-auto border border-border bg-background">
              <div className="min-w-[870px]">
              <div className="grid grid-cols-[68px_78px_108px_108px_116px_104px_1fr] gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">
                <span>稼働月</span><span>請求月</span><span className="text-right">基本額</span><span className="text-right">上乗せ立替</span><span className="text-right">候補(税抜)</span><span>状態</span><span>発行条件</span>
              </div>
              <div className="divide-y divide-border">
                {activeProject.rows.map((row) => {
                  const state = invoiceState(row, targetYm);
                  const prerequisites = prerequisiteItems(row);
                  const blockers = blockerLabels(row);
                  return (
                    <div
                      key={row.id}
                      className={`grid w-full grid-cols-[68px_78px_108px_108px_116px_104px_1fr] items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted/20 ${
                        activeYm === row.ym ? "bg-muted/40" : ""
                      }`}
                    >
                      <button type="button" className="text-left font-mono text-[12px] text-muted-foreground" onClick={() => setActiveYm(row.ym)}>
                        {shortYm(row.ym)}
                      </button>
                      <span
                        className="h-7 w-[72px] border border-border bg-background px-1 text-center font-mono text-[11px] leading-7"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          aria-label={`${ymDisplay(row.ym)}の請求月`}
                          className="h-full w-full bg-transparent text-center"
                          defaultValue={row.invoice_ym || row.ym}
                          maxLength={6}
                          onBlur={(event) => {
                            const currentValue = row.invoice_ym || row.ym;
                            if (event.target.value !== currentValue) void saveInvoiceYm(row, event.target.value);
                          }}
                        />
                      </span>
                      <span className="text-right font-mono text-[11px]">{yen(invoiceNetAmount(row))}</span>
                      <span
                        className="text-right font-mono text-[11px] text-emerald-700"
                        title={`承認済み発生額 ${yen(approvedReimbursementTotal(row))}`}
                      >
                        {yen(billableApprovedReimbursementTotal(row))}
                      </span>
                      <span className="text-right font-mono text-[12px] font-bold">{yen(invoiceCandidateAmount(row))}</span>
                      {state.key === "backlog" ? (
                        <button
                          type="button"
                          aria-label={`${ymDisplay(row.ym)}の過去滞留を解消`}
                          title="過去滞留を解消する"
                          className="flex h-8 items-center gap-1 text-red-700 underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => {
                            setActiveYm(row.ym);
                            setSelected(row);
                          }}
                        >
                          <StatusPill state={state} />
                          <span className="text-[9px] font-semibold">解消</span>
                        </button>
                      ) : (
                        <StatusPill state={state} />
                      )}
                      <div className="min-w-0 truncate text-[10px] text-muted-foreground" title={[...prerequisites.filter((item) => !item.done).map((item) => item.note), ...blockers].join(" / ")}>
                        {blockers.length > 0 ? blockers.join(" / ") : "発行条件OK"}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>
            </section>

            {activeRow && (
              <MonthWorkbench
                row={activeRow}
                targetYm={targetYm}
                onOpenDetail={() => setSelected(activeRow)}
                onIssue={() => setIssuingTarget(activeRow)}
                viewerIsAdmin={viewerIsAdmin}
                viewerCanPmApprove={viewerPmProjectIds.includes(activeRow.project_id)}
                decidingReimbursementId={decidingReimbursementId}
                onApproveReimbursement={(reimbursement) => void approveReimbursement(activeRow, reimbursement)}
              />
            )}
          </>
        )}

        <InvoiceDetailDialog
          row={selected}
          targetYm={targetYm}
          onClose={() => setSelected(null)}
          onIssue={(row) => {
            setSelected(null);
            setIssuingTarget(row);
          }}
          onSaveInvoiceYm={saveInvoiceYm}
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
      </section>
    </div>
  );
}

const COCKPIT_LABELS: Record<string, string> = {
  invoiceTiming: "請求タイミング",
  paymentTiming: "支払タイミング",
  scope: "業務範囲",
  deliverables: "成果物",
  expense: "立替の請求上乗せ",
  execution: "実施体制",
};

function ContractTermsPanel({ row }: { row: BillingCycleRow }) {
  const summary = cockpitSummary(row.contract_terms_json);
  const entries = [
    ...contractFacts(row),
    ...Object.entries(summary).map(([key, value]) => [COCKPIT_LABELS[key] ?? key, value] as [string, string]),
  ].filter((entry, index, all) => all.findIndex(([label]) => label === entry[0]) === index);
  return (
    <section className="border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div>
          <p className="text-[12px] font-semibold">{row.project_name}</p>
          <p className="text-[10px] text-muted-foreground">{invoiceRecipientName(row)} · 契約条件</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{shortYm(row.start_ym)} — {shortYm(row.end_ym)}</span>
      </div>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-[12px] text-muted-foreground">
          契約条件サマリー未登録（{row.fee_type === "monthly_fixed" ? `月額固定 ${yen(row.fee_amount)}` : row.fee_type || "契約種別未設定"}）。/admin/contracts で登録できる。
        </p>
      ) : (
        <div className="grid divide-y divide-border sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
          {entries.slice(0, 6).map(([label, value]) => {
            const isExpenseRule = label === "立替の請求上乗せ";
            const expenseMissing = isExpenseRule && value.startsWith("未抽出");
            const expenseBlocked = isExpenseRule && value.startsWith("上乗せ不可");
            return (
            <div
              key={label}
              className={`min-w-0 px-2.5 py-1.5 ${expenseMissing ? "bg-amber-50" : expenseBlocked ? "bg-slate-50" : ""}`}
            >
              <p className="text-[9px] font-semibold text-muted-foreground">{label}</p>
              <p
                className={`line-clamp-2 text-[11px] font-medium leading-4 ${expenseMissing ? "text-amber-800" : expenseBlocked ? "text-slate-700" : ""}`}
                title={value}
              >
                {value}
              </p>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MonthWorkbench({
  row,
  targetYm,
  onOpenDetail,
  onIssue,
  viewerIsAdmin,
  viewerCanPmApprove,
  decidingReimbursementId,
  onApproveReimbursement,
}: {
  row: BillingCycleRow;
  targetYm: string;
  onOpenDetail: () => void;
  onIssue: () => void;
  viewerIsAdmin: boolean;
  viewerCanPmApprove: boolean;
  decidingReimbursementId: string | null;
  onApproveReimbursement: (reimbursement: ReimbursementRow) => void;
}) {
  const state = invoiceState(row, targetYm);
  const blockers = blockerLabels(row);
  const base = invoiceNetAmount(row) ?? 0;
  const approved = approvedReimbursementTotal(row);
  const billableApproved = billableApprovedReimbursementTotal(row);
  const unapproved = unapprovedReimbursementTotal(row);
  const expenseRule = expenseReimbursementBillingRule(row.contract_terms_json);
  const canIssue = blockers.length === 0 && !["issued", "sent", "paid"].includes(state.key);

  return (
    <section className="border border-border bg-background p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold">{ymDisplay(row.ym)} の内訳</p>
        <div className="flex items-center gap-2">
          {state.key === "backlog" ? (
            <button
              type="button"
              aria-label={`${ymDisplay(row.ym)}の過去滞留を解消`}
              title="過去滞留を解消する"
              className="h-8 text-red-700 underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onOpenDetail}
            >
              <StatusPill state={state} />
            </button>
          ) : (
            <StatusPill state={state} />
          )}
          <Button type="button" variant="outline" size="sm" onClick={onOpenDetail}>発行前チェックを開く</Button>
          {canIssue && (
            <Button type="button" size="sm" onClick={onIssue}>
              <FilePlus />
              請求書作成
            </Button>
          )}
        </div>
      </div>

      <div className="mt-2 grid border border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
        <div className="px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground">基本額</p>
          <p className="font-mono text-[14px] font-semibold">{yen(base)}</p>
        </div>
        <div className="bg-emerald-50 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-emerald-700">承認済立替</p>
          <p className="font-mono text-[14px] font-semibold text-emerald-900">{yen(approved)}</p>
          <p className="text-[9px] text-emerald-800">請求上乗せ {yen(billableApproved)}</p>
        </div>
        <div className="bg-slate-900 px-2.5 py-1.5 text-white">
          <p className="text-[10px] font-semibold text-slate-300">請求候補（税抜）</p>
          <p className="font-mono text-[16px] font-bold">{yen(base + billableApproved)}</p>
        </div>
        <div className="bg-amber-50 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-amber-700">未承認参考</p>
          <p className="font-mono text-[14px] font-semibold text-amber-900">{yen(unapproved)}</p>
        </div>
      </div>

      {/* blocker明示 */}
      {blockers.length > 0 && (
        <div className="mt-2 border-l-2 border-red-500 bg-red-50 px-3 py-1.5">
          <p className="text-[11px] font-semibold text-red-800">発行不可の理由</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-red-800">
            {blockers.map((label) => <li key={label}>{label}</li>)}
          </ul>
        </div>
      )}

      {/* 選択月の全立替（全status） */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground">この月の立替（全ステータス）</p>
          <p className="text-[10px] text-muted-foreground">
            {expenseRule.allowed === true
              ? "未承認は発行を止める"
              : expenseRule.allowed === false
                ? "契約上、請求へ上乗せしない"
                : "立替があれば契約条件の抽出が必要"}
          </p>
        </div>
        {row.reimbursements.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted-foreground">この月の立替は無いよ。</p>
        ) : (
          <div className="mt-1 divide-y divide-border border border-border">
            {row.reimbursements.map((r) => (
              <div key={r.reimbursement_id} className="flex flex-col gap-1 px-2.5 py-1 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <p className="truncate">{r.description || r.category || "立替"}</p>
                  <p className="text-[9px] text-muted-foreground">{r.date || "-"} / {r.created_by_label} / 証憑 {r.receipt_count}件</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <span className="font-mono">{yen(Number(r.amount || 0))}</span>
                  <span
                    className={`border px-2 py-0.5 text-[9px] font-semibold ${
                      APPROVED_STATUSES.has(r.status)
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : r.status === "rejected"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {REIMBURSE_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                  {r.status === "submitted" && (viewerCanPmApprove || viewerIsAdmin) && (
                    <Button type="button" size="sm" className="h-8 px-3 text-[10px]" disabled={decidingReimbursementId === r.reimbursement_id} onClick={() => onApproveReimbursement(r)}>
                      {decidingReimbursementId === r.reimbursement_id ? "承認中" : "PM承認"}
                    </Button>
                  )}
                  {(r.status === "pmApproved" || r.status === "pmapproved") && viewerIsAdmin && (
                    <Button type="button" size="sm" className="h-8 px-3 text-[10px]" disabled={decidingReimbursementId === r.reimbursement_id} onClick={() => onApproveReimbursement(r)}>
                      {decidingReimbursementId === r.reimbursement_id ? "承認中" : "admin承認"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function InvoiceDetailDialog({
  row,
  targetYm,
  onClose,
  onIssue,
  onSaveInvoiceYm,
  onProjectPatch,
}: {
  row: BillingCycleRow | null;
  targetYm: string;
  onClose: () => void;
  onIssue: (row: BillingCycleRow) => void;
  onSaveInvoiceYm: (row: BillingCycleRow, invoiceYm: string) => Promise<boolean>;
  onProjectPatch: (projectId: string, patch: Partial<BillingCycleRow>) => void;
}) {
  const [freeePartnerDraft, setFreeePartnerDraft] = useState("");
  const [selectedFreeePartner, setSelectedFreeePartner] = useState<FreeePartnerOption | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [invoiceYmDraft, setInvoiceYmDraft] = useState("");
  const [invoiceYmSaving, setInvoiceYmSaving] = useState(false);
  const [invoiceYmMessage, setInvoiceYmMessage] = useState<string | null>(null);

  useEffect(() => {
    setFreeePartnerDraft(row?.freee_partner_id ?? "");
    setSelectedFreeePartner(null);
    setSettingsMessage(null);
  }, [row?.project_id, row?.freee_partner_id]);

  useEffect(() => {
    setInvoiceYmDraft(row?.invoice_ym || row?.ym || "");
    setInvoiceYmMessage(null);
  }, [row?.project_id, row?.ym, row?.invoice_ym]);

  if (!row) return null;
  const activeRow = row;
  const state = invoiceState(row, targetYm);
  const blockers = blockerLabels(row);
  const resolution = resolutionItems(row);
  const missingFreeePartner = resolution.some((item) => item.key === "freee_partner" && !item.done);
  const isBacklog = state.key === "backlog";
  const canIssue = blockers.length === 0 && !["issued", "sent", "paid"].includes(state.key);

  async function saveBacklogInvoiceYm() {
    setInvoiceYmSaving(true);
    setInvoiceYmMessage(null);
    const saved = await onSaveInvoiceYm(activeRow, invoiceYmDraft);
    setInvoiceYmSaving(false);
    setInvoiceYmMessage(saved ? "請求月を更新したよ。状態を再判定したよ。" : "請求月を更新できなかった");
  }

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
          <section className="border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">請求状態</p>
                <div className="mt-1"><StatusPill state={state} /></div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>請求月 {shortYm(row.invoice_ym || row.ym)}</p>
                <p>請求候補（税抜） {yen(invoiceCandidateAmount(row))}</p>
              </div>
            </div>
          </section>

          <section className={`border p-3 text-sm ${blockers.length > 0 ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">発行前チェック</p>
              <span className={`text-xs font-semibold ${blockers.length > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                {blockers.length > 0 ? "解消待ち" : "全部OK"}
              </span>
            </div>
            <div className="mt-2 grid gap-2">
              {resolution.map((item) => (
                <div
                  key={item.key}
                  className={`border bg-background/80 px-3 py-2 ${
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
                <div className="border border-red-200 bg-red-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 font-semibold text-red-800">
                      <AlertTriangle className="size-3" />
                      過去滞留
                    </span>
                    <span className="text-xs font-semibold text-red-800">請求月 {shortYm(effectiveInvoiceYm(row))}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-red-800">
                    請求月が現在の対象月（{ymDisplay(targetYm)}）より前で、発行・送付・入金の記録が入っていない。請求月が正しければ請求書作成へ、違うならここで更新する。
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label className="flex-1 text-[10px] font-semibold text-red-900">
                      正しい請求月（YYYYMM）
                      <input
                        value={invoiceYmDraft}
                        inputMode="numeric"
                        maxLength={6}
                        className="mt-1 h-9 w-full border border-red-300 bg-background px-2 font-mono text-sm text-foreground"
                        onChange={(event) => setInvoiceYmDraft(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-300 bg-background text-red-800 hover:bg-red-100"
                      disabled={invoiceYmSaving || invoiceYmDraft.length !== 6}
                      onClick={() => void saveBacklogInvoiceYm()}
                    >
                      <Save />
                      {invoiceYmSaving ? "更新中" : "請求月を更新"}
                    </Button>
                  </div>
                  {invoiceYmMessage && <p className="mt-1 text-xs font-medium text-red-800">{invoiceYmMessage}</p>}
                </div>
              )}
            </div>
          </section>

          {missingFreeePartner && (
            <section className="border border-red-200 bg-red-50 p-3 text-sm">
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

          <section className="border border-border p-3 text-sm">
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
                請求書作成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
