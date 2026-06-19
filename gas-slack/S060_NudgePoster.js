/** S060_NudgePoster.gs
 * つくよみNudge投稿。DB_TsukuyomiNudgeQueueのstatus=readyを投稿する。
 */

function nudge_getNavigatorSs_() {
  const id = utils_getProp_("NAVIGATOR_SPREADSHEET_ID");
  if (!id) throw new Error("NAVIGATOR_SPREADSHEET_ID missing");
  return SpreadsheetApp.openById(id);
}

function nudge_readQueue_() {
  const ss = nudge_getNavigatorSs_();
  const sh = ss.getSheetByName("DB_TsukuyomiNudgeQueue");
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return [];
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  const rows = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return rows.map((r, i) => {
    const obj = { _rowIndex: i + 2 };
    header.forEach((h, j) => { if (h) obj[h] = r[j]; });
    return obj;
  });
}

function nudge_updateQueueRow_(rowIndex, updates) {
  const ss = nudge_getNavigatorSs_();
  const sh = ss.getSheetByName("DB_TsukuyomiNudgeQueue");
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim());
  Object.keys(updates).forEach(key => {
    const col = header.indexOf(key);
    if (col >= 0) sh.getRange(rowIndex, col + 1).setValue(updates[key]);
  });
}

function nudge_runPosterTick() {
  const now = new Date();
  const jstHour = Number(Utilities.formatDate(now, "Asia/Tokyo", "H"));

  const rows = nudge_readQueue_();
  const readyRows = rows.filter(r => String(r.status || "") === "ready");

  if (!readyRows.length) return { ok: true, posted: 0 };

  let posted = 0;

  readyRows.forEach(row => {
    try {
      // 夜間（20〜8時）はメンション禁止
      const isNight = jstHour >= 20 || jstHour < 8;
      const channelId = String(row.channelId || row.slackChannelId || "").trim();
      if (!channelId) return;

      let text = String(row.nudgeText || row.body || "").trim();
      if (!text) return;

      // 夜間はメンション除去
      if (isNight) {
        text = text.replace(/<@[A-Z0-9]+>/g, "").trim();
      }

      slack_postMessage_(channelId, text);

      nudge_updateQueueRow_(row._rowIndex, {
        status: "posted",
        postedAt: utils_jstNow_()
      });

      posted++;
    } catch(e) {
      try {
        nudge_updateQueueRow_(row._rowIndex, {
          status: "error",
          errorNote: String(e && e.message ? e.message : e).slice(0, 200)
        });
      } catch(_e) {}
    }
  });

  return { ok: true, posted: posted };
}

function nudge_setupTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "nudge_runPosterTick") {
      ScriptApp.deleteTrigger(t);
    }
  });
  // 毎分トリガー
  ScriptApp.newTrigger("nudge_runPosterTick")
    .timeBased()
    .everyMinutes(1)
    .create();
}

// ================================================================
// 請求額確定リマインド（固定PJ向け）
// ================================================================
function cron_nudgeBudgetReminder() {
  return { ok: true, disabled: true, reason: "monthly routine budget reminder abolished 2026-06-19" };

  var todayDay = Number(Utilities.formatDate(new Date(), "Asia/Tokyo", "d"));
  var remindDay = nudgeBudget_getRemindDay_();
  if (!remindDay || todayDay !== remindDay) return { ok: true, skipped: true, reason: "not remind day" };

  var now = new Date();
  var dow = Number(Utilities.formatDate(now, "Asia/Tokyo", "u"));
  if (dow >= 6) return { ok: true, skipped: true, reason: "weekend" };
  if (nudgeBudget_isHoliday_(now)) return { ok: true, skipped: true, reason: "holiday" };

  var ym = utils_nowYmJst_();
  var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));

  var pjSheet = navSs.getSheetByName("DB_Projects");
  if (!pjSheet || pjSheet.getLastRow() < 2) return { ok: true, posted: 0 };
  var pjData = pjSheet.getDataRange().getValues();
  var pjH = pjData[0].map(function(x){ return String(x||"").trim(); });
  var iPjId = pjH.indexOf("projectId");
  var iPjName = pjH.indexOf("projectName");
  var iFeeType = pjH.indexOf("feeType");
  var iSlack = pjH.indexOf("slackChannelId");
  var iNudge = pjH.indexOf("tsukuyomiNudgeEnabled");
  var iStatus = pjH.indexOf("status");

  var bcSheet = navSs.getSheetByName("DB_BillingCycle");
  var confirmedMap = {};
  if (bcSheet && bcSheet.getLastRow() >= 2) {
    var bcData = bcSheet.getDataRange().getValues();
    var bcH = bcData[0].map(function(x){ return String(x||"").trim(); });
    var iBcPj = bcH.indexOf("projectId");
    var iBcYm = bcH.indexOf("ym");
    var iBcSt = bcH.indexOf("status");
    for (var i = 1; i < bcData.length; i++) {
      if (utils_normYm_(bcData[i][iBcYm]) !== ym) continue;
      var st = String(bcData[i][iBcSt]||"").trim();
      if (st === "reported" || st === "budget_confirmed" || st === "allocation_confirmed") {
        confirmedMap[String(bcData[i][iBcPj]||"").trim()] = true;
      }
    }
  }

  var systemPrompt = nudgeBudget_getSystemPrompt_();
  var ymLabel = ym.slice(0,4) + "年" + parseInt(ym.slice(4)) + "月";
  var posted = 0;

  for (var r = 1; r < pjData.length; r++) {
    var row = pjData[r];
    var projectId = String(row[iPjId]||"").trim();
    if (!projectId) continue;
    if (String(row[iStatus]||"").trim().toLowerCase() !== "active") continue;
    if (String(row[iNudge]||"").trim().toLowerCase() !== "true") continue;
    var feeType = String(row[iFeeType]||"").trim().toLowerCase();
    if (feeType !== "fixed" && feeType !== "monthly_fixed") continue;
    var channelId = String(row[iSlack]||"").trim();
    if (!channelId) continue;
    if (confirmedMap[projectId]) continue;

    var pjName = String(row[iPjName]||"").trim();
    var userPrompt = "プロジェクト名: " + pjName + "\n対象月: " + ymLabel + "\n状況: 請求額がまだ申告されていない";

    try {
      var text = llm_call_(systemPrompt, userPrompt, { maxTokens: 300, temperature: 0.9 });
      if (text) {
        slack_postMessage_(channelId, text);
        posted++;
      }
    } catch(e) {
      Logger.log("nudgeBudgetReminder error [" + projectId + "]: " + e.message);
    }
  }

  return { ok: true, posted: posted };
}

