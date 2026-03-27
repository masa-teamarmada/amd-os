/**
 * 169_MsRevision_Api.gs
 * MS改定モード（コックピット内モーダル版）のAPIエントリポイント。
 *
 * 公開関数：
 *   - msRevision_start(payload)   — 改定セッション開始、現状MS+進捗を返す
 *   - msRevision_chat(payload)    — 改定指示を処理しLLM改定案を返す
 *   - msRevision_fix(payload)     — 改定案を確定してDB保存
 *
 * 依存：
 *   - 163_LlmRouter.gs（llm_callJson）
 *   - 168_MsRevision_Ops.gs（ドメインロジック）
 *   - 172_TsukuyomiContextRepo.gs（プロンプト取得）
 *   - 086_ValuePlanRepo.gs（DB_ValuePlanCycles, DB_ValueMilestones）
 *   - 058_RewardV2_Repo.gs（rv2_readProgressForPlanCycle）
 */

// ================================================================
// 公開API
// ================================================================

/**
 * 改定セッション開始
 * @param {Object} payload - { projectId, ym }
 *   ym = コックピットで開いている月（yyyymm）。この月以降のMSが改定対象。
 */
function msRevision_start(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  if (!ym || !/^\d{6}$/.test(ym)) return { ok: false, message: "ym required (yyyymm)" };

  // 1. planCycle取得（fixed のみ）
  var cycle = msRev_findFixedCycle_(projectId);
  if (!cycle) return { ok: false, message: "fixed planCycle not found for this project" };

  var planCycleId = String(cycle.planCycleId || "").trim();
  var currentVersion = Number(cycle.fixedVersion || 1);

  // 2. active MS一覧
  var allMs = msRev_loadActiveMs_(planCycleId);

  // 3. 進捗データ（全ym横断）
  var allProgress = rv2_readProgressForPlanCycle(planCycleId);

  // 4. frozen / revisable に分割
  var frozenMs = [];
  var revisableMs = [];
  for (var i = 0; i < allMs.length; i++) {
    var ms = allMs[i];
    var tYm = String(ms.targetYm || "").trim();
    if (tYm && tYm < ym) {
      frozenMs.push(ms);
    } else {
      revisableMs.push(ms);
    }
  }

  // 各MSに最新進捗%を付与
  msRev_attachLatestProgress_(frozenMs, allProgress);
  msRev_attachLatestProgress_(revisableMs, allProgress);

  // frozenMsの合計pt
  var frozenPtTotal = 0;
  for (var i = 0; i < frozenMs.length; i++) frozenPtTotal += Number(frozenMs[i].points || 0);

  // サブMS + 担当配分を取得
  var allMsIds = [];
  for (var i = 0; i < allMs.length; i++) allMsIds.push(String(allMs[i].milestoneId || ""));
  var subItemsList = allMsIds.length > 0 ? subItem_listByMilestoneIds(allMsIds) : [];
  var subIds = [];
  for (var i = 0; i < subItemsList.length; i++) subIds.push(subItemsList[i].subItemId);
  var subResps = subIds.length > 0 ? subItemResp_listBySubItemIds(subIds) : [];
  // subItemsMap: milestoneId → subItems[]
  var subItemsMap = {};
  var subRespMap = {}; // subItemId → resps[]
  for (var i = 0; i < subResps.length; i++) {
    var r = subResps[i];
    if (!subRespMap[r.subItemId]) subRespMap[r.subItemId] = [];
    subRespMap[r.subItemId].push({ memberId: String(r.memberId || ""), share: Number(r.share || 0) });
  }
  for (var i = 0; i < subItemsList.length; i++) {
    var sub = subItemsList[i];
    var mid = String(sub.milestoneId || "");
    if (!subItemsMap[mid]) subItemsMap[mid] = [];
    subItemsMap[mid].push({
      subItemId: sub.subItemId,
      title: sub.title,
      targetYm: String(sub.targetYm || ""),
      isDone: sub.isDone === true || sub.isDone === "TRUE",
      responsibilities: subRespMap[sub.subItemId] || []
    });
  }
  // MS単位のコミットスコア（サブMSから集計）
  var msRespMap = {};
  var allRespRows = rv2_readResponsibilityForPlanCycle(planCycleId);
  for (var i = 0; i < allRespRows.length; i++) {
    var rr = allRespRows[i];
    var key = String(rr.milestoneKey || rr.milestoneId || "");
    if (!msRespMap[key]) msRespMap[key] = [];
    msRespMap[key].push({ memberId: String(rr.memberId || ""), codeName: String(rr.codeName || rr.memberId || ""), share: Number(rr.share || 0) });
  }

  // 5. セッション作成（CacheService、6時間TTL）
  var sessionId = "MSREV-" + Utilities.getUuid();
  var session = {
    sessionId: sessionId,
    projectId: projectId,
    planCycleId: planCycleId,
    revisionYm: ym,
    currentVersion: currentVersion,
    periodStartYm: String(cycle.periodStartYm || ""),
    periodEndYm: String(cycle.periodEndYm || ""),
    totalPoints: Number(cycle.totalPoints || 0),
    frozenMs: msRev_slimMs_(frozenMs, subItemsMap, msRespMap),
    revisableMs: msRev_slimMs_(revisableMs, subItemsMap, msRespMap),
    frozenPtTotal: frozenPtTotal,
    revisedMs: null,
    mapping: null,
    periodChange: null,
    chatHistory: [],
    phase: "started"
  };
  msRev_saveSession_(session);

  return JSON.parse(JSON.stringify({
    ok: true,
    sessionId: sessionId,
    planCycle: {
      planCycleId: planCycleId,
      periodStartYm: session.periodStartYm,
      periodEndYm: session.periodEndYm,
      totalPoints: session.totalPoints,
      fixedVersion: currentVersion
    },
    frozenMs: session.frozenMs,
    frozenPtTotal: frozenPtTotal,
    revisableMs: session.revisableMs
  }));
}

