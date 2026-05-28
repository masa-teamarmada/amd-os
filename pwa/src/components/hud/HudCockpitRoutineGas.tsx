"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BillingCycle {
  ym: string;
  status: string;
  meetingStartAt: string | null;
  meetingEventId?: string | null;
  reportFixedAt: string | null;
  budgetConfirmedAt?: string | null;
  invoiceIssuedAt?: string | null;
  invoiceSentAt: string | null;
  payoutNoticeUploadedAt?: string | null;
  reimburseConfirmDone?: boolean;
  rewardPaidAt?: string | null;
  invoiceYm?: string | null;
  invoiceBaseLinesJson?: string | null;
  invoiceSubject?: string | null;
}

interface RoutineStep {
  id: string;
  label: string;
  done: boolean;
  status: "done" | "current" | "warn" | "overdue" | "future" | "deferred";
  deadline?: string | null;
  deferred?: boolean;
}

interface Props {
  projectId: string;
  billingCycles: BillingCycle[];
  currentYm: string;
  projectType?: string;
  onOpenModal?: (ym: string) => void;
  onStepClick?: (ym: string, stepId: string) => void;
}

const supabase = createClient();
const CTB_ESTIMATE_MARKER = "[[CTB_ESTIMATE_SENT]]";

const STANDARD_ORDER = ["budget", "meeting", "reportFix", "reimburseConfirm", "invoiceIssue", "invoiceSend"];
const CTB_ORDER = ["estimateSend", "budget", "meeting", "invoiceIssue", "invoiceSend", "reportFix", "reimburseConfirm"];

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym;
  return `${ym.slice(0, 4)}.${ym.slice(4)}`;
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

function deadlineFor(id: string, ym: string, isCTB: boolean) {
  switch (id) {
    case "estimateSend":
      return adjustBusinessDay(ymd(prevYm(ym), 28));
    case "budget":
      return adjustBusinessDay(ymd(prevYm(ym), isCTB ? 28 : 25));
    case "meeting":
      return adjustBusinessDay(ymd(ym, 20));
    case "reportFix":
      return adjustBusinessDay(ymd(nextYm(ym), 3));
    case "reimburseConfirm":
      return adjustBusinessDay(ymd(nextYm(ym), 4));
    case "invoiceIssue":
      return adjustBusinessDay(isCTB ? ymd(ym, 28) : ymd(nextYm(ym), 8));
    case "invoiceSend":
      return adjustBusinessDay(isCTB ? ymd(ym, 28) : ymd(nextYm(ym), 9));
    default:
      return null;
  }
}

