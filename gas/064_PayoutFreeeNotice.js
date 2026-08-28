/**
 * 064_PayoutFreeeNotice.gs
 * 役割：
 * - freee の「支払通知書」を作成・取得する
 *
 * 方針：
 * - freeeの具体API差分はここに閉じ込める
 * - Domain(063) からは「発行して」としか言われない
 */

/**
 * 支払通知書を作成する
 * @param {Object} payload
 *   - memberId
 *   - ym
 *   - totalYen (tax excluded)
 *   - breakdownText
 */
function payoutCreateFreeeNotice(payload){
  payload = payload || {};
  const memberId = String(payload.memberId || "").trim();
  const ym = String(payload.ym || "").trim();
  const totalYen = Number(payload.totalYen || 0);
  const breakdownText = String(payload.breakdownText || "").trim();

  if (!memberId) throw new Error("memberId empty");
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid（yyyymm）");
  if (!isFinite(totalYen) || totalYen <= 0) throw new Error("totalYen invalid");

  const issuedAtJst = payoutNowJstIso();

  const uuid = Utilities.getUuid().replace(/-/g, "");
  const noticeId = "AMD_PN_" + ym + "_" + memberId + "_" + uuid.slice(0, 8);
  const noticeNo = "PN-" + ym + "-" + memberId + "-" + uuid.slice(0, 4);

  // 宛名（memberName優先）＋住所（memberAddress）。bankInfo は旧 payload 互換で取得するがPDFには出さない。
  let payeeName = memberId;
  let payeeAddress = "";
  let invoiceRegistrationNumber = "";
  let bankInfo = "";

  try{
    const members = payoutGetMembersBasic();
    const m = (Array.isArray(members) ? members : []).find(x => String(x.memberId||"").trim() === memberId);
    if (m){
      payeeName = String(m.memberName || m.codeName || m.memberId || memberId).trim() || memberId;
      payeeAddress = String(m.memberAddress || "").trim();
      invoiceRegistrationNumber = String(m.invoiceRegistrationNumber || "").trim();
      bankInfo = String(m.bankInfo || "").trim();
    }
  } catch(e){}

  const pdf = payoutBuildNoticePdfBlob_({
    ym,
    memberId,
    payeeName,
    payeeAddress,
    invoiceRegistrationNumber,
    bankInfo,
    totalYen,
    breakdownText,
    issuedAtJst,
    noticeNo
  });

  const folderId = payoutGetNoticeFolderId_();
  const fileName = `支払通知書_${noticeNo}_${memberId}_${ym}.pdf`;
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(pdf.setName(fileName));

  return {
    ok: true,
    freeeNoticeId: noticeId,
    freeeNoticeNo: noticeNo,
    pdfUrl: file.getUrl(),
    issuedAtJst: issuedAtJst
  };
}

/**
 * PWA /admin/payouts から、改善版フォーマットの支払通知書PDFを作成する。
 * Supabase側で集約した支払月・メンバー別明細を正本にし、GASはPDFレンダリングとDrive保存だけ担当する。
 * totalYen / breakdown.totalYen は税抜として受け取り、PDF上で消費税10%を上乗せする。
 */
