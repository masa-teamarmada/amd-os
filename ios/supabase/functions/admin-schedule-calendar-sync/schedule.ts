import { normalizePjCode, resolveColorIdForProject } from "./pj-color.ts";

export type CalendarScheduleRow = {
  occurrence_key: string;
  title: string;
  due_on: string;
  category: string;
  source_kind: string;
  /** 案件の予定なら project_id、会社全体の予定なら null */
  project_id?: string | null;
};

export type TimedEventPlan = CalendarScheduleRow & {
  start_time: string;
  end_time: string;
  duration_minutes: number;
};

/**
 * カレンダーへ出す見出し。AMD OS が入れた予定は「＋<PJコード> <本文>」で揃える
 * (manual 3-2 §PJ → カレンダー色)。元データの `CX / 月次報告提出` のような
 * 「PJ / 」接頭辞は PJ コードへ畳み、会社全体の予定は AMD を付ける。
 */
export function calendarEventTitle(row: Pick<CalendarScheduleRow, "title" | "project_id">): string {
  const pjCode = normalizePjCode(row.project_id) || "AMD";
  let body = String(row.title || "").trim().replace(/^[+＋]\s*/, "");
  // 元データの「CX / 月次報告提出」や、再同期で読み直した「＋CX 契約満了」から
  // 先頭の PJ 名を外し、PJ コードを二重に並べない。
  for (const separator of [" / ", " "]) {
    const at = body.indexOf(separator);
    if (at <= 0) continue;
    if (normalizePjCode(body.slice(0, at).trim()) !== pjCode) continue;
    body = body.slice(at + separator.length).trim();
    break;
  }
  return `＋${pjCode} ${body}`.trim();
}

/** その PJ に割り当たっている event colorId。色を持たない PJ は null (色なしで書く) */
export function calendarEventColorId(row: Pick<CalendarScheduleRow, "project_id" | "due_on">): string | null {
  return resolveColorIdForProject(row.project_id, row.due_on || new Date());
}

const DAY_START_MINUTES = 9 * 60;
const LUNCH_START_MINUTES = 12 * 60;
const LUNCH_END_MINUTES = 13 * 60;

export function workDurationMinutes(row: Pick<CalendarScheduleRow, "category" | "source_kind">): number {
  if (row.source_kind === "internal_prep_milestone") return 120;
  if (row.category === "report" || row.category === "governance") return 120;
  if (row.category === "tax") return 90;
  return 60;
}

function timeAt(iso: string, minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${iso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`;
}

export function buildTimedEventPlans(rows: CalendarScheduleRow[]): TimedEventPlan[] {
  const cursorByDate = new Map<string, number>();
  return [...rows]
    .sort((left, right) => left.due_on.localeCompare(right.due_on)
      || left.title.localeCompare(right.title)
      || left.occurrence_key.localeCompare(right.occurrence_key))
    .map((row) => {
      const duration = workDurationMinutes(row);
      let start = cursorByDate.get(row.due_on) ?? DAY_START_MINUTES;
      if (start < LUNCH_END_MINUTES && start + duration > LUNCH_START_MINUTES) start = LUNCH_END_MINUTES;
      const end = start + duration;
      cursorByDate.set(row.due_on, end);
      return {
        ...row,
        start_time: timeAt(row.due_on, start),
        end_time: timeAt(row.due_on, end),
        duration_minutes: duration,
      };
    });
}
