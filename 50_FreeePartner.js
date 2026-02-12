/** 50_FreeePartner.gs
 * freee取引先（partner）確定の単機能担当。
 * 取引先の検索/作成とトークン更新を自己完結で行い、Billing等への依存を持たない。
 */
/**
 * freee取引先を「名前」で確定する（会計API）
 * - 同名があればそれを使う
 * - なければ作成する
 * 戻り値: { partnerId, partnerName, created }
 *
 * 注意：この関数はサーバ内部用。UIで一覧を見せる用途では使わない。
 */
/**
 * freee取引先を「名前」で確定する（会計API）
 * - 同名があればそれを使う（★available=true を優先）
 * - なければ作成する
 * 戻り値: { partnerId, partnerName, created }
 *
 * 重要: Billing.gs の helper を一切呼ばない（依存すると二重定義地雷で死ぬ）
 */
function loadFreeePartners_(force){
  const doForce = !!force;

  // すでに入ってるなら叩かない（ただし force のときは叩く）
  if (!doForce && Array.isArray(__FREEE_PARTNERS__) && __FREEE_PARTNERS__.length){
    fillFreeePartnerDatalist_();
    return;
  }

  google.script.run
    .withFailureHandler(err => {
      // 取引先が取れなくてもPJ一覧は出したいので握りつぶす
      try{ console.warn(err); }catch(e){}
      __FREEE_PARTNERS__ = [];
      fillFreeePartnerDatalist_();
      try{ el("pjHint").textContent = "freee取引先の取得に失敗"; }catch(e){}
    })
    .withSuccessHandler(res => {
      // res: {ok:true, partners:[{id,name}]} or array
      if (Array.isArray(res)){
        __FREEE_PARTNERS__ = res;
      } else if (res && res.ok && Array.isArray(res.partners)){
        __FREEE_PARTNERS__ = res.partners;
      } else {
        __FREEE_PARTNERS__ = [];
      }
      fillFreeePartnerDatalist_();
      try{ el("pjHint").textContent = `freee取引先を再取得した（${__FREEE_PARTNERS__.length}件）`; }catch(e){}
    })
    .admin_listFreeePartners();
}
function reloadFreeePartners_(){
  const ok = window.confirm("freee取引先一覧を再読み込みする？（数秒かかる）");
  if (!ok) return;

  try{ el("pjHint").textContent = "freee取引先を再読み込み中..."; }catch(e){}

  // ★ローカルキャッシュも捨てる
  __FREEE_PARTNERS__ = [];
  fillFreeePartnerDatalist_();

  // ★サーバ側のScriptCacheも捨てる → そのあと強制取得
  google.script.run
    .withFailureHandler(err => {
      try{ showPjErr("取引先キャッシュクリア失敗: " + (err?.message || String(err))); }catch(e){}
    })
    .withSuccessHandler(res => {
      if (!res || !res.ok){
        try{ showPjErr((res && res.message) ? res.message : "取引先キャッシュクリア失敗"); }catch(e){}
        return;
      }
      loadFreeePartners_(true); // ★force
    })
    .admin_clearFreeePartnersCache();
}

/**
 * freee取引先一覧を取得する（会計API）
 * 戻り値: [{id, name}, ...]
 *
 * 重要: Billing.gs 等へ依存しない（自己完結）。
 */
/**
 * freee取引先一覧を取得する（会計API）
 * 戻り値: [{id, name}, ...]
 *
 * 重要: Billing.gs 等へ依存しない（自己完結）。
 * ★仕様: Adminの候補には「使用中（active）」だけ返す（使用停止は除外）
 */
