// D103_DevAppRepo.gs
// アプリ定義（DB_DevApps）のCRUD

const APP_SHEET_NAME_ = 'DB_DevApps';
const APP_HEADERS_ = [
  'appId','appName','devSheetId','mainSpreadsheetId',
  'exportDocId','gasProjectsJson','createdAt','updatedAt'
];

function ensureAppSheet_() {
  const ss = getDevSpreadsheet_();
  let sh = ss.getSheetByName(APP_SHEET_NAME_);
  if (!sh) {
    sh = ss.insertSheet(APP_SHEET_NAME_);
    sh.getRange(1, 1, 1, APP_HEADERS_.length).setValues([APP_HEADERS_]);
    sh.getRange(1, 1, 1, APP_HEADERS_.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getAllApps_() {
  const sh   = ensureAppSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(r => String(r.appId || '').trim());
}

function getAppById_(appId) {
  return getAllApps_().find(a => a.appId === appId) || null;
}

function getAppConfig_(appId) {
  const app = getAppById_(appId);
  if (!app) throw new Error('appId not found: ' + appId);
  let gasProjects = {};
  try { gasProjects = JSON.parse(String(app.gasProjectsJson || '{}')); } catch(e) {}
  return {
    appId:               String(app.appId),
    appName:             String(app.appName || ''),
    devSheetId:          String(app.devSheetId || ''),
    mainSpreadsheetId:   String(app.mainSpreadsheetId || ''),
    exportDocId:         String(app.exportDocId || ''),
    gasProjects,
  };
}

function getDevSsByApp_(appId) {
  const cfg = getAppConfig_(appId);
  if (!cfg.devSheetId) throw new Error('devSheetId未設定: ' + appId);
  return SpreadsheetApp.openById(cfg.devSheetId);
}

function upsertApp_(params) {
  const sh      = ensureAppSheet_();
  const data    = sh.getDataRange().getValues();
  const headers = data[0];
  const now     = formatJst_(new Date());
  const iId     = headers.indexOf('appId');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][iId]) === params.appId) {
      const row = data[i].slice();
      headers.forEach((h, c) => {
        if (h === 'updatedAt') { row[c] = now; return; }
        if (h === 'createdAt') return;
        if (params[h] !== undefined) row[c] = params[h];
      });
      sh.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return params.appId;
    }
  }
  const newRow = headers.map(h => {
    if (h === 'appId')     return params.appId || genAppId_();
    if (h === 'createdAt') return now;
    if (h === 'updatedAt') return now;
    return params[h] !== undefined ? params[h] : '';
  });
  if (!newRow[iId]) newRow[iId] = genAppId_();
  sh.appendRow(newRow);
  return String(newRow[iId]);
}

function deleteApp_(appId) {
  const sh   = ensureAppSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === appId) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

function genAppId_() {
  const now  = new Date();
  const pad  = (n, d) => String(n).padStart(d, '0');
  const rand = Math.random().toString(36).substring(2, 5);
  return 'app-' + now.getFullYear() + pad(now.getMonth()+1,2) + pad(now.getDate(),2)
    + pad(now.getHours(),2) + pad(now.getMinutes(),2) + pad(now.getSeconds(),2)
    + '-' + rand;
}