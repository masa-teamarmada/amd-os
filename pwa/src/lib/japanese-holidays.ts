/**
 * 日本の祝日 + 営業日補正。
 *
 * iOS 版で「isJapaneseHoliday の前日参照が連休で無限ループ」事故あり (BUGS.md 参照)。
 * このモジュールは:
 *  - 祝日リストを Set にハードコード (再帰なし)
 *  - adjustForBusinessDay() は while ループだが iteration 上限で必ず抜ける
 *  - 前日参照で他の祝日を引かない (Set 直接判定のみ)
 */

// 2024 — 2027 の日本祝日 (内閣府発表ベース、振替休日含む)
const JAPANESE_HOLIDAYS = new Set<string>([
  // 2024
  "2024-01-01", "2024-01-08", "2024-02-11", "2024-02-12", "2024-02-23",
  "2024-03-20", "2024-04-29", "2024-05-03", "2024-05-04", "2024-05-05",
  "2024-05-06", "2024-07-15", "2024-08-11", "2024-08-12", "2024-09-16",
  "2024-09-22", "2024-09-23", "2024-10-14", "2024-11-03", "2024-11-04",
  "2024-11-23",
  // 2025
  "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24",
  "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23",
  "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
  // 2026
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23",
  // 2027
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23",
]);

/** YYYY-MM-DD 形式が日本の祝日か (再帰なし、Set 直接判定) */
export function isJapaneseHoliday(ymd: string): boolean {
  return JAPANESE_HOLIDAYS.has(ymd);
}

/** Date が日本の祝日か */
function isHolidayDate(date: Date): boolean {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return JAPANESE_HOLIDAYS.has(`${y}-${m}-${d}`);
}

/**
 * 土日祝なら前営業日に補正する。
 *
 * ループ上限 = 14 日。連休 (例: GW) でも 14 日内には必ず平日が来るので無限にならない。
 * iOS の旧バグ (再帰呼び出しで stack overflow) を踏まないよう、必ず for ループで回数上限あり。
 *
 * @param iso "YYYY-MM-DD" 形式
 * @returns 補正後の "YYYY-MM-DD"
 */
export function adjustToPreviousBusinessDay(iso: string): string {
  // UTC の日付を作って ±day
  const [yStr, mStr, dStr] = iso.slice(0, 10).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return iso;

  const date = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 14; i++) {
    const dow = date.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend && !isHolidayDate(date)) {
      const yy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    }
    date.setUTCDate(date.getUTCDate() - 1);
  }
  // 安全弁: 14 日遡っても平日に当たらなければ元の日付を返す
  return iso;
}

/**
 * `bizYm` (例: "202604") の翌月 `dueDay` 日を「土日祝なら前営業日に補正」した YYYY-MM-DD。
 * dueDay が無効 (null/0/負数) や月末超過時は翌月末を使う。
 */
export function computePaymentDueDate(bizYm: string, dueDay: number | null | undefined): string {
  if (bizYm.length !== 6) return new Date().toISOString().slice(0, 10);
  const y = Number(bizYm.slice(0, 4));
  const m = Number(bizYm.slice(4, 6));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  // 翌月末 (= 翌々月 1 日 - 1 日) を limit に
  const lastDayOfNextMonth = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const day = !dueDay || dueDay <= 0 ? lastDayOfNextMonth : Math.min(dueDay, lastDayOfNextMonth);
  const iso = `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return adjustToPreviousBusinessDay(iso);
}
