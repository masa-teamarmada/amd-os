function slackOpenDm_(token, userId) {
  return slackApi_('conversations.open', token, { users: userId });
}

function slackPostMessage_(token, channelId, text) {
  return slackApi_('chat.postMessage', token, { channel: channelId, text });
}

function slackApi_(method, token, payload) {
  const res = UrlFetchApp.fetch(`https://slack.com/api/${method}`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const json = JSON.parse(res.getContentText() || '{}');
  if (!json.ok) throw new Error(`Slack API error ${method}: ${res.getContentText()}`);
  return json;
}
