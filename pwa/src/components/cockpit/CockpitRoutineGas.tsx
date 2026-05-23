"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  projectCategory?: string;
  /** 月見出し（YYYY.MM稼働分）クリック → 月次モーダル */
  onOpenModal?: (ym: string) => void;
  /** 各ステップクリック → stepId 別の専用モーダル（CockpitView で振り分け） */
  onStepClick?: (ym: string, stepId: string) => void;
}

const supabase = createClient();

const STANDARD_ORDER = [
  "budget",
  "meeting",
  "reportFix",
  "reimburseConfirm",
  "invoiceIssue",
  "invoiceSend",
];

const CTB_ORDER = [
  "estimateSend",
  ...STANDARD_ORDER,
];

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

/** 立替精算確認の締切: 翌月 4 日 (土日なら前営業日)。締切日前は必ず未完。 */
function isPastReimburseDeadline(ym: string) {
  const deadline = adjustBusinessDay(ymd(nextYm(ym), 4));
  return todayJstKey() >= deadline;
}

function buildSteps(bc: BillingCycle | undefined, ym: string, isCTB: boolean): RoutineStep[] {
  const invoiceYm = bc?.invoiceYm?.trim() || ym;
  const deferred = invoiceYm !== ym;
  const deferredLabel = deferred ? `${Number(invoiceYm.slice(4))}月にまとめて請求` : "";
  const estimateDone = !!bc?.invoiceBaseLinesJson || !!bc?.invoiceSubject || !!bc?.invoiceIssuedAt;

  // 請求月を翌月以降に設定した月は「月次報告書FIX」以外を全部 skip 表示
  // (invoiceIssue/invoiceSend は当月の cycle では deferred、翌月の cycle で本番)
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
      // 締切日前は必ず未完。締切日以降に submitted/pmapproved の未処理が無ければ完了
      // (design/routine.md, BUGS.md 「admin.billing の未来月『立替確認』が完了表示」参照)
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

export function CockpitRoutineGas({ projectId, billingCycles, currentYm, projectType, projectCategory, onOpenModal, onStepClick }: Props) {
  const isCTB = (projectType || "").toLowerCase() === "ctb";
  const isAdvisor = (projectCategory || "").toLowerCase() === "advisor";
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
      // ページリロードで反映 (state 更新が複雑なため、最も確実)
      window.location.reload();
    } catch {
      setSavingPicker(false);
    }
  }

  return (
    <Card className="border-[#e5e5e7] flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold">月次ルーティン</h3>
          <span className="text-[10px] text-[#86868b]">{isAdvisor ? "対象外" : isCTB ? "CTB" : "標準"}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-4 overflow-y-auto flex-1 min-h-0">
        {isAdvisor && (
          <p className="text-[12px] text-[#86868b]">
            社外役員/顧問PJは月次ルーティン対象外
          </p>
        )}

        {!isAdvisor && months.length === 0 && (
          <p className="text-[12px] text-[#86868b]">ルーティンデータなし</p>
        )}

        {!isAdvisor && (
          <>
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
              <div className="rounded-xl bg-[#f5f5f7] px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenModal?.(ym)}
                    className="flex-1 text-left text-[12px] font-semibold text-[#1d1d1f] hover:opacity-70 transition-opacity"
                  >
                    {formatYm(ym)}稼働分
                  </button>
                  <span className="text-[12px] font-bold tabular-nums text-[#007aff]">{progressPct}%</span>
                  <button
                    type="button"
                    onClick={() => setPickerYm(pickerYm === ym ? null : ym)}
                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                      isDeferredMonth
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-[#d1d1d6] bg-white text-[#6e6e73] hover:bg-[#fafafa]"
                    }`}
                    title="請求月を変更"
                  >
                    {isDeferredMonth ? `→${Number(invoiceYm.slice(4))}月` : "請求月"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenModal?.(ym)}
                  className="w-full flex gap-1 hover:opacity-70 transition-opacity"
                >
                  {activeSteps.map((s) => (
                    <span
                      key={s.id}
                      className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-[#007aff]" : "bg-[#d1d1d6]"}`}
                    />
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

              <div className="bg-white border border-[#e5e5e7] rounded-xl overflow-hidden">
                {showSteps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => onStepClick ? onStepClick(ym, step.id) : onOpenModal?.(ym)}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[#fafafa] transition-colors border-b border-[#f2f2f7] last:border-b-0"
                  >
                    <StepBadge step={step} index={index + 1} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] leading-snug ${step.done ? "text-[#86868b] line-through" : "text-[#1d1d1f] font-medium"}`}>
                        {step.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${subtitleColor(step.status)}`}>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StepBadge({ step, index }: { step: RoutineStep; index: number }) {
  const cls = step.done
    ? "bg-emerald-100 text-emerald-700"
    : step.status === "overdue"
      ? "bg-red-100 text-red-700"
      : step.status === "warn"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";
  return (
    <span className={`w-6 h-6 rounded-full grid place-items-center shrink-0 text-[10px] font-bold ${cls}`}>
      {step.done ? "✓" : index}
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
  // 当月 (通常) + 翌月以降 6 ヶ月分 (まとめて請求オプション)
  const options: Array<{ ym: string; label: string }> = [];
  options.push({ ym: bizYm, label: `${formatYm(bizYm)} に通常請求` });
  let cur = bizYm;
  for (let i = 0; i < 6; i++) {
    cur = nextYm(cur);
    options.push({ ym: cur, label: `${formatYm(cur)} にまとめて請求` });
  }
  return (
    <div className="bg-white border border-[#e5e5e7] rounded-lg overflow-hidden">
      <div className="px-3 py-2 text-[10px] text-[#6e6e73] border-b border-[#f2f2f7]">
        この月の請求をいつ出す?
      </div>
      {options.map((opt) => {
        const selected = opt.ym === currentInvoiceYm;
        return (
          <button
            key={opt.ym}
            type="button"
            disabled={saving}
            onClick={() => onSelect(opt.ym)}
            className={`w-full flex items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-[#fafafa] transition-colors border-b border-[#f2f2f7] last:border-b-0 ${
              selected ? "bg-blue-50 text-blue-700 font-semibold" : "text-[#1d1d1f]"
            }`}
          >
            <span>{opt.label}</span>
            {selected && <span className="text-[#007aff]">✓</span>}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="w-full px-3 py-1.5 text-[10px] text-[#6e6e73] hover:bg-[#fafafa] transition-colors"
      >
        閉じる
      </button>
    </div>
  );
}

function subtitleColor(status: RoutineStep["status"]) {
  if (status === "overdue") return "text-red-600";
  if (status === "warn") return "text-orange-600";
  if (status === "done") return "text-emerald-600";
  return "text-[#86868b]";
}
