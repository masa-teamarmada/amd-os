/**
 * S080_BillingNudge.gs
 * 請求額申告後のadmin承認催促ナッジ。
 * PM申告(status=reported)が存在したら、まさ・きよにSlack DMで通知。
 * 翌営業日から9時・12時・18時の3回送信。送信済みはDB_BillingNudgeLogで管理。
 */

function cron_billingApproveNudge() {
  var now = new Date();
  var hourJst = Number(Utilities.formatDate(now, "Asia/Tokyo", "H"));

  // 9・12・18時以外はスキップ
  if (hourJst !== 9 && hourJst !== 12 && hourJst !== 18) {
    return { ok: true, skipped: true, reason: "not nudge hour" };
  }

  // 土日祝チェック
  var dow = Number(Utilities.formatDate(now, "Asia/Tokyo", "u"));
  if (dow >= 6) return { ok: true, skipped: true, reason: "weekend" };
  if (billingNudge_isHoliday_(now)) return { ok: true, skipped: true, reason: "holiday" };

  var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));

  // 承認待ちリスト取得
  var pendingList = billingNudge_getPendingList_(navSs);
  if (!pendingList.length) return { ok: true, skipped: true, reason: "no pending" };

  // admin SlackID取得
  var adminSlackIds = billingNudge_getAdminSlackIds_(navSs);
  if (!adminSlackIds.length) return { ok: true, skipped: false, reason: "no admin slack id" };

  // 送信済みログ読み込み
  var logSheet = billingNudge_ensureLogSheet_(navSs);
  var sentKeys = billingNudge_readSentKeys_(logSheet, hourJst);

  var systemPrompt = billingNudge_getSystemPrompt_();
  var todayJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");
  var posted = 0;

  pendingList.forEach(function(pending) {
    var key = pending.projectId + "_" + pending.ym + "_" + hourJst + "_" + todayJst;
    if (sentKeys[key]) return; // 送信済みスキップ

    var ymLabel = String(pending.ym).slice(0,4) + "年" + parseInt(String(pending.ym).slice(4)) + "月";
    var userPrompt = [
      "プロジェクト名: " + pending.projectName,
      "対象月: " + ymLabel,
      "申告額: ¥" + Number(pending.budgetReportedAmount || 0).toLocaleString(),
      "申告者: " + pending.budgetReportedBy,
      "申告日時: " + pending.budgetReportedAt
    ].join("\n");

    try {
      var text = llm_call_(systemPrompt, userPrompt, { maxTokens: 300, temperature: 0.8 });
      if (!text) return;

      adminSlackIds.forEach(function(slackId) {
        slack_postMessage_(slackId, text);
      });

      billingNudge_logSent_(logSheet, pending.projectId, pending.ym, hourJst, todayJst, adminSlackIds.join(","));
      posted++;
    } catch(e) {
      Logger.log("billingApproveNudge error [" + pending.projectId + "]: " + e.message);
    }
  });

  return { ok: true, posted: posted };
}

function billingNudge_getPendingList_(navSs) {
  var sheet = navSs.getSheetByName("DB_BillingCycle");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var h = data[0].map(function(x){ return String(x||"").trim(); });
  var iId = h.indexOf("projectId");
  var iName = h.indexOf("projectName");
  var iYm = h.indexOf("ym");
  var iSt = h.indexOf("status");
  var iAmt = h.indexOf("budgetReportedAmount");
  var iBy = h.indexOf("budgetReportedBy");
  var iAt = h.indexOf("budgetReportedAt");

  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iSt]||"").trim() !== "reported") continue;
    list.push({
      projectId:            String(data[i][iId]||"").trim(),
      projectName:          String(data[i][iName]||"").trim(),
      ym:                   utils_normYm_(data[i][iYm]),
      budgetReportedAmount: Number(data[i][iAmt]||0),
      budgetReportedBy:     String(data[i][iBy]||"").trim(),
      budgetReportedAt:     String(data[i][iAt]||"").trim()
    });
  }
  return list.filter(function(r){ return r.projectId && r.ym; });
}

function billingNudge_getAdminSlackIds_(navSs) {
  var sheet = navSs.getSheetByName("DB_Members");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var h = data[0].map(function(x){ return String(x||"").trim(); });
  var iSlack = h.indexOf("slackId");
  var iAdmin = h.indexOf("isAdmin");
  if (iSlack < 0 || iAdmin < 0) return [];

  var ids = [];
  for (var i = 1; i < data.length; i++) {
    var isAdmin = String(data[i][iAdmin]||"").trim().toLowerCase();
    if (isAdmin !== "true" && isAdmin !== "1" && isAdmin !== "yes") continue;
    var slackId = String(data[i][iSlack]||"").trim();
    if (slackId) ids.push(slackId);
  }
  return ids;
}

function billingNudge_ensureLogSheet_(navSs) {
  var sheet = navSs.getSheetByName("DB_BillingNudgeLog");
  if (!sheet) {
    sheet = navSs.insertSheet("DB_BillingNudgeLog");
    sheet.appendRow(["nudgeId","projectId","ym","hourBucket","sentDate","sentTo","createdAtJst"]);
  }
  return sheet;
}

function billingNudge_readSentKeys_(logSheet, hourJst) {
  var keys = {};
  if (logSheet.getLastRow() < 2) return keys;
  var data = logSheet.getDataRange().getValues();
  var h = data[0].map(function(x){ return String(x||"").trim(); });
  var iPj = h.indexOf("projectId");
  var iYm = h.indexOf("ym");
  var iHr = h.indexOf("hourBucket");
  var iDt = h.indexOf("sentDate");
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][iPj]||"").trim() + "_" +
              utils_normYm_(data[i][iYm]) + "_" +
              String(data[i][iHr]||"").trim() + "_" +
              String(data[i][iDt]||"").trim();
    keys[key] = true;
  }
  return keys;
}

function billingNudge_logSent_(logSheet, projectId, ym, hourBucket, sentDate, sentTo) {
  logSheet.appendRow([
    Utilities.getUuid().replace(/-/g,""),
    projectId,
    ym,
    hourBucket,
    sentDate,
    sentTo,
    utils_jstNow_()
  ]);
}

function billingNudge_getSystemPrompt_() {
  try {
    var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));
    var sheet = navSs.getSheetByName("DB_TsukuyomiContext");
    if (!sheet || sheet.getLastRow() < 2) return "";
    var data = sheet.getDataRange().getValues();
    var h = data[0].map(function(x){ return String(x||"").trim(); });
    var iTags = h.indexOf("tags");
    var iContent = h.indexOf("content");
    var iStatus = h.indexOf("status");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iStatus]||"").trim() !== "active") continue;
      var tags = String(data[i][iTags]||"").split(",").map(function(t){ return t.trim(); });
      if (tags.indexOf("budget_approve_nudge") >= 0) {
        return String(data[i][iContent]||"").trim();
      }
    }
    return "";
  } catch(e) {
    Logger.log("billingNudge_getSystemPrompt_ error: " + e.message);
    return "";
  }
}

function billingNudge_isHoliday_(date) {
  try {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var events = CalendarApp.getCalendarById("ja.japanese#holiday@group.v.calendar.google.com").getEventsForDay(start);
    return events.length > 0;
  } catch(e) {
    return false;
  }
}

function setup_billingApproveNudgeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "cron_billingApproveNudge") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("cron_billingApproveNudge")
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log("billingApproveNudgeトリガー設定完了");
}