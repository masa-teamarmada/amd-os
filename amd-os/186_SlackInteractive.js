/**
 * 186_SlackInteractive.gs
 * Slack Interactivity（Block Kitのボタン）受信・署名検証・処理
 *
 * Phase 2 拡張:
 * - 立替承認（reimb_approve / reimb_reject）→ 既存
 * - 予算確定（billing_confirm_budget）→ 新規
 * - 請求書発行（billing_issue_invoice）→ 新規
 * - 請求書取消（billing_cancel_invoice）→ 新規
 *
 * 必要な Script Properties:
 * - SLACK_SIGNING_SECRET
 *
 * 依存:
 * - 185_SlackNotify.gs（slack_callApi / slack_postMessage / slack_postDm など）
 * - ReimburseApi.gs（reimburse_togglePmApprove）
 * - B_BillingApi.gs（api_confirmBudget）
 * - B_FreeeInvoiceFlow.gs（b_freeeInvoicePipeline_）
 * - B_BillingDomain.gs（b_getCycleOne_）
 */

function slack_getSigningSecret(){
  const s = String(PropertiesService.getScriptProperties().getProperty("SLACK_SIGNING_SECRET") || "").trim();
  if (!s) throw new Error("SLACK_SIGNING_SECRET is missing in Script Properties");
  return s;
}

function slack_verifyRequest_(e){
  const headers = (e && e.postData && e.postData.headers) ? e.postData.headers : {};
  const sig = String(headers["X-Slack-Signature"] || headers["x-slack-signature"] || "").trim();
  const ts  = String(headers["X-Slack-Request-Timestamp"] || headers["x-slack-request-timestamp"] || "").trim();
  const body = String((e && e.postData && e.postData.contents) ? e.postData.contents : "");

  if (!sig || !ts) throw new Error("Slack signature headers missing");

  const nowSec = Math.floor(Date.now()/1000);
  const tsNum = Number(ts);
  if (!isFinite(tsNum)) throw new Error("Slack timestamp invalid");
  if (Math.abs(nowSec - tsNum) > 60*5) throw new Error("Slack request too old");

  const base = "v0:" + ts + ":" + body;
  const secret = slack_getSigningSecret();
  const macBytes = Utilities.computeHmacSha256Signature(base, secret);
  const macHex = macBytes.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
  const expected = "v0=" + macHex;

  if (expected.length !== sig.length) throw new Error("Slack signature mismatch");
  let ok = 0;
  for (let i=0; i<expected.length; i++){
    ok |= (expected.charCodeAt(i) ^ sig.charCodeAt(i));
  }
  if (ok !== 0) throw new Error("Slack signature mismatch");

  return true;
}

function slack_parseInteractivePayload_(e){
  const params = (e && e.parameter) ? e.parameter : {};
  const raw = String(params.payload || "").trim();
  if (!raw) throw new Error("payload empty");
  let obj = null;
  try{ obj = JSON.parse(raw); } catch(err){ throw new Error("payload JSON parse failed"); }
  return obj;
}

/** ====== 立替ブロック（既存） ====== */
function slack_buildReimburseBlocks_(ctx){
  const t = ctx || {};
  const title = String(t.title || "【立替 承認依頼】");
  const pjLine = `PJ: ${String(t.pjName||"")}（${String(t.projectId||"")}）`;
  const applicant = `申請者: ${String(t.applicantEmail||"")}`;
  const date = `日付: ${String(t.date||"")}`;
  const cat = `カテゴリ: ${String(t.category||"")}`;
  const amt = `金額: ${String(t.amount||"")}円`;
  const desc = `内容: ${String(t.desc||"-")}`;
  const rid = `ID: ${String(t.reimbursementId||"")}`;

  return [
    { type:"section", text:{ type:"mrkdwn", text: `*${title}*\n${pjLine}\n${applicant}\n${date}\n${cat}\n${amt}\n${desc}\n${rid}` } },
    { type:"actions", elements:[
      {
        type:"button",
        text:{ type:"plain_text", text:"承認する" },
        style:"primary",
        action_id:"reimb_approve",
        value: JSON.stringify({ reimbursementId: String(t.reimbursementId||"") })
      },
      {
        type:"button",
        text:{ type:"plain_text", text:"却下" },
        style:"danger",
        action_id:"reimb_reject",
        value: JSON.stringify({ reimbursementId: String(t.reimbursementId||"") })
      }
    ]}
  ];
}

/** ====== Billing ブロック（Phase 2 新規） ====== */

