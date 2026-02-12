/** 053_RewardScoring_Repo.gs
 * 報酬スコアリングのデータアクセス層（Repo）
 * DB_ProgressEvents / DB_EventResponsibility / DB_MonthlyRewardPayout のCRUD
 */

// ===== DB_ProgressEvents =====

function reward_repo_appendEvents_(events) {
  if (!Array.isArray(events) || !events.length) return [];
  const sh = reward_repo_getSheet_("DB_ProgressEvents");
  const header = reward_repo_headerMap_(sh);
  const now = reward_repo_jstNow_();
  const ids = [];

  events.forEach(function(e) {
    var id = e.eventId || Utilities.getUuid();
    var row = [];
    row[header.eventId - 1] = id;
    row[header.projectId - 1] = String(e.projectId || "");
    row[header.ym - 1] = String(e.ym || "");
    row[header.eventTitle - 1] = String(e.eventTitle || "");
    row[header.eventDescription - 1] = String(e.eventDescription || "");
    row[header.impact - 1] = Number(e.impact || 0);
    row[header.depth - 1] = Number(e.depth || 0);
    row[header.status - 1] = String(e.status || "draft");
    row[header.sourceType - 1] = String(e.sourceType || "monthlyReport");
    row[header.createdAtJst - 1] = now;
    row[header.confirmedByMemberId - 1] = "";
    row[header.confirmedAtJst - 1] = "";
    // 空セル埋め
    for (var c = 0; c < sh.getLastColumn(); c++) {
      if (row[c] === undefined) row[c] = "";
    }
    sh.appendRow(row);
    ids.push(id);
  });

  // ym列をテキスト形式に固定
  if (header.ym) {
    var lastRow = sh.getLastRow();
    var startRow = lastRow - events.length + 1;
    sh.getRange(startRow, header.ym, events.length, 1).setNumberFormat("@");
  }

  return ids;
}

function reward_repo_listEvents_(projectId, ym) {
  var sh = reward_repo_getSheet_("DB_ProgressEvents");
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var results = [];
  var pid = String(projectId || "").trim();
  var ymStr = String(ym || "").trim();

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (pid && String(r[header.projectId - 1] || "").trim() !== pid) continue;
    if (ymStr && String(r[header.ym - 1] || "").trim() !== ymStr) continue;
    results.push(reward_repo_rowToObj_(r, header));
  }
  return results;
}

function reward_repo_updateEventStatus_(eventId, status, memberId) {
  var sh = reward_repo_getSheet_("DB_ProgressEvents");
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return false;

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][header.eventId - 1] || "").trim() === String(eventId).trim()) {
      var rowIdx = i + 2;
      sh.getRange(rowIdx, header.status).setValue(status);
      if (status === "confirmed" && header.confirmedByMemberId) {
        sh.getRange(rowIdx, header.confirmedByMemberId).setValue(String(memberId || ""));
        sh.getRange(rowIdx, header.confirmedAtJst).setValue(reward_repo_jstNow_());
      }
      return true;
    }
  }
  return false;
}

// ===== DB_EventResponsibility =====

function reward_repo_appendResponsibilities_(items) {
  if (!Array.isArray(items) || !items.length) return;
  var sh = reward_repo_getSheet_("DB_EventResponsibility");
  var header = reward_repo_headerMap_(sh);

  items.forEach(function(item) {
    var row = [];
    row[header.id - 1] = Utilities.getUuid();
    row[header.eventId - 1] = String(item.eventId || "");
    row[header.memberId - 1] = String(item.memberId || "");
    row[header.responsibility - 1] = Number(item.responsibility || 1.0);
    row[header.reason - 1] = String(item.reason || "");
    row[header.status - 1] = "draft";
    row[header.confirmedByMemberId - 1] = "";
    row[header.confirmedAtJst - 1] = "";
    for (var c = 0; c < sh.getLastColumn(); c++) {
      if (row[c] === undefined) row[c] = "";
    }
    sh.appendRow(row);
  });
}

function reward_repo_listResponsibilities_(eventIds) {
  if (!Array.isArray(eventIds) || !eventIds.length) return [];
  var sh = reward_repo_getSheet_("DB_EventResponsibility");
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var idSet = {};
  eventIds.forEach(function(id) { idSet[String(id).trim()] = true; });

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var results = [];
  for (var i = 0; i < values.length; i++) {
    var eid = String(values[i][header.eventId - 1] || "").trim();
    if (idSet[eid]) results.push(reward_repo_rowToObj_(values[i], header));
  }
  return results;
}

