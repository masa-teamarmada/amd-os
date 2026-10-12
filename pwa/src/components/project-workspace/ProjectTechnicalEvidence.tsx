"use client";

import { MarkdownView } from "@/components/cockpit/MarkdownView";
import type { ProjectProductDescriptionData } from "@/lib/project-product-description";

// 投資家と研究者が報告と追記欄を照合する資料面。既存DDの白地・薄罫線・12px本文・4px刻みを使う。
export function ProjectTechnicalEvidence({ data }: { data: ProjectProductDescriptionData | null }) {
  if (!data) return <section data-testid="project-diligence-empty" data-page="technical-evidence" className="space-y-2 py-3">
    <h2 className="text-lg font-semibold">技術実証報告書</h2><p className="text-sm text-[#6e6e73]">資料未登録</p>
  </section>;
  return <article data-testid="project-technical-evidence" className="min-w-0 space-y-3 text-[12px] leading-[1.45]">
    <header className="space-y-2"><h2 className="text-[15px] font-semibold leading-snug">{data.title}</h2><p>{data.summary}</p></header>
    <MarkdownView source={data.bodyMd} />
    <aside aria-label="資料の根拠" className="border-t border-[#e2e8f0] pt-2 text-[11px] text-[#6e6e73]">
      <h3 className="font-semibold">資料の根拠</h3><ul className="list-inside list-disc">{data.sourceRefs.map(ref => <li key={ref}>{ref}</li>)}</ul>
    </aside>
  </article>;
}
