/** S020_SlackApi.gs
 * Slack API薄いラッパー。送信・取得の基盤。
 *
 * teamId を渡すと、そのワークスペース用のトークン
 * (`SLACK_BOT_TOKEN__<teamId>` など) を優先して使う。
 * 省略時は従来どおりAMDワークスペースのトークンへ落ちる。
 */

function slack_getBotToken_(persona, teamId) {
  const p = String(persona || "tsukuyomi").trim();
  if (p === "eimi") {
    return utils_getTeamProp_("SLACK_EIMI_BOT_TOKEN", teamId)
      || utils_getTeamProp_("SLACK_TSUKUYOMI_BOT_TOKEN", teamId);
  }
  return utils_getTeamProp_("SLACK_BOT_TOKEN", teamId)
    || utils_getTeamProp_("SLACK_TSUKUYOMI_BOT_TOKEN", teamId);
}

function slack_callApi_(method, params, persona, teamId) {
  const token = slack_getBotToken_(persona, teamId);
  if (!token) throw new Error("SLACK_BOT_TOKEN missing" + (teamId ? " (team " + teamId + ")" : ""));

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

function slack_postMessage_(channelId, text, opts, persona, teamId) {
  const params = Object.assign({ channel: channelId, text: text }, opts || {});
  if (params.blocks && typeof params.blocks !== "string") {
    params.blocks = JSON.stringify(params.blocks);
  }
  return slack_callApi_("chat.postMessage", params, persona, teamId);
}

function slack_postThreadReply_(channelId, threadTs, text, opts, persona, teamId) {
  return slack_postMessage_(channelId, text, Object.assign({ thread_ts: threadTs }, opts || {}), persona, teamId);
}

function slack_getThreadHistory_(channelId, threadTs, limit, persona, teamId) {
  const res = slack_callApi_("conversations.replies", {
    channel: channelId,
    ts: threadTs,
    limit: Math.min(Number(limit || 12), 30),
    inclusive: true
  }, persona, teamId);
  return (res && Array.isArray(res.messages)) ? res.messages : [];
}

function slack_getThreadHistoryAny_(channelId, threadTs, limit, teamId) {
  let msgs = [];
  try {
    msgs = slack_getThreadHistory_(channelId, threadTs, limit, "tsukuyomi", teamId);
  } catch(_e) {}
  if (msgs && msgs.length) return msgs;

  try {
    msgs = slack_getThreadHistory_(channelId, threadTs, limit, "eimi", teamId);
  } catch(_e2) {}
  return (msgs && msgs.length) ? msgs : [];
}
