// R019_CalendarPJResolver.gs
// ============================================================
// Calendar Color -> PJ Resolver
// - CFG_ColorPJHistory を読み、colorId + startDate の履歴から pjCode を決定する
//
// 必須シート:
// - CFG_ColorPJHistory（COLOR_PJ_CONFIG_SPREADSHEET_ID で指定されたスプシ）
//
// CFG_ColorPJHistory headers:
//   colorId | startDate | pjCode | note
//
// map[colorId] = [{ startMs, pjCode }, ...] を作り、eventDateに対して
// startMs <= eventDate(00:00) のうち最大のものを採用する
// ============================================================

/**
 * CFG_ColorPJHistory を読み取って履歴マップを作る
 * @param {SpreadsheetApp.Spreadsheet} ss
 * @returns {Object} historyMap
 */
function readColorPJHistory_(ss) {
  var props = PropertiesService.getScriptProperties();
  var cfgId = String(props.getProperty('COLOR_PJ_CONFIG_SPREADSHEET_ID') || '').trim();

  var targetSs = null;

  if (cfgId) {
    targetSs = SpreadsheetApp.openById(cfgId);
  } else if (ss) {
    targetSs = ss;
  } else {
    throw new Error('COLOR_PJ_CONFIG_SPREADSHEET_ID が未設定');
  }

  var sh = targetSs.getSheetByName('CFG_ColorPJHistory');
  if (!sh) throw new Error('CFG_ColorPJHistory not found');

  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return {};

  var header = (values[0] || []).map(function(h) { return String(h).trim(); });
  var iColor = header.indexOf('colorId');
  var iStart = header.indexOf('startDate');
  var iPJ = header.indexOf('pjCode');

  if (iColor < 0 || iStart < 0 || iPJ < 0) {
    throw new Error('CFG_ColorPJHistory headers must include: colorId, startDate, pjCode');
  }

  var map = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];

    var colorId = String(row[iColor] || '').trim();
    var pj = String(row[iPJ] || '').trim();
    var sd = row[iStart];

    if (!colorId || !pj || !sd) continue;

    var startDate = (sd instanceof Date) ? sd : new Date(String(sd));
    if (isNaN(startDate.getTime())) continue;

    var normalized = new Date(startDate);
    normalized.setHours(0, 0, 0, 0);

    map[colorId] = map[colorId] || [];
    map[colorId].push({ startMs: normalized.getTime(), pjCode: pj });
  }

  var keys = Object.keys(map);
  for (var k = 0; k < keys.length; k++) {
    map[keys[k]].sort(function(a, b) { return a.startMs - b.startMs; });
  }

  return map;
}


/**
 * 色×履歴（CFG_ColorPJHistory）で PJ を引く
 * @param {string} colorId
 * @param {Date|string} eventDate
 * @param {Object} historyMap (readColorPJHistory_の返り値)
 * @returns {string} pjCode or ""
 */
function pickPJByColorHistory_(colorId, eventDate, historyMap) {
  var cid = String(colorId || '').trim();
  if (!cid) return '';

  var list = historyMap ? historyMap[cid] : null;
  if (!list || !list.length) return '';

  var t = (eventDate instanceof Date) ? new Date(eventDate) : new Date(String(eventDate));
  if (isNaN(t.getTime())) return '';

  t.setHours(0, 0, 0, 0);
  var ms = t.getTime();

  var best = null;
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    if (it.startMs <= ms) best = it;
    else break;
  }
  return best ? String(best.pjCode || '').trim() : '';
}
