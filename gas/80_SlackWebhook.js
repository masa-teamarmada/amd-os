/** 80_SlackWebhook.gs
 * Slackイベント受信（Webhook）担当。
 * doPost入口、event_callback処理、最終利用日の更新、受信ログ記録など「Slack連携」だけを扱う。
 */
function doPost(e){
  // ===== 0) Slack Interactivity（最優先）=====
  const mode = (e && e.parameter && e.parameter.mode) ? String(e.parameter.mode) : "";
  const payloadStr = (e && e.parameter && e.parameter.payload) ? String(e.parameter.payload) : "";
  const hasInteractivePayload = !!payloadStr.trim();

  // ===== 0a) internal_setup (1 回限り、SUPABASE_SERVICE_ROLE_KEY 未設定時のみ受け付け) =====
  // 自動セットアップ用。017_InvoiceSendNudge.js / invoiceSend_runInternalSetup_ に転送。
  if (mode === "internal_setup"){
    try{
      const raw = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
      const body = raw ? JSON.parse(raw) : {};
      const action = String(body.action || "").trim();
      let result = { ok: false, message: "unknown action: " + action };
      if (action === "invoiceSendNudge" && typeof invoiceSend_runInternalSetup_ === "function"){
        result = invoiceSend_runInternalSetup_(body);
      }
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } catch(err){
      return ContentService
        .createTextOutput(JSON.stringify({ ok:false, message: String(err && err.message ? err.message : err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (mode === "slack_interactive" || hasInteractivePayload){
    try{
      // ★3秒制限：シート書き込み禁止、UrlFetch禁止
      const payloadStr = (e && e.parameter && e.parameter.payload) ? String(e.parameter.payload) : "";
      if (!payloadStr){
        return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
      }

      let payload = null;
      try{ payload = JSON.parse(payloadStr); } catch(_e){ payload = null; }

      // 新：Cacheに軽量キュー投入（3秒制限を絶対に超えない）
      slackQueueInteractiveCacheFromPayload_(payloadStr);

      // 押下直後の安心返信（ephemeral）
      let actionId = "";
      let reimbursementId = "";

      try{
        const actions = payload && Array.isArray(payload.actions) ? payload.actions : [];
        const act = actions[0] || {};
        actionId = String(act.action_id || "").trim();

        const v = String(act.value || "").trim();
        const av = v ? JSON.parse(v) : {};
        reimbursementId = String(av.reimbursementId || "").trim();
      } catch(_e){}

      const label = (actionId === "reimb_approve") ? "承認"
                  : (actionId === "reimb_reject") ? "却下"
                  : "処理";

      return ContentService
        .createTextOutput(JSON.stringify({
          response_type: "ephemeral",
          text: `受け取った！ ${label}を反映中…（${reimbursementId || "-"}）`
        }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch(err){
      // 何があっても即返す（タイムアウト防止）
      return ContentService
        .createTextOutput(JSON.stringify({ response_type:"ephemeral", text:"受け取った！ 反映中…" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ===== 0.5) whoami（デバッグ用：このURLがどの個体か返す）=====
  // ブラウザで: .../exec?mode=whoami
  if (mode === "whoami"){
    let scriptId = "";
    let ssId = "";
    let tz = "";
    try{ scriptId = String(ScriptApp.getScriptId() || ""); } catch(_e){}
    try{ ssId = String(SpreadsheetApp.getActiveSpreadsheet().getId() || ""); } catch(_e){}
    try{ tz = String(Session.getScriptTimeZone() || ""); } catch(_e){}

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        scriptId: scriptId,
        activeSpreadsheetId: ssId,
        timezone: tz
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ===== 1) ここから先はイベントAPI等（ログOK）=====
  // 受信ログ（必要なら）
  try{
    slackLogInteractive_(
      "doPost_enter",
      {
        hasParam: !!(e && e.parameter),
        mode: (e && e.parameter && e.parameter.mode) ? String(e.parameter.mode) : "",
        hasPayloadParam: !!(e && e.parameter && String(e.parameter.payload || "").trim()),
        postDataType: e && e.postData ? String(e.postData.type || "") : "",
        postDataLen: e && e.postData && e.postData.contents ? String(e.postData.contents).length : 0
      },
      e
    );
  } catch(_e){}

  const rawBody = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
  let body = null;

  try{ body = rawBody ? JSON.parse(rawBody) : null; } catch(_e){ body = null; }

  if (body && body.type === "url_verification" && body.challenge){
    return ContentService.createTextOutput(String(body.challenge)).setMimeType(ContentService.MimeType.TEXT);
  }
  if (body && body.type === "event_callback"){
    return handleSlackEventBody_(body);
  }
  if (mode === "slackEvent"){
    return handleSlackEvent_(e);
  }

  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

function handleSlackEvent_(e){
  // この経路（mode=slackEvent）でも、最終的に handleSlackEventBody_ に集約する
  // → つくよみ返信ロジックが必ず効くようにする

  const rawBody = (e && e.postData && e.postData.contents) ? String(e.postData.contents) : "";
  let body = null;
  try{ body = rawBody ? JSON.parse(rawBody) : null; } catch(_e){ body = null; }

  if (!body){
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  }

  // URL Verification
  if (body.type === "url_verification" && body.challenge){
    return ContentService
      .createTextOutput(String(body.challenge))
      .setMimeType(ContentService.MimeType.TEXT);
  }

  // event_callback は共通ハンドラへ
  if (body.type === "event_callback"){
    // ★ここで handleSlackEventBody_ に流すのが肝
    return handleSlackEventBody_(body);
  }

  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

function handleSlackEventBody_(body){
  const ev = body && body.event ? body.event : null;
  if (!ev) {
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  }

  const atJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
  const eventId = String(body.event_id || "").trim();
  const evType = String(ev.type || "").trim();
  const userIdRaw = String(ev.user || "").trim();
  const eventTs = String(ev.event_ts || ev.ts || "").trim();

  const channelId = String(ev.channel || "").trim();
  const subtype = String(ev.subtype || "").trim();
  const threadTsRaw = String(ev.thread_ts || "").trim();
  const msgTsRaw = String(ev.ts || "").trim();

  const rawBody = JSON.stringify(body || {});
  const rawLen = String(rawBody.length);

  // ★この関数が書いたログだと一発で分かる署名
  const ssId = (function(){
    try { return String(SpreadsheetApp.getActiveSpreadsheet().getId() || ""); }
    catch(e){ return "noActiveSpreadsheet"; }
  })();
  const sig = "SIG=TSUKU_V3 ssId=" + ssId + " ";

  function logNote(note){
    try{
      const sh = getSheetOrCreate_("DB_SlackEventLog");
      // ★まさの7列だけに固定
      ensureHeader_(sh, ["atJst","type","eventType","user","eventTs","note","rawLen"]);
      sh.appendRow([
        atJst,
        String(body.type || ""),
        evType,
        userIdRaw,
        eventTs,
        sig + String(note || ""),
        rawLen
      ]);
    } catch(_e){}
  }

  // 1) event_id 重複排除
  if (eventId){
    const cache = CacheService.getScriptCache();
    const k = "slack_event_dedupe_" + eventId;
    if (cache.get(k)){
      logNote("dedupe_hit eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }
    cache.put(k, "1", 6 * 60 * 60);
  }

  // 2) つくよみ記憶（全スレッド横断）に保存
  // bot投稿も含めて保存したいので、bot除外より前にやる
  // ※MVPなので、失敗しても本流は止めない
  try{
    if (evType === "message" && typeof tsukuyomiMemoryAppendFromSlackEvent === "function"){
      tsukuyomiMemoryAppendFromSlackEvent(ev);
    }
  } catch(_e){}

  // 3) bot投稿は除外（返信判定など“リアクション”はしない）
  if (subtype === "bot_message" || ev.bot_id){
    logNote("skip_bot_message subtype=" + subtype + " channel=" + channelId + " eventId=" + eventId);
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  }

  // 4) 受信ログ
  logNote("received subtype=" + subtype + " channel=" + channelId + " eventId=" + eventId
    + " ts=" + msgTsRaw + " thread_ts=" + threadTsRaw);

  // 5) つくよみ返信判定
  try{
    if (evType !== "message"){
      logNote("skip_not_message type=" + evType + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    // スレッドトリガー決定（返信本体 or message_replied）
    let threadTs = "";
    let triggerUserId = userIdRaw;

    if (threadTsRaw && msgTsRaw && threadTsRaw !== msgTsRaw){
      threadTs = threadTsRaw;
    } else if (subtype === "message_replied"){
      threadTs = msgTsRaw; // 親の ts
      try{
        const m = ev.message || {};
        const u = String(m.user || "").trim();
        if (u) triggerUserId = u;
      } catch(_e){}
    }

    if (!threadTs){
      logNote("skip_not_thread_trigger subtype=" + subtype + " ts=" + msgTsRaw + " thread_ts=" + threadTsRaw
        + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    // 自己発言は無視
    const props = PropertiesService.getScriptProperties();
    const tsukuBotUserId = String(props.getProperty("SLACK_TSUKUYOMI_BOT_USER_ID") || "").trim();
    if (tsukuBotUserId && triggerUserId === tsukuBotUserId){
      logNote("skip_self_tsukuyomi threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    // ★クールダウン中でも「質問っぽい」発言は通す（会話が死ぬのを防ぐ）
    const bypassCooldown = tsukuyomiShouldBypassCooldown(ev);

    const cache2 = CacheService.getScriptCache();
    const cdKey = "tsukuyomi_thread_cooldown_" + [channelId, threadTs].join("_");
    if (cache2.get(cdKey) && !bypassCooldown){
      logNote("skip_cooldown threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    // 親判定
    let parent = null;
    try{
      parent = tsukuyomiFetchThreadParentMessage(channelId, threadTs);
    } catch(errFetch){
      logNote("tsukuyomi_error_parent_fetch msg=" + String(errFetch && errFetch.message ? errFetch.message : errFetch)
        + " threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    const isParentTsukuyomi = tsukuyomiIsParentMessage(parent);
    if (!isParentTsukuyomi){
      const pUser = parent ? String(parent.user || "") : "";
      const pUsername = parent ? String(parent.username || "") : "";
      const pBotId = parent ? String(parent.bot_id || "") : "";
      logNote("skip_parent_not_tsukuyomi pUser=" + pUser + " pUsername=" + pUsername + " pBotId=" + pBotId
        + " threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId);
      return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
    }

    // クールダウン開始（バイパス時は短め）
    cache2.put(cdKey, "1", bypassCooldown ? 10 : 10);

    // 返信
    try{
      tsukuyomiHandleThreadReplyEvent({
        channelId: channelId,
        threadTs: threadTs,
        eventId: eventId,
        triggerUserId: triggerUserId
      });
      logNote("tsukuyomi_reply_called threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId
        + " bypassCooldown=" + (bypassCooldown ? "1" : "0"));
    } catch(errReply){
      logNote("tsukuyomi_error_reply msg=" + String(errReply && errReply.message ? errReply.message : errReply)
        + " threadTs=" + threadTs + " channel=" + channelId + " eventId=" + eventId);
    }

  } catch(err){
    logNote("tsukuyomi_error msg=" + String(err && err.message ? err.message : err)
      + " channel=" + channelId + " eventId=" + eventId);
  }

  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

// ★クールダウンバイパス判定（会話が途切れるのを防ぐ）
function tsukuyomiShouldBypassCooldown(ev){
  const t = String(
    (ev && ev.text) ||
    (ev && ev.message && ev.message.text) ||
    ""
  ).trim();

  if (!t) return false;

  // 記号の質問
  if (t.indexOf("?") >= 0 || t.indexOf("？") >= 0) return true;

  // 口語の質問（まさの例に寄せる）
  if (/(いいの|かな|なの|あり\?|あり？|ダメ\?|ダメ？)/.test(t)) return true;

  return false;
}


function upsertSlackLastSeen_(slackUserId, dateObj){
  const sh = getSheet_("DB_Members");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return;

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iSlackId = header.indexOf("slackId");
  const iSlackLast = header.indexOf("slackLastSeenAt");
  const iUpdatedAt = header.indexOf("updatedAt");

  if (iSlackId < 0 || iSlackLast < 0 || iUpdatedAt < 0) return;

  const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();

  for (let r=0; r<vals.length; r++){
    const sid = String(vals[r][iSlackId] || "").trim();
    if (sid !== String(slackUserId)) continue;

    const rowNo = r + 2;

    // JSTで日付保存（文字列の方が運用ラク）
    const jst = Utilities.formatDate(dateObj, "Asia/Tokyo", "yyyy-MM-dd");

    sh.getRange(rowNo, iSlackLast+1).setValue(jst);
    sh.getRange(rowNo, iUpdatedAt+1).setValue(new Date());

    logAdminAction_("slack_last_seen_update", "", { slackId: slackUserId, slackLastSeenAt: jst });
    return;
  }
}

function tsukuyomiFetchThreadParentMessage(channelId, threadTs){
  const ch = String(channelId || "").trim();
  const ts = String(threadTs || "").trim();
  if (!ch || !ts) return null;

  // Slack APIはGETでもPOSTでもOK扱い。こっちは基盤に寄せてPOSTで統一
  const obj = slack_callApi("conversations.replies", {
    channel: ch,
    ts: ts,
    limit: 10,
    inclusive: true
  });

  const msgs = obj && Array.isArray(obj.messages) ? obj.messages : [];
  if (!msgs.length) return null;

  return msgs[0] || null; // 先頭が親
}

function tsukuyomiIsParentMessage(msg){
  if (!msg) return false;

  const props = PropertiesService.getScriptProperties();
  const tsukuBotUserId = String(props.getProperty("SLACK_TSUKUYOMI_BOT_USER_ID") || "").trim();
  const tsukuBotId = String(props.getProperty("SLACK_TSUKUYOMI_BOT_ID") || "").trim();
  const configuredUsername = String(props.getProperty("SLACK_TSUKUYOMI_USERNAME") || "").trim();

  const user = String(msg.user || "").trim();
  const botId = String(msg.bot_id || "").trim();
  const username = String(msg.username || "").trim();
  const subtype = String(msg.subtype || "").trim();

  // botっぽさ
  const looksBot = (subtype === "bot_message") || !!botId || !!username;
  if (!looksBot) return false;

  // まずはID一致（最強）
  if (tsukuBotUserId && user === tsukuBotUserId) return true;
  if (tsukuBotId && botId === tsukuBotId) return true;

  // username一致（設定があればそれを最優先）
  if (configuredUsername){
    if (username === configuredUsername) return true;
  } else {
    // 設定が無い場合のフォールバック：
    // つくよみ(日本語) / tsukuyomi(英字) のどっちでも通す
    if (username === "つくよみ") return true;
    if (username.toLowerCase() === "tsukuyomi") return true;
  }

  return false;
}

function tsukuyomi_isParentMessage_(msg){
  // 親が「つくよみ投稿」かどうかの判定ロジック
  // - username が tsukuyomi
  // - bot_id が一致
  // - user が一致（bot user id）
  if (!msg) return false;

  const props = PropertiesService.getScriptProperties();
  const tsukuBotUserId = String(props.getProperty("SLACK_TSUKUYOMI_BOT_USER_ID") || "").trim();
  const tsukuBotId = String(props.getProperty("SLACK_TSUKUYOMI_BOT_ID") || "").trim();
  const tsukuUsername = String(props.getProperty("SLACK_TSUKUYOMI_USERNAME") || "tsukuyomi").trim();

  const user = String(msg.user || "").trim();
  const botId = String(msg.bot_id || "").trim();
  const username = String(msg.username || "").trim();
  const subtype = String(msg.subtype || "").trim();

  // bot_message であることは “強い証拠”
  const looksBot = (subtype === "bot_message") || !!botId || !!username;

  if (!looksBot) return false;

  if (tsukuBotUserId && user === tsukuBotUserId) return true;
  if (tsukuBotId && botId === tsukuBotId) return true;
  if (tsukuUsername && username === tsukuUsername) return true;

  return false;
}

/** Slack interactivity専用ログ（console + シート） */
function slackLogInteractive_(tag, obj, e){
  const atJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
  const mode = (e && e.parameter && e.parameter.mode) ? String(e.parameter.mode) : "";
  const hasPayload = !!(e && e.parameter && String(e.parameter.payload || "").trim());

  const msg = `[${atJst}] ${tag} mode=${mode} hasPayload=${hasPayload} obj=${JSON.stringify(obj || {})}`;
  try{ console.log(msg); } catch(_e){}

  // ★シートログはデフォOFF（重い＆DBが太るだけ）
  // どうしても必要な時だけ ScriptProperties: SLACK_INTERACTIVE_LOG_TO_SHEET="1" でON
  try{
    const props = PropertiesService.getScriptProperties();
    const on = String(props.getProperty("SLACK_INTERACTIVE_LOG_TO_SHEET") || "").trim();
    if (on !== "1") return;

    const sh = getSheetOrCreate_("DB_SlackInteractiveLog");
    ensureHeader_(sh, ["atJst","tag","mode","hasPayload","objJson"]);
    sh.appendRow([atJst, String(tag||""), mode, hasPayload ? "1":"0", JSON.stringify(obj||{})]);
  } catch(_e){}
}

function slackQueueInteractiveCacheFromPayload_(payloadStr){
  payloadStr = String(payloadStr || "");
  if (!payloadStr.trim()) return;

  let payload = null;
  try{ payload = JSON.parse(payloadStr); } catch(_e){ payload = null; }
  if (!payload) return;

  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const act = actions[0] || {};
  const actionId = String(act.action_id || "").trim();
  const actionValue = String(act.value || "").trim();

  // ★reimb系：PM + admin を許可
  // ★invoice_send_done: 請求書送付ボタン (017_InvoiceSendNudge.js)
  const allow = {
    reimb_approve: true,
    reimb_reject: true,
    reimb_admin_approve: true,
    reimb_admin_reject: true,
    invoice_send_done: true
  };
  if (!allow[actionId]) return;

  // 押下重複（Slack再送）対策：user+ts+action
  const userId = payload && payload.user && payload.user.id ? String(payload.user.id) : "";
  const channelId = payload && payload.channel && payload.channel.id ? String(payload.channel.id) : "";
  const messageTs = payload && payload.message && payload.message.ts ? String(payload.message.ts) : "";

  const cache = CacheService.getScriptCache();
  const dedupeKey = "slack_interactive_dedupe_" + [userId, channelId, messageTs, actionId].join("_");
  if (cache.get(dedupeKey)) return;
  cache.put(dedupeKey, "1", 120);

  const key = "SLACK_INTERACTIVE_QUEUE_CACHE";
  let arr = [];
  try{
    const cur = cache.get(key);
    arr = cur ? JSON.parse(cur) : [];
  } catch(_e){
    arr = [];
  }

  arr.push({
    atJst: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX"),
    actionId: actionId,
    actionValue: actionValue,
    userId: userId,
    channelId: channelId,
    messageTs: messageTs
  });

  if (arr.length > 30) arr = arr.slice(arr.length - 30);
  cache.put(key, JSON.stringify(arr), 600);
}
