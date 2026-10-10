/** Publication never includes the preparation appended to a meeting narrative. */
export function sharedMeetingNarrative(value: string | null): string | null {
  if (!value) return null;
  return value.split(/(?:^|\n)\s*(?:-{3,}\s*\n\s*)?##\s*(?:参考[:：]\s*)?会議前準備メモ[^\n]*(?:\n|$)/i, 1)[0].trim() || null;
}
export function isSharedMeetingRecord(row: {meetingId:string; sourceKinds?:string|null}): boolean {
  return !/^(upcoming|dialogue|prep)(:|$)/.test(row.meetingId)
    && !/(?:^|[+,\s])(upcoming(?:_tentative)?|dialogue|none|prep)(?:$|[+,\s])/.test(row.sourceKinds ?? "");
}
