const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function yearMonth(year: number, zeroBasedMonth: number): string {
  const date = new Date(Date.UTC(year, zeroBasedMonth, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 20日までは当月、21日からは翌月の支払準備を最初に見せる。判定は日本時間。 */
export function defaultPayoutPaymentYm(now = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return yearMonth(jst.getUTCFullYear(), jst.getUTCMonth() + (jst.getUTCDate() > 20 ? 1 : 0));
}

/** 先2か月と過去11か月を選べるようにし、URLで指定された月は必ず残す。 */
export function selectablePayoutPaymentYms(selectedYm: string, now = new Date()): string[] {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const options = [selectedYm];
  for (let offset = 2; offset >= -11; offset--) {
    options.push(yearMonth(jst.getUTCFullYear(), jst.getUTCMonth() + offset));
  }
  return [...new Set(options)];
}
