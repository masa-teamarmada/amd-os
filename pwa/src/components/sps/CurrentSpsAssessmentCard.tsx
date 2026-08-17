import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";

function formatOkuYen(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const oku = value / 100_000_000;
  return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: oku < 10 ? 1 : 0 }).format(oku)}億円`;
}

function formatDate(value: string | null) {
  if (!value) return "未評価";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function CurrentSpsAssessmentCard({ assessment, compact = false }: {
  assessment: CurrentSpsProjectAssessment;
  compact?: boolean;
}) {
  const assessed = assessment.status === "assessed";
  return (
    <section data-testid="current-sps-assessment" data-assessment-id={assessment.assessment_id ?? "unassessed"} className="border border-[#9bb8ad] bg-[#f6faf8]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#c6d8d1] bg-[#e6f1ed] px-3 py-2">
        <div><h2 className="text-[12px] font-semibold text-[#174b42]">現行SPS｜産業創出価値</h2><p className="text-[8px] text-[#55736c]">{assessment.model.formula}</p></div>
        <span className={`border px-2 py-0.5 text-[9px] font-semibold ${assessed ? "border-emerald-300 bg-white text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{assessed ? "評価済み" : "最新版未評価"}</span>
      </div>
      <div className={`grid gap-px bg-[#d7e3df] ${compact ? "grid-cols-2" : "sm:grid-cols-4"}`}>
        <div className="bg-white px-3 py-2"><div className="text-[8px] text-slate-500">SPS帯</div><div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#174b42]">{assessed ? `${formatOkuYen(assessment.sps_lower_yen)}〜${formatOkuYen(assessment.sps_upper_yen)}` : "—"}</div></div>
        <div className="bg-white px-3 py-2"><div className="text-[8px] text-slate-500">根拠レベル</div><div className="mt-0.5 text-[13px] font-semibold text-slate-700">Lv{assessment.evidence_level}</div></div>
        {!compact ? <><div className="bg-white px-3 py-2"><div className="text-[8px] text-slate-500">評価日</div><div className="mt-0.5 text-[11px] font-semibold text-slate-700">{formatDate(assessment.assessed_at)}</div></div><div className="bg-white px-3 py-2"><div className="text-[8px] text-slate-500">対応シーズ</div><div className="mt-0.5 line-clamp-2 text-[10px] font-semibold text-slate-700">{assessment.seed_title ?? "未接続"}</div></div></> : null}
      </div>
      {!compact ? <details className="border-t border-[#d7e3df] bg-white"><summary className="cursor-pointer list-none px-3 py-1.5 text-[8px] font-semibold text-[#55736c] marker:content-none">版と評価ID</summary><div className="border-t border-slate-100 px-3 py-2 font-mono text-[8px] leading-4 text-slate-500"><div>{assessment.model.measureVersion} / {assessment.model.qModelVersion} / {assessment.model.qRulesetVersion} / {assessment.model.pModelVersion}</div><div>assessment: {assessment.assessment_id ?? "none"}</div></div></details> : null}
    </section>
  );
}
