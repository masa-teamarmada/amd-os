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

  return slackNotifyPostToChannel_(channelId, { text: fallbackText, blocks: blocks });
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
  // arg: { projectId, ym, projectName, freeeInvoiceNumber, freeeInvoiceId, gross, reimbYen, uploadUrl }

  // ★ガード：uploadUrl が無い呼び出しは投稿しない（古い経路を無害化）
  let uploadUrl = String(arg && arg.uploadUrl ? arg.uploadUrl : "").trim();
  if (!uploadUrl) {
    return { ok:true, skipped:true, reason:"uploadUrl_empty_skip" };
  }

  // ★今回の本題：focus を invoiceSend に“必ず”寄せる
  // - 既に focus=invoiceUpload 等が入ってても上書きする
  // - focus が無ければ付ける
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
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "請求書PDFアップロード", emoji: true },
        style: "primary",
        url: uploadUrl
      }
    ]
  });

  return slackNotifyPostToChannel_(channelId, { text: fallbackText, blocks: blocks });
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
