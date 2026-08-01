import type { ExternalProjectWorkspaceBundle } from "@/lib/external-project-workspace";

// Read-only surface for workspace_account viewers. Renders only the fields present on
// ExternalProjectWorkspaceBundle — do not import ProjectWorkspaceBundle or any internal
// management types here, and do not add member/effort/evidence UI to this component.
function formatYm(ym: string | null) {
  if (!ym || ym.length !== 6) return "未設定";
  return `${ym.slice(0, 4)}/${ym.slice(4, 6)}`;
}

export function ExternalProjectWorkspaceDashboard({ bundle }: { bundle: ExternalProjectWorkspaceBundle }) {
  return (
    <main className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-[#d6cebf] bg-white p-5">
        <h1 className="text-lg font-bold text-[#24231f]">{bundle.project.projectName}</h1>
        <p className="mt-1 text-[13px] text-[#777166]">状態: {bundle.project.status}</p>
      </section>

      <section className="mt-4 rounded-lg border border-[#d6cebf] bg-white p-5">
        <h2 className="text-[13px] font-semibold text-[#24231f]">計画期間</h2>
        {bundle.planCycle ? (
          <p className="mt-2 text-[13px] text-[#4a453c]">
            {formatYm(bundle.planCycle.periodStartYm)} 〜 {formatYm(bundle.planCycle.periodEndYm)}
            <span className="ml-2 text-[#777166]">（{bundle.planCycle.status}）</span>
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-[#777166]">計画期間は未設定です。</p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-[#d6cebf] bg-white p-5">
        <h2 className="text-[13px] font-semibold text-[#24231f]">マイルストーン</h2>
        {bundle.milestones.length === 0 ? (
          <p className="mt-2 text-[13px] text-[#777166]">マイルストーンは未登録です。</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {bundle.milestones.map((milestone) => (
              <li key={milestone.milestoneId} className="rounded-md border border-[#e7e1d4] bg-[#fffdf7] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#24231f]">{milestone.title}</span>
                  <span className="text-[11px] text-[#777166]">目標: {formatYm(milestone.targetYm)}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-[#efe9dc]">
                  <div
                    className="h-2 rounded-full bg-[#38745d]"
                    style={{ width: `${milestone.progressPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#777166]">進捗 {milestone.progressPct}%</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
