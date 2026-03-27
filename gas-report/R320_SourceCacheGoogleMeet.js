/**
 * R320_SourceCacheGoogleMeet.gs
 * Google Meet議事録メール（Gemini Notes）→ DB_SourceCache 収集
 *
 * from:gemini-notes@google.com のメールを検索し、
 * 本文HTMLからGoogle Doc URLを抽出してDoc本文を取得、
 * DB_SourceCacheにsource='gmeet_minutes'でupsertする。
 *
 * 依存:
 *   - R311_SourceCacheRepo.gs（srcCache_upsert, srcCache_exists）
 *   - R017_CalendarToNotionMinutes.gs（_loadPJAliasesForMinutes_, _matchAlias_）
 */

var GMEET_SENDER_ = 'gemini-notes@google.com';
var GMEET_SOURCE_ = 'gmeet_minutes';

/**
 * 差分収集（R319 cronから呼ぶ）
 * @param {Date} sinceDate
 * @return {number} upsert件数
 */
function srcCacheGMeet_collectDelta_(sinceDate) {
  var query = 'from:' + GMEET_SENDER_ + ' after:' + srcCacheGMeet_toGmailDate_(sinceDate);
  var threads = GmailApp.search(query, 0, 50);
  if (!threads || threads.length === 0) return 0;

  var pjAliases = _loadPJAliasesForMinutes_();
  var count = 0;

  for (var ti = 0; ti < threads.length; ti++) {
    var messages = threads[ti].getMessages();
    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];
      var msgId = msg.getId();
      var subject = String(msg.getSubject() || '').trim();
      var projectName = srcCacheGMeet_resolveProjectName_(subject, pjAliases);
      var projectId = srcCacheGMeet_resolveProjectId_(projectName);

      if (srcCache_exists(projectId, GMEET_SOURCE_, msgId)) continue;

      var msgDate = msg.getDate();
      var ym = srcCacheGMeet_dateToYm_(msgDate);

      var htmlBody = msg.getBody();
      var docId = srcCacheGMeet_extractDocId_(htmlBody);
      if (!docId) continue;

      var docText = srcCacheGMeet_readDocText_(docId);
      if (!docText) continue;

      srcCache_upsert({
        projectId:   projectId,
        ym:          ym,
        source:      GMEET_SOURCE_,
        itemId:      msgId,
        title:       subject.substring(0, 100),
        itemDate:    srcCacheGMeet_formatJst_(msgDate),
        contentText: docText,
        metadataJson: JSON.stringify({
          docId:      docId,
          subject:    subject,
          gmailId:    msgId
        })
      });
      count++;
    }
  }

  Logger.log('[GMeet] ' + count + ' minutes collected');
  return count;
}

/**
 * ym指定で手動収集（バックフィル用）
 * @param {string} ym  yyyymm
 * @return {number} upsert件数
 */
function srcCacheGMeet_collectByYm(ym) {
  var ymStr = String(ym || '');
  if (ymStr.length !== 6) throw new Error('ym must be yyyymm');

  var year  = parseInt(ymStr.substring(0, 4));
  var month = parseInt(ymStr.substring(4, 6));
  var after    = new Date(year, month - 1, 1);
  var beforeRaw = new Date(year, month, 1);

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var before = beforeRaw < tomorrow ? beforeRaw : tomorrow;

  var query = 'from:' + GMEET_SENDER_
    + ' after:'  + srcCacheGMeet_toGmailDate_(after)
    + ' before:' + srcCacheGMeet_toGmailDate_(before);

  var threads = GmailApp.search(query, 0, 100);
  Logger.log('[GMeet] query=' + query + ' threads=' + (threads ? threads.length : 0));
  if (!threads || threads.length === 0) {
    Logger.log('[GMeet] No threads found for ym=' + ym);
    return 0;
  }

  var pjAliases = _loadPJAliasesForMinutes_();
  var count = 0;
  var skipped = 0;

  for (var ti = 0; ti < threads.length; ti++) {
    var messages = threads[ti].getMessages();
    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];
      var msgId = msg.getId();
      var subject = String(msg.getSubject() || '').trim();
      var projectName = srcCacheGMeet_resolveProjectName_(subject, pjAliases);
      var projectId = srcCacheGMeet_resolveProjectId_(projectName);

      if (srcCache_exists(projectId, GMEET_SOURCE_, msgId)) {
        skipped++;
        continue;
      }

      var msgDate = msg.getDate();
      var htmlBody = msg.getBody();
      var docId = srcCacheGMeet_extractDocId_(htmlBody);
      if (!docId) continue;

      var docText = srcCacheGMeet_readDocText_(docId);
      if (!docText) continue;

      srcCache_upsert({
        projectId:   projectId,
        ym:          ym,
        source:      GMEET_SOURCE_,
        itemId:      msgId,
        title:       subject.substring(0, 100),
        itemDate:    srcCacheGMeet_formatJst_(msgDate),
        contentText: docText,
        metadataJson: JSON.stringify({
          docId:      docId,
          subject:    subject,
          gmailId:    msgId
        })
      });
      count++;
    }
  }

  Logger.log('[GMeet] ym=' + ym + ' collected=' + count + ' skipped=' + skipped);
  return count;
}

