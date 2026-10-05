/** 月報を開いたときの対象月。日本時間25日から当月、それ以前は前月。 */
export function getDefaultMonthlyReportYm(now = new Date()): string {
  const japanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const month = japanTime.getUTCMonth() - (japanTime.getUTCDate() < 25 ? 1 : 0);
  const target = new Date(Date.UTC(japanTime.getUTCFullYear(), month, 1));
  return `${target.getUTCFullYear()}${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}
