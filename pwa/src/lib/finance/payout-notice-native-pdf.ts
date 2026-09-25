import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleAuthAsync } from "../sources/google.ts";
import { renderWorkspaceDocumentHtmlToPdf } from "../workspace-document-html-pdf.ts";

export type PayoutNoticePdfLine = { description: string; amountYen: number };

export type PayoutNoticePdfInput = {
  ym: string;
  memberId: string;
  noticeNo: string;
  payeeName: string;
  payeeAddress: string;
  invoiceRegistrationNumber: string;
  issuedAtJst: string;
  rewardYen: number;
  reimbursements: PayoutNoticePdfLine[];
  rewards: PayoutNoticePdfLine[];
  noteText?: string;
};

const YEN = new Intl.NumberFormat("ja-JP");
const COMPANY_INVOICE_NUMBER = "T7021001064067";
// 現行の支払通知書が保存されている共有ドライブのフォルダ。
// 移動時は環境変数で上書きし、既存通知書の保存先との一致を先に確認する。
const CURRENT_NOTICE_FOLDER_ID = "1Ti5RHwwDJ5WxAugE7ODR4Nl9SFk2-oYz";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char] ?? char);
}

function yen(value: number): string {
  return `${YEN.format(Math.round(value))}円`;
}

function jpDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return match ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日` : value;
}

function payoutDate(ym: string): string {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  const date = new Date(Date.UTC(year, month, 0));
  const day = date.getUTCDay();
  if (day === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (day === 0) date.setUTCDate(date.getUTCDate() - 2);
  return jpDate(date.toISOString().slice(0, 10));
}

function imageDataUri(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** 支払通知書の金額・表示順をAMD OSの入力だけから決定する。外部通信をしない。 */
export function buildPayoutNoticeHtml(input: PayoutNoticePdfInput, logos: { mark: string; logotype: string }): string {
  if (!/^\d{6}$/.test(input.ym)) throw new Error("支払年月が不正です");
  if (!input.noticeNo || !input.memberId) throw new Error("通知書番号またはメンバー番号がありません");
  const rewardYen = Math.round(input.rewardYen);
  const reimbursementsYen = input.reimbursements.reduce((sum, line) => sum + Math.round(line.amountYen), 0);
  const rewardLinesYen = input.rewards.reduce((sum, line) => sum + Math.round(line.amountYen), 0);
  if (rewardYen < 0 || reimbursementsYen < 0 || rewardYen + reimbursementsYen <= 0) {
    throw new Error("支払通知書の金額が不正です");
  }
  if (rewardLinesYen !== rewardYen) throw new Error("報酬明細と報酬合計が一致しません");
  if ([...input.rewards, ...input.reimbursements].some((line) => !line.description.trim() || !Number.isFinite(line.amountYen) || line.amountYen < 0)) {
    throw new Error("支払通知書の明細が不正です");
  }

  const taxYen = Math.round(rewardYen * 0.1);
  const totalYen = rewardYen + taxYen + reimbursementsYen;
  const detailRows = [...input.rewards, ...input.reimbursements].map((line) => `
    <tr><td class="detail">${escapeHtml(line.description)}</td><td class="number">1</td><td class="number">${YEN.format(Math.round(line.amountYen))}</td><td class="number strong">${yen(line.amountYen)}</td></tr>
  `).join("");
  const note = input.noteText?.trim()
    ? `<section class="note"><b>備考</b><div>${escapeHtml(input.noteText.trim())}</div></section>`
    : "";

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;color:#1f2937;font:14px "Noto Sans JP Variable",sans-serif}
    main{width:100%;padding:16px 20px}header h1{text-align:center;color:#2563eb;font-size:25px;margin:0;padding:0 0 8px;border-bottom:4px solid #2563eb}
    .top{display:flex;justify-content:space-between;gap:24px;margin-top:26px;min-height:120px}.payee{width:53%}.payee strong{font-size:18px;display:block;border-bottom:1px solid #9ca3af;padding-bottom:4px;margin-bottom:5px}.muted{color:#667085}.issuer{text-align:right;width:45%}.issuer .meta{line-height:1.8}.logo{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin:7px 0 3px}.logo img.mark{height:24px;width:auto}.logo img.type{height:23px;width:auto;max-width:160px}.issuer .company{font-weight:700}
    .summary{border:1px solid #d9e2ec;background:#f8fafc;text-align:center;margin:18px 0 32px;padding:9px;font-size:24px;font-weight:700}.summary span{margin-right:34px}
    .subject{color:#667085;margin-bottom:3px}table{width:100%;border-collapse:collapse;table-layout:fixed}thead th{background:#2563eb;color:#fff;text-align:right;padding:5px 4px;border:1px solid #d9e2ec}thead th:first-child{text-align:left}td{border:1px solid #d9e2ec;padding:4px;vertical-align:middle}tbody tr:nth-child(even){background:#f8fafc}td.detail{width:54%;overflow-wrap:anywhere}td.number{text-align:right}.strong{font-weight:700}th:nth-child(1){width:54%}th:nth-child(2){width:11%}th:nth-child(3){width:15%}th:nth-child(4){width:20%}
    .totals{width:47%;margin:20px 0 0 auto}.total-row{display:flex;justify-content:space-between;gap:10px;padding:3px 0}.total-row .label{color:#667085}.total-row.final{font-weight:700;font-size:17px;border-bottom:2px solid #2563eb;padding-bottom:4px}.total-row.final .label{color:#1f2937}
    .payment{display:grid;grid-template-columns:150px 1fr;gap:20px 12px;margin-top:40px}.payment b{color:#667085}.note{display:grid;grid-template-columns:150px 1fr;gap:12px;margin-top:25px}.note b{color:#667085}.note div{padding:8px;background:#f8fafc;border:1px solid #d9e2ec;white-space:pre-wrap}
  </style></head><body><main>
    <header><h1>支払通知書</h1></header>
    <div class="top"><div class="payee"><strong>${escapeHtml(input.payeeName)}　様</strong><div class="muted">${escapeHtml(input.payeeAddress || "（住所未登録）")}</div><div class="muted">登録番号：${escapeHtml(input.invoiceRegistrationNumber || "（未登録）")}</div></div>
      <div class="issuer"><div class="meta muted">作成日：${escapeHtml(jpDate(input.issuedAtJst))}<br>通知書番号：${escapeHtml(input.noticeNo)}</div><div class="logo"><img class="mark" src="${logos.mark}"><img class="type" src="${logos.logotype}"></div><div class="company">株式会社チームアルマダ</div><div class="muted">〒305-0031 茨城県つくば市吾妻1-10-1<br>登録番号：${COMPANY_INVOICE_NUMBER}</div></div></div>
    <div class="summary"><span>お支払金額</span>${yen(totalYen)}（税込）</div>
    <div class="subject">件名：${Number(input.ym.slice(4, 6))}月末お支払予定のご連絡</div>
    <table><thead><tr><th>摘要</th><th>数量</th><th>単価</th><th>金額</th></tr></thead><tbody>${detailRows}</tbody></table>
    <div class="totals"><div class="total-row"><span class="label">小計（税抜）</span><span>${yen(rewardYen)}</span></div><div class="total-row"><span class="label">消費税（10%）</span><span>${yen(taxYen)}</span></div>${reimbursementsYen > 0 ? `<div class="total-row"><span class="label">立替精算（実費）</span><span>${yen(reimbursementsYen)}</span></div>` : ""}<div class="total-row final"><span class="label">合計（税込）</span><span>${yen(totalYen)}</span></div></div>
    <div class="payment"><b>支払予定日</b><strong>${payoutDate(input.ym)}</strong><b>支払方法</b><span>指定の口座へ振込</span></div>${note}
  </main></body></html>`;
}

