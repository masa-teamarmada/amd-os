import Link from "next/link";
import { CurrentSpsAssessmentCard } from "@/components/sps/CurrentSpsAssessmentCard";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import type { VentureRow } from "@/lib/venture-map-data";

export function CurrentSpsProjectList({ ventures, assessments }: {
  ventures: VentureRow[];
  assessments: CurrentSpsProjectAssessment[];
}) {
  const byProject = new Map(assessments.map((assessment) => [assessment.project_id, assessment]));
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-5">
      <header className="border-b border-slate-300 pb-3">
        <h1 className="text-lg font-semibold text-[#173f51]">現行SPS</h1>
        <p className="mt-1 text-[10px] leading-4 text-slate-600">産業創出価値版の凍結評価だけを表示する。旧版しかないPJは、値を引き継がず「最新版未評価」とする。</p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        {ventures.map((venture) => {
          const assessment = byProject.get(venture.project_id);
          if (!assessment) return null;
          return (
            <article key={venture.project_id} className="min-w-0">
              <Link href={`/project/${encodeURIComponent(venture.project_id)}/cockpit?tab=score-detail`} className="mb-1 flex items-baseline justify-between gap-2 text-[#174b60] hover:underline">
                <span className="truncate text-[12px] font-semibold">{venture.project_name}</span>
                <span className="shrink-0 font-mono text-[8px] text-slate-400">{venture.project_id}</span>
              </Link>
              <CurrentSpsAssessmentCard assessment={assessment} compact />
            </article>
          );
        })}
      </div>
    </main>
  );
}
