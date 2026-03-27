// A021_SheetHelpers.gs
// シート取得ヘルパー（getSheet_ / ensureHeader_ 等）

function getSheet_(name) {
  const sheetName = String(name || "").trim();
  if (!sheetName) throw new Error("Sheet name empty");
  const ss = _getSpreadsheetForSheetName_(sheetName);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`Sheet not found: ${sheetName}`);
  return sh;
}

function getSheetOrCreate_(name) {
  const sheetName = String(name || "").trim();
  if (!sheetName) throw new Error("Sheet name empty");
  const ss = _getSpreadsheetForSheetName_(sheetName);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  return sh;
}

function _getSpreadsheetForSheetName_(sheetName) {
  const n = String(sheetName || "").trim();
  if (/^DB_Navigator/i.test(n) || /^DB_Value/i.test(n)) {
    const navSs = _getNavigatorSpreadsheet_();
    if (navSs) return navSs;
    throw new Error("NAVIGATOR_SPREADSHEET_ID missing or invalid");
  }
  return SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("MAIN_SPREADSHEET_ID")
  );
}

function _getNavigatorSpreadsheet_() {
  const id = String(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || ""
  ).trim();
  if (!id) return null;
  try {
    return SpreadsheetApp.openById(id);
  } catch(e) {
    return null;
  }
}

function ensureHeader_(sh, requiredHeaders) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headerRange = sh.getRange(1, 1, 1, lastCol);
  let header = headerRange.getValues()[0].map(h => String(h || "").trim());
  if (header.every(h => !h)) {
    sh.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders.slice();
  }
  const missing = requiredHeaders.filter(h => header.indexOf(h) < 0);
  if (missing.length > 0) {
    sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
    header = header.concat(missing);
  }
  return header;
}