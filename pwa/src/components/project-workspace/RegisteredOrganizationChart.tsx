import type { ProjectOrganizationChartData } from "@/lib/project-organization-chart";
export function RegisteredOrganizationChart({ data }: { data: ProjectOrganizationChartData }) {
  const area = Math.max(760, data.departments.length * 330 + 100), center = area / 2, partnerX = area + 80, width = partnerX + 300;
  const bodyBottom = 20 + (data.governingBodies.length - 1) * 62 + (data.governingBodies.at(-1)?.person ? 70 : 42);
  const departmentTop = bodyBottom + 46;
  const departmentHeight = Math.max(220, ...data.departments.map((d) => 70 + d.roles.length * 20 + d.people.length * 20));
  const partnerHeights = data.collaborations.map((p) => Math.max(130, 64 + p.roles.length * 20 + p.people.length * 20));
  const partnerTops = partnerHeights.map((_, i) => departmentTop + partnerHeights.slice(0, i).reduce((a, h) => a + h + 14, 0));
  const height = Math.max(departmentTop + departmentHeight + 90, (partnerTops.at(-1) ?? 0) + (partnerHeights.at(-1) ?? 0) + 24);
  return <section data-testid="project-organization-chart" className="min-w-0 space-y-2 py-2">
    <header className="flex items-baseline gap-3"><h2 className="text-lg font-semibold">組織図</h2><span className="text-xs text-slate-500">{data.status === "proposed" ? "組織案" : "登録済み"} · {data.asOf}</span></header>
    <div className="max-w-full overflow-x-auto border-y border-slate-200 py-3 focus-visible:outline-2 focus-visible:outline-sky-600" tabIndex={0} role="region" aria-label="組織・協業体制。横にスクロール可能">
      <div className="relative mx-auto bg-white" style={{ width, height }} role="group" aria-label="会議体・代表者から部署へつながる縦型組織図">
        <svg className="absolute inset-0 h-full w-full" viewBox={"0 0 " + width + " " + height} aria-hidden="true" fill="none" stroke="#607487" strokeWidth="1.5">
          <defs><marker id="registered-org-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="#607487" stroke="none" /></marker></defs>
          {data.governingBodies.slice(0, -1).map((g, i) => <path key={g.label + i} d={"M" + center + " " + (62 + i * 62) + "V" + (82 + i * 62)} />)}
          <path d={"M" + center + " " + bodyBottom + "V" + (departmentTop - 20)} />
          {data.departments.map((d, i) => <path key={d.id} d={"M" + center + " " + (departmentTop - 20) + "H" + (199 + i * 330) + "V" + departmentTop} />)}
          {data.collaborations.map((p, i) => {
            const index = data.departments.findIndex((d) => d.id === p.departmentId), siblings = data.collaborations.filter((c) => c.departmentId === p.departmentId), slot = siblings.indexOf(p);
            const start = departmentTop + departmentHeight * (slot + 1) / (siblings.length + 1), end = partnerTops[i] + partnerHeights[i] / 2;
            const lane = area + 24 + (i % 2) * 16;
            return <path key={p.id} markerStart="url(#registered-org-arrow)" markerEnd="url(#registered-org-arrow)" d={"M" + (348 + index * 330) + " " + start + "H" + lane + "V" + end + "H" + (partnerX - 4)} />;
          })}
        </svg>
        {data.governingBodies.map((g, i) => <div key={g.label + i} className="absolute flex flex-col items-center justify-center border border-sky-700/50 bg-slate-50 text-center" style={{ left: center - 130, top: 20 + i * 62, width: 260, height: g.person ? 70 : 42 }}><strong className="text-base">{g.label}</strong>{g.person && <span className="text-sm">{g.person}</span>}</div>)}
        {data.departments.map((d, i) => <div key={d.id} className="absolute border border-slate-300 bg-white" style={{ left: 54 + i * 330, top: departmentTop, width: 290, height: departmentHeight }}>
          <h3 className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-center text-base font-semibold">{d.label}</h3>
          <ul className="mx-4 my-2 list-inside list-disc text-sm leading-5">{d.roles.map((role, j) => <li key={j}>{role}</li>)}</ul>
          {d.people.length > 0 && <div className="mx-4 border-t border-slate-200 pt-2 text-xs leading-5 text-slate-500">{d.people.map((person, j) => <p key={j}>{person}</p>)}</div>}
        </div>)}
        {data.collaborations.map((p, i) => <div key={p.id} className="absolute border border-slate-400 bg-white" style={{ left: partnerX, top: partnerTops[i], width: 280, height: partnerHeights[i] }}>
          <div className="bg-slate-50 px-2 py-1 text-center"><h3 className="text-base font-semibold text-sky-800">{p.label}</h3><p className="text-xs text-slate-500">{p.relationship}</p></div>
          <ul className="mx-3 my-2 list-inside list-disc text-sm leading-5">{p.roles.map((role, j) => <li key={j}>{role}</li>)}</ul>
          {p.people.map((person, j) => <p key={j} className="px-3 text-xs text-slate-500">{person}</p>)}
        </div>)}
        <p className="absolute left-8 text-xs leading-5 text-slate-500" style={{ top: departmentTop + departmentHeight + 20 }}>実線：社内の指揮・統括関係<br />両矢印：共同研究・共同開発の連携</p>
      </div>
    </div>
    <p className="text-xs leading-5 text-slate-500">{data.note}</p>
  </section>;
}
