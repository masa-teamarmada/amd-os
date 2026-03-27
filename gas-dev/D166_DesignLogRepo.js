// D166_DesignLogRepo.gs
// 設計ログ（DB_DesignLog）のCRUD。
// new/change/delete/refactor の「なぜ・どこに・何を」を時系列で蓄積する。

const DL_SHEET_NAME_ = 'DB_DesignLog';
const DL_HEADERS_ = ['logId','datetime','category','targetFiles','summary','reason','sessionNote','author'];

function designLog_append(appId, payload) {
  payload = payload || {};
  const ss    = appId ? getDevSsByApp_(appId) : getDevSpreadsheet_();
  const sheet = dl_ensureSheetOn_(ss);
  const now   = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
  const logId = 'DL-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss')
                + '-' + Math.floor(Math.random() * 1000);
  let author = '';
  try { author = Session.getEffectiveUser().getEmail(); } catch(e) {}
  sheet.appendRow([
    logId, now,
    String(payload.category    || 'change'),
    String(payload.targetFiles || ''),
    String(payload.summary     || ''),
    String(payload.reason      || ''),
    String(payload.sessionNote || ''),
    author,
  ]);
  return { ok: true, logId };
}

function designLog_getRecent(appId, n) {
  n = n || 20;
  const ss    = appId ? getDevSsByApp_(appId) : getDevSpreadsheet_();
  const sheet = dl_ensureSheetOn_(ss);
  if (!sheet) return { ok: true, logs: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, logs: [] };
  const headers = data[0];
  const logs    = [];
  const start   = Math.max(1, data.length - n);
  for (let i = data.length - 1; i >= start; i--) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let val = data[i][c];
      if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
      obj[headers[c]] = String(val || '');
    }
    logs.push(obj);
  }
  return JSON.parse(JSON.stringify({ ok: true, logs }));
}

function designLog_getAll(appId) {
  const ss    = appId ? getDevSsByApp_(appId) : getDevSpreadsheet_();
  const sheet = dl_getSheetOn_(ss);
  if (!sheet) return { ok: true, logs: [] };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, logs: [] };
  const headers = data[0];
  const logs = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let val = data[i][c];
      if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
      obj[headers[c]] = String(val || '');
    }
    logs.push(obj);
  }
  return JSON.parse(JSON.stringify({ ok: true, logs }));
}

function dl_getSheetOn_(ss) {
  return ss.getSheetByName(DL_SHEET_NAME_);
}

function dl_ensureSheetOn_(ss) {
  let sheet = ss.getSheetByName(DL_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(DL_SHEET_NAME_);
    sheet.getRange(1, 1, 1, DL_HEADERS_.length).setValues([DL_HEADERS_]);
    sheet.setFrozenRows(1);
  }
  const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  if (String(existing[0]) !== DL_HEADERS_[0]) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, DL_HEADERS_.length).setValues([DL_HEADERS_]);
  }
  return sheet;
}