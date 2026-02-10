/** 30_CharterApi.gs
 * CharterPageから呼ばれる公開API担当。
 * チャーターデータ取得/保存、ファイルアップロードなど、Charter UIの「外向き関数」をまとめる。
 */
// ======================================================================
// Charter API
// ======================================================================
// ======================================================================
// Charter API (Lite/Extras split)
// ======================================================================

function getCharterData(payload) {
  const prof = _profStart_();
  _profMark_(prof, "start");

  payload = payload || {};
  const projectId = payload.projectId ? String(payload.projectId).trim() : "";
  const projectName = payload.projectName ? String(payload.projectName).trim() : "";

  // ★権限チェック
  if (!canAccessProject_(projectId)) {
    const resDenied = {
      apiName: "getCharterData",
      ok: false,
      message: "access denied",
      membersMaster: [],
      charter: {
        projectId: projectId || "",
        projectName: projectName || "",
        memo: "",
        charterJson: getDefaultCharterJson_(),
        members: [],
        pmMemberId: "",
        closerMemberId: ""
      },
      valuePlanFixed: null,
      valuePlanFixedError: "access denied",
      valuePlanDiag: { ok:false, projectId: projectId || "", error:"access denied" },
      saveLog: [],
      profile: prof.marks
    };
    _profMark_(prof, "deny");
    return _toWireSafe_(resDenied);
  }

  const lite = getCharterDataLite(payload);
  _profMark_(prof, "lite done");

  const ex = getCharterExtras(payload);
  _profMark_(prof, "extras done");

  // ★DB_Projects から pm/closer を取る（Charterで固定表示するため）
  function getPmCloserFromProjects_(pid){
    try{
      const sh = getSheet_("DB_Projects");
      // ★pm/closer 列を保証（なければ作られる）
      ensureHeader_(sh, [
        "projectId","projectName","clientName",
        "freeePartnerId","status","slackChannelId",
        "pmMemberId","closerMemberId",
        "updatedAt","createdAt"
      ]);

      const vals = sh.getDataRange().getValues();
      if (!vals || vals.length < 2) return { pmMemberId:"", closerMemberId:"" };

      const h = vals[0].map(x=>String(x||"").trim());
      const iPid = h.indexOf("projectId");
      const iPm = h.indexOf("pmMemberId");
      const iCloser = h.indexOf("closerMemberId");
      if (iPid < 0) return { pmMemberId:"", closerMemberId:"" };

      for (let r=1; r<vals.length; r++){
        const p = String(vals[r][iPid]||"").trim();
        if (p !== pid) continue;

        const pm = (iPm >= 0) ? String(vals[r][iPm]||"").trim() : "";
        const closer = (iCloser >= 0) ? String(vals[r][iCloser]||"").trim() : "";
        return { pmMemberId: pm, closerMemberId: closer };
      }
      return { pmMemberId:"", closerMemberId:"" };
    } catch(e){
      return { pmMemberId:"", closerMemberId:"" };
    }
  }

  const pc = projectId ? getPmCloserFromProjects_(projectId) : { pmMemberId:"", closerMemberId:"" };

  // ★charter を必ずオブジェクトとして返す（null混入でフロントが死ぬのを防ぐ）
  const charterBase = (lite && lite.charter && typeof lite.charter === "object")
    ? lite.charter
    : {
        projectId: projectId || "",
        projectName: projectName || "",
        memo: "",
        charterJson: getDefaultCharterJson_(),
        members: []
      };

  // ★固定の正をここへ注入
  charterBase.pmMemberId = String(pc.pmMemberId || "").trim();
  charterBase.closerMemberId = String(pc.closerMemberId || "").trim();

  const out = {
    apiName: "getCharterData",
    ok: !!(lite && lite.ok),
    message: String((lite && lite.message) || ""),
    membersMaster: (lite && lite.membersMaster) ? lite.membersMaster : [],
    charter: charterBase,

    // ★追加：取引先（freee）
    freeePartnerId: (lite && ("freeePartnerId" in lite)) ? lite.freeePartnerId : "",
    freeePartnerName: (lite && ("freeePartnerName" in lite)) ? lite.freeePartnerName : "",

    // ★Liteから必ず通す
    valuePlanFixed: (lite && ("valuePlanFixed" in lite)) ? lite.valuePlanFixed : null,
    valuePlanFixedError: (lite && ("valuePlanFixedError" in lite)) ? lite.valuePlanFixedError : "",
    valuePlanDiag: (lite && ("valuePlanDiag" in lite)) ? lite.valuePlanDiag : null,

    saveLog: (ex && ex.saveLog) ? ex.saveLog : [],
    profile: prof.marks.concat([
      { label: "lite.profile", ms: -1 },
      { label: "extras.profile", ms: -1 },
    ])
  };

  _profMark_(prof, "end");
  return _toWireSafe_(out);
}

