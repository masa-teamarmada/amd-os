/**
 * 160_CodeSearch.gs
 * Admin用：コード横断検索（関数の定義位置/参照位置を探す）
 *
 * 仕組み：
 * - Apps Script API（projects.content）で全ファイルのソースを取得
 * - functionName の定義っぽい行を探す（+ 参照も任意で探す）
 *
 * 事前準備（最初の1回）
 * - Google Apps Script API を有効化（GCP側）
 */

function admin_findFunctionLocation(payload){
  payload = payload || {};
  if (!canAccessAdminForCodeSearch()) {
    return { ok:false, message:"access denied", matches:[] };
  }

  const functionNameRaw = String(payload.functionName || "").trim();
  const includeReferences = !!payload.includeReferences;
  const maxResults = (payload.maxResults !== undefined && payload.maxResults !== null)
    ? Number(payload.maxResults || 0)
    : 200;

  // 追加：一致モード（省略時は prefix）
  const matchMode = String(payload.matchMode || "prefix").toLowerCase().trim(); // "prefix" | "exact"

  if (!functionNameRaw) return { ok:false, message:"functionName empty", matches:[] };

  const content = fetchProjectContentText();
  if (!content.ok) return { ok:false, message:content.message, matches:[] };

  const files = content.files || [];
  const matches = [];

  const q = functionNameRaw;
  const qLower = q.toLowerCase();

  // function宣言のパース（安全寄り）
  // 例: function doGet(e) { ... }
  const reAnyDecl = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/i;

  // 呼び出しっぽいもののパース（安全寄り）
  // 例: doGet(e) / admin_findFunctionLocation(...)
  // ※ obj.doGet(...) も拾いたいなら拡張できるけど、今はまず素直に識別子のみ
  const reAnyCall = /\b([A-Za-z_$][\w$]*)\s*\(/g;

  function isMatchName(name){
    const n = String(name || "");
    const nLower = n.toLowerCase();
    if (matchMode === "exact") return nLower === qLower;
    // default: prefix
    return nLower.indexOf(qLower) === 0;
  }

  for (let i = 0; i < files.length; i++){
    const f = files[i] || {};
    const fileName = String(f.name || "");
    const fileType = String(f.type || "");
    const source = String(f.source || "");
    if (!source) continue;

    const lines = source.split(/\r?\n/);

    // 定義（function宣言だけ）
    for (let ln = 0; ln < lines.length; ln++){
      const line = lines[ln];
      const m = reAnyDecl.exec(line);
      if (!m) continue;

      const foundName = m[1];
      if (!isMatchName(foundName)) continue;

      matches.push({
        kind: "definition",
        fileName,
        fileType,
        line: ln + 1,
        foundName: foundName, // 追加：実際にヒットした関数名
        snippet: String(line || "").trim()
      });

      if (maxResults > 0 && matches.length >= maxResults){
        return { ok:true, message:"hit maxResults", matches:sortMatches(matches) };
      }
    }

    // 参照（呼び出し）
    if (includeReferences){
      for (let ln2 = 0; ln2 < lines.length; ln2++){
        const line2 = lines[ln2];

        // 定義行は参照扱いから外す（旧挙動踏襲）
        const declm = reAnyDecl.exec(line2);
        if (declm && isMatchName(declm[1])) continue;

        reAnyCall.lastIndex = 0;
        let m2;
        while ((m2 = reAnyCall.exec(line2)) !== null){
          const calledName = m2[1];
          if (!isMatchName(calledName)) continue;

          matches.push({
            kind: "reference",
            fileName,
            fileType,
            line: ln2 + 1,
            foundName: calledName, // 追加：実際にヒットした呼び出し名
            snippet: String(line2 || "").trim()
          });

          if (maxResults > 0 && matches.length >= maxResults){
            return { ok:true, message:"hit maxResults", matches:sortMatches(matches) };
          }
        }
      }
    }
  }

  if (!matches.length) return { ok:false, message:"not found", matches:[] };
  return { ok:true, message:"ok", matches:sortMatches(matches) };
}

/**
 * admin用：文字列（任意のキーワード）でコード横断検索
 * - query を含む行を拾う
 * - includeReferences は互換のため受け取るけど、文字列検索では常に “参照” 扱いでOK
 */
function admin_searchCode(payload){
  payload = payload || {};
  if (!canAccessAdminForCodeSearch()) {
    return { ok:false, message:"access denied", matches:[] };
  }

  const queryRaw = String(payload.query || "").trim();
  const maxResults = (payload.maxResults !== undefined && payload.maxResults !== null)
    ? Number(payload.maxResults || 0)
    : 200;

  if (!queryRaw) return { ok:false, message:"query empty", matches:[] };

  const content = fetchProjectContentText();
  if (!content.ok) return { ok:false, message:content.message, matches:[] };

  const files = content.files || [];
  const matches = [];

  // まずは安全最優先で “単純な部分一致” のみ
  const q = queryRaw;
  const qLower = q.toLowerCase();

  for (let i = 0; i < files.length; i++){
    const f = files[i] || {};
    const fileName = String(f.name || "");
    const fileType = String(f.type || "");
    const source = String(f.source || "");
    if (!source) continue;

    const lines = source.split(/\r?\n/);
    for (let ln = 0; ln < lines.length; ln++){
      const line = String(lines[ln] || "");
      if (line.toLowerCase().indexOf(qLower) < 0) continue;

      matches.push({
        kind: "text",
        fileName,
        fileType,
        line: ln + 1,
        foundName: "", // 互換用。関数名検索じゃないので空
        snippet: line.trim()
      });

      if (maxResults > 0 && matches.length >= maxResults){
        return { ok:true, message:"hit maxResults", matches:sortMatches(matches) };
      }
    }
  }

  if (!matches.length) return { ok:false, message:"not found", matches:[] };
  return { ok:true, message:"ok", matches:sortMatches(matches) };
}

function canAccessAdminForCodeSearch(){
  // 既存の権限関数があるならそれを使う（最優先）
  try{
    if (typeof canAccessAdminPage_ === "function") return !!canAccessAdminPage_();
  } catch(e){}

  // 次点：isAdmin_ があるなら使う（あるなら一番確実）
  try{
    if (typeof isAdmin_ === "function") return !!isAdmin_();
  } catch(e){}

  // ActiveUser が空になることがあるので、EffectiveUser を優先
  try{
    const eff = Session.getEffectiveUser && Session.getEffectiveUser();
    const email = String(eff && eff.getEmail ? eff.getEmail() : "").toLowerCase().trim();
    if (email && email.indexOf("@team-armada.jp") >= 0) return true;
  } catch(e){}

  // 最後の保険：ActiveUser
  try{
    const act = Session.getActiveUser && Session.getActiveUser();
    const email2 = String(act && act.getEmail ? act.getEmail() : "").toLowerCase().trim();
    if (email2 && email2.indexOf("@team-armada.jp") >= 0) return true;
  } catch(e){}

  return false;
}

function fetchProjectContentText(){
  const scriptId = ScriptApp.getScriptId();
  if (!scriptId) return { ok:false, message:"ScriptApp.getScriptId empty", files:[] };

  const url = "https://script.googleapis.com/v1/projects/" + encodeURIComponent(scriptId) + "/content";
  const token = ScriptApp.getOAuthToken();

  try{
    const res = UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      headers: { Authorization: "Bearer " + token }
    });

    const code = res.getResponseCode();
    const body = res.getContentText();

    if (code < 200 || code >= 300){
      return { ok:false, message:"Apps Script API error: " + code + " " + body, files:[] };
    }

    const json = JSON.parse(body);
    const files = Array.isArray(json.files) ? json.files : [];
    return { ok:true, message:"ok", files };
  } catch(e){
    return { ok:false, message:"fetch failed: " + e, files:[] };
  }
}

