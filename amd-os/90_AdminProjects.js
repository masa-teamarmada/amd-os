/** 90_AdminProjects.gs
 * Admin（PJ管理）担当。
 * PJマスタの全件一覧取得と、危険操作（PJ削除カスケード）を提供する。
 */
function admin_listProjectsFull(){
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e), projects:[] };
    }
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  function toBoolLoose_(v){
    const s = String(v===null || v===undefined ? "" : v).trim().toLowerCase();
    if (!s) return false;
    if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
    return false;
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied", projects:[] });

    const sh = getSheet_("DB_Projects");

    // ★追加：tsukuyomiNudgeEnabled（Adminで介入対象を制御）
    ensureHeader_(sh, [
      "projectId","projectName","clientName",
      "freeePartnerId","status","slackChannelId",
      "pmMemberId","closerMemberId",
      "tsukuyomiNudgeEnabled",
      "updatedAt","createdAt"
    ]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:true, projects:[] });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");
    const iFreee = h.indexOf("freeePartnerId");
    const iSt  = h.indexOf("status");
    const iSlackCh = h.indexOf("slackChannelId");
    const iPm = h.indexOf("pmMemberId");
    const iCloser = h.indexOf("closerMemberId");
    const iNudge = h.indexOf("tsukuyomiNudgeEnabled");
    const iUpd = h.indexOf("updatedAt");
    const iCr  = h.indexOf("createdAt");

    const projects = [];
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (!pid) continue;

      projects.push({
        projectId: pid,
        projectName: (iPn>=0) ? String(vals[r][iPn]||"").trim() : "",

        // ★ここは既存通り：freeePartnerName を clientName 表示に使う
        clientName: (function(){
          const idx = h.indexOf("freeePartnerName");
          const fp = (idx >= 0) ? String(vals[r][idx] || "").trim() : "";
          return fp;
        })(),

        freeePartnerId: (iFreee>=0) ? String(vals[r][iFreee]||"").trim() : "",
        status: (iSt>=0) ? String(vals[r][iSt]||"").trim() : "",
        slackChannelId: (iSlackCh>=0) ? String(vals[r][iSlackCh]||"").trim() : "",

        pmMemberId: (iPm>=0) ? String(vals[r][iPm]||"").trim() : "",
        closerMemberId: (iCloser>=0) ? String(vals[r][iCloser]||"").trim() : "",

        // ★追加：介入対象フラグ（デフォfalse）
        tsukuyomiNudgeEnabled: (iNudge>=0) ? toBoolLoose_(vals[r][iNudge]) : false,

        updatedAt: (iUpd>=0) ? toIso_(vals[r][iUpd]) : "",
        createdAt: (iCr>=0) ? toIso_(vals[r][iCr]) : ""
      });
    }

    projects.sort((a,b)=> String(b.projectId).localeCompare(String(a.projectId)));
    return toWireSafe_({ ok:true, projects });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_listProjectsFull failed: " + msg, projects:[] });
  }
}

/**
 * ★PJステータス更新（Admin専用）
 * UI（AdminPage.html）から呼ばれる想定。
 *
 * payload:
 *   { projectId: string, nextStatus: string }
 */
