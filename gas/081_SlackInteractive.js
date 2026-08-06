/** 081_SlackInteractive.gs
 * Slack Interactivity（Block Kit button）受信処理。
 * Slackの3秒制限があるので、ここでは「payload parse + ログ + 可能なら即時response_urlへ通知」までに留める。
 * 重い処理（スプシ更新等）は後続ワーカーに回す。
 */

function slackHandleInteractive(e){
  const payloadStr = (e && e.parameter && e.parameter.payload) ? String(e.parameter.payload) : "";
  if (!payloadStr) return;

  let payload = null;
  try{
    payload = JSON.parse(payloadStr);
  } catch(_e){
    return;
  }

  const responseUrl = String(payload.response_url || "").trim();

  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const act = actions[0] || {};
  const actionId = String(act.action_id || "").trim();
  const actionValue = String(act.value || "").trim();

  const userId = payload && payload.user && payload.user.id ? String(payload.user.id) : "";
  const userName = payload && payload.user && payload.user.username ? String(payload.user.username) : "";

  const channelId = payload && payload.channel && payload.channel.id ? String(payload.channel.id) : "";
  const messageTs = payload && payload.message && payload.message.ts ? String(payload.message.ts) : "";

  // ★doPost内では外部I/Oをしない（タイムアウト回避）
  // ScriptPropertiesキューに積む
  const props = PropertiesService.getScriptProperties();
  const key = "SLACK_INTERACTIVE_QUEUE_JSON";

  let arr = [];
  try{
    const cur = props.getProperty(key);
    arr = cur ? JSON.parse(cur) : [];
  } catch(_e){
    arr = [];
  }

  arr.push({
    atJst: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX"),
    responseUrl: responseUrl,
    actionId: actionId,
    actionValue: actionValue,
    userId: userId,
    userName: userName,
    channelId: channelId,
    messageTs: messageTs
  });

  if (arr.length > 50) arr = arr.slice(arr.length - 50);
  props.setProperty(key, JSON.stringify(arr));
}
function slackHandleReimbInteractiveImmediate_(actionId, actionValue, payload){
  let av = {};
  try { av = actionValue ? JSON.parse(String(actionValue)) : {}; } catch(_e){ av = {}; }
  const reimbursementId = String(av.reimbursementId || "").trim();

  const slackUserId = payload && payload.user && payload.user.id ? String(payload.user.id) : "";
  const approverEmail = getEmailBySlackId(slackUserId) || "";

  if (!reimbursementId){
    return {
      response_type: "ephemeral",
      text: "⚠️ reimbursementId が取れない…（value壊れてるかも）"
    };
  }

  // ★二重押し吸収（短時間）
  const cache = CacheService.getScriptCache();
  const dedupeKey = "reimb_click_" + reimbursementId + "_" + actionId + "_" + (slackUserId || "u");
  if (cache.get(dedupeKey)){
    return { response_type:"ephemeral", text:"受け取ってるよ（連打吸収）" };
  }
  cache.put(dedupeKey, "1", 30);

  // status決定
  const nextStatus = (actionId === "reimb_approve") ? "approved" : "rejected";

  // ★ここでDB反映（軽いはず）
  let ok = true;
  let msg = "";
  try{
    const r = reimburseApplyDecision(reimbursementId, nextStatus, approverEmail);
    ok = !!(r && r.ok);
    msg = (r && r.message) ? String(r.message) : "";
  } catch(e){
    ok = false;
    msg = String(e && (e.message || e));
  }

  if (!ok){
    return {
      response_type: "ephemeral",
      text: `⚠️ 反映失敗… (${reimbursementId})\n${msg}`
    };
  }

  // ★「反映した！」は1回だけ。2回言わない。
  const label = (nextStatus === "approved") ? "承認" : "却下";
  return {
    response_type: "ephemeral",
    text: `反映した！ ${label} status=${nextStatus} (${reimbursementId})`
  };
}


/** 超軽量キュー（Cache優先） */
function slackQueueInteractiveFast_(payload, actionId, actionValue){
  // ★3秒制限対策：Cacheだけ使う（Propertiesは遅いことがある）
  const cache = CacheService.getScriptCache();
  const key = "SLACK_INTERACTIVE_QUEUE_CACHE";

  let arr = [];
  try{
    const cur = cache.get(key);
    arr = cur ? JSON.parse(cur) : [];
  } catch(_e){
    arr = [];
  }

  // 最小情報だけ
  const job = {
    atJst: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX"),
    actionId: String(actionId||""),
    actionValue: String(actionValue||""),
    userId: payload && payload.user && payload.user.id ? String(payload.user.id) : "",
    channelId: payload && payload.channel && payload.channel.id ? String(payload.channel.id) : "",
    messageTs: payload && payload.message && payload.message.ts ? String(payload.message.ts) : "",
  };

  arr.push(job);
  if (arr.length > 30) arr = arr.slice(arr.length - 30);

  cache.put(key, JSON.stringify(arr), 600);

  // ★ワーカーが1分トリガーで拾う前提（現状維持）
}

