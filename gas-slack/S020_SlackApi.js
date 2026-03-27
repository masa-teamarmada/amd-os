/** S020_SlackApi.gs
 * Slack API薄いラッパー。送信・取得の基盤。
 */

function slack_getBotToken_() {
  return utils_getProp_("SLACK_TSUKUYOMI_BOT_TOKEN") || utils_getProp_("SLACK_BOT_TOKEN");
}

function slack_callApi_(method, params) {
  const token = slack_getBotToken_();
  if (!token) throw new Error("SLACK_BOT_TOKEN missing");

  const res = UrlFetchApp.fetch("https://slack.com/api/" + method, {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: Object.keys(params).map(k =>
      encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k] || ""))
    ).join("&"),
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });

  try { return JSON.parse(res.getContentText()); } catch(_e) { return null; }
}

function slack_postMessage_(channelId, text, opts) {
  const params = Object.assign({ channel: channelId, text: text }, opts || {});
  if (params.blocks && typeof params.blocks !== "string") {
    params.blocks = JSON.stringify(params.blocks);
  }
  return slack_callApi_("chat.postMessage", params);
}

function slack_postThreadReply_(channelId, threadTs, text, opts) {
  return slack_postMessage_(channelId, text, Object.assign({ thread_ts: threadTs }, opts || {}));
}

function slack_getThreadHistory_(channelId, threadTs, limit) {
  const res = slack_callApi_("conversations.replies", {
    channel: channelId,
    ts: threadTs,
    limit: Math.min(Number(limit || 12), 30),
    inclusive: true
  });
  return (res && Array.isArray(res.messages)) ? res.messages : [];
}