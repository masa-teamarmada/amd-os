/** 077_NavigatorObserveRepo.gs
 * 役割：
 * - Navigator月次の「観測ログ（いつ・何が・どう変わったか）」を永続化する
 * - スナップショットを append-only で蓄積して、Timelineから参照できるようにする
 *
 * 正本シート：
 * - DB_NavigatorObserveLog（本体スプシ）
 *
 * 重要：
 * - JSTで保存
 * - yyyymm形式を正とする
 */

function navObserveEnsureSchema(){
  const name = "DB_NavigatorObserveLog";

  // ★getSheet_ が「無ければ例外」前提なので、ここで作る
  let sh = null;
  try{
    sh = getSheet_(name);
  }catch(e){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
  }

  ensureHeader_(sh, [
    "projectId",
    "ym",                 // yyyymm
    "rev",                // int
    "eventType",          // extract_run / override_save / confirm / nudge_append / issue_update ...
    "changedFields",      // comma-separated
    "itemsCount",
    "itemsDelta",
    "nudgeCount",
    "issuesOpen",
    "monthlyUpdatedAtJst",
    "prevMonthlyUpdatedAtJst",
    "fingerprint",        // short text
    "meaningDiff",        // short text
    "createdAtJst",
    "createdBy"
  ]);

  // 見やすさ＆事故防止
  try{ sh.setFrozenRows(1); }catch(_e){}

  return true;
}

function navObserveAppendSnapshot(projectId, ymKey, eventType){
  const pid = String(projectId || "").trim();
  const ym = String(ymKey || "").trim();
  const ev = String(eventType || "").trim();

  if (!pid) return { ok:false, message:"projectId empty" };
  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)" };
  if (!ev) return { ok:false, message:"eventType empty" };

  navObserveEnsureSchema();

  const email = String(Session.getActiveUser().getEmail() || "").trim();
  const nowJst = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  // ===== current snapshot =====
  const snap = navObserveBuildSnapshot(pid, ym);

  // ===== prev snapshot (last rev) =====
  const prev = navObserveGetLastSnapshot(pid, ym);

  const diff = navObserveBuildDiff(prev, snap);

  // rev
  const nextRev = (prev && prev.rev) ? (Number(prev.rev) + 1) : 1;

  // write (append-only)
  const sh = getSheet_("DB_NavigatorObserveLog");
  sh.appendRow([
    pid,
    ym,
    nextRev,
    ev,
    diff.changedFields.join(","),
    snap.itemsCount,
    diff.itemsDelta,
    snap.nudgeCount,
    snap.issuesOpen,
    snap.monthlyUpdatedAtJst,
    diff.prevMonthlyUpdatedAtJst,
    snap.fingerprint,
    diff.meaningDiff,
    nowJst,
    email
  ]);

  return { ok:true, projectId:pid, ym:ym, rev:nextRev };
}

function navObserveBuildSnapshot(projectId, ymKey){
  const pid = String(projectId || "").trim();
  const ym = String(ymKey || "").trim();

  // monthly
  let monthly = {};
  try{
    if (typeof nav_repo_getMonthlyExtract_ === "function"){
      monthly = nav_repo_getMonthlyExtract_(pid, ym) || {};
    }
  }catch(e){
    monthly = {};
  }

  const items = Array.isArray(monthly.items) ? monthly.items : [];
  const itemsCount = items.length;

  // nudge count
  let nudgeCount = 0;
  try{
    if (typeof navNudgeRepo_listItemsByProjectYm_ === "function"){
      const arr = navNudgeRepo_listItemsByProjectYm_(pid, ym, 9999);
      if (Array.isArray(arr)) nudgeCount = arr.length;
    }
  }catch(e){
    nudgeCount = 0;
  }

  // issues open
  let issuesOpen = 0;
  try{
    if (typeof nav_repo_listIssues_ === "function"){
      const issues = nav_repo_listIssues_(pid) || [];
      issuesOpen = (Array.isArray(issues) ? issues : []).filter(x=>{
        const st = String(x && x.status ? x.status : "").toLowerCase();
        return st !== "decided" && st !== "closed";
      }).length;
    }
  }catch(e){
    issuesOpen = 0;
  }

  // monthly updatedAt -> JST string
  const monthlyUpdatedAtJst = navObserveFmtJstDateTime(String(monthly.updatedAt || "").trim());

  // fingerprint（軽くて十分）
  const fingerprint = navObserveFingerprintMonthly(monthly);

  return {
    projectId: pid,
    ym: ym,
    itemsCount: itemsCount,
    nudgeCount: nudgeCount,
    issuesOpen: issuesOpen,
    monthlyUpdatedAtJst: monthlyUpdatedAtJst,
    fingerprint: fingerprint
  };
}

