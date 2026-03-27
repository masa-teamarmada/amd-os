/** R095_ProjectKnowledge_Ops.gs
 * PJナレッジベースのドメインロジック
 *
 * Step A: SourceCache → LLMエンティティ抽出 → DB_ProjectEntities
 * Step B: DB_ProjectEntities → LLM要約合成 → DB_ProjectKnowledge
 *
 * プロンプト:
 *  - DB_TsukuyomiContext tag=knowledge_extract（エンティティ抽出用）
 *  - DB_TsukuyomiContext tag=knowledge_summarize（要約合成用）
 *
 * 依存:
 *  - 094_ProjectKnowledge_Repo.gs
 *  - 163_LlmRouter.gs (llm_callJson)
 *  - 311_SourceCacheRepo.gs (srcCache_listByProjectYm)
 *  - 172_TsukuyomiContextRepo.gs (tsukuyomi_listContextRows)
 */

// ===== カテゴリ定数 =====
var PK_CATEGORIES = [
  "people", "tech", "ip", "org", "funding",
  "market", "competitor", "strategy", "term"
];

// ===== Step A: エンティティ抽出 =====

/**
 * 指定PJ×ymのSourceCacheから未処理分をLLM抽出
 * @param {string} projectId
 * @param {string} ym yyyymm
 * @param {string} systemPrompt knowledge_extractのプロンプト
 * @param {Set} doneItemIds 処理済みsourceItemIdのSet
 * @return {{ extracted: number, skipped: number, entities: number, errors: Array }}
 */
function pk_extractEntitiesForPjYm_(projectId, ym, systemPrompt, doneItemIds) {
  var result = { extracted: 0, skipped: 0, entities: 0, errors: [] };
  var sources = ["notion", "slack", "gmail"];
  var nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
  var MAX_TEXT_CHARS = 6000;

  for (var si = 0; si < sources.length; si++) {
    var src = sources[si];
    var rows = srcCache_listByProjectYm(projectId, ym, src);

    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      var itemId = String(row.itemId || "").trim().replace(/-/g, "");
      var text = String(row.contentText || "").trim();

      if (!text || text.length < 100 || doneItemIds.has(itemId)) {
        result.skipped++;
        continue;
      }

      // 長すぎるテキストを切り詰め
      if (text.length > MAX_TEXT_CHARS) {
        text = text.substring(0, MAX_TEXT_CHARS) + "\n\n（以下省略）";
      }

      try {
        var extracted = llm_callJson("knowledge_extract", systemPrompt, text);

        if (!extracted) {
          result.errors.push({ itemId: itemId, error: "llm_callJson returned null/undefined", textLen: text.length });
          continue;
        }
        if (extracted._error) {
          result.errors.push({ itemId: itemId, error: String(extracted._error), textLen: text.length });
          continue;
        }

        var list = Array.isArray(extracted) ? extracted
                 : (Array.isArray(extracted.entities) ? extracted.entities : []);

        var entities = [];
        for (var ei = 0; ei < list.length; ei++) {
          var e = list[ei];
          var name = String(e.name || e.entityName || "").trim();
          var fact = String(e.fact || e.factText || "").trim();
          var cat = String(e.category || "").trim().toLowerCase();

          if (!name || !fact) continue;
          if (PK_CATEGORIES.indexOf(cat) < 0) cat = "term";

          entities.push({
            entityId: Utilities.getUuid().replace(/-/g, ""),
            projectId: projectId,
            category: cat,
            entityName: name,
            factText: fact,
            source: src,
            sourceItemId: itemId,
            confidence: String(e.confidence || "medium"),
            status: "active",
            createdAtJst: nowJst,
            updatedAtJst: nowJst
          });
        }

        if (entities.length) {
          pk_appendEntities_(entities);
          result.entities += entities.length;
        }

        result.extracted++;
        doneItemIds.add(itemId);

      } catch(ex) {
        result.errors.push({ itemId: itemId, error: String(ex.message || ex), textLen: text.length });
      }

      Utilities.sleep(200);
    }
  }
  return result;
}

// ===== Step B: 要約合成 =====

/**
 * 指定PJの全カテゴリについて要約を再合成
 * @param {string} projectId
 * @param {string} summarizePrompt knowledge_summarizeのプロンプト
 * @return {{ updated: number, categories: Array<string> }}
 */
function pk_synthesizeKnowledge_(projectId, summarizePrompt) {
  var result = { updated: 0, categories: [] };

  for (var ci = 0; ci < PK_CATEGORIES.length; ci++) {
    var cat = PK_CATEGORIES[ci];
    var entities = pk_listEntities_(projectId, cat);
    if (!entities.length) continue;

    // エンティティ一覧をテキスト化
    var factsText = "";
    for (var i = 0; i < entities.length; i++) {
      factsText += "- " + entities[i].entityName + ": " + entities[i].factText + "\n";
    }

    // 既存要約を取得（差分マージ用）
    var existing = pk_getKnowledge_(projectId);
    var existingSummary = (existing[cat] && existing[cat].summaryText) || "";

    var userPrompt = JSON.stringify({
      category: cat,
      entityCount: entities.length,
      facts: factsText,
      existingSummary: existingSummary
    });

    try {
      var synth = llm_callJson("knowledge_summarize", summarizePrompt, userPrompt);
      if (!synth || synth._error) continue;

      var summaryText = String(synth.summary || synth.summaryText || "").trim();
      if (!summaryText) continue;

      pk_upsertKnowledge_(projectId, cat, summaryText, entities.length);
      result.updated++;
      result.categories.push(cat);

    } catch(e) {
      // 要約失敗は既存を維持（上書きしない）
    }

    Utilities.sleep(200);
  }
  return result;
}

// ===== 統合: 抽出 + 合成 =====

/**
 * 1PJの知識ベースを更新（日次cronから呼ばれる単位）
 * @param {string} projectId
 * @param {Array<string>} ymList 対象ym一覧
 * @param {string} extractPrompt
 * @param {string} summarizePrompt
 * @param {Set} doneItemIds
 * @return {{ extractResult: Object, synthesizeResult: Object }}
 */
function pk_updateProjectKnowledge_(projectId, ymList, extractPrompt, summarizePrompt, doneItemIds) {
  // Step A: エンティティ抽出
  var extractTotal = { extracted: 0, skipped: 0, entities: 0, errors: [] };
  for (var yi = 0; yi < ymList.length; yi++) {
    var r = pk_extractEntitiesForPjYm_(projectId, ymList[yi], extractPrompt, doneItemIds);
    extractTotal.extracted += r.extracted;
    extractTotal.skipped += r.skipped;
    extractTotal.entities += r.entities;
    extractTotal.errors = extractTotal.errors.concat(r.errors);
  }

  // Step B: 新規エンティティがあったら要約再合成
  var synthResult = { updated: 0, categories: [] };
  if (extractTotal.entities > 0) {
    synthResult = pk_synthesizeKnowledge_(projectId, summarizePrompt);
  }

  return {
    extractResult: extractTotal,
    synthesizeResult: synthResult
  };
}