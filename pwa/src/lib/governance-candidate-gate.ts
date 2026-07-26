export type GovernanceMeetingType =
  | "agm"
  | "egm"
  | "board"
  | "board_written_resolution"
  | "shareholder_written_resolution";

export type GovernanceCandidateGateInput = {
  subject: string;
  evidenceText: string;
  meetingType: string | null;
  meetingDate: string | null;
};

export type GovernanceCandidateSkipReason = "workflow_notification" | "meeting_type_missing" | "meeting_date_missing" | "held_evidence_missing";

export type GovernanceCandidateGateResult =
  | { eligible: true; meetingType: GovernanceMeetingType }
  | { eligible: false; reason: GovernanceCandidateSkipReason };

const MEETING_TYPES = new Set<GovernanceMeetingType>([
  "agm",
  "egm",
  "board",
  "board_written_resolution",
  "shareholder_written_resolution",
]);

// Jobcan 等の承認ワークフローは、議事録ファイル名を含んでいても
// 「会議が開催された」ことの根拠にはならない。開催履歴候補からは常に除外する。
const WORKFLOW_NOTIFICATION = /(?:ジョブカン(?:ワークフロー)?|jobcan|承認されていない申請|未承認(?:の)?申請|申請ID\s*[:：])/i;

// 開催履歴には、開催後に残る議事録・決議・書面決議のいずれかが必要。
// 招集通知や日程だけのメールは、履歴ではなく別の要対応レーンで扱う。
const HELD_MEETING_EVIDENCE = /(?:議事録|書面決議|みなし決議|決議(?:事項|結果|内容|書)?|開催(?:済み|結果|報告))/;

function isIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function gateGovernanceHistoryCandidate(input: GovernanceCandidateGateInput): GovernanceCandidateGateResult {
  const text = `${input.subject}\n${input.evidenceText}`;
  if (WORKFLOW_NOTIFICATION.test(text)) return { eligible: false, reason: "workflow_notification" };
  if (!input.meetingType || !MEETING_TYPES.has(input.meetingType as GovernanceMeetingType)) {
    return { eligible: false, reason: "meeting_type_missing" };
  }
  if (!isIsoDate(input.meetingDate)) return { eligible: false, reason: "meeting_date_missing" };
  if (!HELD_MEETING_EVIDENCE.test(text)) return { eligible: false, reason: "held_evidence_missing" };
  return { eligible: true, meetingType: input.meetingType as GovernanceMeetingType };
}

export function governanceCandidateSkipLabel(reason: GovernanceCandidateSkipReason): string {
  switch (reason) {
    case "workflow_notification": return "workflow notification is not meeting evidence";
    case "meeting_type_missing": return "meeting type missing";
    case "meeting_date_missing": return "meeting date missing";
    case "held_evidence_missing": return "held-meeting evidence missing";
  }
}