function navObserveGetLastSnapshot(projectId, ymKey){
  const pid = String(projectId || "").trim();
  const ym = String(ymKey || "").trim();

  const sh = getSheet_("DB_NavigatorObserveLog");
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return null;

  const head = values[0].map(x=>String(x||"").trim());
  const idx = (name)=>head.indexOf(name);

  const iPid = idx("projectId");
  const iYm = idx("ym");
  const iRev = idx("rev");
  const iChanged = idx("changedFields");
  const iItems = idx("itemsCount");
  const iDelta = idx("itemsDelta");
  const iNudge = idx("nudgeCount");
  const iIssues = idx("issuesOpen");
  const iUpd = idx("monthlyUpdatedAtJst");
  const iPrevUpd = idx("prevMonthlyUpdatedAtJst");
  const iFp = idx("fingerprint");
  const iMeaning = idx("meaningDiff");

  // 後ろから探す
  for (let r = values.length - 1; r >= 1; r--){
    const row = values[r];
    if (String(row[iPid]||"").trim() !== pid) continue;
    if (String(row[iYm]||"").trim() !== ym) continue;

    return {
      rev: Number(row[iRev] || 0),
      changedFields: String(row[iChanged]||"").trim(),
      itemsCount: Number(row[iItems] || 0),
      itemsDelta: Number(row[iDelta] || 0),
      nudgeCount: Number(row[iNudge] || 0),
      issuesOpen: Number(row[iIssues] || 0),
      monthlyUpdatedAtJst: String(row[iUpd]||"").trim(),
      prevMonthlyUpdatedAtJst: String(row[iPrevUpd]||"").trim(),
      fingerprint: String(row[iFp]||"").trim(),
      meaningDiff: String(row[iMeaning]||"").trim()
    };
  }

  return null;
}

function navObserveBuildDiff(prevSnap, curSnap){
  const prev = prevSnap || null;
  const cur = curSnap || {};

  const prevItems = prev ? Number(prev.itemsCount||0) : 0;
  const itemsDelta = Number(cur.itemsCount||0) - prevItems;

  const changedFields = (prev && prev.fingerprint)
    ? navObserveDiffFingerprint(prev.fingerprint, cur.fingerprint)
    : [];

  const prevUpd = prev ? String(prev.monthlyUpdatedAtJst||"").trim() : "";

  const parts = [];
  if (itemsDelta > 0) parts.push(`根拠ログ +${itemsDelta}`);
  if (itemsDelta < 0) parts.push(`根拠ログ ${itemsDelta}`);
  if (itemsDelta === 0) parts.push("根拠ログ ±0");

  if (changedFields.length) parts.push(`本文更新: ${changedFields.join(", ")}`);
  else parts.push("本文更新なし");

  parts.push(`nudge:${Number(cur.nudgeCount||0)} issues:${Number(cur.issuesOpen||0)}`);

  return {
    itemsDelta: itemsDelta,
    changedFields: changedFields,
    prevMonthlyUpdatedAtJst: prevUpd,
    meaningDiff: parts.join(" / ")
  };
}