/**
 * メールHTML本文からGoogle Doc IDを抽出
 * @param {string} htmlBody
 * @return {string|null}
 */
function srcCacheGMeet_extractDocId_(htmlBody) {
  if (!htmlBody) return null;
  var m = htmlBody.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Google DocのIDから本文テキストを取得
 * @param {string} docId
 * @return {string}
 */
function srcCacheGMeet_readDocText_(docId) {
  Utilities.sleep(500);
  try {
    var token = ScriptApp.getOAuthToken();
    var url = 'https://www.googleapis.com/drive/v3/files/'
      + encodeURIComponent(docId)
      + '/export?mimeType=text%2Fplain';
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('[GMeet] export failed docId=' + docId + ' code=' + res.getResponseCode());
      return '';
    }
    var fullText = res.getContentText() || '';
    return srcCacheGMeet_extractSummary_(fullText);
  } catch (e) {
    Logger.log('[GMeet] Doc read error docId=' + docId + ': ' + e);
    return '';
  }
}

/**
 * Gemini Notesのテキストから「まとめ」「詳細」「推奨される次のステップ」を抽出
 * @param {string} fullText
 * @return {string}
 */
function srcCacheGMeet_extractSummary_(fullText) {
  if (!fullText) return '';

  var result = '';

  // まとめセクション
  var summaryMatch = fullText.match(/まとめ\s*\n([\s\S]*?)(?=\n詳細|\n推奨される次のステップ|$)/);
  if (summaryMatch) {
    result += '【まとめ】\n' + summaryMatch[1].trim() + '\n\n';
  }

  // 推奨される次のステップ
  var nextMatch = fullText.match(/推奨される次のステップ\s*\n([\s\S]*?)(?=\n\n\n|$)/);
  if (nextMatch) {
    result += '【次のステップ】\n' + nextMatch[1].trim() + '\n\n';
  }

  // 詳細セクション（最初の2000文字のみ）
  var detailMatch = fullText.match(/詳細\s*\n([\s\S]*?)(?=\n推奨される次のステップ|$)/);
  if (detailMatch) {
    result += '【詳細】\n' + detailMatch[1].trim().substring(0, 2000) + '\n';
  }

  // どのセクションも見つからなければ冒頭3000文字
  if (!result) {
    result = fullText.substring(0, 3000);
  }

  return result;
}

/**
 * 件名からpjCodeを解決（CFG_PJAlias流用）
 * @param {string} subject
 * @param {Array} pjAliases
 * @return {string}  マッチなければ 'AMD'
 */
function srcCacheGMeet_resolveProjectName_(subject, pjAliases) {
  var hit = _matchAlias_(subject, pjAliases);
  if (hit && hit.pjCode && hit.pjCode.toUpperCase() !== 'EXCLUDE') {
    return hit.pjCode;
  }
  return 'AMD';
}