// ===== DB_MonthlyRewardPayout =====

/** 手動実行用ラッパー */
function reward_repo_ensurePayoutHeader() {
  return reward_repo_ensurePayoutHeader_();
}

function reward_repo_ensurePayoutHeader_() {
  var sh = reward_repo_getSheet_("DB_MonthlyRewardPayout");
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var existing = {};
  head.forEach(function(h) { if (h) existing[String(h).trim()] = true; });

  var required = [
    "id", "projectId", "ym", "memberId",
    "earnedPoints", "ptUnit", "basePay",
    "appreciationRaw", "appreciationBonus",
    "totalPayout", "status",
    "confirmedByMemberId", "confirmedAtJst"
  ];

  var toAdd = [];
  required.forEach(function(col) {
    if (!existing[col]) toAdd.push(col);
  });

  if (toAdd.length) {
    var lastCol = sh.getLastColumn();
    for (var i = 0; i < toAdd.length; i++) {
      sh.getRange(1, lastCol + 1 + i).setValue(toAdd[i]);
    }
  }
  return sh;
}

function reward_repo_upsertPayout_(item) {
  var sh = reward_repo_ensurePayoutHeader_();
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var pid = String(item.projectId || "").trim();
  var ymStr = String(item.ym || "").trim();
  var mid = String(item.memberId || "").trim();

  // 既存行を探す（projectId + ym + memberId で一意）
  var targetRow = -1;
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.projectId - 1] || "").trim() === pid &&
          String(values[i][header.ym - 1] || "").trim() === ymStr &&
          String(values[i][header.memberId - 1] || "").trim() === mid) {
        targetRow = i + 2;
        break;
      }
    }
  }

  // 書き込み用配列
  var rowData = new Array(lastCol);
  for (var c = 0; c < lastCol; c++) rowData[c] = "";

  // 既存行があればベースにする
  if (targetRow > 0) {
    var existing = sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < lastCol; c++) rowData[c] = existing[c];
  } else {
    // 新規はid採番
    if (header.id) rowData[header.id - 1] = Utilities.getUuid();
  }

  // itemの全キーをheaderに合致する列に書き込み
  var keys = Object.keys(item);
  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    if (key === "id" && targetRow > 0) continue; // 既存idは維持
    if (header[key]) {
      rowData[header[key] - 1] = item[key];
    }
  }

  if (targetRow > 0) {
    sh.getRange(targetRow, 1, 1, lastCol).setValues([rowData]);
  } else {
    sh.appendRow(rowData);
  }

  // ym列テキスト形式
  if (header.ym) {
    var r = targetRow > 0 ? targetRow : sh.getLastRow();
    sh.getRange(r, header.ym, 1, 1).setNumberFormat("@");
  }
}

function reward_repo_listPayouts_(projectId, ym) {
  var sh = reward_repo_getSheet_("DB_MonthlyRewardPayout");
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var results = [];
  var pid = String(projectId || "").trim();
  var ymStr = String(ym || "").trim();

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (pid && String(r[header.projectId - 1] || "").trim() !== pid) continue;
    if (ymStr && String(r[header.ym - 1] || "").trim() !== ymStr) continue;
    results.push(reward_repo_rowToObj_(r, header));
  }
  return results;
}

// ===== 共通ヘルパー =====

function reward_repo_getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error("sheet not found: " + name);
  return sh;
}

function reward_repo_headerMap_(sh) {
  var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var c = 0; c < row1.length; c++) {
    var key = String(row1[c] || "").trim();
    if (key) map[key] = c + 1;
  }
  return map;
}

function reward_repo_rowToObj_(rowValues, headerMap) {
  var obj = {};
  Object.keys(headerMap).forEach(function(key) {
    obj[key] = String(rowValues[headerMap[key] - 1] || "");
  });
  return obj;
}

function reward_repo_jstNow_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
}

/** テスト用：指定PJ×ymの全draftイベントをconfirmする */
function TEST_confirmAllDraftEvents() {
  var projectId = "p21";
  var ym = "202601";
  var events = reward_repo_listEvents_(projectId, ym);
  var count = 0;
  events.forEach(function(e) {
    if (String(e.status || "").trim() === "draft") {
      reward_repo_updateEventStatus_(e.eventId, "confirmed", "test");
      count++;
    }
  });
  Logger.log("confirmed: " + count + " events");
}