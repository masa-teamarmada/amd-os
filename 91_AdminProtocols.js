/** 91_AdminProtocols.gs
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
    "projectName",        // ★追加
    "decisionPoint",
    "decisionCriteria",
    "tags",               // ★追加（カンマ区切り）
    "importance",         // ★追加（1/2/3）
    "sourceType",
    "sourceRef",
    "notes",
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

  const iId = idx_("protocolId");
  const iPid = idx_("projectId");
  const iPn  = idx_("projectName");
  const iDp = idx_("decisionPoint");
  const iDc = idx_("decisionCriteria");
  const iTags = idx_("tags");
  const iImp  = idx_("importance");
  const iSrcT = idx_("sourceType");
  const iSrcR = idx_("sourceRef");
  const iNotes = idx_("notes");
  const iSt = idx_("status");
  const iBy = idx_("createdBy");
  const iCr = idx_("createdAt");
  const iUp = idx_("updatedAt");

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

    const dp = s_(row[iDp]).trim();
    const dc = s_(row[iDc]).trim();
    const tags = _normTags_(iTags>=0 ? row[iTags] : "");
    const importance = _normImportance_(iImp>=0 ? row[iImp] : "1");
    const notes = s_(row[iNotes]).trim();
    const srcRef = s_(row[iSrcR]).trim();
    const createdBy = s_(row[iBy]).trim();
    const createdAt = s_(row[iCr]).trim();
    const updatedAt = s_(row[iUp]).trim();

    if (q){
      const hay = (projectName + "\n" + dp + "\n" + dc + "\n" + tags + "\n" + notes + "\n" + srcRef + "\n" + sourceType).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    out.push({
      protocolId,
      projectId,
      projectName,
      decisionPoint: dp,
      decisionCriteria: dc,
      tags,
      importance,
      sourceType,
      sourceRef: srcRef,
      notes,
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
  const projectName = String(payload.projectName || "").trim(); // ★PJ名で受ける
  let projectId = String(payload.projectId || "").trim();

  if (!projectId && projectName){
    projectId = _resolveProjectIdByName_(projectName);
  }

  const decisionPoint = String(payload.decisionPoint || "").trim();
  const decisionCriteria = String(payload.decisionCriteria || "").trim();

  const tags = _normTags_(payload.tags || "");
  const importance = _normImportance_(payload.importance || "1");

  const sourceType = String(payload.sourceType || "manual").trim().toLowerCase();
  const sourceRef  = String(payload.sourceRef || "").trim();
  const notes      = String(payload.notes || "").trim();

  if (!projectId) return { ok:false, message:"project not resolved (projectName/projectId required)" };
  if (!decisionPoint) return { ok:false, message:"decisionPoint empty" };
  if (!decisionCriteria) return { ok:false, message:"decisionCriteria empty" };

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
    decisionPoint,
    decisionCriteria,
    tags,
    importance,
    sourceType,
    sourceRef,
    notes,
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
  if (!projectId) return { ok:false, message:"project not resolved" };

  const next = {
    projectId,
    projectName: "", // 後で確定
    decisionPoint: String(payload.decisionPoint || "").trim(),
    decisionCriteria: String(payload.decisionCriteria || "").trim(),
    tags: _normTags_(payload.tags || ""),
    importance: _normImportance_(payload.importance || "1"),
    sourceType: String(payload.sourceType || "").trim().toLowerCase(),
    sourceRef: String(payload.sourceRef || "").trim(),
    notes: String(payload.notes || "").trim()
  };

  if (!next.decisionPoint) return { ok:false, message:"decisionPoint empty" };
  if (!next.decisionCriteria) return { ok:false, message:"decisionCriteria empty" };

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

  const iId = col_("protocolId");
  const iPid = col_("projectId");
  const iPn  = col_("projectName");
  const iDp = col_("decisionPoint");
  const iDc = col_("decisionCriteria");
  const iTags = col_("tags");
  const iImp  = col_("importance");
  const iSrcT = col_("sourceType");
  const iSrcR = col_("sourceRef");
  const iNotes = col_("notes");
  const iUp = col_("updatedAt");

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
  sh.getRange(hitRow, iDp+1).setValue(next.decisionPoint);
  sh.getRange(hitRow, iDc+1).setValue(next.decisionCriteria);
  sh.getRange(hitRow, iTags+1).setValue(next.tags);
  sh.getRange(hitRow, iImp+1).setValue(next.importance);
  sh.getRange(hitRow, iSrcT+1).setValue(next.sourceType);
  sh.getRange(hitRow, iSrcR+1).setValue(next.sourceRef);
  sh.getRange(hitRow, iNotes+1).setValue(next.notes);
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