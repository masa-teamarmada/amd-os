/** 002_AccessControl.gs
 * 権限管理と直URL叩き防御の担当。
 * admin判定、PJアクセス判定、メンバー紐付け、deny画面生成など「アクセス制御」だけを扱う。
 */
function isAdmin_(){
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  return email === "masa@team-armada.jp" || email === "kyoko@team-armada.jp";
}

// ★adminページに入れる人（まさ & きよ）
function canAccessAdminPage_(){
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  return email === "masa@team-armada.jp" || email === "kyoko@team-armada.jp";
}
// ★全社PJを見ていい人（ダッシュボードの一覧・AdminのPJ候補などで使用）
function canSeeAllProjects_(){
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  return email === "masa@team-armada.jp" || email === "kyoko@team-armada.jp";
}

function getCurrentMemberId_(){
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  if (!email) return "";

  try {
    const sh = getSheet_("DB_Members");
    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return "";

    const h = vals[0].map(x => String(x||"").trim());
    const iEmail = h.indexOf("email");
    const iMid = h.indexOf("memberId");
    if (iEmail < 0 || iMid < 0) return "";

    for (let r=1; r<vals.length; r++){
      const em = String(vals[r][iEmail]||"").toLowerCase().trim();
      if (em === email) return String(vals[r][iMid]||"").trim();
    }
    return "";
  } catch(e){
    return "";
  }
}
function isActiveProjectMember_(projectId, memberId){
  projectId = String(projectId||"").trim();
  memberId = String(memberId||"").trim();
  if (!projectId || !memberId) return false;

  try {
    const sh = getSheet_("DB_ProjectMembers");
    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return false;

    const h = vals[0].map(x => String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iMid = h.indexOf("memberId");
    const iActive = h.indexOf("isActive");

    if (iPid < 0 || iMid < 0) return false;

    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid !== projectId) continue;

      const mid = String(vals[r][iMid]||"").trim();
      if (mid !== memberId) continue;

      const active = (iActive >= 0) ? toBool_(vals[r][iActive]) : true;
      if (active) return true;
    }
    return false;
  } catch(e){
    return false;
  }
}
//URL直叩き禁止
function canAccessProject_(projectId){
  // ★管理者（adminページ閲覧可）は全PJアクセスOK
  // - まさ: isAdmin_() = true
  // - きよ: canAccessAdminPage_() = true
  if (isAdmin_() || canAccessAdminPage_()) return true;

  projectId = String(projectId||"").trim();
  if (!projectId) return false; // projectId無しのcharter/billingは非admin拒否

  const myMemberId = getCurrentMemberId_();
  if (!myMemberId) return false;

  return isActiveProjectMember_(projectId, myMemberId);
}
function denyHtml_(title, msg){
  const safeTitle = escapeHtml_(title || "Access denied");
  const safeMsg = escapeHtml_(msg || "権限がないよ");
  return HtmlService.createHtmlOutput(
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
      <div style="font-size:18px;font-weight:900;">${safeTitle}</div>
      <div style="margin-top:10px;color:#444;font-size:13px;line-height:1.6;">${safeMsg}</div>
      <div style="margin-top:14px;color:#666;font-size:12px;">user=${escapeHtml_(Session.getActiveUser().getEmail()||"")}</div>
    </div>`
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}