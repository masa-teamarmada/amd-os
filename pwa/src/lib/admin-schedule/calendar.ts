export const CALENDAR_WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;

export type CalendarCell = {
  date: string | null;
  day: number | null;
  outside: boolean;
  weekend: boolean;
};

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function mondayIndex(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const leading = mondayIndex(year, month);
  const days = daysInMonth(year, month);
  const total = Math.ceil((leading + days) / 7) * 7;
  return Array.from({ length: total }, (_, index) => {
    const day = index - leading + 1;
    const outside = day < 1 || day > days;
    const column = index % 7;
    return {
      date: outside ? null : isoDate(year, month, day),
      day: outside ? null : day,
      outside,
      weekend: column >= 5,
    };
  });
}

export function monthKeyFromDate(date: string): string {
  return date.slice(0, 7).replace("-", "");
}

export function isDatePrecisionDay(item: { date_precision: string; due_on: string | null }): boolean {
  return item.date_precision === "day" && Boolean(item.due_on);
}

