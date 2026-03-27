/**
 * R311_SourceCacheRepo.gs
 * 一次情報キャッシュ（DB_SourceCache）のデータアクセス層。
 * 
 * 格納先: Navigatorスプシ（NAVIGATOR_SPREADSHEET_ID）
 * 粒度: ソース×アイテム単位で1行
 *   - Notion: 1ページ = 1行
 *   - Slack: 1スレッド = 1行
 *   - Gmail: 1メール = 1行
 *   - Drive: 1ファイル = 1行
 *   - Calendar: 1イベント = 1行
 * 
 * 依存:
 *   - B_Sheets.gs（b_ensureHeader_, b_readTable_, b_upsertRow_）
 *   - B_Util.gs（b_normYm_）
 *   - 010_Utils.gs（jstNow_ 等）
 */

// ========== 定数 ==========

var SOURCE_CACHE_SHEET_NAME_ = 'DB_SourceCache';

var SOURCE_CACHE_HEADERS_ = [
  'cacheId',         // PK: projectId_source_itemId
  'projectId',       // プロジェクトID
  'ym',              // 対象年月 yyyymm
  'source',          // notion / slack / gmail / drive / calendar
  'itemId',          // notionPageId / slackThreadTs / gmailMsgId / driveFileId / calEventId
  'title',           // 人間が見て分かるタイトル
  'itemDate',        // そのアイテムの日時（JST文字列）
  'contentText',     // プレーンテキスト本文
  'charCount',       // 文字数
  'collectedAtJst',  // 収集日時（JST文字列）
  'metadataJson'     // 付帯情報（小さいJSON）
];

// ========== シート取得・ヘッダ保証 ==========

/**
 * DB_SourceCache シートを取得（なければ作成＋ヘッダ保証）
 * ※ Navigatorスプシ専用。本体スプシのb_系関数は使えない。
 * @return {Sheet}
 */
function srcCache_getSheet_() {
  var ssId = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
  if (!ssId) throw new Error('NAVIGATOR_SPREADSHEET_ID が未設定');
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = ss.getSheetByName(SOURCE_CACHE_SHEET_NAME_);
  if (!sheet) {
    Logger.log('DB_SourceCache シートを新規作成');
    sheet = ss.insertSheet(SOURCE_CACHE_SHEET_NAME_);
  }
  srcCache_ensureHeader_(sheet);
  return sheet;
}

/**
 * ヘッダ行を保証（Navigatorスプシ用の自前実装）
 * @param {Sheet} sheet
 */
function srcCache_ensureHeader_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    // 空シート → ヘッダ書き込み
    sheet.getRange(1, 1, 1, SOURCE_CACHE_HEADERS_.length).setValues([SOURCE_CACHE_HEADERS_]);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  // 不足カラムを右に追加
  for (var i = 0; i < SOURCE_CACHE_HEADERS_.length; i++) {
    if (existing.indexOf(SOURCE_CACHE_HEADERS_[i]) === -1) {
      var nextCol = existing.length + 1;
      sheet.getRange(1, nextCol).setValue(SOURCE_CACHE_HEADERS_[i]);
      existing.push(SOURCE_CACHE_HEADERS_[i]);
    }
  }
}

// ========== cacheId生成 ==========

/**
 * cacheIdを組み立てる
 * @param {string} projectId
 * @param {string} source
 * @param {string} itemId
 * @return {string}
 */
function srcCache_buildId_(projectId, source, itemId) {
  return projectId + '_' + source + '_' + itemId;
}

// ========== 書き込み（upsert） ==========

/**
 * 1件upsert
 * @param {Object} item
 *   { projectId, ym, source, itemId, title, itemDate, contentText, metadataJson? }
 * @return {string} cacheId
 */
/**
 * 1件upsert（Navigatorスプシ用の自前実装）
 * @param {Object} item
 *   { projectId, ym, source, itemId, title, itemDate, contentText, metadataJson? }
 * @return {string} cacheId
 */
