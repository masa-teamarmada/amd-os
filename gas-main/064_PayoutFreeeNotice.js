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
 *   - totalYen
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

  // 宛名（memberName優先）＋住所（memberAddress）＋振込先（bankInfo）
  let payeeName = memberId;
  let payeeAddress = "";
  let bankInfo = "";

  try{
    const members = payoutGetMembersBasic();
    const m = (Array.isArray(members) ? members : []).find(x => String(x.memberId||"").trim() === memberId);
    if (m){
      payeeName = String(m.memberName || m.codeName || m.memberId || memberId).trim() || memberId;
      payeeAddress = String(m.memberAddress || "").trim();
      bankInfo = String(m.bankInfo || "").trim();
    }
  } catch(e){}

  const pdf = payoutBuildNoticePdfBlob_({
    ym,
    memberId,
    payeeName,
    payeeAddress,
    bankInfo,
    totalYen,
    breakdownText,
    issuedAtJst,
    noticeNo
  });

  const folderId = payoutGetNoticeFolderId_();
  // ファイル名：支払通知日__支払通知書番号__取引先名称・コード__金額.pdf
  const issueDateForName = (() => {
    const s = issuedAtJst.slice(0, 10); // "2026-01-20"
    const parts = s.split("-");
    return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`;
  })();
  const yenForName = Math.round(totalYen).toLocaleString("ja-JP") + "円";
  const fileName = `${issueDateForName}__${noticeNo}__${payeeName}__${yenForName}.pdf`;
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
  const payeeName = String(p.payeeName || "").trim() || memberName;
  const payeeAddress = String(p.payeeAddress || "").trim();
  const bankInfo = String(p.bankInfo || "").trim();
  const issuedAtJst = String(p.issuedAtJst || "").trim();
  const noticeNo = String(p.noticeNo || "").trim();
  const totalYen = Number(p.totalYen || 0);
  const breakdownText = String(p.breakdownText || "").trim();

  if (!/^\d{6}$/.test(ym)) throw new Error("ym invalid（yyyymm）");
  if (!memberId) throw new Error("memberId empty");
  if (!noticeNo) throw new Error("noticeNo empty");
  if (!isFinite(totalYen) || totalYen <= 0) throw new Error("totalYen invalid");

  const fmtYen = (n) => Math.round(Number(n||0)).toLocaleString("ja-JP") + "円";

  const taxBreakdown = (grossYen) => {
    const gross = Math.round(Number(grossYen || 0));
    const net = Math.round(gross / 1.1);
    const tax = gross - net;
    return { net, tax, gross };
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

  const issueDate = issuedAtJst ? issuedAtJst.slice(0,10) : payoutNowJstIso().slice(0,10);
  const payDate = calcPayDateFromYm(ym);
  const subject = `${Number(ym.slice(4,6))}月末お支払予定のご連絡`;
  const tax = taxBreakdown(totalYen);

  const COMPANY_NAME = "株式会社チームアルマダ";
  const COMPANY_ADDR = "〒305-0031\n茨城県つくば市吾妻1-10-1";
  const PAYMENT_METHOD = "指定の口座へ振込";

  // ====== 一時スプレッドシート ======
  const ss = SpreadsheetApp.create("tmp_payout_notice_" + noticeNo);
  const ssId = ss.getId();
  const sh = ss.getSheets()[0];
  sh.setName("notice");
  sh.setHiddenGridlines(true);
  sh.insertColumnsAfter(1, 11);

  // 列幅（L列は金額の正本なので広め）
  const colWidths = [24, 250, 70, 80, 110, 18, 40, 60, 70, 70, 80, 140];
  for (let i = 0; i < colWidths.length; i++){
    sh.setColumnWidth(i + 1, colWidths[i]);
  }

  // 行高：2枚目の“上スッキリ”を作るため、ヘッダ付近を薄くする
  for (let r = 1; r <= 80; r++){
    sh.setRowHeight(r, 18);
  }
  sh.setRowHeight(1, 28); // title
  sh.setRowHeight(2, 6);  // spacer
  sh.setRowHeight(3, 18);
  sh.setRowHeight(4, 18);
  sh.setRowHeight(5, 18);
  sh.setRowHeight(6, 18);
  sh.setRowHeight(7, 18);
  sh.setRowHeight(8, 18);

  // ====== タイトル ======
  sh.getRange("A1:L1").merge();
  sh.getRange("A1")
    .setValue("支払通知書")
    .setFontSize(20).setFontWeight("bold")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  // ====== 左：宛先（ヘッダを圧縮して上の余白を戻す）=====
  // 2枚目の雰囲気：名前を上、住所はその下に小さく
  sh.getRange("A3:F6").merge();
  sh.getRange("A3")
    .setValue(`${payeeName}　様\n${payeeAddress || "（住所未登録）"}`)
    .setFontSize(12).setFontWeight("bold")
    .setVerticalAlignment("top")
    .setWrap(true);

  // ====== 右：通知日/番号（右上に寄せるが主張は弱め）=====
  sh.getRange("G3:H3").merge().setValue("支払通知日").setFontSize(10);
  sh.getRange("I3:L3").merge().setValue(issueDate).setFontSize(10).setHorizontalAlignment("right");
  sh.getRange("G4:H4").merge().setValue("支払通知書番号").setFontSize(10);
  sh.getRange("I4:L4").merge().setValue(noticeNo).setFontSize(10).setHorizontalAlignment("right");

  // ====== 右：team ARMADA（ロゴ相当・1行完結で安定させる）=====
  sh.getRange("G5:L5").merge();

  const brandCell = sh.getRange("G5");
  brandCell
    .setValue("team ARMADA")
    .setFontWeight("bold")
    .setFontSize(15)              // ★少しだけ下げて他テキストと調和
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("left");

  // RichTextで色だけ分ける（サイズはセル側で統一）
  try{
    const rt = SpreadsheetApp.newRichTextValue()
      .setText("team ARMADA")
      .setTextStyle(
        0, 4,
        SpreadsheetApp.newTextStyle()
          .setBold(true)
          .setForegroundColor("#6b7280") // team（グレー）
          .build()
      )
      .setTextStyle(
        5, 11,
        SpreadsheetApp.newTextStyle()
          .setBold(true)
          .setForegroundColor("#2563eb") // ARMADA（やや落ち着いたブルー）
          .build()
      )
      .build();
    brandCell.setRichTextValue(rt);
  } catch(e){
    // フォールバック（色なしでも崩れない）
  }

  sh.getRange("G6:L6").merge().setValue(COMPANY_NAME).setFontSize(11).setFontWeight("bold");
  sh.getRange("G7:L8").merge().setValue(COMPANY_ADDR).setFontSize(10).setWrap(true);

  // ====== 件名（2枚目の感じで上に余白を残す）=====
  sh.getRange("A10:L10").merge();
  sh.getRange("A10").setValue("件名　　　" + subject).setFontSize(11).setFontWeight("bold");

  // ====== サマリ ======
  sh.getRange("A12:L14").setBorder(true,true,true,true,true,true);
  sh.getRange("A12:D12").merge().setValue("小計").setBackground("#f3f4f6").setFontWeight("bold");
  sh.getRange("E12:H12").merge().setValue("消費税").setBackground("#f3f4f6").setFontWeight("bold");
  sh.getRange("I12:L12").merge().setValue("支払金額").setBackground("#f3f4f6").setFontWeight("bold");

  sh.getRange("A13:D14").merge().setValue(fmtYen(tax.net)).setFontWeight("bold").setFontSize(12);
  sh.getRange("E13:H14").merge().setValue(fmtYen(tax.tax)).setFontWeight("bold").setFontSize(12);
  sh.getRange("I13:L14").merge().setValue(fmtYen(tax.gross)).setFontWeight("bold").setFontSize(16);

  // ====== 明細表 ======
  const details = splitBreakdown(breakdownText);
  const startRow = 16;
  const maxLines = 10;
  const endRow = startRow + maxLines;

  sh.getRange(`A${startRow}:F${startRow}`).merge().setValue("摘要").setBackground("#f3f4f6").setFontWeight("bold");
  sh.getRange(`G${startRow}:H${startRow}`).merge().setValue("数量").setBackground("#f3f4f6").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange(`I${startRow}:J${startRow}`).merge().setValue("単価").setBackground("#f3f4f6").setFontWeight("bold").setHorizontalAlignment("right");
  sh.getRange(`K${startRow}:L${startRow}`).merge().setValue("明細金額").setBackground("#f3f4f6").setFontWeight("bold").setHorizontalAlignment("right");

  sh.getRange(`A${startRow}:L${endRow}`).setBorder(true,true,true,true,true,true);

  for (let i = 0; i < maxLines; i++){
    const r = startRow + 1 + i;
    const d = details[i] || { desc:"", yen:0 };

    sh.getRange(`A${r}:F${r}`).merge().setValue(d.desc || "");
    sh.getRange(`G${r}:H${r}`).merge().setValue(d.desc ? 1 : "").setHorizontalAlignment("right");
    sh.getRange(`I${r}:J${r}`).merge().setValue(d.yen ? Math.round(d.yen).toLocaleString("ja-JP") : "").setHorizontalAlignment("right");
    sh.getRange(`K${r}:L${r}`).merge().setValue(d.yen ? fmtYen(d.yen) : "").setHorizontalAlignment("right");
  }

  // ====== 右下：内訳（L列を広く確保して見切れ防止）=====
  const taxBoxTop = endRow + 2;
  sh.getRange(`I${taxBoxTop}:L${taxBoxTop+2}`).setBorder(true,true,true,true,true,true);

  sh.getRange(`I${taxBoxTop}:K${taxBoxTop}`).merge().setValue("内訳").setBackground("#f3f4f6").setFontWeight("bold");
  sh.getRange(`L${taxBoxTop}:L${taxBoxTop}`).setValue("金額").setBackground("#f3f4f6").setFontWeight("bold").setHorizontalAlignment("right");

  sh.getRange(`I${taxBoxTop+1}:K${taxBoxTop+1}`).merge().setValue("10%対象（税抜）");
  sh.getRange(`L${taxBoxTop+1}:L${taxBoxTop+1}`).setValue(fmtYen(tax.net)).setHorizontalAlignment("right");
  sh.getRange(`I${taxBoxTop+2}:K${taxBoxTop+2}`).merge().setValue("10%消費税");
  sh.getRange(`L${taxBoxTop+2}:L${taxBoxTop+2}`).setValue(fmtYen(tax.tax)).setHorizontalAlignment("right");

  // ====== 左下：支払予定/方法 + 振込先（必要情報は出す、でも主張しすぎない）=====
  const payTop = taxBoxTop + 4;
  sh.getRange(`A${payTop}:H${payTop}`).merge().setValue("支払予定日　" + payDate).setFontWeight("bold");
  sh.getRange(`A${payTop+1}:H${payTop+1}`).merge().setValue("支払方法　　" + PAYMENT_METHOD);

  // bankInfo枠：2枚目のバランスを壊さないよう、必要十分な高さにする
  // 長い人はここで折り返す（1ページ死守）
  sh.getRange(`A${payTop+3}:H${payTop+8}`).merge()
    .setValue("振込先\n" + (bankInfo || "（未登録）"))
    .setFontSize(10).setVerticalAlignment("top").setWrap(true);

  // ====== 備考 ======
  const noteTop = payTop + 10;
  sh.getRange(`A${noteTop}:L${noteTop+2}`).setBorder(true,true,true,true,true,true);
  sh.getRange(`A${noteTop}:L${noteTop}`).merge().setValue("備考").setBackground("#f3f4f6").setFontWeight("bold");
  sh.getRange(`A${noteTop+1}:L${noteTop+2}`).merge();

  // ====== flush & export ======
  SpreadsheetApp.flush();
  Utilities.sleep(800);

  const gid = sh.getSheetId();
  const printLastRow = noteTop + 2;

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
    `top_margin=0.5`,
    `bottom_margin=0.5`,
    `left_margin=0.5`,
    `right_margin=0.5`,
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

  const pdfBlob = res.getBlob().setName(`payout_notice_${noticeNo}.pdf`);

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
  try{
    const fileId = String(PropertiesService.getScriptProperties().getProperty("LOGO_FILE_ID") || "").trim();
    if (fileId){
      return DriveApp.getFileById(fileId).getBlob();
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
