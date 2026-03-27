/** 31_CharterRepo.gs
 * Charter機能の内部実装（Repo）担当。
 * DB_ProjectCharter/DB_ProjectMembers/DB_CharterSaveLogの読み書き、差分サマリ、保存ログ生成を扱う。
 */
// ======================================================================
// Charter internals
// ======================================================================
// ★1実行内キャッシュ
// ★1実行内キャッシュ（保険）
// ★1実行内キャッシュ
let __MEMBERS_MASTER_CACHE__ = null;
function listMembersMaster_() {
  // L1: in-execution cache
  if (Array.isArray(__MEMBERS_MASTER_CACHE__)) return __MEMBERS_MASTER_CACHE__;

  // L2: short cache（任意：揺れが嫌なら使う）
  const cache = CacheService.getScriptCache();
  const cacheKey = "membersMaster_rect_v1";
  try{
    const cached = cache.get(cacheKey);
    if (cached) {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr)) {
        __MEMBERS_MASTER_CACHE__ = arr;
        return arr;
      }
    }
  } catch(e){}

  const sh = getSheet_("DB_Members");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    __MEMBERS_MASTER_CACHE__ = [];
    return __MEMBERS_MASTER_CACHE__;
  }

  // ヘッダ取得
  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  function idx_(name){ return header.indexOf(name); }

  const iMemberId = idx_("memberId");
  const iCodeName = idx_("codeName");
  const iStatus   = idx_("status");     // 任意
  const iMemberName = idx_("memberName"); // 任意

  if (iMemberId < 0 || iCodeName < 0) {
    throw new Error("DB_Members header must include: memberId, codeName");
  }

  // ★必要列の「最小〜最大」だけを一括で読む（Rangeアクセス1回）
  const cols = [iMemberId, iCodeName, iStatus, iMemberName].filter(i => i >= 0);
  const minC = Math.min.apply(null, cols);
  const maxC = Math.max.apply(null, cols);

  const n = lastRow - 1; // data rows
  const block = sh.getRange(2, minC+1, n, (maxC-minC+1)).getValues();

  // block内の相対index
  const rMemberId = iMemberId - minC;
  const rCodeName = iCodeName - minC;
  const rStatus   = (iStatus>=0) ? (iStatus - minC) : -1;
  const rMemberName = (iMemberName>=0) ? (iMemberName - minC) : -1;

  function isInactiveByStatus_(v){
    const s = String(v||"").trim().toLowerCase();
    if (!s) return false;
    return (s === "inactive" || s === "disabled" || s === "off");
  }

  const out = [];
  for (let r=0; r<block.length; r++){
    const row = block[r];

    const memberId = String(row[rMemberId]||"").trim();
    if (!memberId) continue;

    if (rStatus >= 0 && isInactiveByStatus_(row[rStatus])) continue;

    const codeName = String(row[rCodeName]||"").trim() || memberId;
    const memberName = (rMemberName >= 0) ? String(row[rMemberName]||"").trim() : "";

    out.push({
      memberId,
      codeName,
      memberName: memberName || codeName,
      email: "" // CharterのmembersMasterでは不要
    });
  }

  out.sort((a,b) => (a.codeName || "").localeCompare((b.codeName || ""), "ja"));

  __MEMBERS_MASTER_CACHE__ = out;

  // 10分キャッシュ（揺れ軽減）
  try{ cache.put(cacheKey, JSON.stringify(out), 600); } catch(e){}

  return out;
}
function loadCharter_(projectId, projectName, opt) {
  projectId = String(projectId || "").trim();
  projectName = String(projectName || "").trim();
  opt = opt || {};

  const noCache = !!opt.noCache;

  const cache = CacheService.getScriptCache();
  const cacheKey = "charterData_v2:" + projectId;

  if (!noCache){
    try{
      const cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch(e){}
  }

  const charterSh = getSheet_("DB_ProjectCharter");
  ensureHeader_(charterSh, ["projectId","projectName","memo","charterJson","updatedAt"]);

  const membersSh = getSheet_("DB_ProjectMembers");
  ensureHeader_(membersSh, ["projectId","memberId","roleLabel","isCloser","isPM","updatedAt"]);

  let memo = "";
  let savedProjectName = projectName;
  let charterJsonStr = "";

  (function(){
    const lastRow = charterSh.getLastRow();
    const lastCol = charterSh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return;

    const header = charterSh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
    const iPid = header.indexOf("projectId");
    const iPn  = header.indexOf("projectName");
    const iMemo= header.indexOf("memo");
    const iJson= header.indexOf("charterJson");
    if (iPid < 0) return;

    const pidCol = charterSh.getRange(2, iPid+1, lastRow-1, 1);
    const hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();
    if (!hits || !hits.length) return;

    const rowNo = hits[hits.length - 1].getRow();
    const row = charterSh.getRange(rowNo, 1, 1, lastCol).getValues()[0];

    if (iPn >= 0) savedProjectName = String(row[iPn] || "").trim() || savedProjectName || "";
    if (iMemo >= 0) memo = String(row[iMemo] || "");
    if (iJson >= 0) charterJsonStr = String(row[iJson] || "");
  })();

  const assigned = listProjectMembers_(membersSh, projectId);

  const charterObj = safeJsonParse_(charterJsonStr, getDefaultCharterJson_());

  const pj = (function(){
    const out = {
      clientName: "",
      freeePartnerId: "",
      clientLocked: "",
      invoiceToName:"", invoiceToEmails:"", invoiceCcEmails:"", invoiceBccEmails:"",
      invoiceSendDeadlineRule:"", paymentDueRule:"",
      status:"draft"
    };

    try{
      const sh = getSheet_("DB_Projects");
      ensureHeader_(sh, [
        "projectId","projectName","clientName","status","notes","createdAt","updatedAt",
        "freeePartnerId","clientLocked",
        "invoiceToName","invoiceToEmails","invoiceCcEmails","invoiceBccEmails",
        "invoiceSendDeadlineRule","paymentDueRule"
      ]);

      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return out;

      const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());
      const iPid = header.indexOf("projectId");
      if (iPid < 0) return out;

      const iClientName = header.indexOf("clientName");
      const iFreeePid   = header.indexOf("freeePartnerId");
      const iLocked     = header.indexOf("clientLocked");
      const iStatus = header.indexOf("status");
      const iToName = header.indexOf("invoiceToName");
      const iTo = header.indexOf("invoiceToEmails");
      const iCc = header.indexOf("invoiceCcEmails");
      const iBcc = header.indexOf("invoiceBccEmails");
      const iSendDeadline = header.indexOf("invoiceSendDeadlineRule");
      const iPayDue = header.indexOf("paymentDueRule");

      const pidCol = sh.getRange(2, iPid+1, lastRow-1, 1);
      const hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();
      if (!hits || !hits.length) return out;

      const rowNo = hits[hits.length - 1].getRow();
      const row = sh.getRange(rowNo, 1, 1, lastCol).getValues()[0];

      out.clientName = (iClientName>=0) ? String(row[iClientName]||"").trim() : "";
      out.freeePartnerId = (iFreeePid>=0) ? String(row[iFreeePid]||"").trim() : "";
      out.clientLocked = (iLocked>=0) ? String(row[iLocked]||"").trim() : "";
      out.status = (iStatus>=0) ? String(row[iStatus]||"").trim() : "draft";
      out.invoiceToName = (iToName>=0) ? String(row[iToName]||"") : "";
      out.invoiceToEmails = (iTo>=0) ? String(row[iTo]||"") : "";
      out.invoiceCcEmails = (iCc>=0) ? String(row[iCc]||"") : "";
      out.invoiceBccEmails = (iBcc>=0) ? String(row[iBcc]||"") : "";
      out.invoiceSendDeadlineRule = (iSendDeadline>=0) ? String(row[iSendDeadline]||"") : "";
      out.paymentDueRule = (iPayDue>=0) ? String(row[iPayDue]||"") : "";
    } catch(e){}
    return out;
  })();

  const result = {
    projectId,
    projectName: savedProjectName || "",
    memo,
    charterJson: charterObj,
    members: assigned,

    projectStatus: pj.status || "draft",

    clientName: pj.clientName || "",
    freeePartnerId: pj.freeePartnerId || "",
    clientLocked: pj.clientLocked || "",

    invoiceToName: pj.invoiceToName,
    invoiceToEmails: pj.invoiceToEmails,
    invoiceCcEmails: pj.invoiceCcEmails,
    invoiceBccEmails: pj.invoiceBccEmails,

    invoiceSendDeadlineRule: pj.invoiceSendDeadlineRule,
    paymentDueRule: pj.paymentDueRule
  };

  if (!noCache){
    try{
      cache.put(cacheKey, JSON.stringify(result), 30);
    } catch(e){}
  }

  return result;
}