function srcCache_upsert(item) {
  var sheet = srcCache_getSheet_();
  var cacheId = srcCache_buildId_(item.projectId, item.source, item.itemId);
  var text = item.contentText || '';
  var now = srcCache_nowJst_();

  var rowData = {
    cacheId:        cacheId,
    projectId:      item.projectId,
    ym:             String(item.ym || ''),
    source:         item.source,
    itemId:         item.itemId,
    title:          item.title || '',
    itemDate:       item.itemDate || '',
    contentText:    text,
    charCount:      text.length,
    collectedAtJst: now,
    metadataJson:   item.metadataJson || ''
  };

  // ヘッダ取得
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  var cacheIdCol = headers.indexOf('cacheId');
  if (cacheIdCol < 0) throw new Error('cacheId列が見つかりません');

  // 既存行を検索
  var lastRow = sheet.getLastRow();
  var existingRow = -1;
  if (lastRow >= 2) {
    var cacheIdValues = sheet.getRange(2, cacheIdCol + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < cacheIdValues.length; i++) {
      if (String(cacheIdValues[i][0]) === cacheId) {
        existingRow = i + 2; // 1-indexed, skip header
        break;
      }
    }
  }

  // 書き込み用の配列を組み立て
  var rowArray = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });

  if (existingRow > 0) {
    // 上書き
    sheet.getRange(existingRow, 1, 1, rowArray.length).setValues([rowArray]);
  } else {
    // 追加
    sheet.appendRow(rowArray);
  }

  // ym列を文字列フォーマットに強制
  srcCache_forceYmText_(sheet, cacheId, headers, cacheIdCol);

  return cacheId;
}

/**
 * 複数件を一括upsert
 * @param {Array<Object>} items
 * @return {number} 処理件数
 */
function srcCache_bulkUpsert(items) {
  if (!items || items.length === 0) return 0;
  for (var i = 0; i < items.length; i++) {
    srcCache_upsert(items[i]);
  }
  return items.length;
}

// ========== 読み取り ==========
/**
 * projectId × ym × source でフィルタ（Navigatorスプシ自前read）
 * @param {string} projectId
 * @param {string} ym  yyyymm
 * @param {string} [source]  省略時は全ソース
 * @return {Array<Object>}
 */
function srcCache_listByProjectYm(projectId, ym, source) {
  var all = srcCache_readAll_();
  var normYm = b_normYm_(ym);
  var result = [];
  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    if (String(r.projectId) !== String(projectId)) continue;
    if (b_normYm_(r.ym) !== normYm) continue;
    if (source && String(r.source) !== source) continue;
    result.push(r);
  }
  return result;
}

/**
 * projectId × source でフィルタ（ym横断）
 * @param {string} projectId
 * @param {string} source
 * @return {Array<Object>}
 */
function srcCache_listByProjectSource(projectId, source) {
  var all = srcCache_readAll_();
  var result = [];
  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    if (String(r.projectId) !== String(projectId)) continue;
    if (String(r.source) !== source) continue;
    result.push(r);
  }
  return result;
}

/**
 * 特定のcacheIdが存在するか
 * @param {string} projectId
 * @param {string} source
 * @param {string} itemId
 * @return {boolean}
 */
function srcCache_exists(projectId, source, itemId) {
  var cacheId = srcCache_buildId_(projectId, source, itemId);
  var all = srcCache_readAll_();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].cacheId) === cacheId) return true;
  }
  return false;
}

/**
 * 全行読み取り（Navigatorスプシ用の自前実装）
 * @return {Array<Object>}
 */
function srcCache_readAll_() {
  var sheet = srcCache_getSheet_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var any = false;
    for (var c = 0; c < headers.length; c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) { any = true; break; }
    }
    if (!any) continue;
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = row[idx]; });
    result.push(obj);
  }
  return result;
}

function srcCache_getById(cacheId) {
  var all = srcCache_readAll_();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].cacheId) === String(cacheId)) return all[i];
  }
  return null;
}

// ========== ヘルパー ==========

/**
 * 現在日時をJST文字列で返す
 * @return {string}
 */
function srcCache_nowJst_() {
  var d = new Date();
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000);
  var y = d.getUTCFullYear();
  var m = ('0' + (d.getUTCMonth() + 1)).slice(-2);
  var day = ('0' + d.getUTCDate()).slice(-2);
  var h = ('0' + d.getUTCHours()).slice(-2);
  var min = ('0' + d.getUTCMinutes()).slice(-2);
  return y + '年' + parseInt(m) + '月' + parseInt(day) + '日 ' + h + ':' + min;
}

/**
 * ym列を文字列フォーマットに強制（スプシが数値にする対策）
 * @param {Sheet} sheet
 * @param {string} cacheId
 */
/**
 * ym列を文字列フォーマットに強制（スプシが数値にする対策）
 * @param {Sheet} sheet
 * @param {string} cacheId
 * @param {Array} headers
 * @param {number} cacheIdCol
 */
function srcCache_forceYmText_(sheet, cacheId, headers, cacheIdCol) {
  try {
    var ymCol = headers.indexOf('ym');
    if (ymCol < 0) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var cacheIdValues = sheet.getRange(2, cacheIdCol + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < cacheIdValues.length; i++) {
      if (String(cacheIdValues[i][0]) === cacheId) {
        sheet.getRange(i + 2, ymCol + 1).setNumberFormat('@');
        break;
      }
    }
  } catch (e) {
    Logger.log('srcCache_forceYmText_ error: ' + e);
  }
}