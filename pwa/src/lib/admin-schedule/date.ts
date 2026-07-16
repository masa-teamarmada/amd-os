import { isJapaneseHoliday } from "../japanese-holidays.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const YM = /^\d{6}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function isYm(value: unknown): value is string {
  return typeof value === "string" && YM.test(value);
}

export function ymdFromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function todayJst(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return ymdFromDate(jst);
}

export function ymFromDate(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  const text = String(value ?? "");
  const match = text.match(/^(\d{4})[-/]?(\d{2})/);
  return match ? `${match[1]}${match[2]}` : null;
}

export function addMonthsYm(ym: string, delta: number): string {
  if (!isYm(ym)) throw new Error(`invalid ym: ${ym}`);
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function addDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return ymdFromDate(date);
}

export function lastDayOfYm(ym: string): string {
  if (!isYm(ym)) throw new Error(`invalid ym: ${ym}`);
  const date = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)), 0));
  return ymdFromDate(date);
}

export function dateAtDay(ym: string, day: number): string | null {
  if (!isYm(ym) || !Number.isInteger(day) || day < 1) return null;
  const max = Number(lastDayOfYm(ym).slice(8, 10));
  if (day > max) return null;
  return `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, "0")}`;
}

export function adjustToNextBusinessDay(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  let candidate = iso;
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(`${candidate}T00:00:00Z`);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    if (!weekend && !isJapaneseHoliday(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return iso;
}

export function nextMonthDay(ym: string, day: number, adjust = true): string | null {
  const next = addMonthsYm(ym, 1);
  const date = dateAtDay(next, day);
  return date ? (adjust ? adjustToNextBusinessDay(date) : date) : null;
}

export function nextMonthEnd(ym: string, adjust = true): string {
  const date = lastDayOfYm(addMonthsYm(ym, 1));
  return adjust ? adjustToNextBusinessDay(date) : date;
}

export function fiscalYearEndYm(fiscalYearEndMonth: number, fiscalYear: number): string {
  return `${fiscalYear + (fiscalYearEndMonth === 12 ? 0 : 1)}${String(fiscalYearEndMonth).padStart(2, "0")}`;
}

export function fiscalYearEndDate(fiscalYearEndMonth: number, fiscalYear: number): string {
  return lastDayOfYm(fiscalYearEndYm(fiscalYearEndMonth, fiscalYear));
}

export function annualRange(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function scheduleGenerationRange(today: string): { from: string; to: string } {
  if (!isIsoDate(today)) throw new Error(`invalid schedule range date: ${today}`);
  const year = Number(today.slice(0, 4));
  return { from: `${year - 1}-01-01`, to: `${year + 2}-12-31` };
}

export function monthList(fromYm: string, months: number): string[] {
  return Array.from({ length: months }, (_, index) => addMonthsYm(fromYm, index));
}

export function dateInRange(iso: string | null, from: string, to: string): boolean {
  return Boolean(iso && iso >= from && iso <= to);
}

export function ymInRange(ym: string | null, from: string, to: string): boolean {
  if (!ym) return false;
  const fromYm = from.slice(0, 7).replace("-", "");
  const toYm = to.slice(0, 7).replace("-", "");
  return ym >= fromYm && ym <= toYm;
}

export function daysUntil(dueOn: string, today = todayJst()): number {
  return Math.round((Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}