function srcCacheGMeet_resolveProjectId_(projectName) {
  try {
    var props = PropertiesService.getScriptProperties();
    var ssId = props.getProperty('MAIN_SPREADSHEET_ID');
    if (!ssId) return projectName;
    var ss = SpreadsheetApp.openById(ssId);
    var sh = ss.getSheetByName('DB_Projects');
    if (!sh || sh.getLastRow() < 2) return projectName;
    var data = sh.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var iName = headers.indexOf('projectName');
    var iId   = headers.indexOf('projectId');
    if (iName < 0 || iId < 0) return projectName;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iName]).trim() === projectName) {
        return String(data[i][iId]).trim();
      }
    }
    Logger.log('[GMeet] resolveProjectId_: not found in DB_Projects for projectName=' + projectName);
  } catch (e) {
    Logger.log('[GMeet] resolveProjectId_ error: ' + e);
  }
  return projectName;
}

/**
 * GmailApp.search用 after:/before: 日付文字列（yyyy/MM/dd）
 * @param {Date} date
 * @return {string}
 */
function srcCacheGMeet_toGmailDate_(date) {
  var y = date.getFullYear();
  var m = ('0' + (date.getMonth() + 1)).slice(-2);
  var d = ('0' + date.getDate()).slice(-2);
  return y + '/' + m + '/' + d;
}

/**
 * Dateをyyyymmのymに変換
 * @param {Date} date
 * @return {string}
 */
function srcCacheGMeet_dateToYm_(date) {
  return String(date.getFullYear()) + ('0' + (date.getMonth() + 1)).slice(-2);
}

/**
 * JST日時文字列
 * @param {Date} date
 * @return {string}
 */
function srcCacheGMeet_formatJst_(date) {
  var d = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 '
    + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
}

// ========== 手動実行ランナー ==========

/**
 * 手動実行: 過去3日分をdryプレビュー（Cacheには書かない）
 * R320_SourceCacheGoogleMeet.gs → run_gmeet_preview
 */
function run_gmeet_preview() {
  var sinceDate = new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000);
  var query = 'from:' + GMEET_SENDER_ + ' after:' + srcCacheGMeet_toGmailDate_(sinceDate);
  var threads = GmailApp.search(query, 0, 10);
  var pjAliases = _loadPJAliasesForMinutes_();
  var preview = [];

  for (var ti = 0; ti < threads.length; ti++) {
    var messages = threads[ti].getMessages();
    for (var mi = 0; mi < messages.length; mi++) {
      var msg = messages[mi];
      var subject = msg.getSubject();
      var htmlBody = msg.getBody();
      var docId = srcCacheGMeet_extractDocId_(htmlBody);
      var pjCode = srcCacheGMeet_resolveProjectName_(subject, pjAliases);
      var docText = docId ? srcCacheGMeet_readDocText_(docId) : '';
      preview.push({
        subject:   subject,
        msgId:     msg.getId(),
        docId:     docId || '(not found)',
        pjCode:    pjCode,
        charCount: docText.length,
        preview:   docText.substring(0, 200)
      });
    }
  }

  Logger.log('[run_gmeet_preview]\n' + JSON.stringify(preview, null, 2));
  return preview;
}

/**
 * 手動実行: ym指定でバックフィル
 * R320_SourceCacheGoogleMeet.gs → run_gmeet_backfill_202503
 */
function run_gmeet_backfill_all_() {
  var startYm = '202501';
  var now = new Date();
  var endYm = String(now.getFullYear()) + ('0' + (now.getMonth() + 1)).slice(-2);

  var y = parseInt(startYm.substring(0, 4));
  var m = parseInt(startYm.substring(4, 6));
  var endY = parseInt(endYm.substring(0, 4));
  var endM = parseInt(endYm.substring(4, 6));

  var total = 0;
  while (y < endY || (y === endY && m <= endM)) {
    var ym = String(y) + ('0' + m).slice(-2);
    var count = srcCacheGMeet_collectByYm(ym);
    Logger.log('[backfill] ym=' + ym + ' count=' + count);
    total += count;
    Utilities.sleep(2000);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  Logger.log('[backfill] total=' + total);
  return total;
}