function payoutCreatePwaNoticePdf(payload){
  payload = payload || {};
  const memberId = String(payload.memberId || "").trim();
  const ym = String(payload.ym || "").trim();
  const noticeNo = String(payload.noticeNo || "").trim();
  const totalYen = Number(payload.totalYen || 0);
  // 立替精算は実費 (税込)。報酬とは別枠で合算し、消費税を上乗せしない
  const reimbursementYen = Math.round(Number(payload.reimbursementYen || 0));
  const issuedAtJst = String(payload.issuedAtJst || payload.issuedAt || payoutNowJstIso()).trim();
  const breakdownText = payoutPwaNoticeBreakdownText_(payload.breakdown, payload.breakdownText);
  const reimbursementText = payoutPwaNoticeBreakdownText_(payload.reimbursements, payload.reimbursementText);

  if (!memberId) throw new Error("memberId empty");
  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid（yyyymm）");
  if (!noticeNo) throw new Error("noticeNo empty");
  if (!isFinite(totalYen) || totalYen < 0) throw new Error("totalYen invalid");
  if (!isFinite(reimbursementYen) || reimbursementYen < 0) throw new Error("reimbursementYen invalid");
  if (totalYen + reimbursementYen <= 0) throw new Error("totalYen invalid");

  let payeeName = String(payload.payeeName || "").trim();
  let payeeAddress = String(payload.payeeAddress || "").trim();
  let invoiceRegistrationNumber = String(payload.invoiceRegistrationNumber || payload.invoice_registration_number || "").trim();
  let bankInfo = String(payload.bankInfo || "").trim();

  try{
    const members = payoutGetMembersBasic();
    const m = (Array.isArray(members) ? members : []).find(x => String(x.memberId||"").trim() === memberId);
    if (m){
      payeeName = payeeName || String(m.memberName || m.codeName || m.memberId || memberId).trim() || memberId;
      payeeAddress = payeeAddress || String(m.memberAddress || "").trim();
      invoiceRegistrationNumber = invoiceRegistrationNumber || String(m.invoiceRegistrationNumber || "").trim();
      bankInfo = bankInfo || String(m.bankInfo || "").trim();
    }
  } catch(e){}

  payeeName = payeeName || memberId;

  const pdf = payoutBuildNoticePdfBlob_({
    ym,
    memberId,
    payeeName,
    payeeAddress,
    invoiceRegistrationNumber,
    bankInfo,
    totalYen,
    reimbursementYen,
    breakdownText,
    reimbursementText,
    noteText: String(payload.noteText || "").trim(),
    issuedAtJst,
    noticeNo
  });

  const folderId = payoutGetNoticeFolderId_();
  const fileName = `支払通知書_${noticeNo}_${memberId}_${ym}.pdf`;
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(pdf.setName(fileName));

  return {
    ok: true,
    noticeNo,
    pdfUrl: file.getUrl(),
    fileId: file.getId(),
    issuedAtJst,
    totalYen: Math.round(totalYen),
    reimbursementYen: Math.round(reimbursementYen)
  };
}

function payoutPwaNoticeBreakdownText_(breakdown, fallbackText){
  if (Array.isArray(breakdown) && breakdown.length){
    return breakdown.map(function(item){
      item = item || {};
      const desc = String(item.description || item.projectName || item.projectId || "業務委託料").trim();
      const yen = Math.round(Number(item.totalYen || item.yen || item.amountYen || 0));
      return desc + "\t" + (isFinite(yen) ? yen.toLocaleString("ja-JP") + "円" : "0円");
    }).join("\n");
  }
  return String(fallbackText || "").trim();
}

/**
 * freee支払通知書のPDF URLを取得
 */
function payoutGetFreeeNoticePdf(freeeNoticeId){
  const id = String(freeeNoticeId || "").trim();
  if (!id) throw new Error("freeeNoticeId empty");

  // 現時点では “idからPDF取得” の公開API根拠がないので、ここは未対応
  // 必要なら DB_PayoutNotices をnoticeIdで引いて返すように拡張する
  return { ok:false, message:"pdf fetch by id is not supported yet" };
}

function payoutGetNoticeFolderId_(){
  // まずは freee請求書PDFと同じフォルダへ寄せる（運用一箇所）
  // b_freeeInvoiceFolderId_ が無い環境では落ちるので、その場合は root にフォールバック
  try{
    if (typeof b_freeeInvoiceFolderId_ === "function"){
      return b_freeeInvoiceFolderId_();
    }
  } catch(e){}
  return DriveApp.getRootFolder().getId();
}