/** PDF描画はPWAの既存Chromium実行環境を使う。ここではDrive保存や送付を行わない。 */
export async function renderPayoutNoticePdf(input: PayoutNoticePdfInput, options?: { executablePath?: string }): Promise<Buffer> {
  const publicDir = join(process.cwd(), "public");
  const [mark, logotype] = await Promise.all([
    readFile(join(publicDir, "AMD_logo_mark.png")),
    readFile(join(publicDir, "AMD_logotype.png")),
  ]);
  return renderWorkspaceDocumentHtmlToPdf(buildPayoutNoticeHtml(input, {
    mark: imageDataUri(mark), logotype: imageDataUri(logotype),
  }), options);
}

/** PDFを現行の共有ドライブフォルダへ保存し、保存結果をDriveから読み戻す。 */
export async function savePayoutNoticePdfToDrive(input: PayoutNoticePdfInput): Promise<{ pdfUrl: string; fileId: string; reimbursementYen: number }> {
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new Error("支払通知書のDrive保存に必要なGoogle認証がありません");
  const pdf = await renderPayoutNoticePdf(input);
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.PAYOUT_NOTICE_DRIVE_FOLDER_ID || CURRENT_NOTICE_FOLDER_ID;
  const fileName = `支払通知書_${input.noticeNo}_${input.memberId}_${input.ym}.pdf`;
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error("支払通知書PDFの保存先IDを取得できませんでした");
  const readback = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,parents,size,webViewLink,trashed",
    supportsAllDrives: true,
  });
  if (readback.data.name !== fileName || readback.data.mimeType !== "application/pdf" ||
      readback.data.trashed || !readback.data.parents?.includes(folderId) ||
      Number(readback.data.size) !== pdf.length) {
    throw new Error("支払通知書PDFのDrive保存結果が一致しません");
  }
  return {
    pdfUrl: readback.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    fileId,
    reimbursementYen: input.reimbursements.reduce((sum, line) => sum + Math.round(line.amountYen), 0),
  };
}