/** ワーカー：手動実行 or 1分トリガーで回す */
function slackInteractiveWorker(){
  const cache = CacheService.getScriptCache();
  const key = "SLACK_INTERACTIVE_QUEUE_CACHE";

  let arr = [];
  try{
    const cur = cache.get(key);
    arr = cur ? JSON.parse(cur) : [];
  } catch(_e){
    arr = [];
  }
  if (!arr.length) return;

  // 先頭1件
  const job = arr.shift();
  cache.put(key, JSON.stringify(arr), 600);

  // invoice_send_done は PM 月次ルーティン廃止後の旧ボタン。押されても更新しない。
  if (String(job.actionId || "") === "invoice_send_done") {
    try { invoiceSend_handleDoneFromQueue_(job); } catch (e) {
      Logger.log("legacy invoice_send_done disabled handler failed: " + (e && e.message ? e.message : e));
    }
    return;
  }

  if (String(job.actionId || "") === "payment_confirm_expected") {
    try { paymentConfirm_handleExpectedFromQueue_(job); } catch (e) {
      Logger.log("payment_confirm_expected handler failed: " + (e && e.message ? e.message : e));
    }
    return;
  }

  let av = {};
  try { av = job.actionValue ? JSON.parse(String(job.actionValue)) : {}; } catch(_e){ av = {}; }
  const reimbursementId = String(av.reimbursementId || "").trim();
  if (!reimbursementId) return;

  const approverEmail = getEmailBySlackId(job.userId) || "";

  let ok = true;
  let msg = "";
  try{
    // 立替の正本は Supabase (PWA)。旧 reimburseApplyDecision はスプレッドシート
    // DB_Reimbursements を書くだけで正本に反映されないので、PWA の API へ委譲する。
    const r = reimburseApplyDecisionViaPwa_(reimbursementId, job.actionId, approverEmail);
    ok = !!(r && r.ok);
    msg = (r && r.message) ? String(r.message) : "";
  } catch(e){
    ok = false;
    msg = String(e && (e.message || e));
  }

  // 完了通知はスレッド返信
  try{
    const props = PropertiesService.getScriptProperties();
    const botToken = String(props.getProperty("SLACK_BOT_TOKEN") || "").trim();
    if (botToken && job.channelId && job.messageTs){

      const label =
        ok
          ? (
              job.actionId === "reimb_approve" ? "✅ PM承認済み（admin待ち）" :
              job.actionId === "reimb_reject" ? "❌ PM却下" :
              job.actionId === "reimb_admin_approve" ? "✅ admin承認済み" :
              job.actionId === "reimb_admin_reject" ? "❌ admin却下" :
              "✅ 反映済み"
            )
          : "⚠️ 反映失敗";

      const text = ok
        ? `${label}（${reimbursementId} / by ${approverEmail || "unknown"}）\n${msg ? "result=" + msg : ""}`
        : `⚠️ 反映失敗（${reimbursementId}）\n${msg}`;

      UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: `Bearer ${botToken}` },
        payload: JSON.stringify({
          channel: job.channelId,
          thread_ts: job.messageTs,
          text: text
        }),
        muteHttpExceptions: true,
      });
    }
  } catch(_e){}
}

