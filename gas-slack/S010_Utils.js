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
/**
 * ワークスペース(team_id)ごとに上書きできるプロパティ解決。
 * `<key>__<teamId>` があればそれを使い、無ければ従来の `<key>` へ落ちる。
 * 既存のAMDワークスペースは teamスコープ無しでこれまで通り動く。
 */
function utils_getTeamProp_(key, teamId) {
  const k = String(key || "").trim();
  if (!k) return "";
  const t = String(teamId || "").trim();
  if (t) {
    const scoped = utils_getProp_(k + "__" + t);
    if (scoped) return scoped;
  }
  return utils_getProp_(k);
}
