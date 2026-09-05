/** S010_Utils.gs
 * 共通ユーティリティ。副作用ゼロの純関数のみ。
 */

function b_formatJst_(date, fmt) {
  return Utilities.formatDate(
    date instanceof Date ? date : new Date(date),
    'Asia/Tokyo',
    fmt || 'yyyy年MM月dd日 HH:mm'
  );
}

function utils_jstNow_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

function utils_fmtJst_(date) {
  if (!date) return "";
  return Utilities.formatDate(date instanceof Date ? date : new Date(date), "Asia/Tokyo", "yyyy年MM月dd日 HH:mm");
}

function utils_normYm_(ym) {
  const s = String(ym || "").replace(/\D/g, "");
  return s.length >= 6 ? s.slice(0, 6) : "";
}

function utils_nowYmJst_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMM");
}

function utils_getProp_(key) {
  return String(PropertiesService.getScriptProperties().getProperty(key) || "").trim();
}