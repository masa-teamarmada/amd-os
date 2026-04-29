/**
 * 060_RewardV2_Estimator.gs
 * つくよみによるprogress自動推定（pending delta方式）
 *
 * 入力ソース（使えるものを全部使う）:
 *   1. DB_MonthlyReports（月次報告書テキスト）
 *   2. DB_ProgressEvents（イベント履歴）
 *   3. 差分データ（Notion/Slack/Gmail/Drive の直近24h）
 *
 * 出力:
 *   - DB_MilestoneProgressPending（source=tsukuyomi_estimate, status=pending）
 *   - PMが確認後 → DB_MilestoneMonthlyProgress へ反映
 *
 * R値（responsibility）は推定しない。マスタとしてコックピットで管理。
 *
 * 依存:
 *   - 090_OpenAIClient.gs（LLM呼び出し）
 *   - 058_RewardV2_Repo.gs（pending upsert, progress read）
 *   - 086_ValuePlanRepo.gs（MS/Cycle取得）
 *   - 302_MonthlyReport_Collector.gs（差分収集）
 */

// ===== メインAPI =====

/**
 * 指定PJ×ymの進捗を複数ソースから推定し、本テーブルに書き込む
 * @param {string} projectId
 * @param {string} ym  yyyymm
 * @param {boolean} fullScan  trueなら月全体、falseなら直近24h差分のみ
 * @return {Object} { ok, savedProgress, sources }
 */
