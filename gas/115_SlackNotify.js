/**
 * 115_SlackNotify.gs
 *
 * 役割：
 * - PJのSlackチャンネルへ通知を投稿する（DMじゃない）
 * - admin/PMメンション文字列をDBから組み立てる
 *
 * 前提：
 * - Bot Token は既存の仕組み（例：slack_getBotToken_）があるならそれを優先して使う
 * - ここでは最低限のフォールバックとして ScriptProperties からも取れるようにしてる
 */

// =========================
// Public (Billingから呼ぶ)
// =========================

function slackNotifyPostInvoiceIssueRequested(arg){
  // arg: { projectId, ym, projectName, requestedByEmail, note, uploadUrl, clientName, amountText }
  const channelId = slackNotifyGetProjectChannelId_(arg.projectId);
  if (!channelId) return { ok:false, message:"slack channelId missing for project", projectId: arg.projectId };

  const adminMentions = slackNotifyGetAdminMentions_();

  const title = "【請求書 発行依頼】";
  const head = adminMentions ? (title + "\n" + adminMentions) : title;

  const detailLines = [];
  detailLines.push(`PJ: ${arg.projectName || arg.projectId}`);
  detailLines.push(`対象月: ${arg.ym}`);
  if (arg.clientName) detailLines.push(`送付先: ${arg.clientName}`);
  if (arg.amountText) detailLines.push(`金額: ${arg.amountText}`);
  if (arg.requestedByEmail) detailLines.push(`依頼者: ${arg.requestedByEmail}`);
  if (arg.note) detailLines.push(`メモ: ${arg.note}`);

  const detailText = detailLines.join("\n");
  let uploadUrl = String(arg.uploadUrl || "").trim();

  // ★ここが今回の本題：ボタンリンクを「請求書発行アンカー」にワープさせる
  try{
    if (uploadUrl && !/[?&]focus=/.test(uploadUrl)) {
      uploadUrl += (uploadUrl.includes("?") ? "&" : "?") + "focus=invoiceSend";
    }
  }catch(e){}

  // Slackは blocks があっても text が必須（通知/検索用）
  const fallbackText = head + "\n" + detailText + (uploadUrl ? ("\nアップロード: " + uploadUrl) : "");

  const blocks = [];
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: head }
  });
  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: detailText }
  });

  if (uploadUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "請求書PDFアップロード", emoji: true },
          url: uploadUrl
        }
      ]
    });
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: "↑このボタンからAMD OSのアップロード画面に飛べるよ" }
      ]
    });
  } else {
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: "アップロードURLが空。OS側のリンク生成を確認してね。" }
      ]
    });
  }

  return slackNotifyPostToChannelTsukuyomi_(channelId, { text: fallbackText, blocks: blocks });
}

function slackNotifyPostInvoiceCancelRequested(arg){
  // arg: { projectId, ym, projectName, requestedByEmail, freeeInvoiceNumber, freeeInvoiceId, cancelUrl }
  const channelId = slackNotifyGetProjectChannelId_(arg.projectId);
  if (!channelId) return { ok:false, message:"slack channelId missing for project", projectId: arg.projectId };

  const adminMentions = slackNotifyGetAdminMentions_();
  const lines = [];
  lines.push("【請求書 発行取消依頼】");
  if (adminMentions) lines.push(adminMentions);
  lines.push(`PJ: ${arg.projectName || arg.projectId}`);
  lines.push(`対象月: ${arg.ym}`);
  if (arg.freeeInvoiceNumber) lines.push(`freee番号: ${arg.freeeInvoiceNumber}`);
  if (arg.freeeInvoiceId) lines.push(`freee id: ${arg.freeeInvoiceId}`);
  if (arg.requestedByEmail) lines.push(`依頼者: ${arg.requestedByEmail}`);
  if (arg.cancelUrl) lines.push(`取消URL: ${arg.cancelUrl}`);

  return slackNotifyPostToChannel_(channelId, lines.join("\n"));
}

