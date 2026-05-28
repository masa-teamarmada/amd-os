"use client";

import { useMemo, useState } from "react";
import { Bell, Check, ChevronRight, Loader2, Minus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

const CTB_ESTIMATE_MARKER = "[[CTB_ESTIMATE_SENT]]";

export interface BillingProjectRow {
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
  status: string;
  budget_yen: number | null;
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

type MatrixCellStatus = "done" | "undone" | "skip";

interface MatrixStepDef {
  key: string;
  label: string;
  canSkip: boolean;
}

interface Props {
  cycles: BillingCycleRow[];
  reimbursements: ReimbursementRow[];
}

const standardStepDefs: MatrixStepDef[] = [
  { key: "budget", label: "予算確定", canSkip: false },
  { key: "meeting", label: "報告会", canSkip: true },
  { key: "reportFix", label: "報告書", canSkip: false },
  { key: "reimburseConfirm", label: "立替確認", canSkip: false },
  { key: "invoice", label: "請求発行", canSkip: false },
  { key: "invoiceSent", label: "請求送付", canSkip: false },
  { key: "paymentNotice", label: "支払通知", canSkip: false },
  { key: "payment", label: "入金確認", canSkip: false },
  { key: "rewardPaid", label: "報酬支払", canSkip: false },
];

const ctbStepDefs: MatrixStepDef[] = [
  { key: "estimateSend", label: "見積送付", canSkip: false },
  { key: "budget", label: "予算確定", canSkip: false },
  { key: "meeting", label: "報告会", canSkip: true },
  { key: "invoice", label: "請求発行", canSkip: false },
  { key: "invoiceSent", label: "請求送付", canSkip: false },
  { key: "reportFix", label: "報告書", canSkip: false },
  { key: "reimburseConfirm", label: "立替確認", canSkip: false },
  { key: "paymentNotice", label: "支払通知", canSkip: false },
  { key: "payment", label: "入金確認", canSkip: false },
  { key: "rewardPaid", label: "報酬支払", canSkip: false },
];

const supabase = createClient();

function ymDisplay(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function shortYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}/${ym.slice(4)}`;
}

function isCTB(projectType: string | null | undefined) {
  return (projectType || "").toLowerCase() === "ctb";
}

function stepDefsFor(projectType: string | null | undefined) {
  return isCTB(projectType) ? ctbStepDefs : standardStepDefs;
}

function nonEmpty(value: string | null | undefined) {
  return !!value && value.trim() !== "";
}

function hasCTBEstimateMarker(row: BillingCycleRow) {
  return (row.invoice_base_lines_json || "").includes(CTB_ESTIMATE_MARKER);
}

function stepStatus(row: BillingCycleRow, key: string, reimbursementDone: boolean): MatrixCellStatus {
  switch (key) {
    case "estimateSend":
      return hasCTBEstimateMarker(row) ? "done" : "undone";
    case "budget":
      return nonEmpty(row.budget_confirmed_at) ? "done" : "undone";
    case "meeting":
      if (row.meeting_event_id === "skipped") return "skip";
      return nonEmpty(row.meeting_event_id) ? "done" : "undone";
    case "reportFix":
      return nonEmpty(row.report_fixed_at) ? "done" : "undone";
    case "reimburseConfirm":
      return reimbursementDone ? "done" : "undone";
    case "invoice":
      return nonEmpty(row.invoice_issued_at) ? "done" : "undone";
    case "invoiceSent":
      return nonEmpty(row.invoice_sent_at) ? "done" : "undone";
    case "paymentNotice":
      return nonEmpty(row.payout_notice_uploaded_at) ? "done" : "undone";
    case "payment":
      return nonEmpty(row.payment_confirmed_at) ? "done" : "undone";
    case "rewardPaid":
      return nonEmpty(row.reward_paid_at) ? "done" : "undone";
    default:
      return "undone";
  }
}

function dotClass(status: MatrixCellStatus) {
  if (status === "done") return "bg-emerald-500 border-emerald-500";
  if (status === "skip") return "bg-orange-500 border-orange-500";
  return "bg-[#d1d1d6] border-[#d1d1d6]";
}

function isSatisfied(status: MatrixCellStatus, step: MatrixStepDef) {
  if (status === "done") return true;
  if (status === "skip") return step.canSkip;
  return false;
}

function nowIso() {
  return new Date().toISOString();
}

function todayJstKey() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function prevYm(ym: string) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4, 6));
  return m === 1 ? `${y - 1}12` : `${y}${String(m - 1).padStart(2, "0")}`;
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

function ensureCTBEstimateMarker(rawJson: string | null) {
  let rows: Array<Record<string, unknown>> = [];
  if (rawJson && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed)) rows = parsed.filter((row) => row?.description !== CTB_ESTIMATE_MARKER);
      else return rawJson;
    } catch {
      return rawJson;
    }
  }
  rows.push({ type: "text", description: CTB_ESTIMATE_MARKER });
  return JSON.stringify(rows);
}

function stripCTBEstimateMarker(rawJson: string | null) {
  if (!rawJson || !rawJson.trim()) return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return rawJson;
    const rows = parsed.filter((row) => row?.description !== CTB_ESTIMATE_MARKER);
    return rows.length ? JSON.stringify(rows) : null;
  } catch {
    return rawJson;
  }
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

function makeBillingUpdate(
  row: BillingCycleRow,
  taskKey: string,
  newStatus: "done" | "undone" | "skip",
  byEmail: string
) {
  const now = nowIso();
  const body: Record<string, unknown> = {};
  const localPatch: Partial<BillingCycleRow> = {};

  switch (taskKey) {
    case "estimateSend": {
      const nextJson = newStatus === "done"
        ? ensureCTBEstimateMarker(row.invoice_base_lines_json)
        : stripCTBEstimateMarker(row.invoice_base_lines_json);
      body.invoice_base_lines_json = nextJson;
      localPatch.invoice_base_lines_json = nextJson;
      break;
    }
    case "budget":
      body.status = newStatus === "done" ? "budget_confirmed" : "not_started";
      body.budget_confirmed_at = newStatus === "done" ? now : null;
      body.budget_confirmed_by = newStatus === "done" ? byEmail : null;
      localPatch.status = body.status as string;
      localPatch.budget_confirmed_at = body.budget_confirmed_at as string | null;
      break;
    case "meeting":
      body.meeting_event_id = newStatus === "skip" ? "skipped" : newStatus === "done" ? "admin_done" : null;
      localPatch.meeting_event_id = body.meeting_event_id as string | null;
      break;
    case "reportFix":
      body.report_fixed_at = newStatus === "done" ? now : null;
      body.report_fixed_by = newStatus === "done" ? byEmail : null;
      localPatch.report_fixed_at = body.report_fixed_at as string | null;
      break;
    case "invoice":
      body.invoice_issued_at = newStatus === "done" ? now : null;
      body.invoice_issued_by = newStatus === "done" ? byEmail : null;
      localPatch.invoice_issued_at = body.invoice_issued_at as string | null;
      if (newStatus === "undone") {
        body.invoice_sent_at = null;
        localPatch.invoice_sent_at = null;
      }
      break;
    case "invoiceSent":
      body.invoice_sent_at = newStatus === "done" ? now : null;
      localPatch.invoice_sent_at = body.invoice_sent_at as string | null;
      break;
    case "paymentNotice":
      body.payout_notice_uploaded_at = newStatus === "done" ? now : null;
      localPatch.payout_notice_uploaded_at = body.payout_notice_uploaded_at as string | null;
      break;
    case "payment":
      body.payment_confirmed_at = newStatus === "done" ? now : null;
      body.payment_confirmed_by = newStatus === "done" ? byEmail : null;
      if (newStatus === "done") body.status = "payment_confirmed";
      localPatch.payment_confirmed_at = body.payment_confirmed_at as string | null;
      if (body.status) localPatch.status = body.status as string;
      break;
    case "rewardPaid":
      body.reward_paid_at = newStatus === "done" ? now : null;
      body.reward_paid_by = newStatus === "done" ? byEmail : null;
      localPatch.reward_paid_at = body.reward_paid_at as string | null;
      break;
  }

  return { body, localPatch };
}

export function AdminBillingMatrix({ cycles, reimbursements }: Props) {
  const [rows, setRows] = useState(cycles);
  const [selected, setSelected] = useState<BillingCycleRow | null>(null);
  const [inlineUpdating, setInlineUpdating] = useState<string | null>(null);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [reimburseMap] = useState(() => reimbursementCompletionMap(reimbursements, cycles));

  const grouped = useMemo(() => {
    const byYm = new Map<string, BillingCycleRow[]>();
    for (const row of rows) {
      const list = byYm.get(row.ym) || [];
      list.push(row);
      byYm.set(row.ym, list);
    }
    return Array.from(byYm.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([ym, list]) => ({
        ym,
        rows: list.sort((a, b) => a.project_id.localeCompare(b.project_id)),
      }));
  }, [rows]);

  const recentRows = grouped.slice(0, 3).flatMap((group) => group.rows);
  const paidCount = recentRows.filter((row) => stepStatus(row, "payment", reimburseMap.get(`${row.project_id}_${row.ym}`) ?? true) === "done").length;

  function applyLocalPatch(projectId: string, ym: string, patch: Partial<BillingCycleRow>) {
    setRows((prev) => prev.map((row) => row.project_id === projectId && row.ym === ym ? { ...row, ...patch } : row));
    setSelected((prev) => prev && prev.project_id === projectId && prev.ym === ym ? { ...prev, ...patch } : prev);
  }

  async function updateCycleInline(row: BillingCycleRow, taskKey: string, newStatus: "done" | "undone") {
    const rowReimbursementDone = reimburseMap.get(`${row.project_id}_${row.ym}`) ?? true;
    const steps = stepDefsFor(row.project_type);
    const blockingSteps = steps
      .slice(0, Math.max(0, steps.findIndex((step) => step.key === "payment")))
      .filter((step) => !isSatisfied(stepStatus(row, step.key, rowReimbursementDone), step));

    if ((taskKey === "payment" || taskKey === "rewardPaid") && newStatus === "done" && blockingSteps.length > 0) {
      setInlineMessage(`未完了: ${blockingSteps.map((step) => step.label).join(" / ")}`);
      return;
    }

    const updateKey = `${row.project_id}_${row.ym}_${taskKey}`;
    setInlineUpdating(updateKey);
    setInlineMessage(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const byEmail = userData.user?.email || "";
      const { body, localPatch } = makeBillingUpdate(row, taskKey, newStatus, byEmail);
      const { error } = await supabase
        .from("billing_cycles")
        .update(body)
        .eq("project_id", row.project_id)
        .eq("ym", row.ym);
      if (error) throw error;
      applyLocalPatch(row.project_id, row.ym, localPatch);
    } catch (e) {
      setInlineMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setInlineUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-[12px] text-muted-foreground">
        <span>直近3か月の入金確認: <span className="font-medium text-foreground">{paidCount} / {recentRows.length}</span></span>
        <span>対象月: <span className="font-medium text-foreground">{grouped.length}か月分</span></span>
      </div>
      {inlineMessage && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{inlineMessage}</p>}

      <div className="space-y-4">
        {grouped.map((group) => (
          <section key={group.ym} className="rounded-xl border border-border bg-background overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-[13px] font-semibold">{ymDisplay(group.ym)}</div>
            <div className="divide-y divide-border">
              {group.rows.map((row) => (
                <MatrixRow
                  key={row.id}
                  row={row}
                  reimbursementDone={reimburseMap.get(`${row.project_id}_${row.ym}`) ?? true}
                  updatingKey={inlineUpdating}
                  onStepUpdate={updateCycleInline}
                  onOpen={() => setSelected(row)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <BillingCycleDetailDialog
        row={selected}
        reimbursementDone={selected ? reimburseMap.get(`${selected.project_id}_${selected.ym}`) ?? true : true}
        onClose={() => setSelected(null)}
        onPatch={applyLocalPatch}
      />
    </div>
  );
}

function MatrixRow({
  row,
  reimbursementDone,
  updatingKey,
  onStepUpdate,
  onOpen,
}: {
  row: BillingCycleRow;
  reimbursementDone: boolean;
  updatingKey: string | null;
  onStepUpdate: (row: BillingCycleRow, taskKey: string, status: "done" | "undone") => void;
  onOpen: () => void;
}) {
  const steps = stepDefsFor(row.project_type);
  return (
    <div className="w-full flex items-center gap-4 px-3 py-3 text-left hover:bg-muted/20 transition-colors">
      <button type="button" onClick={onOpen} className="min-w-[120px] max-w-[180px] text-left">
        <p className="text-[13px] font-medium truncate">{row.project_name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{row.project_id}</p>
      </button>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2" aria-label="ステップ状況">
        {steps.map((step) => {
          const status = stepStatus(row, step.key, reimbursementDone);
          return (
            <StepChip
              key={step.key}
              row={row}
              step={step}
              status={status}
              disabled={step.key === "reimburseConfirm"}
              updating={updatingKey === `${row.project_id}_${row.ym}_${step.key}`}
              onUpdate={onStepUpdate}
            />
          );
        })}
      </div>
      <button type="button" onClick={onOpen} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function chipClass(status: MatrixCellStatus) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "skip") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-[#d1d1d6] bg-[#f5f5f7] text-[#6e6e73]";
}

function StepChip({
  row,
  step,
  status,
  disabled,
  updating,
  onUpdate,
}: {
  row: BillingCycleRow;
  step: MatrixStepDef;
  status: MatrixCellStatus;
  disabled: boolean;
  updating: boolean;
  onUpdate: (row: BillingCycleRow, taskKey: string, status: "done" | "undone") => void;
}) {
  const isDone = status === "done";
  const chip = (
    <span className={`inline-flex h-8 min-w-[76px] items-center justify-center gap-1 rounded-full border px-3 text-[11px] font-semibold leading-none ${chipClass(status)} ${disabled ? "cursor-default opacity-70" : "cursor-pointer hover:ring-2 hover:ring-foreground/10"}`}>
      {updating ? <Loader2 className="size-3 animate-spin" /> : status === "skip" ? <Minus className="size-3" /> : isDone ? <Check className="size-3" /> : null}
      {step.label}
    </span>
  );

  if (disabled) return <span title="立替タブから自動判定">{chip}</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>{chip}</DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-36">
        {!isDone && (
          <DropdownMenuItem onClick={() => onUpdate(row, step.key, "done")}>
            <Check />完了にする
          </DropdownMenuItem>
        )}
        {status !== "undone" && (
          <DropdownMenuItem variant="destructive" onClick={() => onUpdate(row, step.key, "undone")}>
            <RotateCcw />未完にする
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BillingCycleDetailDialog({
  row,
  reimbursementDone,
  onClose,
  onPatch,
}: {
  row: BillingCycleRow | null;
  reimbursementDone: boolean;
  onClose: () => void;
  onPatch: (projectId: string, ym: string, patch: Partial<BillingCycleRow>) => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!row) return null;

  const activeRow = row;
  const steps = stepDefsFor(row.project_type);
  const invoiceYm = row.invoice_ym?.trim() || row.ym;
  const blockingSteps = steps
    .slice(0, Math.max(0, steps.findIndex((step) => step.key === "payment")))
    .filter((step) => !isSatisfied(stepStatus(row, step.key, reimbursementDone), step));

  async function updateCycle(taskKey: string, newStatus: "done" | "undone" | "skip") {
    if ((taskKey === "payment" || taskKey === "rewardPaid") && newStatus === "done" && blockingSteps.length > 0) {
      await sendDelayNudge();
      setError(`未完了タスクが残っているため、この月の支払いは翌月へ延期。先に ${blockingSteps.map((step) => step.label).join(" / ")} を完了してね。`);
      return;
    }

    setUpdating(taskKey);
    setError(null);
    setMessage(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const byEmail = userData.user?.email || "";
      const now = nowIso();
      const body: Record<string, unknown> = {};
      const localPatch: Partial<BillingCycleRow> = {};

      switch (taskKey) {
        case "estimateSend": {
          const nextJson = newStatus === "done"
            ? ensureCTBEstimateMarker(activeRow.invoice_base_lines_json)
            : stripCTBEstimateMarker(activeRow.invoice_base_lines_json);
          body.invoice_base_lines_json = nextJson;
          localPatch.invoice_base_lines_json = nextJson;
          break;
        }
        case "budget":
          body.status = newStatus === "done" ? "budget_confirmed" : "not_started";
          body.budget_confirmed_at = newStatus === "done" ? now : null;
          body.budget_confirmed_by = newStatus === "done" ? byEmail : null;
          localPatch.status = body.status as string;
          localPatch.budget_confirmed_at = body.budget_confirmed_at as string | null;
          break;
        case "meeting":
          body.meeting_event_id = newStatus === "skip" ? "skipped" : newStatus === "done" ? "admin_done" : null;
          localPatch.meeting_event_id = body.meeting_event_id as string | null;
          break;
        case "reportFix":
          body.report_fixed_at = newStatus === "done" ? now : null;
          body.report_fixed_by = newStatus === "done" ? byEmail : null;
          localPatch.report_fixed_at = body.report_fixed_at as string | null;
          break;
        case "invoice":
          body.invoice_issued_at = newStatus === "done" ? now : null;
          body.invoice_issued_by = newStatus === "done" ? byEmail : null;
          localPatch.invoice_issued_at = body.invoice_issued_at as string | null;
          if (newStatus === "undone") {
            body.invoice_sent_at = null;
            localPatch.invoice_sent_at = null;
          }
          break;
        case "invoiceSent":
          body.invoice_sent_at = newStatus === "done" ? now : null;
          localPatch.invoice_sent_at = body.invoice_sent_at as string | null;
          break;
        case "paymentNotice":
          body.payout_notice_uploaded_at = newStatus === "done" ? now : null;
          localPatch.payout_notice_uploaded_at = body.payout_notice_uploaded_at as string | null;
          break;
        case "payment":
          body.payment_confirmed_at = newStatus === "done" ? now : null;
          body.payment_confirmed_by = newStatus === "done" ? byEmail : null;
          if (newStatus === "done") body.status = "payment_confirmed";
          localPatch.payment_confirmed_at = body.payment_confirmed_at as string | null;
          if (body.status) localPatch.status = body.status as string;
          break;
        case "rewardPaid":
          body.reward_paid_at = newStatus === "done" ? now : null;
          body.reward_paid_by = newStatus === "done" ? byEmail : null;
          localPatch.reward_paid_at = body.reward_paid_at as string | null;
          break;
      }

      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update(body)
        .eq("project_id", activeRow.project_id)
        .eq("ym", activeRow.ym);
      if (updateError) throw updateError;

      onPatch(activeRow.project_id, activeRow.ym, localPatch);
      setMessage("更新したよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(null);
    }
  }

  async function sendDelayNudge() {
    setUpdating("paymentDelayNudge");
    setError(null);
    setMessage(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("send-payment-delay-nudge", {
        body: {
          projectId: activeRow.project_id,
          ym: activeRow.ym,
          missingStepLabels: blockingSteps.map((step) => step.label),
        },
      });
      if (invokeError) throw invokeError;
      setMessage(data?.message || "未完了メンバーへnudgeを送ったよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.project_name} {ymDisplay(row.ym)}</DialogTitle>
        </DialogHeader>

        <section className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-[12px] font-semibold">請求設定</div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-3 py-2 text-[13px]">
              <span>稼働月</span>
              <span className="text-muted-foreground">{ymDisplay(row.ym)}</span>
            </div>
            <label className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span>請求月</span>
              <input
                className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-[12px]"
                value={invoiceYm}
                maxLength={6}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                  onPatch(activeRow.project_id, activeRow.ym, { invoice_ym: value || null });
                }}
                onBlur={async (event) => {
                  const value = event.target.value || activeRow.ym;
                  setUpdating("invoiceYm");
                  await supabase.from("billing_cycles").update({ invoice_ym: value }).eq("project_id", activeRow.project_id).eq("ym", activeRow.ym);
                  setUpdating(null);
                }}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-[12px] font-semibold">ステップ管理</div>
          <div className="divide-y divide-border">
            {steps.map((step) => {
              const status = stepStatus(row, step.key, reimbursementDone);
              return (
                <div key={step.key} className="flex items-center gap-3 px-3 py-2">
                  <span className={`grid place-items-center size-3.5 rounded-full border ${dotClass(status)}`}>
                    {status === "skip" && <Minus className="size-2.5 text-white" />}
                  </span>
                  <span className="text-[13px] flex-1">{step.label}</span>
                  {step.key === "reimburseConfirm" ? (
                    <span className="text-[11px] text-muted-foreground">立替タブから自動判定</span>
                  ) : updating === step.key ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <StepActions step={step} status={status} onUpdate={updateCycle} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {blockingSteps.length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[12px] font-semibold text-amber-800">支払い延期ルール</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">未完了: {blockingSteps.map((step) => step.label).join(" / ")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 bg-white"
              onClick={sendDelayNudge}
              disabled={!!updating}
            >
              {updating === "paymentDelayNudge" ? <Loader2 className="animate-spin" /> : <Bell />}
              未完了メンバーへnudge送信
            </Button>
            <p className="mt-2 text-[11px] text-amber-800">入金確認までに未完了タスクが残っていると、その月の支払いは翌月へ延期されるよ。</p>
          </section>
        )}

        {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

function StepActions({
  step,
  status,
  onUpdate,
}: {
  step: MatrixStepDef;
  status: MatrixCellStatus;
  onUpdate: (key: string, status: "done" | "undone" | "skip") => void;
}) {
  if (step.canSkip) {
    return (
      <div className="flex gap-1">
        {status !== "done" && (
          <Button type="button" variant="outline" size="xs" onClick={() => onUpdate(step.key, "done")}>
            <Check />完了
          </Button>
        )}
        {status !== "skip" && (
          <Button type="button" variant="outline" size="xs" onClick={() => onUpdate(step.key, "skip")}>
            <Minus />skip
          </Button>
        )}
        {status !== "undone" && (
          <Button type="button" variant="destructive" size="xs" onClick={() => onUpdate(step.key, "undone")}>
            <RotateCcw />戻す
          </Button>
        )}
      </div>
    );
  }

  const isDone = status === "done";
  return (
    <Button
      type="button"
      variant={isDone ? "destructive" : "outline"}
      size="xs"
      onClick={() => onUpdate(step.key, isDone ? "undone" : "done")}
    >
      {isDone ? <X /> : <Check />}
      {isDone ? "未完了に戻す" : "完了にする"}
    </Button>
  );
}