function navObserveFingerprintMonthly(monthly){
  const m = monthly || {};
  const parts = [
    "summary=" + navObserveFpPart(String(m.summary||"")),
    "decided=" + navObserveFpPart(String(m.decided||"")),
    "openQuestions=" + navObserveFpPart(String(m.openQuestions||"")),
    "gapToPlan=" + navObserveFpPart(String(m.gapToPlan||"")),
    "risks=" + navObserveFpPart(String(m.risks||"")),
    "nextMeetingAdvice=" + navObserveFpPart(String(m.nextMeetingAdvice||""))
  ];
  return parts.join("|");
}

function navObserveFpPart(s){
  const t = String(s || "").trim();
  if (!t) return "0";
  return String(t.length) + ":" + t.slice(0, 80);
}

function navObserveDiffFingerprint(prevFp, curFp){
  const prev = String(prevFp || "").split("|");
  const cur  = String(curFp || "").split("|");
  const mapP = {};
  const mapC = {};

  prev.forEach(x=>{
    const i = x.indexOf("=");
    if (i <= 0) return;
    mapP[x.slice(0,i)] = x.slice(i+1);
  });
  cur.forEach(x=>{
    const i = x.indexOf("=");
    if (i <= 0) return;
    mapC[x.slice(0,i)] = x.slice(i+1);
  });

  const keys = ["summary","decided","openQuestions","gapToPlan","risks","nextMeetingAdvice"];
  const changed = [];
  keys.forEach(k=>{
    if (String(mapP[k]||"") !== String(mapC[k]||"")) changed.push(k);
  });
  return changed;
}

function navObserveFmtJstDateTime(iso){
  const s = String(iso || "").trim();
  if (!s) return "";

  try{
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  }catch(e){
    return s;
  }
}

function navObserveListSnapshots(projectId, ymKey, limit){
  const pid = String(projectId || "").trim();
  const ym = String(ymKey || "").trim();
  const lim = Math.max(1, Math.min(300, Number(limit || 50)));

  navObserveEnsureSchema();

  const sh = getSheet_("DB_NavigatorObserveLog");
  const values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { ok:true, items:[] };

  const head = values[0].map(x=>String(x||"").trim());
  const idx = (name)=>head.indexOf(name);

  const iPid = idx("projectId");
  const iYm = idx("ym");
  const iRev = idx("rev");
  const iEv = idx("eventType");
  const iCh = idx("changedFields");
  const iItems = idx("itemsCount");
  const iDelta = idx("itemsDelta");
  const iNudge = idx("nudgeCount");
  const iIssues = idx("issuesOpen");
  const iUpd = idx("monthlyUpdatedAtJst");
  const iPrev = idx("prevMonthlyUpdatedAtJst");
  const iMeaning = idx("meaningDiff");
  const iAt = idx("createdAtJst");
  const iBy = idx("createdBy");

  const out = [];
  for (let r = values.length - 1; r >= 1; r--){
    const row = values[r];
    if (String(row[iPid]||"").trim() !== pid) continue;
    if (String(row[iYm]||"").trim() !== ym) continue;

    out.push({
      rev: Number(row[iRev] || 0),
      eventType: String(row[iEv]||"").trim(),
      changedFields: String(row[iCh]||"").trim(),
      itemsCount: Number(row[iItems] || 0),
      itemsDelta: Number(row[iDelta] || 0),
      nudgeCount: Number(row[iNudge] || 0),
      issuesOpen: Number(row[iIssues] || 0),
      monthlyUpdatedAtJst: String(row[iUpd]||"").trim(),
      prevMonthlyUpdatedAtJst: String(row[iPrev]||"").trim(),
      meaningDiff: String(row[iMeaning]||"").trim(),
      createdAtJst: String(row[iAt]||"").trim(),
      createdBy: String(row[iBy]||"").trim()
    });

    if (out.length >= lim) break;
  }

  // rev昇順で返す（見やすい）
  out.sort((a,b)=>Number(a.rev||0) - Number(b.rev||0));

  return { ok:true, items: out };
}
