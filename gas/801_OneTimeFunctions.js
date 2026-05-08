

/**
 * Gmailバックフィルポインタをリセット
 * 手動実行: 801_DevTemp.gs → TEST_resetGmailBackfillPointer
 */
function TEST_resetGmailBackfillPointer() {
  PropertiesService.getScriptProperties().deleteProperty('_BACKFILL_GMAIL_POINTER');
  Logger.log('Gmail pointer reset done');
}

/** 302改修テスト: SourceCacheから正しくactivities構造が組み立てられるか確認 */
function TEST_collectFromSourceCache() {
  var projectId = "p23"; // BWE（データ量が多いはず）
  var ym = "202512";

  // 1) SourceCacheにデータあるか確認
  var rows = srcCache_listByProjectYm(projectId, ym);
  Logger.log("[1] SourceCache行数: " + (rows ? rows.length : 0));
  if (!rows || rows.length === 0) {
    Logger.log("→ データなし。先にバックフィルが必要");
    return;
  }

  // ソース別カウント
  var counts = {};
  for (var i = 0; i < rows.length; i++) {
    var src = String(rows[i].source || "unknown");
    counts[src] = (counts[src] || 0) + 1;
  }
  Logger.log("[2] ソース別: " + JSON.stringify(counts));

  // 2) mr_collectFromSourceCache_ で変換
  var activities = mr_collectFromSourceCache_(projectId, ym);
  if (!activities) {
    Logger.log("→ activities null");
    return;
  }
  Logger.log("[3] fromSourceCache: " + activities.fromSourceCache);
  Logger.log("[4] summary: " + JSON.stringify(activities.summary));

  // 3) 各ソースの中身サンプル
  if (activities.notion && activities.notion.pages && activities.notion.pages.length > 0) {
    var p = activities.notion.pages[0];
    Logger.log("[5] Notion sample: title=" + p.title + ", date=" + p.date + ", preview=" + String(p.content_preview || "").substring(0, 80));
  }
  if (activities.slack && activities.slack.messages && activities.slack.messages.length > 0) {
    var m = activities.slack.messages[0];
    Logger.log("[6] Slack sample: user=" + m.user_name + ", ts=" + m.timestamp_jst + ", text=" + String(m.text || "").substring(0, 80));
  }
  if (activities.gmail && activities.gmail.threads && activities.gmail.threads.length > 0) {
    var t = activities.gmail.threads[0];
    Logger.log("[7] Gmail sample: subject=" + t.subject + ", from=" + t.from);
  }
  if (activities.drive && activities.drive.files && activities.drive.files.length > 0) {
    var f = activities.drive.files[0];
    Logger.log("[8] Drive sample: name=" + f.name + ", type=" + f.file_type);
  }
}

/** SourceCacheにデータが多いPJ×ymを探す */
function TEST_findRichSourceCache() {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID"));
  var sh = ss.getSheetByName("DB_SourceCache");
  if (!sh || sh.getLastRow() < 2) { Logger.log("データなし"); return; }

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var iPid = headers.indexOf("projectId");
  var iYm = headers.indexOf("ym");
  var iSrc = headers.indexOf("source");

  var counts = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][iPid] || "") + "_" + String(data[i][iYm] || "");
    if (!counts[key]) counts[key] = { total: 0, sources: {} };
    counts[key].total++;
    var src = String(data[i][iSrc] || "");
    counts[key].sources[src] = (counts[key].sources[src] || 0) + 1;
  }

  // total降順で上位10件
  var sorted = Object.keys(counts).sort(function(a, b) { return counts[b].total - counts[a].total; });
  sorted.slice(0, 10).forEach(function(key) {
    Logger.log(key + ": " + counts[key].total + "件 " + JSON.stringify(counts[key].sources));
  });
}

/** 302改修テスト: SourceCache → 報告書生成まで一気通貫 */
function TEST_generateReportFromSourceCache() {
  var projectId = "p23";
  var ym = "202512";

  Logger.log("=== 報告書生成テスト（SourceCache経由） ===");

  var result = api_generateMonthlyReport(projectId, ym, false);

  Logger.log("success: " + result.success);
  Logger.log("fromSourceCache: " + (result.fromSourceCache || false));

  if (result.success) {
    Logger.log("reportId: " + result.reportId);
    Logger.log("token_usage: " + JSON.stringify(result.token_usage || {}));
    Logger.log("draft冒頭200字: " + String(result.draft || "").substring(0, 200));
  } else {
    Logger.log("error: " + result.error);
  }
}

