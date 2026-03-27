// D263_CacheRepo.gs
// 汎用スプレッドシートキャッシュ（DEV_SHEET_ID の Cache_Temp シートに保存）
// key / cachedAt / data の3列構成。keyで1行ずつ管理・上書き。

const CACHE_SHEET_NAME_ = 'Cache_Temp';

function getSheetCache_(key) {
  try {
    const sh = getDevSpreadsheet_().getSheetByName(CACHE_SHEET_NAME_);
    if (!sh) return null;
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === key) {
        try { return JSON.parse(String(rows[i][2])); } catch(e) { return null; }
      }
    }
    return null;
  } catch(e) {
    return null;
  }
}

function setSheetCache_(key, data) {
  try {
    const ss  = getDevSpreadsheet_();
    let sh    = ss.getSheetByName(CACHE_SHEET_NAME_);
    if (!sh) {
      sh = ss.insertSheet(CACHE_SHEET_NAME_);
      sh.getRange(1, 1, 1, 3).setValues([['key','cachedAt','data']]);
    }
    const now  = formatJst_(new Date());
    const json = JSON.stringify(data);
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === key) {
        sh.getRange(i + 1, 1, 1, 3).setValues([[key, now, json]]);
        return;
      }
    }
    sh.appendRow([key, now, json]);
  } catch(e) {}
}

function setSheetCacheBatch_(entries) {
  try {
    const ss = getDevSpreadsheet_();
    let sh   = ss.getSheetByName(CACHE_SHEET_NAME_);
    if (!sh) {
      sh = ss.insertSheet(CACHE_SHEET_NAME_);
      sh.getRange(1, 1, 1, 3).setValues([['key','cachedAt','data']]);
    }
    const now  = formatJst_(new Date());
    const rows = sh.getDataRange().getValues();
    entries.forEach(entry => {
      const json = JSON.stringify(entry.data);
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === entry.key) {
          sh.getRange(i + 1, 1, 1, 3).setValues([[entry.key, now, json]]);
          rows[i] = [entry.key, now, json];
          return;
        }
      }
      sh.appendRow([entry.key, now, json]);
      rows.push([entry.key, now, json]);
    });
  } catch(e) {}
}

function deleteSheetCache_(key) {
  try {
    const sh = getDevSpreadsheet_().getSheetByName(CACHE_SHEET_NAME_);
    if (!sh) return;
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === key) { sh.deleteRow(i + 1); return; }
    }
  } catch(e) {}
}