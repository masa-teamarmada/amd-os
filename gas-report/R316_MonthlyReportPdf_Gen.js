/** R316_MonthlyReportPdf_Gen.gs
 * 月次報告書PDF生成（データ収集 → HTML組み立て → PDF export → Drive保存）。
 * 月次進捗サマリ＋メンバー配分＋レポート本文を1つのPDFにまとめる。
 *
 * 依存:
 *   - 055_ProjectCockpit_Api.gs（rv2_calcRewardSummary, cpReadSheetAsTable_）
 *   - 059_RewardV2_Ops.gs（rv2_calcRewardSummary）
 *   - 304_MonthlyReport_Repo.gs（報告書本文）
 *   - B_Sheets.gs（b_readTable_）
 *   - 040_ProjectRepo.gs / DB_Projects
 *   - DB_BillingCycle（確定チェック）
 *   - DB_ValueMilestones（successCriteria）
 *   - DB_MilestoneMonthlyProgress（source）
 *   - DB_ValuePlanCycles（planCycle情報）
 */

// ===== AMD ブランドカラー =====
var RPDF_BLUE_    = "#1B3A5C";
var RPDF_GRAY_    = "#6B7B8D";
var RPDF_LTGRAY_  = "#E8ECF0";
var RPDF_WHITE_   = "#FFFFFF";
var RPDF_BLACK_   = "#222222";

// ===== Drive保存先フォルダ名 =====
var RPDF_FOLDER_NAME_ = "AMD_OS_MonthlyReportPdf";

/**
 * PDF生成メイン
 * @param {string} projectId
 * @param {string} ym yyyymm
 * @param {boolean} isDraft 未確定フラグ
 * @return {{ ok:boolean, pdfFileId?:string, pdfUrl?:string, message?:string }}
 */
function reportPdf_generate_(projectId, ym, isDraft) {
  // 1) データ収集
  var data = reportPdf_collectData_(projectId, ym);
  if (data.error) return { ok: false, message: data.error };
  data.isDraft = !!isDraft;

  // 2) HTML組み立て
  var html = reportPdf_buildHtml_(data);

  // 3) PDF変換
  var pdfBlob = HtmlService.createHtmlOutput(html)
    .getAs("application/pdf")
    .setName(data.fileName + ".pdf");

  // 4) Drive保存
  var pdfFileId = reportPdf_saveToDrive_(pdfBlob, projectId, data.driveFolderId);

  // 5) スナップショット保存
  reportPdf_saveSnapshot_(projectId, ym, data, pdfFileId);

  var pdfUrl = "https://drive.google.com/file/d/" + pdfFileId + "/view";
  return { ok: true, pdfFileId: pdfFileId, pdfUrl: pdfUrl };
}


