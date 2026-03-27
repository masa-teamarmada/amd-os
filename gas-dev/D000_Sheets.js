// D000_Sheets.gs
// Dev GAS シート名定数・ScriptProperties定数の管理

const SHEET = {
  DEV_TICKETS: 'DB_DevTickets',
};

const PROP = {
  DEV_SHEET_ID: 'DEV_SHEET_ID',
  WEBAPP_BASE_URL: 'WEBAPP_BASE_URL',
};

function getDevSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP.DEV_SHEET_ID);
  if (!id) throw new Error('DEV_SHEET_ID が ScriptProperties に未設定');
  return SpreadsheetApp.openById(id);
}

function getSheet_(sheetName) {
  const ss = getDevSpreadsheet_();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`シートが見つからない: ${sheetName}`);
  return sh;
}