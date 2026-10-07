export type MeetingResolution = {
  agenda: string;
  outcome: "承認" | "条件付き承認" | "否決" | "継続審議" | "方針確認" | "次回確認" | "未確認";
  detail: string;
  evidence: string;
  attachmentItemIds?: string[];
};
export const MEETING_RESOLUTIONS_KEY_PREFIX = "meeting_resolutions:";

export type ProjectManagementMinute = {
  meetingId: string;
  meetingDate: string;
  title: string;
  summary: string;
  decided: string[];
  narrativeMd: string | null;
  resolutions: MeetingResolution[];
};

/** 開催済みの経営会議だけ。準備メモ・対話・資料なしを開催記録へ昇格しない。 */
export function managementMinuteFromRow(row: Record<string, unknown>, today: string): ProjectManagementMinute | null {
  const title = String(row.title ?? "");
  const id = String(row.meeting_id ?? "");
  const date = String(row.meeting_date ?? "");
  const source = String(row.source_kinds ?? "");
  if (!/経営会議/.test(title.normalize("NFKC")) || !id || !date || date > today
    || /^(upcoming|dialogue|prep)(:|$)/.test(id)
    || /(?:^|[+,\s])(upcoming(?:_tentative)?|dialogue|none|prep)(?:$|[+,\s])/.test(source)) return null;
  const summary = typeof row.summary_short === "string" ? row.summary_short.trim() : "";
  const decided = Array.isArray(row.decided) ? row.decided.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  const narrativeMd = typeof row.narrative_md === "string" ? row.narrative_md.trim() || null : null;
  if (!summary && !decided.length && !narrativeMd) return null;
  return { meetingId: id, meetingDate: date, title, summary, decided, narrativeMd, resolutions: [] };
}

/** 原文と対応する決議だけを採用。件数や配列位置で議案と結果を結び付けない。 */
export function parseMeetingResolutions(value: unknown, sourceHash: unknown, minute: ProjectManagementMinute): MeetingResolution[] {
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    if (!data || data.version !== 1 || typeof data.sourceHash !== "string" || data.sourceHash !== sourceHash || !Array.isArray(data.entries) || data.entries.length > 100) return [];
    const source = [...minute.decided, minute.narrativeMd ?? ""].join("\n").replaceAll("\\n", "\n");
    const outcomes = ["承認", "条件付き承認", "否決", "継続審議", "方針確認", "次回確認", "未確認"];
    if (data.entries.some((entry: MeetingResolution) => !entry || typeof entry.agenda !== "string" || !entry.agenda.trim() || !outcomes.includes(entry.outcome) || typeof entry.detail !== "string" || typeof entry.evidence !== "string" || !entry.evidence.trim() || !source.includes(entry.evidence) || (entry.outcome === "条件付き承認" && !entry.detail.trim()) || (entry.attachmentItemIds !== undefined && (!Array.isArray(entry.attachmentItemIds) || entry.attachmentItemIds.length > 20 || entry.attachmentItemIds.some(id => typeof id !== "string" || !id.trim()))))) return [];
    return data.entries.map((entry: MeetingResolution) => ({ agenda: entry.agenda.trim(), outcome: entry.outcome, detail: entry.detail.trim(), evidence: entry.evidence, ...(entry.attachmentItemIds ? { attachmentItemIds: entry.attachmentItemIds } : {}) }));
  } catch { return []; }
}
