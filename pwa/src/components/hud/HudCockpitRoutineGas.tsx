"use client";

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
  onOpenModal?: (ym: string) => void;
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
  const base: Record<string, { label: string; done: boolean }> = {
    reportFix: { label: "月次報告書確認", done: !!bc?.reportFixedAt },
  };

  return PM_ROUTINE_ORDER.map((id) => {
    const item = base[id];
    const deadline = deadlineFor(id, ym);
    const status = statusFor(item.done, deadline);
    return { id, label: item.label, done: item.done, deadline, status };
  });
}

function routineIconPath(stepId: string) {
  switch (stepId) {
    case "reportFix":
      return "/hud/routine-icons/report.png";
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

export function HudCockpitRoutineGas({ billingCycles, currentYm, onOpenModal, onStepClick }: Props) {
  const months = visibleMonths(billingCycles, currentYm);

  return (
    <section className="relative flex max-h-[calc(100vh-120px)] flex-col overflow-hidden border border-cyan-300/35 bg-slate-950/88 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[length:100%_8px]" />
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-cyan-300/18 px-3 py-3">
        <h3 className="text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100">Monthly Check</h3>
        <span className="border border-cyan-300/30 bg-cyan-300/8 px-2 py-0.5 text-[10px] font-bold text-cyan-100/75">PM nudge</span>
      </div>

      <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 pt-3">
        {months.length === 0 && <p className="text-[12px] text-cyan-100/62">ルーティンデータなし</p>}

        {months.map(({ ym, cycle }) => {
          const activeSteps = buildSteps(cycle, ym);
          const doneCount = activeSteps.filter((s) => s.done).length;
          const totalCount = activeSteps.length || 1;
          const progressPct = Math.round((doneCount / totalCount) * 100);
          const showSteps = ym < currentYm ? activeSteps.filter((s) => !s.done) : activeSteps;
          if (ym < currentYm && showSteps.length === 0) return null;

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
                </div>
                <button type="button" onClick={() => onOpenModal?.(ym)} className="mt-2 flex w-full gap-1 hover:opacity-80">
                  {activeSteps.map((s) => (
                    <span key={s.id} className={`h-1.5 flex-1 ${s.done ? "bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.7)]" : "bg-cyan-950"}`} />
                  ))}
                </button>
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

function subtitleColor(status: RoutineStep["status"]) {
  if (status === "overdue") return "text-rose-100";
  if (status === "warn") return "text-amber-100";
  if (status === "done") return "text-emerald-100";
  return "text-cyan-100/58";
}