function upsertProjectCharter_(projectId, projectName, memo, charterJsonObj, now) {
  const sh = getSheet_("DB_ProjectCharter");
  const header = ensureHeader_(sh, ["projectId","projectName","memo","charterJson","updatedAt"]);

  const idxProjectId = header.indexOf("projectId");
  const idxProjectName = header.indexOf("projectName");
  const idxMemo = header.indexOf("memo");
  const idxCharterJson = header.indexOf("charterJson");
  const idxUpdatedAt = header.indexOf("updatedAt");

  const charterJsonStr = JSON.stringify(charterJsonObj || getDefaultCharterJson_());

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    // ヘッダ順で入れる（将来の列追加でも壊れない）
    const row = new Array(header.length).fill("");
    row[idxProjectId] = projectId;
    row[idxProjectName] = projectName;
    row[idxMemo] = memo;
    row[idxCharterJson] = charterJsonStr;
    row[idxUpdatedAt] = now;
    sh.appendRow(row);
    return;
  }

  const range = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn());
  const values = range.getValues();

  let hitRow = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][idxProjectId]) === projectId) {
      hitRow = i + 2;
      break;
    }
  }

  if (hitRow === -1) {
    const row = new Array(header.length).fill("");
    row[idxProjectId] = projectId;
    row[idxProjectName] = projectName;
    row[idxMemo] = memo;
    row[idxCharterJson] = charterJsonStr;
    row[idxUpdatedAt] = now;
    sh.appendRow(row);
  } else {
    sh.getRange(hitRow, idxProjectName + 1).setValue(projectName);
    sh.getRange(hitRow, idxMemo + 1).setValue(memo);
    sh.getRange(hitRow, idxCharterJson + 1).setValue(charterJsonStr);
    sh.getRange(hitRow, idxUpdatedAt + 1).setValue(now);
  }
}
function listProjectMembers_(membersSh, projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  const lastRow = membersSh.getLastRow();
  const lastCol = membersSh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  // ヘッダ取得
  const header = membersSh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  function idx_(name){ return header.indexOf(name); }

  const iPid = idx_("projectId");
  const iMid = idx_("memberId");
  const iRole= idx_("roleLabel");
  const iCloser = idx_("isCloser");
  const iPM = idx_("isPM");
  const iActive = idx_("isActive"); // あれば使う

  if (iPid < 0 || iMid < 0) return [];

  const n = lastRow - 1;

  // ★projectId列だけ先に読む（1列）
  const pidCol = membersSh.getRange(2, iPid+1, n, 1).getValues();

  // 当たり行のindex（0-based: data row）
  const hitIdx = [];
  for (let r=0; r<n; r++){
    if (String(pidCol[r][0]||"").trim() === projectId) hitIdx.push(r);
  }
  if (!hitIdx.length) return [];

  // ★必要列だけ一括読み（列ごと＝Rangeアクセス数は最大5）
  const midCol = membersSh.getRange(2, iMid+1, n, 1).getValues();
  const roleCol = (iRole>=0) ? membersSh.getRange(2, iRole+1, n, 1).getValues() : null;
  const closerCol = (iCloser>=0) ? membersSh.getRange(2, iCloser+1, n, 1).getValues() : null;
  const pmCol = (iPM>=0) ? membersSh.getRange(2, iPM+1, n, 1).getValues() : null;
  const activeCol = (iActive>=0) ? membersSh.getRange(2, iActive+1, n, 1).getValues() : null;

  const out = [];
  for (let k=0; k<hitIdx.length; k++){
    const r = hitIdx[k];

    const memberId = String(midCol[r][0]||"").trim();
    if (!memberId) continue;

    if (activeCol) {
      const active = toBool_(activeCol[r][0]);
      if (!active) continue;
    }

    out.push({
      memberId,
      roleLabel: roleCol ? String(roleCol[r][0]||"") : "",
      isCloser: closerCol ? toBool_(closerCol[r][0]) : false,
      isPM: pmCol ? toBool_(pmCol[r][0]) : false
    });
  }

  return out;
}
/**
 * ★closer/pm 1人制約：サーバ側最終ガード
 * - 先に true のやつを優先して、2人目以降は落とす
 */
