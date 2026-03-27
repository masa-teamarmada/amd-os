/**
 * 058_RewardV2_Repo.gs
 * 報酬v2のデータアクセス層（Repo）
 *
 * 対象シート（Navigatorスプシ）:
 *  - DB_MilestoneMonthlyProgress  … MSごとの月次進捗率
 *  - DB_MilestoneResponsibility   … MSごとの月次背負い度
 */

// ===== スプシアクセス =====

function rv2_getNavSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var ssId = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!ssId) return SpreadsheetApp.getActiveSpreadsheet();
  return SpreadsheetApp.openById(ssId);
}

function rv2_getSheet_(name) {
  var ss = rv2_getNavSpreadsheet_();
  var sh = ss.getSheetByName(String(name || "").trim());
  if (!sh) {
    sh = ss.insertSheet(String(name).trim());
  }
  return sh;
}

// ===== ヘッダ定義 =====

var RV2_PROGRESS_HEADERS = [
  "projectId", "planCycleId", "milestoneKey", "ym",
  "progressPct", "consumedPt",
  "source", "confirmedBy", "confirmedAtJst", "note"
];

var RV2_RESPONSIBILITY_HEADERS = [
  "projectId", "planCycleId", "milestoneKey", "ym",
  "memberId", "share",
  "source", "updatedAtJst"
];

// ===== ヘッダ保証 =====

function rv2_ensureProgressHeader() {
  var sh = rv2_getSheet_("DB_MilestoneMonthlyProgress");
  ensureHeader_(sh, RV2_PROGRESS_HEADERS);
  return sh;
}

function rv2_ensureResponsibilityHeader() {
  var sh = rv2_getSheet_("DB_MilestoneResponsibility");
  ensureHeader_(sh, RV2_RESPONSIBILITY_HEADERS);
  return sh;
}

/** admin用：両テーブルのヘッダ一括保証 */
function admin_ensureRewardV2Schema() {
  rv2_ensureProgressHeader();
  rv2_ensureResponsibilityHeader();
  Logger.log("RewardV2 schema ensured.");
}

// ===== Progress 読み書き =====

/**
 * 指定PJ×ymの全MS進捗率を返す
 * @return {Array<Object>} [{milestoneKey, progressPct, consumedPt, source, ...}]
 */
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
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = all[r][c];
    }
    results.push(obj);
  }
  return results;
}

/**
 * 指定planCycleIdの全MS進捗率を返す（全ym横断）
 */
function rv2_readProgressForPlanCycle(planCycleId) {
  var sh = rv2_ensureProgressHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iCycle = header.indexOf("planCycleId");
  var results = [];
  var cid = String(planCycleId || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iCycle] || "").trim() !== cid) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = all[r][c];
    }
    results.push(obj);
  }
  return results;
}

/**
 * 進捗率をupsert（milestoneKey + ym で一意）
 */
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

// ===== Responsibility 読み書き =====
/**
 * 指定PJの全MSコミットスコアを返す（ym次元なし、互換性のためym引数は受けるが無視）
 * @return {Array<Object>} [{milestoneKey, memberId, share, source, ...}]
 */
function rv2_readResponsibilityForProjectYm(projectId, ym) {
  // ym次元なし：互換性のためym引数は受けるが無視する
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var sh = ss.getSheetByName("DB_MilestoneResponsibility");
  if (!sh) return [];

  var all = sh.getDataRange().getValues();
  if (all.length < 2) return [];
  var hdr = all[0];
  var iPid = hdr.indexOf("projectId");
  var spid = String(projectId || "").trim();
  if (!spid) return [];

  var result = [];
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPid] || "").trim() !== spid) continue;
    var obj = {};
    for (var c = 0; c < hdr.length; c++) obj[hdr[c]] = all[r][c];
    result.push(obj);
  }
  return result;
}

/**
 * コミットスコアをupsert（milestoneKey + memberId で一意、ym次元なし）
 */
