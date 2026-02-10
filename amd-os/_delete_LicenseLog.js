/**
 * LicenseActionLog に1行追記する
 *
 * @param {Object} p
 * @param {string} p.memberId
 * @param {string} [p.memberName]
 * @param {string} p.system               // 'slack' | 'google'
 * @param {string} p.actionType           // 'WARN' | 'SCHEDULE' | 'REMOVE' | 'RESTORE' | ...
 * @param {string} [p.fromState]
 * @param {string} [p.toState]
 * @param {number} [p.inactiveDays]
 * @param {string} [p.policyId]           // 例: 'DEFAULT_V1'
 * @param {string} p.actorType            // 'system' | 'manual'
 * @param {string} p.actorId              // 'SYSTEM' or memberId
 * @param {string} [p.notificationChannel] // 'slack_dm' | 'email' | 'none'
 * @param {string} [p.notificationMessageId] // Slack ts など
 * @param {string} [p.reasonCode]
 * @param {string} [p.reasonNote]
 * @param {Object} [p.payload]            // 任意の詳細(JSON)
 *
 * @returns {Object} writtenRow
 */
/*
function logLicenseAction_(p) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('DB_LicenseActionLog');
  if (!sh) throw new Error('DB_LicenseActionLog シートが見つからない');

  const table = readTableWithHeader_(sh); // ヘッダ対応で追記
  const now = new Date();

  const rowObj = {
    actionAt: now,
    memberId: p.memberId || '',
    memberName: p.memberName || '',
    system: p.system || '',
    actionType: p.actionType || '',
    fromState: p.fromState || '',
    toState: p.toState || '',
    inactiveDays: (p.inactiveDays === 0 || p.inactiveDays) ? Number(p.inactiveDays) : '',
    policyId: p.policyId || '',
    actorType: p.actorType || '',
    actorId: p.actorId || '',
    notificationChannel: p.notificationChannel || 'none',
    notificationMessageId: p.notificationMessageId || '',
    reasonCode: p.reasonCode || '',
    reasonNote: p.reasonNote || '',
    payloadJson: p.payload ? JSON.stringify(p.payload) : '',
  };

  appendRowByHeaders_(sh, table.headers, rowObj);
  return rowObj;
}

// ヘッダ付きテーブル読み込み（既存のreadTable_と違って「ヘッダ名=列」の前提で扱えるようにする）
function readTableWithHeader_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] || []).map(h => String(h).trim());
  return { headers };
}


// headers順に1行append（存在しないキーは空）

function appendRowByHeaders_(sheet, headers, obj) {
  const row = headers.map(h => (obj[h] === undefined ? '' : obj[h]));
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

function admin_rejectProtocolCandidate_(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied" };
  payload = payload || {};
  const candidateId = String(payload.candidateId || "").trim();
  if (!candidateId) return { ok:false, message:"candidateId empty" };

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing" };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_ProtocolCandidates");
  if (!sh) return { ok:false, message:"DB_ProtocolCandidates missing" };

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:false, message:"no candidates" };

  const vals = sh.getRange(1,1,lastRow,lastCol).getValues();
  const header = vals[0].map(x=>String(x||"").trim());
  const idx = {};
  header.forEach((h,i)=>{ if(h) idx[h]=i; });

  const iId = idx["candidateId"];
  const iStatus = idx["status"];
  const iUpd = idx["updatedAt"];
  if (iId === undefined || iStatus === undefined || iUpd === undefined){
    return { ok:false, message:"DB_ProtocolCandidates missing required columns" };
  }

  let hitRow = -1;
  for (let r=1; r<vals.length; r++){
    if (String(vals[r][iId]||"").trim() === candidateId){
      hitRow = r + 1;
      break;
    }
  }
  if (hitRow < 2) return { ok:false, message:"candidate not found" };

  const nowIso = _nowIsoJst_();
  sh.getRange(hitRow, iStatus+1).setValue("rejected");
  sh.getRange(hitRow, iUpd+1).setValue(nowIso);

  return { ok:true, candidateId: candidateId };
}

// public wrapper
function admin_rejectProtocolCandidate(payload){
  return admin_rejectProtocolCandidate_(payload);
}

function admin_listProtocolCandidates_(payload){
  if (!canAccessAdminPage_()) return { ok:false, message:"access denied", candidates:[], meta:{} };

  payload = payload || {};
  const status = String(payload.status || "").trim().toLowerCase(); // new / rejected / promoted / (empty=all)
  const pageId = String(payload.pageId || "").trim();
  const q = String(payload.q || "").trim().toLowerCase();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 200;

  const storeId = String(PropertiesService.getScriptProperties().getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
  if (!storeId) return { ok:false, message:"PROTOCOL_STORE_SPREADSHEET_ID missing", candidates:[], meta:{} };

  const ss = SpreadsheetApp.openById(storeId);
  const sh = ss.getSheetByName("DB_ProtocolCandidates");
  if (!sh) return { ok:true, candidates:[], meta:{ rows:0 } };

  // ★同期状態（最新runIdをUIに渡す）
  let sync = { lastRunId:"", lastSyncIso:"", updatedAt:"" };
  try{ sync = _pc_getSyncState_(storeId) || sync; } catch(e){}

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, candidates:[], meta:{ rows:0, lastRunId: sync.lastRunId || "", lastSyncIso: sync.lastSyncIso || "" } };

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

    const branchPoint = s_(get_(row,"branchPoint"));
    const criteria = s_(get_(row,"criteria"));
    const decision = s_(get_(row,"decision"));
    const confidence = s_(get_(row,"confidence"));
    const evidenceJson = s_(get_(row,"evidenceJson"));

    if (q){
      const hay = (branchPoint + "\n" + criteria + "\n" + decision + "\n" + evidenceJson).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    let suggestedProjectId = s_(get_(row,"suggestedProjectId"));
    let suggestedProjectName = s_(get_(row,"suggestedProjectName"));

    // ★FALLBACK: 空なら unknown に寄せてUIが死なないようにする
    if (!suggestedProjectId) suggestedProjectId = "unknown";
    if (!suggestedProjectName && suggestedProjectId === "unknown") suggestedProjectName = "unknown";

    out.push({
      candidateId: candId,
      candidateKey: s_(get_(row,"candidateKey")),
      sourceType: s_(get_(row,"sourceType")),
      sourcePageId: pid,
      sourceLastEditedAt: s_(get_(row,"sourceLastEditedAt")),

      suggestedProjectId,
      suggestedProjectName,
      suggestedTags: s_(get_(row,"suggestedTags")),

      branchPoint,
      criteria,
      optionsJson: s_(get_(row,"optionsJson")),
      decision,
      evidenceJson,
      confidence,
      status: st,
      promotedProtocolId: s_(get_(row,"promotedProtocolId")),
      runId: s_(get_(row,"runId")),
      createdAt: s_(get_(row,"createdAt")),
      updatedAt: s_(get_(row,"updatedAt"))
    });

    if (limit > 0 && out.length >= limit) break;
  }

  // createdAt desc
  out.sort((a,b)=> String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

  return {
    ok:true,
    candidates: out,
    meta:{
      rows: out.length,
      lastRunId: String(sync.lastRunId || ""),
      lastSyncIso: String(sync.lastSyncIso || ""),
      stateUpdatedAt: String(sync.updatedAt || "")
    }
  };
}

function _normPjLabel_(s){
  let x = String(s||"").trim();

  // 絵文字(だいたい) + variation selector を落とす
  x = x.replace(/[\u{1F000}-\u{1FAFF}]/gu, "");
  x = x.replace(/[\u{2600}-\u{27BF}]/gu, "");
  x = x.replace(/[\uFE0E\uFE0F]/g, ""); // VS

  // 飾りや余計な記号
  x = x.replace(/[【】\[\]\(\)（）]/g, " ");
  x = x.replace(/^PJ[:：]\s* /i, ""); ←使うならあとで*のあとのスペースを消す
  x = x.replace(/\s+/g, "");

  return x.toUpperCase();
}

function _inferProjectFromLabel_(label, projects){
  const key = _normPjLabel_(label);
  if (!key) return { projectId:"unknown", projectName:"unknown", confidence:0 };

  // projects: [{projectId, projectName}]
  const mapByName = Object.create(null);
  (projects||[]).forEach(p=>{
    const name = _normPjLabel_(p.projectName);
    if (name) mapByName[name] = p;
  });

  if (mapByName[key]){
    const p = mapByName[key];
    return { projectId:String(p.projectId||""), projectName:String(p.projectName||""), confidence:1.0 };
  }

  // 部分一致も一応（例: "ZMP定例" みたいな事故）
  for (const k in mapByName){
    if (key.includes(k) || k.includes(key)){
      const p = mapByName[k];
      return { projectId:String(p.projectId||""), projectName:String(p.projectName||""), confidence:0.8 };
    }
  }

  return { projectId:"unknown", projectName:"unknown", confidence:0.2 };
}

*/
