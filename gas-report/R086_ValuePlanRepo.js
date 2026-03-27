/**
 * R086_ValuePlanRepo.gs
 * ValuePlanデータアクセス層（Repo）のreport GAS並列定義。
 * R060_RewardV2_Estimator.gsから呼ばれる最小限の関数のみ定義。
 */

function valuePlan_getDbSpreadsheet() {
  var ssId = String(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!ssId) throw new Error('NAVIGATOR_SPREADSHEET_ID 未設定');
  return SpreadsheetApp.openById(ssId);
}

function valuePlan_getSheetByName(name) {
  var ss = valuePlan_getDbSpreadsheet();
  var sh = ss.getSheetByName(String(name || "").trim());
  if (!sh) throw new Error("Sheet not found: " + name);
  return sh;
}

function valuePlan_repo_getCycleSheet() {
  var sh = valuePlan_getSheetByName("DB_ValuePlanCycles");
  ensureHeader_(sh, [
    "planCycleId", "projectId", "periodStartYm", "periodEndYm",
    "budgetYen", "totalPoints",
    "status", "fixedVersion", "fixedAt", "fixedBy",
    "updatedAt"
  ]);
  return sh;
}

function valuePlan_repo_getMilestoneSheet() {
  var sh = valuePlan_getSheetByName("DB_ValueMilestones");
  ensureHeader_(sh, [
    "planCycleId", "version", "milestoneId",
    "orderNo", "title", "points", "tag",
    "successCriteria", "rationale",
    "isActive", "updatedAt",
    "goalLevel", "targetYm",
    "originMsId"
  ]);
  return sh;
}