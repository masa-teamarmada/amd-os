/** 087_ValueCriteriaCron.gs
 * successCriteria の日次自動提案。
 * 月次報告書の内容とMS定義を比較し、完了候補([?x])と追加候補([?])をLLMが提案する。
 */

/**
 * 日次バッチ：月次報告書からsuccessCriteria更新を提案
 * 3:45 JST 実行想定（313の報告書生成後、315のスライド生成前）
 */
function cron_suggestCriteriaDaily_() {
  var now = new Date();
  var ym = Utilities.formatDate(now, "Asia/Tokyo", "yyyyMM");
  var projects = b_readTable_("DB_Projects");
  var count = 0;

  for (var i = 0; i < projects.length; i++) {
    var pj = projects[i];
    if (String(pj.status || "").toLowerCase() !== "active") continue;
    var pid = String(pj.projectId || "").trim();
    if (!pid) continue;

    var elapsed = (new Date().getTime() - now.getTime()) / 1000;
    if (elapsed > 240) break;

    try {
      var result = vc_suggestCriteriaForProject_(pid, ym);
      if (result && result.updated) count++;
    } catch (e) {
      Logger.log("cron_suggestCriteria skip " + pid + ": " + e.message);
    }
  }
  Logger.log("cron_suggestCriteriaDaily_ done: " + count + " PJs updated for " + ym);
}

/**
 * 1PJ分のsuccessCriteria提案
 */
function vc_suggestCriteriaForProject_(projectId, ym) {
  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );

  // planCycle取得
  var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
  var plan = null;
  for (var i = 0; i < pcRows.length; i++) {
    if (String(pcRows[i].projectId || "") === projectId && String(pcRows[i].status || "") === "fixed") {
      plan = pcRows[i]; break;
    }
  }
  if (!plan) return { updated:false };

  // MS取得
  var planCycleId = String(plan.planCycleId || "");
  var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
  var milestones = [];
  for (var i = 0; i < msRows.length; i++) {
    var r = msRows[i];
    if (String(r.planCycleId || "") !== planCycleId) continue;
    if (String(r.isActive || "TRUE").toUpperCase() !== "TRUE") continue;
    milestones.push(r);
  }
  if (!milestones.length) return { updated:false };

  // 月次報告書取得
  var report = mr_repo_getByProjectYm_(projectId, ym);
  if (!report) return { updated:false };
  var reportText = String(report.finalContent || report.draftContent || "").trim();
  if (!reportText || reportText.length < 50) return { updated:false };

  // MS情報をテキスト化
  var msText = "";
  for (var i = 0; i < milestones.length; i++) {
    var ms = milestones[i];
    msText += "--- " + String(ms.milestoneId || "") + ": " + String(ms.title || "") + " (" + String(ms.points || 0) + "pt) ---\n";
    msText += String(ms.successCriteria || "（なし）") + "\n\n";
  }

  // DB_TsukuyomiContext からプロンプト取得
  var systemPrompt = vc_getContextPrompt_("criteria_suggest");
  if (!systemPrompt) {
    Logger.log("vc_suggestCriteria: DB_TsukuyomiContext に criteria_suggest タグなし。スキップ");
    return { updated:false };
  }

  var userPrompt = "## 月次報告書（" + ym + "）\n" + reportText
    + "\n\n## マイルストーンとサブ項目\n" + msText;

  // LLM呼び出し
  var llmResult = llm_callJson("criteria_suggest", systemPrompt, userPrompt, { maxTokens:2000 });
  if (!llmResult || !Array.isArray(llmResult.updates)) return { updated:false };

  // 適用
  var sh = navSs.getSheetByName("DB_ValueMilestones");
  var data = sh.getDataRange().getValues();
  var hdr = data[0] || [];
  var idx = {};
  for (var c = 0; c < hdr.length; c++) idx[hdr[c]] = c;

  var anyUpdated = false;
  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";

  for (var u = 0; u < llmResult.updates.length; u++) {
    var upd = llmResult.updates[u];
    var mid = String(upd.milestoneId || "").trim();
    if (!mid) continue;

    // 対象行を探す
    var rowIdx = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][idx.milestoneId] || "").trim() === mid) { rowIdx = r; break; }
    }
    if (rowIdx < 0) continue;

    var raw = String(data[rowIdx][idx.successCriteria] || "");
    var lines = raw.split("\n");
    var changed = false;

    if (upd.action === "complete" && typeof upd.lineIndex === "number") {
      // [ ] → [?x] （完了提案）
      var li = upd.lineIndex;
      if (li >= 0 && li < lines.length && /^\[\s*\]/.test(lines[li])) {
        lines[li] = lines[li].replace(/^\[\s*\]/, "[?x]");
        changed = true;
      }
    } else if (upd.action === "add" && upd.text) {
      // 新規提案を末尾に追加
      var newLine = "[?] " + String(upd.text).trim();
      // 重複チェック（同じテキストが既にあればスキップ）
      var dupFound = false;
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].replace(/^\[.*?\]\s*/, "").trim() === String(upd.text).trim()) {
          dupFound = true; break;
        }
      }
      if (!dupFound) {
        lines.push(newLine);
        changed = true;
      }
    }

    if (changed) {
      var newVal = lines.join("\n");
      sh.getRange(rowIdx + 1, idx.successCriteria + 1).setValue(newVal);
      data[rowIdx][idx.successCriteria] = newVal;
      if (idx.updatedAt !== undefined) {
        sh.getRange(rowIdx + 1, idx.updatedAt + 1).setValue(nowJst);
      }
      anyUpdated = true;
    }
  }

  return { updated:anyUpdated };
}

/**
 * DB_TsukuyomiContext から指定タグのプロンプトを取得
 */
function vc_getContextPrompt_(tag) {
  try {
    var rows = b_readTable_("DB_TsukuyomiContext");
    for (var i = 0; i < rows.length; i++) {
      var tags = String(rows[i].tags || "").split(",");
      for (var t = 0; t < tags.length; t++) {
        if (tags[t].trim() === tag) return String(rows[i].content || "");
      }
    }
  } catch (e) {}
  return null;
}

/**
 * トリガー登録（1回だけ手動実行）
 * ファイル: 087_ValueCriteriaCron.gs
 */
function setupCriteriaSuggestTrigger() {
  var fn = "cron_suggestCriteriaDaily_";
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fn) ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger(fn)
    .timeBased().everyDays(1).atHour(3).nearMinute(45)
    .inTimezone("Asia/Tokyo").create();
  Logger.log(fn + " trigger set at 3:45 JST daily");
}

/** 手動テスト用ラッパー */
function TEST_suggestCriteria() {
  cron_suggestCriteriaDaily_();
}