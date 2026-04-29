// 520_IssuesRepo.gs
// 役割: DB_Issues（課題DB）のデータアクセス層
// 格納先: NAVIGATORスプシ（NAVIGATOR_SPREADSHEET_ID）
// 依存: B_Sheets.gs, 010_Utils.gs

const ISSUES_SHEET_NAME = 'DB_Issues';

function issues_getSheet_() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  return ss.getSheetByName(ISSUES_SHEET_NAME);
}

function issues_readAll_() {
  const sh = issues_getSheet_();
  if (!sh || sh.getLastRow() < 2) return [];
  const [headers, ...rows] = sh.getDataRange().getValues();
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function issues_listByProject(projectId) {
  return issues_readAll_().filter(r => r.projectId === projectId);
}

function issues_listByMilestone(milestoneId) {
  return issues_readAll_().filter(r => r.milestoneId === milestoneId);
}

function issues_upsert(issue) {
  const sh = issues_getSheet_();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const all = issues_readAll_();
  const idx = all.findIndex(r => r.issueId === issue.issueId);
  const now = issues_nowJst_();
  issue.updatedAtJst = now;
  if (!issue.createdAtJst) issue.createdAtJst = now;

  const row = headers.map(h => issue[h] !== undefined ? issue[h] : '');
  if (idx === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(idx + 2, 1, 1, headers.length).setValues([row]);
  }
}

function issues_generateId_() {
  return 'iss_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function issues_nowJst_() {
  const d = new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}年${pad(jst.getUTCMonth()+1)}月${pad(jst.getUTCDate())}日 ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}