function rv2_estimateFromSources(projectId, ym, fullScan) {
  var pid = String(projectId || "").trim();
  var sym = String(ym || "").trim();
  if (!pid || !sym) return { ok: false, message: "projectId/ym必須" };

  if (fullScan === undefined || fullScan === null) {
    var existing = rv2_readProgressForProjectYm(pid, sym);
    fullScan = (!existing || existing.length === 0);
  }

  var planInfo = rv2_est_getPlanInfo_(pid);
  if (!planInfo) return { ok: false, message: "fixed planCycleなし" };

  var members = rv2_est_getMembers_(pid);

  var currentProgress = rv2_readProgressForProjectYm(pid, sym);
  var currentMap = {};
  for (var i = 0; i < currentProgress.length; i++) {
    currentMap[String(currentProgress[i].milestoneKey || "")] = {
      pct: Number(currentProgress[i].progressPct || 0),
      source: String(currentProgress[i].source || "")
    };
  }

  var prevYm = rv2_est_prevYm_(sym);
  var prevProgress = rv2_readProgressForProjectYm(pid, prevYm);
  var prevMap = {};
  for (var i = 0; i < prevProgress.length; i++) {
    prevMap[String(prevProgress[i].milestoneKey || "")] = Number(prevProgress[i].progressPct || 0);
  }

  var sourceTexts = [];
  var sourceNames = [];

  // 月次報告書は進捗推定のソースから除外（一次情報から独立蒸留する設計）
  // rv2_est_getReportText_ は使わない

  var eventsText = rv2_est_getEventsText_(pid, sym);
  if (eventsText) {
    sourceTexts.push("## 進捗イベント履歴\n" + eventsText);
    sourceNames.push("events");
  }

  var activityText = fullScan
    ? rv2_est_getFullActivityText_(pid, sym)
    : rv2_est_getDeltaText_(pid, sym);
  Logger.log("[estimate] fullScan=" + fullScan + " activityText.length=" + (activityText ? activityText.length : 0));
  Logger.log("[estimate] activityText meetingTitles=" + (activityText ? activityText.match(/### 会議記録:[^\n]*/g) : []));
  Logger.log("[estimate] 3/3 content=" + (activityText ? activityText.substring(activityText.indexOf('sx-int'), activityText.indexOf('sx-int') + 500) : 'not found'));
  if (activityText) {
    sourceTexts.push(fullScan
      ? "## 今月の活動（Notion/Slack/Gmail/Drive）\n" + activityText
      : "## 直近の活動（Notion/Slack/Gmail/Drive）\n" + activityText);
    sourceNames.push(fullScan ? "activity_full" : "activity_delta");
  }

  if (sourceTexts.length === 0) {
    return { ok: false, message: "推定ソースなし（報告書・イベント・差分データすべて空）" };
  }

  var sourcesStr = sourceNames.join(",");

  var prompt = rv2_est_buildPrompt_v2_(sourceTexts.join("\n\n"), planInfo, members, prevMap, currentMap, sym);

  var raw = rv2_est_callLLM_(prompt);
  Logger.log("[estimate] LLM raw=" + (raw ? raw.substring(0, 2000) : "null"));
  if (!raw) return { ok: false, message: "LLM応答なし" };

  var parsed = rv2_est_parseProgressOnly_(raw, planInfo);
  if (!parsed) return { ok: false, message: "LLM応答のパース失敗" };

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
  var savedCount = 0;
  var progressArr = parsed.progress || [];

  for (var i = 0; i < progressArr.length; i++) {
    var p = progressArr[i];
    var msKey = String(p.milestoneKey || "").trim();
    var suggestedPct = Number(p.progressPct || 0);
    var cur = currentMap[msKey];

    var maxPt = 0;
    var msTag = "";
    var msList = planInfo.milestones || [];
    for (var mi = 0; mi < msList.length; mi++) {
      if (String(msList[mi].milestoneKey || msList[mi].milestoneId || "") === msKey) {
        maxPt = Number(msList[mi].points || 0);
        msTag = String(msList[mi].tag || "");
        break;
      }
    }

    if (msTag === "routine") continue;
    if (suggestedPct === 0) continue;

    var prevCum = prevMap[msKey] || 0;
    var newCumPct = Math.min(100, prevCum + suggestedPct);
    var consumed = Math.round(maxPt * newCumPct / 100 * 100) / 100;

    Logger.log("[estimate] msKey=" + msKey + " suggestedPct=" + suggestedPct + " prevCum=" + prevCum + " newCumPct=" + newCumPct + " cur=" + JSON.stringify(cur || null));

    if (cur && (cur.source === "pm_manual" || cur.source === "criteria_toggle")) {
      Logger.log("[estimate] skip: pm_manual/criteria_toggle msKey=" + msKey);
      continue;
    }
    if (cur && newCumPct <= cur.pct) {
      Logger.log("[estimate] skip: not higher msKey=" + msKey + " newCumPct=" + newCumPct + " cur.pct=" + cur.pct);
      continue;
    }

    rv2_upsertProgress({
      projectId: pid,
      planCycleId: planInfo.planCycleId,
      milestoneKey: msKey,
      ym: sym,
      progressPct: newCumPct,
      consumedPt: consumed,
      source: "tsukuyomi_estimate",
      confirmedBy: "",
      confirmedAtJst: now,
      note: (p.reason || "").substring(0, 200)
    });

    savedCount++;
  }

  return {
    ok: true,
    sources: sourcesStr,
    totalEstimated: progressArr.length,
    savedProgress: savedCount
  };
}

/**
 * 旧API互換: ボタンからの呼び出し用
 */
function rv2_estimateFromReport(projectId, ym) {
  return rv2_estimateFromSources(projectId, ym);
}

// ===== ソース収集 =====

/** 月次報告書テキストを取得 */
function rv2_est_getReportText_(projectId, ym) {
  try {
    var rows = b_readTable_("DB_MonthlyReports");
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (String(r.projectId || "").trim() !== projectId) continue;
      var rym = String(r.ym || r.yearMonth || "").trim().replace(/-/g, "");
      if (rym !== ym) continue;
      var text = String(r.finalContent || r.draftContent || r.reportText || r.content || "").trim();
      return text || "";
    }
  } catch (e) {
    Logger.log("rv2_est_getReportText_ error: " + e.message);
  }
  return "";
}

/** イベント履歴をテキスト化 */
function rv2_est_getEventsText_(projectId, ym) {
  try {
    var evRows = b_readTable_("DB_ProgressEvents");
    var lines = [];
    for (var i = 0; i < evRows.length; i++) {
      var ev = evRows[i];
      if (String(ev.projectId || "").trim() !== projectId) continue;
      if (String(ev.ym || "").trim() !== ym) continue;
      if (String(ev.status || "").trim() === "rejected") continue;
      var origin = String(ev.initiativeOrigin || "unknown");
      lines.push("- " + String(ev.eventTitle || "(無題)") + "（起点: " + origin + "）"
        + (ev.eventDescription ? " / " + String(ev.eventDescription).substring(0, 100) : ""));
    }
    return lines.length > 0 ? lines.join("\n") : "";
  } catch (e) {
    Logger.log("rv2_est_getEventsText_ error: " + e.message);
    return "";
  }
}

/** 差分データ（直近24h）をテキスト化 */
function rv2_est_getDeltaText_(projectId, ym) {
  var lines = [];

  try {
    var delta = mr_collectDeltaActivities_(projectId, ym);
    if (delta && delta.summary && delta.summary.total_items > 0) {
      if (delta.notion && delta.notion.success && delta.notion.pages) {
        for (var i = 0; i < delta.notion.pages.length; i++) {
          var p = delta.notion.pages[i];
          lines.push("[Notion] " + String(p.title || p.name || "(無題)").substring(0, 80));
        }
      }
      if (delta.slack && delta.slack.success && delta.slack.messages) {
        for (var i = 0; i < Math.min(delta.slack.messages.length, 20); i++) {
          var m = delta.slack.messages[i];
          lines.push("[Slack] " + String(m.user || "") + ": " + String(m.text || "").substring(0, 100));
        }
      }
      if (delta.gmail && delta.gmail.success && delta.gmail.threads) {
        for (var i = 0; i < delta.gmail.threads.length; i++) {
          var t = delta.gmail.threads[i];
          lines.push("[Gmail] " + String(t.subject || "(無題)").substring(0, 80));
        }
      }
      if (delta.drive && delta.drive.success && delta.drive.files) {
        for (var i = 0; i < delta.drive.files.length; i++) {
          var f = delta.drive.files[i];
          lines.push("[Drive] " + String(f.name || f.title || "(無題)").substring(0, 80));
        }
      }
    }
  } catch (e) {
    Logger.log("rv2_est_getDeltaText_ collectDelta error: " + e.message);
  }

  try {
    var navSsId = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
    if (navSsId) {
      var navSs = SpreadsheetApp.openById(navSsId);
      var cacheSheet = navSs.getSheetByName('DB_SourceCache');
      if (cacheSheet && cacheSheet.getLastRow() >= 2) {
        var cacheData = cacheSheet.getDataRange().getValues();
        var cacheHeaders = cacheData[0].map(function(h) { return String(h).trim(); });
        var iProject = cacheHeaders.indexOf('projectId');
        var iYm      = cacheHeaders.indexOf('ym');
        var iSource  = cacheHeaders.indexOf('source');
        var iTitle   = cacheHeaders.indexOf('title');
        var iContent = cacheHeaders.indexOf('contentText');
        for (var ci = 1; ci < cacheData.length; ci++) {
          var crow = cacheData[ci];
          if (String(crow[iProject]) !== projectId) continue;
          if (String(crow[iYm]) !== ym) continue;
          if (String(crow[iSource]) !== 'gmeet_minutes') continue;
          var gtitle = String(crow[iTitle] || '(無題)').substring(0, 80);
          var gbody  = String(crow[iContent] || '').substring(0, 25000);
          lines.push('### 会議記録: ' + gtitle + '\n' + (gbody || '(本文なし)') + '\n');
        }
      }
    }
  } catch (ge) {
    Logger.log('rv2_est_getDeltaText_ gmeet error: ' + ge);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}

// ===== プロンプト・LLM =====

/** planCycle + active MS一覧を取得 */
function rv2_est_getPlanInfo_(projectId) {
  try {
    var cycleSheet = valuePlan_repo_getCycleSheet();
    var cycleAll = cycleSheet.getDataRange().getValues();
    var cycleHeader = cycleAll[0] || [];
    var plan = null;
    for (var r = 1; r < cycleAll.length; r++) {
      var row = {};
      for (var c = 0; c < cycleHeader.length; c++) row[cycleHeader[c]] = cycleAll[r][c];
      if (String(row.projectId || "").trim() === projectId && String(row.status || "") === "fixed") {
        plan = row; break;
      }
    }
    if (!plan) return null;

    var planCycleId = String(plan.planCycleId || "").trim();
    var msSheet = valuePlan_repo_getMilestoneSheet();
    var msAll = msSheet.getDataRange().getValues();
    var msHeader = msAll[0] || [];
    var milestones = [];
    for (var r = 1; r < msAll.length; r++) {
      var msRow = {};
      for (var c = 0; c < msHeader.length; c++) msRow[msHeader[c]] = msAll[r][c];
      if (String(msRow.planCycleId || "").trim() !== planCycleId) continue;
      if (String(msRow.isActive || "") !== "TRUE" && msRow.isActive !== true) continue;
      if (String(msRow.goalLevel || "annual") !== "annual") continue;
      milestones.push({
        milestoneId: String(msRow.milestoneId || "").trim(),
        orderNo: Number(msRow.orderNo || 0),
        title: String(msRow.title || ""),
        points: Number(msRow.points || 0),
        tag: String(msRow.tag || "")
      });
    }
    milestones.sort(function(a, b) { return a.orderNo - b.orderNo; });

    return { planCycleId: planCycleId, totalPoints: Number(plan.totalPoints || 0), milestones: milestones };
  } catch (e) { return null; }
}

/** PJメンバー取得 */
function rv2_est_getMembers_(projectId) {
  var pmRows = b_readTable_("DB_ProjectMembers");
  var memberRows = b_readTable_("DB_Members");
  var nameMap = {};
  for (var i = 0; i < memberRows.length; i++) {
    var mm = memberRows[i];
    nameMap[String(mm.memberId || "")] = String(mm.codeName || mm.name || mm.memberId || "");
  }
  var result = [];
  for (var i = 0; i < pmRows.length; i++) {
    var pm = pmRows[i];
    if (String(pm.projectId || "").trim() !== projectId) continue;
    if (String(pm.isActive || "") === "FALSE" || pm.isActive === false) continue;
    var mid = String(pm.memberId || "").trim();
    result.push({ memberId: mid, memberName: nameMap[mid] || mid });
  }
  return result;
}

/** 前月ym算出 */
function rv2_est_prevYm_(ym) {
  var y = parseInt(ym.substring(0, 4), 10);
  var m = parseInt(ym.substring(4, 6), 10);
  m--;
  if (m < 1) { m = 12; y--; }
  return String(y) + (m < 10 ? "0" : "") + String(m);
}

/** v2プロンプト（複数ソース対応、progressのみ） */
function rv2_est_buildPrompt_v2_(allSourcesText, planInfo, members, prevMap, currentMap, ym) {
  // --- 静的部分：DB_TsukuyomiContextから取得 ---
  var ctx = tsukuyomi_getActiveSystemPrompt({ tag: "reward_estimate" });
  var staticRules = (ctx && ctx.systemPrompt) ? ctx.systemPrompt : "";
  if (!staticRules) {
    Logger.log("WARNING: reward_estimate context not found in DB_TsukuyomiContext. Using fallback.");
    staticRules = "各MSの今月の追加進捗率を0〜(100-前月累計)の整数で推定し、JSON形式で回答してください。";
  }

  // --- 動的部分：コードで組み立て ---
  var ms = planInfo.milestones;

  var msListText = "";
  for (var i = 0; i < ms.length; i++) {
    var prev = prevMap[ms[i].milestoneId] || 0;
    var curr = currentMap[ms[i].milestoneId] || 0;
    var tagLabel = ms[i].tag === "buffer" ? " [buffer]" : "";
    msListText += "  " + (i + 1) + ". [" + ms[i].milestoneId + "] " + ms[i].title
      + tagLabel + " (" + ms[i].points + "pt, 前月累計: " + prev + "%, 現在登録値: " + curr + "%)\n";
  }

  var memberListText = "";
  for (var i = 0; i < members.length; i++) {
    memberListText += "  - " + members[i].memberName + "\n";
  }

  var displayYm = ym.substring(0, 4) + "/" + ym.substring(4);

  var prompt = staticRules + "\n\n"
    + "## 対象月: " + displayYm + "\n\n"
    + "## マイルストーン一覧:\n" + msListText + "\n"
    + "## PJメンバー:\n" + memberListText + "\n"
    + "## 情報ソース:\n"
    + "---\n" + allSourcesText + "\n---\n";

  return prompt;
}

/** LLM呼び出し */
function rv2_est_callLLM_(prompt) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY が未設定");

    var payload = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }]
    };

    var options = {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    var data = JSON.parse(resp.getContentText());
    if (data.error) throw new Error("Claude API: " + data.error.message);
    if (data.content && data.content.length > 0) return data.content[0].text || "";
    return "";
  } catch (e) {
    Logger.log("rv2_est_callLLM_ error: " + e.message);
    return "";
  }
}

