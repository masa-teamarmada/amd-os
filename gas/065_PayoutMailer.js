/**
 * 065_PayoutMailer.gs
 * 役割：
 * - 支払通知書のメール送付 (keiri@ から PWA admin/payouts 経由で実送信)
 */

// === 2026-05-28 まさ要件: keiri@ from + PDF添付 + BCC ===

function payoutAdmin_listMailAliases_() {
  var primary = "";
  try { primary = String(Session.getEffectiveUser().getEmail() || ""); } catch (e1) { primary = ""; }
  var aliases = [];
  try { aliases = GmailApp.getAliases() || []; } catch (e2) { aliases = []; }
  return { primary: primary, aliases: aliases };
}

function payout_sendNoticeMailV2_(payload) {
  payload = payload || {};
  var to = String(payload.to || "").trim();
  var memberName = String(payload.memberName || "").trim();
  var ym = String(payload.ym || "").trim();
  var dueDateText = String(payload.dueDateText || "").trim();
  var body = String(payload.body || "").trim();
  var fromAddr = String(payload.from || "keiri@team-armada.jp").trim();
  var subject = String(payload.subject || "支払通知書のご案内").trim();
  var pdfDriveFileId = String(payload.pdfDriveFileId || "").trim();
  var bcc = Array.isArray(payload.bcc) ? payload.bcc.filter(Boolean).join(",") : String(payload.bcc || "");

  if (!to) throw new Error("to empty");
  if (!ym) throw new Error("ym empty");
  if (!body) throw new Error("body empty");

  var aliases = (function(){ try { return GmailApp.getAliases() || []; } catch (e) { return []; } })();
  var aliasOk = aliases.indexOf(fromAddr) >= 0;
  if (!aliasOk) {
    throw new Error("send-as alias not registered for " + fromAddr + ". Gmail aliases=" + JSON.stringify(aliases));
  }

  var options = { name: "team ARMADA 経理", from: fromAddr };
  if (bcc) options.bcc = bcc;

  if (pdfDriveFileId) {
    try {
      var file = DriveApp.getFileById(pdfDriveFileId);
      var blob = file.getBlob();
      var memberSlug = memberName.replace(/[\\/:*?"<>|\s]+/g, "_") || "member";
      blob.setName("支払通知書_" + ym + "_" + memberSlug + ".pdf");
      options.attachments = [blob];
    } catch (e) {
      throw new Error("PDF添付失敗 fileId=" + pdfDriveFileId + " err=" + (e && e.message ? e.message : e));
    }
  }

  GmailApp.sendEmail(to, subject, body, options);

  return {
    ok: true,
    to: to,
    subject: subject,
    from: fromAddr,
    bcc: bcc,
    pdfDriveFileId: pdfDriveFileId,
    sentAtJst: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss")
  };
}

// === 旧 (info@ 経由) — 互換のため残置 ===

function payoutSendNoticeMail(payload){
  payload = payload || {};
  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();

  if (!to) throw new Error("to empty");
  if (!subject) throw new Error("subject empty");

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
 * Admin UI から支払通知メールを送る (旧)
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

  payoutsShowErr("送付は freee PDF URL 接続後に完全対応（骨は完成）");
}