/**
 * ★新：Charter Lite（最初に返す）
 * - membersMaster と charter 本体だけ
 * - saveLogは返さない（重い/不要）
 */
function getCharterDataLite(payload) {
  const prof = _profStart_();
  _profMark_(prof, "start");

  const defaultCharterJson = getDefaultCharterJson_();

  payload = payload || {};
  const projectId = payload.projectId ? String(payload.projectId).trim() : "";
  const projectName = payload.projectName ? String(payload.projectName).trim() : "";
  _profMark_(prof, "parse payload");

  // ★権限チェック
  if (!canAccessProject_(projectId)) {
    const resDenied = {
      apiName: "getCharterDataLite",
      ok: false,
      message: "access denied",
      membersMaster: [],
      charter: { projectId: projectId || "", projectName: projectName || "", memo: "", charterJson: defaultCharterJson, members: [] },
      valuePlanFixed: null,
      valuePlanFixedError: "access denied",
      valuePlanDiag: { ok:false, projectId: projectId || "", error:"access denied" },

      // ★追加：freee取引先（表示の唯一正）
      freeePartnerId: "",
      freeePartnerName: "",

      profile: prof.marks
    };
    _profMark_(prof, "deny");
    return _toWireSafe_(resDenied);
  }
  _profMark_(prof, "access check");

  if (!projectId) {
    const res0 = {
      apiName: "getCharterDataLite",
      ok: false,
      message: "projectId empty",
      membersMaster: [],
      charter: { projectId: "", projectName: "", memo: "", charterJson: defaultCharterJson, members: [] },
      valuePlanFixed: null,
      valuePlanFixedError: "projectId empty",
      valuePlanDiag: { ok:false, projectId:"", error:"projectId empty" },

      // ★追加：freee取引先（表示の唯一正）
      freeePartnerId: "",
      freeePartnerName: "",

      profile: prof.marks
    };
    _profMark_(prof, "return emptyPid");
    return _toWireSafe_(res0);
  }

  const membersMaster = listMembersMaster_();
  _profMark_(prof, "listMembersMaster_ done");

  const charter = loadCharter_(projectId, projectName, { noCache: !!payload.noCache });
  _profMark_(prof, "loadCharter_ done");
  // ★invoiceSendManual は DB_Projects が正本
  try{
    const sh = getSheet_("DB_Projects");
    ensureHeader_(sh, ["projectId","invoiceSendManual"]);

    const vals = sh.getDataRange().getValues();
    const h = vals[0].map(x=>String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iMan = h.indexOf("invoiceSendManual");

    let v = false;
    if (iPid >= 0 && iMan >= 0){
      for (let r=1; r<vals.length; r++){
        if (String(vals[r][iPid]||"").trim() === projectId){
          v = String(vals[r][iMan]||"").trim().toUpperCase() === "TRUE";
          break;
        }
      }
    }

    if (charter && typeof charter === "object") {
      charter.invoiceSendManual = !!v;
    }
  }catch(e){
    if (charter && typeof charter === "object") {
      charter.invoiceSendManual = false;
    }
  }


  // ★ValuePlan（確定済み）復元 + 診断
  let valuePlanFixed = null;
  let valuePlanFixedError = "";
  let valuePlanDiag = null;

  try{
    valuePlanFixed = charter_valuePlan_loadLatestFixedByProject(projectId);
  } catch(e){
    valuePlanFixed = null;
    valuePlanFixedError = String(e && (e.message || e));
  }

  try{
    valuePlanDiag = charter_valuePlan_debugLoadLatestFixed(projectId);
  } catch(e){
    valuePlanDiag = { ok:false, projectId: projectId, error: String(e && (e.message || e)) };
  }
  _profMark_(prof, "valuePlan done");

  // ★追加：freee取引先（表示の唯一正）
  let freeePartnerId = "";
  let freeePartnerName = "";
  try{
    if (typeof b_getFreeeProjectSettings_ === "function"){
      const s = b_getFreeeProjectSettings_(projectId);
      freeePartnerId = String((s && s.partnerId) || "").trim();
      freeePartnerName = String((s && s.partnerName) || "").trim();
    }
  } catch(e){
    freeePartnerId = "";
    freeePartnerName = "";
  }
  _profMark_(prof, "freee settings (partnerName)");

  const res = {
    apiName: "getCharterDataLite",
    ok: true,
    message: "",
    membersMaster: membersMaster.map(m => ({ memberId: m.memberId, codeName: m.codeName })),
    charter: charter,

    // ★これが必ず返る
    valuePlanFixed: valuePlanFixed,
    valuePlanFixedError: valuePlanFixedError,
    valuePlanDiag: valuePlanDiag,

    // ★追加：FEが表示に使う
    freeePartnerId: freeePartnerId,
    freeePartnerName: freeePartnerName,

    profile: prof.marks
  };

  _profMark_(prof, "end");
  return _toWireSafe_(res);
}

/**
 * ★新：Charter Extras（後から差し込む）
 * - saveLogだけ返す
 */
function getCharterExtras(payload) {
  const prof = _profStart_();
  _profMark_(prof, "start");

  payload = payload || {};
  const projectId = payload.projectId ? String(payload.projectId).trim() : "";
  const projectName = payload.projectName ? String(payload.projectName).trim() : "";

  // ★権限チェック
  if (!canAccessProject_(projectId)) {
    const resDenied = { ok:false, message:"access denied", saveLog:[], profile: prof.marks };
    _profMark_(prof, "deny");
    return _toWireSafe_(resDenied);
  }
  _profMark_(prof, "access check");

  if (!projectId) {
    const res0 = { ok:false, message:"projectId empty", saveLog:[], profile: prof.marks };
    _profMark_(prof, "return emptyPid");
    return _toWireSafe_(res0);
  }

  const saveLog = listCharterSaveLog_(projectId);
  _profMark_(prof, "listCharterSaveLog_ done");

  const res = { ok:true, message:"", saveLog: saveLog, profile: prof.marks };
  _profMark_(prof, "end");
  return _toWireSafe_(res);
}

function charter_valuePlan_loadLatestFixedByProject(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return null;

  const ss = charter_valuePlan_getNavigatorSpreadsheet();

  // ★正本シート名に合わせる
  const shC = ss.getSheetByName("DB_ValuePlanCycles");
  const shM = ss.getSheetByName("DB_ValueMilestones"); // ←ここが肝

  if (!shC || !shM) return null;

  // --- Cycles header index ---
  const hc = shC.getRange(1,1,1,shC.getLastColumn()).getValues()[0].map(x => String(x||"").trim());
  const idxC = charter_valuePlan_makeIndex(hc);

  const needC = ["planCycleId","projectId","periodStartYm","periodEndYm","budgetYen","totalPoints","status","fixedVersion","fixedAt","fixedBy","updatedAt"];
  for (let i=0;i<needC.length;i++){
    if (idxC[needC[i]] === undefined) return null;
  }

  const lastRowC = shC.getLastRow();
  if (lastRowC < 2) return null;

  const vc = shC.getRange(2,1,lastRowC-1,shC.getLastColumn()).getValues();

  let best = null;
  let bestTime = -1;
  for (let r=0;r<vc.length;r++){
    const row = vc[r];
    if (String(row[idxC.projectId]||"").trim() !== projectId) continue;

    // ★statusは堅く（空白/大文字小文字に耐える）
    const st = String(row[idxC.status]||"").trim().toLowerCase();
    if (st !== "fixed") continue;

    const fixedAt = String(row[idxC.fixedAt]||"").trim();
    const updatedAt = String(row[idxC.updatedAt]||"").trim();
    const t = charter_valuePlan_parseTimeMs(fixedAt) || charter_valuePlan_parseTimeMs(updatedAt) || 0;

    if (!best || t > bestTime){
      best = row;
      bestTime = t;
    }
  }
  if (!best) return null;

  const planCycleId = String(best[idxC.planCycleId]||"").trim();
  const version = Number(best[idxC.fixedVersion]||0);

  const meta = {
    planCycleId,
    projectId,
    periodStartYm: String(best[idxC.periodStartYm]||"").trim(),
    periodEndYm: String(best[idxC.periodEndYm]||"").trim(),
    budgetYen: Number(best[idxC.budgetYen]||0),
    totalPoints: Number(best[idxC.totalPoints]||0),
    status: "fixed",
    version: version,
    fixedAt: String(best[idxC.fixedAt]||"").trim(),
    fixedBy: String(best[idxC.fixedBy]||"").trim(),
    updatedAt: String(best[idxC.updatedAt]||"").trim()
  };

  // --- Milestones header index ---
  const hm = shM.getRange(1,1,1,shM.getLastColumn()).getValues()[0].map(x => String(x||"").trim());
  const idxM = charter_valuePlan_makeIndex(hm);

  // ★DB_ValueMilestones のヘッダに合わせる（orderNo/title/points/isActive はあったはず）
  const needM = ["planCycleId","version","orderNo","title","points","isActive","updatedAt"];
  for (let i=0;i<needM.length;i++){
    if (idxM[needM[i]] === undefined) return { ...meta, milestones: [] };
  }

  const lastRowM = shM.getLastRow();
  if (lastRowM < 2) return { ...meta, milestones: [] };

  const vm = shM.getRange(2,1,lastRowM-1,shM.getLastColumn()).getValues();

  const milestones = vm
    .filter(row =>
      String(row[idxM.planCycleId]||"").trim() === planCycleId &&
      Number(row[idxM.version]||0) === version &&
      String(row[idxM.isActive]||"").toUpperCase().trim() === "TRUE"
    )
    .map(row => ({
      orderNo: Number(row[idxM.orderNo]||0),
      title: String(row[idxM.title]||"").trim(),
      points: Number(row[idxM.points]||0),
      // ★tag列が無い前提（タイトル末尾 (buffer) で運用）
      tag: /\(buffer\)/i.test(String(row[idxM.title]||"")) ? "buffer" : "normal",
      updatedAt: String(row[idxM.updatedAt]||"").trim()
    }))
    .sort((a,b) => (a.orderNo||0) - (b.orderNo||0));

  return { ...meta, milestones };
}

function charter_valuePlan_debug(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok:false, message:"projectId empty" };

  const out = {
    ok: true,
    projectId,
    navigatorSpreadsheetId: String(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim(),
    sheets: {},
    cycleRows: 0,
    hitFixedRows: 0,
    sample: null,
    error: ""
  };

  try{
    const ss = charter_valuePlan_getNavigatorSpreadsheet();
    const shC = ss.getSheetByName("DB_ValuePlanCycles");
    const shM = ss.getSheetByName("DB_ValueMilestones");

    out.sheets.DB_ValuePlanCycles = !!shC;
    out.sheets.DB_ValueMilestones = !!shM;

    if (!shC) return out;

    const lastRowC = shC.getLastRow();
    out.cycleRows = lastRowC;

    if (lastRowC < 2) return out;

    const hc = shC.getRange(1,1,1,shC.getLastColumn()).getValues()[0].map(x => String(x||"").trim());
    const idx = charter_valuePlan_makeIndex(hc);

    const need = ["planCycleId","projectId","status","fixedVersion","fixedAt","updatedAt"];
    for (let i=0;i<need.length;i++){
      if (idx[need[i]] === undefined){
        out.error = "cycles header missing: " + need[i];
        return out;
      }
    }

    const vc = shC.getRange(2,1,lastRowC-1,shC.getLastColumn()).getValues();
    const hits = vc.filter(row =>
      String(row[idx.projectId]||"").trim() === projectId &&
      String(row[idx.status]||"").trim() === "fixed"
    );

    out.hitFixedRows = hits.length;
    if (hits.length){
      const r0 = hits[0];
      out.sample = {
        planCycleId: String(r0[idx.planCycleId]||"").trim(),
        status: String(r0[idx.status]||"").trim(),
        fixedVersion: Number(r0[idx.fixedVersion]||0),
        fixedAt: String(r0[idx.fixedAt]||"").trim(),
        updatedAt: String(r0[idx.updatedAt]||"").trim()
      };
    }

    return out;
  } catch(e){
    out.ok = false;
    out.error = String(e && (e.message || e));
    return out;
  }
}

function charter_valuePlan_debug_p11(){
  return charter_valuePlan_debug({ projectId: "p11" });
}


function charter_valuePlan_getNavigatorSpreadsheet(){
  const id = String(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim();
  if (!id) throw new Error("NAVIGATOR_SPREADSHEET_ID not set");
  return SpreadsheetApp.openById(id);
}

function charter_valuePlan_makeIndex(headerRow){
  const idx = {};
  for (let i=0;i<headerRow.length;i++){
    const k = String(headerRow[i]||"").trim();
    if (k && idx[k] === undefined) idx[k] = i;
  }
  return idx;
}

function charter_valuePlan_parseTimeMs(s){
  s = String(s||"").trim();
  if (!s) return 0;
  const d = new Date(s);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

/** ★GAS→HTML返却用：JSONに落としてワイヤ安全にする */
function _toWireSafe_(obj){
  try { return JSON.parse(JSON.stringify(obj)); }
  catch(e){ return { ok:false, message:"toWireSafe failed: " + String(e && (e.message||e)) }; }
}

function saveCharter(charter) {
  if (!charter) throw new Error("saveCharter: charter is required");

  const projectId = String(charter.projectId || "").trim();
  const projectName = String(charter.projectName || "").trim();

  // ★権限チェック
  if (!canAccessProject_(projectId)) {
    throw new Error("access denied");
  }

  const memo = String(charter.memo || "");
  const members = Array.isArray(charter.members) ? charter.members : [];

  const charterJsonObj = (charter.charterJson && typeof charter.charterJson === "object")
    ? charter.charterJson
    : getDefaultCharterJson_();

  if (!projectId) throw new Error("saveCharter: projectId is required");
  if (!projectName) throw new Error("saveCharter: projectName is required");

  const now = new Date();

  // ★before snapshot
  const beforeSnap = getCharterSnapshot_(projectId);

  const normalized = normalizeMembersServer_(members);

  // 実保存
  upsertProjectCharter_(projectId, projectName, memo, charterJsonObj, now);
  replaceProjectMembers_(projectId, projectName, normalized, now);

  // ★追加：PMをDB_Projects.pmMemberIdへ同期（admin限定にしない）
  try{
    const pmMemberId = String(((normalized.find(m => m && m.isPM) || {}).memberId) || "").trim();
    if (pmMemberId) {
      charter_syncPmMemberIdToProjects_(projectId, projectName, pmMemberId, now);
    } else {
      // ここは上書きしない（事故回避）
    }
  } catch(e){}

  // ★請求書送付先＆ルール（adminだけ）
  const operatorEmail = Session.getActiveUser().getEmail();
  if (isAdmin_()) {
    updateProjectInvoiceRecipients_({
      projectId,
      invoiceToName: String(charter.invoiceToName || ""),
      invoiceToEmails: String(charter.invoiceToEmails || ""),
      invoiceCcEmails: String(charter.invoiceCcEmails || ""),
      invoiceBccEmails: String(charter.invoiceBccEmails || ""),
      invoiceSendDeadlineRule: String(charter.invoiceSendDeadlineRule || ""),
      paymentDueRule: String(charter.paymentDueRule || ""),
    });

    // ★追加：手動送信フラグ（PJ固定）
    try{
      const sh = getSheet_("DB_Projects");
      ensureHeader_(sh, ["projectId","invoiceSendManual","updatedAt"]);

      const vals = sh.getDataRange().getValues();
      if (vals && vals.length >= 2){
        const h = vals[0].map(x => String(x||"").trim());
        const iPid = h.indexOf("projectId");
        const iMan = h.indexOf("invoiceSendManual");
        const iUpd = h.indexOf("updatedAt");

        if (iPid >= 0 && iMan >= 0){
          let hitRow = -1;
          for (let r=1; r<vals.length; r++){
            if (String(vals[r][iPid]||"").trim() === projectId){
              hitRow = r + 1; // 1-indexed row number
              break;
            }
          }

          const v = !!charter.invoiceSendManual;
          if (hitRow > 0){
            sh.getRange(hitRow, iMan+1).setValue(v ? "TRUE" : "FALSE");
            if (iUpd >= 0){
              sh.getRange(hitRow, iUpd+1).setValue(Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX"));
            }
          }
        }
      }
    } catch(e){}

    // PJステータス（adminだけ）
    const nextStatus = String(charter.projectStatus || "").trim();
    if (nextStatus) {
      updateProjectStatusByProjectId_(projectId, nextStatus);
    }
  }

  // ★after snapshot
  const afterSnap = {
    memo: memo,
    members: normalized,
    charterJson: charterJsonObj,
    invoiceSendDeadlineRule: String(charter.invoiceSendDeadlineRule || ""),
    paymentDueRule: String(charter.paymentDueRule || ""),
    invoiceSendManual: !!charter.invoiceSendManual
  };

  const changeSummary = buildCharterChangeSummary_(beforeSnap, afterSnap);

  // ★変更がないならログは残さない
  const summary = String(changeSummary || "").trim();
  if (summary) {
    appendCharterSaveLogV2_(projectId, projectName, normalized, now, summary, operatorEmail);
  }

  // ★savedAtはISO(+09:00)
  const savedAtIso = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");

  // ★追加：保存後の saveLog を返す
  let saveLog = [];
  try{
    saveLog = listCharterSaveLog_(projectId);
  } catch(e){
    saveLog = [];
  }

  // ★保存後：関連キャッシュ破棄
  try{
    const cache = CacheService.getScriptCache();
    cache.remove("charterData_v2:" + projectId);
    cache.remove("charterSaveLog_v2:" + projectId);
    cache.remove("membersMaster_v2");
  } catch(e){}

  return {
    ok: true,
    savedAt: savedAtIso,
    membersCount: normalized.length,
    changed: !!summary,
    saveLog: saveLog
  };
}

function uploadCharterFile(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const projectName = String(payload.projectName || "").trim();

  // ★権限チェック（ここが肝）
  if (!canAccessProject_(projectId)) {
    throw new Error("access denied");
  }

  const fileName = String(payload.fileName || "contract.pdf").trim();
  const mimeType = String(payload.mimeType || "application/pdf").trim();
  const base64 = String(payload.base64 || "").trim();

  if (!projectId) throw new Error("uploadCharterFile: projectId empty");
  if (!projectName) throw new Error("uploadCharterFile: projectName empty");
  if (!base64) throw new Error("uploadCharterFile: base64 empty");

  const b64 = base64.includes(",") ? base64.split(",").pop() : base64;
  const bytes = Utilities.base64Decode(b64);

  const stampedName = `契約書_押印済_${projectId}_${fileName}`;
  const blob = Utilities.newBlob(bytes, mimeType, stampedName);

  // ★保存先フォルダ固定
  const folderId = "1Nnebu1ptt1YlX0N9g69X2CCeSOLS837l";
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob).setName(stampedName);

  const url = file.getUrl();
  const id = file.getId();
  const uploadedAt = new Date().toISOString();

  const charterSh = getSheet_("DB_ProjectCharter");
  ensureHeader_(charterSh, ["projectId","projectName","memo","charterJson","updatedAt"]);

  const row = findRowByKey_(charterSh, "projectId", projectId);
  const cur = row ? safeJsonParse_(row.charterJson, getDefaultCharterJson_()) : getDefaultCharterJson_();

  cur.contract = cur.contract || {};
  cur.contract.signedPdf = { fileId: id, url, fileName: stampedName, uploadedAt };

  const memo = row ? String(row.memo || "") : "";
  upsertProjectCharter_(projectId, projectName, memo, cur, new Date());

  return { ok:true, fileId:id, url, fileName: stampedName, uploadedAt };
}

function charter_valuePlan_debugLoadLatestFixed(projectId){
  projectId = String(projectId || "").trim();
  const out = {
    ok: true,
    projectId,
    navigatorSpreadsheetId: String(PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID") || "").trim(),
    sheets: {},
    cycles: { rows: 0, fixedHits: 0, sample: null },
    milestones: { rows: 0, hits: 0 },
    error: ""
  };

  try{
    const ss = charter_valuePlan_getNavigatorSpreadsheet();

    const shC = ss.getSheetByName("DB_ValuePlanCycles");
    const shM = ss.getSheetByName("DB_ValueMilestones");
    out.sheets.DB_ValuePlanCycles = !!shC;
    out.sheets.DB_ValueMilestones = !!shM;

    if (!shC){
      out.error = "DB_ValuePlanCycles not found";
      return out;
    }

    const lastRowC = shC.getLastRow();
    out.cycles.rows = lastRowC;
    if (lastRowC < 2) return out;

    const hc = shC.getRange(1,1,1,shC.getLastColumn()).getValues()[0].map(x => String(x||"").trim());
    const idxC = charter_valuePlan_makeIndex(hc);

    const needC = ["planCycleId","projectId","status","fixedVersion","fixedAt","updatedAt"];
    for (let i=0;i<needC.length;i++){
      if (idxC[needC[i]] === undefined){
        out.error = "cycles header missing: " + needC[i];
        return out;
      }
    }

    const vc = shC.getRange(2,1,lastRowC-1,shC.getLastColumn()).getValues();

    const hits = vc.filter(row =>
      String(row[idxC.projectId]||"").trim() === projectId &&
      String(row[idxC.status]||"").trim() === "fixed"
    );

    out.cycles.fixedHits = hits.length;
    if (hits.length){
      const r0 = hits[0];
      out.cycles.sample = {
        planCycleId: String(r0[idxC.planCycleId]||"").trim(),
        status: String(r0[idxC.status]||"").trim(),
        fixedVersion: Number(r0[idxC.fixedVersion]||0),
        fixedAt: String(r0[idxC.fixedAt]||"").trim(),
        updatedAt: String(r0[idxC.updatedAt]||"").trim()
      };
    }

    if (!shM){
      out.error = out.error || "DB_ValueMilestones not found";
      return out;
    }

    const lastRowM = shM.getLastRow();
    out.milestones.rows = lastRowM;
    if (lastRowM < 2) return out;

    const hm = shM.getRange(1,1,1,shM.getLastColumn()).getValues()[0].map(x => String(x||"").trim());
    const idxM = charter_valuePlan_makeIndex(hm);
    const needM = ["planCycleId","version","isActive"];
    for (let i=0;i<needM.length;i++){
      if (idxM[needM[i]] === undefined){
        out.error = "milestones header missing: " + needM[i];
        return out;
      }
    }

    // cycles sampleがあるときだけ milestones ヒットも見る
    if (out.cycles.sample){
      const planCycleId = out.cycles.sample.planCycleId;
      const version = Number(out.cycles.sample.fixedVersion || 0);

      const vm = shM.getRange(2,1,lastRowM-1,shM.getLastColumn()).getValues();
      const mh = vm.filter(row =>
        String(row[idxM.planCycleId]||"").trim() === planCycleId &&
        Number(row[idxM.version]||0) === version &&
        String(row[idxM.isActive]||"").toUpperCase().trim() === "TRUE"
      );
      out.milestones.hits = mh.length;
    }

    return out;
  } catch(e){
    out.ok = false;
    out.error = String(e && (e.message || e));
    return out;
  }
}