function admin_updateProjectStatus(payload){
  // ★返り値を必ず「JSONで送れる型」にする（Date/undefined混入を潰す）
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const nextStatus = String(payload.nextStatus || "").trim().toLowerCase();

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });
    if (!nextStatus) return toWireSafe_({ ok:false, message:"nextStatus empty" });

    // ★許可する値だけ（事故防止）
    const allow = new Set(["active","sales","ended","frozen","lost","draft"]);
    if (!allow.has(nextStatus)) return toWireSafe_({ ok:false, message:"invalid status: " + nextStatus });

    const sh = getSheet_("DB_Projects");
    // ★slackChannelId を含める
    ensureHeader_(sh, ["projectId","projectName","clientName","status","slackChannelId","updatedAt","createdAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iSt  = h.indexOf("status");
    const iUpd = h.indexOf("updatedAt");

    if (iPid < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing projectId col" });
    if (iSt  < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing status col" });
    if (iUpd < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing updatedAt col" });

    let hitRow = -1; // 1-indexed row number
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid === projectId){
        hitRow = r + 1;
        break;
      }
    }
    if (hitRow < 0) return toWireSafe_({ ok:false, message:"projectId not found: " + projectId });

    const now = new Date();
    sh.getRange(hitRow, iSt+1).setValue(nextStatus);
    sh.getRange(hitRow, iUpd+1).setValue(now);

    // ログ（あれば）
    try{
      logAdminAction_("admin_update_project_status", "", { projectId, nextStatus, updatedAt: now.toISOString() });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      projectId: projectId,
      status: nextStatus,
      updatedAt: toIso_(now)
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectStatus failed: " + msg });
  }
}

/**
 * ★危険：PJ削除（カスケード）
 * - 物理削除。戻せない。UI側で必ずconfirmすること。
 */
function admin_deleteProjectCascade(projectId){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  projectId = String(projectId||"").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 削除対象シート（存在するものだけ処理）
  const targets = [
    "DB_Projects",
    "DB_ProjectCharter",
    "DB_ProjectMembers",
    "DB_CharterSaveLog",
    "DB_BillingCycle",
    "DB_PayoutDetail",
    "DB_PayoutAgreement",
    "DB_ProjectMonthlyPayout",
    "DB_PaymentConfirmTokens",
    "DB_ClientNameChangeTokens",
    "DB_InvoiceCancelTokens",
    "DB_SlackEventLog" // PJ紐づけ無いなら無視される
  ];

  function deleteByProjectId_(sheetName){
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return { sheet: sheetName, deleted:0, skipped:true };

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return { sheet: sheetName, deleted:0 };

    const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
    const iPid = header.indexOf("projectId");
    if (iPid < 0) return { sheet: sheetName, deleted:0, note:"no projectId col" };

    const vals = sh.getRange(2,1,lastRow-1,lastCol).getValues();
    let deleted = 0;

    for (let i=vals.length-1; i>=0; i--){
      if (String(vals[i][iPid]||"").trim() === projectId){
        sh.deleteRow(i+2);
        deleted++;
      }
    }
    return { sheet: sheetName, deleted };
  }

  const results = targets.map(deleteByProjectId_);
  logAdminAction_("admin_delete_project_cascade", "", { projectId, results });

  return { ok:true, projectId, results };
}

/**
 * Admin: freee取引先一覧（pulldown候補）を返す
 * 戻り値: { ok:true, partners:[{id,name}, ...] }
 *
 * ★重いので ScriptCache に数分キャッシュする
 */
function admin_listFreeePartners(){
  // ★返り値を必ず「JSONで送れる型」にする
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e), partners:[] };
    }
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied", partners:[] });

    // ===== cache (5 min) =====
    const cache = CacheService.getScriptCache();
    const cacheKey = "freee:partners:list:v2";
    const cached = cache.get(cacheKey);
    if (cached){
      try{
        const parsed = JSON.parse(cached);
        if (parsed && parsed.ok && Array.isArray(parsed.partners)){
          return toWireSafe_(parsed);
        }
      } catch(e){}
    }

    // ===== fetch from freee =====
    const partners = freee_listPartners_(); // 50_FreeePartner.gs の内部関数
    const out = (Array.isArray(partners) ? partners : [])
      .map(p => ({ id:String(p.id||"").trim(), name:String(p.name||"").trim() }))
      .filter(p => p.id && p.name);

    // 表示都合でname昇順
    out.sort((a,b)=>a.name.localeCompare(b.name, "ja"));

    const result = { ok:true, partners: out };

    // ★5分キャッシュ（300秒）
    cache.put(cacheKey, JSON.stringify(result), 300);

    return toWireSafe_(result);

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_listFreeePartners failed: " + msg, partners:[] });
  }
}

/**
 * Admin: PJの請求先（clientName）を更新する
 * - createFreeeIfMissing=true の場合、freeeに同名取引先が無ければ作成して紐づけも更新
 *
 * payload:
 *   { projectId:string, clientName:string, createFreeeIfMissing:boolean }
 *
 * 戻り値:
 *   { ok:true, projectId, clientName, freeePartnerId, freeePartnerName, updatedAt }
 */
