/** R313_MonthlyReport_Cron.gs
 * 役割：
 * - 毎日5時（JST）：当月分の月次報告書を全activeなPJについて再生成
 *   ※ L1(316_SourceCacheCron 3:10)完了後に走る。302がSourceCacheから読む。
 * - 手動バックフィル：全PJ×全期間で未生成分を順次埋める（6分制限内で打ち切り）
 *
 * 公開関数：
 * - run_monthlyReportCron() / cron_generateMonthlyReportsDaily_()  … 日次トリガー
 * - admin_backfillMonthlyReports()        … 手動バックフィル
 * - setup_monthlyReportCronAt5()          … トリガー設定（旧setup_monthlyReportCronAt3は廃止）
 *
 * 旧セクションC（キャッシュアーカイブ）はDB_SourceCache移行により廃止。
 */

// ===== A. 毎日3時トリガー =====

/**
 * 当月分の月次報告書を全activeなPJについて再生成する。
 * BillingCycleに当月行があるPJのみ対象。
 * forceRecollect=true で Slack/Notion/Drive を再収集して最新化。
 */
/**
 * 日次トリガー（毎日3時JST）
 * 全activeなPJ × 当月ymについて：
 *  1. 過去24h差分を収集
 *  2. 差分ゼロ → スキップ（LLM呼ばない）
 *  3. 差分あり＋既存報告書あり → 差分更新（mr_generateDraftUpdate_）
 *  4. 差分あり＋既存報告書なし → 月全体で新規生成（api_generateMonthlyReport）
 */