function freee_listPartners_() {
  const props = PropertiesService.getScriptProperties();
  const companyId = String(props.getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // ===== local token getter (self-contained) =====
  function getAccessToken_(){
    const lock = LockService.getScriptLock();
    lock.waitLock(30 * 1000);
    try {
      const cachedToken = String(props.getProperty("FREEE_ACCESS_TOKEN") || "").trim();
      const cachedExp = Number(props.getProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT") || 0);
      const now = Date.now();
      if (cachedToken && cachedExp && now < (cachedExp - 60 * 1000)) return cachedToken;

      const clientId = String(props.getProperty("FREEE_CLIENT_ID") || "").trim();
      const clientSecret = String(props.getProperty("FREEE_CLIENT_SECRET") || "").trim();
      const refreshToken = String(props.getProperty("FREEE_REFRESH_TOKEN") || "").trim();
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

      const json = JSON.parse(text);
      const accessToken = String(json.access_token || "").trim();
      const expiresInSec = Number(json.expires_in || 0);
      const newRefresh = String(json.refresh_token || "").trim();
      if (!accessToken) throw new Error("freee token refresh: access_token missing");

      if (newRefresh) props.setProperty("FREEE_REFRESH_TOKEN", newRefresh);
      props.setProperty("FREEE_ACCESS_TOKEN", accessToken);
      props.setProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT", String(Date.now() + expiresInSec * 1000));

      return accessToken;
    } finally {
      lock.releaseLock();
    }
  }

  function requestAccounting_(method, path, query, body){
    const token = getAccessToken_();
    const base = "https://api.freee.co.jp/api/1";
    const qs = query
      ? ("?" + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&"))
      : "";
    const url = base + String(path || "") + qs;

    const opt = {
      method: (method || "get").toLowerCase(),
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
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
  // ==============================================

  const out = [];
  let page = 1;

  while (true){
  // freeeは一覧取得が limit/offset 型（page が効かないことがある）
  const out = [];
  const seenIds = new Set();

  let offset = 0;
  const limit = 100; // freee側上限が50でもOK。指定しておく
  let samePageHitCount = 0;

  while (true){
    const json = requestAccounting_("get", "/partners", {
      company_id: companyId,
      limit: String(limit),
      offset: String(offset)
    }, null);

    const partners = Array.isArray(json.partners) ? json.partners : [];
    if (!partners.length) break;

    let addedThisPage = 0;

    partners.forEach(p => {
      // ★使用中判定：available が false なら候補から除外
      if (p && p.available === false) return;

      const id = String(p.id || "").trim();
      const name = String(p.name || p.long_name || p.display_name || p.contact_name || "").trim();
      if (!id || !name) return;

      // ★重複排除しながら追加
      if (seenIds.has(id)) return;
      seenIds.add(id);

      out.push({ id, name });
      addedThisPage++;
    });

    // ★offset を進める（返ってきた件数ぶん進めるのが安全）
    offset += partners.length;

    // ★もし offset が効かなくて同じページを返し続けるなら即打ち切り
    if (addedThisPage === 0) samePageHitCount++;
    else samePageHitCount = 0;

    if (samePageHitCount >= 2) break; // 同じのが2回続いたら終了（暴走防止）

    // 念のため上限（暴走防止）
    if (offset > 50000) break;
  }

  // nameが空のやつ除去（念のため）
  return out
    .map(x => ({ id: String(x.id||"").trim(), name: String(x.name||"").trim() }))
    .filter(x => x.id && x.name);

  }

  // 重複排除（id基準）
  const seen = new Set();
  const uniq = [];
  out.forEach(x => {
    if (!x.id) return;
    if (seen.has(x.id)) return;
    seen.add(x.id);
    uniq.push(x);
  });

  return uniq
    .map(x => ({ id: String(x.id||"").trim(), name: String(x.name||"").trim() }))
    .filter(x => x.id && x.name);
}


/**
 * freee取引先の状態フィールドを調査するデバッグ
 * - status があるのか
 * - どんな値が入ってるのか
 * - 他に "利用停止" を示すっぽいフラグがあるのか
 *
 * 実行してログを貼って
 */
function debugFreeeInspectPartnerStatus() {
  const props = PropertiesService.getScriptProperties();
  const companyId = String(props.getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  function getAccessToken(){
    const lock = LockService.getScriptLock();
    lock.waitLock(30 * 1000);
    try {
      const cachedToken = String(props.getProperty("FREEE_ACCESS_TOKEN") || "").trim();
      const cachedExp = Number(props.getProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT") || 0);
      const now = Date.now();
      if (cachedToken && cachedExp && now < (cachedExp - 60 * 1000)) return cachedToken;

      const clientId = String(props.getProperty("FREEE_CLIENT_ID") || "").trim();
      const clientSecret = String(props.getProperty("FREEE_CLIENT_SECRET") || "").trim();
      const refreshToken = String(props.getProperty("FREEE_REFRESH_TOKEN") || "").trim();
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

      const json = JSON.parse(text);
      const accessToken = String(json.access_token || "").trim();
      const expiresInSec = Number(json.expires_in || 0);
      const newRefresh = String(json.refresh_token || "").trim();
      if (!accessToken) throw new Error("freee token refresh: access_token missing");

      if (newRefresh) props.setProperty("FREEE_REFRESH_TOKEN", newRefresh);
      props.setProperty("FREEE_ACCESS_TOKEN", accessToken);
      props.setProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT", String(Date.now() + expiresInSec * 1000));

      return accessToken;
    } finally {
      lock.releaseLock();
    }
  }

  function requestAccounting(method, path, query){
    const token = getAccessToken();
    const base = "https://api.freee.co.jp/api/1";
    const qs = query
      ? ("?" + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&"))
      : "";
    const url = base + String(path || "") + qs;

    const opt = {
      method: (method || "get").toLowerCase(),
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Version": "2020-06-15",
      },
    };

    const res = UrlFetchApp.fetch(url, opt);
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code < 200 || code >= 300) throw new Error(`freee accounting api failed: ${code} ${text}`);
    return text ? JSON.parse(text) : {};
  }

  // まず1ページだけ（300件）拾って、状態系のキーを調査
  const json = requestAccounting("get", "/partners", {
    company_id: companyId,
    page: "1",
    per_page: "300",
  });

  const partners = Array.isArray(json.partners) ? json.partners : [];
  const keysCount = {};
  const statusCount = {};
  const flagSamples = [];

  partners.forEach(p => {
    Object.keys(p || {}).forEach(k => {
      keysCount[k] = (keysCount[k] || 0) + 1;
    });

    const st = (p && p.status !== undefined) ? String(p.status) : "(no status)";
    statusCount[st] = (statusCount[st] || 0) + 1;

    // 「停止っぽい」匂いがするフィールド候補を雑に拾う（そのまま表示）
    const sample = {
      id: p && p.id,
      name: p && (p.name || p.display_name || p.contact_name),
      status: p && p.status,
      is_active: p && p.is_active,
      active: p && p.active,
      available: p && p.available,
      disabled: p && p.disabled,
      deleted: p && p.deleted,
      is_deleted: p && p.is_deleted,
    };
    flagSamples.push(sample);
  });

  Logger.log("partners length=" + partners.length);
  Logger.log("statusCount=" + JSON.stringify(statusCount, null, 2));

  // 主要キー上位だけ
  const topKeys = Object.keys(keysCount)
    .map(k => ({ k, n: keysCount[k] }))
    .sort((a,b) => b.n - a.n)
    .slice(0, 40);
  Logger.log("topKeys=" + JSON.stringify(topKeys, null, 2));

  // サンプル10件だけ
  Logger.log("flagSamples(10)=" + JSON.stringify(flagSamples.slice(0, 10), null, 2));
}

/**
 * freee /partners のページングが効いてるか検査する（デバッグ）
 * - pageごとに先頭IDの並びが変わるか
 * - uniqueIdが増えていくか
 * - available の true/false 内訳
 */
function debugFreeePartnersPaging(){
  const props = PropertiesService.getScriptProperties();
  const companyId = String(props.getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  function getAccessToken(){
    const lock = LockService.getScriptLock();
    lock.waitLock(30 * 1000);
    try {
      const cachedToken = String(props.getProperty("FREEE_ACCESS_TOKEN") || "").trim();
      const cachedExp = Number(props.getProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT") || 0);
      const now = Date.now();
      if (cachedToken && cachedExp && now < (cachedExp - 60 * 1000)) return cachedToken;

      const clientId = String(props.getProperty("FREEE_CLIENT_ID") || "").trim();
      const clientSecret = String(props.getProperty("FREEE_CLIENT_SECRET") || "").trim();
      const refreshToken = String(props.getProperty("FREEE_REFRESH_TOKEN") || "").trim();
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

      const json = JSON.parse(text);
      const accessToken = String(json.access_token || "").trim();
      const expiresInSec = Number(json.expires_in || 0);
      const newRefresh = String(json.refresh_token || "").trim();
      if (!accessToken) throw new Error("freee token refresh: access_token missing");

      if (newRefresh) props.setProperty("FREEE_REFRESH_TOKEN", newRefresh);
      props.setProperty("FREEE_ACCESS_TOKEN", accessToken);
      props.setProperty("FREEE_ACCESS_TOKEN_EXPIRES_AT", String(Date.now() + expiresInSec * 1000));
      return accessToken;
    } finally {
      lock.releaseLock();
    }
  }

  function requestAccounting(method, path, query){
    const token = getAccessToken();
    const base = "https://api.freee.co.jp/api/1";
    const qs = query
      ? ("?" + Object.keys(query).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join("&"))
      : "";
    const url = base + String(path || "") + qs;

    const opt = {
      method: (method || "get").toLowerCase(),
      muteHttpExceptions: true,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Version": "2020-06-15",
      },
    };

    const res = UrlFetchApp.fetch(url, opt);
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code < 200 || code >= 300) throw new Error(`freee accounting api failed: ${code} ${text}`);
    return text ? JSON.parse(text) : {};
  }

  const pagesToCheck = [1,2,3,4,5];
  const allIds = new Set();

  const perPageCount = {};
  const pageHeadIds = {};
  const availableCount = { true:0, false:0, undef:0 };

  pagesToCheck.forEach(pg => {
    const json = requestAccounting("get", "/partners", {
      company_id: companyId,
      page: String(pg),
      per_page: "300"
    });

    const partners = Array.isArray(json.partners) ? json.partners : [];
    perPageCount[String(pg)] = partners.length;

    const heads = partners.slice(0,10).map(p => String(p && p.id || "")).filter(x=>x);
    pageHeadIds[String(pg)] = heads;

    partners.forEach(p => {
      const id = String(p && p.id || "").trim();
      if (id) allIds.add(id);

      if (p && p.available === true) availableCount.true++;
      else if (p && p.available === false) availableCount.false++;
      else availableCount.undef++;
    });
  });

  Logger.log("perPageCount=" + JSON.stringify(perPageCount, null, 2));
  Logger.log("pageHeadIds(first10 each)=" + JSON.stringify(pageHeadIds, null, 2));
  Logger.log("uniqueIdsAcrossPages=" + allIds.size);
  Logger.log("availableCount(raw observed across pages)=" + JSON.stringify(availableCount, null, 2));

  // ページ1と2の先頭IDが完全一致してたら、page無視の可能性が高い
  const p1 = JSON.stringify(pageHeadIds["1"] || []);
  const p2 = JSON.stringify(pageHeadIds["2"] || []);
  Logger.log("page1_head_equals_page2_head=" + String(p1 === p2));
}

function debugFreeePartnersOffsetPaging(){
  const props = PropertiesService.getScriptProperties();
  const companyId = String(props.getProperty("FREEE_COMPANY_ID") || "").trim();
  if (!companyId) throw new Error("FREEE_COMPANY_ID is not set");

  // requestAccounting_ を freee_listPartners_ と同じものに合わせたいので
  // ここでは freee_listPartners_ と同じ内部 requestAccounting_ を使ってる前提で
  // “freee_listPartners_ の中で一時的に Logger を入れる”方式より安全に見たいなら
  // 下の関数を freee_listPartners_ の requestAccounting_ の下にコピペして使ってOK

  Logger.log("この関数は、freee_listPartners_ の limit/offset 化が終わった後に実行してね");
}
