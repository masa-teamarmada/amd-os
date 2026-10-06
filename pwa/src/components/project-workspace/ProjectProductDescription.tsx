"use client";

import { MarkdownView } from "@/components/cockpit/MarkdownView";
import type { ProjectProductDescriptionData } from "@/lib/project-product-description";

export function ProjectProductDescription({ data }: { data: ProjectProductDescriptionData | null }) {
  if (!data) return (
    <div data-testid="project-diligence-empty" data-page="product-description" className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">製品説明資料</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
  return (
    <article data-testid="project-product-description" className="min-w-0 max-w-[960px] py-3 text-[#1d1d1f]">
      <h2 className="text-xl font-semibold leading-8">{data.title}</h2>
      <p className="mt-3 mb-6 text-sm leading-7">{data.summary}</p>
      <div className="[&_p]:text-sm [&_p]:leading-7 [&_li]:text-sm [&_li]:leading-7 [&_td]:text-[13px] [&_th]:text-[13px] [&_h2]:border-b [&_h2]:border-[#e5e5e7] [&_h2]:pb-2 [&_h2]:mt-8 [&_h3]:border-[#027FDC]">
        <MarkdownView source={data.bodyMd} />
      </div>
      <aside className="mt-8 border-t border-[#e5e5e7] pt-4 text-xs leading-6 text-[#6e6e73]" aria-label="資料の根拠">
        <h3 className="font-medium">資料の根拠</h3>
        <ul className="mt-1 list-disc pl-4">{data.sourceRefs.map(ref => <li key={ref}>{ref}</li>)}</ul>
      </aside>
    </article>
  );
}