function paymentConfirm_handleExpectedFromQueue_(job) {
  job = job || {};
  var value = {};
  try { value = job.actionValue ? JSON.parse(String(job.actionValue)) : {}; } catch (_e) { value = {}; }

  var token = String(value.token || "").trim();
  var projectName = String(value.projectName || value.projectId || "対象PJ").trim();
  var invoiceYm = String(value.invoiceYm || "").trim();
  var amountYen = Number(value.expectedAmountYen || 0);

  if (!token) {
    paymentConfirm_postSlackThread_(job, "つくよみです。入金確認トークンが取れなかったから、OSで確認してね。");
    return;
  }

  var cache = CacheService.getScriptCache();
  var dedupeKey = "payment_confirm_expected_" + [String(value.projectId || ""), invoiceYm, String(job.userId || "")].join("_");
  if (cache.get(dedupeKey)) {
    paymentConfirm_postSlackThread_(job, "つくよみです。もう受け取ってるから大丈夫だよ。");
    return;
  }
  cache.put(dedupeKey, "1", 300);

  var result = paymentConfirm_callPwaExpected_(token);
  if (!result.ok) {
    paymentConfirm_postSlackThread_(
      job,
      "つくよみです。入金確認をOSへ反映できなかった…\n" +
        String(result.error || "unknown error") + "\n" +
        "金額入力ボタンかOS側で確認してね。"
    );
    return;
  }

  var updated = Number(result.updated || 0);
  var already = Number(result.alreadyConfirmed || 0);
  var y = paymentConfirm_ymLabel_(String(result.invoiceYm || invoiceYm));
  var a = paymentConfirm_yen_(Number(result.amountYen || amountYen || 0));
  var alreadyText = already > 0 ? "（うち確認済み " + already + " cycle）" : "";
  paymentConfirm_postSlackThread_(
    job,
    "つくよみです。*予定通り入金済み* としてOSに反映したよ。\n" +
      "PJ: *" + projectName + "* / 支払月: *" + y + "* / 入金額: *" + a + "*\n" +
      "更新: " + updated + " cycle " + alreadyText
  );
}

