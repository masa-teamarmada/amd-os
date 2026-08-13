export interface SxFundingMeetingEvidence {
  meetingId: string;
  meetingDate: string;
  title: string;
  summaryShort: string;
  decided: string[];
  progress: string[];
  nextActions: string[];
  risks: string[];
  narrativeMd: string | null;
}

export interface SxFirstFundingTarget {
  ym: string;
  sourceMeetingDate: string;
  sourceMeetingId: string;
  evidenceState: "internal_target";
}

function normalizeJapaneseDateText(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ");
}

function meetingEvidenceSegments(meeting: SxFundingMeetingEvidence) {
  return [
    meeting.title,
    meeting.summaryShort,
    ...meeting.decided,
    ...meeting.progress,
    ...meeting.nextActions,
    ...meeting.risks,
    meeting.narrativeMd ?? "",
  ].flatMap((value) => value.split(/[。！？\n]/).map(normalizeJapaneseDateText).filter(Boolean));
}

/**
 * SXの初回資金調達「内部目標」だけを会議証跡から抽出する。
 * active資本政策の入金計上日や、投資家との合意・着金実績へは昇格しない。
 */
export function extractSxFirstFundingTarget(
  meetings: readonly SxFundingMeetingEvidence[],
): SxFirstFundingTarget | null {
  for (const meeting of [...meetings].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))) {
    for (const segment of meetingEvidenceSegments(meeting)) {
      if (!/(?:初回|会社設立.{0,40})?資金調達/.test(segment)) continue;
      const match = segment.match(/(20\d{2})年\s*(1[0-2]|0?[1-9])月(?:末|まで)?/)
        ?? segment.match(/(20\d{2})[-/.](1[0-2]|0?[1-9])(?:末|まで)?/);
      if (!match) continue;
      return {
        ym: `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`,
        sourceMeetingDate: meeting.meetingDate,
        sourceMeetingId: meeting.meetingId,
        evidenceState: "internal_target",
      };
    }
  }
  return null;
}
