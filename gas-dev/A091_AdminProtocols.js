/** A091_AdminProtocols.gs
 * Admin（AMD Protocols管理）担当。
 * DB_ProtocolsのCRUD、PJ名→projectId解決、タグ/重要度/ステータス正規化をまとめて扱う。
 */
// ======================================================================
// Admin: Protocols (DB_Protocols)
// ======================================================================
function _getProtocolsSheet_(){
  const sh = getSheetOrCreate_("DB_Protocols");
  ensureHeader_(sh, [
    "protocolId",
    "projectId",
    "projectName",
    "branchPoint",
    "criteria",
    "actionTaken",
    "tags",
    "importance",
    "sourceType",
    "sourceRef",
    "status",
    "createdBy",
    "createdAt",
    "updatedAt"
  ]);
  return sh;
}
function _nowIsoJst_(){
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
}
function _normStatusProtocol_(v){
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "candidate";
  if (s === "candidates") return "candidate";
  if (s === "confirm") return "confirmed";
  if (s === "confirmed") return "confirmed";
  if (s === "archive") return "archived";
  if (s === "archived") return "archived";
  return s;
}
function _normImportance_(v){
  const s = String(v===null || v===undefined ? "" : v).trim();
  if (!s) return "1";
  if (s === "★") return "1";
  if (s === "★★") return "2";
  if (s === "★★★") return "3";
  const n = Number(s);
  if (isNaN(n)) return "1";
  if (n <= 1) return "1";
  if (n === 2) return "2";
  return "3";
}
function _normTags_(v){
  const s = String(v===null || v===undefined ? "" : v).trim();
  if (!s) return "";

  // ★重要： "/" や "／" は「タグの区切り」として扱わない
  // 例：「採用／組織」は1タグとして保持する
  // 区切りはあくまでカンマ（,）だけ（和文の「、」はカンマへ寄せる）
  const raw = s.replaceAll("、", ",");

  const arr = raw
    .split(",")
    .map(x=>String(x||"").trim())
    .filter(x=>x);

  // 重複除去（順序保持）
  const seen = new Set();
  const out = [];
  arr.forEach(t=>{
    if (seen.has(t)) return;
    seen.add(t);
    out.push(t);
  });

  return out.join(",");
}
function _getProjectIdNameMap_(){
  // DB_Projects から projectId->projectName を作る
  const map = Object.create(null);
  try{
    const sh = getSheet_("DB_Projects");
    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return map;

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");
    if (iPid < 0 || iPn < 0) return map;

    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      if (!pid) continue;
      const pn = String(vals[r][iPn]||"").trim() || pid;
      map[pid] = pn;
    }
  } catch(e){}
  return map;
}
function _resolveProjectIdByName_(projectName){
  const name = String(projectName||"").trim();
  if (!name) return "";

  try{
    const sh = getSheet_("DB_Projects");
    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return "";

    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iPn  = h.indexOf("projectName");
    if (iPid < 0 || iPn < 0) return "";

    const low = name.toLowerCase();

    // 1) 完全一致（大小無視）
    for (let r=1; r<vals.length; r++){
      const pn = String(vals[r][iPn]||"").trim();
      if (!pn) continue;
      if (pn.toLowerCase() === low) return String(vals[r][iPid]||"").trim();
    }

    // 2) 部分一致（最初にヒットしたやつ）
    for (let r=1; r<vals.length; r++){
      const pn = String(vals[r][iPn]||"").trim();
      if (!pn) continue;
      if (pn.toLowerCase().includes(low)) return String(vals[r][iPid]||"").trim();
    }

    return "";
  } catch(e){
    return "";
  }
}
function admin_listProtocols(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", protocols:[] };

  payload = payload || {};
  const fProjectName = String(payload.projectName || "").trim(); // ★PJ名で受ける
  const fStatus = String(payload.status || "").trim().toLowerCase();
  const fSourceType = String(payload.sourceType || "").trim().toLowerCase();
  const q = String(payload.q || "").trim().toLowerCase();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit || 0) : 500;

  const projectMap = _getProjectIdNameMap_();
  let fProjectId = "";
  if (fProjectName) {
    fProjectId = _resolveProjectIdByName_(fProjectName);
    // 見つからなければ「該当なし」扱いに寄せる
    if (!fProjectId) return { ok:true, protocols:[], meta:{ rows:0, note:"projectName not matched" } };
  }

  const sh = _getProtocolsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, protocols:[], meta:{ rows:0 } };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = (vals[0] || []).map(x=>String(x||"").trim());
  function idx_(name){ return header.indexOf(name); }
  function s_(v){ return String(v===null || v===undefined ? "" : v); }
  function sl_(v){ return s_(v).trim().toLowerCase(); }

  const iId   = idx_("protocolId");
  const iPid  = idx_("projectId");
  const iPn   = idx_("projectName");
  const iDp   = idx_("branchPoint");
  const iDc   = idx_("criteria");
  const iAt   = idx_("actionTaken");
  const iTags = idx_("tags");
  const iImp  = idx_("importance");
  const iSrcT = idx_("sourceType");
  const iSrcR = idx_("sourceRef");
  const iSt   = idx_("status");
  const iBy   = idx_("createdBy");
  const iCr   = idx_("createdAt");
  const iUp   = idx_("updatedAt");

  const out = [];
  for (let r=1; r<vals.length; r++){
    const row = vals[r] || [];
    const protocolId = s_(row[iId]).trim();
    if (!protocolId) continue;

    const projectId = s_(row[iPid]).trim();
    const projectName = (iPn>=0 ? s_(row[iPn]).trim() : "") || projectMap[projectId] || projectId;

    const status = _normStatusProtocol_(row[iSt]);
    const sourceType = sl_(row[iSrcT]);

    if (fProjectId && projectId !== fProjectId) continue;
    if (fStatus && status !== fStatus) continue;
    if (fSourceType && sourceType !== fSourceType) continue;

    const dp  = s_(row[iDp]).trim();
    const dc  = s_(row[iDc]).trim();
    const at  = s_(row[iAt]).trim();
    const tags = _normTags_(iTags>=0 ? row[iTags] : "");
    const importance = _normImportance_(iImp>=0 ? row[iImp] : "1");
    const srcRef = s_(row[iSrcR]).trim();
    const createdBy = s_(row[iBy]).trim();
    const createdAt = s_(row[iCr]).trim();
    const updatedAt = s_(row[iUp]).trim();

    if (q){
      const hay = (projectName + "\n" + dp + "\n" + dc + "\n" + at + "\n" + tags + "\n" + srcRef + "\n" + sourceType).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push({
      protocolId,
      projectId,
      projectName,
      decisionPoint: dp,
      decisionCriteria: dc,
      actionTaken: at,
      tags,
      importance,
      sourceType,
      sourceRef: srcRef,
      status,
      createdBy,
      createdAt,
      updatedAt
    });

    if (limit > 0 && out.length >= limit) break;
  }

  // createdAt desc（ISO文字列想定）
  out.sort((a,b)=>{
    const aa = String(a.createdAt||"");
    const bb = String(b.createdAt||"");
    if (!aa && !bb) return 0;
    if (!aa) return 1;
    if (!bb) return -1;
    return bb.localeCompare(aa);
  });

  return { ok:true, protocols: out, meta:{ rows: out.length } };
}
function admin_createProtocolManual(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const projectName = String(payload.projectName || "").trim();
  let projectId = String(payload.projectId || "").trim();

  if (!projectId && projectName){
    projectId = _resolveProjectIdByName_(projectName);
  }

  const branchPoint  = String(payload.branchPoint  || payload.decisionPoint    || "").trim();
  const criteria     = String(payload.criteria     || payload.decisionCriteria || "").trim();
  const actionTaken  = String(payload.actionTaken  || "").trim();

  const tags       = _normTags_(payload.tags || "");
  const importance = _normImportance_(payload.importance || "1");
  const sourceType = String(payload.sourceType || "manual").trim().toLowerCase();
  const sourceRef  = String(payload.sourceRef  || "").trim();

  if (!projectId)   return { ok:false, message:"project not resolved (projectName/projectId required)" };
  if (!branchPoint) return { ok:false, message:"branchPoint empty" };
  if (!criteria)    return { ok:false, message:"criteria empty" };

  const projectMap = _getProjectIdNameMap_();
  const fixedProjectName = projectMap[projectId] || projectName || projectId;

  const sh = _getProtocolsSheet_();
  const nowIso = _nowIsoJst_();
  const actor = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const protocolId = Utilities.getUuid().replace(/-/g,"");

  const row = [
    protocolId,
    projectId,
    fixedProjectName,
    branchPoint,
    criteria,
    actionTaken,
    tags,
    importance,
    sourceType,
    sourceRef,
    "candidate",
    actor,
    nowIso,
    nowIso
  ];

  sh.appendRow(row);
  logAdminAction_("protocol_create_manual", "", { protocolId, projectId, tags, importance });

  return { ok:true, protocolId, createdAt: nowIso };
}