/** LLM応答をパース（progressのみ） */
function rv2_est_parseProgressOnly_(raw, planInfo) {
  try {
    var jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    var parsed = JSON.parse(jsonMatch[0]);

    var validMs = {};
    for (var i = 0; i < planInfo.milestones.length; i++) {
      validMs[planInfo.milestones[i].milestoneId] = true;
    }

    var progress = [];
    var rawProg = parsed.progress || [];
    for (var i = 0; i < rawProg.length; i++) {
      var p = rawProg[i];
      var key = String(p.milestoneKey || "").trim();
      if (!validMs[key]) continue;
      var pct = Math.max(0, Math.min(100, Math.round(Number(p.progressPct || 0))));
      progress.push({
        milestoneKey: key,
        progressPct: pct,
        reason: String(p.reason || "")
      });
    }

    // MS漏れ補完
    for (var i = 0; i < planInfo.milestones.length; i++) {
      var msId = planInfo.milestones[i].milestoneId;
      var found = false;
      for (var j = 0; j < progress.length; j++) {
        if (progress[j].milestoneKey === msId) { found = true; break; }
      }
      if (!found) {
        progress.push({ milestoneKey: msId, progressPct: 0, reason: "情報ソースに言及なし" });
      }
    }

    return { progress: progress };
  } catch (e) {
    Logger.log("rv2_est_parseProgressOnly_ error: " + e.message);
    return null;
  }
}

