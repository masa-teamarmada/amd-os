/** 161_TsukuyomiMsDesign.gs
 * つくよみMS設計モード（フォーム＋レビューチャット版）。
 * Phase1: フォームで質問に一括回答 → Phase2: LLMがMS案を生成 → チャットでレビュー → 確定
 *
 * 公開関数：
 *  - tsukuyomiMsDesign_start(projectId) — フォーム表示用データを返す
 *  - tsukuyomiMsDesign_saveDraft(sessionId, answers) — 下書き保存
 *  - tsukuyomiMsDesign_generate(sessionId) — MS案生成
 *  - tsukuyomiMsDesign_reply(sessionId, userText) — レビューチャット
 *  - tsukuyomiMsDesign_fix(sessionId) — MS案を仮確定してDB保存
 *  - tsukuyomiMsDesign_backToHearing(sessionId) — フォームに戻す
 *
 * 依存：
 *  - 162_TsukuyomiSessionRepo.gs
 *  - 163_LlmRouter.gs
 *  - 164_MsHearingConfigRepo.gs
 *  - 086_ValuePlanRepo.gs（MS保存）
 */

// ===== 起動 =====

/**
 * MS設計モーダルを開く。PJタイプに応じた質問一覧＋下書きを返す。
 * 既存セッションがあれば復元。
 * @param {string} projectId
 * @return {object} { ok, sessionId, phase, questions, answers, milestones?, conversationLog? }
 */
function tsukuyomiMsDesign_start(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId empty" };

  var pj = msDesign_getProject_(projectId);
  if (!pj) return { ok: false, message: "project not found: " + projectId };

  // Config必須項目チェック
  var feeAmount = Number(pj.feeAmount || 0);
  var feeType = String(pj.feeType || "").trim();
  if (!feeType) {
    return { ok: false, message: "先にConfigで「業務委託料タイプ」を設定してね" };
  }
  if (feeType !== "variable" && feeAmount <= 0) {
    return { ok: false, message: "先にConfigで「業務委託料額」を設定してね" };
  }
  var pjStartYm = String(pj.startYm || "").trim();
  if (!/^\d{6}$/.test(pjStartYm)) {
    return { ok: false, message: "先にConfigで「PJ開始月」を設定してね" };
  }

  // endYmがあればデフォルト計画月数を算出、なければ12ヶ月
  var pjEndYm = String(pj.endYm || "").trim();
  var suggestedPlanMonths = 12;
  if (/^\d{6}$/.test(pjEndYm)) {
    suggestedPlanMonths = msDesign_calcMonths_(pjStartYm, pjEndYm);
    if (suggestedPlanMonths < 1) suggestedPlanMonths = 12;
  }

  var projectType = String(pj.projectType || "dtsu").trim();

  var items = (typeof msHearing_listByType === "function")
    ? msHearing_listByType(projectType)
    : msHearing_listActive();
  if (!items || !items.length) return { ok: false, message: "no hearing items configured" };

  var questions = items.map(function(it) {
    return {
      itemId: it.itemId,
      question: it.question,
      description: it.description || "",
      category: it.category || ""
    };
  });

  var members = msDesign_getProjectMembers_(projectId);

  var existing = tsukuyomiSession_getActiveByProject(projectId);
  if (existing) {
    var hc = existing.hearingContext || {};
    var result = {
      ok: true,
      sessionId: existing.sessionId,
      phase: existing.phase,
      questions: questions,
      answers: hc.answeredItems || {},
      members: members,
      suggestedPlanMonths: suggestedPlanMonths,
      planMonths: hc.planMonths || null,
      feeType: feeType,
      feeAmount: feeAmount,
      budgetYen: hc.budgetYen || null,
      resumed: true
    };
    if (existing.phase === "review" && Array.isArray(existing.generatedMsJson) && existing.generatedMsJson.length > 0) {
      result.milestones = existing.generatedMsJson;
      result.conversationLog = hc.conversationLog || [];
    }
    return JSON.parse(JSON.stringify(result));
  }

  var sessionId = "msd-" + projectId + "-" + Date.now();
  tsukuyomiSession_upsert({
    sessionId: sessionId,
    threadTs: "",
    channelId: "",
    projectId: projectId,
    mode: "ms_design",
    phase: "hearing",
    hearingContext: { answeredItems: {}, conversationLog: [] },
    generatedMsJson: []
  });

  return JSON.parse(JSON.stringify({
    ok: true,
    sessionId: sessionId,
    phase: "hearing",
    questions: questions,
    answers: {},
    members: members,
    suggestedPlanMonths: suggestedPlanMonths,
    feeType: feeType,
    feeAmount: feeAmount,
    resumed: false
  }));
}

