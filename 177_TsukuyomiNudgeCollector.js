/**
 * 177_TsukuyomiNudgeCollector.gs
 *
 * 役割：
 * - tsukuyomi の介入が「必要そうか」を雑に判断する
 * - Slack / Notion / Navigator を浅く拾って LLM に投げる
 * - Queue.status を planned → skipped / ready に更新
 *
 * ポリシー：
 * - 精度より自然さ
 * - ヌケモレOK
 * - JST基準
 */

function tsukuyomi_collectAndJudgeNudges(){
  const now = new Date();
  const nowJst = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");

  const qSheet = getSheet_("DB_TsukuyomiNudgeQueue");
  ensureHeader_(qSheet, [
    "nudgeId",
    "projectId",
    "projectName",
    "slackChannelId",
    "ym",
    "plannedAtJst",
    "plannedHourBucket",
    "needMention",
    "mentionMemberIdsJson",
    "status",
    "reason",
    "postedTs",
    "createdAtJst",
    "updatedAtJst"
  ]);

  const rows = qSheet.getDataRange().getValues();
  if (rows.length < 2) return { ok:true, judged:0 };

  const h = rows[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((k,i)=>{ if(k) idx[k]=i; });

  let judged = 0;

  for (let r=1; r<rows.length; r++){
    const status = String(rows[r][idx.status]||"").trim();
    if (status !== "planned") continue;

    const projectId = String(rows[r][idx.projectId]||"").trim();
    const projectName = String(rows[r][idx.projectName]||"").trim();
    const ym = Number(rows[r][idx.ym] || 0);

    const slackText = _tsukuyomi_collectSlackDigest_(projectId);
    const notionText = _tsukuyomi_collectNotionDigest_(projectId);
    const navigatorText = _tsukuyomi_collectNavigatorDigest_(projectId);

    const combined = [
      "## Slack",
      slackText || "(no recent messages)",
      "",
      "## Notion",
      notionText || "(no recent minutes)",
      "",
      "## Navigator",
      navigatorText || "(no recent progress)"
    ].join("\n");

    const judge = _tsukuyomi_llmJudgeNeedNudge_(projectName, combined);

    // reason を OBS/GAP/ASK ブロックに整形（LLMが返せない場合もここで救う）
    const reasonBlock = tsukuyomi_formatReasonBlock({
      projectId,
      projectName,
      ym,
      slackText,
      notionText,
      navigatorText,
      judge
    });

    if (!judge.needNudge){
      qSheet.getRange(r+1, idx.status+1).setValue("skipped");
      qSheet.getRange(r+1, idx.reason+1).setValue(reasonBlock || "seems progressing");
      qSheet.getRange(r+1, idx.updatedAtJst+1).setValue(nowJst);
      judged++;
      continue;
    }

    qSheet.getRange(r+1, idx.status+1).setValue("ready");
    qSheet.getRange(r+1, idx.reason+1).setValue(reasonBlock || "possible stagnation");
    qSheet.getRange(r+1, idx.updatedAtJst+1).setValue(nowJst);

    judged++;
  }

  return { ok:true, judged };
}

// ===== collectors =====

// Slack：直近7日を雑に要約（量より雰囲気）
function _tsukuyomi_collectSlackDigest_(projectId){
  try{
    if (typeof tsukuyomiFetchRecentSlackMessages !== "function") return "";
    return tsukuyomiFetchRecentSlackMessages(projectId, 7) || "";
  }catch(e){
    return "";
  }
}

// Notion：議事録の「内容」抽出物があれば使う
function _tsukuyomi_collectNotionDigest_(projectId){
  try{
    if (typeof nav_repo_collectRecentNotionText_ !== "function") return "";
    return nav_repo_collectRecentNotionText_(projectId, 7) || "";
  }catch(e){
    return "";
  }
}

// Navigator：今月の進捗があれば
function _tsukuyomi_collectNavigatorDigest_(projectId){
  try{
    if (typeof nav_repo_collectNavigatorProgress_ !== "function") return "";
    return nav_repo_collectNavigatorProgress_(projectId) || "";
  }catch(e){
    return "";
  }
}


// ===== LLM =====
function _tsukuyomi_llmJudgeNeedNudge_(projectName, materialText){
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY")||"").trim();
  const model = String(props.getProperty("OPENAI_MODEL")||"gpt-4o-mini").trim();
  if (!apiKey) return { needNudge:true, reason:"no api key", obs:[], gap:"", ask:"" };

  const system = [
    "あなたはプロジェクトの進捗を眺めて、",
    "『今は声をかけなくても良さそうか / ちょっと聞いた方が良さそうか』を雑に判断する。",
    "",
    "出力は次の形式にする：",
    "- needNudge: boolean",
    "- reason: 日本語1文（短い）",
    "- obs: 観測できた事実を最大3本（嘘を書かない）",
    "- gap: 足りない情報を最大1本（無ければ空）",
    "- ask: 相手に投げるべき質問の軸を最大1本（無ければ空）",
    "",
    "精度より自然さ。",
    "進んでそうなら needNudge=false。",
    "止まってそう・判断が止まってそうなら needNudge=true。"
  ].join("\n");

  const user = [
    `PJ: ${String(projectName||"")}`,
    "",
    materialText
  ].join("\n");

  const payload = {
    model,
    input: [
      { role:"system", content: system },
      { role:"user", content: user }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "nudge_judge_v2",
        strict: true,
        schema: {
          type:"object",
          properties:{
            needNudge:{ type:"boolean" },
            reason:{ type:"string" },
            obs:{
              type:"array",
              items:{ type:"string" }
            },
            gap:{ type:"string" },
            ask:{ type:"string" }
          },
          required:["needNudge","reason","obs","gap","ask"]
        }
      }
    }
  };

  try{
    const res = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
      method:"post",
      headers:{
        "Authorization":"Bearer "+apiKey,
        "Content-Type":"application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions:true
    });

    const json = JSON.parse(res.getContentText());
    const out = json.output_text || _openai_extractOutputText_(json);
    const parsed = JSON.parse(out);

    // 保険：型ゆれ救済
    return {
      needNudge: !!parsed.needNudge,
      reason: String(parsed.reason || "").trim(),
      obs: Array.isArray(parsed.obs) ? parsed.obs.map(x=>String(x||"").trim()).filter(Boolean).slice(0,3) : [],
      gap: String(parsed.gap || "").trim(),
      ask: String(parsed.ask || "").trim()
    };
  }catch(e){
    // 壊れたら「聞いてみる側」に倒す（人間っぽく）
    return { needNudge:true, reason:"判断材料が少ないため確認したい", obs:[], gap:"", ask:"" };
  }
}

