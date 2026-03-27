// 521_TasksRepo.gs
// 役割: DB_Tasks（TODOカンバン）のデータアクセス層
// 格納先: NAVIGATORスプシ（NAVIGATOR_SPREADSHEET_ID）
// 依存: B_Sheets.gs, 010_Utils.gs

const TASKS_SHEET_NAME = 'DB_Tasks';

function tasks_getSheet_() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  return ss.getSheetByName(TASKS_SHEET_NAME);
}

function tasks_readAll_() {
  const sh = tasks_getSheet_();
  if (!sh || sh.getLastRow() < 2) return [];
  const [headers, ...rows] = sh.getDataRange().getValues();
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

function tasks_listByProject(projectId) {
  return tasks_readAll_().filter(r => r.projectId === projectId);
}

function tasks_listByMilestone(milestoneId) {
  return tasks_readAll_().filter(r => r.milestoneId === milestoneId);
}

function tasks_listBySubItem(subItemId) {
  return tasks_readAll_().filter(r => r.subItemId === subItemId);
}

function tasks_upsert(task) {
  const sh = tasks_getSheet_();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const all = tasks_readAll_();
  const idx = all.findIndex(r => r.taskId === task.taskId);
  const now = tasks_nowJst_();
  task.updatedAtJst = now;
  if (!task.createdAtJst) task.createdAtJst = now;

  const row = headers.map(h => task[h] !== undefined ? task[h] : '');
  if (idx === -1) {
    sh.appendRow(row);
  } else {
    sh.getRange(idx + 2, 1, 1, headers.length).setValues([row]);
  }
}

function tasks_updateStatus(taskId, status) {
  const sh = tasks_getSheet_();
  const all = tasks_readAll_();
  const idx = all.findIndex(r => r.taskId === taskId);
  if (idx === -1) return false;
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('status') + 1;
  const updatedCol = headers.indexOf('updatedAtJst') + 1;
  sh.getRange(idx + 2, statusCol).setValue(status);
  sh.getRange(idx + 2, updatedCol).setValue(tasks_nowJst_());
  return true;
}

function tasks_generateId_() {
  return 'tsk_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function tasks_nowJst_() {
  const d = new Date();
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}年${pad(jst.getUTCMonth()+1)}月${pad(jst.getUTCDate())}日 ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
}