function statusFor(done: boolean, deadline?: string | null): RoutineStep["status"] {
  if (done) return "done";
  if (!deadline) return "future";
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  const target = Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`);
  const daysLeft = Math.round((target - today) / 86400000);
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 3) return "warn";
  return "future";
}

function formatDeadline(deadline?: string | null) {
  if (!deadline) return "";
  const parts = deadline.slice(0, 10).split("-");
  if (parts.length !== 3) return deadline;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function todayJstKey() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

function isPastReimburseDeadline(ym: string) {
  const deadline = adjustBusinessDay(ymd(nextYm(ym), 4));
  return todayJstKey() >= deadline;
}

function hasCTBEstimateMarker(raw?: string | null) {
  return (raw || "").includes(CTB_ESTIMATE_MARKER);
}

function buildSteps(bc: BillingCycle | undefined, ym: string, isCTB: boolean): RoutineStep[] {
  const invoiceYm = bc?.invoiceYm?.trim() || ym;
  const deferred = invoiceYm !== ym;
  const deferredLabel = deferred ? `${Number(invoiceYm.slice(4))}月にまとめて請求` : "";
  const estimateDone = hasCTBEstimateMarker(bc?.invoiceBaseLinesJson);

  const base: Record<string, { label: string; done: boolean; deferred?: boolean }> = {
    estimateSend: { label: "見積書送付", done: estimateDone, deferred },
    budget: {
      label: "請求額確定",
      done: !!bc?.budgetConfirmedAt || bc?.status === "budget_confirmed" || bc?.status === "allocation_confirmed",
      deferred,
    },
    meeting: { label: "報告会日程調整", done: !!bc?.meetingEventId || !!bc?.meetingStartAt, deferred },
    reportFix: { label: "月次報告書FIX", done: !!bc?.reportFixedAt },
    reimburseConfirm: {
      label: "立替精算確認",
      done: isPastReimburseDeadline(ym) && bc?.reimburseConfirmDone !== false,
      deferred,
    },
    invoiceIssue: { label: deferred ? deferredLabel : "請求書発行", done: !!bc?.invoiceIssuedAt, deferred },
    invoiceSend: { label: deferred ? deferredLabel : "請求書送付", done: !!bc?.invoiceSentAt, deferred },
  };

  const order = isCTB ? CTB_ORDER : STANDARD_ORDER;
  return order.map((id) => {
    const item = base[id];
    const deadline = deadlineFor(id, ym, isCTB);
    const status = item.deferred ? "deferred" : statusFor(item.done, deadline);
    return { id, label: item.label, done: item.done && !item.deferred, deadline, status, deferred: item.deferred };
  });
}

function routineIconPath(stepId: string) {
  switch (stepId) {
    case "budget":
      return "/hud/routine-icons/budget.png";
    case "meeting":
      return "/hud/routine-icons/meeting.png";
    case "reportFix":
      return "/hud/routine-icons/report.png";
    case "reimburseConfirm":
      return "/hud/routine-icons/reimburse.png";
    case "invoiceIssue":
    case "estimateSend":
      return "/hud/routine-icons/invoice.png";
    case "invoiceSend":
      return "/hud/routine-icons/send.png";
    default:
      return "/hud/routine-icons/report.png";
  }
}

function visibleMonths(billingCycles: BillingCycle[], currentYm: string) {
  const map = new Map(billingCycles.map((bc) => [bc.ym, bc]));
  const candidates = Array.from(new Set([prevYm(currentYm), currentYm, nextYm(currentYm), ...billingCycles.map((bc) => bc.ym)])).sort();
  return candidates
    .map((ym) => ({ ym, cycle: map.get(ym) }))
    .filter(({ ym, cycle }) => {
      if (ym <= "202512") return false;
      if (ym === currentYm || ym === nextYm(currentYm)) return true;
      if (ym < currentYm && cycle) return true;
      return false;
    });
}

export function HudCockpitRoutineGas({ projectId, billingCycles, currentYm, projectType, onOpenModal, onStepClick }: Props) {
  const isCTB = (projectType || "").toLowerCase() === "ctb";
  const months = visibleMonths(billingCycles, currentYm);
  const [pickerYm, setPickerYm] = useState<string | null>(null);
  const [savingPicker, setSavingPicker] = useState(false);

  async function changeInvoiceYm(ym: string, newInvoiceYm: string) {
    setSavingPicker(true);
    try {
      await supabase
        .from("billing_cycles")
        .update({ invoice_ym: newInvoiceYm === ym ? null : newInvoiceYm })
        .eq("project_id", projectId)
        .eq("ym", ym);
      window.location.reload();
    } catch {
      setSavingPicker(false);
    }
  }

  return (
    <section className="relative flex max-h-[calc(100vh-120px)] flex-col overflow-hidden border border-cyan-300/35 bg-slate-950/88 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-cyan-300/18 px-3 py-3">
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">Monthly Routine</h3>
        <span className="border border-cyan-300/30 bg-cyan-300/8 px-2 py-0.5 text-[10px] font-bold text-cyan-100/75">{isCTB ? "CTB" : "標準"}</span>
      </div>

      <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-3">
        {months.length === 0 && <p className="text-[12px] text-cyan-100/62">ルーティンデータなし</p>}

        {months.map(({ ym, cycle }) => {
          const steps = buildSteps(cycle, ym, isCTB);
          const activeSteps = steps.filter((s) => !s.deferred);
          const doneCount = activeSteps.filter((s) => s.done).length;
          const totalCount = activeSteps.length || 1;
          const progressPct = Math.round((doneCount / totalCount) * 100);
          const showSteps = ym < currentYm ? activeSteps.filter((s) => !s.done) : activeSteps;
          if (ym < currentYm && showSteps.length === 0) return null;

          const invoiceYm = cycle?.invoiceYm?.trim() || ym;
          const isDeferredMonth = invoiceYm !== ym;

          return (
            <section key={ym} className="space-y-2">
              <div className="border border-cyan-300/24 bg-slate-900/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenModal?.(ym)}
                    className="flex-1 text-left text-[12px] font-black tracking-[0.06em] text-white hover:text-cyan-100"
                  >
                    {formatYm(ym)}稼働分
                  </button>
                  <span className="font-mono text-[12px] font-black tabular-nums text-cyan-100">{progressPct}%</span>
                  <button
                    type="button"
                    onClick={() => setPickerYm(pickerYm === ym ? null : ym)}
                    className={`border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      isDeferredMonth
                        ? "border-amber-300/60 bg-amber-300/14 text-amber-100"
                        : "border-cyan-300/28 bg-slate-950/70 text-cyan-100/70 hover:bg-cyan-300/10"
                    }`}
                    title="請求月を変更"
                  >
                    {isDeferredMonth ? `→${Number(invoiceYm.slice(4))}月` : "請求月"}
                  </button>
                </div>
                <button type="button" onClick={() => onOpenModal?.(ym)} className="mt-2 flex w-full gap-1 hover:opacity-80">
                  {activeSteps.map((s) => (
                    <span key={s.id} className={`h-1.5 flex-1 ${s.done ? "bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.7)]" : "bg-cyan-950"}`} />
                  ))}
                </button>
                {pickerYm === ym && (
                  <InvoiceYmPicker
                    bizYm={ym}
                    currentInvoiceYm={invoiceYm}
                    saving={savingPicker}
                    onSelect={(newYm) => changeInvoiceYm(ym, newYm)}
                    onClose={() => setPickerYm(null)}
                  />
                )}
              </div>

              <div className="overflow-hidden border border-cyan-300/22 bg-slate-950/70">
                {showSteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => (onStepClick ? onStepClick(ym, step.id) : onOpenModal?.(ym))}
                    className="flex w-full items-start gap-2 border-b border-cyan-300/14 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-cyan-300/8"
                  >
                    <StepBadge step={step} index={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] leading-snug ${step.done ? "text-cyan-100/42 line-through" : "font-bold text-cyan-50"}`}>{step.label}</p>
                      <p className={`mt-0.5 text-[10px] font-bold ${subtitleColor(step.status)}`}>
                        {step.done ? "完了" : step.status === "overdue" ? "期限超過" : step.status === "warn" ? "要確認" : "予定"}
                        {step.deadline ? ` · ${formatDeadline(step.deadline)}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function StepBadge({ step, index }: { step: RoutineStep; index: number }) {
  const cls = step.done
    ? "border-emerald-300/60 bg-emerald-300/16 text-emerald-100"
    : step.status === "overdue"
      ? "border-rose-300/70 bg-rose-300/16 text-rose-100"
      : step.status === "warn"
        ? "border-amber-300/70 bg-amber-300/16 text-amber-100"
        : "border-cyan-300/45 bg-cyan-300/10 text-cyan-100";
  return (
    <span className={`relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden border ${cls}`}>
      <img src={routineIconPath(step.id)} alt="" className="h-7 w-7 opacity-90 mix-blend-screen" />
      <span className="absolute bottom-0 right-0 grid h-3.5 min-w-3.5 place-items-center bg-[#020812]/92 px-0.5 font-mono text-[8px] font-black leading-none">
        {step.done ? "✓" : index}
      </span>
    </span>
  );
}

function InvoiceYmPicker({
  bizYm,
  currentInvoiceYm,
  saving,
  onSelect,
  onClose,
}: {
  bizYm: string;
  currentInvoiceYm: string;
  saving: boolean;
  onSelect: (newYm: string) => void;
  onClose: () => void;
}) {
  const options: Array<{ ym: string; label: string }> = [];
  options.push({ ym: bizYm, label: `${formatYm(bizYm)} に通常請求` });
  let cur = bizYm;
  for (let i = 0; i < 6; i++) {
    cur = nextYm(cur);
    options.push({ ym: cur, label: `${formatYm(cur)} にまとめて請求` });
  }
  return (
    <div className="mt-2 overflow-hidden border border-cyan-300/24 bg-slate-950/96">
      <div className="border-b border-cyan-300/16 px-3 py-2 text-[10px] font-bold text-cyan-100/62">この月の請求をいつ出す?</div>
      {options.map((opt) => {
        const selected = opt.ym === currentInvoiceYm;
        return (
          <button
            key={opt.ym}
            type="button"
            disabled={saving}
            onClick={() => onSelect(opt.ym)}
            className={`flex w-full items-center justify-between border-b border-cyan-300/12 px-3 py-2 text-left text-[12px] transition-colors last:border-b-0 hover:bg-cyan-300/8 ${
              selected ? "bg-cyan-300/12 font-bold text-white" : "text-cyan-50/78"
            }`}
          >
            <span>{opt.label}</span>
            {selected && <span className="text-cyan-100">✓</span>}
          </button>
        );
      })}
      <button type="button" onClick={onClose} disabled={saving} className="w-full px-3 py-1.5 text-[10px] font-bold text-cyan-100/58 hover:bg-cyan-300/8">
        閉じる
      </button>
    </div>
  );
}

function subtitleColor(status: RoutineStep["status"]) {
  if (status === "overdue") return "text-rose-100";
  if (status === "warn") return "text-amber-100";
  if (status === "done") return "text-emerald-100";
  return "text-cyan-100/58";
}
