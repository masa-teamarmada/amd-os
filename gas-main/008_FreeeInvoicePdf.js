/**
 * 008_FreeeInvoicePdf.gs
 *
 * 目的：
 * freee請求書PDFをDriveへ保存する処理を専用化し、例外耐性を高める。
 * 署名URLで取れない場合にBearerで再取得するなど、“現場で起きる揺れ”をここで吸収する。
 *
 * このファイルが担当するもの：
 * - b_downloadToDriveMaybe_（署名URL→失敗ならBearerで取得）
 * - b_saveInvoicePdfToDrive_（invoice detail取得→URL抽出→Drive保存）
 *
 * ルール：
 * - 請求書の作成/DB反映/メール送付はここに置かない（責務分離）。
 * - 失敗しても “原因が追えるメッセージ” を返す（silent failは禁止）。
 */

/**
 * PDFをDriveに保存（署名URL/Bearer両対応）
 */
function b_downloadToDriveMaybe_(url, fileNameBase) {
  const folder = DriveApp.getFolderById(b_freeeInvoiceFolderId_());
  const safeName = String(fileNameBase || "invoice").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");

  // まず署名URLとして試す
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      const blob = res.getBlob().setName(safeName + ".pdf");
      const f = folder.createFile(blob);
      return { ok: true, fileId: f.getId(), fileUrl: f.getUrl(), message: "" };
    }
  } catch (e) {}

  // ダメならBearerで
  const token = b_freeeGetAccessToken_();
  const res2 = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { Authorization: "Bearer " + token } });
  const code2 = res2.getResponseCode();
  if (code2 < 200 || code2 >= 300) {
    return { ok: false, fileId: "", fileUrl: "", message: `pdf download failed: ${code2}` };
  }
  const blob2 = res2.getBlob().setName(safeName + ".pdf");
  const f2 = folder.createFile(blob2);
  return { ok: true, fileId: f2.getId(), fileUrl: f2.getUrl(), message: "" };
}
function b_saveInvoicePdfToDrive_(freeeInvoiceId, pdfUrlMaybe, fileNameBase) {
  const folderId = b_freeeInvoiceFolderId_();
  const folder = DriveApp.getFolderById(folderId);

  const safeName = String(fileNameBase || "invoice").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
  const companyId = b_freeeCompanyId_();

  // 0) URLが取れてるなら、それを最優先で保存（署名URL→Bearer）
  if (pdfUrlMaybe) {
    try {
      const r = b_downloadToDriveMaybe_(pdfUrlMaybe, safeName);
      if (r && r.ok) return { ...r, message: "saved via pdfUrlMaybe" };
    } catch (e) {}
  }

  // 1) invoice detail を company_id 付きで取得
  let raw = {};
  try {
    raw = b_freeeRequestIvJson_(
      "get",
      `/invoices/${encodeURIComponent(freeeInvoiceId)}`,
      { company_id: companyId },
      null
    ) || {};
  } catch (e) {
    return {
      ok:false,
      fileId:"",
      fileUrl:"",
      message:`pdf save failed: invoice detail fetch error. folderId=${folderId} err=${String(e && (e.message||e))}`
    };
  }

  // ★ここが肝：返り値が {invoice:{...}} のことがあるので吸収
  const detail = (raw && raw.invoice && typeof raw.invoice === "object") ? raw.invoice : raw;

  // 2) 明細からPDF URLを拾う（フィールド名ゆれ対策）
  const pdfUrl = String(
    detail.invoice_file_url ||
    detail.invoice_file_url_signed ||
    detail.pdf_url ||
    detail.file_url ||
    detail.invoice_url ||
    detail.invoicePdfUrl ||
    detail.invoice_pdf_url ||
    ""
  ).trim();

  if (!pdfUrl) {
    const rawKeys = Object.keys(raw || {}).slice(0, 80).join(",");
    const invKeys = (raw && raw.invoice) ? Object.keys(raw.invoice || {}).slice(0, 80).join(",") : "";
    return {
      ok:false,
      fileId:"",
      fileUrl:"",
      message:`pdf save failed: pdf url not found in invoice detail. folderId=${folderId} rawKeys=[${rawKeys}] invoiceKeys=[${invKeys}]`
    };
  }

  // 3) 取れたURLでDrive保存
  try {
    const saved = b_downloadToDriveMaybe_(pdfUrl, safeName);
    if (saved && saved.ok) return { ...saved, message: "saved via invoice detail url" };
    return {
      ok:false,
      fileId:"",
      fileUrl:"",
      message:`pdf save failed: download url fetch failed. folderId=${folderId} msg=${String(saved && saved.message || "")}`
    };
  } catch (e) {
    return {
      ok:false,
      fileId:"",
      fileUrl:"",
      message:`pdf save failed: exception in download. folderId=${folderId} err=${String(e && (e.message||e))}`
    };
  }
}