function escapeRegExp(s){
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortMatches(list){
  const arr = Array.isArray(list) ? list.slice() : [];
  arr.sort((a,b)=>{
    const wa = (a.kind === "definition") ? 0 : 1;
    const wb = (b.kind === "definition") ? 0 : 1;
    if (wa !== wb) return wa - wb;
    if (a.fileName !== b.fileName) return a.fileName < b.fileName ? -1 : 1;
    return Number(a.line||0) - Number(b.line||0);
  });
  return arr;
}

function debugAuthorizeCodeSearch(){
  return admin_findFunctionLocation({
    functionName: "doGet",
    includeReferences: false,
    maxResults: 10
  });
}

function debugShowAccessTokenScopes(){
  const token = ScriptApp.getOAuthToken();

  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token), {
    method: "get",
    muteHttpExceptions: true
  });

  const out = {
    ok: true,
    code: res.getResponseCode(),
    body: res.getContentText()
  };

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function debugPingCodeSearch(){
  return {
    ok: true,
    at: new Date().toISOString(),
    scriptId: ScriptApp.getScriptId(),
    eff: (Session.getEffectiveUser && Session.getEffectiveUser().getEmail) ? Session.getEffectiveUser().getEmail() : "no",
    act: (Session.getActiveUser && Session.getActiveUser().getEmail) ? Session.getActiveUser().getEmail() : "no"
  };
}

function debugCodeSearchStatus(){
  const out = {
    ok: true,
    at: new Date().toISOString(),
    canAccessAdminPageFn: (typeof canAccessAdminPage_ === "function"),
    isAdminFn: (typeof isAdmin_ === "function"),
    canAccess: null,
    scriptId: "",
    eff: "",
    act: "",
    fetch: null
  };

  try { out.scriptId = String(ScriptApp.getScriptId() || ""); } catch(e){ out.scriptId = "ERR:" + e; }

  try{
    const eff = Session.getEffectiveUser && Session.getEffectiveUser();
    out.eff = (eff && eff.getEmail) ? String(eff.getEmail() || "") : "";
  } catch(e){ out.eff = "ERR:" + e; }

  try{
    const act = Session.getActiveUser && Session.getActiveUser();
    out.act = (act && act.getEmail) ? String(act.getEmail() || "") : "";
  } catch(e){ out.act = "ERR:" + e; }

  try{
    out.canAccess = canAccessAdminForCodeSearch();
  } catch(e){
    out.canAccess = "ERR:" + e;
  }

  // Apps Script API に実際に当ててみる（重いので files は持たない）
  try{
    const c = fetchProjectContentText();
    out.fetch = { ok: c.ok, message: c.message, fileCount: (c.files ? c.files.length : 0) };
  } catch(e){
    out.fetch = { ok:false, message:"ERR:" + e, fileCount: 0 };
  }

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function debugSearchDoGet(){
  const res = admin_findFunctionLocation({ functionName:"doGet", includeReferences:false, maxResults:10 });
  Logger.log("[debugSearchDoGet] " + JSON.stringify(res));
  return res;
}
