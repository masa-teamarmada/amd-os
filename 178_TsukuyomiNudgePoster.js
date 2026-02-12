/**
 * 178_TsukuyomiNudgePoster.gs
 *
 * 役割：
 * - DB_TsukuyomiNudgeQueue の status=ready を見て、予定時刻になったら投稿する
 * - 投稿内容は LLM で「拾った事実ベースの質問」にする（雑でOK）
 * - 夜間(20-8)はメンション絶対なし
 *
 * 依存：
 * - 185_SlackNotify.gs: slack_callApi
 * - 115_SlackNotify.gs: slackNotifyPostToChannelTsukuyomi_（あれば使う）
 * - B_Sheets.gs: b_readTableThin_（あれば使う）
 */

function tsukuyomi_runNudgePosterTick(){
  const now = new Date();
  const jstHour = Number(Utilities.formatDate(now, "Asia/Tokyo", "H"));
  const jstMin  = Number(Utilities.formatDate(now, "Asia/Tokyo", "m"));
  const nowJst  = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");

  // 投稿可能時間：10:30〜18:30
  const inWindow =
    (jstHour > 10 && jstHour < 18) ||
    (jstHour === 10 && jstMin >= 30) ||
    (jstHour === 18 && jstMin <= 30);

  if (!inWindow){
    return { ok:true, posted:0, note:"out of posting window" };
  }

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

  const vals = qSheet.getDataRange().getValues();
  if (vals.length < 2) return { ok:true, posted:0 };

  const h = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  h.forEach((k,i)=>{ if(k) idx[k]=i; });

  let posted = 0;

  for (let r=1; r<vals.length; r++){
    const status = String(vals[r][idx.status]||"").trim();
    if (status !== "ready") continue;

    const nudgeId = String(vals[r][idx.nudgeId]||"").trim();
    const projectId = String(vals[r][idx.projectId]||"").trim();
    const projectName = String(vals[r][idx.projectName]||"").trim();
    const channelId = String(vals[r][idx.slackChannelId]||"").trim();
    const bucketHour = Number(vals[r][idx.plannedHourBucket]||"0");

    // ★ym を読む（観測ブロックに使う）
    const ym = Number(vals[r][idx.ym] || 0);

    if (!projectId || !channelId) continue;

    // 予定分散：bucketHour に到達してること + 分は nudgeId から擬似ランダム
    const plannedMin = _tsukuyomi_plannedMinuteFromId_(nudgeId);
    const due = (jstHour > bucketHour) || (jstHour === bucketHour && jstMin >= plannedMin);
    if (!due) continue;

    // メンション判断（夜間禁止）
    const isNight = (jstHour >= 20 || jstHour < 8);
    let needMention = false;
    let mentionIds = [];

    if (!isNight){
      const okMention = _tsukuyomi_shouldMentionNow_(projectId, channelId);
      if (okMention){
        mentionIds = _tsukuyomi_listProjectMemberSlackIds_(projectId);
        mentionIds = mentionIds.filter(x=>x); // 空除外
        if (mentionIds.length) needMention = true;
      }
    }

    // 投稿文生成：事実ベース（雑でOK）
    const slackDigest = _tsukuyomi_fetchSlackDigestForQuestion_(channelId, 7);
    const promptReason = String(vals[r][idx.reason]||"").trim();

    // ★ここが肝：projectId/ym を渡して観測ブロックを作れるようにする
    const msg = _tsukuyomi_llmBuildQuestion_({
      projectId,
      projectName,
      ym,
      reason: promptReason,
      slackDigest
    });

    const mentionText = needMention
      ? mentionIds.map(id=>`<@${id}>`).join(" ") + "\n"
      : "";

    const finalText = mentionText + msg;

    // 投稿（つくよみtokenがあるなら優先）
    let res = null;
    try{
      if (typeof slackNotifyPostToChannelTsukuyomi_ === "function"){
        res = slackNotifyPostToChannelTsukuyomi_(channelId, finalText);
      } else if (typeof slack_postMessage === "function"){
        res = slack_postMessage(channelId, finalText);
      } else {
        // 最後の手段
        res = slack_callApi("chat.postMessage", { channel: channelId, text: finalText });
      }
    }catch(e){
      // 投稿失敗：readyのまま残す（次tickで再挑戦）
      _tsukuyomi_appendNudgeLog_("post_failed", {
        projectId, nudgeId, channelId, error: String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e)
      });
      continue;
    }

    const postedTs = String((res && res.ts) ? res.ts : (res && res.data && res.data.ts ? res.data.ts : "")).trim();

    // Queue更新：posted
    qSheet.getRange(r+1, idx.status+1).setValue("posted");
    qSheet.getRange(r+1, idx.needMention+1).setValue(needMention ? "true" : "false");
    qSheet.getRange(r+1, idx.mentionMemberIdsJson+1).setValue(JSON.stringify(mentionIds || []));
    qSheet.getRange(r+1, idx.postedTs+1).setValue(postedTs);
    qSheet.getRange(r+1, idx.updatedAtJst+1).setValue(nowJst);

    _tsukuyomi_appendNudgeLog_("posted", {
      projectId, nudgeId, channelId, postedTs, needMention
    });

    posted++;
  }

  return { ok:true, posted };
}

