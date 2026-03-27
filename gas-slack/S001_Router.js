/** S001_Router.gs
 * Slackからのリクエスト受信・振り分け専用。
 * url_verification → 即返し
 * Interactive（ボタン）→ 050_Interactive.gs
 * Events（メッセージ）→ 030_TsukuyomiReply.gs
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
    // 即200返し（Slackの3秒タイムアウト対策）
    router_handleEventAsync_(body);
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  }

  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

function router_handleEventAsync_(body) {
  const ev = body && body.event ? body.event : null;
  if (!ev) return;

  const eventId = String(body.event_id || "").trim();
  const evType = String(ev.type || "").trim();
  const subtype = String(ev.subtype || "").trim();
  const channelId = String(ev.channel || "").trim();
  const threadTsRaw = String(ev.thread_ts || "").trim();
  const msgTsRaw = String(ev.ts || "").trim();
  const userIdRaw = String(ev.user || "").trim();

  // 重複排除
  if (eventId) {
    const cache = CacheService.getScriptCache();
    const k = "evt_dedupe_" + eventId;
    if (cache.get(k)) return;
    cache.put(k, "1", 6 * 60 * 60);
  }

  // bot投稿は除外
  if (subtype === "bot_message" || ev.bot_id) return;

  // app_mention
  const isAppMention = (evType === "app_mention");
  if (isAppMention) {
    try {
      reply_handleAppMention_(channelId, userIdRaw, msgTsRaw, String(ev.text || ""));
    } catch(_e) {}
    return;
  }

  if (evType !== "message") return;

  // スレッド返信トリガー判定
  let threadTs = "";
  if (threadTsRaw && msgTsRaw && threadTsRaw !== msgTsRaw) {
    threadTs = threadTsRaw;
  }
  if (!threadTs) return;

  // 自己発言は無視
  const botUserId = utils_getProp_("SLACK_TSUKUYOMI_BOT_USER_ID");
  if (botUserId && userIdRaw === botUserId) return;

  // クールダウン
  const cache = CacheService.getScriptCache();
  const cdKey = "tsuku_cd_" + channelId + "_" + threadTs;
  if (cache.get(cdKey)) return;
  cache.put(cdKey, "1", 10);

  // スレッド内につくよみの発言があるか確認
  const msgs = slack_getThreadHistory_(channelId, threadTs, 20);
  const hasTsuku = msgs.some(m => reply_isParentTsukuyomi_(m));
  if (!hasTsuku) return;

  // 返信実行
  try {
    reply_handleThreadEvent_(channelId, threadTs, userIdRaw);
  } catch(_e) {}
}

function reply_handleAppMention_(channelId, userId, eventTs, text) {
  // メンション → そのままスレッドで会話開始
  reply_handleThreadEvent_(channelId, eventTs, userId);
}