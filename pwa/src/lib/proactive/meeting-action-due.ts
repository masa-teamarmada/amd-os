export type MeetingNextActionDueSource =
  | "explicit_next_meeting_date"
  | "explicit_deadline_date"
  | "fallback_meeting_date_plus_days";

export type MeetingNextActionDueResolution = {
  dueAt: string;
  source: MeetingNextActionDueSource;
  matchedText?: string;
};

const DEFAULT_FALLBACK_DAYS = 7;

const DATE_CONTEXT_RE =
  /(?:まで|迄|期限|締切|〆切|提出|提示|作成|回答|返送|次回|MTG|ＭＴＧ|mtg|会議|打合せ|打ち合わせ|定例|面談)/;
const MEETING_CONTEXT_RE = /(?:次回|MTG|ＭＴＧ|mtg|会議|打合せ|打ち合わせ|定例|面談)/;
const FULL_DATE_RE = /(20\d{2})\s*(?:[\/.\-]|年)\s*(\d{1,2})\s*(?:[\/.\-]|月)\s*(\d{1,2})\s*(?:日)?/g;
const MONTH_DAY_RE = /(?<!\d)(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*(?:日)?/g;
const TIME_RE = /(\d{1,2})\s*(?:[:：時])\s*(\d{1,2})?/;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function jstIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00+09:00`).toISOString();
}

function meetingDateAsUtcMidnight(meetingDate: string): Date {
  return new Date(`${meetingDate.slice(0, 10)}T00:00:00.000Z`);
}

function inferYearForMonthDay(month: number, day: number, meetingDate: string): number {
  const reference = meetingDateAsUtcMidnight(meetingDate);
  let year = reference.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getTime() < reference.getTime() - 7 * 86400_000) {
    year += 1;
  }
  return year;
}

function contextAround(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 24), Math.min(text.length, index + length + 32));
}

function extractTime(context: string): { hour: number; minute: number } | null {
  const match = context.match(TIME_RE);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function explicitDueIsoForCandidate(
  text: string,
  index: number,
  length: number,
  year: number,
  month: number,
  day: number,
  meetingDate: string,
): MeetingNextActionDueResolution | null {
  if (!isValidYmd(year, month, day)) return null;

  const meetingDay = meetingDateAsUtcMidnight(meetingDate).getTime();
  const candidateDay = new Date(Date.UTC(year, month - 1, day)).getTime();
  if (candidateDay < meetingDay - 86400_000) return null;

  const context = contextAround(text, index, length);
  if (!DATE_CONTEXT_RE.test(context)) return null;

  const time = extractTime(context);
  const hasMeetingContext = MEETING_CONTEXT_RE.test(context);
  const hour = time?.hour ?? (hasMeetingContext ? 9 : 18);
  const minute = time?.minute ?? 0;
  return {
    dueAt: jstIso(year, month, day, hour, minute),
    source: hasMeetingContext ? "explicit_next_meeting_date" : "explicit_deadline_date",
    matchedText: text.slice(index, index + length),
  };
}

export function resolveMeetingNextActionDueAt(
  nextActionText: string,
  meetingDate: string,
  fallbackDays = DEFAULT_FALLBACK_DAYS,
): MeetingNextActionDueResolution {
  const text = String(nextActionText || "").replace(/\s+/g, " ").trim();

  for (const match of text.matchAll(FULL_DATE_RE)) {
    const index = match.index ?? 0;
    const resolved = explicitDueIsoForCandidate(
      text,
      index,
      match[0].length,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      meetingDate,
    );
    if (resolved) return resolved;
  }

  for (const match of text.matchAll(MONTH_DAY_RE)) {
    const index = match.index ?? 0;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = inferYearForMonthDay(month, day, meetingDate);
    const resolved = explicitDueIsoForCandidate(
      text,
      index,
      match[0].length,
      year,
      month,
      day,
      meetingDate,
    );
    if (resolved) return resolved;
  }

  return {
    dueAt: addDaysIso(meetingDate, fallbackDays),
    source: "fallback_meeting_date_plus_days",
  };
}