function slackNotifyPostInvoiceIssued(arg){
  // arg: { projectId, ym, projectName, freeeInvoiceNumber, freeeInvoiceId,
  //        gross, reimbYen, uploadUrl, invoicePdfUrl, invoicePdfFileId }

  let uploadUrl = String(arg && arg.uploadUrl ? arg.uploadUrl : "").trim();
  if (!uploadUrl) {
    return { ok:true, skipped:true, reason:"uploadUrl_empty_skip" };
  }

  // focus を invoiceSend に寄せる
  try{
    if (/[?&]focus=/.test(uploadUrl)) {
      uploadUrl = uploadUrl.replace(/([?&])focus=[^&#]*/g, "$1focus=invoiceSend");
    } else {
      uploadUrl += (uploadUrl.includes("?") ? "&" : "?") + "focus=invoiceSend";
    }
  }catch(e){}

  const channelId = slackNotifyGetProjectChannelId_(arg.projectId);
  if (!channelId) return { ok:false, message:"slack channelId missing for project", projectId: arg.projectId };

  const adminMentions = slackNotifyGetAdminMentions_();
  const title = "【請求書 発行完了｜アップロードして】";
  const head = adminMentions ? (title + "\n" + adminMentions) : title;

  const detailLines = [];
  detailLines.push(`PJ: ${arg.projectName || arg.projectId}`);
  detailLines.push(`対象月: ${arg.ym}`);
  if (arg.freeeInvoiceNumber) detailLines.push(`freee番号: ${arg.freeeInvoiceNumber}`);
  if (arg.freeeInvoiceId) detailLines.push(`freee id: ${arg.freeeInvoiceId}`);
  if (arg.gross !== undefined && arg.gross !== null) detailLines.push(`業務委託費(税抜): ${Number(arg.gross || 0)}円`);
  if (arg.reimbYen !== undefined && arg.reimbYen !== null) detailLines.push(`立替(税抜換算): ${Number(arg.reimbYen || 0)}円`);

  const guide = "freeeで請求書PDFをダウンロードして、下のボタンからAMD OSにアップロードしてね。";

  const fallbackText =
    head + "\n" + detailLines.join("\n") + "\n" + guide + "\nアップロード: " + uploadUrl;

  const blocks = [];
  blocks.push({ type: "section", text: { type: "mrkdwn", text: head } });
  blocks.push({ type: "section", text: { type: "mrkdwn", text: detailLines.join("\n") } });
  blocks.push({ type: "section", text: { type: "mrkdwn", text: guide } });

  // ボタン群
  var buttons = [
    {
      type: "button",
      text: { type: "plain_text", text: "請求書PDFアップロード", emoji: true },
      style: "primary",
      url: uploadUrl
    }
  ];

  // PDF閲覧ボタン（DriveにPDFが保存されていれば追加）
  var pdfUrl = String(arg.invoicePdfUrl || "").trim();
  var pdfFileId = String(arg.invoicePdfFileId || "").trim();
  if (pdfUrl || pdfFileId) {
    var pdfLink = pdfUrl || ("https://drive.google.com/file/d/" + pdfFileId + "/view");
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: "📄 請求書PDFを見る", emoji: true },
      url: pdfLink
    });
  }

  blocks.push({
    type: "actions",
    elements: buttons
  });

  return slackNotifyPostToChannelTsukuyomi_(channelId, { text: fallbackText, blocks: blocks });
}

function slackNotifyPostInvoicePdfUploaded(arg){
  // arg: { projectId, ym, projectName, freeeInvoiceNumber, invoicePdfUrl, invoicePdfFileId }
  const channelId = slackNotifyGetProjectChannelId_(arg.projectId);
  if (!channelId) return { ok:false, message:"slack channelId missing", projectId: arg.projectId };

  const pmMentions = slackNotifyGetPmMentions_(arg.projectId);
  const ym = String(arg.ym || "");
  const ymLabel = ym.slice(0,4) + "年" + String(Number(ym.slice(4,6))) + "月度";

  const head = (pmMentions ? pmMentions + "\n" : "")
    + `📎 *${arg.projectName || arg.projectId}* ${ymLabel} 請求書PDFの送付をお願いしたい🌙`;

  const pdfLine = arg.invoicePdfUrl
    ? `<${arg.invoicePdfUrl}|📄 PDFをDriveで開く>`
    : "（PDFリンク未取得）";

  const guide = "上のリンクからPDFをダウンロードしてクライアントに送付してね。\n送付完了したら下のボタンを押して記録してね。";

  const fallbackText = head + "\n" + pdfLine + "\n" + guide;

  const blocks = [
    { type:"section", text:{ type:"mrkdwn", text: head } },
    { type:"section", text:{ type:"mrkdwn", text: pdfLine } },
    { type:"section", text:{ type:"mrkdwn", text: guide } },
    {
      type:"actions",
      elements:[
        {
          type:"button",
          text:{ type:"plain_text", text:"送付完了を記録する ✅", emoji:true },
          style:"primary",
          action_id:"invoice_send_confirm",
          value: JSON.stringify({ projectId: arg.projectId, ym: ym })
        }
      ]
    }
  ];

  return slackNotifyPostToChannelTsukuyomi_(channelId, { text: fallbackText, blocks: blocks });
}