function TEST_driveSourceCache() {
  cron_collectDriveToSourceCache();
}

function debug_runMeetingScheduleReminder() {
  var ym = tsuNowYmJst();
  var cycles = tsuReadTableNormalized("DB_BillingCycle").rows;
  var projects = tsuReadTableNormalized("DB_Projects").rows;
  var members = tsuSafeReadMembers();

  var projectById = {};
  for (var i = 0; i < projects.length; i++) {
    var pid = String(projects[i].projectId || "").trim();
    if (pid) projectById[pid] = projects[i];
  }
  var memberById = {};
  for (var i = 0; i < members.length; i++) {
    var mid = String(members[i].memberId || members[i].id || "").trim();
    if (mid) memberById[mid] = members[i];
  }

  var pending = [];
  for (var i = 0; i < cycles.length; i++) {
    var c = cycles[i];
    if (Number(c.ym || 0) !== ym) continue;
    if (String(c.meetingStartAt || "").trim()) continue;
    var pid = String(c.projectId || "").trim();
    var pj = projectById[pid];
    if (!pj) continue;
    if (String(pj.status || "").trim().toLowerCase() !== "active") continue;
    var pmMemberId = String(pj.pmMemberId || "").trim();
    var pm = pmMemberId ? (memberById[pmMemberId] || null) : null;
    var pmEmail = pm ? String(pm.email || "").trim() : "";
    pending.push({ projectId: pid, project: pj, cycle: c, pm: pm, pmEmail: pmEmail });
  }

  Logger.log("pending PJs: " + pending.length);
  pending.forEach(function(p) {
    Logger.log("  - " + p.projectId + " / pmEmail: " + p.pmEmail);
  });

  var now = new Date();
  var jst = new Date(now.getTime() + 9*60*60*1000);
  var y = jst.getUTCFullYear();
  var m = jst.getUTCMonth() + 1;
  var nextM = m + 1; var nextY = y;
  if (nextM > 12) { nextM = 1; nextY++; }
  var weekStart = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-01T00:00:00+09:00");
  var weekEnd   = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-08T00:00:00+09:00");

  var assignments = {};
  try {
    assignments = assignMeetingSlotsForPendingProjects_(pending, weekStart, weekEnd);
  } catch(e) {
    Logger.log("assignMeetingSlots error: " + e.message);
    return;
  }

  Logger.log("assignments:");
  for (var pid in assignments) {
    var a = assignments[pid];
    Logger.log("  " + pid + " -> " + Utilities.formatDate(a.start, "Asia/Tokyo", "M/d(EEE) HH:mm"));
  }

}

/**
 * DB_Issues / DB_Tasks をNAVIGATORスプシに自動生成する
 * 手動実行: setup_IssuesTasksSchema（801_OneTimeFunctions.gs）
 */
function setup_IssuesTasksSchema() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );

  // DB_Issues
  const issuesHeaders = [
    'issueId','projectId','milestoneId','title','description',
    'status','source','createdAtJst','updatedAtJst','resolvedAtJst'
  ];
  let sh = ss.getSheetByName('DB_Issues');
  if (!sh) sh = ss.insertSheet('DB_Issues');
  if (sh.getLastRow() === 0) sh.appendRow(issuesHeaders);
  Logger.log('DB_Issues: OK');

  // DB_Tasks
  const tasksHeaders = [
    'taskId','projectId','milestoneId','subItemId','title','description',
    'status','assignee','dueDate','source','createdAtJst','updatedAtJst'
  ];
  let sh2 = ss.getSheetByName('DB_Tasks');
  if (!sh2) sh2 = ss.insertSheet('DB_Tasks');
  if (sh2.getLastRow() === 0) sh2.appendRow(tasksHeaders);
  Logger.log('DB_Tasks: OK');
}

function createMacroTrendSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetWithHeaders_(ss, 'DB_MacroAlertConfig', [
    'configId', 'projectId', 'keyword', 'rssUrl', 'language', 'isActive', 'createdAt'
  ]);

  createSheetWithHeaders_(ss, 'DB_MacroTrendLog', [
    'logId', 'projectId', 'configId', 'fetchedAt', 'sourceUrl', 'title',
    'summaryLlm', 'relevanceScore', 'insightForProject',
    'status', 'promotedContextId', 'createdAt'
  ]);

  Logger.log('マクロトレンド関連シート作成完了');
}

function createSheetWithHeaders_(ss, name, headers) {
  if (ss.getSheetByName(name)) {
    Logger.log(name + ' はすでに存在するためスキップ');
    return;
  }
  const sheet = ss.insertSheet(name);
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
  Logger.log(name + ' を作成しました');
}