function tsukuyomi_formatReasonBlock(ctx){
  ctx = ctx || {};
  const projectId = String(ctx.projectId || "").trim();
  const projectName = String(ctx.projectName || "").trim();
  const ym = Number(ctx.ym || 0);

  const slackText = String(ctx.slackText || "").trim();
  const notionText = String(ctx.notionText || "").trim();
  const navigatorText = String(ctx.navigatorText || "").trim();

  const judge = ctx.judge || {};
  const reason = String(judge.reason || "").trim();
  const obs = Array.isArray(judge.obs) ? judge.obs.map(x=>String(x||"").trim()).filter(Boolean).slice(0,3) : [];
  const gap = String(judge.gap || "").trim();
  const ask = String(judge.ask || "").trim();

  // LLMがobsを返さないときの最低限の観測（嘘なし）
  const obs2 = obs.slice();
  if (!obs2.length){
    if (slackText) obs2.push("Slackに直近ログがある");
    else obs2.push("Slackの直近ログが薄い/空");

    if (notionText) obs2.push("Notionに直近の議事録素材がある");
    else obs2.push("Notionの直近議事録素材が薄い/空");

    if (navigatorText) obs2.push("Navigatorに直近の進捗素材がある");
    else obs2.push("Navigatorの直近進捗素材が薄い/空");
  }

  const lines = [];
  lines.push(`OBS: ${obs2.slice(0,3).join(" / ")}`);

  if (gap){
    lines.push(`GAP: ${gap}`);
  }

  if (ask){
    lines.push(`ASK: ${ask}`);
  } else {
    // askが空なら、素材の欠け方で雑に補う（断定しない）
    if (!navigatorText){
      lines.push("ASK: 今週の進捗、ひとことだけ拾いたい");
    } else {
      lines.push("ASK: いま詰まってるのが判断/作業/待ちのどれか知りたい");
    }
  }

  if (reason){
    lines.push(`NOTE: ${reason}`);
  }

  // ヘッダは短く（セル内で読めるように）
  const head = [];
  if (projectName) head.push(projectName);
  if (projectId) head.push(projectId);
  if (ym) head.push(String(ym));
  const headStr = head.length ? `PJ=${head.join(" / ")}` : "";

  return [headStr, ...lines].filter(Boolean).join("\n");
}
