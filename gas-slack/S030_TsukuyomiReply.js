/** S030_TsukuyomiReply.gs
 * Slackスレッド返信の核心。
 * イベント受信 → スレッド履歴取得 → LLM → 返信。
 */

function reply_handleThreadEvent_(channelId, threadTs, triggerUserId) {
  channelId = String(channelId || "").trim();
  threadTs = String(threadTs || "").trim();
  if (!channelId || !threadTs) return;

  try {
    // 1) スレッド履歴
    const history = slack_getThreadHistory_(channelId, threadTs, 12);

    // 2) systemPrompt
    const systemPrompt = context_buildSystemPrompt_(null);
    if (!systemPrompt) throw new Error("systemPrompt empty - DB_TsukuyomiContextを確認して");

    // 3) userPrompt
    const userPrompt = reply_buildUserPrompt_(history, triggerUserId);

    // 4) LLM
    const replyText = llm_call_(systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.8 });
    if (!replyText) throw new Error("empty reply from LLM");

    // 5) 返信
    slack_postThreadReply_(channelId, threadTs, replyText);

    // 6) 記憶抽出（失敗しても返信には影響させない）
    try {
      context_extractAndSaveMemory_(history, channelId);
    } catch(_me) {
      console.log("memory extract error: " + (_me && _me.message ? _me.message : String(_me)));
    }

  } catch(e) {
    const msg = String(e && e.message ? e.message : e);
    try {
      slack_postThreadReply_(channelId, threadTs,
        "今ちょっとコケたかも…。もう一回言ってみて🌙\n（" + msg.slice(0, 120) + "）"
      );
    } catch(_e) {}
  }
}

function reply_buildUserPrompt_(history, triggerUserId) {
  const lines = ["以下はSlackスレッドの履歴。文脈を読んで返信を作って。", ""];
  const arr = Array.isArray(history) ? history : [];
  arr.forEach(m => {
    const who = m.bot_id ? ("bot:" + (m.username || m.bot_id)) : ("user:" + (m.user || "unknown"));
    const txt = String(m.text || "").replace(/\s+/g, " ").trim();
    if (txt) lines.push("[" + who + "] " + txt);
  });
  if (triggerUserId) {
    lines.push("");
    lines.push("返信トリガーのユーザー: " + triggerUserId);
  }
  return lines.join("\n");
}

function reply_isParentTsukuyomi_(msg) {
  if (!msg) return false;
  const botUserId = utils_getProp_("SLACK_TSUKUYOMI_BOT_USER_ID");
  const botId = utils_getProp_("SLACK_TSUKUYOMI_BOT_ID");
  const user = String(msg.user || "").trim();
  const mBotId = String(msg.bot_id || "").trim();
  const username = String(msg.username || "").trim();
  const subtype = String(msg.subtype || "").trim();
  const looksBot = (subtype === "bot_message") || !!mBotId || !!username;
  if (!looksBot) return false;
  if (botUserId && user === botUserId) return true;
  if (botId && mBotId === botId) return true;
  if (username === "つくよみ" || username.toLowerCase() === "tsukuyomi") return true;
  return false;
}