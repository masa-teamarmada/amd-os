/** 096_MemberStatus_Repo.gs
 * メンバーステータスのデータアクセス層
 * DB_MemberStatus のCRUD + DB_Members読取 + DB_MemberKnowledge読取
 */

// ===== DB_MemberStatus =====

var MEMBER_STATUS_HEADERS_ = [
  "statusId", "memberId", "codeName", "ym",
  "scoreInitiative", "scoreExecution", "scoreCommunication",
  "scoreCollaboration", "scoreGrowth",
  "scoreVersion", "computedAtJst", "computedBy",
  "knowledgeJson", "titlesJson", "completionPct", "nextFillableItems"
];

function memberStatus_ensureSchema_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_MemberStatus");
  if (!sh) {
    sh = ss.insertSheet("DB_MemberStatus");
    sh.getRange(1, 1, 1, MEMBER_STATUS_HEADERS_.length)
      .setValues([MEMBER_STATUS_HEADERS_]);
    return sh;
  }
  // 既存ヘッダー確認 → 不足列を追加
  var existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var existingSet = {};
  existing.forEach(function(h) { if (h) existingSet[String(h).trim()] = true; });
  var lastCol = sh.getLastColumn();
  MEMBER_STATUS_HEADERS_.forEach(function(col) {
    if (!existingSet[col]) {
      lastCol++;
      sh.getRange(1, lastCol).setValue(col);
    }
  });
  return sh;
}

function memberStatus_upsertScores_(memberId, codeName, ym, scores, titles, knowledge, completionPct, nextFillable) {
  var sh = memberStatus_ensureSchema_();
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var mid = String(memberId).trim();
  var ymStr = String(ym).trim();

  // 既存行を探す（memberId + ym で一意）
  var targetRow = -1;
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.memberId - 1] || "").trim() === mid &&
          String(values[i][header.ym - 1] || "").trim() === ymStr) {
        targetRow = i + 2;
        break;
      }
    }
  }

  var rowData = new Array(lastCol);
  for (var c = 0; c < lastCol; c++) rowData[c] = "";

  if (targetRow > 0) {
    var existing = sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < lastCol; c++) rowData[c] = existing[c];
  } else {
    rowData[header.statusId - 1] = Utilities.getUuid();
  }

  rowData[header.memberId - 1] = mid;
  rowData[header.codeName - 1] = String(codeName || "");
  rowData[header.ym - 1] = ymStr;
  rowData[header.scoreInitiative - 1] = Number(scores.initiative || 0);
  rowData[header.scoreExecution - 1] = Number(scores.execution || 0);
  rowData[header.scoreCommunication - 1] = Number(scores.communication || 0);
  rowData[header.scoreCollaboration - 1] = Number(scores.collaboration || 0);
  rowData[header.scoreGrowth - 1] = Number(scores.growth || 0);
  rowData[header.scoreVersion - 1] = 1;
  rowData[header.computedAtJst - 1] = reward_repo_jstNow_();
  rowData[header.computedBy - 1] = "auto";
  rowData[header.knowledgeJson - 1] = JSON.stringify(knowledge || []);
  rowData[header.titlesJson - 1] = JSON.stringify(titles || []);
  rowData[header.completionPct - 1] = Number(completionPct || 0);
  rowData[header.nextFillableItems - 1] = JSON.stringify(nextFillable || []);

  if (targetRow > 0) {
    sh.getRange(targetRow, 1, 1, lastCol).setValues([rowData]);
  } else {
    sh.appendRow(rowData);
  }

  // ym列をテキスト形式に固定
  if (header.ym) {
    var r = targetRow > 0 ? targetRow : sh.getLastRow();
    sh.getRange(r, header.ym, 1, 1).setNumberFormat("@");
  }
}

function memberStatus_listLatest_() {
  var sh;
  try { sh = memberStatus_ensureSchema_(); } catch(e) { return []; }
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  // memberId → 最新ymのレコードを保持
  var latest = {};
  for (var i = 0; i < values.length; i++) {
    var obj = reward_repo_rowToObj_(values[i], header);
    var mid = obj.memberId;
    if (!latest[mid] || String(obj.ym) > String(latest[mid].ym)) {
      latest[mid] = obj;
    }
  }
  var result = [];
  Object.keys(latest).forEach(function(k) { result.push(latest[k]); });
  return result;
}

function memberStatus_getByMemberId_(memberId) {
  var all = memberStatus_listLatest_();
  var mid = String(memberId).trim();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].memberId).trim() === mid) return all[i];
  }
  return null;
}

// ===== DB_Members 読取 =====

function memberStatus_getActiveMembers_() {
  var rows = b_readTable_("DB_Members");
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var status = String(r.status || "active").toLowerCase().trim();
    if (status === "active") {
      result.push({
        memberId: String(r.memberId || "").trim(),
        codeName: String(r.codeName || "").trim(),
        email: String(r.email || "").trim(),
        joinYm: String(r.joinYm || r.createdAt || "").trim()
      });
    }
  }
  return result;
}

// ===== DB_MemberKnowledge 読取（Navigator SSから） =====

function memberStatus_fetchKnowledge_(codeName) {
  try {
    var props = PropertiesService.getScriptProperties();
    var navId = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
    if (!navId) return [];
    var ss = SpreadsheetApp.openById(navId);
    var sh = ss.getSheetByName("DB_MemberKnowledge");
    if (!sh) return [];
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];

    var header = reward_repo_headerMap_(sh);
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var result = [];
    var cn = String(codeName).trim();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.codeName - 1] || "").trim() === cn) {
        result.push({
          category: String(values[i][header.category - 1] || ""),
          summaryText: String(values[i][header.summaryText - 1] || ""),
          entityCount: Number(values[i][header.entityCount - 1] || 0),
          lastUpdatedAtJst: String(values[i][header.lastUpdatedAtJst - 1] || "")
        });
      }
    }
    return result;
  } catch (e) {
    return [];
  }
}

// ===== DB_ProgressEvents 全件読取（先手力算出用） =====

function memberStatus_listAllEvents_() {
  try {
    var rows = b_readTable_("DB_ProgressEvents");
    return rows;
  } catch(e) { return []; }
}

// ===== DB_EventResponsibility 全件読取 =====

function memberStatus_listAllResponsibilities_() {
  try {
    var sh = reward_repo_getSheet_("DB_EventResponsibility");
    var header = reward_repo_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var result = [];
    for (var i = 0; i < values.length; i++) {
      result.push(reward_repo_rowToObj_(values[i], header));
    }
    return result;
  } catch(e) { return []; }
}