// =========================
// Core
// =========================
function slackNotifyPostToChannel_(channelId, arg){
  const token = slackNotifyGetBotToken_();
  if (!token) return { ok:false, message:"SLACK_BOT_TOKEN missing" };

  // 互換：旧呼び出し（text文字列）も受ける
  const obj = (typeof arg === "string")
    ? { text: String(arg || "").trim() }
    : (arg || {});

  const text = String(obj.text || "").trim();
  const blocks = Array.isArray(obj.blocks) ? obj.blocks : null;

  const payload = {
    channel: String(channelId || "").trim(),
    text: text || "notification"
  };
  if (blocks && blocks.length) payload.blocks = blocks;

  // ★追加：表示名/アイコン（効かない環境もあるが無害）
  const username = String(obj.username || "").trim();
  const iconEmoji = String(obj.icon_emoji || "").trim();
  const iconUrl = String(obj.icon_url || "").trim();

  if (username) payload.username = username;
  if (iconEmoji) payload.icon_emoji = iconEmoji;
  if (iconUrl) payload.icon_url = iconUrl;

  const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const body = res.getContentText();
  const json = slackNotifySafeJsonParse_(body);

  if (!json || !json.ok) {
    return { ok:false, message:"slack chat.postMessage failed", status: res.getResponseCode(), body };
  }
  return { ok:true, channel: json.channel, ts: json.ts };
}

function slackNotifyGetProjectChannelId_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return "";

  // 1) Repoがあるなら優先
  try{
    if (typeof projectRepo_getProjectById_ === "function") {
      const pj = projectRepo_getProjectById_(projectId);
      const v = pj && (pj.slackChannelId || pj.channelId || pj.slackChannel);
      return v ? String(v).trim() : "";
    }
  }catch(e){}

  // 2) DB_Projects を確実に読む（thinは使わない）
  try{
    if (typeof b_readTable_ !== "function") return "";
    const rows = b_readTable_("DB_Projects") || [];
    const hit = rows.find(r => String(r.projectId || "").trim() === projectId);
    if (!hit) return "";

    const v = hit.slackChannelId || hit.channelId || hit.slackChannel || "";
    return String(v || "").trim();
  }catch(e){
    return "";
  }
}

function slackNotifyGetAdminMentions_(){
  // admin定義は “メール固定” でいい（AMDの実運用ルールが既にある）
  const adminEmails = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  const ids = slackNotifyGetSlackIdsByEmails_(adminEmails);
  const mention = ids.filter(Boolean).map(id => `<@${id}>`).join(" ");
  return mention;
}

function slackNotifyGetPmMentions_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return "";

  // 1) Repo があるなら優先（既存設計を壊さない）
  try{
    if (typeof projectMembersRepo_listByProjectId_ === "function") {
      const rows = projectMembersRepo_listByProjectId_(projectId) || [];
      const pmIds = rows
        .filter(r => (r && (r.isPM === true || String(r.isPM||"").toUpperCase() === "TRUE")) || String(r.role||"").toLowerCase() === "pm")
        .map(r => r.slackUserId || r.slackId)
        .filter(Boolean)
        .map(v => String(v).trim());
      if (pmIds.length) return pmIds.map(id => `<@${id}>`).join(" ");
    }
  }catch(e){}

  // 2) DB_ProjectMembers の isPM で確定（ここが本命）
  //    - DB_ProjectMembers: projectId, memberId, isPM ...
  //    - DB_Members: memberId, slackId ...
  try{
    if (typeof b_readTableThin_ !== "function") return "";

    const pmRows = b_readTableThin_("DB_ProjectMembers", ["projectId","memberId","isPM"]) || [];
    const pmMemberIds = pmRows
      .filter(r => String(r.projectId||"").trim() === projectId)
      .filter(r => (r.isPM === true) || (String(r.isPM||"").toUpperCase() === "TRUE") || (String(r.isPM||"") === "1"))
      .map(r => String(r.memberId||"").trim())
      .filter(Boolean);

    if (!pmMemberIds.length) return "";

    const memRows = b_readTableThin_("DB_Members", ["memberId","slackId"]) || [];
    const slackMap = {};
    memRows.forEach(r => {
      const mid = String(r.memberId||"").trim();
      if (!mid) return;
      slackMap[mid] = String(r.slackId||"").trim();
    });

    const slackIds = pmMemberIds
      .map(mid => slackMap[mid] || "")
      .filter(Boolean);

    if (!slackIds.length) return "";

    // 重複除去して安定化
    const uniq = [];
    const seen = {};
    slackIds.forEach(id => {
      if (seen[id]) return;
      seen[id] = true;
      uniq.push(id);
    });

    return uniq.map(id => `<@${id}>`).join(" ");
  }catch(e){
    return "";
  }
}

