/**
 * R000_Sheets.gs
 *
 * 目的：
 * Google Spreadsheet 上の DB_* シートに対する “読み書きの土台” を集約する。
 * Billing以外の機能が増えても再利用できるよう、汎用的なI/O関数をここに置く。
 *
 * このファイルが担当するもの：
 * - Spreadsheet の open / Sheet取得（キャッシュ含む）
 * - ヘッダ保証（b_ensureHeader_）
 * - テーブル読み（b_readTable_ / b_readTableThin_）
 * - Upsert（b_upsertRow_）
 * - 軽量キャッシュ（1実行内キャッシュ、必要に応じて ScriptCache）
 *
 * ルール：
 * - “DBをどう解釈するか” など業務ロジックは置かない（それはDomain側）。
 * - freee/Calendar/Gmail/Drive など外部API連携は置かない（Infra側）。
 * - グローバルキャッシュ変数はここに集約し、重複定義を作らない。
 *
 * 注意：
 * - getDataRange() は空行/空列を巻き込みやすいので、原則 lastRow/lastCol で読む。
 * - b_readTable_ は全件読みなので、巨大化したDBは “Thin” か “project絞り込み” を使う。
 */

/** ====== CONFIG ====== */
const BILLING_CFG = {
  // ★トップレベルで SpreadsheetApp を触らない（WebApp/単体実行で死ぬ）
  // 実IDは getBillingSpreadsheetId() で解決する
  SPREADSHEET_ID: "",

  HUB_CALENDAR_ID: "info@team-armada.jp",
  AVAILABILITY_CALENDAR_IDS: ["masa@team-armada.jp", "kyoko@team-armada.jp"],
  MONTHLY_REPORT_FOLDER_ID: "1gVzPTvxffW6Tpn6rJ871tWLU_qUTMWEo",
  FIXED_ATTENDEES: ["masa@team-armada.jp", "kyoko@team-armada.jp"],
  TZ: "Asia/Tokyo",
  SLOT_MINUTES: 30,
  WORK_HOURS: { start: "10:00", end: "18:00" },
};

function getBillingSpreadsheetId(){
  // 1) 明示設定があればそれを使う
  const v = String(BILLING_CFG.SPREADSHEET_ID || "").trim();
  if (v) return v;

  // 2) ScriptProperties に入ってればそれを使う（運用しやすい）
  try{
    const p = String(PropertiesService.getScriptProperties().getProperty("MAIN_SPREADSHEET_ID") || "").trim();
    if (p) return p;
  } catch(e){}

  // 3) 最後の手段：コンテナバインド（スプレッドシート付属スクリプト）なら取れる
  try{
    const id = SpreadsheetApp.getActiveSpreadsheet().getId();
    if (id) return id;
  } catch(e){}

  throw new Error("MAIN_SPREADSHEET_ID missing. Set ScriptProperties MAIN_SPREADSHEET_ID or BILLING_CFG.SPREADSHEET_ID.");
}

/** ====== INTERNAL CACHES (per execution) ====== */
let __BILLING_SS__ = null;
const __BILLING_SHEETS__ = Object.create(null);
const __B_TABLE_CACHE__ = Object.create(null);
// ====== FAST READ: DB_BillingCycle (projectId only) ======
const __B_CYCLE_CACHE__ = Object.create(null);

function b_ss_() {
  // openById は地味に重いので 1実行内でキャッシュ
  if (!__BILLING_SS__) __BILLING_SS__ = SpreadsheetApp.openById(getBillingSpreadsheetId());
  return __BILLING_SS__;
}

