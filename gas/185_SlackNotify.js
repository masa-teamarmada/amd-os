/**
 * 185_SlackNotify.gs
 * Slack通知（チャンネル投稿/DM）の薄い送信基盤
 *
 * 前提：
 * - Script Properties に SLACK_BOT_TOKEN を保存しておく
 * - スコープ: https://www.googleapis.com/auth/script.external_request は既に入ってる想定
 */

function slack_getBotToken(){
  const tok = String(PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN") || "").trim();
  if (!tok) throw new Error("SLACK_BOT_TOKEN is missing in Script Properties");
  return tok;
}

function slack_callApi(path, payload){
  const token = slack_getBotToken();
  const url = "https://slack.com/api/" + String(path || "").replace(/^\/+/, "");

  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });

  const text = res.getContentText() || "";
  let obj = null;
  try { obj = JSON.parse(text); } catch(e) {}

  if (!obj || obj.ok !== true){
    const msg = obj && obj.error ? obj.error : text;
    throw new Error("Slack API failed: " + msg);
  }
  return obj;
}

/**
 * チャンネルへ投稿（channelId: C... / G...）
 */
function slack_postMessage(channelId, text){
  const ch = String(channelId || "").trim();
  const t = String(text || "").trim();
  if (!ch) throw new Error("slack_postMessage: channelId empty");
  if (!t) throw new Error("slack_postMessage: text empty");

  return slack_callApi("chat.postMessage", {
    channel: ch,
    text: t
  });
}

/**
 * DMへ投稿（slackId: U...）
 * - conversations.open でDMチャンネルを開いてから chat.postMessage
 */
function slack_postDm(slackId, text){
  const uid = String(slackId || "").trim();
  const t = String(text || "").trim();
  if (!uid) throw new Error("slack_postDm: slackId empty");
  if (!t) throw new Error("slack_postDm: text empty");

  const opened = slack_callApi("conversations.open", { users: uid });
  const ch = String(opened && opened.channel && opened.channel.id ? opened.channel.id : "").trim();
  if (!ch) throw new Error("Slack conversations.open did not return channel id");

  return slack_callApi("chat.postMessage", {
    channel: ch,
    text: t
  });
}

function slack_postMessageBlocks(channelId, text, blocks){
  const ch = String(channelId || "").trim();
  const t = String(text || "").trim();
  if (!ch) throw new Error("slack_postMessageBlocks: channelId empty");

  const payload = { channel: ch, text: t || " " };
  if (Array.isArray(blocks)) payload.blocks = blocks;

  return slack_callApi("chat.postMessage", payload);
}

function slack_postDmBlocks(slackId, text, blocks){
  const uid = String(slackId || "").trim();
  const t = String(text || "").trim();
  if (!uid) throw new Error("slack_postDmBlocks: slackId empty");

  const opened = slack_callApi("conversations.open", { users: uid });
  const ch = String(opened && opened.channel && opened.channel.id ? opened.channel.id : "").trim();
  if (!ch) throw new Error("Slack conversations.open did not return channel id");

  const payload = { channel: ch, text: t || " " };
  if (Array.isArray(blocks)) payload.blocks = blocks;

  return slack_callApi("chat.postMessage", payload);
}

/**
 * PJのSlackチャンネルIDをDB_Projectsから取得
 * @param {string} projectId
 * @return {string|null} チャンネルID（C始まり）またはnull
 */
function slackNotifyGetProjectChannelId_(projectId) {
  if (!projectId) return null;
  
  try {
    var projects = b_cachedReadProjects_();
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].projectId === projectId) {
        var ch = String(projects[i].slackChannelId || '').trim();
        return ch || null;
      }
    }
    return null;
  } catch (e) {
    Logger.log('slackNotifyGetProjectChannelId_ エラー: ' + e);
    return null;
  }
}