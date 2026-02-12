/**
 * 065_PayoutMailer.gs
 * 役割：
 * - 支払通知書のメール送付（info@）
 */

function payoutSendNoticeMail(payload){
  payload = payload || {};
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();

  if (!to) throw new Error("to empty");
  if (!subject) throw new Error("subject empty");

  // 実送信
  GmailApp.sendEmail(to, subject, body, {
    name: "team ARMADA",
    from: "info@team-armada.jp"
  });

  return {
    ok: true,
    sentAtJst: ""
  };
}

/**
 * Admin UI から支払通知メールを送る
 * payload: { to, ym }
 */
function admin_sendPayoutNoticeMail(payload){
  payload = payload || {};
  const to = String(payload.to||"").trim();
  const ym = String(payload.ym||"").trim();
  const memberId = String(payload.memberId||"").trim();
  const pdfUrl = String(payload.pdfUrl||"").trim();
  if (!to || !ym || !memberId) return { ok:false, message:"param missing" };

  const subject = `【支払通知書】${ym}`;
  const body = [
    "支払通知書を発行しました。",
    "",
    pdfUrl ? `PDF: ${pdfUrl}` : "PDFは管理画面からご確認ください。",
    "",
    "team ARMADA"
  ].join("\n");

  GmailApp.sendEmail(to, subject, body, { name:"team ARMADA", from:"info@team-armada.jp" });

  const sentAt = payoutNowJstIso();
  payoutUpsertNotice({
    ym, memberId,
    status: "sent",
    sentAtJst: sentAt
  });

  return { ok:true, sentAtJst: sentAt };
}

function payoutsSendNotice(memberId){
  const ym = String(el("payoutYm")?.value||"").trim();
  if (!ym) return payoutsShowErr("ym empty");

  // email は rows に載ってる前提（063で返却済み）
  // 簡易：DOMから取得
  const tr = document.querySelector(`tr td div.small:contains("${memberId}")`);
  // ↑実装簡略。次で rows キャッシュ化して安全に取る

  payoutsShowErr("送付は freee PDF URL 接続後に完全対応（骨は完成）");
}