/**
 * 改定指示をLLMに投げて改定案を返す（何度でも呼べる）
 * @param {Object} payload - { sessionId, userText }
 */
function msRevision_chat(payload) {
  payload = payload || {};
  var sessionId = String(payload.sessionId || "").trim();
  var userText = String(payload.userText || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId required" };
  if (!userText) return { ok: false, message: "userText required" };

  var session = msRev_loadSession_(sessionId);
  if (!session) return { ok: false, message: "session not found or expired" };
  if (session.phase === "fixed") return { ok: false, message: "already fixed" };

  // プロンプト構築
  var systemPrompt = msRev_buildSystemPrompt_(session);
  var userPrompt = msRev_buildUserPrompt_(session, userText);

  // チャット履歴に追加
  session.chatHistory.push({ role: "user", content: userText });

  // LLM呼び出し（生文字列で受け取って自前でパース）
  var rawLlm;
  try {
    rawLlm = llm_call("ms_revision", systemPrompt, userPrompt, { maxTokens: 8192 });
  } catch (e) {
    return { ok: false, message: "LLM call failed: " + e.message };
  }

  // パース試行（3段階）
  var result = null;

  // 1) そのままパース
  if (rawLlm && typeof rawLlm === "string") {
    try { result = JSON.parse(rawLlm.trim()); } catch (e) {}
  }

  // 2) JSONブロック抽出
  if (!result || !Array.isArray(result.revisedMs)) {
    var extracted = msRev_extractJson_(rawLlm);
    if (extracted && Array.isArray(extracted.revisedMs)) {
      result = extracted;
    }
  }

  // 3) それでもダメ → エラー（生レスポンス先頭を返す）
  if (!result || !Array.isArray(result.revisedMs)) {
    var rawStr = String(rawLlm || "").substring(0, 800);
    Logger.log("msRevision_chat: parse failed. raw: " + rawStr);
    session.chatHistory.push({ role: "assistant", content: rawStr });
    msRev_saveSession_(session);
    return { ok: false, message: "LLM returned invalid format", raw: rawStr };
  }

  // セッションに保存
  session.revisedMs = result.revisedMs;
  session.mapping = result.mapping || [];
  session.periodChange = result.periodChange || null;
  session.phase = "reviewed";
  session.chatHistory.push({
    role: "assistant",
    content: String(result.message || "").substring(0, 500)
  });
  msRev_saveSession_(session);

  // diff生成
  var diff = msRev_buildDiff(session.revisableMs, result.revisedMs, result.mapping);

  return JSON.parse(JSON.stringify({
    ok: true,
    revisedMs: result.revisedMs,
    mapping: result.mapping || [],
    periodChange: result.periodChange || null,
    diff: diff,
    message: result.message || ""
  }));
}

/**
 * 改定案を確定してDB保存
 * @param {Object} payload - { sessionId }
 */
function msRevision_fix(payload) {
  payload = payload || {};
  var sessionId = String(payload.sessionId || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId required" };

  var session = msRev_loadSession_(sessionId);
  if (!session) return { ok: false, message: "session not found or expired" };
  if (session.phase === "fixed") return { ok: false, message: "already fixed" };
  if (!session.revisedMs || !session.revisedMs.length) {
    return { ok: false, message: "no revised milestones. run msRevision_chat first." };
  }

  var result = msRev_executeFix_(session);
  if (!result.ok) return result;

  session.phase = "fixed";
  msRev_saveSession_(session);

  return JSON.parse(JSON.stringify(result));
}

function msRevision_addToKnowledge(params) {
  try {
    var sessionId = params.sessionId;
    var projectId = params.projectId;
    var text = (params.text || "").trim();
    if (!projectId || !text) return { ok: false, message: "パラメータ不足" };

    var now = new Date();
    var jstStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy年M月d日 HH:mm");

    var ss = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var sheet = ss.getSheetByName("DB_ProjectKnowledge");
    if (!sheet) return { ok: false, message: "DB_ProjectKnowledge が見つからない" };

    sheet.appendRow([
      projectId,
      "ms_feedback",
      text,
      0,
      jstStr
    ]);

    return { ok: true };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

// ================================================================
// セッション管理（CacheService）
// ================================================================

function msRev_saveSession_(session) {
  var cache = CacheService.getScriptCache();
  var key = "msrev_" + session.sessionId;
  var json = JSON.stringify(session);
  // CacheService上限 100KB/key。超える場合は分割（Phase2で対応）
  if (json.length > 90000) {
    Logger.log("WARNING: msRevision session too large: " + json.length + " chars");
  }
  cache.put(key, json, 21600); // 6時間
}

function msRev_loadSession_(sessionId) {
  var cache = CacheService.getScriptCache();
  var key = "msrev_" + sessionId;
  var json = cache.get(key);
  if (!json) return null;
  try { return JSON.parse(json); } catch (e) { return null; }
}

// ================================================================
// ヘルパー（DB読み取り）
// ================================================================

/** projectIdからstatus=fixedのplanCycleを取得 */
function msRev_findFixedCycle_(projectId) {
  var sh = valuePlan_repo_getCycleSheet();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var idx = {};
  for (var c = 0; c < header.length; c++) {
    var k = String(header[c] || "").trim();
    if (k) idx[k] = c;
  }

  var pid = String(projectId || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][idx.projectId] || "").trim() !== pid) continue;
    if (String(all[r][idx.status] || "").trim() !== "fixed") continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      var k = String(header[c] || "").trim();
      if (k) obj[k] = all[r][c];
    }
    return obj;
  }
  return null;
}

