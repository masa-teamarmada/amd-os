// 請求書送付（メール、宛先、添付、送付後更新）
/**
 * 013_InvoiceEmail.gs
 *
 * 目的：
 * 請求書の送付（宛先解決→添付生成→送信→送信済み反映）と、関連通知を集約する。
 * “送付の事実” をDB_BillingCycleに確実に残し、月次ルーティンの再現性を上げる。
 *
 * このファイルが担当するもの：
 * - 宛先取得（DB_Projects から To/Cc/Bcc/宛名/期日ルール）
 * - api_sendInvoiceEmail（添付付き送信、送信済み反映）
 * - PDFアップロード後のPM通知、マネージャーへのアップロード依頼
 * - 添付の重複排除（b_dedupeBlobs_ 等）
 *
 * ルール：
 * - 外部に意味のないDriveリンクは本文に書かない（アクセス不能で混乱する）。
 * - 添付は “invoicePdfFileId 1本” を正とし、複数経路を混ぜない。
 */

function b_getInvoiceRecipientsFromProjects_(projectId){
  // ★paymentDueRule も読む
  b_ensureHeader_("DB_Projects", [
    "invoiceToEmails","invoiceCcEmails","invoiceBccEmails","invoiceToName",
    "paymentDueRule"
  ]);

  const rows = b_readTable_("DB_Projects");
  const hit = rows.find(r => String(r.projectId||"").trim() === String(projectId||"").trim()) || {};

  function splitEmails(s){
    return String(s||"")
      .split(/[,\n;]/)
      .map(x => x.trim())
      .filter(x => x);
  }

  return {
    to: splitEmails(hit.invoiceToEmails),
    cc: splitEmails(hit.invoiceCcEmails),
    bcc: splitEmails(hit.invoiceBccEmails),
    toName: String(hit.invoiceToName || "").trim(),

    // ★追加
    paymentDueRule: String(hit.paymentDueRule || "").trim(),
  };
}
function b_getProjectPmEmails_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  const members = b_indexBy_(b_readTable_("DB_Members"), "memberId");

  const pms = b_readTable_("DB_ProjectMembers")
    .map(r => ({
      projectId: String(r.projectId || "").trim(),
      memberId: String(r.memberId || "").trim(),
      isActive: (r.isActive !== undefined ? r.isActive : ""),
      isPM: (r.isPM !== undefined ? r.isPM : ""),
      roleLabel: String(r.roleLabel || "").trim(),
    }))
    .filter(r => r.projectId === projectId && r.memberId)
    .filter(r => b_toBool_(r.isActive, true))
    .filter(r => b_toBool_(r.isPM, false) || String(r.roleLabel || "").toUpperCase().includes("PM"));

  const emails = pms
    .map(r => String(members[String(r.memberId)]?.email || "").trim())
    .filter(e => e);

  return Array.from(new Set(emails));
}
function b_getInvoiceRecipients_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) {
    return { toName:"", to:[], cc:[], bcc:[], paymentDueRule:"" };
  }

  // ★追加：paymentDueRule を読むため列を保証
  b_ensureHeader_("DB_Projects", [
    "invoiceToName","invoiceToEmails","invoiceCcEmails","invoiceBccEmails",
    "paymentDueRule"
  ]);

  const rows = b_readTable_("DB_Projects");
  const hit = rows.find(r => String(r.projectId || "").trim() === projectId) || {};

  function splitEmails(s){
    return String(s||"")
      .split(/[,\n;]/)
      .map(x => x.trim())
      .filter(x => x);
  }

  return {
    toName: String(hit.invoiceToName || "").trim(),
    to: splitEmails(hit.invoiceToEmails),
    cc: splitEmails(hit.invoiceCcEmails),
    bcc: splitEmails(hit.invoiceBccEmails),

    // ★追加：振込期日ルール（例：翌月末 / 翌月15日 / 当月末 など）
    paymentDueRule: String(hit.paymentDueRule || "").trim(),
  };
}
function b_notifyManagersToUploadInvoicePdf_(projectId, ym, ctx){
  // 廃止：通知手段はSlackに統一済み。
  // ここが呼ばれているなら「呼び出し元が移行漏れ」なので、黙ってスキップせず止める。
  throw new Error(
    "b_notifyManagersToUploadInvoicePdf_ is deprecated. " +
    "通知はSlack運用に切替済み。呼び出し元からこの関数呼び出しを削除して。"
  );
}

function api_sendInvoiceEmail(projectId, ym){
  // 廃止：クライアント送付をOSからGmailで自動送信しない運用へ移行。
  // ここが呼ばれて落ちる＝UI/フローの移行漏れなので、明示的に止める。
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);

  throw new Error(
    "api_sendInvoiceEmail is deprecated. " +
    "Gmail送信は廃止。送付フロー（UI/運用）をSlack/手動送付に合わせて更新して。 " +
    `projectId=${projectId} ym=${ym}`
  );
}

function api_uploadInvoicePdf(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ym = b_normYm_(payload.ym);
  const freeeInvoiceId = String(payload.freeeInvoiceId || "").trim();
  const token = String(payload.token || "").trim(); // 今は簡易（将来検証してもいい）
  const fileName = String(payload.fileName || "invoice.pdf").trim();
  const mimeType = String(payload.mimeType || "application/pdf").trim();
  const base64 = String(payload.base64 || "").trim();

  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");
  if (!base64) throw new Error("base64 empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const folder = DriveApp.getFolderById(b_freeeInvoiceFolderId_());
  const bytes = Utilities.base64Decode(base64);
  const stampedName = `請求書PDF_${projectId}_${ym}_${fileName}`;
  const blob = Utilities.newBlob(bytes, mimeType, stampedName);
  const saved = folder.createFile(blob).setName(stampedName);

  const nowIso = b_nowIso_();
  const cur = b_getCycleOne_(projectId, ym) || {};
  const createdAt = String(cur.createdAt || "") || nowIso;

  const projectName = String(cur.projectName || b_getProjectName_(projectId) || projectId);

  // DB反映
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    ...cur,
    projectId,
    ym,
    cycleId: `${projectId}_${ym}`,
    projectName: projectName,

    // ★PDFを反映
    invoicePdfUrl: saved.getUrl(),
    invoicePdfFileId: saved.getId(),

    // freeeInvoiceIdも持っておく（UIのメタ用）
    freeeInvoiceId: freeeInvoiceId || String(cur.freeeInvoiceId || ""),

    createdAt,
    updatedAt: nowIso
  });

}
function api_getInvoicePdfStatusOnly(projectId, ym){
  projectId = String(projectId || "").trim();
  ym = b_normYm_(ym);
  if (!projectId) throw new Error("projectId empty");
  if (!ym) throw new Error("ym empty");

  b_assertProjectAccess_(projectId);
  b_ensureBillingCycleHeader_();

  const cur = b_getCycleOne_(projectId, ym) || {};

  return {
    ok: true,
    invoicePdfUrl: String(cur.invoicePdfUrl || "").trim(),
    invoicePdfFileId: String(cur.invoicePdfFileId || "").trim(),
    freeeInvoiceId: String(cur.freeeInvoiceId || "").trim(),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || "").trim(),
    updatedAt: String(cur.updatedAt || "").trim(),
  };
}