/**
 * 予算確定ボタン付き通知ブロック
 * ctx: { projectId, projectName, ym, budgetYen }
 */
function slack_buildBudgetConfirmBlocks_(ctx){
  const t = ctx || {};
  const projectId = String(t.projectId || "");
  const projectName = String(t.projectName || projectId);
  const ym = String(t.ym || "");
  const budgetYen = Number(t.budgetYen || 0);
  const ymLabel = ym ? (ym.slice(0,4) + "年" + ym.slice(4) + "月") : "";

  return [
    { type:"section", text:{ type:"mrkdwn", text:
      `*【予算確定】${projectName}*\n` +
      `対象月: ${ymLabel}\n` +
      `予算額: ${budgetYen.toLocaleString()}円\n` +
      `PJ ID: ${projectId}`
    }},
    { type:"actions", elements:[
      {
        type:"button",
        text:{ type:"plain_text", text:"予算を確定する" },
        style:"primary",
        action_id:"billing_confirm_budget",
        value: JSON.stringify({ projectId, ym, budgetYen })
      }
    ]}
  ];
}

/**
 * 請求書発行ボタン付き通知ブロック
 * ctx: { projectId, projectName, ym, budgetYen }
 */
function slack_buildInvoiceIssueBlocks_(ctx){
  const t = ctx || {};
  const projectId = String(t.projectId || "");
  const projectName = String(t.projectName || projectId);
  const ym = String(t.ym || "");
  const budgetYen = Number(t.budgetYen || 0);
  const ymLabel = ym ? (ym.slice(0,4) + "年" + ym.slice(4) + "月") : "";

  return [
    { type:"section", text:{ type:"mrkdwn", text:
      `*【請求書発行】${projectName}*\n` +
      `対象月: ${ymLabel}\n` +
      `請求額: ${budgetYen.toLocaleString()}円\n` +
      `PJ ID: ${projectId}`
    }},
    { type:"actions", elements:[
      {
        type:"button",
        text:{ type:"plain_text", text:"請求書を発行する" },
        style:"primary",
        action_id:"billing_issue_invoice",
        value: JSON.stringify({ projectId, ym })
      },
      {
        type:"button",
        text:{ type:"plain_text", text:"スキップ" },
        action_id:"billing_skip_invoice",
        value: JSON.stringify({ projectId, ym })
      }
    ]}
  ];
}

/**
 * 請求書取消ボタン付き通知ブロック
 * ctx: { projectId, projectName, ym, freeeInvoiceId }
 */
function slack_buildInvoiceCancelBlocks_(ctx){
  const t = ctx || {};
  const projectId = String(t.projectId || "");
  const projectName = String(t.projectName || projectId);
  const ym = String(t.ym || "");
  const freeeInvoiceId = String(t.freeeInvoiceId || "");
  const ymLabel = ym ? (ym.slice(0,4) + "年" + ym.slice(4) + "月") : "";

  return [
    { type:"section", text:{ type:"mrkdwn", text:
      `*【請求書取消確認】${projectName}*\n` +
      `対象月: ${ymLabel}\n` +
      `freee請求書ID: ${freeeInvoiceId}\n` +
      `PJ ID: ${projectId}`
    }},
    { type:"actions", elements:[
      {
        type:"button",
        text:{ type:"plain_text", text:"取消する" },
        style:"danger",
        action_id:"billing_cancel_invoice",
        value: JSON.stringify({ projectId, ym, freeeInvoiceId })
      },
      {
        type:"button",
        text:{ type:"plain_text", text:"やめる" },
        action_id:"billing_cancel_abort",
        value: JSON.stringify({ projectId, ym })
      }
    ]}
  ];
}

/** ====== メッセージ更新 ====== */
function slack_updateMessage_(channelId, ts, text, blocks){
  const ch = String(channelId||"").trim();
  const t = String(ts||"").trim();
  if (!ch || !t) throw new Error("slack_updateMessage_: channelId/ts empty");

  const payload = { channel: ch, ts: t, text: String(text||"") };
  if (Array.isArray(blocks)) payload.blocks = blocks;

  return slack_callApi("chat.update", payload);
}