/** planCycleIdのisActive=true MS一覧（orderNo昇順） */
function msRev_loadActiveMs_(planCycleId) {
  var sh = valuePlan_repo_getMilestoneSheet();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var idx = {};
  for (var c = 0; c < header.length; c++) {
    var k = String(header[c] || "").trim();
    if (k) idx[k] = c;
  }

  var cid = String(planCycleId || "").trim();
  var results = [];
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][idx.planCycleId] || "").trim() !== cid) continue;
    var isActive = all[r][idx.isActive];
    if (String(isActive || "") !== "true" && isActive !== true) continue;
    var obj = {};
    for (var c = 0; c < header.length; c++) {
      var k = String(header[c] || "").trim();
      if (k) obj[k] = all[r][c];
    }
    results.push(obj);
  }
  results.sort(function(a, b) {
    return Number(a.orderNo || 0) - Number(b.orderNo || 0);
  });
  return results;
}

/** MSに最新進捗%を付与 */
function msRev_attachLatestProgress_(msList, allProgress) {
  for (var i = 0; i < msList.length; i++) {
    var ms = msList[i];
    var msKey = String(ms.milestoneId || "").trim();
    var latestPct = 0;
    var latestYm = "";
    for (var p = 0; p < allProgress.length; p++) {
      var pg = allProgress[p];
      if (String(pg.milestoneKey || "").trim() !== msKey) continue;
      var pgYm = String(pg.ym || "").trim();
      if (pgYm > latestYm) {
        latestYm = pgYm;
        latestPct = Number(pg.progressPct || 0);
      }
    }
    ms.currentProgressPct = latestPct;
    ms.latestProgressYm = latestYm;
  }
}

/** セッション保存用にMSを必要フィールドだけに絞る（Cache容量対策） */
function msRev_slimMs_(msList, subItemsMap, respMap) {
  subItemsMap = subItemsMap || {};
  respMap = respMap || {};
  var result = [];
  for (var i = 0; i < msList.length; i++) {
    var m = msList[i];
    var msId = String(m.milestoneId || "");
    // サブMS
    var rawSubs = subItemsMap[msId] || [];
    var subs = [];
    for (var s = 0; s < rawSubs.length; s++) {
      var sub = rawSubs[s];
      subs.push({
        subItemId: String(sub.subItemId || ""),
        title: String(sub.title || ""),
        targetYm: String(sub.targetYm || ""),
        isDone: !!sub.isDone,
        responsibilities: sub.responsibilities || []
      });
    }
    // MS単位コミットスコア
    var msResps = respMap[msId] || [];
    result.push({
      milestoneId: msId,
      orderNo: Number(m.orderNo || 0),
      title: String(m.title || ""),
      points: Number(m.points || 0),
      tag: String(m.tag || "normal"),
      targetYm: String(m.targetYm || ""),
      successCriteria: String(m.successCriteria || ""),
      rationale: String(m.rationale || ""),
      goalLevel: String(m.goalLevel || "annual"),
      currentProgressPct: Number(m.currentProgressPct || 0),
      latestProgressYm: String(m.latestProgressYm || ""),
      subItems: subs,
      responsibilities: msResps
    });
  }
  return result;
}

