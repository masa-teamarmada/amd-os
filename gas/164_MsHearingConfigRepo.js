/** 164_MsHearingConfigRepo.gs
 * MS設計ヒアリング必須項目の管理。Adminページから追加・削除・並べ替え可能。
 *
 * 公開関数：
 *  - msHearing_listActive()
 *  - msHearing_listAll()
 *  - admin_upsertMsHearingItem(payload)
 *  - admin_toggleMsHearingItem(itemId, isActive)
 *
 * DB: DB_MsHearingConfig（本体スプシ）
 */

var MS_HEARING_HEADERS_ = [
  "itemId", "orderNo", "category", "question", "description",
  "isRequired", "isActive", "updatedAt"
];

/**
 * アクティブなヒアリング項目をorderNo順で返す
 */
function msHearing_listActive() {
  var all = msHearing_listAll_();
  var active = [];
  for (var i = 0; i < all.length; i++) {
    if (all[i].isActive) active.push(all[i]);
  }
  active.sort(function(a, b) { return a.orderNo - b.orderNo; });
  return active;
}

/**
 * 全件返す（Admin用）
 */
function msHearing_listAll() {
  var all = msHearing_listAll_();
  all.sort(function(a, b) { return a.orderNo - b.orderNo; });
  return { ok: true, rows: all };
}

function admin_upsertMsHearingItem(payload) {
  payload = payload || {};
  var itemId = String(payload.itemId || "").trim();
  if (!itemId) itemId = "msh_" + Date.now().toString(36);

  var question = String(payload.question || "").trim();
  if (!question) return { ok: false, message: "question empty" };

  var sh = msHearing_ensureSheet_();
  var header = msHearing_headerMap_(sh);
  var lastRow = sh.getLastRow();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  var obj = {
    itemId: itemId,
    orderNo: String(payload.orderNo || 50),
    category: String(payload.category || "").trim(),
    question: question,
    description: String(payload.description || "").trim(),
    isRequired: String(payload.isRequired !== false ? "TRUE" : "FALSE"),
    isActive: String(payload.isActive !== false ? "TRUE" : "FALSE"),
    updatedAt: now
  };

  var targetRow = 0;
  if (lastRow >= 2) {
    var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][(header.itemId || 1) - 1] || "").trim() === itemId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow >= 2) {
    msHearing_writeRow_(sh, header, targetRow, obj);
    return { ok: true, mode: "update", itemId: itemId };
  }

  var newRow = (lastRow || 1) + 1;
  msHearing_writeRow_(sh, header, newRow, obj);
  return { ok: true, mode: "insert", itemId: itemId };
}

function admin_toggleMsHearingItem(itemId, isActive) {
  var id = String(itemId || "").trim();
  if (!id) return { ok: false, message: "itemId empty" };

  var sh = msHearing_ensureSheet_();
  var header = msHearing_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, message: "no data" };

  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][(header.itemId || 1) - 1] || "").trim() === id) {
      var row = i + 2;
      var col = header.isActive;
      if (col) sh.getRange(row, col).setValue(isActive ? "TRUE" : "FALSE");
      var colUp = header.updatedAt;
      if (colUp) sh.getRange(row, colUp).setValue(
        Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss")
      );
      return { ok: true, itemId: id, isActive: !!isActive };
    }
  }
  return { ok: false, message: "item not found" };
}

// ===== internal =====

function msHearing_ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_MsHearingConfig");
  if (!sh) {
    sh = ss.insertSheet("DB_MsHearingConfig");
    sh.getRange(1, 1, 1, MS_HEARING_HEADERS_.length).setValues([MS_HEARING_HEADERS_]);
  }
  return sh;
}

function msHearing_headerMap_(sh) {
  var row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var k = String(row[i] || "").trim();
    if (k) map[k] = i + 1;
  }
  return map;
}

function msHearing_listAll_() {
  var sh;
  try { sh = msHearing_ensureSheet_(); } catch (_e) { return []; }
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var header = msHearing_headerMap_(sh);
  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var id = String(r[(header.itemId || 1) - 1] || "").trim();
    if (!id) continue;
    out.push({
      itemId: id,
      orderNo: Number(r[(header.orderNo || 1) - 1] || 50),
      category: String(r[(header.category || 1) - 1] || "").trim(),
      question: String(r[(header.question || 1) - 1] || "").trim(),
      description: String(r[(header.description || 1) - 1] || "").trim(),
      isRequired: String(r[(header.isRequired || 1) - 1] || "").toUpperCase() === "TRUE",
      isActive: String(r[(header.isActive || 1) - 1] || "").toUpperCase() === "TRUE",
      updatedAt: String(r[(header.updatedAt || 1) - 1] || "").trim()
    });
  }
  return out;
}

function msHearing_writeRow_(sh, header, rowIndex, obj) {
  var lastCol = sh.getLastColumn();
  var cur;
  try {
    cur = sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  } catch (_e) {
    cur = new Array(lastCol).fill("");
  }
  Object.keys(obj).forEach(function(k) {
    var col = header[k];
    if (col) cur[col - 1] = obj[k];
  });
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([cur]);
}

/**
 * projectTypeに合致するヒアリング項目を返す。
 * studioはdtsuにフォールバック。
 */
function msHearing_listByType(projectType) {
  var all = msHearing_listActive();
  if (!projectType) return all;
  var pt = String(projectType).trim().toLowerCase();
  // studioはdtsuにフォールバック
  if (pt === "studio") pt = "dtsu";
  var filtered = [];
  for (var i = 0; i < all.length; i++) {
    var itemType = String(all[i].projectType || "").trim().toLowerCase();
    if (itemType === pt || itemType === "" || itemType === "all") {
      filtered.push(all[i]);
    }
  }
  return filtered.length > 0 ? filtered : all;
}