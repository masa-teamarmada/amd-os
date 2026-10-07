"use client";

import { useState } from "react";
import type { ProjectManagementMinute } from "@/lib/project-management-minutes";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import { ProjectContentModal } from "./ProjectContentModal";
import type { ProjectManagementBiographies as Biographies } from "@/lib/project-management-biographies";
import { ProjectManagementBiographies } from "./ProjectManagementBiographies";
import type { ProjectOrganizationChartData } from "@/lib/project-organization-chart";
import { ProjectOrganizationChart } from "./ProjectOrganizationChart";
import type { DdEmptyPageKey } from "@/lib/dd-pages";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";

export type ResolutionDocument = { itemId: string; label: string; href: string };

/** 新しい資料区分の共通空状態。既存の説明記事を資料登録済みとは扱わない。 */
export function ProjectDiligenceSection({ page, organizationChart, biographies, managementMinutes = [], resolutionDocuments = [] }: { page: DdEmptyPageKey; managementMinutes?: ProjectManagementMinute[]; resolutionDocuments?: ResolutionDocument[]; biographies?: Biographies | null; organizationChart?: ProjectOrganizationChartData | null }) {
  if (page === "team") return <ProjectManagementBiographies data={biographies ?? null} />;
  if (page === "organization-chart") return <ProjectOrganizationChart initialData={organizationChart ?? null} />;
  if (page === "governance") return <ProjectMeetingResolutions minutes={managementMinutes} documents={resolutionDocuments} />;
  return (
    <div data-testid="project-diligence-empty" data-page={page} className="space-y-3 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS[page]}</h2>
      <p className="text-sm text-[#6e6e73]">資料未登録</p>
    </div>
  );
}

/** 決議記録の一覧。資料登録前でも、会議体と列を常設する。 */
function ProjectMeetingResolutions({ minutes, documents }: { minutes: ProjectManagementMinute[]; documents: ResolutionDocument[] }) {
  const [selectedMinute, setSelectedMinute] = useState<ProjectManagementMinute | null>(null);
  return (
    <div data-testid="project-meeting-resolutions" className="space-y-6 py-3">
      <h2 className="text-lg font-semibold leading-7">{PROJECT_PAGE_LABELS.governance}</h2>
      {["株主総会", "取締役会", "経営会議"].map((body) => (
        <section key={body} className="overflow-hidden rounded-xl border border-[#e5e5e7] bg-white" aria-label={body}>
          <h3 className="border-b border-[#e5e5e7] px-4 py-3 text-sm font-semibold">{body}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed text-sm">
              <colgroup><col className="w-40" /><col className="w-1/2" /><col /></colgroup>
              <thead className="bg-[#f5f5f7] text-left text-xs text-[#6e6e73]">
                <tr>
                  {["開催日", "決議事項", "決議結果"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {body === "経営会議" && minutes.length ? minutes.flatMap((minute) => {
                  const pairs = minute.resolutions.length ? minute.resolutions : [{ agenda: "決議事項・結果の対応未整理", outcome: "未確認", detail: "議事録本文で確認してください。", attachmentItemIds: [] as string[] }];
                  return pairs.map((pair, index) => <tr key={`${minute.meetingId}:${index}`} className="border-t border-[#e5e5e7] align-top" data-meeting-id={minute.meetingId} data-resolution-row>
                    {index === 0 && <td rowSpan={pairs.length} className="px-4 py-3">
                      <time className="whitespace-nowrap tabular-nums" dateTime={minute.meetingDate}>{minute.meetingDate.replaceAll("-", "/")}</time>
                      {minute.narrativeMd ? <button type="button" className="mt-3 min-h-11 rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-xs font-medium text-[#0066cc] hover:bg-[#f5f5f7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007aff]" aria-label={`${minute.meetingDate}の議事録を開く`} aria-haspopup="dialog" onClick={() => setSelectedMinute(minute)}>議事録を開く</button> : <p className="mt-3 text-xs text-[#6e6e73]">本文未登録</p>}
                    </td>}
                    <td className="break-words px-4 py-3 leading-6"><p className="font-medium">{pair.agenda}</p>{documents.filter(document => pair.attachmentItemIds?.includes(document.itemId)).map(document => <a key={document.itemId} href={document.href} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs text-[#0066cc] underline underline-offset-2">{document.label}を開く</a>)}</td>
                    <td className="break-words px-4 py-3 leading-6"><p className="font-semibold">{pair.outcome}</p>{pair.detail && <p className="mt-1 text-[#6e6e73]">{pair.detail}</p>}</td>
                  </tr>);
                }) : <tr><td colSpan={3} className="px-4 py-5 text-[#6e6e73]">{body === "経営会議" ? "開催済みの経営会議記録は未登録" : "決議事項未登録"}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {selectedMinute && <ProjectContentModal title={selectedMinute.title} subtitle={selectedMinute.meetingDate.replaceAll("-", "/")} onClose={() => setSelectedMinute(null)}><MarkdownView source={selectedMinute.narrativeMd ?? ""} /></ProjectContentModal>}
    </div>
  );
}
