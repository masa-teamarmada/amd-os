/** S050_Interactive.gs
 * Slackボタン操作の処理。081+186を統合してシンプル化。
 */

function interactive_handle_(pl) {
  if (!pl) return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);

  const acts = Array.isArray(pl.actions) ? pl.actions : [];
  const a0 = acts[0] || {};
  const aid = String(a0.action_id || "").trim();
  const responseUrl = pl.response_url ? String(pl.response_url) : "";
  const userId = pl.user && pl.user.id ? String(pl.user.id) : "";
  const channelId = pl.channel && pl.channel.id ? String(pl.channel.id) : "";
  const messageTs = pl.message && pl.message.ts ? String(pl.message.ts) : "";

  // date/time picker → 即空返し
  if (aid === "meeting_date_pick" || aid === "meeting_time_pick") {
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  // つくよみメニュー：リスケ
  if (aid === "tsukuyomi_menu_reschedule") {
    var vR = {};
    try { vR = JSON.parse(String(a0.value || "{}")); } catch(_e) {}
    return ContentService.createTextOutput(JSON.stringify({
      replace_original: true,
      text: "月次報告会スケジュール",
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: "📅 月次報告会をスケジュールするよ🌙\n日付と開始時間を選んでね（30分枠）" } },
        {
          type: "actions",
          block_id: "meeting_schedule_block",
          elements: [
            { type: "datepicker", action_id: "meeting_date_pick", placeholder: { type: "plain_text", text: "日付を選択" } },
            { type: "timepicker", action_id: "meeting_time_pick", placeholder: { type: "plain_text", text: "開始時間" } },
            {
              type: "button",
              text: { type: "plain_text", text: "この日時で確定" },
              style: "primary",
              action_id: "meeting_schedule",
              value: JSON.stringify({ projectId: vR.projectId || "", ym: String(vR.ym || "") })
            }
          ]
        }
      ]
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // つくよみメニュー：その他
  if (aid === "tsukuyomi_menu_other") {
    return ContentService.createTextOutput(JSON.stringify({
      replace_original: true,
      text: "このメッセージにスレッドで話しかけてくれれば答えるよ🌙"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 日時確定 → Cacheキュー
  if (aid === "meeting_schedule") {
    const sv = (pl.state && pl.state.values) || {};
    const mb = sv["meeting_schedule_block"] || {};
    const selDate = (mb["meeting_date_pick"] && mb["meeting_date_pick"].selected_date) || "";
    const selTime = (mb["meeting_time_pick"] && mb["meeting_time_pick"].selected_time) || "";
    var vM = {};
    try { vM = JSON.parse(String(a0.value || "{}")); } catch(_e) {}

    CacheService.getScriptCache().put("MEETING_SCHEDULE_QUEUE", JSON.stringify({
      action: "meeting_schedule",
      projectId: String(vM.projectId || ""),
      ym: String(vM.ym || ""),
      selectedDate: selDate,
      selectedTime: selTime,
      responseUrl: responseUrl,
      userId: userId,
      queuedAt: new Date().toISOString()
    }), 300);

    return ContentService.createTextOutput(JSON.stringify({
      replace_original: true, text: "⏳ カレンダー登録中…少し待ってね🌙"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 報告会提案：確定/辞退 → Cacheキュー + ephemeral即返し
  if (aid === "meeting_propose_confirm" || aid === "meeting_propose_decline") {
    var vQ = {};
    try { vQ = JSON.parse(String(a0.value || "{}")); } catch(_e) {}
    CacheService.getScriptCache().put("MEETING_PROPOSE_QUEUE", JSON.stringify({
      action: aid,
      projectId: String(vQ.projectId || ""),
      ym: String(vQ.ym || ""),
      startISO: String(vQ.startISO || ""),
      endISO: String(vQ.endISO || ""),
      responseUrl: responseUrl,
      channelId: channelId,
      messageTs: messageTs,
      userId: userId,
      queuedAt: new Date().toISOString()
    }), 300);

    if (responseUrl) {
      try {
        UrlFetchApp.fetch(responseUrl, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ response_type: "ephemeral", replace_original: false, text: "⏳ 処理中…少し待ってね🌙" }),
          muteHttpExceptions: true
        });
      } catch(_e) {}
    }
    return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
  }

  // 立替承認/却下
  if (aid === "reimb_approve" || aid === "reimb_reject" ||
      aid === "reimb_admin_approve" || aid === "reimb_admin_reject") {
    interactive_queueReimb_(aid, a0, pl, userId, channelId, messageTs);
    return ContentService.createTextOutput(JSON.stringify({
      response_type: "ephemeral", text: "受け取った！反映中…"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // invoice送付確認
  if (aid === "invoice_send_confirm") {
    interactive_queueGeneric_(aid, a0, pl, userId, channelId, messageTs);
    return ContentService.createTextOutput(JSON.stringify({
      response_type: "ephemeral", text: "受け取った！反映中…"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // デフォルト
  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}

function interactive_queueReimb_(aid, a0, pl, userId, channelId, messageTs) {
  const cache = CacheService.getScriptCache();
  const dedupeKey = "reimb_dedupe_" + [userId, channelId, messageTs, aid].join("_");
  if (cache.get(dedupeKey)) return;
  cache.put(dedupeKey, "1", 120);

  const key = "SLACK_INTERACTIVE_QUEUE_CACHE";
  let arr = [];
  try { arr = JSON.parse(cache.get(key) || "[]"); } catch(_e) { arr = []; }
  arr.push({
    atJst: utils_jstNow_(),
    actionId: aid,
    actionValue: String(a0.value || ""),
    userId: userId,
    channelId: channelId,
    messageTs: messageTs
  });
  if (arr.length > 30) arr = arr.slice(arr.length - 30);
  cache.put(key, JSON.stringify(arr), 600);
}

function interactive_queueGeneric_(aid, a0, pl, userId, channelId, messageTs) {
  const key = "SLACK_INTERACTIVE_QUEUE_CACHE";
  const cache = CacheService.getScriptCache();
  let arr = [];
  try { arr = JSON.parse(cache.get(key) || "[]"); } catch(_e) { arr = []; }
  arr.push({
    atJst: utils_jstNow_(),
    actionId: aid,
    actionValue: String(a0.value || ""),
    userId: userId,
    channelId: channelId,
    messageTs: messageTs
  });
  if (arr.length > 30) arr = arr.slice(arr.length - 30);
  cache.put(key, JSON.stringify(arr), 600);
}