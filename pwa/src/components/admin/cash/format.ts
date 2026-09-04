/** 「現金と融資」画面の表示ヘルパ。金額は円で出す (口座の明細を1円まで突き合わせるため)。 */

export function yen(value: number | null | undefined): string {
  if (value == null) return "";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

/** 表の中で桁を詰めたいときの、記号なし表記。 */
export function amount(value: number | null | undefined): string {
  if (value == null || value === 0) return "";
  return Math.round(value).toLocaleString("ja-JP");
}

export function manYen(value: number | null | undefined): string {
  if (value == null) return "";
  return `${Math.round(value / 10000).toLocaleString("ja-JP")}万円`;
}

/** '2026-09-04' → '9/4(金)' */
export function shortDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map(Number);
  const w = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${w})`;
}

/** '2026-09-04' → '2026年9月4日' */
export function longDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

export function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** 今日 (日本時間) を 'YYYY-MM-DD' で返す。入力欄の既定値に使う。 */
export function todayIso(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
