// D003_Util.gs
// 共通ユーティリティ（toClientSafe_ / 日時フォーマット）

function toClientSafe_(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return formatJst_(obj);
  if (Array.isArray(obj)) return obj.map(toClientSafe_);
  if (typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = toClientSafe_(obj[key]);
    }
    return result;
  }
  return obj;
}

function formatJst_(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const mo = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const h = String(jst.getUTCHours()).padStart(2, '0');
  const mi = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${y}年${mo}月${d}日 ${h}:${mi}`;
}

function nowJst_() {
  return new Date();
}