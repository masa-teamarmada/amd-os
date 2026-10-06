import { ProjectOrganizationChart } from "./ProjectOrganizationChart";
import type { DdEmptyPageKey } from "@/lib/dd-pages";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";

/** 新しい資料区分の共通空状態。既存の説明記事を資料登録済みとは扱わない。 */
export function ProjectDiligenceSection({ page }: { page: DdEmptyPageKey }) {
  if (page === "organization-chart") return <ProjectOrganizationChart />;
  if (page === "governance") return <ProjectMeetingResolutions />;
  return (
    <div data-testid="project-diligence-empty" data-page={page} className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS[page]}</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
}

/** 決議記録の一覧。資料登録前でも、会議体と列を常設する。 */
function ProjectMeetingResolutions() {
  return (
    <div data-testid="project-meeting-resolutions" className="space-y-6 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS.governance}</h2>
      {["株主総会", "取締役会", "経営会議"].map((body) => (
        <section key={body} className="overflow-hidden rounded-xl border border-[#e5e5e7] bg-white" aria-label={body}>
          <h3 className="border-b border-[#e5e5e7] px-4 py-3 text-sm font-semibold">{body}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#f5f5f7] text-left text-xs text-[#6e6e73]">
                <tr>
                  {["開催日", "決議事項", "決議結果", "議事録"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
                </tr>
              </thead>
              <tbody><tr><td colSpan={4} className="px-4 py-5 text-[#6e6e73]">決議事項未登録</td></tr></tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
