/**
 * 006_FreeeCore.gs
 *
 * 目的：
 * freee連携の “コア” を唯一の定義として集約する（重複定義を根絶する）。
 * OAuth（refresh_token）とAPI呼び口（accounting / iv）をこのファイルに固定する。
 *
 * このファイルが担当するもの：
 * - ScriptProperties からの設定取得（FREEE_*）
 * - access_token の更新とキャッシュ（同時実行ロック含む）
 * - freee 会計API（/api/1）呼び口：b_freeeRequestAccounting_
 * - freee 請求書API（/iv）呼び口：b_freeeRequestIvJson_ / b_freeeRequestIv_
 *
 * ルール：
 * - 「請求書を作る」「PDFを保存する」「DBに反映する」等の業務フローはここに置かない。
 *   （それは B_FreeeInvoice.gs のような上位レイヤーに置く）
 * - このファイル内の関数名は “変更禁止” に近い。参照元が広がるので破壊的変更を避ける。
 *
 * 注意：
 * - 以前 Billing.gs 内に同名関数が複数定義されていたため、ここを唯一正にする。
 * - IV_BASE（FREEE_IV_BASE）が未設定ならデフォルトURLにフォールバックする設計。
 */

/** ====== helpers ====== */

/****************************************************
 * freee (OAuth + callers + Drive save)
 * - ScriptProperties に以下が入ってる前提
 *   FREEE_CLIENT_ID
 *   FREEE_CLIENT_SECRET
 *   FREEE_REFRESH_TOKEN
 *   FREEE_COMPANY_ID
 *   （任意）FREEE_IV_BASE
 *   （任意）FREEE_INVOICE_FOLDER_ID
 ****************************************************/

const FREEE_KEYS = {
  CLIENT_ID: "FREEE_CLIENT_ID",
  CLIENT_SECRET: "FREEE_CLIENT_SECRET",
  REFRESH_TOKEN: "FREEE_REFRESH_TOKEN",
  COMPANY_ID: "FREEE_COMPANY_ID",
  IV_BASE: "FREEE_IV_BASE", // default: https://api.freee.co.jp/iv
  INVOICE_FOLDER_ID: "FREEE_INVOICE_FOLDER_ID", // default: BILLING_CFG.MONTHLY_REPORT_FOLDER_ID
};

function b_freeeProps_() {
  return PropertiesService.getScriptProperties();
}
function b_freeeIvBase_() {
  const v = String(b_freeeProps_().getProperty(FREEE_KEYS.IV_BASE) || "").trim();
  return v || "https://api.freee.co.jp/iv";
}
function b_freeeCompanyId_() {
  const v = String(b_freeeProps_().getProperty(FREEE_KEYS.COMPANY_ID) || "").trim();
  if (!v) throw new Error("FREEE_COMPANY_ID が未設定。ScriptPropertiesに入れてね");
  return v;
}
function b_freeeInvoiceFolderId_() {
  const v = String(b_freeeProps_().getProperty(FREEE_KEYS.INVOICE_FOLDER_ID) || "").trim();

  // 指定があってもアクセス不能なら月報フォルダへフォールバック
  if (v) {
    try {
      DriveApp.getFolderById(v); // 権限/存在チェック
      return v;
    } catch (e) {
      // fallthrough
    }
  }
  return BILLING_CFG.MONTHLY_REPORT_FOLDER_ID;
}
/**
 * refresh_token から access_token を更新（ScriptPropertiesにキャッシュ）
 * - refresh_token ローテーションに対応するため、new refresh_token が返ってきたら保存する
 * - 同時実行ロックで衝突を防ぐ
 */
function b_freeeGetAccessToken_() {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(30 * 1000);

  try {
    const cachedToken = String(props.getProperty("FREEE_ACCESS_TOKEN") || "").trim();
    const cachedExp = Number(props.getProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT") || 0);
    const now = Date.now();

    // 60秒前に更新
    if (cachedToken && cachedExp && now < (cachedExp - 60 * 1000)) {
      return cachedToken;
    }

    const clientId = String(props.getProperty(FREEE_KEYS.CLIENT_ID) || "").trim();
    const clientSecret = String(props.getProperty(FREEE_KEYS.CLIENT_SECRET) || "").trim();
    const refreshToken = String(props.getProperty(FREEE_KEYS.REFRESH_TOKEN) || "").trim();

    if (!clientId) throw new Error("FREEE_CLIENT_ID is not set");
    if (!clientSecret) throw new Error("FREEE_CLIENT_SECRET is not set");
    if (!refreshToken) throw new Error("FREEE_REFRESH_TOKEN is not set");

    const url = "https://accounts.secure.freee.co.jp/public_api/token";
    const payload = {
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    };

    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code !== 200) throw new Error("freee token refresh failed: " + code + " " + text);

    const json = text ? JSON.parse(text) : {};
    const accessToken = String(json.access_token || "").trim();
    const expiresInSec = Number(json.expires_in || 0);
    const newRefresh = String(json.refresh_token || "").trim();

    if (!accessToken) throw new Error("freee token refresh: access_token missing");

    if (newRefresh) props.setProperty(FREEE_KEYS.REFRESH_TOKEN, newRefresh);

    props.setProperty("FREEE_ACCESS_TOKEN", accessToken);
    props.setProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT", String(Date.now() + expiresInSec * 1000));

    return accessToken;
  } finally {
    lock.releaseLock();
  }
}
/**
 * freee 会計API（api/1）
 */
function b_freeeRequestAccounting_(method, path, query, body) {
  const accessToken = b_freeeGetAccessToken_();
  const base = "https://api.freee.co.jp/api/1";
  const qs = query
    ? ("?" + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&"))
    : "";
  const url = base + String(path || "") + qs;

  const opt = {
    method: String(method || "get").toLowerCase(),
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Api-Version": "2020-06-15",
    },
  };
  if (body !== undefined && body !== null) opt.payload = JSON.stringify(body);

  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error(`freee accounting api failed: ${code} ${text}`);
  return text ? JSON.parse(text) : {};
}
/**
 * freee 請求書API（iv）…唯一の呼び口
 * - GET: query を渡す
 * - POST/PUT: body を渡す
 */
function b_freeeRequestIvJson_(method, path, query, body) {
  const accessToken = b_freeeGetAccessToken_();
  const base = b_freeeIvBase_();

  const qs = query
    ? ("?" + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&"))
    : "";
  const url = base.replace(/\/+$/, "") + String(path || "") + qs;

  const opt = {
    method: String(method || "get").toLowerCase(),
    muteHttpExceptions: true,
    headers: {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined && body !== null) opt.payload = JSON.stringify(body);

  const res = UrlFetchApp.fetch(url, opt);
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) throw new Error(`freee iv api failed: ${code} ${text}`);
  return text ? JSON.parse(text) : {};
}
/**
 * 後方互換ラッパー（古い呼び方を吸収）
 * - b_freeeRequestIv_("get", "/invoices/xxx") の形で呼ばれても動くようにする
 */
function b_freeeRequestIv_(method, path, payloadOrQuery) {
  const m = String(method || "get").toLowerCase();
  if (m === "get" || m === "delete") {
    return b_freeeRequestIvJson_(m, String(path || ""), payloadOrQuery || null, null);
  }
  return b_freeeRequestIvJson_(m, String(path || ""), null, payloadOrQuery || {});
}