function admin_updateProtocol(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const protocolId = String(payload.protocolId || "").trim();
  if (!protocolId) return { ok:false, message:"protocolId empty" };

  const projectName = String(payload.projectName || "").trim();
  let projectId = String(payload.projectId || "").trim();
  if (!projectId && projectName){
    projectId = _resolveProjectIdByName_(projectName);
  }
  // projectIdは編集時任意（既存値を維持）

  const next = {
    projectId,
    projectName: "",
    branchPoint:  String(payload.branchPoint  || payload.decisionPoint    || "").trim(),
    criteria:     String(payload.criteria     || payload.decisionCriteria || "").trim(),
    actionTaken:  String(payload.actionTaken  || "").trim(),
    tags:         _normTags_(payload.tags || ""),
    importance:   _normImportance_(payload.importance || "1"),
    sourceType:   String(payload.sourceType || "").trim().toLowerCase(),
    sourceRef:    String(payload.sourceRef  || "").trim()
  };

  if (!next.branchPoint) return { ok:false, message:"branchPoint empty" };
  if (!next.criteria)    return { ok:false, message:"criteria empty" };

  const projectMap = _getProjectIdNameMap_();
  next.projectName = projectMap[projectId] || projectName || projectId;

  const sh = _getProtocolsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no protocols" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });
  function col_(name){
    const i = idx[name];
    if (i === undefined) throw new Error("DB_Protocols missing col: " + name);
    return i;
  }

  const iId   = col_("protocolId");
  const iPid  = col_("projectId");
  const iPn   = col_("projectName");
  const iDp   = col_("branchPoint");
  const iDc   = col_("criteria");
  const iAt   = col_("actionTaken");
  const iTags = col_("tags");
  const iImp  = col_("importance");
  const iSrcT = col_("sourceType");
  const iSrcR = col_("sourceRef");
  const iUp   = col_("updatedAt");

  let hitRow = -1;
  let prev = null;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === protocolId){
      hitRow = r + 1;
      prev = {
        projectId: String(vals[r][iPid]||""),
        projectName: String(vals[r][iPn]||""),
        decisionPoint: String(vals[r][iDp]||""),
        decisionCriteria: String(vals[r][iDc]||""),
        tags: String(vals[r][iTags]||""),
        importance: String(vals[r][iImp]||""),
        sourceType: String(vals[r][iSrcT]||""),
        sourceRef: String(vals[r][iSrcR]||""),
        notes: String(vals[r][iNotes]||""),
      };
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"protocol not found: " + protocolId };

  sh.getRange(hitRow, iPid+1).setValue(next.projectId);
  sh.getRange(hitRow, iPn+1).setValue(next.projectName);
  sh.getRange(hitRow, iDp+1).setValue(next.branchPoint);
  sh.getRange(hitRow, iDc+1).setValue(next.criteria);
  sh.getRange(hitRow, iAt+1).setValue(next.actionTaken);
  sh.getRange(hitRow, iTags+1).setValue(next.tags);
  sh.getRange(hitRow, iImp+1).setValue(next.importance);
  sh.getRange(hitRow, iSrcT+1).setValue(next.sourceType);
  sh.getRange(hitRow, iSrcR+1).setValue(next.sourceRef);
  sh.getRange(hitRow, iUp+1).setValue(_nowIsoJst_());

  logAdminAction_("protocol_update", "", { protocolId, prev, next });

  return { ok:true, protocolId };
}
function admin_changeProtocolStatus(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };

  payload = payload || {};
  const protocolId = String(payload.protocolId || "").trim();
  const nextStatusRaw = String(payload.nextStatus || "").trim().toLowerCase();

  if (!protocolId) return { ok:false, message:"protocolId empty" };

  const nextStatus = _normStatusProtocol_(nextStatusRaw);
  const allow = new Set(["candidate","confirmed","archived"]);
  if (!allow.has(nextStatus)) return { ok:false, message:"invalid nextStatus: " + nextStatus };

  const sh = _getProtocolsSheet_();
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no protocols" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(x=>String(x||"").trim());
  const iId = header.indexOf("protocolId");
  const iSt = header.indexOf("status");
  const iUp = header.indexOf("updatedAt");
  if (iId < 0 || iSt < 0 || iUp < 0) return { ok:false, message:"DB_Protocols header missing" };

  let hitRow = -1;
  let prevStatus = "";
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === protocolId){
      hitRow = r + 1;
      prevStatus = _normStatusProtocol_(vals[r][iSt]);
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"protocol not found: " + protocolId };

  if (prevStatus === nextStatus) return { ok:true, protocolId, changed:false, status: nextStatus };

  sh.getRange(hitRow, iSt+1).setValue(nextStatus);
  sh.getRange(hitRow, iUp+1).setValue(_nowIsoJst_());

  logAdminAction_("protocol_change_status", "", { protocolId, prevStatus, nextStatus });

  return { ok:true, protocolId, changed:true, status: nextStatus };
}

