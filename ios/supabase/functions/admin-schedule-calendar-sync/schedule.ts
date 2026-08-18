export type CalendarScheduleRow = {
  occurrence_key: string;
  title: string;
  due_on: string;
  category: string;
  source_kind: string;
};

export type TimedEventPlan = CalendarScheduleRow & {
  start_time: string;
  end_time: string;
  duration_minutes: number;
};

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