function normalizeMembersServer_(members) {
  const clean = (Array.isArray(members) ? members : [])
    .filter(m => m && m.memberId)
    .map(m => ({
      memberId: String(m.memberId).trim(),
      roleLabel: String(m.roleLabel || ""),
      isCloser: !!m.isCloser,
      isPM: !!m.isPM
    }));

  let closerSeen = false;
  let pmSeen = false;

  return clean.map(m => {
    let isCloser = m.isCloser;
    let isPM = m.isPM;

    if (isCloser) {
      if (closerSeen) isCloser = false;
      else closerSeen = true;
    }
    if (isPM) {
      if (pmSeen) isPM = false;
      else pmSeen = true;
    }
    return { ...m, isCloser, isPM };
  });
}
/**
 * ★DB_ProjectMembers を指定ヘッダで書く
 * - 既存の当該PJ行は削除→入れ直し
 * - projectName/memberName/codeName も入れる
 */
function replaceProjectMembers_(projectId, projectName, members, now) {
  const sh = getSheet_("DB_ProjectMembers");

  const REQUIRED = [
    "projectId","projectName","memberId","memberName","codeName",
    "isActive","joinYm","leaveYm","payoutEligible","defaultPayoutYen","displayOrder",
    "roleLabel","notes","createdAt","updatedAt","isCloser","isPM"
  ];
  const header = ensureHeader_(sh, REQUIRED);

  const idx = {};
  header.forEach((h,i) => idx[h] = i);

  // 既存削除（後ろから）
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    const idxProjectId = idx["projectId"];
    for (let i = values.length - 1; i >= 0; i--) {
      if (String(values[i][idxProjectId]) === projectId) {
        sh.deleteRow(i + 2);
      }
    }
  }

  // memberId -> codeName/memberName を引く
  const master = listMembersMaster_();
  const masterById = {};
  master.forEach(m => masterById[m.memberId] = m);

  const clean = (Array.isArray(members) ? members : [])
    .filter(m => m && m.memberId)
    .map((m, k) => {
      const mm = masterById[String(m.memberId)] || {};
      return {
        projectId,
        projectName,
        memberId: String(m.memberId),
        memberName: String(mm.memberName || mm.codeName || m.memberId),
        codeName: String(mm.codeName || m.memberId),

        // デフォルト値（チャーターではここまで持たないので）
        isActive: true,
        joinYm: "",
        leaveYm: "",
        payoutEligible: true,
        defaultPayoutYen: 0,
        displayOrder: k + 1,

        roleLabel: String(m.roleLabel || ""),
        notes: "",
        createdAt: now,
        updatedAt: now,
        isCloser: !!m.isCloser,
        isPM: !!m.isPM
      };
    });

  clean.forEach(rec => {
    const row = header.map(h => (rec[h] !== undefined ? rec[h] : ""));
    sh.appendRow(row);
  });
}
/**
 * ★保存ログ（DB_CharterSaveLog）
 */
