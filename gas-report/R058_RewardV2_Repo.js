/**
 * R058_RewardV2_Repo.gs
 * 報酬v2データアクセス層（Repo）のreport GAS並列定義。
 * R060_RewardV2_Estimator.gsから呼ばれる最小限の関数のみ定義。
 */

function rv2_getNavSpreadsheet_() {
  var ssId = String(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!ssId) throw new Error('NAVIGATOR_SPREADSHEET_ID 未設定');
  return SpreadsheetApp.openById(ssId);
}

function rv2_getSheet_(name) {
  var ss = rv2_getNavSpreadsheet_();
  var sh = ss.getSheetByName(String(name || "").trim());
  if (!sh) sh = ss.insertSheet(String(name).trim());
  return sh;
}

var RV2_PROGRESS_HEADERS = [
  "projectId", "planCycleId", "milestoneKey", "ym",
  "progressPct", "consumedPt",
  "source", "confirmedBy", "confirmedAtJst", "note"
];

function rv2_ensureProgressHeader() {
  var sh = rv2_getSheet_("DB_MilestoneMonthlyProgress");
  ensureHeader_(sh, RV2_PROGRESS_HEADERS);
  return sh;
}

function rv2_readProgressForProjectYm(projectId, ym) {
  var sh = rv2_ensureProgressHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iPj = header.indexOf("projectId");
  var iYm = header.indexOf("ym");
  var results = [];
  var pid = String(projectId || "").trim();
  var sym = String(ym || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPj] || "").trim() !== pid) continue;
    if (String(all[r][iYm] || "").trim() !== sym) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) obj[header[c]] = all[r][c];
    results.push(obj);
  }
  return results;
}

function rv2_upsertProgress(data) {
  var sh = rv2_ensureProgressHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iMsKey = header.indexOf("milestoneKey");
  var iYm = header.indexOf("ym");
  var iPj = header.indexOf("projectId");

  var msKey = String(data.milestoneKey || "").trim();
  var sym = String(data.ym || "").trim();
  var pid = String(data.projectId || "").trim();

  var consumedPt = Number(data.consumedPt || 0);
  if (data.maxPt !== undefined && data.progressPct !== undefined) {
    consumedPt = Number(data.maxPt) * Number(data.progressPct) / 100;
  }

  var rec = [];
  for (var c = 0; c < header.length; c++) {
    var col = header[c];
    if (col === "consumedPt") {
      rec.push(consumedPt);
    } else {
      rec.push(data[col] !== undefined ? data[col] : "");
    }
  }

  var row = -1;
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPj] || "").trim() === pid &&
        String(all[r][iMsKey] || "").trim() === msKey &&
        String(all[r][iYm] || "").trim() === sym) {
      row = r + 1;
      break;
    }
  }

  if (row === -1) {
    sh.appendRow(rec);
  } else {
    sh.getRange(row, 1, 1, rec.length).setValues([rec]);
  }
}