// ===== helpers =====

function _tsukuyomi_plannedMinuteFromId_(nudgeId){
  // 30-59に散らす（人間っぽさ）
  const s = String(nudgeId||"");
  let sum = 0;
  for (let i=0; i<s.length; i++){
    sum = (sum + s.charCodeAt(i)) % 997;
  }
  return 30 + (sum % 30);
}

// 「停滞連続2回 + 24h返信ゼロ」っぽい時だけメンション
function _tsukuyomi_shouldMentionNow_(projectId, channelId){
  try{
    // 1) 直近2回 posted/ready が続いてる？
    const qSheet = getSheet_("DB_TsukuyomiNudgeQueue");
    const vals = qSheet.getDataRange().getValues();
    if (vals.length < 2) return false;

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iSt  = h.indexOf("status");
    const iAt  = h.indexOf("plannedAtJst");
    const iTs  = h.indexOf("postedTs");

    const list = [];
    for (let r=1; r<vals.length; r++){
      if (String(vals[r][iPid]||"").trim() !== projectId) continue;
      const st = String(vals[r][iSt]||"").trim();
      if (st !== "ready" && st !== "posted" && st !== "merged") continue;

      list.push({
        plannedAt: String(vals[r][iAt]||"").trim(),
        status: st,
        postedTs: String((iTs>=0)?(vals[r][iTs]||""):"").trim()
      });
    }

    // 新しい順
    list.sort((a,b)=> String(b.plannedAt).localeCompare(String(a.plannedAt)));

    const recent = list.slice(0, 2);
    if (recent.length < 2) return false;

    // 2回連続で「介入必要」側に寄ってる雰囲気
    // （skipped が混ざってたらfalse）
    if (recent.some(x => x.status === "skipped")) return false;

    // 2) 直近投稿のスレッドに返信が付いてるならメンション不要
    const lastPosted = recent.find(x => x.postedTs);
    if (!lastPosted || !lastPosted.postedTs) return true; // まだ投稿無いなら軽くメンションOK側

    // 24h返信ゼロチェック（雑）
    // replies が1件（親だけ）なら返信ゼロ扱い
    try{
      const obj = slack_callApi("conversations.replies", {
        channel: String(channelId||"").trim(),
        ts: lastPosted.postedTs,
        limit: 50,
        inclusive: true
      });
      const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
      if (msgs.length <= 1) return true; // 返信ゼロ
      return false;
    }catch(e2){
      // 取れないなら「メンションしてみる」に倒す（人間っぽい）
      return true;
    }
  }catch(e){
    return false;
  }
}

function _tsukuyomi_listProjectMemberSlackIds_(projectId){
  // DB_ProjectMembers(memberId,isActive) × DB_Members(slackId)
  const pid = String(projectId||"").trim();
  if (!pid) return [];

  try{
    let pmRows = [];
    let memRows = [];

    if (typeof b_readTableThin_ === "function"){
      pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isActive"]) || [];
      memRows = b_readTableThin_("DB_Members", ["memberId","slackId","email"]) || [];
    } else {
      const shPm = getSheet_("DB_ProjectMembers");
      const shMem = getSheet_("DB_Members");
      pmRows = _readSheetAsObjects_(shPm);
      memRows = _readSheetAsObjects_(shMem);
    }

    const activeMemberIds = pmRows
      .filter(r => String(r.projectId||"").trim() === pid)
      .filter(r => String(r.isActive||"").trim().toLowerCase() === "true")
      .map(r => String(r.memberId||"").trim())
      .filter(x => x && x !== "ID017"); // info除外

    const map = {};
    memRows.forEach(r=>{
      const mid = String(r.memberId||"").trim();
      if (!mid) return;
      map[mid] = String(r.slackId||"").trim();
    });

    // uniq
    const seen = {};
    const out = [];
    activeMemberIds.forEach(mid=>{
      const sid = map[mid] || "";
      if (!sid) return;
      if (seen[sid]) return;
      seen[sid]=1;
      out.push(sid);
    });

    return out;
  }catch(e){
    return [];
  }
}

