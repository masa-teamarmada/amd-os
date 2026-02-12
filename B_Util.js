/**
 * B_Util.gs
 *
 * 目的：
 * AMD OS（特にBilling周り）で共通に使う「純関数」「小物ヘルパー」を集約する。
 * ここは “どこからでも呼ばれる” 前提の基盤で、依存方向を一方通行にする。
 *
 * ルール：
 * - SpreadsheetApp / DriveApp / GmailApp / Calendar など外部I/Oは禁止（副作用ゼロ）。
 * - 入れていいのは：文字列整形、日付/年月正規化、配列集計、型変換、A1変換など。
 * - ここに入った関数は削除しない前提（他ファイルからの依存が増える）。
 *
 * 代表例：
 * - b_colToA1_ / b_normYm_ / b_addMonths_ / b_toBool_ / b_safeJsonParse_
 * - b_sum_ / b_indexBy_ / b_groupConsecutive_
 * - b_profStart_ / b_profMark_（簡易プロファイラ）
 */

function b_colToA1_(col) {
  col = Number(col);
  if (!col || col < 1) return "";
  let s = "";
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
function b_nowIso_() {
  // ★JST固定（表示・確認性最優先）
  // 例: 2026-02-06 18:40:33
  return Utilities.formatDate(
    new Date(),
    "Asia/Tokyo",
    "yyyy-MM-dd HH:mm:ss"
  );
}

function b_normYm_(v) {
  // DBは YYYYMM を正にする
  if (v === null || v === undefined || v === "") return "";

  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyyMM");
  }

  const s = String(v).trim();

  if (/^\d{6}$/.test(s)) return s;                 // yyyyMM
  if (/^\d{4}-\d{2}$/.test(s)) return s.replace("-", ""); // yyyy-MM -> yyyyMM

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMM");
  }

  const digits = s.replace(/[^\d]/g,"");
  if (digits.length >= 6) return digits.slice(0,6);

  return s;
}
function b_addMonths_(ym, delta) {
  // ym は "yyyyMM" 前提（ただし "yyyy-MM" で来ても吸収）
  const k = b_normYm_(ym); // yyyyMM
  if (!k || k.length !== 6) return k;

  const y = Number(k.slice(0,4));
  const m = Number(k.slice(4,6));
  const d = new Date(y, (m||1)-1, 1);
  d.setMonth(d.getMonth() + (delta||0));

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}
function b_safeJsonParse_(s, fallback) {
  try {
    if (s === null || s === undefined || s === "") return fallback;
    if (typeof s === "object") return s;
    return JSON.parse(String(s));
  } catch (e) {
    return fallback;
  }
}
function b_toBool_(v, defaultVal) {
  if (v === "" || v === null || v === undefined) return defaultVal;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on", "active", "enabled", "enable", "✅"].includes(s)) return true;
  if (["false", "0", "no", "n", "off", "inactive", "disabled", "disable"].includes(s)) return false;
  return defaultVal;
}
function b_sum_(arr) { return arr.reduce((a, b) => a + Number(b || 0), 0); }
function b_indexBy_(rows, key) {
  const m = {};
  rows.forEach(r => (m[String(r[key])] = r));
  return m;
}
function b_groupConsecutive_(rows) {
  const a = Array.from(new Set(rows.map(n => Number(n||0)).filter(n => n>0))).sort((x,y)=>x-y);
  const out = [];
  let s = null, p = null;
  a.forEach(n => {
    if (s === null) { s = n; p = n; return; }
    if (n === p + 1) { p = n; return; }
    out.push([s, p]);
    s = n; p = n;
  });
  if (s !== null) out.push([s, p]);
  return out; // [[startRow,endRow],...]
}
function b_profStart_(){
  return { t0: Date.now(), marks: [] };
}
function b_profMark_(p, label){
  p.marks.push({ label: String(label||""), ms: Date.now() - p.t0 });
}
/**
 * 税込→税抜（切り捨て）
 * - freeeの tax_fraction:"omit" と整合させる
 * - taxRate は 0.10 みたいに「率」で渡す
 */
function b_calcAmountExclTax(amountInclTax, taxRate){
  const amt = Number(amountInclTax || 0);
  const rate = Number(taxRate || 0);
  if (!amt) return 0;
  if (!rate || rate <= 0) return amt;
  return Math.floor(amt / (1 + rate));
}