function b_getSheet_(sheetName) {
  const key = String(sheetName);
  if (__BILLING_SHEETS__[key]) return __BILLING_SHEETS__[key];

  const sh = b_ss_().getSheetByName(key);
  if (!sh) throw new Error(`Sheet not found: ${key}`);

  __BILLING_SHEETS__[key] = sh;
  return sh;
}
function b_ensureHeader_(sheetName, requiredHeaders) {
  const sh = b_getSheet_(sheetName);
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
function b_readTable_(sheetName) {
  const key = String(sheetName || "");
  if (__B_TABLE_CACHE__[key]) return __B_TABLE_CACHE__[key];

  const sh = b_getSheet_(key);

  // getDataRange() は書式だけの空行/空列まで巻き込みやすいので、lastRow/lastColで読む
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    __B_TABLE_CACHE__[key] = [];
    return __B_TABLE_CACHE__[key];
  }

  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  if (!values || values.length < 1) {
    __B_TABLE_CACHE__[key] = [];
    return __B_TABLE_CACHE__[key];
  }

  const headers = values.shift().map(h => String(h).trim());
  const out = [];

  for (let r = 0; r < values.length; r++) {
    const row = values[r];

    // 全列空ならスキップ
    let any = false;
    for (let c = 0; c < headers.length; c++) {
      const v = row[c];
      if (v !== "" && v !== null && v !== undefined) { any = true; break; }
    }
    if (!any) continue;

    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    out.push(obj);
  }

  __B_TABLE_CACHE__[key] = out;
  return out;
}
function b_readTableThin_(sheetName, neededHeaders) {
  const sh = b_getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x||"").trim());
  const idxs = neededHeaders.map(h => header.indexOf(h));

  // 必須列が無いなら空で返す（ここはthrowでもいいけど運用優先で）
  if (idxs.some(i => i < 0)) return [];

  // ★必要列だけまとめて取る（列数が少ないほど速い）
  // getRangeは矩形しか取れないので、列を個別に取って結合する
  const cols = idxs.map(i => sh.getRange(2, i+1, lastRow-1, 1).getValues().map(r => r[0]));

  const out = [];
  for (let r = 0; r < lastRow-1; r++) {
    // 全部空なら捨てる
    let any = false;
    for (let k = 0; k < cols.length; k++) {
      const v = cols[k][r];
      if (v !== "" && v !== null && v !== undefined) { any = true; break; }
    }
    if (!any) continue;

    const obj = {};
    neededHeaders.forEach((h, k) => obj[h] = cols[k][r]);
    out.push(obj);
  }
  return out;
}
/**
 * Upsert（指定キーで更新 / 追加）
 * ★ym は Date/文字列混在でも一致するように正規化して比較
 * ★同一キーが複数あれば、先頭1行だけ更新して残り削除（重複根絶）
 */
function b_upsertRow_(sheetName, keyFields, record) {
  b_ensureHeader_(sheetName, keyFields);

  const sh = b_getSheet_(sheetName);
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  const values = (lastRow >= 1 && lastCol >= 1)
  ? sh.getRange(1, 1, lastRow, lastCol).getValues()
  : [[]];

  const headers = values[0].map(h => String(h).trim());
  const keyIdx = keyFields.map(k => headers.indexOf(k));
  if (keyIdx.some(i => i < 0)) throw new Error(`Key field missing in ${sheetName}: ${keyFields.join(",")}`);

  function normKey(field, val) {
    if (field === "ym") return b_normYm_(val);
    return String(val ?? "");
  }

  const hitRows = [];
  for (let r = 1; r < values.length; r++) {
    const hit = keyFields.every((kf, j) => {
      const idx = keyIdx[j];
      return normKey(kf, values[r][idx]) === normKey(kf, record[kf]);
    });
    if (hit) hitRows.push(r + 1);
  }

  if (hitRows.length > 0) {
    const rowNo = hitRows[0];
    const cur = sh.getRange(rowNo, 1, 1, headers.length).getValues()[0];
    const next = cur.slice();
    headers.forEach((h, i) => {
      if (record[h] !== undefined) next[i] = record[h];
    });
    sh.getRange(rowNo, 1, 1, headers.length).setValues([next]);

    if (hitRows.length > 1) {
      hitRows.slice(1).sort((a,b)=>b-a).forEach(rn => sh.deleteRow(rn));
    }
    return;
  }

  const row = headers.map(h => (record[h] !== undefined ? record[h] : ""));
  sh.appendRow(row);
}
function b_cachedReadProjects_(){
  const key = "AMDOS::DB_Projects::v1";
  const cache = CacheService.getScriptCache();

  const cached = cache.get(key);
  if (cached) {
    const arr = b_safeJsonParse_(cached, null);
    if (Array.isArray(arr)) return arr;
  }

  const rows = b_readTable_("DB_Projects");
  cache.put(key, JSON.stringify(rows), 300); // 5分
  return rows;
}
function b_invalidateProjectsCache_(){
  try {
    CacheService.getScriptCache().remove("AMDOS::DB_Projects::v1");
  } catch(e) {}
}