// ================================================================
//  データ収集
// ================================================================
function reportPdf_collectData_(projectId, ym) {
  var result = {
    projectId: projectId,
    ym: ym,
    ymLabel: "",
    project: null,
    driveFolderId: "",
    milestones: [],
    members: [],
    plan: null,
    reportText: "",
    generatedAt: "",
    fileName: "",
    error: null
  };

  var yy = ym.substring(0, 4);
  var mm = parseInt(ym.substring(4, 6), 10);
  result.ymLabel = yy + "年" + mm + "月";
  result.generatedAt = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  // --- PJ基本情報 ---
  try {
    var pjRows = b_readTable_("DB_Projects");
    for (var i = 0; i < pjRows.length; i++) {
      if (String(pjRows[i].projectId || "").trim() === projectId) {
        result.project = {
          projectName: String(pjRows[i].projectName || ""),
          clientName: String(pjRows[i].clientName || "")
        };
        result.driveFolderId = String(pjRows[i].driveFolderId || "").trim();
        break;
      }
    }
  } catch (e) {}
  if (!result.project) {
    result.error = "PJが見つからない: " + projectId;
    return result;
  }

  result.fileName = result.project.projectName + "_月次報告書_" + ym;

  // 以降は元コードのまま（reportText取得〜return result まで）

  // --- 報告書本文 ---
  try {
    var reportRow = cockpit_getFullReport_(projectId, ym);
    if (reportRow) {
      var fc = String(reportRow.finalContent || "").trim();
      var dc = String(reportRow.draftContent || "").trim();
      result.reportText = fc || dc || "";
    }
  } catch (e) {}

  // --- 報酬v2（MS進捗＋メンバー配分） ---
  try {
    var rv2 = rv2_calcRewardSummary(projectId, ym);
    if (rv2 && !rv2.error) {
      var navSs = SpreadsheetApp.openById(
        PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
      );
      var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
      var plan = null;
      for (var pi = 0; pi < pcRows.length; pi++) {
        if (String(pcRows[pi].projectId || "") === projectId && String(pcRows[pi].status || "") === "fixed") {
          plan = pcRows[pi]; break;
        }
      }

      var criteriaMap = {};
      var scRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
      for (var si = 0; si < scRows.length; si++) {
        criteriaMap[String(scRows[si].milestoneId || "").trim()] = String(scRows[si].successCriteria || "");
      }

      var sourceMap = {};
      var progRows = cpReadSheetAsTable_(navSs, "DB_MilestoneMonthlyProgress");
      for (var sri = 0; sri < progRows.length; sri++) {
        var sr = progRows[sri];
        if (String(sr.projectId || "") !== projectId) continue;
        if (String(sr.ym || "") !== ym) continue;
        sourceMap[String(sr.milestoneKey || "").trim()] = String(sr.source || "");
      }

      var msList = rv2.milestones || [];
      for (var mi = 0; mi < msList.length; mi++) {
        var ms = msList[mi];
        result.milestones.push({
          key: ms.milestoneKey,
          title: ms.title,
          tag: ms.tag || "normal",
          maxPt: ms.maxPt,
          thisMonthPct: ms.progressPct,
          cumPct: ms.cumPct,
          consumedPt: Math.round((ms.cumPt || 0) * 100) / 100,
          remainPt: Math.round(Math.max(0, ms.maxPt - (ms.cumPt || 0)) * 100) / 100,
          successCriteria: criteriaMap[ms.milestoneKey] || "",
          source: sourceMap[ms.milestoneKey] || ""
        });
      }

      result.members = rv2.members || [];

      if (plan) {
        result.plan = {
          totalPoints: rv2.totalPt,
          ptUnit: rv2.ptUnit,
          startYm: String(plan.periodStartYm || ""),
          endYm: String(plan.periodEndYm || ""),
          progressRate: rv2.progressRate,
          expectedRate: rv2.expectedRate,
          monthlyConsumedPt: rv2.monthlyConsumedPt,
          cumulativeConsumedPt: rv2.cumulativeConsumedPt
        };
      }
    }
  } catch (e) {
    Logger.log("reportPdf_collectData_ rv2エラー: " + e);
  }

  return result;
}


// ================================================================
//  HTML組み立て
// ================================================================