function rv2_upsertResponsibility(rec) {
  rec = rec || {};
  var projectId = String(rec.projectId || "").trim();
  var msKey     = String(rec.milestoneKey || "").trim();
  var mid       = String(rec.memberId || "").trim();
  if (!projectId || !msKey || !mid) return;

  var ss  = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var sh  = ss.getSheetByName("DB_MilestoneResponsibility");
  if (!sh) return;

  var all = sh.getDataRange().getValues();
  var hdr = all[0];
  var iPid   = hdr.indexOf("projectId");
  var iMsKey = hdr.indexOf("milestoneKey");
  var iMember = hdr.indexOf("memberId");
  var iYm    = hdr.indexOf("ym");

  // === ym次元なし：複合キー = projectId + milestoneKey + memberId ===
  var found = -1;
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPid] || "").trim() !== projectId) continue;
    if (String(all[r][iMsKey] || "").trim() !== msKey) continue;
    if (String(all[r][iMember] || "").trim() !== mid) continue;
    found = r;
    break;
  }

  // ym列は常に空にする（マスタデータ扱い）
  var row = [];
  for (var c = 0; c < hdr.length; c++) {
    var col = hdr[c];
    if (col === "ym") { row.push(""); continue; }   // 強制空
    row.push(rec[col] !== undefined ? rec[col] : (found > 0 ? all[found][c] : ""));
  }

  if (found > 0) {
    sh.getRange(found + 1, 1, 1, hdr.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
}

/**
 * 指定planCycleIdの全背負い度を返す（全ym横断）
 */
function rv2_readResponsibilityForPlanCycle(planCycleId) {
  var sh = rv2_ensureResponsibilityHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iCycle = header.indexOf("planCycleId");
  var results = [];
  var cid = String(planCycleId || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iCycle] || "").trim() !== cid) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = all[r][c];
    }
    results.push(obj);
  }
  return results;
}

// ===== ProgressPending 読み書き =====

var RV2_PENDING_HEADERS = [
  "projectId", "planCycleId", "milestoneKey", "ym",
  "suggestedPct", "currentPct", "reason", "sources",
  "createdAtJst", "status"
];

function rv2_ensurePendingHeader() {
  var sh = rv2_getSheet_("DB_MilestoneProgressPending");
  ensureHeader_(sh, RV2_PENDING_HEADERS);
  return sh;
}

/** 指定PJ×ymのpending行を全取得 */
function rv2_readPendingForProjectYm(projectId, ym) {
  var sh = rv2_ensurePendingHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iPj = header.indexOf("projectId");
  var iYm = header.indexOf("ym");
  var iStatus = header.indexOf("status");
  var results = [];
  var pid = String(projectId || "").trim();
  var sym = String(ym || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPj] || "").trim() !== pid) continue;
    if (String(all[r][iYm] || "").trim() !== sym) continue;
    if (String(all[r][iStatus] || "").trim() !== "pending") continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      obj[header[c]] = all[r][c];
    }
    obj._rowNum = r + 1;
    results.push(obj);
  }
  return results;
}