function debugMacroRss() {
  const url = 'https://www.google.co.jp/alerts/feeds/13101861648123074452/17894305832004799751';
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log('Status: ' + response.getResponseCode());
  Logger.log(response.getContentText().substring(0, 2000));
}

function setupMacroTrendTriggers() {
  const triggerFunctions = ['fetchMacroTrends', 'scoreMacroTrends'];
  
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  
  triggerFunctions.forEach(fnName => {
    if (existing.includes(fnName)) {
      Logger.log(`${fnName} のトリガーはすでに存在するためスキップ`);
      return;
    }
    ScriptApp.newTrigger(fnName)
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
    Logger.log(`${fnName} のトリガーを作成しました（毎日7時）`);
  });
}

function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((t, i) => {
    Logger.log(`${i + 1}: ${t.getHandlerFunction()} / ${t.getEventType()} / uid=${t.getUniqueId()}`);
  });
  Logger.log(`合計: ${triggers.length}件`);
}

function removeTsukuyomiNudgeTriggers() {
  const targets = [
    'tsukuyomi_collectAndJudgeNudges',
    'tsukuyomi_planDailyNudges',
    'tsukuyomi_mergePostedNudges',
    'tsukuyomi_runNudgePosterTick'
  ];
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(t => {
    if (targets.includes(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
      Logger.log(`削除: ${t.getHandlerFunction()}`);
      removed++;
    }
  });
  Logger.log(`合計${removed}件削除`);
}

function fix_deduplicateProgressRows() {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var sh = ss.getSheetByName("DB_MilestoneMonthlyProgress");
  if (!sh) { Logger.log("シートなし"); return; }

  var all = sh.getDataRange().getValues();
  var header = all[0];
  var iPj = header.indexOf("projectId");
  var iMsKey = header.indexOf("milestoneKey");
  var iYm = header.indexOf("ym");
  var iAt = header.indexOf("confirmedAtJst");

  var seen = {};
  var deleteRows = [];

  for (var r = 1; r < all.length; r++) {
    var key = [
      String(all[r][iPj] || "").trim(),
      String(all[r][iMsKey] || "").trim(),
      String(all[r][iYm] || "").trim()
    ].join("__");

    if (seen[key]) {
      var existAt = String(all[seen[key].row][iAt] || "");
      var curAt = String(all[r][iAt] || "");
      if (curAt >= existAt) {
        deleteRows.push(seen[key].rowNum);
        seen[key] = { row: r, rowNum: r + 1 };
      } else {
        deleteRows.push(r + 1);
      }
    } else {
      seen[key] = { row: r, rowNum: r + 1 };
    }
  }

  deleteRows.sort(function(a, b) { return b - a; });
  for (var i = 0; i < deleteRows.length; i++) {
    sh.deleteRow(deleteRows[i]);
  }
  Logger.log("重複削除: " + deleteRows.length + "行");
}

/** MS進捗サマリ全PJ×全月バックフィル（一回限り手動実行） */
function backfill_MsProgressSummary() {
  var projects = b_readTable_('DB_Projects').filter(function(p) {
    return String(p.status || '').toLowerCase() === 'active';
  });
  var cycles = b_readTable_('DB_BillingCycle');
  var ymSet = {};
  for (var i = 0; i < cycles.length; i++) {
    var pid = String(cycles[i].projectId || '').trim();
    var ym = String(cycles[i].ym || '').trim();
    if (!pid || !ym) continue;
    if (!ymSet[pid]) ymSet[pid] = [];
    if (ymSet[pid].indexOf(ym) < 0) ymSet[pid].push(ym);
  }
  var count = 0;
  for (var j = 0; j < projects.length; j++) {
    var projectId = String(projects[j].projectId || '').trim();
    if (!projectId || !ymSet[projectId]) continue;
    var yms = ymSet[projectId];
    for (var k = 0; k < yms.length; k++) {
      cockpit_updateMsProgressSummary_(projectId, yms[k]);
      count++;
    }
  }
  Logger.log('[backfill_MsProgressSummary] done: ' + count + ' cells');
}

function debug_bSs() {
  var ss = b_ss_();
  Logger.log(typeof ss);
  Logger.log(ss);
  Logger.log(Object.prototype.toString.call(ss));
}

function debug_updateMsProgressSummary() {
  var navSs = valuePlan_getDbSpreadsheet();
  var msSheet = navSs.getSheetByName('DB_ValueMilestones');
  Logger.log('msSheet: ' + msSheet);

  Logger.log('calling cpReadSheetAsTable_...');
  var msRows = cpReadSheetAsTable_(msSheet);
  Logger.log('msRows count: ' + msRows.length);

  Logger.log('calling b_ss_...');
  var sheet = b_ss_().getSheetByName('DB_BillingCycle');
  Logger.log('sheet: ' + sheet);

  var lastCol = sheet.getLastColumn();
  Logger.log('lastCol: ' + lastCol);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log('headers ok, length: ' + headers.length);
}

function debug_getPendingList() {
  var res = billing_budget_api_getPendingList();
  Logger.log(JSON.stringify(res));
}

function setup_addInvoiceYmHeader() {
  b_ensureBillingCycleHeader_();
  Logger.log('invoiceYm列追加完了');
}

function debug_checkMsProgressSummary() {
  // 1) DB_BillingCycleに保存されてるmsProgressSummaryJsonを確認
  var yms = ['202601','202602','202603'];
  var pid = 'p21';
  var map = cockpit_getBillingMap_(pid, yms);
  for (var i = 0; i < yms.length; i++) {
    var cycle = map[yms[i]];
    Logger.log('[BillingCycle ' + yms[i] + '] msProgressSummaryJson: ' + (cycle ? String(cycle.msProgressSummaryJson || '').substring(0, 300) : 'NO ROW'));
  }

  // 2) DB_MilestoneMonthlyProgressの生データ確認
  var progRows = rv2_readProgressForProjectYm(pid, '202603');
  Logger.log('[Progress 202603] rows: ' + progRows.length);
  for (var j = 0; j < Math.min(progRows.length, 5); j++) {
    Logger.log('  ms=' + progRows[j].milestoneKey + ' pct=' + progRows[j].progressPct + ' src=' + progRows[j].source);
  }

  // 3) 修正版: planCycle全体の最大値を取った場合
  var navSs = valuePlan_getDbSpreadsheet();
  var cycleRows = cpReadSheetAsTable_(navSs, 'DB_ValuePlanCycles');
  var planCycleId = null;
  for (var ci = 0; ci < cycleRows.length; ci++) {
    var cy = cycleRows[ci];
    if (String(cy.projectId || '').trim() === pid && String(cy.periodStartYm || '') <= '202603' && '202603' <= String(cy.periodEndYm || '')) {
      planCycleId = String(cy.planCycleId || '');
      break;
    }
  }
  Logger.log('[PlanCycle] id=' + planCycleId);

  if (planCycleId) {
    var allProg = rv2_readProgressForPlanCycle(planCycleId);
    Logger.log('[PlanCycle progress] total rows: ' + allProg.length);
    var maxMap = {};
    for (var k = 0; k < allProg.length; k++) {
      var pr = allProg[k];
      var prYm = String(pr.ym || '').trim();
      if (prYm > '202603') continue;
      var msKey = String(pr.milestoneKey || '');
      var pct = Number(pr.progressPct || 0);
      if (pct > (maxMap[msKey] || 0)) maxMap[msKey] = pct;
    }
    Logger.log('[MaxProgress for 202603] ' + JSON.stringify(maxMap));
  }
}
function removeReportGasTriggers() {
  var targets = [
    'cron_collectSourceCacheDaily',
    'fetchMacroTrends',
    'cron_collectDriveToSourceCache',
    'cron_syncProjectKnowledgeDaily',
    'run_slideGenCron',
    'scoreMacroTrends',
    'run_monthlyReportCron',
    'cron_syncProtocolCandidatesDaily'
  ];
  var triggers = ScriptApp.getProjectTriggers();
  var removed = [];
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (targets.indexOf(fn) >= 0) {
      ScriptApp.deleteTrigger(triggers[i]);
      removed.push(fn);
    }
  }
  Logger.log('[removeReportGasTriggers] removed: ' + removed.join(', '));
  return { ok: true, removed: removed };
}