function _readSheetAsObjects_(sh){
  try{
    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return [];
    const h = vals[0].map(x=>String(x||"").trim());
    const out = [];
    for (let r=1; r<vals.length; r++){
      const row = vals[r];
      const obj = {};
      h.forEach((k,i)=>{ if(k) obj[k]=row[i]; });
      out.push(obj);
    }
    return out;
  }catch(e){
    return [];
  }
}

function _tsukuyomi_fetchSlackDigestForQuestion_(channelId, days){
  const ch = String(channelId||"").trim();
  if (!ch) return "";

  const nDays = Number(days||7);
  const oldest = (Date.now() - nDays*24*60*60*1000) / 1000;

  function isSystemSubType_(subtype){
    const st = String(subtype||"").trim().toLowerCase();
    if (!st) return false;
    // join/leave/rename/topic/purpose 等の“イベント文”
    const deny = new Set([
      "channel_join",
      "channel_leave",
      "channel_name",
      "channel_topic",
      "channel_purpose",
      "group_join",
      "group_leave"
    ]);
    return deny.has(st);
  }

  function isSystemLine_(text){
    const t = String(text||"").trim();
    if (!t) return true;

    // 日本語
    if (/参加しました|退出しました|招待しました|チャンネル名を変更しました|トピックを変更しました/.test(t)) return true;

    // <@Uxxxx>さんがチャンネルに参加しました
    if (/<@U[0-9A-Z]+>.*(参加しました|退出しました)/i.test(t)) return true;

    // 英語
    const low = t.toLowerCase();
    if (low.includes("has joined the channel")) return true;
    if (low.includes("joined the channel")) return true;
    if (low.includes("left the channel")) return true;

    return false;
  }

  try{
    const obj = slack_callApi("conversations.history", {
      channel: ch,
      oldest: oldest,
      limit: 80
    });

    const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
    const lines = [];

    for (let i=0; i<msgs.length; i++){
      const m = msgs[i] || {};
      const text = String(m.text||"").trim();
      if (!text) continue;

      // botは除外
      if (m.subtype === "bot_message" || m.bot_id) continue;

      // ★ここが本題：join/leave等のsubtypeは除外
      if (isSystemSubType_(m.subtype)) continue;

      // ★文言でも除外（subtypeが空でも混ざることがある）
      if (isSystemLine_(text)) continue;

      lines.push("- " + text.replace(/\s+/g," ").slice(0, 160));
      if (lines.length >= 20) break;
    }

    return lines.join("\n");
  }catch(e){
    return "";
  }
}