function paymentConfirm_callPwaExpected_(token) {
  var props = PropertiesService.getScriptProperties();
  var base = String(props.getProperty("PWA_BASE_URL") || "https://amd-os-pwa.vercel.app").trim().replace(/\/+$/, "");
  var res = UrlFetchApp.fetch(base + "/api/admin/payment-confirm", {
    method: "post",
    contentType: "application/json; charset=utf-8",
    payload: JSON.stringify({
      token: String(token || ""),
      mode: "expected",
      note: "Slack button: expected amount received"
    }),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var text = res.getContentText() || "";
  var json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_e) { json = null; }
  if (code >= 200 && code < 300 && json && json.ok === true) return json;
  return {
    ok: false,
    error: json && json.error ? String(json.error) : ("PWA payment-confirm failed: " + code + " " + text)
  };
}

function paymentConfirm_postSlackThread_(job, text) {
  var channelId = String(job && job.channelId || "").trim();
  var messageTs = String(job && job.messageTs || "").trim();
  var body = String(text || "").trim();
  if (!channelId || !messageTs || !body) return;

  try {
    slack_callApi("chat.postMessage", {
      channel: channelId,
      thread_ts: messageTs,
      text: body,
      unfurl_links: false,
      unfurl_media: false
    });
  } catch (e) {
    Logger.log("paymentConfirm_postSlackThread_ failed: " + (e && e.message ? e.message : e));
  }
}

function paymentConfirm_ymLabel_(ym) {
  ym = String(ym || "");
  if (!/^\d{6}$/.test(ym)) return ym || "-";
  return ym.slice(0, 4) + "年" + Number(ym.slice(4, 6)) + "月";
}

function paymentConfirm_yen_(value) {
  var n = Number(value || 0);
  if (!isFinite(n)) n = 0;
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

/**
 * SLACK_DECISION_SECRET を ScriptProperties に入れる一度きりのセットアップ。
 * 値はリポジトリに置かず、clasp run の引数で渡す。
 */
function slackDecisionSetSecret(secret){
  secret = String(secret || "").trim();
  if (!secret) return { ok:false, message:"secret empty" };
  PropertiesService.getScriptProperties().setProperty("SLACK_DECISION_SECRET", secret);
  return { ok:true, length: secret.length };
}

/**
 * Slack の承認ボタンを PWA (Supabase 正本) へ反映する。
 * ScriptProperties: PWA_BASE_URL (既定 https://amd-os-pwa.vercel.app) / SLACK_DECISION_SECRET
 */
function reimburseApplyDecisionViaPwa_(reimbursementId, actionId, approverEmail){
  var props = PropertiesService.getScriptProperties();
  var base = String(props.getProperty("PWA_BASE_URL") || "https://amd-os-pwa.vercel.app").replace(/\/+$/, "");
  var secret = String(props.getProperty("SLACK_DECISION_SECRET") || "").trim();
  if (!secret) return { ok:false, message:"SLACK_DECISION_SECRET 未設定" };

  var res = UrlFetchApp.fetch(base + "/api/slack/reimbursement-decision", {
    method: "post",
    contentType: "application/json",
    headers: { "x-amd-slack-secret": secret },
    payload: JSON.stringify({
      reimbursementId: reimbursementId,
      action: actionId,
      approverEmail: approverEmail
    }),
    muteHttpExceptions: true
  });

  var body = {};
  try { body = JSON.parse(res.getContentText() || "{}"); } catch(_e){ body = {}; }
  var code = res.getResponseCode();
  if (code >= 200 && code < 300 && body && body.ok){
    return { ok:true, message: String(body.message || "反映済み") };
  }
  return { ok:false, message: "HTTP " + code + " " + String((body && body.message) || res.getContentText() || "").slice(0, 200) };
}

/** @deprecated 旧スプレッドシート DB_Reimbursements 用。正本は Supabase なので通常経路からは呼ばない。 */
function reimburseApplyDecision(reimbursementId, actionId, approverEmail){
  reimbursementId = String(reimbursementId || "").trim();
  actionId = String(actionId || "").trim();
  approverEmail = String(approverEmail || "").toLowerCase().trim();

  if (!reimbursementId){
    return { ok:false, message:"reimbursementId empty" };
  }
  if (!actionId){
    return { ok:false, message:"actionId empty" };
  }

  var sh = getSheet_("DB_Reimbursements");
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"DB_Reimbursements empty" };

  var header = sh.getRange(1,1,1,lastCol).getValues()[0].map(function(x){ return String(x||"").trim(); });
  var idx = function(name){ return header.indexOf(name); };

  var iId = idx("reimbursementId");
  var iProjectId = idx("projectId");
  var iStatus = idx("status");
  var iUpdatedAt = idx("updatedAt");

  var iPmBy = idx("pmApprovedBy");
  var iPmAt = idx("pmApprovedAt");
  var iAdminBy = idx("adminApprovedBy");
  var iAdminAt = idx("adminApprovedAt");

  if (iId < 0 || iProjectId < 0 || iStatus < 0 || iUpdatedAt < 0) {
    return { ok:false, message:"header missing (reimbursementId/projectId/status/updatedAt)" };
  }

  var vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
  var ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // admin判定（環境差吸収）
  function isAdmin_(){
    var ok = false;
    try{
      if (typeof canAccessAdmin === "function") ok = !!canAccessAdmin();
    } catch(_e){}
    if (!ok){
      try{
        if (typeof canAccessAdminForCodeSearch === "function") ok = !!canAccessAdminForCodeSearch();
      } catch(_e2){}
    }
    return ok;
  }

  for (var r=0; r<vals.length; r++){
    var rid = String(vals[r][iId] || "").trim();
    if (rid !== reimbursementId) continue;

    var rowNo = r + 2;
    var projectId = String(vals[r][iProjectId] || "").trim();
    var curStatus = String(vals[r][iStatus] || "").trim();

    // ---- PM actions ----
    if (actionId === "reimb_approve" || actionId === "reimb_reject"){
      // PMだけ
      if (!reimburse_isPmForProject_(projectId)){
        return { ok:false, message:"PM only" };
      }

      if (actionId === "reimb_approve"){
        if (curStatus !== "submitted"){
          return { ok:false, message:"PM approve allowed only on submitted (cur=" + curStatus + ")" };
        }

        sh.getRange(rowNo, iStatus+1).setValue("pmApproved");
        if (iPmBy >= 0) sh.getRange(rowNo, iPmBy+1).setValue(approverEmail || "");
        if (iPmAt >= 0) sh.getRange(rowNo, iPmAt+1).setValue(ts);

        // admin承認欄を空に
        if (iAdminBy >= 0) sh.getRange(rowNo, iAdminBy+1).setValue("");
        if (iAdminAt >= 0) sh.getRange(rowNo, iAdminAt+1).setValue("");

        sh.getRange(rowNo, iUpdatedAt+1).setValue(ts);

        // adminへ承認依頼
        try{ reimburseNotifyAdminOnPmApproved({ reimbursementId: reimbursementId, projectId: projectId }); } catch(_e){}

        return { ok:true, message:"status=pmApproved" };
      }

      // PM reject
      if (!(curStatus === "submitted" || curStatus === "pmApproved")){
        return { ok:false, message:"PM reject allowed only on submitted/pmApproved (cur=" + curStatus + ")" };
      }

      sh.getRange(rowNo, iStatus+1).setValue("rejected");
      // 承認欄は全部クリア
      if (iPmBy >= 0) sh.getRange(rowNo, iPmBy+1).setValue("");
      if (iPmAt >= 0) sh.getRange(rowNo, iPmAt+1).setValue("");
      if (iAdminBy >= 0) sh.getRange(rowNo, iAdminBy+1).setValue("");
      if (iAdminAt >= 0) sh.getRange(rowNo, iAdminAt+1).setValue("");
      sh.getRange(rowNo, iUpdatedAt+1).setValue(ts);

      return { ok:true, message:"status=rejected" };
    }

    // ---- Admin actions ----
    if (actionId === "reimb_admin_approve" || actionId === "reimb_admin_reject"){
      if (!isAdmin_()){
        return { ok:false, message:"admin only" };
      }
      if (curStatus !== "pmApproved"){
        return { ok:false, message:"admin action allowed only on pmApproved (cur=" + curStatus + ")" };
      }

      if (actionId === "reimb_admin_approve"){
        sh.getRange(rowNo, iStatus+1).setValue("approved");
        if (iAdminBy >= 0) sh.getRange(rowNo, iAdminBy+1).setValue(approverEmail || "");
        if (iAdminAt >= 0) sh.getRange(rowNo, iAdminAt+1).setValue(ts);
        sh.getRange(rowNo, iUpdatedAt+1).setValue(ts);
        return { ok:true, message:"status=approved" };
      }

      // admin reject
      sh.getRange(rowNo, iStatus+1).setValue("rejected");
      // 承認欄クリア（PM承認も含めて一旦無し扱い）
      if (iPmBy >= 0) sh.getRange(rowNo, iPmBy+1).setValue("");
      if (iPmAt >= 0) sh.getRange(rowNo, iPmAt+1).setValue("");
      if (iAdminBy >= 0) sh.getRange(rowNo, iAdminBy+1).setValue("");
      if (iAdminAt >= 0) sh.getRange(rowNo, iAdminAt+1).setValue("");
      sh.getRange(rowNo, iUpdatedAt+1).setValue(ts);

      return { ok:true, message:"status=rejected" };
    }

    return { ok:false, message:"unknown actionId: " + actionId };
  }

  return { ok:false, message:"not found" };
}

function getEmailBySlackId(slackUserId){
  try{
    const sh = getSheet_("DB_Members");
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return "";

    const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
    const iSlackId = header.indexOf("slackId");

    // email列名は環境差ありそうなので候補を複数見る
    const iEmail = header.indexOf("email") >= 0 ? header.indexOf("email")
                 : (header.indexOf("userEmail") >= 0 ? header.indexOf("userEmail")
                 : (header.indexOf("accountEmail") >= 0 ? header.indexOf("accountEmail")
                 : -1));

    if (iSlackId < 0 || iEmail < 0) return "";

    const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
    for (let r=0; r<vals.length; r++){
      const sid = String(vals[r][iSlackId] || "").trim();
      if (sid !== String(slackUserId)) continue;
      return String(vals[r][iEmail] || "").trim();
    }
    return "";
  } catch(_e){
    return "";
  }
}

function slackBuildReimbPendingBlocks_(origBlocks, actionLabel, reimbursementId){
  const out = [];
  const arr = Array.isArray(origBlocks) ? origBlocks : [];

  // actionsブロックだけ消す（ボタン無効化の代わりに消す。二重押し事故が減る）
  for (let i=0; i<arr.length; i++){
    const b = arr[i];
    if (b && b.type === "actions") continue;
    out.push(b);
  }

  out.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `⏳ ${actionLabel}を反映中…（${reimbursementId || "-"}）` }
    ]
  });

  return out;
}

