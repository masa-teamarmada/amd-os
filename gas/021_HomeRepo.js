/** 21_HomeRepo.gs
 * Home機能のデータアクセス（Repo）担当。
 * DB_* シートへの読み書き、ヘッダ保証、ログ追記など「スプレッドシートI/O」を集約する。
 */
// ★Home用：DB_Members を必要列だけ読む（memberId/codeName/email）+ 5分キャッシュ
function _getMembersMapsHome_(){
  const cache = CacheService.getScriptCache();
  const cacheKey = "home:membersMaps:v1";

  try{
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch(e){}

  const msh = getSheet_("DB_Members");
  const lastRow = msh.getLastRow();
  const lastCol = msh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { membersById:{}, memberIdByEmail:{} };
  }

  // ヘッダだけ
  const head = msh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
  const iMemberId = head.indexOf("memberId");
  const iCodeName = head.indexOf("codeName");
  const iEmail    = head.indexOf("email");

  if (iMemberId < 0 || iCodeName < 0) {
    return { membersById:{}, memberIdByEmail:{} };
  }

  const n = lastRow - 1;

  // ★必要列だけ読む（列が100本あってもこの3本しか触らない）
  const colMemberId = msh.getRange(2, iMemberId+1, n, 1).getValues();
  const colCodeName = msh.getRange(2, iCodeName+1, n, 1).getValues();
  const colEmail    = (iEmail >= 0) ? msh.getRange(2, iEmail+1, n, 1).getValues() : null;

  const membersById = {};
  const memberIdByEmail = {};

  for (let r=0; r<n; r++){
    const mid = String(colMemberId[r][0]||"").trim();
    if (!mid) continue;

    const cn = String(colCodeName[r][0]||"").trim() || mid;
    membersById[mid] = cn;

    if (colEmail) {
      const em = String(colEmail[r][0]||"").toLowerCase().trim();
      if (em) memberIdByEmail[em] = mid;
    }
  }

  const out = { membersById, memberIdByEmail };

  // 5分キャッシュ（Homeの連打で効く）
  try{ cache.put(cacheKey, JSON.stringify(out), 300); } catch(e){}

  return out;
}

// ======================================================================
// shared helpers
// ======================================================================
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

/**
 * シート名に応じて参照するSpreadsheetを切り替える
 * - DB_Navigator* は別スプシ（NAVIGATOR_SPREADSHEET_ID）
 * - それ以外は ActiveSpreadsheet
 */
function _getSpreadsheetForSheetName_(sheetName){
  const n = String(sheetName || "").trim();

  // Navigator系は外部SS
  if (/^DB_Navigator/i.test(n)){
    const navSs = _getNavigatorSpreadsheet_();
    if (navSs) return navSs;
    throw new Error("NAVIGATOR_SPREADSHEET_ID missing or invalid");
  }

  // ★追加：Value系も外部SS（ValuePlanの正本と同じ島に置く）
  // - DB_ValuePlanCycles / DB_ValueMilestones / DB_ValueContributions を想定
  if (/^DB_Value/i.test(n)){
    const navSs = _getNavigatorSpreadsheet_();
    if (navSs) return navSs;
    throw new Error("NAVIGATOR_SPREADSHEET_ID missing or invalid");
  }

  return SpreadsheetApp.getActiveSpreadsheet();
}

function _getNavigatorSpreadsheet_(){
  const props = PropertiesService.getScriptProperties();
  const id = String(props.getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!id) return null;

  // ★キャッシュ（毎回openByIdしない）
  const cache = CacheService.getScriptCache();
  const ck = "nav:ss:id:v1";
  try{
    const cached = cache.get(ck);
    if (cached && cached === id){
      // Spreadsheetオブジェクト自体はキャッシュできないので、ID一致だけでOK
      // openByIdは内部キャッシュも効くので軽い
      return SpreadsheetApp.openById(id);
    }
  } catch(e){}

  try{
    const ss = SpreadsheetApp.openById(id);
    try{ cache.put(ck, id, 3600); } catch(e){}
    return ss;
  } catch(e){
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

function findRowByKey_(sh, keyName, keyValue) {
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return null;

  const key = String(keyName || "").trim();
  const wanted = String(keyValue || "").trim();
  if (!key) return null;

  // ★ヘッダは trim、空ヘッダは無視、重複は後勝ち（最後の列を採用）
  const rawHeader = values[0] || [];
  const header = rawHeader.map(h => String(h || "").trim());

  const indexByName = {};
  for (let c = 0; c < header.length; c++) {
    const name = header[c];
    if (!name) continue;
    indexByName[name] = c;
  }

  const idxKey = (indexByName[key] !== undefined) ? indexByName[key] : -1;
  if (idxKey < 0) return null;

  for (let r = 1; r < values.length; r++) {
    const row = values[r] || [];
    const cell = (row[idxKey] !== undefined && row[idxKey] !== null) ? String(row[idxKey]).trim() : "";
    if (cell !== wanted) continue;

    const obj = {};
    Object.keys(indexByName).forEach(name => {
      obj[name] = row[indexByName[name]];
    });
    return obj;
  }

  return null;
}

function appendBillingLog_(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_BillingLog") || ss.insertSheet("DB_BillingLog");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["createdAt","projectId","projectName","ym","action","actorEmail","summary","payloadJson"]);
  }
  sh.appendRow([
    row.createdAt || new Date(),
    row.projectId || "",
    row.projectName || "",
    row.ym || "",
    row.action || "",
    row.actorEmail || "",
    row.summary || "",
    row.payloadJson || ""
  ]);
}

function upsertMonthlySnapshot_(projectId, ym, budget, memberPays){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_ProjectMonthlyPayout") || ss.insertSheet("DB_ProjectMonthlyPayout");
  if (sh.getLastRow() === 0) {
    sh.appendRow(["projectId","ym","budget","payoutTotal","memberPaysJson","updatedAt"]);
  }

  const values = sh.getDataRange().getValues();
  let hitRow = -1;
  for (let i=1; i<values.length; i++){
    if (String(values[i][0])===String(projectId) && String(values[i][1])===String(ym)) { hitRow = i+1; break; }
  }

  const total = (memberPays || []).reduce((s,r)=>s+Number(r.amount||0),0);
  const row = [projectId, ym, Number(budget||0), total, JSON.stringify(memberPays||[]), new Date()];

  if (hitRow === -1) sh.appendRow(row);
  else sh.getRange(hitRow,1,1,row.length).setValues([row]);
}