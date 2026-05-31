"use client";

/**
 * InstitutionReadinessList — /dashboard 下ブロック「研究機関リスト (ERS)」
 *
 * まさ #2026-05-29 確定: ダッシュボードに 上=SU リスト / 下=研究機関リスト で縦に積む。
 * 上 (DashboardGrid) = 個体レイヤー (AMD Score)、下 (これ) = 苗床レイヤー (ERS 充足率)。
 * 設計正本: pwa/design/institution_readiness.md
 */
import Link from "next/link";
import { computeErs, ersScoreColor, INSTITUTION_TYPE_LABEL, type ErsResult, type ErsInstitution } from "@/lib/ers";
import type { ErsBundle } from "@/lib/ers-data";
import { getInstitutionProjectLink } from "@/lib/institution-projects";

export function InstitutionReadinessList({ bundle }: { bundle: ErsBundle | null }) {
  if (!bundle || bundle.institutions.length === 0) return null;
  const { institutions, axes, criteria, assessmentsByInstitution } = bundle;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">研究機関 — ERS / エコシステム整備度</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            苗床レイヤー。AMD Score とは別指標で、機関がベンチャーを生み育てる装置としての整備度を充足率 0–100% で表す。
          </p>
        </div>
        <Link
          href="/institutions"
          className="text-xs px-3 py-1.5 rounded-md border border-border bg-white hover:bg-muted/40 transition-colors shrink-0"
        >
          一覧・比較 →
        </Link>
      </div>

      <div className="space-y-2">
        {institutions.map((inst) => (
          <InstitutionStripe
            key={inst.institutionId}
            inst={inst}
            result={computeErs(axes, criteria, assessmentsByInstitution[inst.institutionId] ?? [])}
          />
        ))}
      </div>
    </section>
  );
}

function InstitutionStripe({ inst, result }: { inst: ErsInstitution; result: ErsResult }) {
  const ers = result.ers;
  const meta = [inst.region, inst.description].filter(Boolean).join(" · ");
  const projectLink = getInstitutionProjectLink(inst.institutionId);

  return (
    <Link
      href={projectLink ? `/institutions/${inst.institutionId}/cockpit` : `/institutions/${inst.institutionId}`}
      className="relative block rounded-lg border border-border border-l-4 border-l-indigo-500 bg-card overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="grid grid-cols-12 gap-3 items-center px-3 py-2">
        {/* === 識別: col-span-4 === */}
        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{inst.name}</h3>
            <span className="text-[9px] rounded border px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300">
              {INSTITUTION_TYPE_LABEL[inst.type] ?? inst.type}
            </span>
            {projectLink && (
              <span className="text-[9px] rounded border px-1.5 py-0.5 bg-sky-50 text-sky-800 border-sky-300">
                PJ cockpit
              </span>
            )}
          </div>
          {meta && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{meta}</p>}
          {projectLink && (
            <p className="text-[10px] text-sky-700 truncate mt-0.5">
              {projectLink.relationLabel}: {projectLink.projectLabel}
            </p>
          )}
        </div>

        {/* === ERS 充足率: col-span-3 === */}
        <div className="col-span-3 flex items-center gap-2 border-l border-border/50 pl-3 min-w-0">
          <div className="flex flex-col shrink-0">
            <div className="text-[9px] text-muted-foreground font-mono uppercase">ERS 充足率</div>
            <span className="text-lg font-bold leading-none">{ers != null ? `${Math.round(ers)}%` : "未評価"}</span>
          </div>
          {ers != null && (
            <div className="flex-1 min-w-[50px] h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${ers}%`, background: ersScoreColor(ers / 100) }} />
            </div>
          )}
        </div>

        {/* === 8 軸ヒートマップ: col-span-3 === */}
        <div className="col-span-3 border-l border-border/50 pl-3 min-w-0">
          <div className="text-[9px] text-muted-foreground font-mono uppercase mb-1">8 軸</div>
          <div className="flex gap-0.5">
            {result.axisScores.map((a) => (
              <div
                key={a.axisId}
                title={`${a.axisNo}. ${a.name}: ${a.score != null ? Math.round(a.score * 100) + "%" : "未評価"}`}
                className="flex-1 h-5 rounded-sm flex items-center justify-center text-[8px] font-mono text-white/90"
                style={{ background: ersScoreColor(a.score) }}
              >
                {a.axisNo}
              </div>
            ))}
          </div>
        </div>

        {/* === 評価カバレッジ: col-span-2 === */}
        <div className="col-span-2 border-l border-border/50 pl-3 text-[10px]">
          <div className="text-[9px] text-muted-foreground font-mono uppercase">評価済</div>
          <div className="text-foreground">{result.assessedCriteria}/{result.totalCriteria}</div>
        </div>
      </div>
    </Link>
  );
}
