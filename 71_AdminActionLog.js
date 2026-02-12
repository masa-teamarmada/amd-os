/** 71_AdminActionLog.gs
 * Admin操作ログの担当。
 * DB_AdminActionLogへの追記を提供し、管理操作の監査ログを一箇所に集約する。
 */
// ======================================================================
// Admin: Action Log
// ======================================================================

function _getAdminActionLogSheet_(){
  const sh = getSheetOrCreate_("DB_AdminActionLog");
  ensureHeader_(sh, ["at","actorEmail","action","targetEmail","detailJson"]);
  return sh;
}

function logAdminAction_(action, targetEmail, detailObj){
  try{
    const sh = _getAdminActionLogSheet_();
    const actorEmail = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
    const at = new Date();
    const detailJson = (detailObj === undefined) ? "" : JSON.stringify(detailObj);
    sh.appendRow([at, actorEmail, String(action||""), String(targetEmail||""), detailJson]);
  } catch(e){
    // ログで落として本体処理が止まるのが一番だるいので握りつぶす
  }
}