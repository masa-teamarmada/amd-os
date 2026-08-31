export const MONTHLY_REPORT_DRIVE_ROOT = "月次報告書";

export function normalizeMonthlyReportYm(value: string): string | null {
  const normalized = value.replace("-", "");
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

export function monthlyReportDriveMonthName(ym: string): string {
  const normalized = normalizeMonthlyReportYm(ym);
  if (!normalized) throw new Error("invalid monthly report month");
  return `${normalized.slice(0, 4)}年${Number(normalized.slice(4, 6))}月`;
}

export function monthlyReportDriveFolderPath(ym: string): string {
  return `${MONTHLY_REPORT_DRIVE_ROOT}/${monthlyReportDriveMonthName(ym)}`;
}

/** 日まで確定していない成果物は、推測で月初日を補わず「◯月中」と表示する。 */
export function formatMonthlyDeliverableDate(ym: string, occurredOn?: string | null): string {
  const exact = typeof occurredOn === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(occurredOn)
    : null;
  if (exact) return `${exact[1]}年${Number(exact[2])}月${Number(exact[3])}日`;

  const normalized = normalizeMonthlyReportYm(ym);
  if (!normalized) return "日付未確定";
  return `${normalized.slice(0, 4)}年${Number(normalized.slice(4, 6))}月中`;
}