function debug_exportScriptProperties() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var keys = Object.keys(props);
  keys.forEach(function(k) {
    Logger.log(k + ' = ' + props[k]);
  });
}

function exportPropsAsJson() {
  var src = PropertiesService.getScriptProperties().getProperties();
  var exclude = [
    'REIMBURSE_NOTIFY_QUEUE_JSON',
    'SLACK_INTERACTIVE_QUEUE_JSON',
    'COLLECTION_CACHE_ARCHIVE_FOLDER_ID'
  ];
  var dest = {};
  Object.keys(src).forEach(function(k) {
    if (exclude.indexOf(k) < 0) dest[k] = src[k];
  });
  Logger.log(JSON.stringify(dest));
}

function remove_codeRegistryCron() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cron_rebuildCodeRegistryDaily_") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  Logger.log("[CodeRegistry] removed " + removed + " trigger(s)");
  return { ok: true, removed: removed };
}

function test_updateMsProgressSummary() {
  // p21の全月を再計算
  var yms = ['202601','202602','202603'];
  for (var i = 0; i < yms.length; i++) {
    cockpit_updateMsProgressSummary_('p21', yms[i]);
    Logger.log('[done] ' + yms[i]);
  }
  // 再計算後の値を確認
  var map = cockpit_getBillingMap_('p21', yms);
  for (var j = 0; j < yms.length; j++) {
    var c = map[yms[j]];
    var json = c ? String(c.msProgressSummaryJson || '') : '';
    var parsed = json ? JSON.parse(json) : {};
    var items = parsed.items || [];
    var pcts = items.map(function(it){ return it.title.substring(0,6) + ':' + it.progressPct + '%'; });
    Logger.log('[' + yms[j] + '] ' + pcts.join(', '));
  }
}

