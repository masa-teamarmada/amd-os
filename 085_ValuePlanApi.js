/**
 * 085_ValuePlanApi.gs
 * 年間価値設計（planCycle / milestones / version）をLLMと作るAPI
 *
 * public API:
 *  - valuePlan_start
 *  - valuePlan_chat
 *  - valuePlan_fix
 *
 * 依存:
 *  - getSheet_ / ensureHeader_（既存）
 *  - isAdmin_（あれば使う。無ければ無条件で許可）
 */

function valuePlan_start(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const periodStartYm = String(payload.periodStartYm || "").trim();
  const periodEndYm = String(payload.periodEndYm || "").trim();
  const budgetYen = Number(payload.budgetYen || 0);

  if (!projectId) return { ok:false, message:"projectId empty" };

  const v = valuePlan_validateMeta({ periodStartYm, periodEndYm, budgetYen });
  if (!v.ok) return { ok:false, message:v.message };

  const sessionId = "vps-" + String(Date.now()) + "-" + Math.random().toString(36).slice(2,8);

  // draft保存（DB）
  const draft = {
    sessionId,
    projectId,
    status: "draft",
    periodStartYm,
    periodEndYm,
    budgetYen,
    createdBy: valuePlan_getUserEmail(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  valuePlan_repo_upsertDraft(draft);

  // chat seed
  const seedMsg =
`年間価値設計を開始するよ。
まず「期末（${periodEndYm}時点）にどうなってるべきか」を短く書いて。
成果物/数字/状態（例：契約更新、PoC完了、実験データ取得、提案書提出、投資判断など）が入ると強い。`;

  valuePlan_repo_appendChat(sessionId, "system", seedMsg);

  return {
    ok:true,
    sessionId,
    draft,
    assistantMessage: seedMsg,
    milestones: [] // start時点では空
  };
}

function valuePlan_chat(payload){
  payload = payload || {};
  const sessionId = String(payload.sessionId || "").trim();
  const userMessage = String(payload.userMessage || "").trim();

  if (!sessionId) return { ok:false, message:"sessionId empty" };
  if (!userMessage) return { ok:false, message:"userMessage empty" };

  const draft = valuePlan_repo_getDraft(sessionId);
  if (!draft) return { ok:false, message:"draft not found" };

  // user message log
  valuePlan_repo_appendChat(sessionId, "user", userMessage);

  // LLMに投げるコンテキスト（直近だけでOK：長すぎると死ぬ）
  const chat = valuePlan_repo_getChatTail(sessionId, 16);

  const llmRes = valuePlan_callLlmForPlan({
    projectId: draft.projectId,
    periodStartYm: draft.periodStartYm,
    periodEndYm: draft.periodEndYm,
    budgetYen: draft.budgetYen,
    chat
  });

  if (!llmRes.ok){
    const msg = `LLM失敗: ${String(llmRes.message || "unknown error")}`;
    valuePlan_repo_appendChat(sessionId, "assistant", msg);
    return { ok:true, assistantMessage: msg, milestones: [], draft };
  }

  const assistantMessage = String(llmRes.assistantMessage || "").trim() || "了解。続けて答えて。";
  const milestones = Array.isArray(llmRes.milestones) ? llmRes.milestones : [];

  // サニタイズ（title空は落とす）
  const ms2 = milestones
    .map(m => ({
      title: String(m.title || "").trim(),
      points: Number(m.points || 0),
      tag: (String(m.tag || "").trim() === "buffer") ? "buffer" : "normal",
      successCriteria: String(m.successCriteria || "").trim(),
      rationale: String(m.rationale || "").trim()
    }))
    .filter(m => m.title);

  // pointsが入ってる場合、合計が100になるように補正（LLMが崩すことあるので保険）
  const fixed = valuePlan_fixPointsTo100(ms2);

  valuePlan_repo_appendChat(sessionId, "assistant", assistantMessage);

  // draft更新（updatedAtだけ）
  draft.updatedAt = new Date().toISOString();
  valuePlan_repo_upsertDraft(draft);

  return {
    ok:true,
    assistantMessage,
    milestones: fixed,
    draft
  };
}

function valuePlan_fix(payload){
  payload = payload || {};
  const sessionId = String(payload.sessionId || "").trim();
  const milestones = Array.isArray(payload.milestones) ? payload.milestones : [];
  const reason = String(payload.reason || "").trim();

  if (!sessionId) return { ok:false, message:"sessionId empty" };
  const draft = valuePlan_repo_getDraft(sessionId);
  if (!draft) return { ok:false, message:"draft not found" };

  const ms = milestones.map(m => ({
    title: String(m.title || "").trim(),
    points: Number(m.points || 0),
    tag: (String(m.tag || "").trim() === "buffer") ? "buffer" : "normal",
    successCriteria: String(m.successCriteria || "").trim(),
    rationale: String(m.rationale || "").trim()
  })).filter(m => m.title);

  const sum = ms.reduce((s, m) => s + Number(m.points||0), 0);
  if (sum !== 100) return { ok:false, message:`milestones points sum must be 100 (got ${sum})` };

  // planCycleId生成（固定）
  const planCycleId = valuePlan_buildPlanCycleId(draft.projectId, draft.periodStartYm, draft.periodEndYm);

  // 既存cycle取得
  const cur = valuePlan_repo_getPlanCycle(planCycleId);

  let nextVersion = 1;
  if (cur && cur.fixedVersion){
    nextVersion = Number(cur.fixedVersion || 0) + 1;
    // revision log
    valuePlan_repo_appendRevisionLog({
      planCycleId,
      fromVersion: Number(cur.fixedVersion || 0),
      toVersion: nextVersion,
      reason: reason || "revision",
      changedBy: valuePlan_getUserEmail(),
      changedAt: valuePlan_nowJstIso()
    });
  }

  const nowJst = valuePlan_nowJstIso();
  const operator = valuePlan_getUserEmail();

  // cycle upsert（status=fixed）
  valuePlan_repo_upsertPlanCycle({
    planCycleId,
    projectId: draft.projectId,
    periodStartYm: draft.periodStartYm,
    periodEndYm: draft.periodEndYm,
    budgetYen: Number(draft.budgetYen || 0),
    totalPoints: 100,
    status: "fixed",
    fixedVersion: nextVersion,
    fixedAt: nowJst,
    fixedBy: operator,
    updatedAt: nowJst
  });

  // milestones保存（version付き）
  valuePlan_repo_writeMilestonesForVersion(planCycleId, nextVersion, ms);

  // draft status
  draft.status = "fixed";
  draft.updatedAt = nowJst;
  valuePlan_repo_upsertDraft(draft);

  valuePlan_repo_appendChat(sessionId, "system", `確定したよ。planCycleId=${planCycleId} version=${nextVersion}`);

  return {
    ok:true,
    planCycleId,
    version: nextVersion
  };
}

/** ===== helpers ===== */

function valuePlan_validateMeta(meta){
  const periodStartYm = String(meta.periodStartYm || "").trim();
  const periodEndYm = String(meta.periodEndYm || "").trim();
  const budgetYen = Number(meta.budgetYen || 0);

  const re = /^\d{6}$/;
  if (!re.test(periodStartYm)) return { ok:false, message:"periodStartYm invalid (yyyymm)" };
  if (!re.test(periodEndYm)) return { ok:false, message:"periodEndYm invalid (yyyymm)" };
  if (budgetYen <= 0) return { ok:false, message:"budgetYen must be > 0" };
  if (Number(periodEndYm) < Number(periodStartYm)) return { ok:false, message:"periodEndYm must be >= periodStartYm" };
  return { ok:true };
}

function valuePlan_buildPlanCycleId(projectId, startYm, endYm){
  return `PC-${String(projectId||"").trim()}-${String(startYm||"").trim()}-${String(endYm||"").trim()}`;
}

function valuePlan_getUserEmail(){
  try{
    const e = Session.getActiveUser().getEmail();
    return String(e || "").toLowerCase().trim();
  } catch(e){}
  return "";
}

function valuePlan_nowJstIso(){
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function valuePlan_fixPointsTo100(ms){
  // pointsが全て0なら「未配点」とみなし、そのまま返す
  const sum = ms.reduce((s, m) => s + Number(m.points||0), 0);
  if (sum === 0) return ms;

  // すでに100ならOK
  if (sum === 100) return ms;

  // 正規化（四捨五入の誤差は末尾で吸収）
  const scaled = ms.map(m => ({
    ...m,
    points: Math.max(0, Math.round(Number(m.points||0) * 100 / sum))
  }));

  let s2 = scaled.reduce((s, m) => s + Number(m.points||0), 0);
  let diff = 100 - s2;

  // diffを先頭から配る（bufferを最後に回す）
  const idxs = scaled
    .map((m, i) => ({ i, tag:m.tag }))
    .sort((a,b) => (a.tag==="buffer") - (b.tag==="buffer"))
    .map(x => x.i);

  let k = 0;
  while (diff !== 0 && k < 5000){
    const i = idxs[k % idxs.length];
    if (diff > 0){
      scaled[i].points += 1;
      diff -= 1;
    } else {
      if (scaled[i].points > 0){
        scaled[i].points -= 1;
        diff += 1;
      }
    }
    k++;
  }
  return scaled;
}

/**
 * LLM呼び出し（既存のOpenAIラッパがある前提で、無ければok:false）
 * 期待する出力：JSON
 *  {
 *    assistantMessage: string,
 *    milestones: [{title, points, tag, successCriteria, rationale}]
 *  }
 */
function valuePlan_callLlmForPlan(ctx){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY") || "").trim();
  const model  = String(props.getProperty("OPENAI_MODEL") || "gpt-4o-mini").trim();
  if (!apiKey) return { ok:false, message:"OPENAI_API_KEY missing" };

  const projectId = String(ctx.projectId || "").trim();
  const periodStartYm = String(ctx.periodStartYm || "").trim();
  const periodEndYm = String(ctx.periodEndYm || "").trim();
  const budgetYen = Number(ctx.budgetYen || 0);

  const chat = Array.isArray(ctx.chat) ? ctx.chat : [];
  const chatText = chat.map(m => `[${String(m.role||"")}] ${String(m.content||"")}`).join("\n");

  // ===== Structured Outputs schema =====
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      assistantMessage: { type: "string" },
      milestones: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            points: { type: "number" },
            tag: { type: "string" },
            successCriteria: { type: "string" },
            rationale: { type: "string" }
          },
          required: ["title","points","tag","successCriteria","rationale"]
        }
      }
    },
    required: ["assistantMessage","milestones"]
  };

  // ===== system =====
  const system = [
    "あなたはディープテックスタートアップスタジオ（AMD）のPMに対して、年間価値100ポイントの『マイルストーン設計』と『配点案』を作るアシスタント。",
    "",
    "目的：",
    "- 期末のあるべき姿を明確化する",
    "- そこに到達するためのマイルストーン（5〜20個）を作る",
    "- 配点案（合計100）を作る。予期せぬタスクのためのバッファも含める",
    "",
    "制約：",
    "- 返答は必ずJSONのみ（前後の文章は禁止）",
    "- milestones[].points 合計は必ず100",
    "- バッファ用途のマイルストーンは title の末尾に (buffer)を付ける（tag列は使わない）",
    "- 細かすぎる粒（1〜2pt連発）は統合する。でかすぎる粒（20pt超）があれば分割を検討する",
    "- successCriteria は達成条件（外部に見せられる成果）を短く",
    "- rationale はなぜその点数か短く",
    "- assistantMessage は『次にPMへ聞くべき質問』を中心に書く",
    "- 入力に根拠がない推測は禁止。盛らない",
    "",
    "出力例（JSONのみ）:",
    "{",
    "  \"assistantMessage\": \"次は…を教えて。\",",
    "  \"milestones\": [",
    "    {\"title\":\"…\",\"points\":10,\"tag\":\"normal\",\"successCriteria\":\"…\",\"rationale\":\"…\"}",
    "  ]",
    "}"
  ].join("\n");

  const user = [
    `projectId=${projectId}`,
    `period=${periodStartYm}..${periodEndYm}`,
    `budgetYen=${budgetYen}`,
    "",
    "=== chat ===",
    chatText
  ].join("\n");

  const input = [
    { role:"system", content: system },
    { role:"user", content: user }
  ];

  const payload = {
    model,
    input,
    text: {
      format: {
        type: "json_schema",
        name: "value_plan_v1",
        strict: true,
        schema: schema
      }
    },
    store: false
  };

  try{
    const resp = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
      method: "post",
      muteHttpExceptions: true,
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload)
    });

    const code = resp.getResponseCode();
    const text = resp.getContentText();
    if (code < 200 || code >= 300){
      return { ok:false, message:`OpenAI API failed: ${code} ${text}` };
    }

    const json = JSON.parse(text);

    // 既存の util を再利用（同じプロジェクトにある想定）
    const outText = _openai_extractOutputText_(json);
    const parsed = JSON.parse(outText);

    return {
      ok:true,
      assistantMessage: String(parsed.assistantMessage || "").trim(),
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : []
    };
  } catch(e){
    return { ok:false, message:String(e?.message || e) };
  }
}

