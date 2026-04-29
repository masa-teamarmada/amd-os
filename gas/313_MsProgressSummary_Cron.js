// 313_MsProgressSummary_Cron.gs
// MS進捗サマリ（msProgressSummaryJson）とrewardSummaryキャッシュの日次更新

function run_msProgressSummaryCron() {
  return cron_updateMsProgressSummaryDaily_();
}

function cron_updateMsProgressSummaryDaily_() {
  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var cycleSheet = navSs.getSheetByName("DB_ValuePlanCycles");
  if (!cycleSheet) return { ok: false, message: "DB_ValuePlanCycles not found" };
  var cycleAll = cycleSheet.getDataRange().getValues();
  var cycleHdr = cycleAll[0];
  var iPid = cycleHdr.indexOf("projectId");
  var iStart = cycleHdr.indexOf("periodStartYm");
  var iEnd = cycleHdr.indexOf("periodEndYm");
  var iStatus = cycleHdr.indexOf("status");

  var count = 0;
  for (var r = 1; r < cycleAll.length; r++) {
    var row = cycleAll[r];
    if (String(row[iStatus] || "").trim() !== "fixed") continue;
    var pid = String(row[iPid] || "").trim();
    if (!pid) continue;
    var startYm = String(row[iStart] || "").trim();
    var endYm = String(row[iEnd] || "").trim();
    if (!startYm || !endYm) continue;

    var sY = parseInt(startYm.substring(0, 4), 10);
    var sM = parseInt(startYm.substring(4, 6), 10);
    var eY = parseInt(endYm.substring(0, 4), 10);
    var eM = parseInt(endYm.substring(4, 6), 10);

    var y = sY, m = sM;
    while (y < eY || (y === eY && m <= eM)) {
      var ym = String(y) + String(m).padStart(2, '0');
      try {
        cockpit_updateMsProgressSummary_(pid, ym);
        cockpit_updateRewardSummaryCache_(pid, ym);
        count++;
      } catch(e) {
        Logger.log('[cron_updateMsProgressSummaryDaily_] ' + pid + '/' + ym + ': ' + e);
      }
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  Logger.log('[cron_updateMsProgressSummaryDaily_] done: ' + count + ' ym-entries');
  return { ok: true, count: count };
}

function setup_msProgressSummaryCron() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'run_msProgressSummaryCron') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('run_msProgressSummaryCron')
    .timeBased()
    .atHour(5)
    .nearMinute(30)
    .everyDays(1)
    .create();
  Logger.log('[setup_msProgressSummaryCron] trigger created at 5:30');
  return { ok: true };
}