function slackNotifyGetSlackIdsByEmails_(emails){
  emails = Array.isArray(emails) ? emails : [];
  const need = emails.map(x => String(x||"").toLowerCase().trim()).filter(Boolean);
  if (!need.length) return [];

  // DB_Members: email, slackId
  const rows = (typeof b_readTableThin_ === "function")
    ? (b_readTableThin_("DB_Members", ["email","slackId"]) || [])
    : [];

  const map = {};
  rows.forEach(r => {
    const em = String(r.email||"").toLowerCase().trim();
    if (!em) return;
    map[em] = String(r.slackId||"").trim();
  });

  return need.map(em => map[em] || "");
}

function slackNotifyGetBotToken_(){
  // 既存にトークン取得関数があるならそれを使う
  try{
    if (typeof slack_getBotToken_ === "function") {
      const t = String(slack_getBotToken_() || "").trim();
      if (t) return t;
    }
  }catch(e){}

  return String(PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN") || "").trim();
}

function slackNotifySafeJsonParse_(s){
  try { return JSON.parse(String(s || "")); } catch(e){ return null; }
}

function api_rejectInvoiceCancelByToken(payload){
  payload = payload || {};
  const projectId = String(payload.projectId||"").trim();
  const ym = b_normYm_(payload.ym);
  const token = String(payload.token||"").trim();
  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");
  if (!token) throw new Error("token empty");

  // kyoko or masa only
  const me = (Session.getActiveUser().getEmail()||"").toLowerCase().trim();
  const allowed = ["kyoko@team-armada.jp", "masa@team-armada.jp"];
  if (!allowed.includes(me)) return { ok:false, message:"きよ・まさ以外は操作できない" };

  const sh = b_ss_().getSheetByName("DB_InvoiceCancelTokens");
  if (!sh) return { ok:false, message:"DB_InvoiceCancelTokens not found" };

  const vals = sh.getDataRange().getValues();
  const h = vals[0].map(x=>String(x||"").trim());
  const iPid = h.indexOf("projectId");
  const iYm = h.indexOf("ym");
  const iTok = h.indexOf("token");
  const iUsedAt = h.indexOf("usedAt");
  const iUsedBy = h.indexOf("usedBy");

  let hitRow = -1;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iPid]||"").trim() === projectId &&
        b_normYm_(vals[r][iYm]) === ym &&
        String(vals[r][iTok]||"").trim() === token) {
      hitRow = r+1; break;
    }
  }
  if (hitRow < 0) return { ok:false, message:"token not found" };

  const used = (iUsedAt>=0) ? String(sh.getRange(hitRow,iUsedAt+1).getValue()||"").trim() : "";
  if (used) return { ok:false, message:"already used" };

  const nowIso = b_nowIso_();
  if (iUsedAt>=0) sh.getRange(hitRow,iUsedAt+1).setValue(nowIso);
  if (iUsedBy>=0) sh.getRange(hitRow,iUsedBy+1).setValue(me + " (rejected)");

  // ログだけ残す（状態は変えない）
  try{
    b_appendBillingLog_({
      actionType: "INVOICE_CANCEL_REJECT",
      target: "invoice",
      projectId,
      ym,
      cycleId: `${projectId}_${ym}`,
      beforeValue: "",
      afterValue: JSON.stringify({ token, rejectedBy: me }),
      reason: "invoice_cancel_reject",
      operatorUserId: me,
      operatorName: me,
      createdAt: b_nowIso_()
    });
  }catch(e){}

  return { ok:true };
}