// ================================================================
// プロンプト構築
// ================================================================

/** DB_TsukuyomiContext の ms_revision タグからsystem prompt取得 */
function msRev_buildSystemPrompt_(session) {
  var ctxResult = tsukuyomi_getActiveSystemPrompt({ tag: "ms_revision" });
  var dbPrompt = (ctxResult && ctxResult.systemPrompt) ? ctxResult.systemPrompt : "";
  if (!dbPrompt) {
    dbPrompt = "あなたはAMD OSのマイルストーン改定アシスタントです。JSONのみで回答してください。";
  }
  return dbPrompt;
}

/** LLMに渡すuser prompt組み立て（データ提示のみ。ルール・出力形式はDB_TsukuyomiContextに格納） */
function msRev_buildUserPrompt_(session, userText) {
  var lines = [];

  // --- PJナレッジ（DB_ProjectKnowledge） ---
  try {
    var knowledge = pk_getKnowledgeText_(session.projectId);
    if (knowledge) {
      lines.push("## プロジェクト概要（背景知識）");
      lines.push(knowledge);
    }
  } catch (e) { /* skip */ }

  // --- 現在のplanCycle情報 ---
  lines.push("## planCycle情報");
  lines.push("planCycleId: " + session.planCycleId);
  lines.push("version: " + session.currentVersion);
  lines.push("期間: " + session.periodStartYm + " 〜 " + session.periodEndYm);
  lines.push("totalPoints: " + session.totalPoints);
  lines.push("revisionYm: " + session.revisionYm + "（この月以降が改定対象）");
  lines.push("frozenPtTotal: " + session.frozenPtTotal + "（変更不可MSの合計pt）");
  lines.push("改定対象MSに配分可能なpt: " + (session.totalPoints - session.frozenPtTotal));

  // --- frozen MS ---
  lines.push("");
  lines.push("## 変更不可のMS（targetYm < " + session.revisionYm + "）");
  if (session.frozenMs.length === 0) {
    lines.push("なし");
  } else {
    for (var i = 0; i < session.frozenMs.length; i++) {
      var m = session.frozenMs[i];
      lines.push("- #" + m.orderNo + " " + m.title + " (" + m.points + "pt, target:" + m.targetYm + ", progress:" + m.currentProgressPct + "%)");
    }
  }

  // --- revisable MS（最新案 or 初期状態） ---
  lines.push("");
  lines.push("## 改定対象のMS（targetYm >= " + session.revisionYm + "）");
  var revisable = session.revisedMs || session.revisableMs;
  for (var i = 0; i < revisable.length; i++) {
    var m = revisable[i];
    var msId = m.milestoneId || m.originMsId || "";
    lines.push("- #" + (m.orderNo || (i + 1)) + " [" + msId + "] " + m.title
      + " (" + m.points + "pt, tag:" + (m.tag || "normal")
      + ", target:" + (m.targetYm || "なし")
      + ", progress:" + (m.currentProgressPct || 0) + "%)"
      + (m.successCriteria ? "\n  successCriteria: " + m.successCriteria : ""));
  }

  // --- チャット履歴（直近5件に制限） ---
  var recent = session.chatHistory.slice(-5);
  if (recent.length > 0) {
    lines.push("");
    lines.push("## これまでの会話");
    for (var i = 0; i < recent.length; i++) {
      lines.push("[" + recent[i].role + "] " + String(recent[i].content || "").substring(0, 300));
    }
  }

  // --- ユーザーの改定指示 ---
  lines.push("");
  lines.push("## ユーザーの改定指示");
  lines.push(userText);

  return lines.join("\n");
}

/** LLMレスポンスからJSONを抽出するフォールバック */
function msRev_extractJson_(raw) {
  if (!raw) return null;
  var str = (typeof raw === "string") ? raw : JSON.stringify(raw);

  // ```json ... ``` ブロックを探す
  var m = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m && m[1]) {
    try { return JSON.parse(m[1].trim()); } catch (e) {}
  }

  // { で始まる最大のJSONブロックを探す
  var start = str.indexOf("{");
  if (start >= 0) {
    var depth = 0;
    for (var i = start; i < str.length; i++) {
      if (str[i] === "{") depth++;
      else if (str[i] === "}") depth--;
      if (depth === 0) {
        try { return JSON.parse(str.substring(start, i + 1)); } catch (e) {}
        break;
      }
    }
  }

  return null;
}