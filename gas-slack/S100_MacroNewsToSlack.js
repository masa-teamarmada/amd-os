/** S100_MacroNewsToSlack.gs
 * reportGAS の DB_MacroTrendLog（status=linked／score>=7 でプロモート済み）を
 * 毎日12:45 JSTに #a4_news につくよみ名義で投稿する。
 *
 * 依存:
 *   - utils_getProp_("MAIN_SPREADSHEET_ID")
 *   - slack_postMessage_(channelId, text)  ← S020_SlackApi
 *   - DB_MacroTrendLog（reportGAS 側の R401/R402 が書き込む）
 *   - DB_Projects（projectId / projectName / slackChannelId）
 *
 * 副作用:
 *   - DB_MacroTrendLog に "postedToSlackAt" 列が無ければ自動で追加する
 *   - 投稿成功時、対象行の postedToSlackAt に投稿日時(JST)を書き込む
 */

var MACRO_NEWS_CHANNEL_ = "C08UCCBSSHJ"; // #a4_news

// #a4_news の過去投稿パターンに合わせたPJ短ラベル
var MACRO_PJ_LABEL_MAP_ = {
  p06: "CTB",
  p07: "LST",
  p09: "JC",
  p10: "SE",
  p11: "BWE",
  p19: "ZMP",
  p20: "CX",
  p21: "SX"
};

function _macroNews_label_(projectId, projectName) {
  return MACRO_PJ_LABEL_MAP_[projectId] || projectName || projectId || "?";
}

function _macroNews_getOrAddSlackedAtCol_(sheet, headers) {
  var idx = headers.indexOf("postedToSlackAt");
  if (idx >= 0) return idx;
  var newCol = headers.length;
  sheet.getRange(1, newCol + 1).setValue("postedToSlackAt");
  return newCol;
}

function _macroNews_parseJstString_(s) {
  // R401が書く "yyyy年MM月dd日 HH:mm" を Date 化（GASのTZはAsia/Tokyo前提）
  var m = String(s || "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function cron_postMacroNewsToSlack() {
  var ssId = utils_getProp_("MAIN_SPREADSHEET_ID");
  if (!ssId) throw new Error("MAIN_SPREADSHEET_ID missing");
  var ss = SpreadsheetApp.openById(ssId);

  var logSheet = ss.getSheetByName("DB_MacroTrendLog");
  var projSheet = ss.getSheetByName("DB_Projects");
  if (!logSheet) throw new Error("DB_MacroTrendLog sheet not found");
  if (!projSheet) throw new Error("DB_Projects sheet not found");

  // projectId → projectName
  var pData = projSheet.getDataRange().getValues();
  var pHead = pData[0];
  var pIdIdx = pHead.indexOf("projectId");
  var pNameIdx = pHead.indexOf("projectName");
  var nameMap = {};
  if (pIdIdx >= 0 && pNameIdx >= 0) {
    pData.slice(1).forEach(function(r) { nameMap[r[pIdIdx]] = r[pNameIdx]; });
  }

  var data = logSheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, posted: 0 };

  var headers = data[0].slice();
  var statusIdx = headers.indexOf("status");
  var urlIdx = headers.indexOf("sourceUrl");
  var fetchedAtIdx = headers.indexOf("fetchedAt");
  var pjIdx = headers.indexOf("projectId");
  if (statusIdx < 0 || urlIdx < 0 || fetchedAtIdx < 0 || pjIdx < 0) {
    throw new Error("DB_MacroTrendLog headers missing required columns");
  }
  var slackedAtIdx = _macroNews_getOrAddSlackedAtCol_(logSheet, headers);
  // ヘッダ追加直後はメモリ上のdataに列が無い可能性あり。安全のため未読扱い。

  // 25時間以内 & status=linked & 未投稿
  var cutoff = Date.now() - 25 * 3600 * 1000;
  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年MM月dd日 HH:mm");
  var posted = 0;
  var skippedOld = 0;
  var skippedAlready = 0;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowNum = i + 1;

    if (String(row[statusIdx]) !== "linked") continue;

    // 列追加直後はrow[slackedAtIdx]がundefinedになり得るが、空扱いでOK
    if (row[slackedAtIdx]) { skippedAlready++; continue; }

    var fetchedDate = _macroNews_parseJstString_(row[fetchedAtIdx]);
    if (fetchedDate && fetchedDate.getTime() < cutoff) { skippedOld++; continue; }

    var url = String(row[urlIdx] || "").trim();
    if (!url) continue;

    var pjId = row[pjIdx];
    var label = _macroNews_label_(pjId, nameMap[pjId]);
    var text = label + "\n" + url;

    var res = slack_postMessage_(MACRO_NEWS_CHANNEL_, text);
    if (res && res.ok) {
      logSheet.getRange(rowNum, slackedAtIdx + 1).setValue(nowJst);
      posted++;
      Utilities.sleep(500);
    } else {
      Logger.log("[cron_postMacroNewsToSlack] post failed row " + rowNum + ": " + JSON.stringify(res));
    }
  }

  Logger.log("[cron_postMacroNewsToSlack] posted=" + posted + " skippedOld=" + skippedOld + " skippedAlready=" + skippedAlready);
  return { ok: true, posted: posted, skippedOld: skippedOld, skippedAlready: skippedAlready };
}

function setup_macroNewsToSlackTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "cron_postMacroNewsToSlack") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("cron_postMacroNewsToSlack")
    .timeBased()
    .atHour(12)
    .nearMinute(45)
    .everyDays(1)
    .inTimezone("Asia/Tokyo")
    .create();
  Logger.log("[setup_macroNewsToSlackTrigger] daily at ~12:45 JST created");
  return { ok: true };
}

/**
 * 一発投稿用：LiSTie 記事（biz-journal）を #a4_news につくよみ名義で投稿する。
 * GASエディタから手動で1回だけ実行する想定。
 */
function tmp_postLstToA4News() {
  var url = "https://biz-journal.jp/carboncredits/post_498.html";
  var text = "LST\n" + url;
  var res = slack_postMessage_(MACRO_NEWS_CHANNEL_, text);
  Logger.log("[tmp_postLstToA4News] " + JSON.stringify(res));
  return res;
}