// ===== 下書き保存 =====

/**
 * フォーム入力内容をセッションDBに保存。
 * @param {string} sessionId
 * @param {object} answers  { itemId: "回答テキスト", ... }
 * @return {object} { ok, savedCount }
 */
function tsukuyomiMsDesign_saveDraft(sessionId, answers) {
  sessionId = String(sessionId || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId empty" };

  var session = tsukuyomiSession_getById(sessionId);
  if (!session) return { ok: false, message: "session not found" };

  var hc = session.hearingContext || {};
  var cleaned = {};
  var keys = Object.keys(answers || {});
  for (var i = 0; i < keys.length; i++) {
    var text = String(answers[keys[i]] || "").trim();
    if (text) cleaned[keys[i]] = text;
  }
  hc.answeredItems = cleaned;

  tsukuyomiSession_upsert({
    sessionId: sessionId,
    threadTs: "",
    channelId: "",
    projectId: session.projectId,
    mode: "ms_design",
    phase: session.phase === "review" ? "hearing" : (session.phase || "hearing"),
    hearingContext: hc,
    generatedMsJson: session.generatedMsJson
  });

  return { ok: true, savedCount: Object.keys(cleaned).length };
}

// ===== MS生成 =====

/**
 * フォーム回答からMS案を生成する。
 * @param {string} sessionId
 * @return {object} { ok, phase, message, milestones?, summary? }
 */
function tsukuyomiMsDesign_generate(sessionId, planMonths, budgetYen) {
  sessionId = String(sessionId || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId empty" };

  planMonths = parseInt(planMonths) || 0;
  if (planMonths < 1) return { ok: false, message: "計画期間（月数）を入力してね🌙" };

  budgetYen = Number(budgetYen || 0);

  var session = tsukuyomiSession_getById(sessionId);
  if (!session) return { ok: false, message: "session not found" };

  var hc = session.hearingContext || {};
  hc.planMonths = planMonths;
  if (budgetYen > 0) hc.budgetYen = budgetYen;
  session.hearingContext = hc;
  var answered = hc.answeredItems || {};

  if (Object.keys(answered).length === 0) {
    return { ok: false, message: "回答が1つもないよ。少なくとも1つは入力してね🌙" };
  }

  return msDesign_generateMs_(sessionId, session.projectId, hc);
}

// ===== レビューチャット =====

/**
 * レビュー段階でのチャットメッセージを処理。
 * @param {string} sessionId
 * @param {string} userText
 * @return {object} { ok, phase, message, milestones? }
 */
function tsukuyomiMsDesign_reply(sessionId, userText) {
  sessionId = String(sessionId || "").trim();
  userText = String(userText || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId empty" };
  if (!userText) return { ok: false, message: "text empty" };

  var session = tsukuyomiSession_getById(sessionId);
  if (!session) return { ok: false, message: "session not found" };

  var phase = String(session.phase || "").trim();
  if (phase !== "review") {
    return { ok: false, message: "レビュー段階じゃないよ（現在: " + phase + "）" };
  }

  // 会話ログにユーザー発言を追記
  var hc = session.hearingContext || {};
  if (!Array.isArray(hc.conversationLog)) hc.conversationLog = [];
  hc.conversationLog.push({ role: "user", text: userText });
  session.hearingContext = hc;

  return msDesign_handleReview_(session, userText);
}

// ===== フォームに戻す =====

/**
 * レビュー段階からフォームに戻す。
 * @param {string} sessionId
 * @return {object} { ok }
 */
function tsukuyomiMsDesign_backToHearing(sessionId) {
  sessionId = String(sessionId || "").trim();
  if (!sessionId) return { ok: false, message: "sessionId empty" };

  var session = tsukuyomiSession_getById(sessionId);
  if (!session) return { ok: false, message: "session not found" };

  tsukuyomiSession_updatePhase(sessionId, "hearing");
  return { ok: true };
}

// ===== 確定 =====

/**
 * MS案を仮確定してDB保存。
 * @param {string} sessionId
 * @return {object} { ok, planCycleId, milestoneCount }
 */
function tsukuyomiMsDesign_fix(sessionId) {
  var session = tsukuyomiSession_getById(sessionId);
  if (!session) return { ok: false, message: "session not found" };
  if (session.phase === "fixed") return { ok: false, message: "already fixed" };

  var ms = session.generatedMsJson;
  if (!Array.isArray(ms) || !ms.length) return { ok: false, message: "no milestones" };

  var projectId = session.projectId;
  var now = new Date();
  var hc = session.hearingContext || {};
  var planMonths = Number(hc.planMonths || 12);
  var totalPoints = planMonths * 10;

  var pj = msDesign_getProject_(projectId);
  var pjStartYm = String((pj && pj.startYm) || "").trim();
  var feeAmount = Number((pj && pj.feeAmount) || 0);
  var budgetYen = Number(hc.budgetYen || 0);
  if (budgetYen <= 0) budgetYen = feeAmount * planMonths;

  // 期間はtargetYmから推定
  var periodStartYm = pjStartYm;
  var periodEndYm = "";
  var ymMin = "999999", ymMax = "000000";
  for (var t = 0; t < ms.length; t++) {
    var tym = String(ms[t].targetYm || "").trim();
    if (/^\d{6}$/.test(tym)) {
      if (tym < ymMin) ymMin = tym;
      if (tym > ymMax) ymMax = tym;
    }
  }
  if (!periodStartYm && ymMin !== "999999") periodStartYm = ymMin;
  if (ymMax !== "000000") periodEndYm = ymMax;
  if (!periodEndYm && periodStartYm) {
    // planMonthsから算出
    var sy = parseInt(periodStartYm.substring(0, 4), 10);
    var sm = parseInt(periodStartYm.substring(4, 6), 10) - 1;
    var endDate = new Date(sy, sm + planMonths - 1, 1);
    periodEndYm = Utilities.formatDate(endDate, "Asia/Tokyo", "yyyyMM");
  }

  var planCycleId = "PC-" + projectId + "-" + periodStartYm + "-" + periodEndYm;
  var nowStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  valuePlan_repo_upsertPlanCycle({
    planCycleId: planCycleId,
    projectId: projectId,
    periodStartYm: periodStartYm,
    periodEndYm: periodEndYm,
    budgetYen: budgetYen,
    totalPoints: totalPoints,
    status: "fixed",
    fixedVersion: 1,
    fixedAt: nowStr,
    fixedBy: "tsukuyomi_ms_design",
    updatedAt: nowStr
  });

  var msForDb = ms.map(function(m) {
    return {
      title: String(m.title || "").trim(),
      points: Number(m.points || 0),
      tag: String(m.tag || "normal").trim(),
      successCriteria: String(m.successCriteria || "").trim(),
      rationale: String(m.rationale || "").trim(),
      targetYm: String(m.targetYm || "").trim()
    };
  });

  var milestoneIds = valuePlan_repo_writeMilestonesForVersion(planCycleId, 1, msForDb);

  var idList = milestoneIds || [];
  for (var i = 0; i < ms.length; i++) {
    var resps = ms[i].responsibilities;
    if (!Array.isArray(resps) || !resps.length) continue;
    var msKey = (idList[i]) ? String(idList[i]) : "";
    if (!msKey) continue;
    for (var r = 0; r < resps.length; r++) {
      var resp = resps[r];
      var share = Number(resp.share || 0);
      if (share <= 0) continue;
      try {
        rv2_upsertResponsibility({
          projectId: projectId,
          planCycleId: planCycleId,
          milestoneKey: msKey,
          ym: "",
          memberId: String(resp.memberId || "").trim(),
          share: share,
          source: "tsukuyomi_ms_design",
          updatedAtJst: nowStr
        });
      } catch (e) {}
    }
  }

  tsukuyomiSession_updatePhase(sessionId, "fixed");

  return JSON.parse(JSON.stringify({
    ok: true, planCycleId: planCycleId, milestoneCount: msForDb.length,
    totalPoints: totalPoints, budgetYen: budgetYen
  }));
}

// ============================================================
// 内部関数
// ============================================================

// ----- MS生成本体 -----
function msDesign_generateMs_(sessionId, projectId, hearingContext) {
  var answered = hearingContext.answeredItems || {};
  var planMonths = Number(hearingContext.planMonths || 12);
  var totalPoints = planMonths * 10;

  var pj = msDesign_getProject_(projectId);
  var pjName = pj ? String(pj.projectName || projectId) : projectId;
  var projectType = String((pj && pj.projectType) || "dtsu").trim();
  var pjStartYm = String((pj && pj.startYm) || "").trim();

  var items = (typeof msHearing_listByType === "function")
    ? msHearing_listByType(projectType)
    : msHearing_listActive();
  if (!items || !items.length) items = [];

  var contextLines = [];
  var knownIds = {};
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    knownIds[item.itemId] = true;
    var ansText = String(answered[item.itemId] || "").trim();
    if (ansText) {
      contextLines.push("【" + (item.category || "") + "】" + item.question);
      contextLines.push(ansText);
      contextLines.push("");
    }
  }
  var ansKeys = Object.keys(answered);
  for (var k = 0; k < ansKeys.length; k++) {
    if (!knownIds[ansKeys[k]]) {
      var extra = String(answered[ansKeys[k]] || "").trim();
      if (extra) {
        contextLines.push("【その他】");
        contextLines.push(extra);
        contextLines.push("");
      }
    }
  }

  var members = msDesign_getProjectMembers_(projectId);
  var memberLines = [];
  for (var mi = 0; mi < members.length; mi++) {
    var mb = members[mi];
    memberLines.push("- " + mb.codeName + " (id=" + mb.memberId + "): " + (mb.skillProfile || "スキル情報なし"));
  }

  var systemPrompt = [
    "あなたはディープテックスタートアップスタジオ（AMD）のマイルストーン設計アシスタント。",
    "ヒアリング結果とメンバー情報をもとに、マイルストーン設計案を作る。",
    "",
    "ルール：",
    "- MS数は5〜15個",
    "- points合計は必ず" + totalPoints + "（計画期間" + planMonths + "ヶ月 × 10pt/月）",
    "- 予期せぬタスク用のbuffer枠を1つ含める（tagをbufferにする）",
    "- 細かすぎる粒（1〜2pt）は統合、大きすぎる粒（" + Math.round(totalPoints * 0.25) + "pt超）は分割を検討",
    "- successCriteriaは「何が完了したら達成か」を具体的に",
    "- タグ（normal/buffer）を明示",
    "- 各MSに完了目標月（targetYm）をyyyymm形式で設定。開始月は" + pjStartYm,
    "- 各MSにメンバー責任配分（responsibilities）を設定。shareの合計は1.0にする",
    "- 返答はJSONのみ。前後の文章は禁止",
    "",
    "JSONスキーマ：",
    "{",
    '  "summary": "ヒアリングを踏まえた総括（2〜3文）",',
    '  "milestones": [',
    '    {',
    '      "title": "...",',
    '      "points": 10,',
    '      "tag": "normal",',
    '      "successCriteria": "...",',
    '      "rationale": "...",',
    '      "targetYm": "202509",',
    '      "responsibilities": [',
    '        { "memberId": "m01", "codeName": "まさ", "share": 0.6 },',
    '        { "memberId": "m02", "codeName": "きよ", "share": 0.4 }',
    '      ]',
    '    }',
    "  ]",
    "}"
  ].join("\n");

  var userPrompt = [
    "プロジェクト: " + pjName + " (projectId=" + projectId + ", type=" + projectType + ")",
    "計画期間: " + planMonths + "ヶ月（開始月: " + pjStartYm + "）",
    "totalPoints: " + totalPoints,
    "",
    "=== 参加メンバー ===",
    memberLines.length > 0 ? memberLines.join("\n") : "（メンバー情報なし）",
    "",
    "=== ヒアリング結果 ===",
    contextLines.join("\n")
  ].join("\n");

  try {
    var result = llm_callJson("tsukuyomi_ms_design", systemPrompt, userPrompt, { maxTokens: 4000 });

    if (!result || !Array.isArray(result.milestones)) {
      return {
        ok: false, phase: "hearing",
        message: "ごめん、うまくMS案が作れなかった…もう一回やってみてね🌙"
      };
    }

    var ms = msDesign_fixPointsToTotal_(result.milestones, totalPoints);
    var summary = String(result.summary || "").trim();

    var reviewMsg = "MS案ができたよ🌙\n\n" + summary;
    if (!Array.isArray(hearingContext.conversationLog)) hearingContext.conversationLog = [];
    hearingContext.conversationLog.push({ role: "assistant", text: reviewMsg });

    tsukuyomiSession_upsert({
      sessionId: sessionId,
      threadTs: "",
      channelId: "",
      projectId: projectId,
      mode: "ms_design",
      phase: "review",
      hearingContext: hearingContext,
      generatedMsJson: ms
    });

    return JSON.parse(JSON.stringify({
      ok: true, phase: "review",
      message: reviewMsg,
      milestones: ms,
      summary: summary
    }));

  } catch (e) {
    return {
      ok: false, phase: "hearing",
      message: "MS生成でエラーが起きちゃった…🌙\n（" + String(e.message || e).slice(0, 100) + "）"
    };
  }
}

// ----- レビューphase -----
function msDesign_handleReview_(session, userText) {
  var currentMs = session.generatedMsJson || [];
  var hc = session.hearingContext || {};
  var conversationLog = hc.conversationLog || [];
  var planMonths = Number(hc.planMonths || 12);
  var totalPoints = planMonths * 10;

  var members = msDesign_getProjectMembers_(session.projectId);
  var memberLines = [];
  for (var mi = 0; mi < members.length; mi++) {
    var mb = members[mi];
    memberLines.push("- " + mb.codeName + " (id=" + mb.memberId + ")");
  }

  var systemPrompt = [
    "あなたはMSレビュー補助。ユーザーの修正要望を反映してMS案を更新する。",
    "ルール：points合計" + totalPoints + "（計画" + planMonths + "ヶ月）、buffer枠1つ。各MSにtargetYm(yyyymm)とresponsibilities(share合計1.0)を維持。返答はJSONのみ。",
    "",
    "メンバー：",
    memberLines.join("\n"),
    "",
    "JSONスキーマ：",
    '{"summary":"修正内容の要約","milestones":[{"title":"...","points":10,"tag":"normal","successCriteria":"...","rationale":"...","targetYm":"202509","responsibilities":[{"memberId":"m01","codeName":"まさ","share":0.6}]}]}'
  ].join("\n");

  var userPrompt = [
    "=== 現在のMS案 ===",
    JSON.stringify(currentMs, null, 2),
    "",
    "=== 修正要望 ===",
    userText
  ].join("\n");

  try {
    var result = llm_callJson("tsukuyomi_ms_design", systemPrompt, userPrompt, { maxTokens: 4000 });

    if (!result || !Array.isArray(result.milestones)) {
      return { ok: false, phase: "review", message: "修正がうまく反映できなかった…もう一回言ってみて🌙" };
    }

    var ms = msDesign_fixPointsToTotal_(result.milestones, totalPoints);
    var summary = String(result.summary || "").trim();

    var reviewMsg = "修正版できたよ🌙\n\n" + summary;
    conversationLog.push({ role: "assistant", text: reviewMsg });
    hc.conversationLog = conversationLog;

    tsukuyomiSession_upsert({
      sessionId: session.sessionId,
      threadTs: "",
      channelId: "",
      projectId: session.projectId,
      mode: "ms_design",
      phase: "review",
      hearingContext: hc,
      generatedMsJson: ms
    });

    return JSON.parse(JSON.stringify({
      ok: true, phase: "review",
      message: reviewMsg,
      milestones: ms,
      summary: summary
    }));

  } catch (e) {
    return {
      ok: false, phase: "review",
      message: "修正処理でエラー…🌙 " + String(e.message || e).slice(0, 100)
    };
  }
}

// ----- ヘルパー -----

function msDesign_fixPointsToTotal_(milestones, totalPoints) {
  if (!Array.isArray(milestones) || milestones.length === 0) return milestones;
  totalPoints = Number(totalPoints || 100);

  var sum = 0;
  for (var i = 0; i < milestones.length; i++) {
    milestones[i].points = Math.max(0, Math.round(Number(milestones[i].points || 0)));
    sum += milestones[i].points;
  }
  if (sum === totalPoints || sum === 0) return milestones;

  var diff = totalPoints - sum;
  // buffer枠に差分を吸収させる
  for (var i = 0; i < milestones.length; i++) {
    if (String(milestones[i].tag || "").toLowerCase() === "buffer") {
      milestones[i].points = Math.max(0, milestones[i].points + diff);
      return milestones;
    }
  }
  // bufferがなければ最大ptのMSに吸収
  var maxIdx = 0;
  for (var i = 1; i < milestones.length; i++) {
    if (milestones[i].points > milestones[maxIdx].points) maxIdx = i;
  }
  milestones[maxIdx].points = Math.max(0, milestones[maxIdx].points + diff);
  return milestones;
}

function msDesign_getProject_(projectId) {
  try {
    var t = (typeof b_readTableThin_ === "function")
      ? b_readTableThin_("DB_Projects", ["projectId", "projectName", "slackChannelId", "status", "projectType", "feeType", "feeAmount", "startYm", "endYm"])
      : (typeof b_readTable_ === "function")
        ? b_readTable_("DB_Projects")
        : null;
    var rows = (t && Array.isArray(t.rows)) ? t.rows : (Array.isArray(t) ? t : []);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].projectId || "").trim() === projectId) return rows[i];
    }
  } catch (_e) {}
  return null;
}