function slackBuildReimbResultBlocks_(origBlocks, ok, actionId, reimbursementId, approverEmail, msg){
  const statusText = ok
    ? (actionId === "reimb_approve" ? "✅ 承認済み" : "❌ 却下")
    : "⚠️ 反映失敗";

  const out = [];
  const arr = Array.isArray(origBlocks) ? origBlocks : [];

  // 元blocksから「actionsブロック」を消す（ボタン消し）
  for (let i=0; i<arr.length; i++){
    const b = arr[i];
    if (b && b.type === "actions") continue;
    out.push(b);
  }

  const by = approverEmail ? String(approverEmail).trim() : "unknown";
  const tail = msg ? ` / ${String(msg).trim()}` : "";

  out.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `${statusText}（${reimbursementId || "-"} / by ${by}）${tail}` }
    ]
  });

  return out;
}

function admin_ensureSlackInteractiveWorkerTrigger(){
  const fn = "slackInteractiveWorker";
  const triggers = ScriptApp.getProjectTriggers();
  for (let i=0; i<triggers.length; i++){
    const t = triggers[i];
    if (t.getHandlerFunction && t.getHandlerFunction() === fn){
      slackLogInteractive_("trigger_exists", { fn: fn }, null);
      return { ok:true, message:"already exists" };
    }
  }
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(1).create();
  slackLogInteractive_("trigger_created", { fn: fn }, null);
  return { ok:true, message:"created (every 1 min)" };
}