function nudgeBudget_getRemindDay_() {
  try {
    var adminSsId = utils_getProp_("ADMIN_SPREADSHEET_ID");
    if (!adminSsId) return 25;
    var sheet = SpreadsheetApp.openById(adminSsId).getSheetByName("DB_Settings");
    if (!sheet || sheet.getLastRow() < 2) return 25;
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(x){ return String(x||"").trim(); });
    var iKey = headers.indexOf("settingKey");
    var iVal = headers.indexOf("settingValue");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iKey]||"").trim() === "nudge_reminder_day") {
        return Number(data[i][iVal]) || 25;
      }
    }
    return 25;
  } catch(e) {
    return 25;
  }
}

function nudgeBudget_getSystemPrompt_() {
  try {
    var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));
    var sheet = navSs.getSheetByName("DB_TsukuyomiContext");
    if (!sheet || sheet.getLastRow() < 2) return nudgeBudget_defaultPrompt_();
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(x){ return String(x||"").trim(); });
    var iTags = headers.indexOf("tags");
    var iContent = headers.indexOf("content");
    var iStatus = headers.indexOf("status");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iStatus]||"").trim() !== "active") continue;
      var tags = String(data[i][iTags]||"").split(",").map(function(t){ return t.trim(); });
      if (tags.indexOf("budget_remind") >= 0) {
        return String(data[i][iContent]||"").trim() || nudgeBudget_defaultPrompt_();
      }
    }
    return nudgeBudget_defaultPrompt_();
  } catch(e) {
    return nudgeBudget_defaultPrompt_();
  }
}

function nudgeBudget_isHoliday_(date) {
  try {
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var events = CalendarApp.getCalendarById("ja.japanese#holiday@group.v.calendar.google.com").getEventsForDay(start);
    return events.length > 0;
  } catch(e) {
    return false;
  }
}

function setup_nudgeBudgetReminderTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "cron_nudgeBudgetReminder") {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log("nudgeBudgetReminder disabled; removed triggers=" + removed);
  return { ok: true, disabled: true, removed: removed };
}

function nudgeBudget_getRemindDay_() {
  try {
    var adminSsId = utils_getProp_("ADMIN_SPREADSHEET_ID");
    if (!adminSsId) return 25; // デフォルト25日
    var sheet = SpreadsheetApp.openById(adminSsId).getSheetByName("DB_Settings");
    if (!sheet || sheet.getLastRow() < 2) return 25;
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(x){ return String(x||"").trim(); });
    var iKey = headers.indexOf("settingKey");
    var iVal = headers.indexOf("settingValue");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iKey]||"").trim() === "nudge_budget_remind_day") {
        return Number(data[i][iVal]) || 25;
      }
    }
    return 25;
  } catch(e) {
    return 25;
  }
}

function nudgeBudget_getText_() {
  try {
    var navSs = SpreadsheetApp.openById(utils_getProp_("NAVIGATOR_SPREADSHEET_ID"));
    var sheet = navSs.getSheetByName("DB_TsukuyomiContext");
    if (!sheet || sheet.getLastRow() < 2) return nudgeBudget_defaultText_();
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(x){ return String(x||"").trim(); });
    var iTags = headers.indexOf("tags");
    var iContent = headers.indexOf("content");
    var iStatus = headers.indexOf("status");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iStatus]||"").trim() !== "active") continue;
      var tags = String(data[i][iTags]||"").split(",").map(function(t){ return t.trim(); });
      if (tags.indexOf("budget_remind") >= 0) {
        return String(data[i][iContent]||"").trim() || nudgeBudget_defaultText_();
      }
    }
    return nudgeBudget_defaultText_();
  } catch(e) {
    return nudgeBudget_defaultText_();
  }
}

function nudgeBudget_defaultText_() {
  return "🌙 {ym}の請求額をOSから申告してください。コックピットの「請求額確定」から入力できます！";
}

function nudgeBudget_isHoliday_(date) {
  try {
    var calId = "ja.japanese#holiday@group.v.calendar.google.com";
    var start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var events = CalendarApp.getCalendarById(calId).getEventsForDay(start);
    return events.length > 0;
  } catch(e) {
    return false;
  }
}

function setup_nudgeBudgetReminderTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "cron_nudgeBudgetReminder") {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log("nudgeBudgetReminder disabled; removed triggers=" + removed);
  return { ok: true, disabled: true, removed: removed };
}
