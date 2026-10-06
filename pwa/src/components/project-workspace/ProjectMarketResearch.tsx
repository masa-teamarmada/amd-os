"use client";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import type { ProjectMarketResearch as ResearchData } from "@/lib/project-market-research";

export function ProjectMarketResearch({data}:{data:ResearchData | null}) {
  return <article data-testid="project-market-research" className="min-w-0 py-3 text-[#1d1d1f]">
    <h2 className="text-xl font-semibold leading-8">市場調査資料</h2>
    {!data ? <p className="mt-3 text-sm text-[#6e6e73]">資料未登録</p> : <>
      <div className="mt-4 text-sm [&_p]:leading-7 [&_li]:leading-7 [&_td]:text-[13px] [&_th]:text-[13px]"><MarkdownView source={data.summaryMd} /></div>
      <h3 className="mt-6 border-b border-[#e5e5e7] pb-2 text-base font-semibold">調査記録・原資料（{data.records.length}件）</h3>
      {data.records.map(record => <details key={record.id} data-research-id={record.id} className="border-b border-[#e5e5e7]">
        <summary className="cursor-pointer px-2 py-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-[#027FDC]">
          <span className="mr-3 text-xs text-[#6e6e73]">{record.date} · {record.kind}</span><span className="font-medium">{record.title}</span>
        </summary>
        <div className="min-w-0 px-3 pb-5">
          <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#027FDC] underline">原資料を開く</a>
          {record.notice && <p className="my-3 text-xs leading-6 text-[#6e6e73]">{record.notice}</p>}
          <div className="overflow-x-auto text-sm [&_p]:leading-7 [&_li]:leading-7 [&_td]:text-[12px] [&_th]:text-[12px]"><MarkdownView source={record.bodyMd} /></div>
        </div>
      </details>)}
    </>}
  </article>;
}
