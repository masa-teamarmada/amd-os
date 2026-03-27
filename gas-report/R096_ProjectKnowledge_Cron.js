/** R096_ProjectKnowledge_Cron.gs
 * PJナレッジベースの日次cron + 手動実行ラッパー
 *
 * 実行タイミング: 毎日 6:30 JST（プロトコル抽出6:00の後）
 *
 * 依存:
 *  - 094_ProjectKnowledge_Repo.gs
 *  - 095_ProjectKnowledge_Ops.gs
 *  - 172_TsukuyomiContextRepo.gs
 *  - B_Sheets.gs (b_readTable_)
 */

/**
 * 全activePJ × 直近2ヶ月のナレッジ更新
 * @param {Object} [payload]
 * @param {number} [payload.months=2] 直近何ヶ月分
 * @return {Object} 実行結果サマリ
 */
function run_syncProjectKnowledgeDaily(payload) {
  var START_MS = Date.now();
  var TIMEOUT_MS = 5.5 * 60 * 1000;

  payload = payload || {};
  var targetMonths = Number(payload.months || 2);

  // プロンプト取得
  var extractCtx = tsukuyomi_listContextRows({ tag: "knowledge_extract", status: "active" });
  var extractPrompt = ((extractCtx && extractCtx.rows) || [])
    .map(function(r) { return String(r.systemPrompt || "").trim(); })
    .filter(function(x) { return x; })
    .join("\n\n");
  if (!extractPrompt) return { ok: false, message: "DB_TsukuyomiContext tag=knowledge_extract not found" };

  var summarizeCtx = tsukuyomi_listContextRows({ tag: "knowledge_summarize", status: "active" });
  var summarizePrompt = ((summarizeCtx && summarizeCtx.rows) || [])
    .map(function(r) { return String(r.systemPrompt || "").trim(); })
    .filter(function(x) { return x; })
    .join("\n\n");
  if (!summarizePrompt) return { ok: false, message: "DB_TsukuyomiContext tag=knowledge_summarize not found" };

  // スキーマ保証
  admin_ensureProjectKnowledgeSchema();

  // 処理済みID
  var doneItemIds = pk_getDoneSourceItemIds_();

  // 全activePJ
  var pjData = b_readTable_("DB_Projects");
  var activePjs = pjData.filter(function(r) {
    return String(r.status || "").toLowerCase() === "active";
  });

  // 対象ym一覧
  var now = new Date();
  var ymList = [];
  for (var mi = 0; mi < targetMonths; mi++) {
    var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    ymList.push(String(y) + ("0" + m).slice(-2));
  }

  var result = {
    pjCount: activePjs.length,
    processed: 0,
    totalEntities: 0,
    totalSynthesized: 0,
    timedOut: false,
    errors: []
  };

  for (var pi = 0; pi < activePjs.length; pi++) {
    if (Date.now() - START_MS > TIMEOUT_MS) {
      result.timedOut = true;
      break;
    }

    var projectId = String(activePjs[pi].projectId || "").trim();
    if (!projectId) continue;

    try {
      var r = pk_updateProjectKnowledge_(projectId, ymList, extractPrompt, summarizePrompt, doneItemIds);
      result.totalEntities += r.extractResult.entities;
      result.totalSynthesized += r.synthesizeResult.updated;
      result.errors = result.errors.concat(r.extractResult.errors);
      result.processed++;
    } catch(e) {
      result.errors.push({ projectId: projectId, error: String(e.message || e) });
    }
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** 日次cron本体（6:30 JST想定） */
function cron_syncProjectKnowledgeDaily() {
  return run_syncProjectKnowledgeDaily({ months: 2 });
}

/** 手動実行ラッパー ファイル: 096_ProjectKnowledge_Cron.gs */
function run_syncProjectKnowledgeDaily_manual() {
  return run_syncProjectKnowledgeDaily();
}

/**
 * 全期間バックフィル。SourceCacheにある全ymを対象に実行。
 * タイムアウトで途中終了しても再実行すれば続きから処理される（doneItemIds管理）。
 * 手動実行: 096_ProjectKnowledge_Cron.gs → run_syncProjectKnowledgeKnowledgeBackfill
 */
function run_syncProjectKnowledgeBackfill() {
  var START_MS = Date.now();
  var TIMEOUT_MS = 5.5 * 60 * 1000;

  var extractCtx = tsukuyomi_listContextRows({ tag: 'knowledge_extract', status: 'active' });
  var extractPrompt = ((extractCtx && extractCtx.rows) || [])
    .map(function(r) { return String(r.systemPrompt || '').trim(); })
    .filter(function(x) { return x; }).join('\n\n');
  if (!extractPrompt) return { ok: false, message: 'knowledge_extract prompt not found' };

  var summarizeCtx = tsukuyomi_listContextRows({ tag: 'knowledge_summarize', status: 'active' });
  var summarizePrompt = ((summarizeCtx && summarizeCtx.rows) || [])
    .map(function(r) { return String(r.systemPrompt || '').trim(); })
    .filter(function(x) { return x; }).join('\n\n');
  if (!summarizePrompt) return { ok: false, message: 'knowledge_summarize prompt not found' };

  admin_ensureProjectKnowledgeSchema();
  var doneItemIds = pk_getDoneSourceItemIds_();

  // SourceCache全件からym一覧を取得
  var allCache = srcCache_readAll_();
  var ymSet = {};
  for (var i = 0; i < allCache.length; i++) {
    var ym = String(allCache[i].ym || '').replace(/-/g, '').slice(0, 6);
    if (ym && /^\d{6}$/.test(ym)) ymSet[ym] = true;
  }
  var ymList = Object.keys(ymSet).sort().reverse(); // 新しい月から処理

  var activePjs = b_readTable_('DB_Projects').filter(function(r) {
    return String(r.status || '').toLowerCase() === 'active';
  });

  var result = {
    ymCount: ymList.length,
    pjCount: activePjs.length,
    processed: 0,
    totalEntities: 0,
    timedOut: false,
    errors: []
  };

  for (var pi = 0; pi < activePjs.length; pi++) {
    if (Date.now() - START_MS > TIMEOUT_MS) { result.timedOut = true; break; }
    var projectId = String(activePjs[pi].projectId || '').trim();
    if (!projectId) continue;
    try {
      var r = pk_updateProjectKnowledge_(projectId, ymList, extractPrompt, summarizePrompt, doneItemIds);
      result.totalEntities += r.extractResult.entities;
      result.processed++;
    } catch(e) {
      result.errors.push({ projectId: projectId, error: String(e.message || e) });
    }
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
/** トリガー設定（1回だけ手動実行） ファイル: 096_ProjectKnowledge_Cron.gs */
function setup_projectKnowledgeTrigger() {
  var fnName = "cron_syncProjectKnowledgeDaily";

  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === fnName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger(fnName)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone("Asia/Tokyo")
    .create();

  Logger.log("トリガー設定完了: " + fnName + " 毎日6:00-7:00 JST");
}