/**
 * R185_SlackApi.gs
 * 役割：Report GAS用 Slack API基盤
 *
 * 本体GASの 185_SlackNotify.gs から、API呼び出し基盤のみ移植。
 * R306_MonthlyReport_SlackExtract.gs が slack_callApi / slack_getBotToken_ を必要とする。
 *
 * 依存: ScriptProperties['SLACK_BOT_TOKEN']
 */

function slack_getBotToken() {
  var tok = String(PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || '').trim();
  if (!tok) throw new Error('SLACK_BOT_TOKEN is missing in Script Properties');
  return tok;
}

function slack_callApi(path, payload) {
  var token = slack_getBotToken();
  var url = 'https://slack.com/api/' + String(path || '').replace(/^\/+/, '');

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });

  var text = res.getContentText() || '';
  var obj = null;
  try { obj = JSON.parse(text); } catch (e) {}

  if (!obj || obj.ok !== true) {
    var msg = obj && obj.error ? obj.error : text;
    throw new Error('Slack API failed: ' + msg);
  }
  return obj;
}
