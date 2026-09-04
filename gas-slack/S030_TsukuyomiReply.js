/** S030_TsukuyomiReply.gs
 * Slackスレッド返信の核心。
 * イベント受信 → スレッド履歴取得 → LLM → 返信。
 */

function reply_handleThreadEvent_(channelId, threadTs, triggerUserId, replyPersona, teamId) {
  channelId = String(channelId || "").trim();
  threadTs = String(threadTs || "").trim();
  if (!channelId || !threadTs) return;
  replyPersona = String(replyPersona || "").trim() === "eimi" ? "eimi" : "tsukuyomi";

  try {
    // 0) チャンネル → PJ解決
    const projectId = context_getProjectIdByChannelId_(channelId, teamId) || null;

    // 1) スレッド履歴
    const history = slack_getThreadHistory_(channelId, threadTs, 12, replyPersona, teamId);

    // 2) systemPrompt（PJ知識＋PJ固有メモリ＋メンバー情報を注入）
    const systemPrompt = context_buildSystemPrompt_(projectId, triggerUserId, replyPersona);
    if (!systemPrompt) throw new Error("systemPrompt empty - DB_TsukuyomiContextを確認して");

    // 3) userPrompt
    const userPrompt = reply_buildUserPrompt_(history, triggerUserId, projectId);

    // 4) LLM (persona分岐: eimi → Fugu / tsukuyomi → Claude)
    const usageRef = {};
    const llmOpts = {
      maxTokens: 1500,
      temperature: 0.5,
      persona: replyPersona,
      usageRef: usageRef
    };
    const replyText = llm_call_(systemPrompt, userPrompt, llmOpts);
    if (!replyText) throw new Error("empty reply from LLM");

    // 4.5) えいみだけ Fugu usage footer 付与 + Supabase log
    let finalText = replyText;
    if (replyPersona === "eimi" && usageRef.usage) {
      finalText = replyText + eimi_buildFuguUsageFooter_(usageRef);
      try {
        eimi_logFuguUsage_({
          channel_id: channelId,
          thread_ts: threadTs,
          user_id: triggerUserId,
          model: usageRef.model || "fugu",
          prompt_tokens: Number(usageRef.usage.prompt_tokens || 0),
          completion_tokens: Number(usageRef.usage.completion_tokens || 0),
          total_tokens: Number(usageRef.usage.total_tokens || 0),
          history_messages_count: Array.isArray(history) ? history.length : 0
        });
      } catch (_logErr) { /* log失敗は無視 */ }
    }

    // 5) 返信
    slack_postThreadReply_(channelId, threadTs, finalText, null, replyPersona, teamId);

    // 6) 記憶抽出（失敗しても返信には影響させない）
    try {
      if (replyPersona !== "eimi") context_extractAndSaveMemory_(history, channelId, teamId);
    } catch(_me) {
      console.log("memory extract error: " + (_me && _me.message ? _me.message : String(_me)));
    }

  } catch(e) {
    const msg = String(e && e.message ? e.message : e);
    try {
      const fallback = replyPersona === "eimi"
        ? "今ちょっと詰まっちゃった。もう一回投げてくれたら拾うね。"
        : "今ちょっとコケたかも…。もう一回言ってみて🌙\n（" + msg.slice(0, 120) + "）";
      slack_postThreadReply_(channelId, threadTs, fallback, null, replyPersona, teamId);
    } catch(_e) {}
  }
}

function reply_buildUserPrompt_(history, triggerUserId, projectId) {
  const lines = ["以下はSlackスレッドの履歴。文脈を読んで返信を作って。", ""];
  if (projectId) {
    lines.push("このチャンネルのプロジェクト: " + projectId);
    lines.push("");
  }
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

function reply_isParentTsukuyomi_(msg, teamId) {
  if (!msg) return false;
  const botUserId = utils_getTeamProp_("SLACK_TSUKUYOMI_BOT_USER_ID", teamId);
  const botId = utils_getTeamProp_("SLACK_TSUKUYOMI_BOT_ID", teamId);
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

function reply_isParentEimi_(msg, teamId) {
  if (!msg) return false;
  const botUserId = utils_getTeamProp_("SLACK_EIMI_BOT_USER_ID", teamId) || "U0ACK22BBDF";
  const botId = utils_getTeamProp_("SLACK_EIMI_BOT_ID", teamId) || "B0AC42V38ES";
  const user = String(msg.user || "").trim();
  const mBotId = String(msg.bot_id || "").trim();
  const username = String(msg.username || "").trim();
  const subtype = String(msg.subtype || "").trim();
  const looksBot = (subtype === "bot_message") || !!mBotId || !!username;
  if (!looksBot) return false;
  if (botUserId && user === botUserId) return true;
  if (botId && mBotId === botId) return true;
  if (username === "えいみ" || username.toLowerCase() === "eimi") return true;
  return false;
}

function reply_detectParentPersona_(msg, teamId) {
  if (reply_isParentEimi_(msg, teamId)) return "eimi";
  if (reply_isParentTsukuyomi_(msg, teamId)) return "tsukuyomi";
  return "";
}

function reply_detectThreadPersona_(history, teamId) {
  const arr = Array.isArray(history) ? history : [];
  if (!arr.length) return "";
  return reply_detectParentPersona_(arr[0] || null, teamId);
}
