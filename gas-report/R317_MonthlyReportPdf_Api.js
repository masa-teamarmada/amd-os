/** R317_MonthlyReportPdf_Api.gs
 * 月次報告書PDF生成の公開API。
 * UIのボタンから呼ばれる窓口。確定済みチェック＋生成＋ステータス返却。
 *
 * 依存:
 *   - 316_MonthlyReportPdf_Gen.gs（reportPdf_generate_）
 *   - B_Sheets.gs（b_readTable_）
 *   - DB_BillingCycle（monthlyReportFixedAt で確定判定）
 *   - DB_MonthlyReports（pdfFileId で既存チェック）
 */

/**
 * PDF生成（確定済みの月のみ許可）
 * @param {Object} payload { projectId: string, ym: string (yyyymm) }
 * @return {Object} { ok, pdfFileId?, pdfUrl?, message? }
 */
function reportPdf_api_generate(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym 必須" };

  // --- 確定チェック（未確定でも生成可、ただしDRAFT表示） ---
  var fixedAt = reportPdf_getFixedAt_(projectId, ym);
  var isDraft = !fixedAt;

  // --- 生成実行 ---
  var result = reportPdf_generate_(projectId, ym, isDraft);
  if (result.ok) {
    result.isDraft = isDraft;
  }
  return JSON.parse(JSON.stringify(result));
}

/**
 * PDFステータス確認（ボタン表示制御用）
 * @param {Object} payload { projectId, ym }
 * @return {Object} { ok, canGenerate, isFixed, existingPdfFileId?, existingPdfUrl? }
 */
function reportPdf_api_getStatus(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false };

  var fixedAt = reportPdf_getFixedAt_(projectId, ym);
  var existing = reportPdf_getExistingPdf_(projectId, ym);

  return JSON.parse(JSON.stringify({
    ok: true,
    isFixed: !!fixedAt,
    fixedAt: fixedAt || "",
    canGenerate: true,
    existingPdfFileId: existing.fileId || "",
    existingPdfUrl: existing.fileId ? ("https://drive.google.com/file/d/" + existing.fileId + "/view") : "",
    existingPdfGeneratedAt: existing.generatedAt || ""
  }));
}


// ================================================================
//  内部関数
// ================================================================

/**
 * 月次報告書の確定日時を取得
 * DB_BillingCycle.monthlyReportFixedAt が入っていれば確定済み
 */
function reportPdf_getFixedAt_(projectId, ym) {
  try {
    var sh = b_ss_().getSheetByName("DB_BillingCycle");
    if (!sh) return null;
    var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var header = {};
    for (var c = 0; c < row1.length; c++) {
      var key = String(row1[c] || "").trim();
      if (key) header[key] = c;
    }
    if (header.projectId === undefined || header.monthlyReportFixedAt === undefined) return null;

    var ymCol = header.ym !== undefined ? header.ym : header.yearMonth;
    if (ymCol === undefined) return null;

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId] || "").trim();
      var rym = String(values[i][ymCol] || "").trim();
      if (pid === projectId && rym === ym) {
        var val = values[i][header.monthlyReportFixedAt];
        if (val && String(val).trim()) return String(val).trim();
        return null;
      }
    }
  } catch (e) {
    Logger.log("reportPdf_getFixedAt_ エラー: " + e);
  }
  return null;
}

/**
 * 既存PDFの情報を取得
 * DB_MonthlyReports.pdfFileId / pdfGeneratedAt
 */
function reportPdf_getExistingPdf_(projectId, ym) {
  try {
    var sh = b_ss_().getSheetByName("DB_MonthlyReports");
    if (!sh) return {};
    var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var header = {};
    for (var c = 0; c < row1.length; c++) {
      var key = String(row1[c] || "").trim();
      if (key) header[key] = c;
    }

    var ymCol = header.ym !== undefined ? header.ym : header.yearMonth;
    if (header.projectId === undefined || ymCol === undefined) return {};

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return {};
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId] || "").trim();
      var rym = String(values[i][ymCol] || "").trim();
      if (pid === projectId && rym === ym) {
        return {
          fileId: header.pdfFileId !== undefined ? String(values[i][header.pdfFileId] || "").trim() : "",
          generatedAt: header.pdfGeneratedAt !== undefined ? String(values[i][header.pdfGeneratedAt] || "").trim() : ""
        };
      }
    }
  } catch (e) {
    Logger.log("reportPdf_getExistingPdf_ エラー: " + e);
  }
  return {};
}