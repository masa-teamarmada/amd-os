/**
 * 186_SlackInteractive.gs
 * Slack Interactivity（Block Kitのボタン）受信・署名検証・処理
 *
 * 必要な Script Properties:
 * - SLACK_SIGNING_SECRET
 *
 * 依存:
 * - 185_SlackNotify.gs（slack_callApi / slack_postMessage / slack_postDm など）
 * - ReimburseApi.gs（reimburse_togglePmApprove）
 */

function slack_getSigningSecret(){
  const s = String(PropertiesService.getScriptProperties().getProperty("SLACK_SIGNING_SECRET") || "").trim();
  if (!s) throw new Error("SLACK_SIGNING_SECRET is missing in Script Properties");
  return s;
}

function slack_verifyRequest_(e){
  // Slack docs: v0=HMAC_SHA256(signing_secret, "v0:" + timestamp + ":" + body)
  const headers = (e && e.postData && e.postData.headers) ? e.postData.headers : {};
  const sig = String(headers["X-Slack-Signature"] || headers["x-slack-signature"] || "").trim();
  const ts  = String(headers["X-Slack-Request-Timestamp"] || headers["x-slack-request-timestamp"] || "").trim();
  const body = String((e && e.postData && e.postData.contents) ? e.postData.contents : "");

  if (!sig || !ts) throw new Error("Slack signature headers missing");

  // リプレイ攻撃対策（5分）
  const nowSec = Math.floor(Date.now()/1000);
  const tsNum = Number(ts);
  if (!isFinite(tsNum)) throw new Error("Slack timestamp invalid");
  if (Math.abs(nowSec - tsNum) > 60*5) throw new Error("Slack request too old");

  const base = "v0:" + ts + ":" + body;
  const secret = slack_getSigningSecret();
  const macBytes = Utilities.computeHmacSha256Signature(base, secret);
  const macHex = macBytes.map(b => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
  const expected = "v0=" + macHex;

  // timing-safe compare っぽいこと（GASなので簡易）
  if (expected.length !== sig.length) throw new Error("Slack signature mismatch");
  let ok = 0;
  for (let i=0; i<expected.length; i++){
    ok |= (expected.charCodeAt(i) ^ sig.charCodeAt(i));
  }
  if (ok !== 0) throw new Error("Slack signature mismatch");

  return true;
}

function slack_parseInteractivePayload_(e){
  // Slack interactivity は application/x-www-form-urlencoded の payload=JSON
  const params = (e && e.parameter) ? e.parameter : {};
  const raw = String(params.payload || "").trim();
  if (!raw) throw new Error("payload empty");
  let obj = null;
  try{ obj = JSON.parse(raw); } catch(err){ throw new Error("payload JSON parse failed"); }
  return obj;
}

function slack_buildReimburseBlocks_(ctx){
  // ctx: {title, pjName, projectId, applicantEmail, date, category, amount, desc, reimbursementId}
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
        text:{ type:"plain_text", text:"承認する ✅" },
        style:"primary",
        action_id:"reimb_approve",
        value: JSON.stringify({ reimbursementId: String(t.reimbursementId||"") })
      },
      {
        type:"button",
        text:{ type:"plain_text", text:"却下 ❌" },
        style:"danger",
        action_id:"reimb_reject",
        value: JSON.stringify({ reimbursementId: String(t.reimbursementId||"") })
      }
    ]}
  ];
}

function slack_updateMessage_(channelId, ts, text, blocks){
  const ch = String(channelId||"").trim();
  const t = String(ts||"").trim();
  if (!ch || !t) throw new Error("slack_updateMessage_: channelId/ts empty");

  const payload = { channel: ch, ts: t, text: String(text||"") };
  if (Array.isArray(blocks)) payload.blocks = blocks;

  // chat.update
  return slack_callApi("chat.update", payload);
}

function slack_handleInteractive_(e){
  slack_verifyRequest_(e);
  const payload = slack_parseInteractivePayload_(e);

  const user = payload.user || {};
  const userId = String(user.id || "").trim(); // U...
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

  // reimbursementId を取り出す
  let v = {};
  try{ v = valueRaw ? JSON.parse(valueRaw) : {}; } catch(err){ v = {}; }
  const reimbursementId = String(v.reimbursementId || "").trim();
  if (!reimbursementId) throw new Error("reimbursementId missing in action value");

  // 権限チェックは reimburse_togglePmApprove 側で PM only を弾く想定
  if (actionId === "reimb_approve"){
    const res = reimburse_togglePmApprove({ reimbursementId: reimbursementId });

    if (!res || !res.ok){
      // 権限NGなど → メッセージを軽く更新
      const txt = `⚠️ 承認できなかった（${String(res && res.message ? res.message : "unknown")}）`;
      slack_updateMessage_(channelId, ts, txt, null);
      return { ok:true };
    }

    const txt = `✅ 承認した（${String(res.approvedBy||"")} / ${String(res.approvedAt||"")}）`;
    slack_updateMessage_(channelId, ts, txt, [
      { type:"section", text:{ type:"mrkdwn", text: txt + `\nID: ${reimbursementId}` } }
    ]);
    return { ok:true };
  }

  if (actionId === "reimb_reject"){
    // いまは最小：却下は未実装扱いでメッセージだけ出す（後でrejected導入）
    const txt = `🚫 却下はまだ未実装（まずは承認のみ運用）\nID: ${reimbursementId}`;
    slack_updateMessage_(channelId, ts, txt, [
      { type:"section", text:{ type:"mrkdwn", text: txt } }
    ]);
    return { ok:true };
  }

  throw new Error("unknown action_id: " + actionId);
}
