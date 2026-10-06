import { ORGANIZATION_CHART_FORMAT as format } from "@/lib/project-formats";

// 役員・部署の確認済みデータが無い段階の共通ひな形。PJ参加者から雇用・指揮命令を推定しない。
// 株主総会→取締役会→代表取締役、側方の監査・直轄部門、部門→部署→担当の縦配置を固定する。
export function ProjectOrganizationChart() {
  const centers = Array.from({ length: format.departmentCount }, (_, index) => 112 + index * 328);
  const node = (key: string, label: string, x: number, y: number, governing = false) => (
    <div key={key} className={`absolute flex h-14 w-44 flex-col items-center justify-center gap-1 rounded-md border text-center ${governing ? "border-sky-200 bg-sky-50" : "border-slate-300 bg-white"}`} style={{ left: x, top: y }}>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <span className="text-xs text-slate-500">未登録</span>
    </div>
  );
  return (
    <section data-testid="project-organization-chart" className="min-w-0 space-y-4 py-3">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold leading-7">組織図</h2>
        <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">ひな形</span>
      </header>
      <p className="text-sm leading-6 text-slate-500">組織情報未登録。会議体・役員・部門の配置を示すひな形。</p>
      <p className="text-xs text-slate-500 md:hidden">図は横にスクロールして確認できる。</p>
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" tabIndex={0} role="region" aria-label="組織図のひな形。横にスクロール可能">
        <div className="relative mx-auto h-[576px] w-[880px]" role="img" aria-label="未登録の組織図ひな形。上から株主総会、取締役会、代表取締役。取締役会の横に監査役、代表取締役の横に社長直轄部門。その下に3部門と、各部門の部署・チーム、担当・役職の欄。">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 880 576" aria-hidden="true" fill="none" stroke="#94a3b8" strokeWidth="1.5">
            <path d="M440 72V104 M440 160V192 M528 132H680 M200 220H352 M440 248V284 M112 284H768" />
            {centers.map((center) => <path key={center} d={`M${center} 284V320 M${center} 376V408 M${center} 464V496`} />)}
          </svg>
          {format.governingBodies.map((label, index) => node(`body-${index}`, label, 352, 16 + index * 88, true))}
          {node("oversight", format.oversight, 680, 104)}
          {node("direct-report", format.directReport, 24, 192)}
          {centers.flatMap((center, index) => format.departmentLevels.map((label, level) => node(`department-${index}-${level}`, label, center - 88, 320 + level * 88, level === 0)))}
        </div>
      </div>
    </section>
  );
}