function _tsukuyomi_llmBuildQuestion_(ctx){
  ctx = ctx || {};
  const projectId = String(ctx.projectId || "").trim();
  const projectName = String(ctx.projectName || "").trim();
  const ym = ctx.ym ? Number(ctx.ym) : 0;
  const reason = String(ctx.reason || "").trim();
  const slackDigest = String(ctx.slackDigest || "").trim();

  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("OPENAI_API_KEY")||"").trim();
  const model = String(props.getProperty("OPENAI_MODEL")||"gpt-4o-mini").trim();

  // ===== 観測（事実）を揃える（嘘は作らない） =====
  let profile = null;
  let derivedStatus = "";

  try{
    if (typeof tsukuyomiGetProfileRow === "function" && projectId){
      profile = tsukuyomiGetProfileRow(projectId, "");
    }
  }catch(e){}

  try{
    if (typeof tsukuyomiGetBillingCycleRow === "function" && typeof tsukuyomiDeriveMonthlyStatusForObs === "function" && projectId && ym){
      const cycle = tsukuyomiGetBillingCycleRow(projectId, ym);
      derivedStatus = cycle ? tsukuyomiDeriveMonthlyStatusForObs(cycle) : "none";
    }
  }catch(e){}

  // ===== LLM無しフォールバック：BOT臭を消す（括弧PJ名/内部status禁止） =====
  function fallbackText(){
    const head = tsuPickFrom(Utilities.getUuid().length, [
      "最近ちょい静かめに見える…🌙",
      "ここ数日、動きが見えにくいかも…🌙",
      "今週の気配、ちょい薄めかも…🌙"
    ]);

    const ask = tsuPickFrom((Date.now() % 1000), [
      "今週なにか進んだ？（スレッドで一言でOK）",
      "今どこが詰まってる？（スレッドで一言でOK）",
      "いまの状態、ひとことだけ教えて（スレッドでOK）"
    ]);

    return `${head}\n${ask}`;
  }

  if (!apiKey){
    return fallbackText();
  }

  // ★172で合成した systemPrompt（人格+ガード+観測ブロック+記憶）を使う
  let system = "";
  try{
    if (typeof tsukuyomi_buildSystemPromptBaseFromContextDb === "function"){
      system = tsukuyomi_buildSystemPromptBaseFromContextDb({
        intent: "post",
        projectId,
        ym,
        derivedStatus,
        profile
      });
    }
  }catch(e){}

  // ★ここが追加の強制ガード：本文に出してはいけないものを明記
  const hardGuards = [
    "【出力ガード】",
    "- 本文の先頭に（PJ名）を括弧で付けない",
    "- 本文に status=none などの内部コードを一切出さない",
    "- 観測ブロック（【観測】〜）を本文にコピペしない",
    "- 質問は1文、行動は1個",
    "- 同じ定型文を避け、reason/Slack抜粋から具体の軸を作る"
  ].join("\n");

  system = system ? (system + "\n\n" + hardGuards) : hardGuards;

  // user入力（素材）
  const user = [
    "素材（できるだけこの中の事実に寄せて質問を作る）",
    "",
    reason ? `reason:\n${reason}` : "reason:\n(empty)",
    "",
    "Slack抜粋:",
    slackDigest || "(empty)",
    "",
    "制約：短文2〜4行。最初に1行だけ雰囲気（断定しない）。次の1行で質問1つ。最後に「スレッドでOK」。"
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
        name: "nudge_message",
        strict: true,
        schema: {
          type:"object",
          properties:{
            text:{ type:"string" }
          },
          required:["text"]
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
    const outText = json.output_text || _openai_extractOutputText_(json);

    let parsed = null;
    try{
      parsed = JSON.parse(outText);
    }catch(e2){
      parsed = { text: String(outText||"") };
    }

    const t = String(parsed.text||"").trim();

    // ★出力が空/壊れたらBOT臭なしフォールバックへ
    if (!t) return fallbackText();

    // ★最後の防波堤：内部コードと括弧PJ名を消す
    const cleaned = t
      .replace(/\(.*?\)\s*/g, "")                    // 先頭括弧のPJ名などを掃除（雑でOK）
      .replace(/status\s*=\s*[a-z_]+/gi, "")         // status=none等を消す
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return cleaned || fallbackText();
  }catch(e){
    return fallbackText();
  }
}

function _tsukuyomi_appendNudgeLog_(eventType, detail){
  const sh = getSheetOrCreate_("DB_TsukuyomiNudgeLog");
  ensureHeader_(sh, ["logId","eventType","detailJson","createdAtJst"]);

  const nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");
  sh.appendRow([
    Utilities.getUuid().replace(/-/g,""),
    String(eventType||""),
    JSON.stringify(detail || {}),
    nowJst
  ]);
}

function tsukuyomi_setupNudgeTriggers(){
  // 既存同名があれば重複防止
  const all = ScriptApp.getProjectTriggers();
  all.forEach(t=>{
    const fn = t.getHandlerFunction();
    if (fn === "tsukuyomi_runNudgePosterTick" || fn === "tsukuyomi_planDailyNudges" || fn === "tsukuyomi_collectAndJudgeNudges" || fn === "tsukuyomi_mergePostedNudges"){
      ScriptApp.deleteTrigger(t);
    }
  });

  // 日次：計画（朝に回す）
  ScriptApp.newTrigger("tsukuyomi_planDailyNudges")
    .timeBased()
    .everyDays(1)
    .atHour(9)        // JST基準
    .create();

  // 日次：判定（計画のあと）
  ScriptApp.newTrigger("tsukuyomi_collectAndJudgeNudges")
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();

  // 15分ごと：投稿
  ScriptApp.newTrigger("tsukuyomi_runNudgePosterTick")
    .timeBased()
    .everyMinutes(15)
    .create();

  // 日次：マージ（夕方で十分）
  ScriptApp.newTrigger("tsukuyomi_mergePostedNudges")
    .timeBased()
    .everyDays(1)
    .atHour(19)
    .create();

  return { ok:true };
}