// ===== 日次cron =====
/**
 * 全アクティブPJ×当月の進捗を自動推定 → pendingに書き込み
 * 報告書がなければ先に生成してから推定
 */
function cron_progressEstimateDaily_() {
  var ym = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMM");
  var projects = b_readTable_("DB_Projects");
  var log = [];

  for (var i = 0; i < projects.length; i++) {
    var pj = projects[i];
    if (String(pj.status || "").toLowerCase() !== "active") continue;
    var pid = String(pj.projectId || "").trim();
    if (!pid) continue;

    var pjName = String(pj.projectName || pj.name || pid);

    // planCycleがあるかチェック
    var planInfo = rv2_est_getPlanInfo_(pid);
    if (!planInfo) {
      log.push("[" + pjName + "] skip: planCycleなし");
      continue;
    }

    // 進捗推定は一次情報（DB_ProgressEvents + Notion/Slack/Gmail/Drive）から独立して行う
    // 月次報告書生成とは分離されたフロー

    try {
      var result = rv2_estimateFromSources(pid, ym);
      if (result && result.ok) {
        log.push("[" + pjName + "] 推定完了: sources=" + result.sources
          + ", estimated=" + result.totalEstimated
          + ", pending=" + result.pendingCount);
      } else {
        log.push("[" + pjName + "] skip: " + (result ? result.message : "unknown"));
      }
    } catch (e) {
      log.push("[" + pjName + "] error: " + e.message);
    }
  }

  // ログ出力
  var logText = "cron_progressEstimateDaily_ " + ym + "\n" + log.join("\n");
  Logger.log(logText);

  try {
    var logSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_AdminActionLog");
    if (logSheet) {
      var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
      logSheet.appendRow([now, "cron_progressEstimate", "", logText, "", ""]);
    }
  } catch (e) {}

  return { ok: true, ym: ym, log: log };
}

