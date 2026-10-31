export type GovernanceMeetingKind = "shareholder" | "board";

/** 過去の抽出値も含めて、会社の機関決定を表示先へ振り分ける。 */
export function governanceMeetingKind(meetingType: string | null | undefined): GovernanceMeetingKind | null {
  const value = (meetingType ?? "").trim().toLowerCase();
  if (["agm", "egm", "shareholder_written", "shareholder_written_resolution"].includes(value)
    || value.includes("株主総会") || value.includes("shareholder")) return "shareholder";
  if (["board", "board_written", "board_written_resolution", "director_decision"].includes(value)
    || value.includes("取締役会") || value.includes("取締役決定") || value.includes("director")) return "board";
  return null;
}

export const GOVERNANCE_MEETING_TYPES = {
  shareholder: [
    { value: "agm", label: "定時株主総会" },
    { value: "egm", label: "臨時株主総会" },
    { value: "shareholder_written", label: "株主総会（書面決議）" },
  ],
  board: [
    { value: "board", label: "取締役会" },
    { value: "board_written", label: "取締役会（書面決議）" },
    { value: "director_decision", label: "取締役決定" },
  ],
} as const;

export function governanceMeetingLabel(meetingType: string | null | undefined): string {
  return [...GOVERNANCE_MEETING_TYPES.shareholder, ...GOVERNANCE_MEETING_TYPES.board]
    .find((option) => option.value === meetingType)?.label ?? meetingType ?? "種別未入力";
}