/** 手動で一回だけ実行：月次報告書の日次トリガーを5時台に設定（L1完了後） */
function setup_monthlyReportCronAt5(){
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++){
    if (triggers[i].getHandlerFunction() === "run_monthlyReportCron"){
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 5時：1回目
  ScriptApp.newTrigger("run_monthlyReportCron")
    .timeBased()
    .atHour(5)
    .everyDays(1)
    .create();
  // 5時20分相当：2回目（1回目で処理しきれなかった分を拾う）
  ScriptApp.newTrigger("run_monthlyReportCron")
    .timeBased()
    .atHour(5)
    .nearMinute(20)
    .everyDays(1)
    .create();
  Logger.log("[setup_monthlyReportCronAt5] 2 triggers created (5:00 + 5:20)");
  return { ok: true };
}

/** トリガーから呼ばれるラッパー（末尾_なし） */
function run_monthlyReportCron(){
  return cron_generateMonthlyReportsDaily_();
}
function cron_generateMonthlyReportsDaily_(){
  var start = Date.now();
  var LIMIT_MS = 5 * 60 * 1000;

  var now = new Date();
  var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  var currentYm = String(yesterday.getFullYear()) + String(yesterday.getMonth() + 1).padStart(2, "0");
  var todayCutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();

  var projects = _mrCron_listActiveProjectsWithYm_();
  var results = [];

  for (var i = 0; i < projects.length; i++){
    if (Date.now() - start > LIMIT_MS){
      results.push({ status: "timeout", remaining: projects.length - i });
      break;
    }

    var pj = projects[i];
    var pid = pj.projectId;

    if (pj.startYm && pj.startYm > currentYm) continue;
    if (pj.endYm && pj.endYm < currentYm) continue;

    try {
      var cycle = b_getCycleOne_(pid, currentYm);
      if (!cycle) {
        results.push({ projectId: pid, ym: currentYm, status: "no_cycle" });
        continue;
      }
    } catch(e){
      results.push({ projectId: pid, ym: currentYm, status: "cycle_error", error: String(e) });
      continue;
    }

    var existingReport = null;
    try {
      existingReport = mr_repo_getByProjectYm_(pid, currentYm);
      if (existingReport && existingReport.updatedAt && String(existingReport.updatedAt) > todayCutoff){
        results.push({ projectId: pid, ym: currentYm, status: "already_updated_today" });
        continue;
      }
    } catch(e){}

    if (!existingReport || !existingReport.draftContent) {
      try {
        var genRes = api_generateMonthlyReport(pid, currentYm, true);
        if (genRes && genRes.success) {
          _mrCron_updateMeta_(pid, currentYm, "generated", genRes.activities);
        }
        results.push({
          projectId: pid,
          ym: currentYm,
          status: (genRes && genRes.success) ? "generated" : "gen_failed",
          error: (genRes && !genRes.success) ? String(genRes.error || "") : ""
        });
      } catch(e){
        results.push({ projectId: pid, ym: currentYm, status: "gen_error", error: String(e) });
      }
      continue;
    }

    var delta;
    try {
      delta = mr_collectDeltaActivities_(pid, currentYm);
    } catch(e){
      results.push({ projectId: pid, ym: currentYm, status: "collect_error", error: String(e) });
      continue;
    }

    if (!delta || !delta.summary || delta.summary.total_items === 0){
      results.push({ projectId: pid, ym: currentYm, status: "no_delta" });
      continue;
    }

    try {
      var notionPages = (delta && delta.notion && delta.notion.pages) ? delta.notion.pages : [];
      if (notionPages.length > 0) {
        var storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
        if (storeId) {
          var runId = Utilities.getUuid().replace(/-/g, "");
          var startedAt = _mrCron_jstNow_();
          notionPages.forEach(function(enrichedPage) {
            try {
              var text = String(enrichedPage.content_preview || "").trim();
              if (text.length < 10) return;
              var extracted = _openai_extractProtocolCandidates_(text, {
                pageId: enrichedPage.id,
                lastEdited: String(enrichedPage.last_edited_time || ""),
                contextText: "",
                projectId: pid,
                issueTags: [],
                groupName: "protocol_extract"
              });
              var rows = (Array.isArray(extracted) ? extracted : []).map(function(c) {
                return {
                  candidateId: Utilities.getUuid().replace(/-/g, ""),
                  candidateKey: _pc_hashKey_(enrichedPage.id, String(c.branch_point || ""), String(c.condition || "")),
                  sourceType: "notion",
                  sourcePageId: enrichedPage.id,
                  sourceLastEditedAt: _toJstLabel_(String(enrichedPage.last_edited_time || "")),
                  suggestedProjectId: pid,
                  suggestedProjectName: pid,
                  suggestedTags: Array.isArray(c.tags) ? c.tags.join(",") : "",
                  branchPoint: String(c.branch_point || "").trim(),
                  criteria: String(c.condition || "").trim(),
                  optionsJson: "[]",
                  decision: String(c.action || "").trim(),
                  evidenceJson: JSON.stringify(Array.isArray(c.evidence_snippets) ? c.evidence_snippets : []),
                  confidence: String(c.confidence || ""),
                  status: "new", promotedProtocolId: "", runId: runId, createdAt: startedAt, updatedAt: startedAt,
                  injectedContextIds: "[]", injectedContextDigest: "", promptVersion: "v3_ctx1",
                  feedbackRating: "", feedbackComment: "", feedbackBy: "", feedbackAt: ""
                };
              }).filter(function(r) { return r.branchPoint && r.criteria; });
              if (rows.length > 0) _pc_appendCandidatesDedupe_(storeId, rows);
            } catch(e) {
              Logger.log("[cron protocol extract] " + enrichedPage.id + ": " + e);
            }
          });
        }
      }
    } catch(e) {
      Logger.log("[cron protocol extract] " + e);
    }

    try {
      var baseContent = (existingReport.pendingDraftContent && existingReport.pendingStatus === "pending")
        ? existingReport.pendingDraftContent
        : existingReport.draftContent;
      var updateRes = mr_generateDraftUpdate_(pid, currentYm, baseContent, delta);
      if (updateRes && updateRes.success) {
        mr_repo_savePending_(pid, currentYm, updateRes.draft, delta);
        var deltaCount = (delta && delta.summary) ? delta.summary.total_items : 0;
        results.push({ projectId: pid, ym: currentYm, status: "pending", deltaItems: deltaCount });
      } else {
        results.push({ projectId: pid, ym: currentYm, status: "update_failed", error: String(updateRes.error || "") });
      }
    } catch(e){
      results.push({ projectId: pid, ym: currentYm, status: "update_error", error: String(e) });
    }
  }

  _mrCron_logResults_(currentYm, results);

  // Slack投稿
  var elapsedSec = Math.round((Date.now() - start) / 1000);
  try {
    cronReport_postL2Summary_(currentYm, results, elapsedSec);
  } catch(e) {
    Logger.log("[cron_generateMonthlyReportsDaily_] Slack report error: " + e);
  }

  try {
    cron_progressEstimateDaily_();
  } catch(e) {
    Logger.log("[cron_generateMonthlyReportsDaily_] 推定チェーンエラー: " + e);
  }

  return { ok: true, currentYm: currentYm, results: results };
}

/**
 * cron結果をDB_AdminActionLogに記録
 */
function _mrCron_logResults_(ym, results){
  try {
    var now = new Date();
    var ts = now.getFullYear() + "年"
      + (now.getMonth()+1) + "月"
      + now.getDate() + "日 "
      + String(now.getHours()).padStart(2,"0") + ":"
      + String(now.getMinutes()).padStart(2,"0") + ":"
      + String(now.getSeconds()).padStart(2,"0");

    var summary = {};
    for (var i = 0; i < results.length; i++){
      var s = results[i].status || "unknown";
      summary[s] = (summary[s] || 0) + 1;
    }

    var details = results.map(function(r){
      var line = (r.projectId || "?") + ": " + (r.status || "?");
      if (r.error) line += " (" + r.error.substring(0, 80) + ")";
      return line;
    }).join("\n");

    var sh = getSheet_("DB_AdminActionLog");
    var header = ensureHeader_(sh, ["timestamp","action","actor","target","detail"]);
    var row = [];
    row[header.indexOf("timestamp")] = ts;
    row[header.indexOf("action")]    = "monthlyReportCron";
    row[header.indexOf("actor")]     = "system";
    row[header.indexOf("target")]    = ym;
    row[header.indexOf("detail")]    = JSON.stringify(summary) + "\n---\n" + details;
    sh.appendRow(row);
  } catch(e){
    Logger.log("[_mrCron_logResults_] ログ記録失敗: " + e);
  }
}

/** cron後にメタ情報だけ上書き（新規生成はapi_generateMonthlyReportが先に保存するため） */
function _mrCron_updateMeta_(projectId, ym, updateType, activities) {
  try {
    var sh = getSheet_("DB_MonthlyReports");
    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var iRid = header.indexOf("reportId");
    var iType = header.indexOf("lastUpdateType");
    var iItems = header.indexOf("lastDeltaItems");
    var iCron = header.indexOf("lastCronAt");
    if (iType === -1 || iItems === -1 || iCron === -1) return;

    var rid = "MR_" + projectId + "_" + ym;
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][iRid] || "") === rid) {
        var totalItems = (activities && activities.summary) ? activities.summary.total_items : 0;
        sh.getRange(i + 1, iType + 1).setValue(updateType);
        sh.getRange(i + 1, iItems + 1).setValue(String(totalItems));
        sh.getRange(i + 1, iCron + 1).setValue(_mrCron_jstNow_());
        return;
      }
    }
  } catch (e) {
    Logger.log("[_mrCron_updateMeta_] " + e);
  }
}

