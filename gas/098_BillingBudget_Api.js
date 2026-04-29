/**
 * 098_BillingBudget_Api.gs
 * 請求額申告・承認フローのAPIレイヤー。
 * 097_BillingBudget_Repo.gs を呼び出す。
 */

/**
 * モーダル初期表示用データ取得
 * payload: { projectId, ym }
 */
function billing_budget_api_getForModal(payload) {
  var projectId = String(payload.projectId || "").trim();
  var ym        = b_normYm_(payload.ym);
  if (!projectId || !ym) return { ok: false, message: "projectId / ym が不正" };

  billing_budget_ensureHeaders_();

  var row = billing_budget_getRow_(projectId, ym) || {};

  // DB_ProjectsからfeeType・feeAmountを取得
  var feeType   = "";
  var feeAmount = 0;
  try {
    var pjRows = b_readTable_("DB_Projects");
    for (var i = 0; i < pjRows.length; i++) {
      if (String(pjRows[i].projectId || "").trim() === projectId) {
        var rawFeeType = String(pjRows[i].feeType || "").trim().toLowerCase();
        feeType = (rawFeeType === "fixed" || rawFeeType === "monthly_fixed") ? "fixed" : rawFeeType;
        feeAmount = Number(pjRows[i].feeAmount  || 0);
        break;
      }
    }
  } catch(e) {}

  return {
    ok:                   true,
    projectId:            projectId,
    ym:                   ym,
    projectName:          String(row.projectName || "").trim(),
    feeType:              feeType,
    feeAmount:            feeAmount,
    status:               String(row.status || "draft").trim(),
    budgetReportedAmount: Number(row.budgetReportedAmount || 0),
    budgetReportedAt:     row.budgetReportedAt  || "",
    budgetReportedBy:     String(row.budgetReportedBy || "").trim(),
    budgetConfirmedAt:    row.budgetConfirmedAt || "",
    budgetTotal:          Number(row.budgetTotal || row.budgetYen || 0)
  };
}

/**
 * PM申告API
 * payload: { projectId, ym, reportedAmount }
 */
function billing_budget_api_report(payload) {
  var projectId      = String(payload.projectId || "").trim();
  var ym             = b_normYm_(payload.ym);
  var reportedAmount = Number(payload.reportedAmount || 0);

  if (!projectId || !ym)   return { ok: false, message: "projectId / ym が不正" };
  if (reportedAmount <= 0) return { ok: false, message: "申告額は1以上を入力してください" };

  billing_budget_ensureHeaders_();

  // 承認済みは上書き不可
  var row = billing_budget_getRow_(projectId, ym);
  if (row && String(row.status || "").trim() === "budget_confirmed") {
    return { ok: false, message: "すでに承認済みです。変更はadminに依頼してください" };
  }

  var operator = Session.getActiveUser().getEmail();
  try {
    billing_budget_setReported_(projectId, ym, reportedAmount, operator);
    return { ok: true, message: "申告しました。adminの承認をお待ちください" };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

/**
 * admin承認API
 * payload: { projectId, ym }
 */
function billing_budget_api_approve(payload) {
  if (!isAdmin_()) return { ok: false, message: "admin only" };

  var projectId = String(payload.projectId || "").trim();
  var ym        = b_normYm_(payload.ym);
  if (!projectId || !ym) return { ok: false, message: "projectId / ym が不正" };

  billing_budget_ensureHeaders_();

  var operator = Session.getActiveUser().getEmail();
  try {
    billing_budget_setConfirmed_(projectId, ym, operator);
    return { ok: true, message: "承認しました。budgetTotalを更新しました" };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

/**
 * 承認待ちリスト取得API（admin用）
 */
function billing_budget_api_getPendingList() {
  if (!isAdmin_()) return { ok: false, message: "admin only" };
  billing_budget_ensureHeaders_();
  try {
    var list = billing_budget_getPendingList_();
    return JSON.parse(JSON.stringify({ ok: true, list: list }));
  } catch(e) { return { ok: false, message: e.message }; }
}