function reportPdf_buildHtml_(data) {
  var h = [];

  h.push('<!DOCTYPE html><html><head><meta charset="utf-8">');
  h.push('<style>');
  h.push(reportPdf_css_());
  h.push('</style></head><body>');

  // DRAFT
  if (data.isDraft) {
    h.push('<div class="draft-label">DRAFT — 未確定</div>');
  }

  // ヘッダー
  h.push('<h1 class="title">' + reportPdf_esc_(data.project.projectName || data.projectId) + '　月次報告書</h1>');
  h.push('<div class="subtitle">対象月: ' + reportPdf_esc_(data.ymLabel) + '　|　' + reportPdf_esc_(data.project.clientName || '') + '</div>');

  // MSテーブル
  if (data.milestones.length > 0) {
    h.push('<h2 class="section-title">■ マイルストーン進捗</h2>');
    h.push('<table class="ms-table"><thead><tr>');
    h.push('<th style="width:28px">#</th>');
    h.push('<th style="width:160px">マイルストーン</th>');
    h.push('<th style="width:180px">進捗</th>');
    h.push('<th style="width:48px">今月%</th>');
    h.push('<th style="width:48px">累積%</th>');
    h.push('<th style="width:48px">消化pt</th>');
    h.push('<th style="width:42px">残pt</th>');
    h.push('<th style="width:42px">配点</th>');
    h.push('</tr></thead><tbody>');

    for (var i = 0; i < data.milestones.length; i++) {
      var ms = data.milestones[i];
      var pct = Number(ms.cumPct || 0);
      var barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : pct >= 20 ? '#f59e0b' : '#94a3b8';

      h.push('<tr>');
      h.push('<td class="center">' + (i + 1) + '</td>');
      h.push('<td>' + reportPdf_esc_(ms.title) + '</td>');
      var filledCount = Math.round(pct / 5);
      var emptyCount = 20 - filledCount;
      var barText = '';
      for (var bi = 0; bi < filledCount; bi++) barText += '█';
      for (var bi = 0; bi < emptyCount; bi++) barText += '░';
      h.push('<td style="font-size:7pt;letter-spacing:-1px;color:' + barColor + '"><span style="color:' + barColor + '">' + barText.substring(0, filledCount) + '</span><span style="color:' + RPDF_LTGRAY_ + '">' + barText.substring(filledCount) + '</span></td>');
      h.push('<td class="center">' + ms.thisMonthPct + '%</td>');
      h.push('<td class="center">' + pct + '%</td>');
      h.push('<td class="center">' + ms.consumedPt + '</td>');
      h.push('<td class="center">' + ms.remainPt + '</td>');
      h.push('<td class="center">' + ms.maxPt + '</td>');
      h.push('</tr>');
    }
    h.push('</tbody></table>');

    // 全体サマリ
    if (data.plan) {
      h.push('<div class="summary-line">');
      h.push('今月消化: ' + (data.plan.monthlyConsumedPt || 0) + ' pt');
      h.push('　|　累計消化: ' + (data.plan.cumulativeConsumedPt || 0) + ' pt / ' + (data.plan.totalPoints || 0) + ' pt');
      h.push('　|　進捗率: ' + (data.plan.progressRate || 0) + '%（期待: ' + (data.plan.expectedRate || 0) + '%）');
      h.push('</div>');
    }
  }

  // メンバー配分
  if (data.members.length > 0) {
    var memberNameMap = {};
    try {
      var memberRows = b_readTable_("DB_Members");
      for (var mi = 0; mi < memberRows.length; mi++) {
        memberNameMap[String(memberRows[mi].memberId || "")] = String(memberRows[mi].codeName || memberRows[mi].name || "");
      }
    } catch (e) {}

    h.push('<h2 class="section-title">■ メンバー配分</h2>');
    h.push('<table class="member-table"><thead><tr>');
    h.push('<th>メンバー</th><th>今月 pt</th><th>今月 円</th>');
    h.push('</tr></thead><tbody>');

    for (var mi = 0; mi < data.members.length; mi++) {
      var m = data.members[mi];
      var name = String(m.memberName || "") || memberNameMap[String(m.memberId || "")] || String(m.memberId || "");
      var yen = Math.round(Number(m.totalPay || m.basePay || 0));
      var yenStr = "¥" + String(yen).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

      h.push('<tr>');
      h.push('<td>' + reportPdf_esc_(name) + '</td>');
      h.push('<td class="center">' + (Math.round((m.earnedPt || m.pt || 0) * 100) / 100) + '</td>');
      h.push('<td class="center">' + yenStr + '</td>');
      h.push('</tr>');
    }
    h.push('</tbody></table>');
  }

  // 区切り
  h.push('<hr class="divider">');

  // レポート本文
  h.push('<h2 class="section-title">■ 月次報告</h2>');
  h.push('<div class="report-body">');
  h.push(reportPdf_markdownToHtml_(data.reportText || "（報告書本文なし）"));
  h.push('</div>');

  // フッター
  h.push('<div class="footer">');
  h.push('本資料はAMD OSにより自動生成（' + reportPdf_esc_(data.generatedAt) + '）　|　CONFIDENTIAL');
  h.push('</div>');

  h.push('</body></html>');
  return h.join("\n");
}


// ================================================================
//  CSS
// ================================================================

