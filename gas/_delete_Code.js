/**
 * AMD OS (Home + Charter + Router for agree)
 *
 * - HomePage.html が呼ぶ関数：
 *   listProjects()
 *   createProject(payload)
 *   buildWebAppUrl(page, params)
 *
 * - CharterPage.html が呼ぶ関数：
 *   getCharterData(payload)
 *   saveCharter(charter)
 *
 * - Billing 合意リンク（mode=agree）：
 *   doGet が handleAgreement_ を呼ぶ（billing.gs に定義されてる前提）
 *
 * 前提シート:
 *   DB_Projects: projectId, projectName, clientName, status, notes, createdAt, updatedAt
 *   DB_Members: memberId, codeName, email（＋任意で memberName 列があればそれも読む）
 *   DB_ProjectCharter: projectId, projectName, memo, updatedAt
 *   DB_ProjectMembers: projectId projectName memberId memberName codeName isActive joinYm leaveYm payoutEligible defaultPayoutYen displayOrder roleLabel notes createdAt updatedAt isCloser isPM
 *   DB_CharterSaveLog: projectId projectName savedAt membersCount closerMemberId pmMemberId notes
 */

// ====== entry ======
/*
function getSessionUser() {
  const email = (Session.getActiveUser && Session.getActiveUser().getEmail)
    ? String(Session.getActiveUser().getEmail() || "")
    : "";

  return {
    ok: !!email,
    email: email,
    message: email ? "" : "ユーザーEmailが取得できない（デプロイ設定/権限/ドメインを確認）"
  };
}

function debugWhoAmI() {
  return {
    active: Session.getActiveUser().getEmail(),
    effective: Session.getEffectiveUser().getEmail(),
    now: new Date().toISOString()
  };
}

*/

