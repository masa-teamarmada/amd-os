const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function yearMonth(year: number, zeroBasedMonth: number): string {
  const date = new Date(Date.UTC(year, zeroBasedMonth, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 支払通知書は日本時間の当月を最初に見せる。翌月以降は月選択で確認する。 */
export function defaultPayoutPaymentYm(now = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return yearMonth(jst.getUTCFullYear(), jst.getUTCMonth());
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

/** 月別入出金表は、選択した支払月の前月から比較できる位置で開く。 */
export function payoutSeasonFocusYm(paymentYm: string): string {
  return yearMonth(Number(paymentYm.slice(0, 4)), Number(paymentYm.slice(4, 6)) - 2);
}
