/** S001_Router.gs
 * Slackからのリクエスト受信・振り分け専用。
 * url_verification → 即返し
 * Interactive（ボタン）→ 050_Interactive.gs
 * Events（メッセージ）→ 030_TsukuyomiReply.gs
 *
 * 重複排除: LockService + CacheService の二段構えで
 * channelId+threadTs ベースのdedup。event_idだけでなく
 * app_mention/message 2イベント重複も防ぐ。
 */

function doPost(e) {
  // ===== 1) url_verification（最優先・スプシアクセス一切なし）=====
  const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
  try {
    const body = JSON.parse(raw);
    if (body && body.type === "url_verification" && body.challenge) {
      return ContentService
        .createTextOutput(JSON.stringify({ challenge: String(body.challenge) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch(_e) {}

  // ===== 2) Interactive（ボタン操作）=====
  const payloadStr = (e && e.parameter && e.parameter.payload) ? String(e.parameter.payload) : "";
  if (payloadStr.trim()) {
    let pl = null;
    try { pl = JSON.parse(payloadStr); } catch(_e) {}
    return interactive_handle_(pl);
  }

  // ===== 3) Events API =====
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch(_e) {}
  if (!body) return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);

  if (body.type === "event_callback") {
    router_handleEvent_(body);
  }

  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

function router_handleEvent_(body) {
  const ev = body && body.event ? body.event : null;
  if (!ev) return;

  const evType = String(ev.type || "").trim();
  const subtype = String(ev.subtype || "").trim();
  const channelId = String(ev.channel || "").trim();
  const threadTsRaw = String(ev.thread_ts || "").trim();
  const msgTsRaw = String(ev.ts || "").trim();
  const userIdRaw = String(ev.user || "").trim();

  // bot投稿は除外
  if (subtype === "bot_message" || ev.bot_id) return;

  // ===== app_mention =====
  if (evType === "app_mention") {
    // スレッド内メンションは親投稿のpersonaを優先する。
    // Slackはスレッド返信でも app_mention を投げるため、ここで親を見ないと別botが拾う。
    const targetThreadTs = (threadTsRaw && msgTsRaw && threadTsRaw !== msgTsRaw)
      ? threadTsRaw
      : msgTsRaw;
    const mentionPersona = router_detectMentionPersona_(body, ev);
    let replyPersona = mentionPersona;

    if (targetThreadTs && targetThreadTs !== msgTsRaw) {
      const msgs = slack_getThreadHistoryAny_(channelId, targetThreadTs, 20);
      replyPersona = reply_detectThreadPersona_(msgs) || mentionPersona;
    }
    if (!replyPersona) return;

    // channelId + thread/message ts ベースのdedup（app_mention + message 2イベント対策）
    if (!router_acquireSlot_(channelId, targetThreadTs + "_" + msgTsRaw)) return;
    try {
      reply_handleThreadEvent_(channelId, targetThreadTs, userIdRaw, replyPersona);
    } catch(_e) {}
    return;
  }

  // ===== message（スレッド返信のみ）=====
  if (evType !== "message") return;

  let threadTs = "";
  if (threadTsRaw && msgTsRaw && threadTsRaw !== msgTsRaw) {
    threadTs = threadTsRaw;
  }
  if (!threadTs) return;

  // 自己発言は無視
  const botUserId = utils_getProp_("SLACK_TSUKUYOMI_BOT_USER_ID");
  if (botUserId && userIdRaw === botUserId) return;
  const eimiBotUserId = utils_getProp_("SLACK_EIMI_BOT_USER_ID") || "U0ACK22BBDF";
  if (eimiBotUserId && userIdRaw === eimiBotUserId) return;

  // channelId + threadTs ベースのdedup
  if (!router_acquireSlot_(channelId, threadTs + "_" + msgTsRaw)) return;

  // 親投稿のpersonaを確認。親がえいみなら、返信もえいみへ寄せる。
  const msgs = slack_getThreadHistoryAny_(channelId, threadTs, 20);
  const replyPersona = reply_detectThreadPersona_(msgs);
  if (!replyPersona) return;

  try {
    reply_handleThreadEvent_(channelId, threadTs, userIdRaw, replyPersona);
  } catch(_e) {}
}

function router_detectMentionPersona_(body, ev) {
  const text = String((ev && ev.text) || "");
  const eimiBotUserId = utils_getProp_("SLACK_EIMI_BOT_USER_ID") || "U0ACK22BBDF";
  const tsukuyomiBotUserId = utils_getProp_("SLACK_TSUKUYOMI_BOT_USER_ID") || "U0A663YPJNQ";

  if (eimiBotUserId && text.indexOf("<@" + eimiBotUserId + ">") !== -1) return "eimi";
  if (tsukuyomiBotUserId && text.indexOf("<@" + tsukuyomiBotUserId + ">") !== -1) return "tsukuyomi";

  const auths = body && Array.isArray(body.authorizations) ? body.authorizations : [];
  for (let i = 0; i < auths.length; i++) {
    const uid = String((auths[i] && auths[i].user_id) || "").trim();
    if (eimiBotUserId && uid === eimiBotUserId) return "eimi";
    if (tsukuyomiBotUserId && uid === tsukuyomiBotUserId) return "tsukuyomi";
  }

  return "";
}

/**
 * LockService + CacheService でスレッド単位の排他制御。
 * 同一キーへの2回目以降のリクエストをブロック。
 * @return {boolean} true=処理してOK, false=重複なのでスキップ
 */
function router_acquireSlot_(channelId, tsKey) {
  var slotKey = "slot_" + channelId + "_" + tsKey;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000); // 最大5秒待つ
    var cache = CacheService.getScriptCache();
    if (cache.get(slotKey)) {
      return false; // 既に処理中 or 処理済み
    }
    cache.put(slotKey, "1", 120); // 2分間ブロック
    return true;
  } catch(_e) {
    return false; // ロック取得失敗 → 安全側に倒す
  } finally {
    try { lock.releaseLock(); } catch(_e2) {}
  }
}

/**
 * 溜まった非同期トリガーを掃除する（移行用）。
 * 新アーキでは不要だが、旧トリガーが残ってる場合に備える。
 */
function router_cleanupAsyncTriggers_() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(t) {
      if (t.getHandlerFunction() === "router_processEventAsync") {
        ScriptApp.deleteTrigger(t);
      }
    });
  } catch(_e) {}
}