/** JST現在時刻を yyyy-mm-dd HH:MM:SS で返す */
function _mrCron_jstNow_() {
  var now = new Date();
  return now.getFullYear() + "-"
    + String(now.getMonth() + 1).padStart(2, "0") + "-"
    + String(now.getDate()).padStart(2, "0") + " "
    + String(now.getHours()).padStart(2, "0") + ":"
    + String(now.getMinutes()).padStart(2, "0") + ":"
    + String(now.getSeconds()).padStart(2, "0");
}

// ===== B. 手動バックフィル =====

/**
 * 全activeなPJ × startYm〜当月の全ymを走査し、
 * DB_MonthlyReportsに行がない分だけ生成する。
 * 6分制限内で処理できる分だけ処理して止まる。
 * 次回実行時は生成済み分をスキップするので、何回か回せば全量埋まる。
 */
function admin_backfillMonthlyReports(){
  if (!isAdmin_()) return { ok: false, message: "admin only" };

  var start = Date.now();
  var LIMIT_MS = 5 * 60 * 1000;

  var projects = _mrCron_listActiveProjectsWithYm_();
  var now = new Date();
  var currentYm = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");

  var generated = 0;
  var skipped = 0;
  var errors = 0;
  var timedOut = false;
  var lastProcessed = "";

  for (var i = 0; i < projects.length; i++){
    if (timedOut) break;

    var pj = projects[i];
    var pid = pj.projectId;
    var sYm = pj.startYm;

    if (!sYm) {
      skipped++;
      continue;
    }

    // endYmがあればそちら、なければ当月が上限
    var eYm = pj.endYm;
    if (!eYm || eYm > currentYm) eYm = currentYm;

    var yms = _mrCron_rangeYmKeys_(sYm, eYm);

    for (var j = 0; j < yms.length; j++){
      if (Date.now() - start > LIMIT_MS){
        timedOut = true;
        break;
      }

      var ym = yms[j];

      // DB_MonthlyReportsに既にあるか
      try {
        var existing = mr_repo_getByProjectYm_(pid, ym);
        if (existing) {
          skipped++;
          continue;
        }
      } catch(e){
        // 取得エラーは「未生成」扱いにして生成を試みる
      }

      // BillingCycleに行があるか（対象期間内の確認）
      try {
        var cycle = b_getCycleOne_(pid, ym);
        if (!cycle){
          skipped++;
          continue;
        }
      } catch(e){
        skipped++;
        continue;
      }

      // 生成（forceRecollect=false：バックフィルなのでキャッシュ優先）
      try {
        var res = api_generateMonthlyReport(pid, ym, false);
        if (res && res.success){
          generated++;
          lastProcessed = pid + "_" + ym;
          // レートリミット回避：生成成功後70秒待つ（10k tokens/min制限）
          Utilities.sleep(70000);
        } else {
          errors++;
        }
      } catch(e){
        errors++;
      }
    }
  }

  return {
    ok: true,
    generated: generated,
    skipped: skipped,
    errors: errors,
    timedOut: timedOut,
    lastProcessed: lastProcessed
  };
}

