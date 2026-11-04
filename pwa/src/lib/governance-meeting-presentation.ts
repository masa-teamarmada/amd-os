import type { CompanyMeeting } from "./company-overview";
import { governanceMeetingLabel } from "./governance-meeting-kind";

export function governanceMeetingDateKey(meeting: CompanyMeeting): string {
  return (meeting.meeting_date || meeting.meeting_ym || "").replace(/[^0-9]/g, "").slice(0, 8);
}

export function governanceMeetingYear(meeting: CompanyMeeting): string {
  return governanceMeetingDateKey(meeting).slice(0, 4);
}

export function governanceMeetingDateLabel(meeting: CompanyMeeting): string {
  const key = governanceMeetingDateKey(meeting);
  if (key.length === 8) return `${key.slice(0, 4)}/${key.slice(4, 6)}/${key.slice(6, 8)}`;
  if (key.length === 6) return `${key.slice(0, 4)}/${key.slice(4, 6)}`;
  return "日付未登録";
}

export function governanceMeetingResults(meeting: CompanyMeeting): string[] {
  return [...new Set((meeting.resolutions_json ?? []).map((resolution) => governanceResultLabel(resolution.result?.trim() || "未確認")))];
}

export function governanceResultLabel(result: string): string {
  return ({ approved: "可決", rejected: "否決" } as Record<string, string>)[result] || result || "未確認";
}

// Only exact recorded results have a semantic color. Free text stays neutral.
export function governanceResultTone(result: string): "complete" | "critical" | "neutral" {
  if (governanceResultLabel(result) === "可決") return "complete";
  if (governanceResultLabel(result) === "否決") return "critical";
  return "neutral";
}

export function governanceResponseLabel(value: string): string {
  return ({ none: "未対応", attended: "出席", proxy: "委任状提出", consented: "事前承諾", abstained: "棄権" } as Record<string, string>)[value] || value;
}

export function filterGovernanceMeetings(meetings: CompanyMeeting[], query: string, year: string): CompanyMeeting[] {
  const terms = query.normalize("NFKC").toLocaleLowerCase("ja-JP").trim().split(/\s+/).filter(Boolean);
  return meetings.filter((meeting) => {
    if (year && governanceMeetingYear(meeting) !== year) return false;
    const text = [meeting.meeting_date, meeting.meeting_ym, governanceMeetingLabel(meeting.meeting_type),
      meeting.agenda_summary, meeting.location, meeting.notes, meeting.source_ref,
      ...(meeting.resolutions_json ?? []).flatMap((resolution) => [resolution.title, resolution.result]),
      ...(meeting.attachments_json ?? []).map((attachment) => attachment.name),
    ].filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ja-JP");
    return terms.every((term) => text.includes(term));
  }).sort((a, b) => governanceMeetingDateKey(b).localeCompare(governanceMeetingDateKey(a)));
}