/**
 * つくよみ専用：Slack投稿
 * - Bot Token: SLACK_TSUKUYOMI_BOT_TOKEN
 * - 発話主体：つくよみ
 */
function slackNotifyPostToChannelTsukuyomi_(channelId, arg){
  const token = String(
    PropertiesService.getScriptProperties().getProperty("SLACK_TSUKUYOMI_BOT_TOKEN") || ""
  ).trim();
  if (!token) return { ok:false, message:"SLACK_TSUKUYOMI_BOT_TOKEN missing" };

  const obj = (typeof arg === "string")
    ? { text: String(arg || "").trim() }
    : (arg || {});

  const payload = {
    channel: String(channelId || "").trim(),
    text: String(obj.text || "notification"),
    blocks: Array.isArray(obj.blocks) ? obj.blocks : undefined
  };

  const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const body = res.getContentText();
  const json = slackNotifySafeJsonParse_(body);

  if (!json || !json.ok) {
    return { ok:false, message:"tsukuyomi chat.postMessage failed", body };
  }
  return { ok:true, channel: json.channel, ts: json.ts };
}

function slackNotifyBuildBillingRoutineMessage_(projectId, ym){
  return null;
}

function slackNotifyPostBillingRoutineTsukuyomi_(projectId, ym){
  return { ok: true, disabled: true, reason: "pm monthly routine abolished 2026-06-19", projectId: projectId, ym: ym };
}

function slackNotifyBuildMeetingScheduleMessage_(projectId, projectName, ym) {
  return null;
}

/** 削除候補
 * まさ・きよの空き30分スロットを取得
 * @param {string[]} emails - チェック対象メールアドレス
 * @param {number} daysAhead - 翌日から何日先まで
 * @param {number} startHour - 開始時 (JST, 例: 10)
 * @param {number} endHour   - 終了時 (JST, 例: 18)
 * @return {{start:Date, end:Date}[]}

function getAvailableMeetingSlots_(emails, daysAhead, startHour, endHour) {
  var tz = "Asia/Tokyo";
  var now = new Date();
  var rangeStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  var rangeEnd   = new Date(now.getTime() + (daysAhead + 1) * 24 * 60 * 60 * 1000);

  var calItems = emails.map(function(e){ return { id: e }; });
  var fbResult = Calendar.Freebusy.query({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    timeZone: tz,
    items: calItems
  });

  var busyBlocks = [];
  emails.forEach(function(email) {
    var cal = fbResult.calendars[email];
    if (cal && Array.isArray(cal.busy)) {
      cal.busy.forEach(function(b) {
        busyBlocks.push({ start: new Date(b.start), end: new Date(b.end) });
      });
    }
  });

  var startDateStr = Utilities.formatDate(rangeStart, tz, "yyyy-MM-dd");
  var cursor = new Date(startDateStr + "T" + tsuPad2_(startHour) + ":00:00+09:00");

  var slots = [];

  while (cursor < rangeEnd) {
    var hourNum = Number(Utilities.formatDate(cursor, tz, "HH"));

    if (hourNum >= endHour) {
      var nextDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(nextDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    var dayBase = new Date(Utilities.formatDate(cursor, tz, "yyyy-MM-dd") + "T12:00:00+09:00");
    var dow = dayBase.getDay();
    if (dow === 0 || dow === 6) {
      var skipDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(skipDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    if (tsuIsJapaneseHoliday_(dayBase)) {
      var holDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(holDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    var slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);

    var isBusy = busyBlocks.some(function(b) {
      return b.start < slotEnd && b.end > cursor;
    });

    if (!isBusy) {
      slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
    }

    cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
  }

  return slots;
}
 */

