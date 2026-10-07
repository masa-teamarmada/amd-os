import type { ProjectManagementMinute } from "@/lib/project-management-minutes";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import type { ProjectManagementBiographies as Biographies } from "@/lib/project-management-biographies";
import { ProjectManagementBiographies } from "./ProjectManagementBiographies";
import type { ProjectOrganizationChartData } from "@/lib/project-organization-chart";
import { ProjectOrganizationChart } from "./ProjectOrganizationChart";
import type { DdEmptyPageKey } from "@/lib/dd-pages";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";

/** 新しい資料区分の共通空状態。既存の説明記事を資料登録済みとは扱わない。 */
export function ProjectDiligenceSection({ page, organizationChart, biographies, managementMinutes = [] }: { page: DdEmptyPageKey; managementMinutes?: ProjectManagementMinute[]; biographies?: Biographies | null; organizationChart?: ProjectOrganizationChartData | null }) {
  if (page === "team") return <ProjectManagementBiographies data={biographies ?? null} />;
  if (page === "organization-chart") return <ProjectOrganizationChart initialData={organizationChart ?? null} />;
  if (page === "governance") return <ProjectMeetingResolutions minutes={managementMinutes} />;
  return (
    <div data-testid="project-diligence-empty" data-page={page} className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS[page]}</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
}

/** 決議記録の一覧。資料登録前でも、会議体と列を常設する。 */
function ProjectMeetingResolutions({ minutes }: { minutes: ProjectManagementMinute[] }) {
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
              <tbody>
                {body === "経営会議" && minutes.length ? minutes.map((minute) => (
                  <tr key={minute.meetingId} className="border-t border-[#e5e5e7] align-top" data-meeting-id={minute.meetingId}>
                    <td className="whitespace-nowrap px-4 py-3"><time dateTime={minute.meetingDate}>{minute.meetingDate.replaceAll("-", "/")}</time></td>
                    <td className="min-w-48 px-4 py-3"><p className="font-medium">{minute.title}</p>{minute.summary && <p className="mt-1 text-xs text-[#6e6e73]">{minute.summary}</p>}</td>
                    <td className="min-w-48 px-4 py-3">{minute.decided.length ? <ul className="list-disc space-y-1 pl-4">{minute.decided.map((item, index) => <li key={index}>{item}</li>)}</ul> : <span className="text-[#6e6e73]">決定事項の記録なし</span>}</td>
                    <td className="w-2/5 min-w-64 px-4 py-3">{minute.narrativeMd ? (
                      <details className="group"><summary className="min-h-11 cursor-pointer content-center text-[#007aff] focus-visible:outline-2" aria-label={`${minute.meetingDate}の議事録を読む`}>議事録を読む</summary><div className="mt-2 break-words"><MarkdownView source={minute.narrativeMd} /></div></details>
                    ) : <span className="text-[#6e6e73]">本文未登録</span>}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-4 py-5 text-[#6e6e73]">{body === "経営会議" ? "開催済みの経営会議記録は未登録" : "決議事項未登録"}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