function reportPdf_css_() {
  return [
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    'body { font-family: "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; font-size: 9pt; color: ' + RPDF_BLACK_ + '; padding: 32px 40px; line-height: 1.6; }',
    '.draft-label { text-align: right; font-size: 13pt; font-weight: bold; color: #CC3333; margin-bottom: 4px; }',
    '.title { font-size: 16pt; font-weight: bold; color: ' + RPDF_BLUE_ + '; margin-bottom: 2px; }',
    '.subtitle { font-size: 9pt; color: ' + RPDF_GRAY_ + '; margin-bottom: 16px; }',
    '.section-title { font-size: 11pt; font-weight: bold; color: ' + RPDF_BLUE_ + '; margin-top: 16px; margin-bottom: 6px; }',
    '',
    'table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }',
    'th { background: ' + RPDF_BLUE_ + '; color: #fff; font-size: 8pt; font-weight: bold; padding: 5px 6px; text-align: left; }',
    'td { font-size: 8pt; padding: 5px 6px; border-bottom: 1px solid ' + RPDF_LTGRAY_ + '; }',
    'tbody tr:nth-child(even) td { background: ' + RPDF_LTGRAY_ + '; }',
    '.center { text-align: center; }',
    '',
    '.bar-bg { width: 100%; height: 14px; background: ' + RPDF_LTGRAY_ + '; border-radius: 7px; overflow: hidden; }',
    '.bar-fill { height: 100%; border-radius: 7px; }',
    '',
    '.summary-line { font-size: 8pt; color: ' + RPDF_GRAY_ + '; margin-bottom: 8px; }',
    '',
    '.member-table th { text-align: left; }',
    '.member-table td:nth-child(2), .member-table td:nth-child(3) { text-align: center; }',
    '',
    '.divider { border: none; border-top: 1px solid ' + RPDF_LTGRAY_ + '; margin: 16px 0; }',
    '',
    '.report-body { font-size: 9pt; line-height: 1.7; }',
    '.report-body h1, .report-body h2, .report-body h3 { color: ' + RPDF_BLUE_ + '; margin-top: 10px; margin-bottom: 4px; }',
    '.report-body h1 { font-size: 12pt; }',
    '.report-body h2 { font-size: 10pt; }',
    '.report-body h3 { font-size: 9pt; }',
    '.report-body p { margin-bottom: 6px; }',
    '.report-body ul, .report-body ol { margin-left: 20px; margin-bottom: 6px; }',
    '.report-body li { margin-bottom: 2px; }',
    '.report-body strong { font-weight: bold; }',
    '.report-body em { font-style: italic; }',
    '',
    '.footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid ' + RPDF_LTGRAY_ + '; font-size: 7pt; color: ' + RPDF_GRAY_ + '; text-align: center; }'
  ].join("\n");
}


// ================================================================
//  簡易Markdown → HTML変換
// ================================================================