function getAvailableMeetingSlotsRange_(emails, rangeStart, rangeEnd, startHour, endHour) {
  var tz = "Asia/Tokyo";

  var calItems = emails.map(function(e){ return { id: e }; });
  var fbResult = Calendar.Freebusy.query({
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    timeZone: tz,
    items: calItems
  });

  var busyBlocks = [];
  emails.forEach(function(email) {
    var cal = fbResult.calendars[email];
    if (cal && Array.isArray(cal.busy)) {
      cal.busy.forEach(function(b) {
        busyBlocks.push({ start: new Date(b.start), end: new Date(b.end) });
      });
    }
  });

  var startDateStr = Utilities.formatDate(rangeStart, tz, "yyyy-MM-dd");
  var cursor = new Date(startDateStr + "T" + tsuPad2_(startHour) + ":00:00+09:00");
  var slots = [];

  while (cursor < rangeEnd) {
    var hourNum = Number(Utilities.formatDate(cursor, tz, "HH"));

    if (hourNum >= endHour) {
      var nextDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(nextDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    var dayBase = new Date(Utilities.formatDate(cursor, tz, "yyyy-MM-dd") + "T12:00:00+09:00");
    var dow = dayBase.getDay();
    if (dow === 0 || dow === 6) {
      var skipDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(skipDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    if (tsuIsJapaneseHoliday_(dayBase)) {
      var holDate = Utilities.formatDate(new Date(cursor.getTime() + 24*60*60*1000), tz, "yyyy-MM-dd");
      cursor = new Date(holDate + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      continue;
    }

    var slotEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
    var isBusy = busyBlocks.some(function(b) {
      return b.start < slotEnd && b.end > cursor;
    });

    if (!isBusy) slots.push({ start: new Date(cursor), end: new Date(slotEnd) });
    cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
  }

  return slots;
}

/**
 * 3人ANDの空き枠取得（13-18優先、なければ9-20）
 * @param {string[]} emails
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @return {{start:Date, end:Date}[]}
 */
function getAvailableMeetingSlotsAnd_(emails, rangeStart, rangeEnd) {
  // 優先：13-18
  var slots = getAvailableMeetingSlotsRange_(emails, rangeStart, rangeEnd, 13, 18);
  if (slots.length > 0) return slots;
  // フォールバック：9-20
  return getAvailableMeetingSlotsRange_(emails, rangeStart, rangeEnd, 9, 20);
}

/**
 * 複数PJに対してスロットを割り当てる
 * 優先順：月〜水13-18 → 月〜水9-20 → 木金バッファ枠（buffer以外の予定がなければ）
 * 1日最大2PJ、連続OK、連続ブロック前後30分バッファ必須
 */
function assignMeetingSlotsForPendingProjects_(pendingList, rangeStart, rangeEnd) {
  var tz = "Asia/Tokyo";
  var adminEmails = ["masa@team-armada.jp", "kyoko@team-armada.jp"];

  var extendedEnd = new Date(rangeEnd.getTime() + 7*24*60*60*1000);
  var allEmails = adminEmails.slice();
  pendingList.forEach(function(p) {
    if (p.pmEmail && allEmails.indexOf(p.pmEmail) < 0) allEmails.push(p.pmEmail);
  });

  var fbResult = Calendar.Freebusy.query({
    timeMin: rangeStart.toISOString(),
    timeMax: extendedEnd.toISOString(),
    timeZone: tz,
    items: allEmails.map(function(e){ return { id: e }; })
  });

  var busyByEmail = {};
  allEmails.forEach(function(email) {
    busyByEmail[email] = [];
    var cal = fbResult.calendars[email];
    if (cal && Array.isArray(cal.busy)) {
      cal.busy.forEach(function(b) {
        busyByEmail[email].push({ start: new Date(b.start), end: new Date(b.end) });
      });
    }
  });

  // 割り当て済みスロット（全員のbusyに追加して次のPJが重複しないようにする）
  var assignedSlots = []; // {start, end}

  function isAssignedBusy(s, e) {
    return assignedSlots.some(function(a){ return a.start < e && a.end > s; });
  }
  function isBusyFor(email, s, e) {
    return (busyByEmail[email] || []).some(function(b){ return b.start < e && b.end > s; });
  }
  function isAdminFree(s, e) {
    return adminEmails.every(function(em){ return !isBusyFor(em, s, e); }) && !isAssignedBusy(s, e);
  }
  function isThreeFree(pmEmail, s, e) {
    if (!isAdminFree(s, e)) return false;
    if (pmEmail && isBusyFor(pmEmail, s, e)) return false;
    return true;
  }

  function isBufferSlotAvailable_(dateStr, startHour, endHour) {
    try {
      var cal = CalendarApp.getCalendarById("masa@team-armada.jp");
      if (!cal) return false;
      var dayStart = new Date(dateStr + "T" + tsuPad2_(startHour) + ":00:00+09:00");
      var dayEnd   = new Date(dateStr + "T" + tsuPad2_(endHour)   + ":00:00+09:00");
      var events = cal.getEvents(dayStart, dayEnd);
      for (var i = 0; i < events.length; i++) {
        var title = String(events[i].getTitle() || "").trim().toLowerCase();
        if (title !== "buffer") return false;
      }
      return true;
    } catch(e) {
      return false;
    }
  }

  // 対象日リスト（月〜水優先=0、木金劣後=1）
  var days = [];
  var cur = new Date(rangeStart);
  while (cur < extendedEnd) {
    var dateStr = Utilities.formatDate(cur, tz, "yyyy-MM-dd");
    var dayBase = new Date(dateStr + "T12:00:00+09:00");
    var dow = dayBase.getDay();
    if (dow !== 0 && dow !== 6 && !tsuIsJapaneseHoliday_(dayBase)) {
      days.push({ dateStr: dateStr, dow: dow, priority: (dow >= 1 && dow <= 3) ? 0 : 1 });
    }
    cur = new Date(cur.getTime() + 24*60*60*1000);
  }
  days.sort(function(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.dateStr < b.dateStr ? -1 : 1;
  });

  function getTimeRanges(dow, dateStr) {
    if (dow >= 1 && dow <= 3) return [[13, 18], [9, 13], [18, 20]];
    var endHour = (dow === 5) ? 16 : 18;
    return isBufferSlotAvailable_(dateStr, 13, endHour) ? [[13, endHour]] : [];
  }

  var assignments = {};
  var daySlots = {}; // dateStr -> [{start,end}]

  for (var pi = 0; pi < pendingList.length; pi++) {
    var p = pendingList[pi];
    var pmEmail = p.pmEmail || "";
    var assigned = false;

    for (var di = 0; di < days.length && !assigned; di++) {
      var day = days[di];
      var existing = daySlots[day.dateStr] || [];
      if (existing.length >= 2) continue;

      var ranges = getTimeRanges(day.dow, day.dateStr);

      for (var ri = 0; ri < ranges.length && !assigned; ri++) {
        var slotCursor = new Date(day.dateStr + "T" + tsuPad2_(ranges[ri][0]) + ":00:00+09:00");
        var rangeEndDt = new Date(day.dateStr + "T" + tsuPad2_(ranges[ri][1]) + ":00:00+09:00");

        while (slotCursor < rangeEndDt && !assigned) {
          var slotEnd = new Date(slotCursor.getTime() + 30*60*1000);

          if (!isThreeFree(pmEmail, slotCursor, slotEnd)) {
            slotCursor = new Date(slotCursor.getTime() + 30*60*1000);
            continue;
          }

          // 連続ブロック前後バッファチェック（まさ・きよ基準）
          var bufBefore = new Date(slotCursor.getTime() - 30*60*1000);
          var bufAfter  = new Date(slotEnd.getTime()   + 30*60*1000);
          var isConsBefore = existing.some(function(a){ return a.end.getTime() === slotCursor.getTime(); });
          var isConsAfter  = existing.some(function(a){ return a.start.getTime() === slotEnd.getTime(); });

          var bufOk =
            (isConsBefore || isAdminFree(bufBefore, slotCursor)) &&
            (isConsAfter  || isAdminFree(slotEnd,   bufAfter));

          if (!bufOk) {
            slotCursor = new Date(slotCursor.getTime() + 30*60*1000);
            continue;
          }

          // 確定：割り当て済みに追加（以降のPJが重複しないよう）
          assignments[p.projectId] = { start: new Date(slotCursor), end: new Date(slotEnd) };
          if (!daySlots[day.dateStr]) daySlots[day.dateStr] = [];
          daySlots[day.dateStr].push({ start: new Date(slotCursor), end: new Date(slotEnd) });
          assignedSlots.push({ start: new Date(slotCursor), end: new Date(slotEnd) });
          assigned = true;
        }
      }
    }
  }

  return assignments;
}

function tsuIsJapaneseHoliday_(date) {
  try {
    var cal = CalendarApp.getCalendarById("ja.japanese#holiday@group.v.calendar.google.com");
    if (!cal) return false;
    return cal.getEventsForDay(date).length > 0;
  } catch(e) {
    return false;
  }
}

function tsuPad2_(n) {
  return n < 10 ? "0" + n : String(n);
}

// ================================================================
// Phase 5: 請求書送付（PDFアップロード完了後に呼ばれる）
// ================================================================

/**
 * PDFアップロード完了後、invoiceAutoSendフラグで分岐する
 * - true  → B_InvoiceEmail.gsで自動送付 → 完了通知
 * - false → Slackに「手動送付してね」＋「送付完了を報告」ボタン
 *
 * @param {string} projectId
 * @param {string} ym (yyyymm)
 * @return {Object}
 */
function slackNotifyTriggerInvoiceSendPhase_(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !ym) return { ok:false, message:"projectId/ym missing" };

  var channelId = slackNotifyGetProjectChannelId_(projectId);
  if (!channelId) return { ok:false, message:"channelId missing" };

  // DB_ProjectsからinvoiceAutoSendを読む
  var autoSend = false;
  try{
    var rows = b_readTable_("DB_Projects") || [];
    var hit = null;
    for (var i = 0; i < rows.length; i++){
      if (String(rows[i].projectId || "").trim() === projectId){
        hit = rows[i];
        break;
      }
    }
    if (hit){
      var v = String(hit.invoiceAutoSend || "").trim().toUpperCase();
      autoSend = (v === "TRUE" || v === "1" || v === "YES");
    }
  } catch(e){}

  // BillingCycle情報
  var cycle = null;
  try{ cycle = b_getCycleOne_(projectId, ym) || {}; } catch(e){ cycle = {}; }
  var projectName = String(cycle.projectName || "").trim() || projectId;
  var ymLabel = String(ym).slice(0,4) + "年" + String(ym).slice(4).replace(/^0/,"") + "月";
  var invoiceNumber = String(cycle.freeeInvoiceNumber || "").trim();

  var adminMention = slackNotifyGetAdminMentions_();

  if (autoSend){
    // ── 自動送付 ──
    var sendResult = { ok:false };
    try{
      if (typeof api_sendInvoiceEmail_ === "function"){
        sendResult = api_sendInvoiceEmail_({ projectId: projectId, ym: ym });
      } else if (typeof api_sendInvoiceEmail === "function"){
        sendResult = api_sendInvoiceEmail({ projectId: projectId, ym: ym });
      }
    } catch(e){
      sendResult = { ok:false, message:String(e.message || e) };
    }

    if (sendResult && sendResult.ok){
      var txt = "✅ *" + projectName + "* " + ymLabel + "度\n"
        + "請求書を自動送付したよ"
        + (invoiceNumber ? "（" + invoiceNumber + "）" : "") + "\n"
        + "あとは入金確認を待つだけ🌙";

      slackNotifyPostToChannelTsukuyomi_(channelId, { text: txt });
      return { ok:true, action:"auto_sent" };
    } else {
      // 自動送付失敗 → 手動送付にフォールバック
      var errTxt = (adminMention ? adminMention + "\n" : "")
        + "⚠️ *" + projectName + "* " + ymLabel + "度\n"
        + "自動送付に失敗した…手動で送付お願い🌙\n"
        + "理由: " + String(sendResult && sendResult.message ? sendResult.message : "不明");

      slackNotifyPostToChannelTsukuyomi_(channelId, {
        text: errTxt,
        blocks: [
          { type:"section", text:{ type:"mrkdwn", text: errTxt } },
          { type:"actions", elements:[
            {
              type:"button",
              text:{ type:"plain_text", text:"送付完了を報告" },
              style:"primary",
              action_id:"invoice_send_confirm",
              value: JSON.stringify({ projectId: projectId, ym: ym })
            }
          ]}
        ]
      });
      return { ok:true, action:"auto_failed_fallback_manual" };
    }
  }

  // ── 手動送付（通知のみ、ボタンなし）──
  var txt = (adminMention ? adminMention + "\n" : "")
    + "📨 *" + projectName + "* " + ymLabel + "度\n"
    + "PDFアップロード完了！"
    + (invoiceNumber ? "（" + invoiceNumber + "）" : "") + "\n"
    + "クライアントにメールで請求書を送付したらAMD OSのBilling画面から「送付完了を記録」してね🌙";

  slackNotifyPostToChannelTsukuyomi_(channelId, { text: txt });
  return { ok:true, action:"manual_prompt" };
}