/** ====== メインハンドラ ====== */
function slack_handleInteractive_(e){
  slack_verifyRequest_(e);
  const payload = slack_parseInteractivePayload_(e);

  const user = payload.user || {};
  const userId = String(user.id || "").trim();
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const act = actions[0] || {};
  const actionId = String(act.action_id || "").trim();
  const valueRaw = String(act.value || "").trim();

  const container = payload.container || {};
  const channel = payload.channel || {};
  const message = payload.message || {};

  const channelId = String(channel.id || container.channel_id || "").trim();
  const ts = String(message.ts || container.message_ts || "").trim();

  if (!actionId) throw new Error("action_id missing");

  // action value を共通パース
  let v = {};
  try{ v = valueRaw ? JSON.parse(valueRaw) : {}; } catch(err){ v = {}; }

  // ---- Billing アクション（Phase 2 新規） ----
  if (actionId.startsWith("billing_")){
    return slack_handleBillingAction_(actionId, v, userId, channelId, ts);
  }

  // ---- 立替アクション（既存） ----
  const reimbursementId = String(v.reimbursementId || "").trim();
  if (!reimbursementId) throw new Error("reimbursementId missing in action value");

  if (actionId === "reimb_approve"){
    const res = reimburse_togglePmApprove({ reimbursementId: reimbursementId });

    if (!res || !res.ok){
      const txt = `承認できなかった（${String(res && res.message ? res.message : "unknown")}）`;
      slack_updateMessage_(channelId, ts, txt, null);
      return { ok:true };
    }

    const txt = `承認した（${String(res.approvedBy||"")} / ${String(res.approvedAt||"")}）`;
    slack_updateMessage_(channelId, ts, txt, [
      { type:"section", text:{ type:"mrkdwn", text: txt + `\nID: ${reimbursementId}` } }
    ]);
    return { ok:true };
  }

  if (actionId === "reimb_reject"){
    const txt = `却下はまだ未実装（まずは承認のみ運用）\nID: ${reimbursementId}`;
    slack_updateMessage_(channelId, ts, txt, [
      { type:"section", text:{ type:"mrkdwn", text: txt } }
    ]);
    return { ok:true };
  }

  throw new Error("unknown action_id: " + actionId);
}