/** pending upsert（milestoneKey+ymで一意、既存pendingは上書き） */
function rv2_upsertPending(data) {
  var sh = rv2_ensurePendingHeader();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var iMsKey = header.indexOf("milestoneKey");
  var iYm = header.indexOf("ym");
  var iPj = header.indexOf("projectId");
  var iStatus = header.indexOf("status");

  var msKey = String(data.milestoneKey || "").trim();
  var sym = String(data.ym || "").trim();
  var pid = String(data.projectId || "").trim();

  var rec = [];
  for (var c = 0; c < header.length; c++) {
    rec.push(data[header[c]] !== undefined ? data[header[c]] : "");
  }

  var row = -1;
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][iPj] || "").trim() === pid &&
        String(all[r][iMsKey] || "").trim() === msKey &&
        String(all[r][iYm] || "").trim() === sym &&
        String(all[r][iStatus] || "").trim() === "pending") {
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

/** pending行のstatusを更新 */
function rv2_updatePendingStatus(rowNum, newStatus) {
  var sh = rv2_ensurePendingHeader();
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iStatus = header.indexOf("status");
  if (iStatus >= 0) {
    sh.getRange(rowNum, iStatus + 1).setValue(newStatus);
  }
}

/**
 * サブMS担当配分からMS単位のshareを集計して返す
 * DB_MilestoneResponsibility互換形式で返すので、059側の置き換えが最小になる
 * @return {Array<Object>} [{projectId, milestoneKey, memberId, share}]
 */
function rv2_readResponsibilityFromSubItems_(projectId) {
  var ss = rv2_getNavSpreadsheet_();
  var pid = String(projectId || "").trim();
  if (!pid) return [];

  // DB_MilestoneSubItems: subItemId → milestoneId のマッピング
  var subItemSheet = ss.getSheetByName("DB_MilestoneSubItems");
  if (!subItemSheet) return [];
  var subAll = subItemSheet.getDataRange().getValues();
  if (subAll.length < 2) return [];
  var subHdr = subAll[0];
  var iSubId   = subHdr.indexOf("subItemId");
  var iMsId    = subHdr.indexOf("milestoneId");
  var iPjSub   = subHdr.indexOf("projectId");
  if (iSubId < 0 || iMsId < 0) return [];

  var subItemToMs = {}; // subItemId → milestoneId
  for (var r = 1; r < subAll.length; r++) {
    if (iPjSub >= 0 && String(subAll[r][iPjSub] || "").trim() !== pid) continue;
    var sid = String(subAll[r][iSubId] || "").trim();
    var mid = String(subAll[r][iMsId]  || "").trim();
    if (sid && mid) subItemToMs[sid] = mid;
  }
  if (Object.keys(subItemToMs).length === 0) return [];

  // DB_SubItemResponsibility: subItemId + memberId → share
  var respSheet = ss.getSheetByName("DB_SubItemResponsibility");
  if (!respSheet) return [];
  var respAll = respSheet.getDataRange().getValues();
  if (respAll.length < 2) return [];
  var respHdr  = respAll[0];
  var iRSubId  = respHdr.indexOf("subItemId");
  var iMember  = respHdr.indexOf("memberId");
  var iShare   = respHdr.indexOf("share");
  if (iRSubId < 0 || iMember < 0 || iShare < 0) return [];

  // MS別・メンバー別に合計share、サブ項目数を集計
  var msResp     = {}; // msId → { memberId: { total, count } }
  var msSubCounts = {}; // msId → ユニークsubItem数

  for (var r = 1; r < respAll.length; r++) {
    var sid    = String(respAll[r][iRSubId] || "").trim();
    var msId   = subItemToMs[sid];
    if (!msId) continue;
    var member = String(respAll[r][iMember] || "").trim();
    var share  = Number(respAll[r][iShare]  || 0);
    if (!member) continue;

    if (!msResp[msId]) msResp[msId] = {};
    if (!msResp[msId][member]) msResp[msId][member] = { total: 0, count: 0 };
    msResp[msId][member].total += share;
    msResp[msId][member].count += 1;
  }

  // サブ項目数カウント（平均算出の分母）
  for (var sid in subItemToMs) {
    var msId = subItemToMs[sid];
    msSubCounts[msId] = (msSubCounts[msId] || 0) + 1;
  }

  // share = Σsub_share / sub項目数
  var results = [];
  for (var msId in msResp) {
    var subCount = msSubCounts[msId] || 1;
    for (var member in msResp[msId]) {
      results.push({
        projectId:    pid,
        milestoneKey: msId,
        memberId:     member,
        share: Math.round(msResp[msId][member].total / subCount * 1000) / 1000
      });
    }
  }
  return results;
}