/** 旧cron互換（既存トリガー用） */
function cron_rewardV2EstimateDaily_() {
  return cron_progressEstimateDaily_();
}

/** テスト用ラッパー（手動実行可） */
function test_progressEstimateCron() {
  var result = cron_progressEstimateDaily_();
  Logger.log(JSON.stringify(result, null, 2));
}

/** テスト用：特定PJ×ymを手動推定 */
function test_estimateSingleProject() {
  var result = rv2_estimateFromSources("p21", "202603", true);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * トリガー登録（報告書cronの15分後に実行）
 */
function setupProgressEstimateTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "cron_progressEstimateDaily_" ||
        triggers[i].getHandlerFunction() === "cron_rewardV2EstimateDaily_") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("cron_progressEstimateDaily_")
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .nearMinute(30)
    .inTimezone("Asia/Tokyo")
    .create();
  Logger.log("Progress Estimate trigger set: daily 3:30 JST");
}

/** 月全体の活動データをテキスト化 */
function rv2_est_getFullActivityText_(projectId, ym) {
  var lines = [];

  try {
    var navSsId = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
    if (navSsId) {
      var navSs = SpreadsheetApp.openById(navSsId);
      var cacheSheet = navSs.getSheetByName('DB_SourceCache');
      if (cacheSheet && cacheSheet.getLastRow() >= 2) {
        var cacheData = cacheSheet.getDataRange().getValues();
        var cacheHeaders = cacheData[0].map(function(h) { return String(h).trim(); });
        var iProject = cacheHeaders.indexOf('projectId');
        var iYm      = cacheHeaders.indexOf('ym');
        var iSource  = cacheHeaders.indexOf('source');
        var iTitle   = cacheHeaders.indexOf('title');
        var iContent = cacheHeaders.indexOf('contentText');
        for (var ci = 1; ci < cacheData.length; ci++) {
          var crow = cacheData[ci];
          if (String(crow[iProject]) !== projectId) continue;
          if (String(crow[iYm]) !== ym) continue;
          var src    = String(crow[iSource]);
          var ctitle = String(crow[iTitle] || '(無題)').substring(0, 80);
          var cbody  = String(crow[iContent] || '');
          if (src === 'gmeet_minutes') {
            lines.push('### 会議記録: ' + ctitle + '\n' + cbody.substring(0, 8000) + '\n');
          } else if (src === 'notion') {
            lines.push('[Notion] ' + ctitle + (cbody ? ' / ' + cbody.substring(0, 200) : ''));
          } else if (src === 'slack') {
            lines.push('[Slack] ' + ctitle + (cbody ? ': ' + cbody.substring(0, 150) : ''));
          } else if (src === 'gmail') {
            lines.push('[Gmail] ' + ctitle + (cbody ? ' / ' + cbody.substring(0, 150) : ''));
          } else if (src === 'drive') {
            lines.push('[Drive] ' + ctitle);
          }
        }
      }
    }
  } catch (ge) {
    Logger.log('rv2_est_getFullActivityText_ cache error: ' + ge);
  }

  return lines.length > 0 ? lines.join("\n") : "";
}