/** ====== Billing アクションハンドラ（Phase 2 新規） ====== */
function slack_handleBillingAction_(actionId, v, userId, channelId, ts){
  const projectId = String(v.projectId || "").trim();
  const ym = String(v.ym || "").trim();

  if (!projectId) throw new Error("billing action: projectId missing");
  if (!ym) throw new Error("billing action: ym missing");

  // 操作者の email を取得（SlackId → email 変換）
  const operatorEmail = getEmailBySlackId(userId) || "";

  // 二重押し吸収
  const cache = CacheService.getScriptCache();
  const dedupeKey = "billing_click_" + projectId + "_" + ym + "_" + actionId + "_" + userId;
  if (cache.get(dedupeKey)){
    return { ok:true, message:"連打吸収" };
  }
  cache.put(dedupeKey, "1", 30);

  // ---- 予算確定 ----
  if (actionId === "billing_confirm_budget"){
    const budgetYen = Number(v.budgetYen || 0);
    if (!budgetYen) {
      slack_updateMessage_(channelId, ts,
        `予算額が0のため確定できない（${projectId} / ${ym}）`, null);
      return { ok:true };
    }

    let res = null;
    try {
      res = api_confirmBudget(projectId, ym, budgetYen);
    } catch(e) {
      slack_updateMessage_(channelId, ts,
        `予算確定に失敗: ${String(e && (e.message || e))}`, null);
      return { ok:true };
    }

    if (res && res.ok) {
      const ymLabel = ym.slice(0,4) + "年" + ym.slice(4) + "月";
      const txt = `予算を確定した（${ymLabel} / ${budgetYen.toLocaleString()}円 / ${operatorEmail}）`;
      slack_updateMessage_(channelId, ts, txt, [
        { type:"section", text:{ type:"mrkdwn", text: `*${txt}*\nPJ: ${projectId}` } }
      ]);
    } else {
      slack_updateMessage_(channelId, ts,
        `予算確定に失敗した（${projectId} / ${ym}）`, null);
    }
    return { ok:true };
  }

  // ---- 請求書発行 ----
  if (actionId === "billing_issue_invoice"){
    // 処理中メッセージ
    try {
      slack_updateMessage_(channelId, ts,
        `請求書を発行中...（${projectId} / ${ym}）`, [
        { type:"section", text:{ type:"mrkdwn", text: `請求書を発行中...（${projectId} / ${ym}）` } }
      ]);
    } catch(_e){}

    let res = null;
    try {
      // B_FreeeInvoiceFlow.gs のパイプライン呼び出し
      res = b_freeeInvoicePipeline_(projectId, ym);
    } catch(e) {
      slack_updateMessage_(channelId, ts,
        `請求書発行に失敗: ${String(e && (e.message || e))}`, null);
      return { ok:true };
    }

    if (res && res.ok) {
      const ymLabel = ym.slice(0,4) + "年" + ym.slice(4) + "月";
      const parts = [`*請求書を発行した*（${ymLabel}）`];
      parts.push(`PJ: ${projectId}`);
      if (res.freeeInvoiceNumber) parts.push(`請求書番号: ${res.freeeInvoiceNumber}`);
      if (res.invoicePdfUrl) parts.push(`PDF: ${res.invoicePdfUrl}`);
      parts.push(`操作者: ${operatorEmail}`);

      slack_updateMessage_(channelId, ts,
        `請求書を発行した（${projectId} / ${ym}）`, [
        { type:"section", text:{ type:"mrkdwn", text: parts.join("\n") } }
      ]);
    } else {
      const msg = (res && res.message) ? String(res.message) : "unknown error";
      slack_updateMessage_(channelId, ts,
        `請求書発行に失敗: ${msg}`, null);
    }
    return { ok:true };
  }

  // ---- 請求書発行スキップ ----
  if (actionId === "billing_skip_invoice"){
    slack_updateMessage_(channelId, ts,
      `請求書発行をスキップした（${projectId} / ${ym} / ${operatorEmail}）`, [
      { type:"section", text:{ type:"mrkdwn", text: `請求書発行をスキップした（${projectId} / ${ym}）` } }
    ]);
    return { ok:true };
  }

  // ---- 請求書取消 ----
  if (actionId === "billing_cancel_invoice"){
    const freeeInvoiceId = String(v.freeeInvoiceId || "").trim();
    if (!freeeInvoiceId){
      slack_updateMessage_(channelId, ts,
        `freee請求書IDが不明のため取消できない（${projectId} / ${ym}）`, null);
      return { ok:true };
    }

    let res = null;
    try {
      res = b_freeeCancelInvoice_(projectId, ym, freeeInvoiceId);
    } catch(e) {
      slack_updateMessage_(channelId, ts,
        `請求書取消に失敗: ${String(e && (e.message || e))}`, null);
      return { ok:true };
    }

    if (res && res.ok) {
      const txt = `請求書を取消した（${projectId} / ${ym} / freee#${freeeInvoiceId} / ${operatorEmail}）`;
      slack_updateMessage_(channelId, ts, txt, [
        { type:"section", text:{ type:"mrkdwn", text: `*${txt}*` } }
      ]);
    } else {
      const msg = (res && res.message) ? String(res.message) : "unknown error";
      slack_updateMessage_(channelId, ts,
        `請求書取消に失敗: ${msg}`, null);
    }
    return { ok:true };
  }

  // ---- 取消中止 ----
  if (actionId === "billing_cancel_abort"){
    slack_updateMessage_(channelId, ts,
      `取消をやめた（${projectId} / ${ym}）`, [
      { type:"section", text:{ type:"mrkdwn", text: `取消をやめた（${projectId} / ${ym}）` } }
    ]);
    return { ok:true };
  }

  throw new Error("unknown billing action_id: " + actionId);
}

/**
 * Billing通知をPJのSlackチャンネルに投稿するユーティリティ
 * 種別: "budget_confirm" | "invoice_issue" | "invoice_cancel"
 */
function slack_postBillingNotification(type, ctx){
  const projectId = String(ctx.projectId || "").trim();
  if (!projectId) throw new Error("slack_postBillingNotification: projectId empty");

  // PJのSlackチャンネルを取得
  const pjRow = (function(){
    try {
      const rows = b_readTable_("DB_Projects");
      return rows.find(r => String(r.projectId||"").trim() === projectId) || {};
    } catch(e) { return {}; }
  })();

  const channelId = String(pjRow.slackChannelId || "").trim();
  if (!channelId) throw new Error("slack_postBillingNotification: slackChannelId not found for " + projectId);

  let blocks = [];
  let text = "";

  if (type === "budget_confirm") {
    blocks = slack_buildBudgetConfirmBlocks_(ctx);
    text = "【予算確定】" + String(ctx.projectName || projectId);
  } else if (type === "invoice_issue") {
    blocks = slack_buildInvoiceIssueBlocks_(ctx);
    text = "【請求書発行】" + String(ctx.projectName || projectId);
  } else if (type === "invoice_cancel") {
    blocks = slack_buildInvoiceCancelBlocks_(ctx);
    text = "【請求書取消確認】" + String(ctx.projectName || projectId);
  } else {
    throw new Error("slack_postBillingNotification: unknown type: " + type);
  }

  return slack_postMessageBlocks(channelId, text, blocks);
}