/**
 * ★保存ログ（DB_CharterSaveLog）
 * - 引数が欠けてても落ちないように保険込み
 */
function appendCharterSaveLog_(projectId, projectName, members, now, changeSummary, operatorEmail){
  // ★保険：引数が渡ってこなくても ReferenceError にならない
  operatorEmail = (typeof operatorEmail === "undefined") ? "" : String(operatorEmail || "");
  changeSummary = (typeof changeSummary === "undefined") ? "" : String(changeSummary || "");

  const sh = getSheetOrCreate_("DB_CharterSaveLog");
  const header = ensureHeader_(sh, [
    "projectId","projectName","savedAt","membersCount","closerMemberId","pmMemberId","updatedBy","changeSummary"
  ]);

  const arr = Array.isArray(members) ? members : [];
  const closer = (arr.find(m => m && m.isCloser) || {}).memberId || "";
  const pm = (arr.find(m => m && m.isPM) || {}).memberId || "";

  const rec = {
    projectId: String(projectId || ""),
    projectName: String(projectName || ""),
    savedAt: now || new Date(),
    membersCount: arr.length,
    closerMemberId: String(closer || ""),
    pmMemberId: String(pm || ""),
    updatedBy: operatorEmail,
    changeSummary: changeSummary
  };

  const row = header.map(h => (rec[h] !== undefined ? rec[h] : ""));
  sh.appendRow(row);
}
// ★1実行内キャッシュ（projectIdごと）
const __CHARTER_SAVELOG_CACHE__ = Object.create(null);
function listCharterSaveLog_(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  const sh = getSheetOrCreate_("DB_CharterSaveLog");
  ensureHeader_(sh, ["projectId","projectName","savedAt","membersCount","closerMemberId","pmMemberId","updatedBy","changeSummary"]);

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iPid = header.indexOf("projectId");
  const iSavedAt = header.indexOf("savedAt");
  if (iPid < 0) return [];

  const WANT = 30;
  const dataRows = lastRow - 1;

  function scanTail_(tailRows){
    const take = Math.min(tailRows, dataRows);
    const startRow = 2 + (dataRows - take);
    const vals = sh.getRange(startRow, 1, take, lastCol).getValues();

    const logs = [];
    for (let i = vals.length - 1; i >= 0; i--) {
      const row = vals[i];
      if (String(row[iPid]||"").trim() !== projectId) continue;

      const obj = {};
      for (let c=0; c<header.length; c++){
        const key = header[c];
        if (!key) continue;
        obj[key] = row[c];
      }
      logs.push(obj);
      if (logs.length >= WANT) break;
    }

    if (iSavedAt >= 0) logs.sort((a,b)=> String(b.savedAt||"").localeCompare(String(a.savedAt||"")));
    return logs.slice(0, WANT);
  }

  // ★まず軽く200行だけ見る → 足りなければ600行まで広げる
  let out = scanTail_(200);
  if (out.length < WANT) out = scanTail_(600);

  return out;
}
function getCharterSnapshot_(projectId){
  const snap = {
    memo:"",
    charterJson: getDefaultCharterJson_(),
    members:[],
    // ★追加：DB_Projects系（請求ルール）
    invoiceSendDeadlineRule:"",
    paymentDueRule:""
  };

  // memo + charterJson
  try{
    const sh = getSheet_("DB_ProjectCharter");
    const vals = sh.getDataRange().getValues();
    if (vals && vals.length >= 2) {
      const h = vals[0].map(x => String(x||"").trim());
      const iPid = h.indexOf("projectId");
      const iMemo = h.indexOf("memo");
      const iJson = h.indexOf("charterJson");

      if (iPid >= 0){
        for (let r=1; r<vals.length; r++){
          if (String(vals[r][iPid]||"").trim() !== projectId) continue;

          if (iMemo >= 0) snap.memo = String(vals[r][iMemo]||"");
          if (iJson >= 0) snap.charterJson = safeJsonParse_(vals[r][iJson], getDefaultCharterJson_());
          break;
        }
      }
    }
  } catch(e){}

  // members（isActive=trueのみ）
  try{
    const sh = getSheet_("DB_ProjectMembers");
    const vals = sh.getDataRange().getValues();
    if (vals && vals.length >= 2) {
      const h = vals[0].map(x => String(x||"").trim());
      const iPid = h.indexOf("projectId");
      const iMid = h.indexOf("memberId");
      const iRole = h.indexOf("roleLabel");
      const iPM = h.indexOf("isPM");
      const iCloser = h.indexOf("isCloser");
      const iActive = h.indexOf("isActive");

      for (let r=1; r<vals.length; r++){
        if (String(vals[r][iPid]||"").trim() !== projectId) continue;
        const active = (iActive >= 0) ? toBool_(vals[r][iActive]) : true;
        if (!active) continue;

        snap.members.push({
          memberId: String(vals[r][iMid]||"").trim(),
          roleLabel: (iRole>=0)? String(vals[r][iRole]||"") : "",
          isPM: (iPM>=0)? toBool_(vals[r][iPM]) : false,
          isCloser: (iCloser>=0)? toBool_(vals[r][iCloser]) : false
        });
      }
    }
  } catch(e){}

  // ★追加：請求ルール（DB_Projects）
  try{
    const rec = getProjectInvoiceRecipients_(projectId) || {};
    snap.invoiceSendDeadlineRule = String(rec.invoiceSendDeadlineRule || "");
    snap.paymentDueRule = String(rec.paymentDueRule || "");
  } catch(e){}

  return snap;
}
function buildCharterChangeSummary_(beforeSnap, afterSnap){
  const b = beforeSnap || {};
  const a = afterSnap || {};

  const parts = [];

  // ===== 1) memo =====
  const beforeMemo = String(b.memo || "");
  const afterMemo  = String(a.memo || "");
  if (beforeMemo !== afterMemo) parts.push("メモ更新");

  // ===== 2) members =====
  const bm = Array.isArray(b.members) ? b.members : [];
  const am = Array.isArray(a.members) ? a.members : [];

  const bBy = {};
  bm.forEach(x => { if(x && x.memberId) bBy[String(x.memberId)] = x; });
  const aBy = {};
  am.forEach(x => { if(x && x.memberId) aBy[String(x.memberId)] = x; });

  const bIds = new Set(Object.keys(bBy));
  const aIds = new Set(Object.keys(aBy));

  const added = [...aIds].filter(id => !bIds.has(id));
  const removed = [...bIds].filter(id => !aIds.has(id));

  const roleChanged = [];
  [...aIds].filter(id => bIds.has(id)).forEach(id => {
    const bb = bBy[id], aa = aBy[id];
    const beforeRole = `${bb.roleLabel||""}|PM=${!!bb.isPM}|Closer=${!!bb.isCloser}`;
    const afterRole  = `${aa.roleLabel||""}|PM=${!!aa.isPM}|Closer=${!!aa.isCloser}`;
    if (beforeRole !== afterRole){
      roleChanged.push(`${id}(${beforeRole}→${afterRole})`);
    }
  });

  const pmBefore = (bm.find(x => x.isPM) || {}).memberId || "";
  const pmAfter  = (am.find(x => x.isPM) || {}).memberId || "";
  const closerBefore = (bm.find(x => x.isCloser) || {}).memberId || "";
  const closerAfter  = (am.find(x => x.isCloser) || {}).memberId || "";

  if (added.length) parts.push(`メンバー追加:${added.join(",")}`);
  if (removed.length) parts.push(`メンバー削除:${removed.join(",")}`);
  if (pmBefore !== pmAfter) parts.push(`PM:${pmBefore||"無"}→${pmAfter||"無"}`);
  if (closerBefore !== closerAfter) parts.push(`Closer:${closerBefore||"無"}→${closerAfter||"無"}`);
  if (roleChanged.length) parts.push(`ロール変更:${roleChanged.slice(0,6).join(" / ")}${roleChanged.length>6 ? " ..." : ""}`);

  // ===== 3) ★請求ルール（DB_Projects）=====
  const bSend = String(b.invoiceSendDeadlineRule || "");
  const aSend = String(a.invoiceSendDeadlineRule || "");
  if (bSend !== aSend){
    parts.push(`請求書送付期限ルール: ${bSend ? bSend : "（未設定）"}→${aSend ? aSend : "（未設定）"}`);
  }

  const bDue = String(b.paymentDueRule || "");
  const aDue = String(a.paymentDueRule || "");
  if (bDue !== aDue){
    const prettyDue = (v)=>{
      const s = String(v||"").trim();
      if (!s) return "（未設定）";
      if (s === "issue_month_25") return "請求書発行月の25日";
      if (s === "issue_month_eom") return "請求書発行月の末日";
      return s;
    };
    parts.push(`振込期日ルール: ${prettyDue(bDue)}→${prettyDue(aDue)}`);
  }

  // ===== 4) charterJson 全部 =====
  const beforeJson = (b.charterJson && typeof b.charterJson === "object") ? b.charterJson : getDefaultCharterJson_();
  const afterJson  = (a.charterJson && typeof a.charterJson === "object") ? a.charterJson : getDefaultCharterJson_();

  const LABEL = {
    "contract.status": "契約ステータス",
    "contract.signedAt": "締結日",
    "contract.counterpartyName": "締結先",
    "contract.signedPdf.url": "押印版PDF",

    "goals.midLongTermGoals": "中長期目標",
    "goals.graduationState": "AMD卒業時の状態",

    "governance.raciText": "RACI",
    "governance.decisionRule": "意思決定ルール",

    "plan.overallPlan": "全体計画",
    "plan.milestonesText": "マイルストーン",

    "risks.risksText": "想定リスク"
  };

  const CONTRACT_STATUS_LABEL = {
    "unsigned": "未締結",
    "signed": "締結済",
    "terminated": "終了"
  };

  function getByPath_(obj, path){
    const keys = String(path||"").split(".");
    let cur = obj;
    for (let i=0; i<keys.length; i++){
      if (!cur || typeof cur !== "object") return "";
      cur = cur[keys[i]];
    }
    return (cur === undefined || cur === null) ? "" : cur;
  }

  function norm_(v, path){
    if (v === undefined || v === null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";

    if (path === "contract.signedPdf.url") {
      try { return String(v || "").trim(); } catch(e){ return ""; }
    }
    try { return JSON.stringify(v); } catch(e){ return String(v); }
  }

  function pretty_(v, path){
    const s = norm_(v, path);

    if (path === "contract.status") {
      return CONTRACT_STATUS_LABEL[s] || s || "（未設定）";
    }
    if (path === "contract.signedPdf.url") {
      return s ? "（設定済）" : "（未設定）";
    }
    return s ? s : "（未設定）";
  }

  const jsonDiffs = [];
  Object.keys(LABEL).forEach(path => {
    const bv = getByPath_(beforeJson, path);
    const av = getByPath_(afterJson, path);

    const bs = norm_(bv, path);
    const as = norm_(av, path);

    if (bs === as) return;

    const isLongText = ["goals.midLongTermGoals","goals.graduationState","governance.raciText","governance.decisionRule","plan.overallPlan","plan.milestonesText","risks.risksText"].includes(path);
    if (isLongText) {
      jsonDiffs.push(`${LABEL[path]}: 更新`);
    } else {
      jsonDiffs.push(`${LABEL[path]}: ${pretty_(bv, path)}→${pretty_(av, path)}`);
    }
  });

  if (jsonDiffs.length) parts.push(jsonDiffs.join(" / "));

  return parts.join(" / ");
}
function appendCharterSaveLogV2_(projectId, projectName, members, now, changeSummary, operatorEmail){
  operatorEmail = (typeof operatorEmail === "undefined") ? "" : String(operatorEmail || "");
  changeSummary = (typeof changeSummary === "undefined") ? "" : String(changeSummary || "");

  const sh = getSheetOrCreate_("DB_CharterSaveLog");
  const header = ensureHeader_(sh, [
    "projectId","projectName","savedAt","membersCount","closerMemberId","pmMemberId","updatedBy","changeSummary"
  ]);

  const arr = Array.isArray(members) ? members : [];
  const closer = (arr.find(m => m && m.isCloser) || {}).memberId || "";
  const pm = (arr.find(m => m && m.isPM) || {}).memberId || "";

  // ★savedAt を ISO(+09:00) 文字列で固定
  const dt = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
  const savedAtIso = Utilities.formatDate(dt, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");

  const rec = {
    projectId: String(projectId || ""),
    projectName: String(projectName || ""),
    savedAt: savedAtIso,
    membersCount: arr.length,
    closerMemberId: String(closer || ""),
    pmMemberId: String(pm || ""),
    updatedBy: operatorEmail,
    changeSummary: String(changeSummary || "").trim()
  };

  const row = header.map(h => (rec[h] !== undefined ? rec[h] : ""));
  sh.appendRow(row);
}

/**
 * charter_syncPmMemberIdToProjects_
 *
 * 役割：
 * - チャーターで選択されたPM（memberId）を DB_Projects.pmMemberId に同期する
 * - “PMはチャーター入力が唯一正” をDB_Projects側へ反映する
 */
function charter_syncPmMemberIdToProjects_(projectId, projectName, pmMemberId, now){
  projectId = String(projectId || "").trim();
  projectName = String(projectName || "").trim();
  pmMemberId = String(pmMemberId || "").trim();
  if (!projectId || !pmMemberId) return;

  const sh = getSheet_("DB_Projects");

  // 最小ヘッダ保証（pmMemberId列が無いと絶対に同期できない）
  const header = ensureHeader_(sh, ["projectId","projectName","pmMemberId","updatedAt"]);

  const iPid = header.indexOf("projectId");
  const iPname = header.indexOf("projectName");
  const iPm = header.indexOf("pmMemberId");
  const iUpd = header.indexOf("updatedAt");
  if (iPid < 0 || iPm < 0) return;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  const dt = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();

  if (lastRow < 2){
    const row = new Array(header.length).fill("");
    row[iPid] = projectId;
    if (iPname >= 0) row[iPname] = projectName;
    row[iPm] = pmMemberId;
    if (iUpd >= 0) row[iUpd] = dt;
    sh.appendRow(row);
    return;
  }

  // TextFinderでprojectId一致行を拾う
  const pidCol = sh.getRange(2, iPid+1, lastRow-1, 1);
  const hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();

  if (!hits || !hits.length){
    const row = new Array(header.length).fill("");
    row[iPid] = projectId;
    if (iPname >= 0) row[iPname] = projectName;
    row[iPm] = pmMemberId;
    if (iUpd >= 0) row[iUpd] = dt;
    sh.appendRow(row);
    return;
  }

  const rowNo = hits[hits.length - 1].getRow();
  sh.getRange(rowNo, iPm + 1).setValue(pmMemberId);
  if (iPname >= 0 && projectName) sh.getRange(rowNo, iPname + 1).setValue(projectName);
  if (iUpd >= 0) sh.getRange(rowNo, iUpd + 1).setValue(dt);
}