function payoutBuildNoticePdfBlob_(p){
  p = p || {};
  const ym = String(p.ym || "").trim();
  const memberId = String(p.memberId || "").trim();
  const payeeName = String(p.payeeName || "").trim() || memberId;
  const payeeAddress = String(p.payeeAddress || "").trim();
  const invoiceRegistrationNumber = String(p.invoiceRegistrationNumber || p.invoice_registration_number || "").trim();
  const issuedAtJst = String(p.issuedAtJst || "").trim();
  const noticeNo = String(p.noticeNo || "").trim();
  const totalYen = Number(p.totalYen || 0);
  const reimbursementYen = Math.round(Number(p.reimbursementYen || 0));
  const breakdownText = String(p.breakdownText || "").trim();
  const reimbursementText = String(p.reimbursementText || "").trim();
  // 繰越があるとき、その期間の発生額と今回のお支払いの差を書いた文面 (PWA が組み立てる)
  const noteText = String(p.noteText || "").trim();

  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid（yyyymm）");
  if (!memberId) throw new Error("memberId empty");
  if (!noticeNo) throw new Error("noticeNo empty");
  if (!isFinite(totalYen) || totalYen < 0) throw new Error("totalYen invalid");
  if (totalYen + reimbursementYen <= 0) throw new Error("totalYen invalid");

  const fmtYen = (n) => Math.round(Number(n||0)).toLocaleString("ja-JP") + "円";
  const fmtNum = (n) => Math.round(Number(n||0)).toLocaleString("ja-JP");

  const taxBreakdownFromTaxExcludedYen = (netYen) => {
    const net = Math.round(Number(netYen || 0));
    const tax = Math.round(net * 0.1);
    const gross = net + tax;
    return { net, tax, gross };
  };

  const formatDateJa = (raw) => {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return s;
    return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
  };

  const calcPayDateFromYm = (yyyymm) => {
    const y = Number(yyyymm.slice(0,4));
    const m = Number(yyyymm.slice(4,6));
    const last = new Date(Date.UTC(y, m, 0));
    let d = new Date(last.getTime());
    const day = d.getUTCDay();
    if (day === 6) d = new Date(d.getTime() - 1*24*60*60*1000);
    if (day === 0) d = new Date(d.getTime() - 2*24*60*60*1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth()+1).padStart(2,"0");
    const dd = String(d.getUTCDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const splitBreakdown = (text) => {
    const lines = String(text || "").replace(/\r/g,"").split("\n").map(x=>x.trim()).filter(Boolean);
    return lines.map(line=>{
      const parts = line.split("\t");
      if (parts.length >= 2){
        const desc = parts[0].trim() || "-";
        const yenStr = parts.slice(1).join(" ").trim();
        const yen = Number(String(yenStr).replace(/[^\d]/g,"") || 0);
        return { desc, yen: isFinite(yen) ? yen : 0 };
      }
      return { desc: line, yen: 0 };
    });
  };

  const issueDate = formatDateJa(issuedAtJst ? issuedAtJst.slice(0,10) : payoutNowJstIso().slice(0,10));
  const payDate = calcPayDateFromYm(ym);
  const subject = `${Number(ym.slice(4,6))}月末お支払予定のご連絡`;
  // /admin/payouts の支払額は税抜。支払通知書で消費税10%を上乗せする。
  const tax = taxBreakdownFromTaxExcludedYen(totalYen);
  const details = splitBreakdown(breakdownText);
  if (details.length === 0 && tax.net > 0) details.push({ desc: "業務委託料", yen: tax.net });
  // 立替精算は実費なので明細には出すが、消費税の対象にしない
  const reimbursementDetails = splitBreakdown(reimbursementText);
  if (reimbursementYen > 0 && reimbursementDetails.length === 0){
    reimbursementDetails.push({ desc: "立替精算（実費）", yen: reimbursementYen });
  }
  const allDetails = details.concat(reimbursementDetails);
  const grandTotalYen = tax.gross + reimbursementYen;

  const COMPANY_NAME = "株式会社チームアルマダ";
  const COMPANY_ADDR = "〒305-0031 茨城県つくば市吾妻1-10-1";
  const COMPANY_INVOICE_REGISTRATION_NUMBER = payoutCompanyInvoiceRegistrationNumber_();
  const PAYMENT_METHOD = "指定の口座へ振込";
  const BLUE = "#2563eb";
  const TEXT = "#1f2937";
  const MUTED = "#667085";
  const LINE = "#d9e2ec";
  const PALE = "#f8fafc";

  // ====== 一時スプレッドシート ======
  const ss = SpreadsheetApp.create("tmp_payout_notice_" + noticeNo);
  const ssId = ss.getId();
  const sh = ss.getSheets()[0];
  sh.setName("notice");
  sh.setHiddenGridlines(true);
  if (sh.getMaxColumns() < 12){
    sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
  }
  if (sh.getMaxColumns() > 12){
    sh.deleteColumns(13, sh.getMaxColumns() - 12);
  }

  // 2026-04 改善版フォーマット: 白地、青アクセント、正本ロゴ画像。
  const colWidths = [28, 246, 70, 82, 108, 18, 46, 70, 76, 78, 82, 128];
  for (let i = 0; i < colWidths.length; i++){
    sh.setColumnWidth(i + 1, colWidths[i]);
  }

  for (let r = 1; r <= 80; r++){
    sh.setRowHeight(r, 24);
  }
  sh.setRowHeight(1, 32);
  sh.setRowHeight(2, 34);
  sh.setRowHeight(3, 5);
  sh.setRowHeight(4, 28);
  sh.setRowHeight(5, 30);
  sh.setRowHeight(6, 28);
  sh.setRowHeight(7, 36);
  sh.setRowHeight(8, 28);
  sh.setRowHeight(9, 28);
  sh.setRowHeight(10, 20);
  sh.setRowHeight(11, 20);
  sh.setRowHeight(12, 30);
  sh.setRowHeight(13, 30);
  sh.setRowHeight(14, 12);
  sh.setRowHeight(15, 28);
  sh.setRowHeight(16, 28);
  sh.setRowHeight(17, 26);

  sh.getRange("A1:L80")
    .setFontFamily("Noto Sans JP")
    .setFontColor(TEXT)
    .setFontSize(14)
    .setVerticalAlignment("middle");

  // ====== タイトル ======
  sh.getRange("A2:L2").merge();
  sh.getRange("A2")
    .setValue("支払通知書")
    .setFontSize(24).setFontWeight("bold").setFontColor(BLUE)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.getRange("A3:L3").merge().setBackground(BLUE);

  // ====== 左：宛先 ======
  sh.getRange("A5:F5").merge();
  sh.getRange("A5")
    .setValue(`${payeeName}　様`)
    .setFontSize(18).setFontWeight("bold")
    .setBorder(false, false, true, false, false, false, "#6b7280", SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange("A6:F6").merge()
    .setValue(payeeAddress || "（住所未登録）")
    .setFontSize(14).setFontColor(MUTED)
    .setWrap(true);
  sh.getRange("A7:F7").merge()
    .setValue(invoiceRegistrationNumber ? `登録番号：${invoiceRegistrationNumber}` : "登録番号：（未登録）")
    .setFontSize(14).setFontColor(MUTED)
    .setWrap(true);

  // ====== 右：通知日/番号 + 正本ロゴ ======
  sh.getRange("G5:L5").merge()
    .setValue(`作成日：${issueDate}`)
    .setFontSize(14)
    .setFontColor(MUTED)
    .setHorizontalAlignment("right");
  sh.getRange("G6:L6").merge()
    .setValue(`通知書番号：${noticeNo}`)
    .setFontSize(14)
    .setFontColor(MUTED)
    .setHorizontalAlignment("right");

  const logoMarkBlob = payoutGetPayoutLogoBlob_();
  const logotypeBlob = payoutGetPayoutLogotypeBlob_();
  if (!logoMarkBlob || !logotypeBlob){
    throw new Error("PAYOUT_LOGO_FILE_ID / PAYOUT_LOGOTYPE_FILE_ID is required for payout notice logo assets");
  }
  sh.getRange("G7:L7").merge().clearContent();
  sh.insertImage(logoMarkBlob, 10, 7, 76, 3).setWidth(27).setHeight(27);
  sh.insertImage(logotypeBlob, 10, 7, 110, 7).setWidth(178).setHeight(22);

  sh.getRange("G8:L8").merge().setValue(COMPANY_NAME).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange("G9:L9").merge().setValue(COMPANY_ADDR).setFontSize(12).setFontColor(MUTED).setHorizontalAlignment("right");
  sh.getRange("G10:L10").merge()
    .setValue(`登録番号：${COMPANY_INVOICE_REGISTRATION_NUMBER}`)
    .setFontSize(12).setFontColor(MUTED).setHorizontalAlignment("right");

  // ====== サマリ ======
  sh.getRange("A12:L13").merge()
    .setValue(`お支払金額　　　${fmtYen(grandTotalYen)}（税込）`)
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground(PALE)
    .setBorder(true, true, true, true, false, false, LINE, SpreadsheetApp.BorderStyle.SOLID);

  // ====== 件名 ======
  sh.getRange("A16:L16").merge();
  sh.getRange("A16").setValue("件名： " + subject).setFontSize(14).setFontColor(MUTED);

  // ====== 明細表 ======
  const startRow = 17;
  const maxLines = Math.max(2, allDetails.length);
  const endRow = startRow + maxLines;

  sh.getRange(`A${startRow}:F${startRow}`).merge().setValue("摘要").setBackground(BLUE).setFontColor("#ffffff").setFontWeight("bold");
  sh.getRange(`G${startRow}:H${startRow}`).merge().setValue("数量").setBackground(BLUE).setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange(`I${startRow}:J${startRow}`).merge().setValue("単価").setBackground(BLUE).setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange(`K${startRow}:L${startRow}`).merge().setValue("金額").setBackground(BLUE).setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange(`A${startRow}:L${endRow}`).setBorder(true, true, true, true, true, true, LINE, SpreadsheetApp.BorderStyle.SOLID);

  for (let i = 0; i < maxLines; i++){
    const r = startRow + 1 + i;
    const d = allDetails[i] || { desc:"", yen:0 };

    sh.setRowHeight(r, 30);
    sh.getRange(`A${r}:L${r}`).setBackground(i === 0 ? "#ffffff" : PALE);
    sh.getRange(`A${r}:F${r}`).merge().setValue(d.desc || "").setHorizontalAlignment("left");
    sh.getRange(`G${r}:H${r}`).merge().setValue(d.desc ? 1 : "").setHorizontalAlignment("right");
    sh.getRange(`I${r}:J${r}`).merge().setValue(d.yen ? fmtNum(d.yen) : "").setHorizontalAlignment("right");
    sh.getRange(`K${r}:L${r}`).merge().setValue(d.yen ? fmtYen(d.yen) : "").setFontWeight(d.yen ? "bold" : "normal").setHorizontalAlignment("right");
  }

  // ====== 右下：税内訳 ======
  const taxBoxTop = endRow + 2;
  const totalRows = [
    ["小計（税抜）", fmtYen(tax.net), false],
    ["消費税（10%）", fmtYen(tax.tax), false],
  ];
  if (reimbursementYen > 0){
    totalRows.push(["立替精算（実費）", fmtYen(reimbursementYen), false]);
  }
  totalRows.push(["合計（税込）", fmtYen(grandTotalYen), true]);
  totalRows.forEach((row, idx) => {
    const r = taxBoxTop + idx;
    sh.getRange(`H${r}:J${r}`).merge().setValue(row[0]).setFontColor(row[2] ? TEXT : MUTED).setFontWeight(row[2] ? "bold" : "normal").setHorizontalAlignment("right");
    sh.getRange(`K${r}:L${r}`).merge().setValue(row[1]).setFontSize(row[2] ? 17 : 14).setFontWeight(row[2] ? "bold" : "normal").setHorizontalAlignment("right");
  });
  const totalRowsBottom = taxBoxTop + totalRows.length - 1;
  sh.getRange(`G${totalRowsBottom}:L${totalRowsBottom}`).setBorder(false, false, true, false, false, false, BLUE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // ====== 左下：支払予定/方法 ======
  const payTop = totalRowsBottom + 3;
  sh.getRange(`A${payTop}:B${payTop}`).merge().setValue("支払予定日").setFontSize(14).setFontColor(MUTED).setFontWeight("bold");
  sh.getRange(`C${payTop}:F${payTop}`).merge().setValue(formatDateJa(payDate)).setFontSize(15).setFontWeight("bold").setHorizontalAlignment("left");
  sh.getRange(`A${payTop+2}:B${payTop+2}`).merge().setValue("支払方法").setFontSize(14).setFontColor(MUTED).setFontWeight("bold");
  sh.getRange(`C${payTop+2}:F${payTop+2}`).merge().setValue(PAYMENT_METHOD).setFontSize(15).setHorizontalAlignment("left");

  // ====== 備考 ======
  // noteText が空の月は備考ごと出さない (空の枠だけが残らないように)。
  const noteTop = payTop + 5;
  const hasNote = noteText.length > 0;
  if (hasNote) {
    sh.getRange(`A${noteTop}:B${noteTop}`).merge().setValue("備考").setFontSize(14).setFontColor(MUTED).setFontWeight("bold");
    sh.getRange(`A${noteTop+1}:L${noteTop+3}`).merge()
      .setValue(noteText)
      .setFontSize(12)
      .setFontColor(TEXT)
      .setWrap(true)
      .setVerticalAlignment("top")
      .setHorizontalAlignment("left")
      .setBackground(PALE)
      .setBorder(true, true, true, true, false, false, LINE, SpreadsheetApp.BorderStyle.SOLID);
  }

  // ====== flush & export ======
  SpreadsheetApp.flush();
  Utilities.sleep(800);

  const gid = sh.getSheetId();
  const printLastRow = hasNote ? noteTop + 3 : payTop + 2;

  const url = [
    `https://docs.google.com/spreadsheets/d/${ssId}/export?format=pdf`,
    `gid=${gid}`,
    `r1=0`,
    `r2=${printLastRow}`,
    `c1=0`,
    `c2=12`,
    `size=A4`,
    `portrait=true`,
    `fitw=true`,
    `top_margin=0.35`,
    `bottom_margin=0.5`,
    `left_margin=0.6`,
    `right_margin=0.6`,
    `sheetnames=false`,
    `printtitle=false`,
    `pagenumbers=false`,
    `gridlines=false`,
    `fzr=false`
  ].join("&");

  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200){
    try{ DriveApp.getFileById(ssId).setTrashed(true); } catch(e){}
    throw new Error("pdf export failed: " + code + " body=" + String(res.getContentText()||"").slice(0,200));
  }

  const pdfBlob = res.getBlob().setName(`支払通知書_${noticeNo}_${memberId}_${ym}.pdf`);

  try{ DriveApp.getFileById(ssId).setTrashed(true); } catch(e){}
  return pdfBlob;
}

// 064内でだけ使う簡易escape（10_Utilsがあるならそっちに寄せてもいい）
function escapeHtml_(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function payoutTestDocumentsAuth(){
  const doc = DocumentApp.create("auth_test_payout_notice");
  doc.getBody().appendParagraph("ok");
  doc.saveAndClose();
  const f = DriveApp.getFileById(doc.getId());
  try{ f.setTrashed(true); } catch(e){}
  return { ok:true };
}

function payoutGetPayoutLogoBlob_(){
  return payoutGetPayoutAssetBlob_(["PAYOUT_LOGO_FILE_ID", "LOGO_FILE_ID"], ["logo_only3.png", "AMD_logo_mark.png"]);
}

function payoutGetPayoutLogotypeBlob_(){
  return payoutGetPayoutAssetBlob_(["PAYOUT_LOGOTYPE_FILE_ID", "LOGOTYPE_FILE_ID"], ["ロゴタイプ.png", "ロゴタイプ.png", "AMD_logotype.png"]);
}

function payoutCompanyInvoiceRegistrationNumber_(){
  try{
    const props = PropertiesService.getScriptProperties();
    const fromProps = String(
      props.getProperty("AMD_INVOICE_REGISTRATION_NUMBER") ||
      props.getProperty("TEAM_ARMADA_INVOICE_REGISTRATION_NUMBER") ||
      ""
    ).trim();
    if (fromProps) return fromProps;
  } catch(e){}
  return "T7021001064067";
}

function payoutGetPayoutAssetBlob_(propKeys, fileNames){
  try{
    const props = PropertiesService.getScriptProperties();
    for (let i = 0; i < propKeys.length; i++){
      const fileId = String(props.getProperty(propKeys[i]) || "").trim();
      if (fileId) return DriveApp.getFileById(fileId).getBlob();
    }
  } catch(e){}
  try{
    for (let i = 0; i < fileNames.length; i++){
      const files = DriveApp.getFilesByName(fileNames[i]);
      if (files.hasNext()) return files.next().getBlob();
    }
  } catch(e){}
  return null;
}

function payoutSlidesSetA4Portrait(presentationId, widthPt, heightPt){
  // Advanced Google Services の「Google Slides API」を有効にしている前提
  // サービス名は "Slides"（SlidesAppとは別）
  const req = {
    requests: [{
      updatePageProperties: {
        pageProperties: {
          pageSize: {
            width:  { magnitude: Number(widthPt || 595), unit: "PT" },
            height: { magnitude: Number(heightPt || 842), unit: "PT" }
          }
        },
        fields: "pageSize"
      }
    }]
  };
  Slides.Presentations.batchUpdate(req, String(presentationId || "").trim());
}

function payoutExportSlidesPdf(presentationId, fileName){
  const id = String(presentationId || "").trim();
  if (!id) throw new Error("presentationId empty");

  // レンダリング待ち（白紙PDF回避）
  Utilities.sleep(1200);

  const url = `https://docs.google.com/presentation/d/${id}/export/pdf`;
  const token = ScriptApp.getOAuthToken();
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code !== 200){
    throw new Error("slides pdf export failed: " + code + " body=" + String(res.getContentText()||"").slice(0,200));
  }

  return res.getBlob().setName(String(fileName || "payout_notice.pdf"));
}

function payoutCopyNoticeTemplateSlides(noticeNo){
  const tid = String(PropertiesService.getScriptProperties().getProperty("PAYOUT_NOTICE_TEMPLATE_SLIDES_ID") || "").trim();
  if (!tid) throw new Error("PAYOUT_NOTICE_TEMPLATE_SLIDES_ID is not set");

  const src = DriveApp.getFileById(tid);
  const copied = src.makeCopy("tmp_payout_notice_" + String(noticeNo||""));
  return copied.getId();
}

function payoutWaitSlidesRenderReady(presentationId){
  const id = String(presentationId || "").trim();
  if (!id) throw new Error("presentationId empty");

  // 反映待ち：Driveの更新時刻が進むのを確認してからexportする
  // （体感、これが一番白紙を潰せる）
  let last = 0;
  try{
    const f0 = DriveApp.getFileById(id);
    last = Number(new Date(f0.getLastUpdated()).getTime() || 0);
  } catch(e){}

  // 最大10回（=約5秒）待つ。支払通知書は高頻度じゃないので安定優先。
  for (let i=0; i<10; i++){
    Utilities.sleep(500);

    try{
      const f = DriveApp.getFileById(id);
      const t = Number(new Date(f.getLastUpdated()).getTime() || 0);

      // 更新が進んだ、もしくは最初から取れなかった場合は待ちを短縮
      if (!last || (t && t >= last)){
        // もう1拍置く（レンダリングの保険）
        Utilities.sleep(600);
        return;
      }
    } catch(e){
      // Drive参照がコケても、sleepで保険して続行
    }
  }

  // タイムアウトしても一応進める（白紙になったら次のログで分かる）
  Utilities.sleep(800);
}