// ============================================================
// MTG サマリ バックフィル
// 仕様: pwa/design/meeting_summaries.md
// ============================================================

/**
 * 指定 PJ × 期間 (yyyymm 範囲) の Notion 議事録をすべて Gemini で抽出して
 * Supabase project_meeting_summaries に upsert する one-time バックフィル。
 *
 * 使い方:
 *   GAS エディタで実行 (デフォルト引数 = SX = p21、過去 14 ヶ月) もしくは
 *   clasp run --params '["p21", "202504", "202605"]' oneTime_backfillMeetingSummaries
 *
 * @param {string} projectId AMD projectId (例: "p21")
 * @param {string} ymStart yyyymm (含む)
 * @param {string} ymEnd   yyyymm (含む)
 */
function oneTime_backfillMeetingSummaries(projectId, ymStart, ymEnd) {
  // GAS エディタ手動実行用のデフォルト
  if (!projectId) projectId = "p21";       // SX
  if (!ymStart)   ymStart   = "202503";    // 過去 14 ヶ月
  if (!ymEnd) {
    var d = new Date();
    var y = d.getFullYear();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    ymEnd = String(y) + String(m);
  }

  var ymList = _oneTime_buildYmList_(ymStart, ymEnd);
  Logger.log("[backfill] projectId=" + projectId + " range=" + ymStart + "-" + ymEnd + " (" + ymList.length + " months)");

  if (typeof nav_meeting_backfillForProject_ !== "function") {
    throw new Error("nav_meeting_backfillForProject_ missing (074_MeetingSummaryRepo.js)");
  }

  var result = nav_meeting_backfillForProject_(projectId, ymList);
  Logger.log("[backfill] done: " + JSON.stringify(result, null, 2));
  return result;
}

/**
 * 全 active/frozen PJ の MTG サマリを 1 ym ぶん抽出 (定期 cron 想定の手動 trigger)
 */
function oneTime_runMeetingExtractAllProjects(ymKey) {
  if (!ymKey) {
    var d = new Date();
    ymKey = String(d.getFullYear()) + ("0" + (d.getMonth() + 1)).slice(-2);
  }
  if (typeof nav_cron_listTargetProjectIds_ !== "function") {
    throw new Error("nav_cron_listTargetProjectIds_ missing");
  }
  var pids = nav_cron_listTargetProjectIds_();
  var out = { ym: ymKey, results: [] };
  for (var i = 0; i < pids.length; i++) {
    var pid = pids[i];
    try {
      var r = nav_meeting_extractForProjectYm_(pid, ymKey);
      out.results.push({ projectId: pid, processed: r.processed || 0, skipped: r.skipped || 0, errors: r.errors || 0, ok: !!r.ok, message: r.message || "" });
    } catch (e) {
      out.results.push({ projectId: pid, ok: false, message: String(e && e.message ? e.message : e) });
    }
  }
  Logger.log("[meetingExtractAll] " + JSON.stringify(out, null, 2));
  return out;
}

/** ym 範囲から ym 配列を生成 */
function _oneTime_buildYmList_(ymStart, ymEnd) {
  var out = [];
  var sy = Number(ymStart.slice(0, 4));
  var sm = Number(ymStart.slice(4, 6));
  var ey = Number(ymEnd.slice(0, 4));
  var em = Number(ymEnd.slice(4, 6));
  var y = sy;
  var m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(String(y) + ("0" + m).slice(-2));
    m++;
    if (m > 12) { y++; m = 1; }
  }
  return out;
}