/**
 * 全activeなPJ × 全ymの月次報告書を強制再生成（既存も上書き）。
 * 6分制限内で処理できる分だけ処理して止まる。何回か回せば全量埋まる。
 */
function admin_forceRegenerateAllMonthlyReports() {
  if (!isAdmin_()) return { ok: false, message: "admin only" };

  var start = Date.now();
  var LIMIT_MS = 5 * 60 * 1000;

  var projects = _mrCron_listActiveProjectsWithYm_();
  var now = new Date();
  var currentYm = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");

  var generated = 0;
  var skipped = 0;
  var errors = 0;
  var timedOut = false;
  var lastProcessed = "";

  for (var i = 0; i < projects.length; i++) {
    if (timedOut) break;

    var pj = projects[i];
    var pid = pj.projectId;
    var sYm = pj.startYm;
    if (!sYm) { skipped++; continue; }

    var eYm = pj.endYm;
    if (!eYm || eYm > currentYm) eYm = currentYm;

    var yms = _mrCron_rangeYmKeys_(sYm, eYm);

    for (var j = 0; j < yms.length; j++) {
      if (Date.now() - start > LIMIT_MS) { timedOut = true; break; }

      var ym = yms[j];

      // 強制再生成（forceRecollect=true）
      try {
        var res = api_generateMonthlyReport(pid, ym, true);
        if (res && res.success) {
          generated++;
          lastProcessed = pid + "_" + ym;
          Utilities.sleep(70000);
        } else {
          errors++;
        }
      } catch(e) {
        errors++;
        Logger.log("[admin_forceRegenerateAllMonthlyReports] " + pid + "_" + ym + ": " + e);
      }
    }
  }

  return {
    ok: true,
    generated: generated,
    skipped: skipped,
    errors: errors,
    timedOut: timedOut,
    lastProcessed: lastProcessed
  };
}