function admin_updateProjectClientName(payload){
  // ★返り値を必ず「JSONで送れる型」にする
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const clientName = String(payload.clientName || "").trim();
    const createFreee = !!payload.createFreeeIfMissing;

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });
    if (!clientName) return toWireSafe_({ ok:false, message:"clientName empty" });

    // いまのRepo実装は「clientName入力→必ず freeeEnsure」なので
    // createFreee=false でも結果は同じになるが、将来分岐できるようにフラグは受け取っておく
    const res = updateProjectClient({
      projectId: projectId,
      clientName: clientName,
      createFreeeIfMissing: createFreee
    });

    if (!res || !res.ok){
      return toWireSafe_({ ok:false, message:(res && res.message) ? res.message : "updateProjectClient failed" });
    }

    // ログ（あれば）
    try{
      logAdminAction_("admin_update_project_client", "", {
        projectId,
        clientName,
        createFreeeIfMissing: createFreee,
        freeePartnerId: res.freeePartnerId || "",
        freeePartnerName: res.freeePartnerName || "",
        updatedAt: res.updatedAt || ""
      });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      projectId: projectId,
      clientName: String(res.clientName || clientName).trim(),
      freeePartnerId: String(res.freeePartnerId || "").trim(),
      freeePartnerName: String(res.freeePartnerName || "").trim(),
      updatedAt: String(res.updatedAt || "").trim()
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectClientName failed: " + msg });
  }
}

/**
 * Admin: freee取引先キャッシュをクリアする
 */
function admin_clearFreeePartnersCache(){
  if (!canAccessAdminPage_()) {
    return { ok:false, message:"access denied" };
  }

  const cache = CacheService.getScriptCache();

  // ★ freee取引先一覧キャッシュ
  cache.remove("freee:partners:list:v2");

  // ★ 念のため将来用の世代違いも一掃（あっても害なし）
  cache.remove("freee:partners:list:v1");
  cache.remove("freee:partners:list:debug");

  return {
    ok: true,
    cleared: [
      "freee:partners:list:v2",
      "freee:partners:list:v1",
      "freee:partners:list:debug"
    ]
  };
}

function admin_updateProjectSlackChannelId(payload){
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const slackChannelId = String(payload.slackChannelId || "").trim();

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });

    // 空OK（晒し先未設定＝チャンネル投稿しない）
    // 入れるなら C123... 形式が多いけど、将来の互換のためガチガチに縛らない
    if (/[<>"']/.test(slackChannelId)){
      return toWireSafe_({ ok:false, message:"invalid slackChannelId (contains forbidden chars)" });
    }

    const sh = getSheet_("DB_Projects");
    ensureHeader_(sh, ["projectId","projectName","clientName","status","slackChannelId","updatedAt","createdAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iCh  = h.indexOf("slackChannelId");
    const iUpd = h.indexOf("updatedAt");

    if (iPid < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing projectId col" });
    if (iCh  < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing slackChannelId col" });
    if (iUpd < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing updatedAt col" });

    let hitRow = -1;
    let prev = "";
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid === projectId){
        hitRow = r + 1;
        prev = String(vals[r][iCh]||"").trim();
        break;
      }
    }
    if (hitRow < 0) return toWireSafe_({ ok:false, message:"projectId not found: " + projectId });

    if (prev === slackChannelId){
      return toWireSafe_({ ok:true, changed:false, projectId, slackChannelId: prev, updatedAt:"" });
    }

    const now = new Date();
    sh.getRange(hitRow, iCh+1).setValue(slackChannelId);
    sh.getRange(hitRow, iUpd+1).setValue(now);

    try{
      logAdminAction_("admin_update_project_slack_channel", "", {
        projectId,
        prevSlackChannelId: prev,
        nextSlackChannelId: slackChannelId,
        updatedAt: now.toISOString()
      });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      changed:true,
      projectId,
      slackChannelId,
      updatedAt: toIso_(now)
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectSlackChannelId failed: " + msg });
  }
}

/**
 * Admin: Slackテスト送信（PJのslackChannelId宛）
 * payload: { projectId, message }
 */
function admin_testSlackPostToProject(payload){
  // 返り値を wire-safe にする
  function toWireSafe(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){ return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e) ? (e.message||e) : e) }; }
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const msg = String(payload.message || "").trim();

    if (!projectId) return toWireSafe({ ok:false, message:"projectId empty" });
    if (!msg) return toWireSafe({ ok:false, message:"message empty" });

    const sh = getSheet_("DB_Projects");
    ensureHeader_(sh, ["projectId","projectName","clientName","status","slackChannelId","updatedAt","createdAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iCh  = h.indexOf("slackChannelId");
    const iPn  = h.indexOf("projectName");

    if (iPid < 0) return toWireSafe({ ok:false, message:"DB_Projects missing projectId" });
    if (iCh  < 0) return toWireSafe({ ok:false, message:"DB_Projects missing slackChannelId" });

    let slackChannelId = "";
    let projectName = "";
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid !== projectId) continue;
      slackChannelId = String(vals[r][iCh]||"").trim();
      projectName = (iPn>=0) ? String(vals[r][iPn]||"").trim() : "";
      break;
    }
    if (!slackChannelId){
      return toWireSafe({ ok:false, message:"slackChannelId is empty for projectId=" + projectId });
    }

    const text =
      "【AMD OS】Slackテスト送信\n" +
      "PJ: " + (projectName || projectId) + "（" + projectId + "）\n\n" +
      msg;

    const res = slack_postMessage(slackChannelId, text);

    try{
      logAdminAction_("admin_test_slack_post", "", { projectId, slackChannelId, ts: String(res.ts||"") });
    } catch(e){}

    return toWireSafe({ ok:true, projectId, slackChannelId, ts: String(res.ts||"") });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe({ ok:false, message:"admin_testSlackPostToProject failed: " + msg });
  }
}