function run_syncSourceCacheToProtocolCandidates(payload) {
  var START_MS = Date.now();
  var TIMEOUT_MS = 5.5 * 60 * 1000;

  payload = payload || {};
  var targetMonths = Number(payload.months || 2); // 直近何ヶ月分

  // プロンプト取得
  var ctxResult = tsukuyomi_listContextRows({ tag: "protocol_extract", status: "active" });
  var systemPrompt = ((ctxResult && ctxResult.rows) || [])
    .map(function(r){ return String(r.systemPrompt || "").trim(); })
    .filter(function(x){ return x; })
    .join("\n\n");
  if (!systemPrompt) return { ok: false, message: "DB_TsukuyomiContext tag=protocol_extract not found" };

  // 処理済みID
  var done = _pc_getDoneSourcePageIds_();

  // 全activePJ取得
  var pjData = b_readTable_("DB_Projects");
  var activePjs = pjData.filter(function(r){
    return String(r.status || "").toLowerCase() === "active";
  });

  // 対象ym一覧（当月から targetMonths ヶ月前まで）
  var now = new Date();
  var ymList = [];
  for (var mi = 0; mi < targetMonths; mi++){
    var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    ymList.push(String(y) + ("0" + m).slice(-2));
  }

  var result = { total: 0, skipped: 0, processed: 0, candidates: 0, timedOut: false, errors: [] };
  var runId = Utilities.getUuid().replace(/-/g, "");
  var startedAt = _nowIsoJst_();

  for (var pi = 0; pi < activePjs.length; pi++){
    if (Date.now() - START_MS > TIMEOUT_MS){ result.timedOut = true; break; }

    var projectId = String(activePjs[pi].projectId || "").trim();
    if (!projectId) continue;

    for (var yi = 0; yi < ymList.length; yi++){
      if (Date.now() - START_MS > TIMEOUT_MS){ result.timedOut = true; break; }

      var ym = ymList[yi];

      // notion / slack / gmail を対象（driveは除外）
      var sources = ["notion", "slack", "gmail"];
      for (var si = 0; si < sources.length; si++){
        if (Date.now() - START_MS > TIMEOUT_MS){ result.timedOut = true; break; }

        var src = sources[si];
        var rows = srcCache_listByProjectYm(projectId, ym, src);

        for (var ri = 0; ri < rows.length; ri++){
          if (Date.now() - START_MS > TIMEOUT_MS){ result.timedOut = true; break; }

          var row = rows[ri];
          var itemId = String(row.itemId || "").trim().replace(/-/g, "");
          var text = String(row.contentText || "").trim();

          if (!text || text.length < 100 || done.has(itemId)){
            result.skipped++;
            continue;
          }

          result.total++;
          try {
            var cands = _pc_extractFromText_(systemPrompt, text, {
              sourceType: src,
              sourcePageId: itemId,
              sourceLastEditedAt: String(row.itemDate || ym),
              projectId: projectId,
              runId: runId,
              startedAt: startedAt
            });
            _pc_appendCandidatesDedupe_(null, cands);
            result.processed++;
            result.candidates += cands.length;
          } catch(e) {
            result.errors.push({ sourcePageId: itemId, error: String(e.message || e) });
          }

          // API負荷対策
          var sleepMs = (src === "notion") ? 100 : 400;
          Utilities.sleep(sleepMs);
        }
      }
      if (result.timedOut) break;
    }
    if (result.timedOut) break;
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// ラッパー（引数なし手動実行用）
function run_syncSourceCacheToProtocolCandidates_manual() {
  return run_syncSourceCacheToProtocolCandidates();
}

/** 日次cron：SourceCacheからプロトコル候補を抽出（6:00 JST想定） */
function cron_syncProtocolCandidatesDaily() {
  return run_syncSourceCacheToProtocolCandidates({ months: 2 });
}

/** トリガー設定（1回だけ手動実行） ファイル: 091_AdminProtocols.gs */
function setup_protocolCandidatesTrigger() {
  var fnName = "cron_syncProtocolCandidatesDaily";

  // 不要トリガー掃除
  var toDelete = ["reimburseNotifyPmWorker"];
  var triggers = ScriptApp.getProjectTriggers();
  var seenMonthlyReport = false;

  for (var i = 0; i < triggers.length; i++) {
    var handler = triggers[i].getHandlerFunction();

    // 明示的に不要なもの
    if (toDelete.indexOf(handler) >= 0) {
      Logger.log("削除（不要）: " + handler);
      ScriptApp.deleteTrigger(triggers[i]);
      continue;
    }

    // run_monthlyReportCron の重複（2つ目以降を削除）
    if (handler === "run_monthlyReportCron") {
      if (seenMonthlyReport) {
        Logger.log("削除（重複）: " + handler);
        ScriptApp.deleteTrigger(triggers[i]);
        continue;
      }
      seenMonthlyReport = true;
    }

    // 既存の自分自身を削除
    if (handler === fnName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 毎日 6:00-7:00 JST
  ScriptApp.newTrigger(fnName)
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone("Asia/Tokyo")
    .create();

  Logger.log("トリガー設定完了: " + fnName + " 毎日6:00-7:00 JST");
}

function _pc_getDoneSourcePageIds_() {
  var set = new Set();
  try {
    var sh = b_getSheet_("DB_ProtocolCandidates");
    if (!sh || sh.getLastRow() < 2) return set;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var col = headers.indexOf("sourcePageId");
    if (col < 0) return set;
    var vals = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
    vals.forEach(function(r){ if (r[0]) set.add(String(r[0]).replace(/-/g, "")); });
  } catch(e) {}
  return set;
}

function _pc_extractFromText_(systemPrompt, text, meta) {
  var extracted = llm_callJson("protocol_extract", systemPrompt, text);
  if (!extracted || extracted._error) return [];
  var list = Array.isArray(extracted) ? extracted
           : (Array.isArray(extracted.candidates) ? extracted.candidates : []);

  return list.map(function(c) {
    var bp = String(c.branch_point || c.branchPoint || "").trim();
    var cr = String(c.condition    || c.criteria    || "").trim();
    if (!bp || !cr) return null;
    return {
      candidateId:            Utilities.getUuid().replace(/-/g, ""),
      candidateKey:           _pc_hashKey_(meta.sourcePageId, bp, cr),
      sourceType:             meta.sourceType,
      sourcePageId:           meta.sourcePageId,
      sourceLastEditedAt:     meta.sourceLastEditedAt,
      suggestedProjectId:     meta.projectId,
      suggestedProjectName:   meta.projectId,
      suggestedTags:          Array.isArray(c.tags) ? c.tags.join(",") : String(c.tags || ""),
      branchPoint:            bp,
      criteria:               cr,
      optionsJson:            "[]",
      actionTaken:            String(c.action || c.actionTaken || "").trim(),
      evidenceJson:           JSON.stringify(Array.isArray(c.evidence_snippets) ? c.evidence_snippets : []),
      confidence:             String(c.confidence || ""),
      status:                 "new",
      promotedProtocolId:     "",
      runId:                  meta.runId,
      createdAt:              meta.startedAt,
      updatedAt:              meta.startedAt,
      injectedContextIds:     "[]",
      injectedContextDigest:  "",
      promptVersion:          "v4_cache1",
      feedbackRating: "", feedbackComment: "", feedbackBy: "", feedbackAt: "",
      rejectedReason: "", rejectedBy: "", rejectedAt: ""
    };
  }).filter(function(x){ return x !== null; });
}

function admin_listProtocolCandidates(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", candidates:[], meta:{} };

  payload = payload || {};
  const status = String(payload.status || "").trim().toLowerCase();
  const pageId = String(payload.pageId || "").trim();
  const q = String(payload.q || "").trim().toLowerCase();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 200;

  const sh = b_getSheet_("DB_ProtocolCandidates");
  if (!sh) return { ok:true, candidates:[], meta:{ rows:0 } };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, candidates:[], meta:{ rows:0 } };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  function get_(row, name){
    const i = idx[name];
    if (i === undefined) return "";
    return row[i];
  }
  function s_(v){ return String(v===null || v===undefined ? "" : v).trim(); }
  function sl_(v){ return s_(v).toLowerCase(); }

  const out = [];
  for (let r=1; r<vals.length; r++){
    const row = vals[r];
    const candId = s_(get_(row,"candidateId"));
    if (!candId) continue;

    const st = sl_(get_(row,"status"));
    const pid = s_(get_(row,"sourcePageId"));

    if (status && st !== status) continue;
    if (pageId && pid !== pageId) continue;

    const branchPoint   = s_(get_(row,"branchPoint"));
    const criteria      = s_(get_(row,"criteria"));
    const actionTaken   = s_(get_(row,"actionTaken"));
    const confidence    = s_(get_(row,"confidence"));
    const evidenceJson  = s_(get_(row,"evidenceJson"));
    const rejectedReason  = s_(get_(row,"rejectedReason"));
    const feedbackRating  = s_(get_(row,"feedbackRating"));
    const feedbackComment = s_(get_(row,"feedbackComment"));

    if (q){
      const hay = (branchPoint + "\n" + criteria + "\n" + actionTaken + "\n" + evidenceJson + "\n" + rejectedReason + "\n" + feedbackComment).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push({
      candidateId: candId,
      candidateKey: s_(get_(row,"candidateKey")),
      sourceType: s_(get_(row,"sourceType")),
      sourcePageId: pid,
      sourceLastEditedAt: s_(get_(row,"sourceLastEditedAt")),
      suggestedProjectId: s_(get_(row,"suggestedProjectId")),
      suggestedProjectName: s_(get_(row,"suggestedProjectName")),
      suggestedTags: s_(get_(row,"suggestedTags")),
      branchPoint,
      criteria,
      actionTaken,
      optionsJson: s_(get_(row,"optionsJson")),
      evidenceJson,
      confidence,
      status: st,
      promotedProtocolId: s_(get_(row,"promotedProtocolId")),
      runId: s_(get_(row,"runId")),
      createdAt: s_(get_(row,"createdAt")),
      updatedAt: s_(get_(row,"updatedAt")),
      rejectedReason,
      rejectedBy: s_(get_(row,"rejectedBy")),
      rejectedAt: s_(get_(row,"rejectedAt")),
      injectedContextIds: s_(get_(row,"injectedContextIds")),
      injectedContextDigest: s_(get_(row,"injectedContextDigest")),
      promptVersion: s_(get_(row,"promptVersion")),
      feedbackRating,
      feedbackComment,
      feedbackBy: s_(get_(row,"feedbackBy")),
      feedbackAt: s_(get_(row,"feedbackAt"))
    });

    if (limit > 0 && out.length >= limit) break;
  }

  out.sort((a,b)=> String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

  return { ok:true, candidates: out, meta:{ rows: out.length } };
}

/**
 * admin_fixProtocolCandidate
 * 修正指示をLLMに渡してDB_ProtocolCandidatesを上書きする
 */
function admin_fixProtocolCandidate(payload) {
  if (!isAdmin_()) return { ok: false, message: "admin only" };

  var candidateId = String(payload.candidateId || "").trim();
  var instruction = String(payload.instruction || "").trim();
  if (!candidateId) return { ok: false, message: "candidateId empty" };
  if (!instruction)  return { ok: false, message: "instruction empty" };

  var storeId = String(PropertiesService.getScriptProperties()
    .getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok: false, message: "PROTOCOL_STORE_SPREADSHEET_ID missing" };

  var candSheet = b_getSheet_("DB_ProtocolCandidates");
  if (!candSheet) return { ok: false, message: "DB_ProtocolCandidates not found" };

  // 候補取得
  var allRows = candSheet.getDataRange().getValues();
  var headers = allRows[0].map(function(h){ return String(h||"").trim(); });
  var iId  = headers.indexOf("candidateId");
  var iBp  = headers.indexOf("branchPoint");
  var iCr  = headers.indexOf("criteria");
  var iDc  = headers.indexOf("actionTaken");
  var iUp  = headers.indexOf("updatedAt");

  var hitRowNo = -1;
  var cand = null;
  for (var r = 1; r < allRows.length; r++) {
    if (String(allRows[r][iId]||"").trim() === candidateId) {
      hitRowNo = r + 1;
      cand = {
        branchPoint: String(allRows[r][iBp]||""),
        criteria:    String(allRows[r][iCr]||""),
        actionTaken: String(allRows[r][iDc]||"")
      };
      break;
    }
  }
  if (!cand) return { ok: false, message: "candidate not found: " + candidateId };

  // DB_LLMContext から tag=protocol_candidate_fix のプロンプト取得
  var ctxResult = tsukuyomi_listContextRows({ tag: "protocol_candidate_fix", status: "active" });
  var fixPrompt = ((ctxResult && ctxResult.rows) || [])
    .map(function(r){ return String(r.systemPrompt || "").trim(); })
    .filter(function(x){ return x; })
    .join("\n\n");

  if (!fixPrompt) return { ok: false, message: "DB_TsukuyomiContext に tag=protocol_candidate_fix のエントリがない" };

  // LLM呼び出し
  var userPrompt = JSON.stringify({
    current: {
      branchPoint: cand.branchPoint,
      criteria:    cand.criteria,
      actionTaken: cand.actionTaken
    },
    instruction: instruction
  });

  var fixed = llm_callJson("protocol_extract", fixPrompt, userPrompt);
  if (!fixed || fixed._error) return { ok: false, message: "LLM failed: " + (fixed && fixed._error || "unknown") };

  // シートを直接更新
  var now = _nowIsoJst_();
  if (iBp >= 0) candSheet.getRange(hitRowNo, iBp+1).setValue(String(fixed.branchPoint || cand.branchPoint).trim());
  if (iCr >= 0) candSheet.getRange(hitRowNo, iCr+1).setValue(String(fixed.criteria    || cand.criteria).trim());
  if (iDc >= 0) candSheet.getRange(hitRowNo, iDc+1).setValue(String(fixed.actionTaken || cand.actionTaken).trim());
  if (iUp >= 0) candSheet.getRange(hitRowNo, iUp+1).setValue(now);

  return JSON.parse(JSON.stringify({
    ok: true,
    candidateId: candidateId,
    branchPoint: String(fixed.branchPoint || ""),
    criteria:    String(fixed.criteria    || ""),
    actionTaken: String(fixed.actionTaken || "")
  }));
}

function admin_rejectProtocolCandidate(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};

  const candidateId = String(payload.candidateId || "").trim();
  const reason      = String(payload.reason      || "").trim();

  if (!candidateId) return { ok:false, message:"candidateId empty" };

  const sh = b_getSheet_("DB_ProtocolCandidates");
  if (!sh) return { ok:false, message:"DB_ProtocolCandidates missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no candidates" };

  const vals   = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(function(x){ return String(x||"").trim(); });
  var idx = {};
  header.forEach(function(h,i){ if(h) idx[h]=i; });

  function col_(name){
    if (idx[name] === undefined) throw new Error("col missing: " + name);
    return idx[name];
  }

  const iId     = col_("candidateId");
  const iStatus = col_("status");
  const iUpd    = col_("updatedAt");

  var iRejReason = idx["rejectedReason"];
  var iRejBy     = idx["rejectedBy"];
  var iRejAt     = idx["rejectedAt"];

  // 列が無ければ自動追加
  if (iRejReason === undefined){
    const newCols = ["rejectedReason","rejectedBy","rejectedAt"];
    const base = lastCol;
    newCols.forEach(function(name, i){
      sh.getRange(1, base+i+1).setValue(name);
      idx[name] = base+i;
    });
    iRejReason = idx["rejectedReason"];
    iRejBy     = idx["rejectedBy"];
    iRejAt     = idx["rejectedAt"];
  }

  var hitRow = -1;
  for (var r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === candidateId){
      hitRow = r + 1;
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"candidate not found: " + candidateId };

  const nowJst = _nowIsoJst_();
  const by     = String(Session.getActiveUser().getEmail()||"").toLowerCase();

  sh.getRange(hitRow, iStatus+1).setValue("rejected");
  sh.getRange(hitRow, iUpd+1).setValue(nowJst);
  sh.getRange(hitRow, iRejReason+1).setValue(reason);
  sh.getRange(hitRow, iRejBy+1).setValue(by);
  sh.getRange(hitRow, iRejAt+1).setValue(nowJst);

  return { ok:true, candidateId: candidateId };
}