function msDesign_currentFy_() {
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth() + 1;
  if (m < 4) y--;
  return {
    startYm: String(y) + "04",
    endYm: String(y + 1) + "03"
  };
}

function msDesign_getProjectMembers_(projectId) {
  var result = [];
  try {
    var pmRows = (typeof b_readTable_ === "function") ? b_readTable_("DB_ProjectMembers") : [];
    var mRows = (typeof b_readTable_ === "function") ? b_readTable_("DB_Members") : [];

    // グローバルスキルマップ
    var globalSkill = {};
    for (var g = 0; g < mRows.length; g++) {
      var gm = mRows[g];
      var gid = String(gm.memberId || "").trim();
      globalSkill[gid] = {
        codeName: String(gm.codeName || gm.name || gid).trim(),
        defaultSkill: String(gm.defaultSkillProfile || "").trim()
      };
    }

    for (var i = 0; i < pmRows.length; i++) {
      var pm = pmRows[i];
      if (String(pm.projectId || "").trim() !== projectId) continue;
      if (String(pm.isActive || "") === "FALSE" || pm.isActive === false) continue;
      var mid = String(pm.memberId || "").trim();
      var g = globalSkill[mid] || {};
      var skill = String(pm.skillProfile || "").trim() || g.defaultSkill || "";
      result.push({
        memberId: mid,
        codeName: g.codeName || mid,
        skillProfile: skill
      });
    }
  } catch (e) {}
  return result;
}

function msDesign_calcMonths_(startYm, endYm) {
  if (!startYm || !endYm || startYm.length !== 6 || endYm.length !== 6) return 12;
  var sy = parseInt(startYm.substring(0, 4), 10);
  var sm = parseInt(startYm.substring(4, 6), 10);
  var ey = parseInt(endYm.substring(0, 4), 10);
  var em = parseInt(endYm.substring(4, 6), 10);
  var months = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(1, months);
}