function reportPdf_markdownToHtml_(text) {
  if (!text) return '<p>（報告書本文なし）</p>';

  var lines = text.split("\n");
  var html = [];
  var inList = false;
  var listType = "";

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // 見出し
    if (/^### /.test(line)) {
      if (inList) { html.push('</' + listType + '>'); inList = false; }
      html.push('<h3>' + reportPdf_inlineMd_(line.replace(/^### /, '')) + '</h3>');
      continue;
    }
    if (/^## /.test(line)) {
      if (inList) { html.push('</' + listType + '>'); inList = false; }
      html.push('<h2>' + reportPdf_inlineMd_(line.replace(/^## /, '')) + '</h2>');
      continue;
    }
    if (/^# /.test(line)) {
      if (inList) { html.push('</' + listType + '>'); inList = false; }
      html.push('<h1>' + reportPdf_inlineMd_(line.replace(/^# /, '')) + '</h1>');
      continue;
    }
    // ■▶●系見出し
    if (/^[■●▶]\s*/.test(line)) {
      if (inList) { html.push('</' + listType + '>'); inList = false; }
      html.push('<h3>' + reportPdf_inlineMd_(line) + '</h3>');
      continue;
    }

    // 箇条書き
    if (/^\s*[-*]\s/.test(line)) {
      if (!inList || listType !== 'ul') {
        if (inList) html.push('</' + listType + '>');
        html.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      html.push('<li>' + reportPdf_inlineMd_(line.replace(/^\s*[-*]\s/, '')) + '</li>');
      continue;
    }
    // 番号付きリスト
    if (/^\s*\d+\.\s/.test(line)) {
      if (!inList || listType !== 'ol') {
        if (inList) html.push('</' + listType + '>');
        html.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      html.push('<li>' + reportPdf_inlineMd_(line.replace(/^\s*\d+\.\s/, '')) + '</li>');
      continue;
    }

    // リスト終了
    if (inList) {
      html.push('</' + listType + '>');
      inList = false;
    }

    // 空行
    if (line.trim() === '') continue;

    // 通常テキスト
    html.push('<p>' + reportPdf_inlineMd_(line) + '</p>');
  }

  if (inList) html.push('</' + listType + '>');
  return html.join("\n");
}

/** インラインMarkdown（太字・イタリック）変換 */
function reportPdf_inlineMd_(text) {
  var s = reportPdf_esc_(text);
  // **太字**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *イタリック*
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}


// ================================================================
//  Drive保存
// ================================================================
function reportPdf_saveToDrive_(pdfBlob, projectId, driveFolderId) {
  // PJフォルダIDが指定されている場合はそちらに直接保存
  if (driveFolderId) {
    try {
      var pjFolder = DriveApp.getFolderById(driveFolderId);
      var file = pjFolder.createFile(pdfBlob);
      return file.getId();
    } catch (e) {
      Logger.log("reportPdf_saveToDrive_ PJフォルダ保存失敗、フォールバック: " + e);
    }
  }

  // フォールバック: AMD_OS_MonthlyReportPdf/{projectId}/
  var folders = DriveApp.getFoldersByName(RPDF_FOLDER_NAME_);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(RPDF_FOLDER_NAME_);
  }

  var subFolders = folder.getFoldersByName(projectId);
  var subFolder;
  if (subFolders.hasNext()) {
    subFolder = subFolders.next();
  } else {
    subFolder = folder.createFolder(projectId);
  }

  var file = subFolder.createFile(pdfBlob);
  return file.getId();
}

// ================================================================
//  スナップショット保存
// ================================================================

function reportPdf_saveSnapshot_(projectId, ym, data, pdfFileId) {
  try {
    var ss = b_ss_();
    var sh = ss.getSheetByName("DB_MonthlyReports");
    if (!sh) return;

    var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var header = {};
    for (var c = 0; c < row1.length; c++) {
      var key = String(row1[c] || "").trim();
      if (key) header[key] = c + 1;
    }

    // 列がなければ追加
    if (!header.pdfFileId) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue("pdfFileId");
      header.pdfFileId = sh.getLastColumn();
    }
    if (!header.pdfGeneratedAt) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue("pdfGeneratedAt");
      header.pdfGeneratedAt = sh.getLastColumn();
    }
    if (!header.progressSnapshot) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue("progressSnapshot");
      header.progressSnapshot = sh.getLastColumn();
    }

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    var pidCol = header.projectId || 1;
    var ymCol = header.ym || header.yearMonth || 2;

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][pidCol - 1] || "").trim();
      var rym = String(values[i][ymCol - 1] || "").trim();
      if (pid === projectId && rym === ym) {
        var rowNum = i + 2;
        sh.getRange(rowNum, header.pdfFileId).setValue(pdfFileId);
        sh.getRange(rowNum, header.pdfGeneratedAt).setValue(data.generatedAt);
        if (header.progressSnapshot) {
          var snapshot = {
            milestones: data.milestones,
            members: data.members,
            plan: data.plan
          };
          sh.getRange(rowNum, header.progressSnapshot).setValue(JSON.stringify(snapshot));
        }
        break;
      }
    }
  } catch (e) {
    Logger.log("reportPdf_saveSnapshot_ エラー: " + e);
  }
}


// ================================================================
//  ユーティリティ
// ================================================================

function reportPdf_esc_(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}