// ===== 内部ユーティリティ =====

/**
 * activeなPJ一覧（startYm/endYm付き）
 * 084_TimelineSeedOps.gs の _tlSeed_listActiveProjectsWithYm_ と同じロジック。
 * 依存を切るためにローカルコピー。
 */
function _mrCron_listActiveProjectsWithYm_(){
  var sh = getSheet_("DB_Projects");
  var header = ensureHeader_(sh, ["projectId","status","startYm","endYm"]);
  var iPid    = header.indexOf("projectId");
  var iStatus = header.indexOf("status");
  var iStart  = header.indexOf("startYm");
  var iEnd    = header.indexOf("endYm");

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var vals = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var out = [];

  for (var i = 0; i < vals.length; i++){
    var row = vals[i];
    var pid = String(row[iPid] || "").trim();
    var st  = String(row[iStatus] || "").trim().toLowerCase();
    if (!pid || st !== "active") continue;

    var sYm = String(row[iStart] || "").trim();
    var eYm = String(row[iEnd] || "").trim();
    if (sYm && !/^\d{6}$/.test(sYm)) sYm = "";
    if (eYm && !/^\d{6}$/.test(eYm)) eYm = "";

    out.push({ projectId: pid, startYm: sYm, endYm: eYm });
  }
  return out;
}

/**
 * ym範囲生成（084と同じロジックのローカルコピー）
 */
function _mrCron_rangeYmKeys_(startYm, endYm){
  var a = String(startYm || "").trim();
  var b = String(endYm || "").trim();
  if (!/^\d{6}$/.test(a) || !/^\d{6}$/.test(b)) return [];
  if (a > b) return [];

  var out = [];
  var cur = a;
  while (cur <= b){
    out.push(cur);
    var y = Number(cur.slice(0, 4));
    var m = Number(cur.slice(4, 6));
    var d = new Date(y, m, 1); // mは0-indexed → m=次月
    cur = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, "0");
  }
  return out;
}

// ===== C. 旧キャッシュアーカイブ（廃止） =====
// DB_SourceCache移行により DB_MonthlyCollectionCache は不要。
// 下記3関数は互換のため残すが、新規トリガーは設定しない。
// 既存トリガーがあればsetup_monthlyReportCronAt5実行時に手動削除すること。

/** @deprecated DB_SourceCache移行により廃止 */
function setup_collectionCacheArchiveCron() {
  Logger.log("[DEPRECATED] setup_collectionCacheArchiveCron は廃止。DB_SourceCacheに移行済み");
  return { ok: false, message: "deprecated: use DB_SourceCache" };
}

/** @deprecated */
function run_collectionCacheArchive() {
  Logger.log("[DEPRECATED] run_collectionCacheArchive は廃止");
  return { ok: false, message: "deprecated" };
}

/** @deprecated */
function cron_archiveCollectionCache_() {
  Logger.log("[DEPRECATED] cron_archiveCollectionCache_ は廃止");
  return { ok: false, message: "deprecated" };
}