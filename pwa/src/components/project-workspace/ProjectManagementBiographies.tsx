import type { ProjectManagementBiographies as Biographies } from "@/lib/project-management-biographies";
export function ProjectManagementBiographies({ data }: { data: Biographies | null }) {
  return <section data-testid="project-management-biographies" className="min-w-0 space-y-6 py-3">
    <h2 className="text-lg font-semibold leading-7">経営陣略歴</h2>
    {!data?.profiles.length ? <p className="text-sm text-[#6e6e73]">資料未登録</p> : data.profiles.map(p => <article key={p.id} className="max-w-4xl space-y-6 rounded-xl border border-[#e5e5e7] bg-white p-6">
      <header className="space-y-1"><h3 className="text-xl font-semibold">{p.name}<span className="ml-3 text-xs font-normal text-[#6e6e73]">{p.reading}</span></h3><p className="text-sm text-[#3c3c43]">{p.title}</p></header>
      <div className="space-y-3 text-sm leading-7 text-[#3c3c43]">{p.summary.map((s,i)=><p key={i}>{s}</p>)}</div>
      <section className="space-y-3"><h4 className="text-sm font-semibold">現職・主な兼職</h4><ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[#3c3c43]">{p.positions.map(s=><li key={s}>{s}</li>)}</ul></section>
      <section className="space-y-3"><h4 className="text-sm font-semibold">学歴・職歴</h4><dl className="divide-y divide-[#e5e5e7] text-sm">{p.career.map((c,i)=><div key={i} className="grid grid-cols-[5rem_1fr] gap-4 py-2"><dt className="text-[#6e6e73]">{c.date.replace('/','年')}月</dt><dd className="min-w-0 leading-6 text-[#3c3c43]">{c.text}</dd></div>)}</dl></section>
      <section className="space-y-3"><h4 className="text-sm font-semibold">受賞歴</h4><ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-[#3c3c43]">{p.awards.map(s=><li key={s}>{s}</li>)}</ul></section>
    </article>)}
  </section>;
}
