"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface BillingCycle {
  ym: string;
  reportFixedAt: string | null;
}

interface RoutineStep {
  id: string;
  label: string;
  done: boolean;
  status: "done" | "current" | "warn" | "overdue" | "future";
  deadline?: string | null;
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

const PM_ROUTINE_ORDER = ["reportFix"];

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

function deadlineFor(id: string, ym: string) {
  switch (id) {
    case "reportFix":
      return adjustBusinessDay(ymd(nextYm(ym), 3));
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

function buildSteps(bc: BillingCycle | undefined, ym: string): RoutineStep[] {
  const base: Record<string, { label: string; done: boolean; deferred?: boolean }> = {
    reportFix: { label: "月次報告書確認", done: !!bc?.reportFixedAt },
  };

  return PM_ROUTINE_ORDER.map((id) => {
    const item = base[id];
    const deadline = deadlineFor(id, ym);
    const status = statusFor(item.done, deadline);
    return { id, label: item.label, done: item.done, deadline, status };
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

export function CockpitRoutineGas({ billingCycles, currentYm, projectCategory, onOpenModal, onStepClick }: Props) {
  const isAdvisor = (projectCategory || "").toLowerCase() === "advisor";
  const months = visibleMonths(billingCycles, currentYm);

  return (
    <Card className="border-[#e5e5e7] flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold">月次確認</h3>
          <span className="text-[10px] text-[#86868b]">{isAdvisor ? "対象外" : "PM確認"}</span>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-4 overflow-y-auto flex-1 min-h-0">
        {isAdvisor && (
          <p className="text-[12px] text-[#86868b]">社外役員/顧問PJは月次確認対象外</p>
        )}

        {!isAdvisor && months.length === 0 && (
          <p className="text-[12px] text-[#86868b]">月次確認データなし</p>
        )}

        {!isAdvisor && (
          <>
        {months.map(({ ym, cycle }) => {
          const activeSteps = buildSteps(cycle, ym);
          const doneCount = activeSteps.filter((s) => s.done).length;
          const totalCount = activeSteps.length || 1;
          const progressPct = Math.round((doneCount / totalCount) * 100);
          const showSteps = ym < currentYm ? activeSteps.filter((s) => !s.done) : activeSteps;

          if (ym < currentYm && showSteps.length === 0) return null;

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

function subtitleColor(status: RoutineStep["status"]) {
  if (status === "overdue") return "text-red-600";
  if (status === "warn") return "text-orange-600";
  if (status === "done") return "text-emerald-600";
  return "text-[#86868b]";
}
