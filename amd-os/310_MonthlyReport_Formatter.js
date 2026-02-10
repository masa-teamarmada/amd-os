/**
 * 310_MonthlyReport_Formatter.gs
 * 
 * 役割:
 * - 日時フォーマットの統一(全てJST)
 * - 人間が読みやすい形式に変換
 * 
 * 方針:
 * - 全ての時刻は日本時間で扱う
 * - 表示用フォーマットは一箇所で管理
 */

/**
 * JSTの現在時刻を取得
 * @return {Date} 日本時間のDateオブジェクト
 */
function mr_now_() {
  return new Date();
}

/**
 * DateオブジェクトをJST文字列に変換
 * @param {Date} date - 変換するDate
 * @param {string} format - フォーマット形式(デフォルト: "yyyy-MM-dd HH:mm:ss")
 * @return {string} フォーマット済み日時文字列
 */
function mr_formatJst_(date, format) {
  if (!date) return '';
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  format = format || "yyyy-MM-dd HH:mm:ss";
  return Utilities.formatDate(date, "Asia/Tokyo", format);
}

/**
 * 人間が読みやすい日時フォーマット
 * 例: "2025年1月15日 14:30"
 * @param {Date} date
 * @return {string}
 */
function mr_formatReadable_(date) {
  if (!date) return '';
  return mr_formatJst_(date, "yyyy年M月d日 HH:mm");
}

/**
 * 日付のみのフォーマット
 * 例: "2025年1月15日"
 * @param {Date} date
 * @return {string}
 */
function mr_formatDateOnly_(date) {
  if (!date) return '';
  return mr_formatJst_(date, "yyyy年M月d日");
}

/**
 * 時刻のみのフォーマット
 * 例: "14:30"
 * @param {Date} date
 * @return {string}
 */
function mr_formatTimeOnly_(date) {
  if (!date) return '';
  return mr_formatJst_(date, "HH:mm");
}

/**
 * 相対時刻表示
 * 例: "3日前", "2時間前", "たった今"
 * @param {Date} date
 * @return {string}
 */
function mr_formatRelative_(date) {
  if (!date) return '';
  
  const now = mr_now_();
  const diffMs = now - new Date(date);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}週間前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}ヶ月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

/**
 * yyyymm形式から人間が読みやすい形式に変換
 * 例: "202501" -> "2025年1月"
 * @param {string} ym
 * @return {string}
 */
function mr_formatYm_(ym) {
  if (!ym || ym.length !== 6) return '';
  const year = ym.slice(0, 4);
  const month = parseInt(ym.slice(4, 6), 10);
  return `${year}年${month}月`;
}

/**
 * 期間表示
 * 例: "2025年1月15日 14:30 〜 16:30"
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {string}
 */
function mr_formatPeriod_(startDate, endDate) {
  if (!startDate || !endDate) return '';
  
  const startStr = mr_formatReadable_(startDate);
  const endStr = mr_formatTimeOnly_(endDate);
  
  return `${startStr} 〜 ${endStr}`;
}

/**
 * UnixタイムスタンプをDateに変換(Slack用)
 * @param {string|number} ts - Slackのタイムスタンプ
 * @return {Date}
 */
function mr_slackTsToDate_(ts) {
  if (!ts) return null;
  const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
  return new Date(timestamp * 1000);
}

/**
 * ISO8601文字列をDateに変換
 * @param {string} isoString
 * @return {Date}
 */
function mr_isoToDate_(isoString) {
  if (!isoString) return null;
  return new Date(isoString);
}

/**
 * 月初日を取得
 * @param {string} ym - yyyymm形式
 * @return {Date}
 */
function mr_getMonthStart_(ym) {
  const year = parseInt(ym.slice(0, 4), 10);
  const month = parseInt(ym.slice(4, 6), 10);
  return new Date(year, month - 1, 1, 0, 0, 0);
}

/**
 * 月末日を取得
 * @param {string} ym - yyyymm形式
 * @return {Date}
 */
function mr_getMonthEnd_(ym) {
  const year = parseInt(ym.slice(0, 4), 10);
  const month = parseInt(ym.slice(4, 6), 10);
  return new Date(year, month, 0, 23, 59, 59);
}
