export type ProjectManagementMinute = {
  meetingId: string;
  meetingDate: string;
  title: string;
  summary: string;
  decided: string[];
  narrativeMd: string | null;
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
  return { meetingId: id, meetingDate: date, title, summary, decided, narrativeMd };
}