/**
 * Admin: freee取引先ID（freeePartnerId）を手入力で更新する
 * payload: { projectId:string, freeePartnerId:string }  // 空OK
 * return : { ok:true, projectId, freeePartnerId, updatedAt }
 */
function admin_updateProjectFreeePartnerId(payload){
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const freeePartnerId = String(payload.freeePartnerId || "").trim(); // 空OK

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });

    if (freeePartnerId && !/^\d+$/.test(freeePartnerId)){
      return toWireSafe_({ ok:false, message:"freeePartnerId must be digits or empty" });
    }

    const sh = getSheet_("DB_Projects");
    // 既存ヘッダはもっと多いけど、最低限ここは保証しとく
    ensureHeader_(sh, ["projectId","freeePartnerId","updatedAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iFreee = h.indexOf("freeePartnerId");
    const iUpd = h.indexOf("updatedAt");

    if (iPid < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing projectId col" });
    if (iFreee < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing freeePartnerId col" });
    if (iUpd < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing updatedAt col" });

    let hitRow = -1;
    let prev = "";
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid === projectId){
        hitRow = r + 1;
        prev = String(vals[r][iFreee]||"").trim();
        break;
      }
    }
    if (hitRow < 0) return toWireSafe_({ ok:false, message:"projectId not found: " + projectId });

    if (prev === freeePartnerId){
      return toWireSafe_({ ok:true, changed:false, projectId, freeePartnerId: prev, updatedAt:"" });
    }

    const now = new Date();
    sh.getRange(hitRow, iFreee+1).setValue(freeePartnerId);
    sh.getRange(hitRow, iUpd+1).setValue(now);

    try{
      logAdminAction_("admin_update_project_freee_partner_id", "", {
        projectId,
        prevFreeePartnerId: prev,
        nextFreeePartnerId: freeePartnerId,
        updatedAt: now.toISOString()
      });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      changed:true,
      projectId,
      freeePartnerId,
      updatedAt: toIso_(now)
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectFreeePartnerId failed: " + msg });
  }
}

/**
 * Admin: PM/クローザーを更新する
 * payload: { projectId:string, pmMemberId:string, closerMemberId:string }  // 空OK
 * return : { ok:true, projectId, pmMemberId, closerMemberId, updatedAt }
 */
function admin_updateProjectPmCloser(payload){
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const pmMemberId = String(payload.pmMemberId || "").trim();           // 空OK
    const closerMemberId = String(payload.closerMemberId || "").trim();   // 空OK

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });

    const sh = getSheet_("DB_Projects");
    ensureHeader_(sh, ["projectId","pmMemberId","closerMemberId","updatedAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPm = h.indexOf("pmMemberId");
    const iCloser = h.indexOf("closerMemberId");
    const iUpd = h.indexOf("updatedAt");

    if (iPid < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing projectId col" });
    if (iPm < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing pmMemberId col" });
    if (iCloser < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing closerMemberId col" });
    if (iUpd < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing updatedAt col" });

    let hitRow = -1;
    let prevPm = "";
    let prevCloser = "";
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid === projectId){
        hitRow = r + 1;
        prevPm = String(vals[r][iPm]||"").trim();
        prevCloser = String(vals[r][iCloser]||"").trim();
        break;
      }
    }
    if (hitRow < 0) return toWireSafe_({ ok:false, message:"projectId not found: " + projectId });

    if (prevPm === pmMemberId && prevCloser === closerMemberId){
      return toWireSafe_({
        ok:true,
        changed:false,
        projectId,
        pmMemberId: prevPm,
        closerMemberId: prevCloser,
        updatedAt:""
      });
    }

    const now = new Date();
    sh.getRange(hitRow, iPm+1).setValue(pmMemberId);
    sh.getRange(hitRow, iCloser+1).setValue(closerMemberId);
    sh.getRange(hitRow, iUpd+1).setValue(now);

    try{
      logAdminAction_("admin_update_project_pm_closer", "", {
        projectId,
        prevPmMemberId: prevPm,
        nextPmMemberId: pmMemberId,
        prevCloserMemberId: prevCloser,
        nextCloserMemberId: closerMemberId,
        updatedAt: now.toISOString()
      });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      changed:true,
      projectId,
      pmMemberId,
      closerMemberId,
      updatedAt: toIso_(now)
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectPmCloser failed: " + msg });
  }
}

/**
 * Admin: つくよみ介入対象フラグを更新する
 * payload: { projectId:string, enabled:boolean }
 * return : { ok:true, projectId, enabled, updatedAt }
 */
function admin_updateProjectTsukuyomiNudgeEnabled(payload){
  function toWireSafe_(obj){
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){
      return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e.stack||e) ? (e.message||e.stack||e) : e) };
    }
  }

  function toBool_(v){
    if (v === true) return true;
    const s = String(v===null || v===undefined ? "" : v).trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
    return false;
  }

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"").trim();
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toISOString();
  }

  try{
    if (!canAccessAdminPage_()) return toWireSafe_({ ok:false, message:"access denied" });

    payload = payload || {};
    const projectId = String(payload.projectId || "").trim();
    const enabled = toBool_(payload.enabled);

    if (!projectId) return toWireSafe_({ ok:false, message:"projectId empty" });

    const sh = getSheet_("DB_Projects");
    ensureHeader_(sh, ["projectId","tsukuyomiNudgeEnabled","updatedAt"]);

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return toWireSafe_({ ok:false, message:"DB_Projects empty" });

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iFlg = h.indexOf("tsukuyomiNudgeEnabled");
    const iUpd = h.indexOf("updatedAt");

    if (iPid < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing projectId col" });
    if (iFlg < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing tsukuyomiNudgeEnabled col" });
    if (iUpd < 0) return toWireSafe_({ ok:false, message:"DB_Projects missing updatedAt col" });

    let hitRow = -1;
    let prev = false;
    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (pid === projectId){
        hitRow = r + 1;
        prev = toBool_(vals[r][iFlg]);
        break;
      }
    }
    if (hitRow < 0) return toWireSafe_({ ok:false, message:"projectId not found: " + projectId });

    if (prev === enabled){
      return toWireSafe_({ ok:true, changed:false, projectId, enabled: prev, updatedAt:"" });
    }

    const now = new Date();
    sh.getRange(hitRow, iFlg+1).setValue(enabled ? "TRUE" : "FALSE");
    sh.getRange(hitRow, iUpd+1).setValue(now);

    try{
      logAdminAction_("admin_update_project_tsukuyomi_nudge_enabled", "", {
        projectId,
        prevEnabled: prev ? "TRUE" : "FALSE",
        nextEnabled: enabled ? "TRUE" : "FALSE",
        updatedAt: now.toISOString()
      });
    } catch(e){}

    return toWireSafe_({
      ok:true,
      changed:true,
      projectId,
      enabled: enabled,
      updatedAt: toIso_(now)
    });

  } catch(err){
    const msg = String((err && (err.stack || err.message)) ? (err.stack || err.message) : err);
    return toWireSafe_({ ok:false, message:"admin_updateProjectTsukuyomiNudgeEnabled failed: " + msg });
  }
}
