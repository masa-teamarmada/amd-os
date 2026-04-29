/**
 * 097_BillingBudget_Repo.gs
 * 請求額申告・承認フローのDB読み書き（Repoレイヤー）。
 * DB_BillingCycleへのbudgetReported系カラム操作を担う。
 */

/** JST現在時刻を「yyyy年m月d日 HH:MM」で返す */
function billing_budget_jstNow_() {
  var d = new Date();
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000);
  return d.getUTCFullYear() + "年"
    + (d.getUTCMonth() + 1) + "月"
    + d.getUTCDate() + "日 "
    + String(d.getUTCHours()).padStart(2, "0") + ":"
    + String(d.getUTCMinutes()).padStart(2, "0");
}
var BILLING_BUDGET_REPORTED_COLS_ = [
  "budgetReportedAmount",
  "budgetReportedAt",
  "budgetReportedBy"
];

/** DB_BillingCycleに新規カラムを追加 */
function billing_budget_ensureHeaders_() {
  b_ensureBillingCycleHeader_();
  b_ensureHeader_("DB_BillingCycle", BILLING_BUDGET_REPORTED_COLS_);
}

/**
 * BillingCycleの1行を取得
 * @returns {Object|null}
 */
function billing_budget_getRow_(projectId, ym) {
  var ymKey = b_normYm_(ym);
  if (!ymKey) return null;
  var rows = b_readTable_("DB_BillingCycle");
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].projectId || "").trim() === projectId &&
        b_normYm_(rows[i].ym) === ymKey) {
      return rows[i];
    }
  }
  return null;
}

/**
 * PM申告：budgetReported系カラムをセット、statusをreportedに更新
 */
function billing_budget_setReported_(projectId, ym, reportedAmount, operatorEmail) {
  var ymKey = b_normYm_(ym);
  if (!ymKey) throw new Error("ym不正: " + ym);

  var now = billing_budget_jstNow_();
  b_upsertRow_("DB_BillingCycle", ["projectId", "ym"], {
    projectId:            projectId,
    ym:                   ymKey,
    budgetReportedAmount: reportedAmount,
    budgetReportedAt:     now,
    budgetReportedBy:     operatorEmail,
    status:               "reported",
    updatedAt:            now
  });
}

/**
 * admin承認：budgetTotalをセット、budgetConfirmedAt/Byを記録、statusをbudget_confirmedに更新
 */
function billing_budget_setConfirmed_(projectId, ym, operatorEmail) {
  var ymKey = b_normYm_(ym);
  if (!ymKey) throw new Error("ym不正: " + ym);

  var row = billing_budget_getRow_(projectId, ymKey);
  if (!row) throw new Error("BillingCycleレコードが見つからない: " + projectId + " / " + ymKey);

  var reported = Number(row.budgetReportedAmount || 0);
  if (reported <= 0) throw new Error("申告額が0。再申告を依頼してください");

  var budget65 = Math.round(reported * 0.65);
  var now = billing_budget_jstNow_();

  b_upsertRow_("DB_BillingCycle", ["projectId", "ym"], {
    projectId:         projectId,
    ym:                ymKey,
    budgetTotal:       budget65,
    budgetConfirmedAt: now,
    budgetConfirmedBy: operatorEmail,
    status:            "budget_confirmed",
    updatedAt:         now
  });
}

/**
 * 承認待ちリスト取得（status = "reported"）
 * @returns {Array<Object>}
 */
function billing_budget_getPendingList_() {
  var rows = b_readTable_("DB_BillingCycle");
  return rows.filter(function(r) {
    return String(r.status || "").trim() === "reported";
  }).map(function(r) {
    return {
      projectId:            String(r.projectId || "").trim(),
      projectName:          String(r.projectName || "").trim(),
      ym:                   b_normYm_(r.ym),
      budgetReportedAmount: Number(r.budgetReportedAmount || 0),
      budgetReportedAt:     r.budgetReportedAt || "",
      budgetReportedBy:     String(r.budgetReportedBy || "").trim()
    };
  }).filter(function(r) { return !!r.ym; });
}