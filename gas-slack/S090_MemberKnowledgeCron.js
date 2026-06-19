/** S090_MemberKnowledgeCron.gs
 * DB_MemberEntities → DB_MemberKnowledge の要約合成cron。
 *
 * 実行タイミング: 毎日 7:00 JST（PJナレッジ6:30の後）
 *
 * 依存:
 *  - S040_TsukuyomiContext.gs (context_getNavSs_, context_readNavSheet_)
 *  - S070_LlmClient.gs (llm_call_)
 *  - S010_Utils.gs (utils_getProp_)
 */

// ===== カテゴリ定義 =====
var MK_CATEGORIES = [
  "skills", "personality", "communication_style",
  "growth_areas", "work_style", "interests", "episodes"
];

var MK_CATEGORY_LABELS = {
  skills: "スキル・専門性",
  personality: "性格・特徴",
  communication_style: "コミュニケーションスタイル",
  growth_areas: "成長テーマ",
  work_style: "働き方",
  interests: "興味・関心",
  episodes: "過去のエピソード・出来事"
};

// ===== 要約合成コア =====

/**
 * 指定メンバーの全カテゴリを要約合成してDB_MemberKnowledgeにupsert。
 * @param {string} codeName
 * @return {Object} { updated: number, skipped: number }
 */
function mk_synthesizeForMember_(codeName) {
  var ss = context_getNavSs_();
  var entities = context_readNavSheet_("DB_MemberEntities");
  var knowledgeRows = context_readNavSheet_("DB_MemberKnowledge");

  // このメンバーのactiveエンティティをカテゴリ別に集約
  var byCategory = {};
  entities.forEach(function(e) {
    if (e.codeName !== codeName || e.status !== "active") return;
    var cat = String(e.category || "").trim();
    if (!cat) return;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(String(e.observation || "").trim());
  });

  // 既存のKnowledgeを取得（マージ用）
  var existingByCategory = {};
  knowledgeRows.forEach(function(r) {
    if (r.codeName === codeName) {
      existingByCategory[r.category] = r.summaryText || "";
    }
  });

  var result = { updated: 0, skipped: 0 };

  var cats = Object.keys(byCategory);
  for (var i = 0; i < cats.length; i++) {
    var cat = cats[i];
    var observations = byCategory[cat];
    if (!observations.length) { result.skipped++; continue; }

    var existing = existingByCategory[cat] || "";
    var label = MK_CATEGORY_LABELS[cat] || cat;

    // LLMで要約合成
    var systemPrompt =
      "あなたはチームメンバーのプロファイルを管理するアシスタントです。\n" +
      "以下の観察データを統合して、" + label + "についての簡潔なプロファイルテキストを作成してください。\n\n" +
      "ルール:\n" +
      "- 事実ベースで書く。推測や評価は入れない\n" +
      "- 既存プロファイルがある場合、新しい観察と矛盾する内容は新しい方を優先\n" +
      "- 重複は統合して簡潔にまとめる\n" +
      "- 2〜5文程度で、人物像が伝わるように書く\n" +
      "- 出力はプロファイルテキストのみ（JSONではなくプレーンテキスト）";

    var userPrompt = "メンバー: " + codeName + "\nカテゴリ: " + label + "\n\n";
    if (existing) {
      userPrompt += "【既存プロファイル】\n" + existing + "\n\n";
    }
    userPrompt += "【新しい観察データ（" + observations.length + "件）】\n";
    observations.forEach(function(obs, idx) {
      userPrompt += (idx + 1) + ". " + obs + "\n";
    });

    try {
      var summary = llm_call_(systemPrompt, userPrompt, { maxTokens: 400, temperature: 0.2 });
      if (summary) {
        mk_upsertKnowledge_(ss, codeName, cat, summary, observations.length);
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch(e) {
      Logger.log("[MK] synthesize error: " + codeName + "/" + cat + " " + (e.message || e));
      result.skipped++;
    }
  }

  return result;
}

/**
 * DB_MemberKnowledgeにupsert。
 */
function mk_upsertKnowledge_(navSs, codeName, category, summaryText, entityCount) {
  var sheetName = "DB_MemberKnowledge";
  var sh = navSs.getSheetByName(sheetName);
  if (!sh) return;

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  // 既存行を探す
  if (lastRow >= 2) {
    var data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    var headers = data[0];
    var iCn = -1, iCat = -1, iSum = -1, iCnt = -1, iUpd = -1;
    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c] || "").trim();
      if (h === "codeName") iCn = c;
      if (h === "category") iCat = c;
      if (h === "summaryText") iSum = c;
      if (h === "entityCount") iCnt = c;
      if (h === "lastUpdatedAtJst") iUpd = c;
    }

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][iCn] || "").trim() === codeName &&
          String(data[r][iCat] || "").trim() === category) {
        var rowNum = r + 1;
        if (iSum >= 0) sh.getRange(rowNum, iSum + 1).setValue(summaryText);
        if (iCnt >= 0) sh.getRange(rowNum, iCnt + 1).setValue(entityCount);
        if (iUpd >= 0) sh.getRange(rowNum, iUpd + 1).setValue(now);
        return;
      }
    }
  }

  // 新規追加
  sh.appendRow([codeName, category, summaryText, entityCount, now]);
}

// ===== Cron =====

/**
 * 全メンバーのMemberKnowledge要約合成。
 * 日次cron（7:00 JST想定）。
 */
function cron_syncMemberKnowledgeDaily() {
  var START_MS = Date.now();
  var TIMEOUT_MS = 5 * 60 * 1000; // 5分タイムアウト

  // DB_MemberEntitiesから全codeNameを取得
  var entities = context_readNavSheet_("DB_MemberEntities");
  var codeNameSet = {};
  entities.forEach(function(e) {
    if (e.status === "active" && e.codeName) {
      codeNameSet[e.codeName] = true;
    }
  });
  var codeNames = Object.keys(codeNameSet).sort();

  var result = {
    memberCount: codeNames.length,
    processed: 0,
    totalUpdated: 0,
    timedOut: false,
    errors: []
  };

  for (var i = 0; i < codeNames.length; i++) {
    if (Date.now() - START_MS > TIMEOUT_MS) {
      result.timedOut = true;
      break;
    }

    try {
      var r = mk_synthesizeForMember_(codeNames[i]);
      result.totalUpdated += r.updated;
      result.processed++;
      Logger.log("[MK] " + codeNames[i] + ": updated=" + r.updated + " skipped=" + r.skipped);
    } catch(e) {
      result.errors.push({ codeName: codeNames[i], error: String(e.message || e) });
    }
  }

  Logger.log("=== MemberKnowledge sync結果 ===");
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * 手動実行ラッパー。
 * ファイル: S090_MemberKnowledgeCron.gs
 */
function run_syncMemberKnowledgeDaily_manual() {
  return cron_syncMemberKnowledgeDaily();
}

/**
 * 日次トリガー設定（1回だけ手動実行）。
 * ファイル: S090_MemberKnowledgeCron.gs
 */
function setup_memberKnowledgeTrigger() {
  var fnName = "cron_syncMemberKnowledgeDaily";

  // 既存トリガー削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fnName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 毎日7:00 JST
  ScriptApp.newTrigger(fnName)
    .timeBased()
    .everyDays(1)
    .atHour(7)
    .inTimezone("Asia/Tokyo")
    .create();

  Logger.log("トリガー設定完了: " + fnName + " 毎日7:00-8:00 JST");
}
