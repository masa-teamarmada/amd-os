/** 162_TsukuyomiSessionRepo.gs
 * つくよみ会話セッション管理。スレッド単位でモード・進行状態を保持する。
 *
 * 公開関数：
 *  - tsukuyomiSession_getByThread(channelId, threadTs)
 *  - tsukuyomiSession_upsert(session)
 *  - tsukuyomiSession_updatePhase(sessionId, phase, extras)
 *
 * DB: DB_TsukuyomiSessions（本体スプシ）
 */

var TSUKU_SESSION_HEADERS_ = [
  "sessionId", "threadTs", "channelId", "projectId",
  "mode", "phase", "hearingContext", "generatedMsJson",
  "createdAt", "updatedAt"
];

function tsukuyomiSession_getByThread(channelId, threadTs) {
  var ch = String(channelId || "").trim();
  var ts = String(threadTs || "").trim();
  if (!ch || !ts) return null;

  var sh = tsukuSession_ensureSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var header = tsukuSession_headerMap_(sh);
  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var rCh = String(r[(header.channelId || 1) - 1] || "").trim();
    // threadTsは数値変換されうるので、String()で統一してから比較
    var rTsRaw = r[(header.threadTs || 1) - 1];
    var rTs = (typeof rTsRaw === "number") ? rTsRaw.toFixed(6) : String(rTsRaw || "").trim();
    if (rCh === ch && rTs === ts) {
      return tsukuSession_rowToObj_(r, header);
    }
  }
  return null;
}

function tsukuyomiSession_getById(sessionId) {
  var sid = String(sessionId || "").trim();
  if (!sid) return null;

  var sh = tsukuSession_ensureSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var header = tsukuSession_headerMap_(sh);
  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (String(r[(header.sessionId || 1) - 1] || "").trim() === sid) {
      return tsukuSession_rowToObj_(r, header);
    }
  }
  return null;
}

/**
 * 指定PJでactive（hearing/review/generating）なセッションを返す
 */
function tsukuyomiSession_getActiveByProject(projectId) {
  var pid = String(projectId || "").trim();
  if (!pid) return null;

  var sh = tsukuSession_ensureSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var header = tsukuSession_headerMap_(sh);
  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  var activePhases = { hearing: true, review: true, generating: true };
  var best = null;

  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var rPid = String(r[(header.projectId || 1) - 1] || "").trim();
    var rMode = String(r[(header.mode || 1) - 1] || "").trim();
    var rPhase = String(r[(header.phase || 1) - 1] || "").trim();
    if (rPid === pid && rMode === "ms_design" && activePhases[rPhase]) {
      var obj = tsukuSession_rowToObj_(r, header);
      if (!best || obj.updatedAt > best.updatedAt) best = obj;
    }
  }
  return best;
}

function tsukuyomiSession_upsert(session) {
  session = session || {};
  var sh = tsukuSession_ensureSheet_();
  var header = tsukuSession_headerMap_(sh);
  var lastRow = sh.getLastRow();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  var sessionId = String(session.sessionId || "").trim();
  if (!sessionId) sessionId = "tss-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  var obj = {
    sessionId: sessionId,
    threadTs: String(session.threadTs || "").trim(),
    channelId: String(session.channelId || "").trim(),
    projectId: String(session.projectId || "").trim(),
    mode: String(session.mode || "freetext").trim(),
    phase: String(session.phase || "").trim(),
    hearingContext: (typeof session.hearingContext === "string")
      ? session.hearingContext
      : JSON.stringify(session.hearingContext || {}),
    generatedMsJson: (typeof session.generatedMsJson === "string")
      ? session.generatedMsJson
      : JSON.stringify(session.generatedMsJson || []),
    updatedAt: now
  };

  // 既存を探す
  var targetRow = 0;
  if (lastRow >= 2) {
    var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][(header.sessionId || 1) - 1] || "").trim() === sessionId) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow >= 2) {
    // update（createdAtは保持）
    tsukuSession_writeRow_(sh, header, targetRow, obj);
    return { ok: true, mode: "update", sessionId: sessionId };
  }

  // insert
  obj.createdAt = now;
  var newRow = (lastRow || 1) + 1;
  tsukuSession_writeRow_(sh, header, newRow, obj);
  return { ok: true, mode: "insert", sessionId: sessionId };
}

function tsukuyomiSession_updatePhase(sessionId, phase, extras) {
  var s = tsukuyomiSession_getById(sessionId);
  if (!s) return { ok: false, message: "session not found: " + sessionId };

  s.phase = phase;
  if (extras) {
    if (extras.hearingContext !== undefined) s.hearingContext = extras.hearingContext;
    if (extras.generatedMsJson !== undefined) s.generatedMsJson = extras.generatedMsJson;
  }
  return tsukuyomiSession_upsert(s);
}

// ===== internal =====

function tsukuSession_ensureSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_TsukuyomiSessions");
  if (!sh) {
    sh = ss.insertSheet("DB_TsukuyomiSessions");
    sh.getRange(1, 1, 1, TSUKU_SESSION_HEADERS_.length).setValues([TSUKU_SESSION_HEADERS_]);
    // threadTs等が数値変換されないようにテキスト形式を強制
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat("@");
    sh.getRange(1, 1, 1, TSUKU_SESSION_HEADERS_.length).setValues([TSUKU_SESSION_HEADERS_]);
  }
  return sh;
}

function tsukuSession_headerMap_(sh) {
  var row = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < row.length; i++) {
    var k = String(row[i] || "").trim();
    if (k) map[k] = i + 1;
  }
  return map;
}

function tsukuSession_rowToObj_(r, header) {
  var hcRaw = String(r[(header.hearingContext || 1) - 1] || "").trim();
  var msRaw = String(r[(header.generatedMsJson || 1) - 1] || "").trim();

  var hc = {};
  try { if (hcRaw) hc = JSON.parse(hcRaw); } catch (_e) {}

  var ms = [];
  try { if (msRaw) ms = JSON.parse(msRaw); } catch (_e) {}

  return {
    sessionId: String(r[(header.sessionId || 1) - 1] || "").trim(),
    threadTs: (function() { var v = r[(header.threadTs || 1) - 1]; return (typeof v === "number") ? v.toFixed(6) : String(v || "").trim(); })(),
    channelId: String(r[(header.channelId || 1) - 1] || "").trim(),
    projectId: String(r[(header.projectId || 1) - 1] || "").trim(),
    mode: String(r[(header.mode || 1) - 1] || "").trim(),
    phase: String(r[(header.phase || 1) - 1] || "").trim(),
    hearingContext: hc,
    generatedMsJson: ms,
    createdAt: String(r[(header.createdAt || 1) - 1] || "").trim(),
    updatedAt: String(r[(header.updatedAt || 1) - 1] || "").trim()
  };
}

function tsukuSession_writeRow_(sh, header, rowIndex, obj) {
  var lastCol = sh.getLastColumn();
  var cur;
  try {
    cur = sh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  } catch (_e) {
    cur = new Array(lastCol).fill("");
  }
  Object.keys(obj).forEach(function(k) {
    var col = header[k];
    if (col) {
      var val = obj[k];
      if (typeof val === "object" && val !== null) val = JSON.stringify(val);
      cur[col - 1] = val;
    }
  });
  sh.getRange(rowIndex, 1, 1, lastCol).setValues([cur]);
}