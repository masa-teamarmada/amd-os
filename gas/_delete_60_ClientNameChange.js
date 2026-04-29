/** 60_ClientNameChange.gs
 * クライアント名変更申請フロー担当。
 * トークン発行、申請取得、承認反映、スキーマ救済など、ClientNameChangeの一連を扱う。
 */
/*
function _ensureClientNameChangeTokenSheet_(){
  const sh = getSheetOrCreate_("DB_ClientNameChangeTokens");

  // ★このシートは「順序がどうであれ」列名で扱う前提にする
  // sentAt は過去互換で実在してるので正式に面倒みる
  ensureHeader_(sh, [
    "projectId",
    "projectName",
    "currentClientName",
    "requestedClientName",
    "requestedBy",
    "requestedAt",
    "sentAt",
    "token",
    "approvedAt",
    "approvedBy",
    "usedAt",
    "usedBy",
    "note"
  ]);

  return sh;
}

function api_requestClientNameChange(payload){
  // 廃止：クライアント名変更は Admin ページで直接更新する仕様に移行済み。
  // 旧フロー（トークン/承認リンク/Gmail通知）は使わない。
  if (typeof payload === "string") payload = { projectId: payload };
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const requestedClientName = String(payload.requestedClientName || "").trim();

  throw new Error(
    "api_requestClientNameChange is deprecated. " +
    "クライアント名変更は Admin ページで実行して。 " +
    `projectId=${projectId} requestedClientName=${requestedClientName}`
  );
}
function api_getClientNameChangeRequest(payload){
  // 廃止：旧承認ページ（ClientNameChangePage.html）向けAPI。
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();

  return {
    ok: false,
    message: "api_getClientNameChangeRequest is deprecated. Adminページへ移行済み。",
    projectId
  };
}
function api_approveClientNameChange(payload){
  // 廃止：旧承認ページ（ClientNameChangePage.html）向けAPI。
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();

  return {
    ok: false,
    message: "api_approveClientNameChange is deprecated. Adminページへ移行済み。",
    projectId
  };
}

function fix_DB_ClientNameChangeTokens_Schema(){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  const sh = getSheetOrCreate_("DB_ClientNameChangeTokens");
  const header = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  const idx = {};
  header.forEach((name,i)=>{ if(name) idx[name]=i; });

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok:true, fixed:0, scanned:0 };

  const vals = sh.getRange(2,1,lastRow-1,header.length).getValues();

  function get_(row, col){
    const i = idx[col];
    return (i===undefined) ? "" : String(row[i]||"").trim();
  }
  function set_(row, col, val){
    const i = idx[col];
    if (i===undefined) return;
    row[i] = val;
  }
  function looksToken_(s){
    return /^[0-9a-f]{32}$/i.test(String(s||"").trim());
  }
  function looksIso_(s){
    return /^\d{4}-\d{2}-\d{2}T/.test(String(s||"").trim());
  }

  let fixed = 0;
  let scanned = 0;

  for (let r=0; r<vals.length; r++){
    const row = vals[r];
    scanned++;

    const token = get_(row, "token");
    const projectName = get_(row, "projectName");
    const requestedAt = get_(row, "requestedAt");

    // 壊れパターン：token列が "CX" とかで、本物tokenが requestedAt列の近くにいる
    // まさの貼った例だと、tokenが最後のほうに入ってる。
    if (!looksToken_(token)) {
      // ヘッダ全部から「tokenっぽい値」を探索（その行内だけ）
      let foundToken = "";
      for (let c=0; c<row.length; c++){
        const v = String(row[c]||"").trim();
        if (looksToken_(v)) { foundToken = v; break; }
      }
      if (foundToken) {
        set_(row, "token", foundToken);
      }
    }

    // requestedAt が空で、sentAtだけ入ってる/もしくはズレてるケースの救済
    const sentAt = get_(row, "sentAt");
    if (!requestedAt && looksIso_(sentAt)) {
      set_(row, "requestedAt", sentAt);
    }
    if (!sentAt && looksIso_(requestedAt)) {
      set_(row, "sentAt", requestedAt);
    }

    // projectName が空で token列などに入ってるケース救済（“CX”がどっかに居る）
    if (!projectName) {
      // 2〜3列目あたりに入ってることが多いので雑に拾う（projectId以外で短い値）
      for (let c=0; c<Math.min(6, row.length); c++){
        const v = String(row[c]||"").trim();
        if (!v) continue;
        if (v === get_(row,"projectId")) continue;
        if (looksToken_(v)) continue;
        if (looksIso_(v)) continue;
        // 「CX」みたいな短い名前を拾う
        if (v.length <= 30) { set_(row, "projectName", v); break; }
      }
    }

    // 最低限 token がtokenっぽくなってれば固定カウント
    if (looksToken_(get_(row,"token"))) fixed++;
  }

  sh.getRange(2,1,lastRow-1,header.length).setValues(vals);

  return { ok:true, scanned, fixed };
}
*/