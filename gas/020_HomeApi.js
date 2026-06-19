/** 020_HomeApi.gs
 * HomePage（ダッシュボード）から呼ばれる公開API担当。
 * PJ一覧取得、PJ作成、月次タスク状況など、Home UIのための「外向き関数」をまとめる。
 */
// ======================================================================
// Home API
// ======================================================================

function getCurrentYm_(){
  // DBは YYYYMM を正にする（勝手に日付化されない）
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMM");
}
function getTodayDayOfMonth_(){
  return Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "d"));
}
function getBillingTaskStatusMap_(ym){
  // ===== cache =====
    // ★Home向け：30秒キャッシュ（ymごと）
  const cache = CacheService.getUserCache();
  const key = "home:billingTaskStatusMap:" + String(ym||"");
  try{
    const cached = cache.get(key);
    if (cached) return JSON.parse(cached);
  } catch(e){}


  // 受け取った ym が "yyyy-MM" / "yyyyMM" / Date でも全部 YYYYMM に揃える
  function normYmKey_(v){
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyyMM");
    }
    const s0 = String(v).trim();
    if (/^\d{6}$/.test(s0)) return s0;                 // yyyyMM
    if (/^\d{4}-\d{2}$/.test(s0)) return s0.replace("-", ""); // yyyy-MM -> yyyyMM

    // "2026/2/1" みたいなやつも拾う
    const d = new Date(s0);
    if (!isNaN(d.getTime())) {
      return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMM");
    }
    // 最後の保険：数字だけ抜いて先頭6桁（事故りやすいので保険扱い）
    const digits = s0.replace(/[^\d]/g,"");
    if (digits.length >= 6) return digits.slice(0,6);
    return s0;
  }

  ym = normYmKey_(ym);
  const out = {}; // { projectId: { meetingDone, reportDone, budgetDone, allocationDone, invoiceSendDone, paymentDone } }

  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- active members (per project) ---
    const activeMemberIdsByProject = {}; // {pid: [memberId,...]}
    try{
      const pmSh = ss.getSheetByName("DB_ProjectMembers");
      if (pmSh){
        const pv = pmSh.getDataRange().getValues();
        if (pv && pv.length >= 2){
          const ph = pv[0].map(x => String(x||"").trim());
          const iPid = ph.indexOf("projectId");
          const iMid = ph.indexOf("memberId");
          const iActive = ph.indexOf("isActive");

          if (iPid >= 0 && iMid >= 0){
            for (let r=1; r<pv.length; r++){
              const pid = String(pv[r][iPid]||"").trim();
              const mid = String(pv[r][iMid]||"").trim();
              if (!pid || !mid) continue;

              const active = (iActive >= 0) ? toBool_(pv[r][iActive]) : true;
              if (!active) continue;

              if (!activeMemberIdsByProject[pid]) activeMemberIdsByProject[pid] = [];
              activeMemberIdsByProject[pid].push(mid);
            }
          }
        }
      }
    } catch(e){}

    // --- agreement (latest version per project for ym) ---
    const allAgreedByProject = {}; // {pid: true/false}
    try{
      const agSh = ss.getSheetByName("DB_PayoutAgreement");
      if (agSh){
        const av = agSh.getDataRange().getValues();
        if (av && av.length >= 2){
          const ah = av[0].map(x => String(x||"").trim());
          const iPid = ah.indexOf("projectId");
          const iYm  = ah.indexOf("ym");
          const iVer = ah.indexOf("version");
          const iMid = ah.indexOf("memberId");
          const iAg  = ah.indexOf("agreedAt");

          if (iPid >= 0 && iYm >= 0 && iVer >= 0 && iMid >= 0 && iAg >= 0){
            const box = {}; // { pid: { versions:Set, byVer:{ver:{agreed:Set}} } }

            for (let r=1; r<av.length; r++){
              const pid = String(av[r][iPid]||"").trim();
              const rowYm = normYmKey_(av[r][iYm]);
              if (!pid || rowYm !== ym) continue;

              const ver = String(av[r][iVer]||"").trim();
              const mid = String(av[r][iMid]||"").trim();
              const agreedAt = String(av[r][iAg]||"").trim();
              if (!ver || !mid) continue;

              if (!box[pid]) box[pid] = { versions: new Set(), byVer: {} };
              box[pid].versions.add(ver);
              if (!box[pid].byVer[ver]) box[pid].byVer[ver] = { agreed: new Set() };
              if (agreedAt) box[pid].byVer[ver].agreed.add(mid);
            }

            Object.keys(box).forEach(pid => {
              const versions = Array.from(box[pid].versions).sort();
              const latest = versions.length ? versions[versions.length - 1] : "";
              const agreedSet = latest ? (box[pid].byVer[latest]?.agreed || new Set()) : new Set();

              const activeIds = Array.from(new Set(activeMemberIdsByProject[pid] || []));
              const total = activeIds.length;

              if (!latest || total <= 0){
                allAgreedByProject[pid] = false;
                return;
              }

              let agreedCount = 0;
              activeIds.forEach(mid => { if (agreedSet.has(mid)) agreedCount++; });

              allAgreedByProject[pid] = (agreedCount === total);
            });
          }
        }
      }
    } catch(e){}

    // --- billing cycle task status ---
    const sh = ss.getSheetByName("DB_BillingCycle");
    if (!sh) return out;

    const vals = sh.getDataRange().getValues();
    if (!vals || vals.length < 2) return out;

    const h = vals[0].map(x => String(x||"").trim());
    const iPid = h.indexOf("projectId");
    const iYm  = h.indexOf("ym");

    const iMeeting = h.indexOf("meetingEventId");
    const iReport  = h.indexOf("monthlyReportUrl");
    const iBudget  = h.indexOf("budgetConfirmedAt");
    const iAlloc   = h.indexOf("allocationConfirmedAt");
    const iInvSend = h.indexOf("invoiceSentAt");
    const iPay     = h.indexOf("paymentConfirmedAt");

    if (iPid < 0 || iYm < 0) return out;

    for (let r=1; r<vals.length; r++){
      const pid = String(vals[r][iPid]||"").trim();
      const rowYm = normYmKey_(vals[r][iYm]);
      if (!pid || rowYm !== ym) continue;

      const meetingDone = !!String((iMeeting>=0 ? vals[r][iMeeting] : "")||"").trim();
      const reportDone  = !!String((iReport>=0 ? vals[r][iReport] : "")||"").trim();
      const budgetDone  = !!String((iBudget>=0 ? vals[r][iBudget] : "")||"").trim();

      const allocConfirmed = !!String((iAlloc>=0 ? vals[r][iAlloc] : "")||"").trim();
      const allAgreed = !!allAgreedByProject[pid];
      const allocationDone = allocConfirmed && allAgreed;

      out[pid] = {
        exists: true, // ★そのymのDB_BillingCycle行が存在した
        meetingDone,
        reportDone,
        budgetDone,
        allocationDone,
        invoiceSendDone: !!String((iInvSend>=0 ? vals[r][iInvSend] : "")||"").trim(),
        paymentDone: !!String((iPay>=0 ? vals[r][iPay] : "")||"").trim(),
      };

    }
  } catch(e){
    return out;
  }

  // ===== cache save =====
  try{
    // ★Home向け：30秒キャッシュ（ymごと）
    cache.put(key, JSON.stringify(out), 30);
  } catch(e){}

  return out;

}
function listProjects(payload) {
  const prof = _profStart_();
  _profMark_(prof, "start");

  // payload: { includeAll:boolean, statusFilter:[...], limit:number }
  payload = payload || {};
  const includeAll = !!payload.includeAll;

  // デフォは active のみ（UIが軽くなる）
  const statusFilter = Array.isArray(payload.statusFilter)
    ? payload.statusFilter.map(x => String(x||"").trim().toLowerCase()).filter(x=>x)
    : (includeAll ? [] : ["active"]);

  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 0; // 0=無制限

  const email = (Session.getActiveUser().getEmail() || "").toLowerCase().trim();
  const admin = isAdmin_();              // ← まさだけ（従来の意味を維持）
  const canSeeAll = canSeeAllProjects_(); // ← 全社PJ閲覧できる人（まさ＋きよ）

  // ★30秒キャッシュ（Homeの連打で毎回DB叩かない）
  // 進行中/全件でキーが変わる
  const cache = CacheService.getUserCache();
  const ymKey = getCurrentYm_();
  const cacheKey = "home:listProjects:v3:" + email + ":" + ymKey + ":" + (includeAll ? "all" : statusFilter.join(","));
  try{
    const cached = cache.get(cacheKey);
    if (cached) {
      const obj = JSON.parse(cached);
        if (obj && obj.ok) {
          try{
            // ★候補配列が無い（古いキャッシュ）なら作る
            if (!Array.isArray(obj.insightCandidates) || !obj.insightCandidates.length){
              obj.insightCandidates = buildHomeInsightCandidates(obj.projects || []);
            }

            // ★毎回必ず変わる選び方（時刻mod）
            const arr = obj.insightCandidates || [];
            const nonce = Date.now(); // ms
            obj.insightText = (arr.length)
              ? String(arr[nonce % arr.length] || "").trim()
              : "";
            obj.insightNonce = nonce; // デバッグ用
          } catch(e){}
          obj.profile = prof.marks.concat([{label:"cache hit", ms: Date.now() - prof.t0 }]);
          return obj;
        }
    }
  } catch(e){}

  const sh = getSheet_("DB_Projects");

  // ★追加列を確実に生やす
  const headerEnsured = ensureHeader_(sh, [
    "projectId","projectName","clientName","status","notes","createdAt","updatedAt",
    "freeePartnerId","clientLocked",
    "invoiceToName","invoiceToEmails","invoiceCcEmails","invoiceBccEmails",
    "invoiceSendDeadlineRule","paymentDueRule"
  ]);

  const lastRowP = sh.getLastRow();
  const lastColP = sh.getLastColumn();
  const values = (lastRowP >= 1 && lastColP >= 1)
    ? sh.getRange(1, 1, lastRowP, lastColP).getValues()
    : [[]];
  _profMark_(prof, "DB_Projects read");

  if (!values || values.length < 2) {
    const out0 = { ok:true, projects:[], userEmail:email, isAdmin:admin, email, profile: prof.marks };
    try{ cache.put(cacheKey, JSON.stringify(out0), 30); }catch(e){}
    return out0;
  }

  // ヘッダindex
  const headers = values[0].map(x=>String(x||"").trim());
  function idx_(name){ return headers.indexOf(name); }
  const iPid = idx_("projectId");
  const iPn  = idx_("projectName");
  const iCn  = idx_("clientName");
  const iSt  = idx_("status");
  const iUpd = idx_("updatedAt");
  const iShort = idx_("shortGoal");
  const iMidLong = idx_("midLongGoal");
  const iHealth = idx_("healthStatus");
  const iHealthNote = idx_("healthNote");
  const iNextTitle = idx_("nextMilestoneTitle");
  const iNextDue   = idx_("nextMilestoneDue");

  const iFreeePid = idx_("freeePartnerId");
  const iLocked   = idx_("clientLocked");

  if (iPid < 0) {
    const outBad = { ok:false, message:"DB_Projects missing projectId", projects:[], userEmail:email, isAdmin:admin, email, profile: prof.marks };
    return outBad;
  }

  function normStatus_(s){
    const v = String(s||"").trim().toLowerCase();
    if (!v) return "sales";
    if (v === "draft") return "sales"; // 過去互換
    return v;
  }

  // ===== 1) 先に「対象PJ」だけ決める（ここが肝） =====
  const targetRows = [];
  const targetProjectIds = new Set();

  for (let r=1; r<values.length; r++){
    const row = values[r];
    const pid = String(row[iPid]||"").trim();
    if (!pid) continue;

    const st = (iSt>=0) ? normStatus_(row[iSt]) : "sales";

    // statusFilterがあるならそれだけ
    if (statusFilter.length && !statusFilter.includes(st)) continue;

    targetRows.push(row);
    targetProjectIds.add(pid);

    if (limit > 0 && targetRows.length >= limit) break;
  }

  _profMark_(prof, "filter DB_Projects by status");

  // ---- members master (memberId -> codeName) + (email -> memberId)
  let membersById = {};
  let memberIdByEmail = {};
  try {
    const mm = _getMembersMapsHome_();
    membersById = mm.membersById || {};
    memberIdByEmail = mm.memberIdByEmail || {};
  } catch(e) {
    membersById = {};
    memberIdByEmail = {};
  }
  _profMark_(prof, "DB_Members read");
  _profMark_(prof, "members map built");


  // ---- 閲覧は全員に全PJ開放。編集権限は canEdit フラグで制御 ----
  // myMemberId: 編集権限判定用（PM判定に使う）
  const myMemberId = memberIdByEmail[email] || "";

  _profMark_(prof, "access filter built (open to all)");

  // ---- project members summary（対象PJだけ）
  const pmSummaryByProject = {};
  try {
    const psh = getSheet_("DB_ProjectMembers");
    const lastRowPM2 = psh.getLastRow();
    const lastColPM2 = psh.getLastColumn();
    const pvals = (lastRowPM2 >= 1 && lastColPM2 >= 1)
      ? psh.getRange(1, 1, lastRowPM2, lastColPM2).getValues()
      : [[]];
    _profMark_(prof, "DB_ProjectMembers read (for summary)");

    if (pvals.length >= 2) {
      const ph = pvals[0].map(h => String(h||"").trim());
      const pi_projectId = ph.indexOf("projectId");
      const pi_memberId  = ph.indexOf("memberId");
      const pi_isActive  = ph.indexOf("isActive");
      const pi_isPM      = ph.indexOf("isPM");
      const pi_isCloser  = ph.indexOf("isCloser");
      const pi_roleLabel = ph.indexOf("roleLabel");

      for (let r=1; r<pvals.length; r++){
        const row = pvals[r];
        const pid = (pi_projectId >= 0) ? String(row[pi_projectId]||"").trim() : "";
        if (!pid) continue;

        // ★対象PJだけ
        if (!targetProjectIds.has(pid)) continue;

        const mid = (pi_memberId >= 0) ? String(row[pi_memberId]||"").trim() : "";
        if (!mid) continue;

        const active = (pi_isActive >= 0) ? toBool_(row[pi_isActive]) : true;
        if (!active) continue;

        const codeName = membersById[mid] || mid;

        if (!pmSummaryByProject[pid]) pmSummaryByProject[pid] = { members: [], pmName: "", closerName: "" };
        pmSummaryByProject[pid].members.push(codeName);

        const roleLabel = (pi_roleLabel >= 0) ? String(row[pi_roleLabel]||"") : "";
        const isPM = (pi_isPM >= 0) ? toBool_(row[pi_isPM]) : false;
        const isCloser = (pi_isCloser >= 0) ? toBool_(row[pi_isCloser]) : false;

        if (!pmSummaryByProject[pid].pmName) {
          if (isPM || String(roleLabel).toUpperCase().includes("PM")) pmSummaryByProject[pid].pmName = codeName;
        }
        if (!pmSummaryByProject[pid].closerName) {
          if (isCloser) pmSummaryByProject[pid].closerName = codeName;
        }
      }

      Object.keys(pmSummaryByProject).forEach(pid => {
        pmSummaryByProject[pid].members = Array.from(new Set(pmSummaryByProject[pid].members));
      });
    }
  } catch(e) {}

  _profMark_(prof, "pm summary built");

  function toIso_(v){
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    const s = String(v||"");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString();
    return s;
  }

  const ym = ymKey; // 例: "202602"
  const prevYm = addMonthsYmKey_(ym, -1); // 例: "202601"

  const billingTaskMap = getBillingTaskStatusMap_(ym);
  _profMark_(prof, "getBillingTaskStatusMap_ now done");

  _profMark_(prof, "getBillingTaskStatusMap_ prev skipped");

  const day = getTodayDayOfMonth_();

  const projects = [];
  for (let i=0; i<targetRows.length; i++){
    const row = targetRows[i];

    const projectId = String(row[iPid] || "").trim();
    if (!projectId) continue;

    const sum = pmSummaryByProject[projectId] || { members: [], pmName: "", closerName: "" };
    const projectName = (iPn>=0) ? String(row[iPn]||"").trim() : projectId;

    const btNow = (billingTaskMap[projectId] || {
      exists:false,
      meetingDone:false, reportDone:false, budgetDone:false, allocationDone:false, invoiceSendDone:false, paymentDone:false
    });

    const hasCycle = !!btNow.exists;
    const scheduleDone = !!btNow.meetingDone;

    const routineObj = (function(){
      const bizYm = ym;                 // "YYYYMM"（今月）
      const prevBizYm = prevYm;         // "YYYYMM"（前月、debug/UI互換用）
      const payYm = addMonthsYmKey_(bizYm, 1);

      const prevPending = false;
      const defaultYmKey = bizYm;

      // ====== 以降の “表示用” は defaultYmKey に揃える（Homeの見え方もBillingと一致させる） ======
      const viewBizYm = defaultYmKey;
      const viewPayYm = addMonthsYmKey_(viewBizYm, 1);

      const btView = btNow;

      const hasCycle = !!btView.exists;
      const scheduleDone = !!btView.meetingDone;

      const due = {
        schedule:    ymKeyToDate_(viewBizYm, 10),
        nextBudget:  ymKeyToDate_(viewBizYm, 15),
        allocation:  ymKeyToDate_(viewBizYm, 15),
        report:      ymKeyToDate_(viewBizYm, 20),
        invoiceSend: ymKeyToDate_(viewPayYm, 9),
        paymentCheck:endOfMonthYmKey_(viewPayYm),
      };

      const doneByKey = {
        schedule: !!btView.meetingDone,
        report: !!btView.reportDone,
        nextBudget: !!btView.budgetDone,
        allocation: !!btView.allocationDone,
        invoiceSend: !!btView.invoiceSendDone,
        paymentCheck: !!btView.paymentDone,
      };

      const order = ["schedule","nextBudget","allocation","report","invoiceSend","paymentCheck"];
      const nextKey = order.find(k => !doneByKey[k]) || "";

      const today = new Date();
      let urgency = "ok";
      let nextDue = null;

      if (!hasCycle) {
        nextDue = due["schedule"];
        const diff = daysDiffLocal_(today, nextDue);
        urgency = (diff < 0) ? "bad" : (diff <= 3 ? "warn" : "ok");
      } else if (nextKey) {
        nextDue = due[nextKey];
        const diff = daysDiffLocal_(today, nextDue);
        urgency = (diff < 0) ? "bad" : (diff <= 3 ? "warn" : "ok");
      } else {
        urgency = "ok";
      }

      const LABEL = {
        schedule:"月次報告会 スケジューリング",
        report:"月次報告書 アップロード",
        nextBudget:"翌月予算の確定",
        allocation:"翌月配賦額の確定",
        invoiceSend:"請求書 送付",
        paymentCheck:"入金/振込 確認"
      };

      return {
        // ★Homeが開くべき業務月（YYYYMM）
        defaultYmKey: defaultYmKey,

        // ★デバッグ＆UI向け（見える化）
        currentYmKey: bizYm,
        prevYmKey: prevBizYm,
        prevPending: prevPending,

        // 表示用（月次ボックスの中身はこのym基準）
        ym: viewBizYm,
        hasCycle: hasCycle,

        scheduleDone: scheduleDone,
        needScheduleReminder: (!scheduleDone && day >= 5),
        scheduleOverdue: (!scheduleDone && day >= 11),

        tasks: btView,

        nextTaskKey: nextKey,
        nextTaskLabel: nextKey ? (LABEL[nextKey] || nextKey) : "",
        nextDueYmd: nextDue ? fmtYmdJa_(nextDue) : "",
        urgency: urgency
      };
    })();

    projects.push({
      projectId,
      projectName,
      clientName: (iCn>=0) ? String(row[iCn]||"").trim() : "",
      status: (iSt>=0) ? String(row[iSt]||"draft").trim() : "draft",
      shortGoal: (iShort>=0) ? String(row[iShort]||"").trim() : "",
      midLongGoal: (iMidLong>=0) ? String(row[iMidLong]||"").trim() : "",
      updatedAt: (iUpd>=0) ? toIso_(row[iUpd]) : "",

      freeePartnerId: (iFreeePid>=0) ? String(row[iFreeePid]||"").trim() : "",
      clientLocked: (iLocked>=0) ? toBool_(row[iLocked], true) : true,

      members: sum.members || [],
      pmName: sum.pmName || "",
      closerName: sum.closerName || "",

      healthStatus: (iHealth>=0) ? String(row[iHealth]||"").trim().toLowerCase() : "green",
      healthNote: (iHealthNote>=0) ? String(row[iHealthNote]||"").trim() : "",
      nextMilestoneTitle: (iNextTitle>=0) ? String(row[iNextTitle]||"").trim() : "",
      nextMilestoneDue: (iNextDue>=0) ? String(row[iNextDue]||"").trim() : "",

      routine: routineObj,

      // 編集権限：admin or そのPJのPM
      canEdit: admin || (myMemberId && sum.pmName && sum.members.includes(membersById[myMemberId] || "")),

      charterUrl: buildWebAppUrl("charter", { projectId, projectName }),

      // ★ここが本命：業務月をURLに埋める
      monthlyUrl: buildWebAppUrl("billing", { projectId, projectName, ym: routineObj.ym })
    });
  }

  projects.sort((a,b) => {
    const na = parseProjectNumber_(a.projectId);
    const nb = parseProjectNumber_(b.projectId);
    if (na !== null && nb !== null) return nb - na;
    return (a.projectId < b.projectId ? 1 : -1);
  });

  _profMark_(prof, "end");

  // ===== Home Insight (MVP) =====
  const insightCandidates = buildHomeInsightCandidates(projects);

  // 互換：フロントが古い場合の保険（固定化しない）
  const insightText = (insightCandidates && insightCandidates.length)
    ? String(insightCandidates[Math.floor(Math.random() * insightCandidates.length)] || "").trim()
    : "";

  const out = { ok:true, projects, insightText, insightCandidates, userEmail:email, isAdmin:admin, email, profile: prof.marks };


  try{ cache.put(cacheKey, JSON.stringify(out), 30); }catch(e){}

  return out;
}

function buildHomeInsightCandidates(projects){
  const list = Array.isArray(projects) ? projects : [];
  const total = list.length;

  // 集計
  let bad = 0, warn = 0, ok = 0, noCycle = 0;
  let schedulePending = 0;
  let charterThin = 0;
  let stale = 0;

  const badPj = [];
  const warnPj = [];
  const noCyclePj = [];
  const schedulePj = [];
  const stalePj = [];

  // 次タスク種別カウント
  const nextTaskCount = {
    schedule:0, nextBudget:0, allocation:0, report:0, invoiceSend:0, paymentCheck:0, other:0
  };

  function pickName(p){
    return String(p.projectName || p.projectId || "").trim();
  }
  function push2(arr, v){
    v = String(v||"").trim();
    if (!v) return;
    if (arr.indexOf(v) >= 0) return;
    if (arr.length < 2) arr.push(v);
  }
  function pjListStr(arr){
    const a = (arr || []).filter(x=>String(x||"").trim()).slice(0,2);
    return a.length ? a.join(" / ") : "";
  }
  function hoursSince(iso){
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000*60*60));
  }

  for (let i=0; i<list.length; i++){
    const p = list[i] || {};
    const r = p.routine || {};

    // 月次未着手
    if (!r.hasCycle){
      noCycle++;
      push2(noCyclePj, pickName(p));
      continue;
    }

    // urgency
    const u = String(r.urgency || "").trim();
    if (u === "bad"){
      bad++;
      push2(badPj, pickName(p));
    } else if (u === "warn"){
      warn++;
      push2(warnPj, pickName(p));
    } else {
      ok++;
    }

    // スケジュール未
    if (!r.scheduleDone){
      schedulePending++;
      push2(schedulePj, pickName(p));
    }

    // チャーター薄い（3つのどれか欠けてたら薄い扱い）
    const a = String(p.nextMilestoneTitle || "").trim();
    const b = String(p.shortGoal || "").trim();
    const c = String(p.midLongGoal || "").trim();
    if (!a || !b || !c) charterThin++;

    // 更新止まり（48h以上更新なしを“止まり”扱い）
    const hs = hoursSince(p.updatedAt);
    if (hs !== null && hs >= 48){
      stale++;
      push2(stalePj, pickName(p));
    }

    // 次タスク
    const k = String(r.nextTaskKey || "").trim();
    if (k && nextTaskCount[k] !== undefined) nextTaskCount[k]++;
    else if (k) nextTaskCount.other++;
  }

  // 何が詰まりか（最多のnextTask）
  let topKey = "";
  let topVal = -1;
  Object.keys(nextTaskCount).forEach(k => {
    const v = nextTaskCount[k] || 0;
    if (v > topVal){
      topVal = v;
      topKey = k;
    }
  });

  const LABEL = {
    schedule:"月次報告会 スケジューリング",
    nextBudget:"翌月予算の確定",
    allocation:"翌月配賦額の確定",
    report:"月次報告書 アップロード",
    invoiceSend:"請求書 送付",
    paymentCheck:"入金/振込 確認",
    other:"月次タスク"
  };
  const topLabel = LABEL[topKey] || "月次タスク";

  // 候補文を組み立て（“総合”を出す）
  const res = [];

  if (total === 0){
    res.push(
      "いま表示できるPJが無い。参画PJの紐付けを確認してもいいかも。",
      "いま見えてるPJが無い。メンバー紐付けが抜けてる可能性ある。",
      "PJが見えてない。参画設定を一回だけ確認してほしい。"
    );
    return res;
  }

  const badTail = badPj.length ? `（例：${pjListStr(badPj)}）` : "";
  const warnTail = warnPj.length ? `（例：${pjListStr(warnPj)}）` : "";
  const ncTail  = noCyclePj.length ? `（例：${pjListStr(noCyclePj)}）` : "";
  const scTail  = schedulePj.length ? `（例：${pjListStr(schedulePj)}）` : "";
  const stTail  = stalePj.length ? `（例：${pjListStr(stalePj)}）` : "";

  // 1 全体の空気
  res.push(
    `いま見えてるPJは ${total} 件。期限超過 ${bad}、期限接近 ${warn}、未着手 ${noCycle}。`,
    `稼働 ${total} 件。赤 ${bad}、黄 ${warn}、未着手 ${noCycle}。`,
    `いまの状態：${total} 件中、期限超過 ${bad}、期限接近 ${warn}、月次未着手 ${noCycle}。`
  );

  // 2 強いシグナル（bad/warn/noCycle）
  if (bad > 0){
    res.push(
      `期限超過が ${bad} 件ある。${badTail}`,
      `${bad} 件だけ期限オーバー。いま詰まりが見えてる。${badTail}`,
      `期限超過 ${bad} 件。先に見える化したい。${badTail}`
    );
  } else if (warn > 0){
    res.push(
      `期限接近が ${warn} 件ある。${warnTail}`,
      `${warn} 件だけ期限が近い。先に潰すとラク。${warnTail}`,
      `期限が近いのが ${warn} 件。早めに触れると平和。${warnTail}`
    );
  } else if (noCycle > 0){
    res.push(
      `月次未着手が ${noCycle} 件ある。${ncTail}`,
      `${noCycle} 件は月次がまだ始まってない。最初の一歩だけ必要。${ncTail}`,
      `月次未着手 ${noCycle} 件。ここが起点になりそう。${ncTail}`
    );
  } else {
    res.push(
      "目立つ詰まりは今のところ無い。",
      "いまのところ大事故の気配は薄い。",
      "今月はひとまず平和。"
    );
  }

  // 3 “どこが詰まりがちか”（nextTask最多）
  if (topVal > 0){
    res.push(
      `詰まりやすいのは「${topLabel}」が多い。(${topVal} 件)`,
      `今月は「${topLabel}」で止まりがち。(${topVal} 件)`,
      `ボトルネックは「${topLabel}」寄り。(${topVal} 件)`
    );
  }

  // 4 運用の穴（スケジュール未、チャーター薄い、更新止まり）
  if (schedulePending > 0){
    res.push(
      `スケジュール未が ${schedulePending} 件ある。${scTail}`,
      `月次報告会の予定がまだ無いPJが ${schedulePending} 件。${scTail}`
    );
  }
  if (charterThin > 0){
    res.push(
      `チャーターが薄いPJが ${charterThin} 件ある（TODO/短期/中長期のどれか欠けてる）。`,
      `チャーター未整備が ${charterThin} 件ある。後で迷子になりやすい。`
    );
  }
  if (stale > 0){
    res.push(
      `48時間以上更新が止まってるPJが ${stale} 件ある。${stTail}`,
      `更新が止まり気味のPJが ${stale} 件ある。${stTail}`
    );
  }

  // 5 “一番ラクな打ち手”っぽい観測（命令しない）
  if (bad > 0){
    res.push("まずは期限超過の2件だけ見える化すると、全体が動きやすくなる。");
  } else if (warn > 0){
    res.push("期限接近を先に触ると、今月の後半がラクになる。");
  } else if (noCycle > 0){
    res.push("未着手の月次を起動すると、あとは流れで進むことが多い。");
  } else {
    res.push("いまは大崩れしてない。今のうちに整備系を進めやすい。");
  }

  // 重複を軽く消す（同じ文が並ぶのを防ぐ）
  const uniq = [];
  const seen = {};
  for (let i=0; i<res.length; i++){
    const s = String(res[i]||"").trim();
    if (!s) continue;
    if (seen[s]) continue;
    seen[s] = true;
    uniq.push(s);
  }
  return uniq;
}

function createProject(payload) {
  const projectName = payload && payload.projectName ? String(payload.projectName).trim() : "";
  // ★旧 clientName を “請求書送付先（正式名称）” の入力として扱う（UI名は後で変える）
  const invoicePartnerOfficialName = payload && payload.clientName ? String(payload.clientName).trim() : "";
  const pmMemberId = payload && payload.pmMemberId ? String(payload.pmMemberId).trim() : "";

  if (!isAdmin_()) return { ok:false, message:"admin only" };

  if (!projectName) return { ok: false, message: "PJ名が空" };
  if (!invoicePartnerOfficialName) return { ok: false, message: "請求書送付先（正式名称）が空" };
  if (!pmMemberId) return { ok: false, message: "PMが未選択" };

  const sh = getSheet_("DB_Projects");

  // ★ここが核心：pmMemberId をDB_Projectsにも保存する
  // freee確定系は初期は空、状態は unlinked
  const header = ensureHeader_(sh, [
    "projectId","projectName",
    // 互換のため clientName は残す（当面は invoicePartnerOfficialName と同じ値を入れる）
    "clientName",
    // 新設（PMが入力した候補）
    "invoicePartnerOfficialName",
    // ★追加：Homeの新規PJ作成で選んだPM（DB_Projectsにも保持する）
    "pmMemberId",
    "status","notes","createdAt","updatedAt",
    // freee確定（admin承認後に入る）
    "freeePartnerId",
    // 任意だけどUX強い
    "freeePartnerStatus",
    // 既存（あれば使う）
    "clientLocked"
  ]);

  // 既存ロジックのまま（projectId生成に必要）
  const idxProjectId = header.indexOf("projectId");
  if (idxProjectId < 0) return { ok:false, message:"header missing: projectId" };

  const projectId = generateNextProjectId_(sh, idxProjectId);
  const now = new Date();

  const outRow = new Array(header.length).fill("");
  outRow[header.indexOf("projectId")] = projectId;
  outRow[header.indexOf("projectName")] = projectName;

  // ★互換：既存UI/既存ロジックが clientName を参照してても壊れないように同値を入れる
  const iClientName = header.indexOf("clientName");
  if (iClientName >= 0) outRow[iClientName] = invoicePartnerOfficialName;

  const iOfficial = header.indexOf("invoicePartnerOfficialName");
  if (iOfficial >= 0) outRow[iOfficial] = invoicePartnerOfficialName;

  // ★本命：pmMemberId を DB_Projects に保存
  const iPm = header.indexOf("pmMemberId");
  if (iPm >= 0) outRow[iPm] = pmMemberId;

  const iStatus = header.indexOf("status");
  if (iStatus >= 0) outRow[iStatus] = "draft";

  const iNotes = header.indexOf("notes");
  if (iNotes >= 0) outRow[iNotes] = ""; // メモ運用は廃止

  const iCreated = header.indexOf("createdAt");
  if (iCreated >= 0) outRow[iCreated] = now;

  const iUpdated = header.indexOf("updatedAt");
  if (iUpdated >= 0) outRow[iUpdated] = now;

  const iFreeePid = header.indexOf("freeePartnerId");
  if (iFreeePid >= 0) outRow[iFreeePid] = "";     // ★空

  const iFreeeStatus = header.indexOf("freeePartnerStatus");
  if (iFreeeStatus >= 0) outRow[iFreeeStatus] = "unlinked";

  // ★clientLocked は “承認後にtrue” が自然（今は未承認なのでfalse）
  const iLocked = header.indexOf("clientLocked");
  if (iLocked >= 0) outRow[iLocked] = false;

  // ★ここでfreeeに一切触らない（爆速＆増殖ゼロ）
  sh.appendRow(outRow);

  // ★PMをDB_ProjectMembersへ自動登録（isPM=true）
  try{
    const pmSh = getSheetOrCreate_("DB_ProjectMembers");
    const REQUIRED = [
      "projectId","projectName","memberId","memberName","codeName",
      "isActive","joinYm","leaveYm","payoutEligible","defaultPayoutYen","displayOrder",
      "roleLabel","notes","createdAt","updatedAt","isCloser","isPM"
    ];
    const pmHeader = ensureHeader_(pmSh, REQUIRED);
    const pmIdx = {};
    pmHeader.forEach((h,i)=>pmIdx[h]=i);

    // member master から名前を引く
    const ms = getSheet_("DB_Members").getDataRange().getValues();
    const mh = ms[0].map(x=>String(x||"").trim());
    const iMid = mh.indexOf("memberId");
    const iCode = mh.indexOf("codeName");
    const iName = mh.indexOf("memberName");

    let codeName = pmMemberId;
    let memberName = pmMemberId;
    if (iMid >= 0){
      for (let r=1; r<ms.length; r++){
        if (String(ms[r][iMid]||"").trim() === pmMemberId){
          codeName = String(ms[r][iCode]||"").trim() || pmMemberId;
          memberName = String(ms[r][iName]||"").trim() || codeName;
          break;
        }
      }
    }

    const rec = {};
    pmHeader.forEach(h => rec[h] = "");
    rec.projectId = projectId;
    rec.projectName = projectName;
    rec.memberId = pmMemberId;
    rec.memberName = memberName;
    rec.codeName = codeName;
    rec.isActive = true;
    rec.joinYm = "";
    rec.leaveYm = "";
    rec.payoutEligible = true;
    rec.defaultPayoutYen = 0;
    rec.displayOrder = 1;
    rec.roleLabel = "PM";
    rec.notes = "";
    rec.createdAt = now;
    rec.updatedAt = now;
    rec.isCloser = false;
    rec.isPM = true;

    pmSh.appendRow(pmHeader.map(h => rec[h]));
  } catch(e){
    // ここで落ちてもPJ作成は成功扱いにする（後で手で直せる）
  }

  return { ok: true, projectId: projectId };
}

function generateNextProjectId_(sh, idxProjectId) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return "p1";

  const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  let maxN = 0;
  for (let i = 0; i < values.length; i++) {
    const v = String(values[i][idxProjectId] || "").trim();
    const n = parseProjectNumber_(v);
    if (n === null) continue;
    if (n > maxN) maxN = n;
  }
  return "p" + String(maxN + 1);
}
function parseProjectNumber_(projectId) {
  const m = String(projectId || "").trim().match(/^p(\d+)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (isNaN(n)) return null;
  return n;
}
function indexMapFromHeader_(header) {
  const map = {};
  header.forEach((h, i) => { map[String(h)] = i; });

  function must(name){
    const idx = map[name];
    if (idx === undefined) throw new Error("header missing: " + name);
    return idx;
  }

  return {
    projectId: must("projectId"),
    projectName: must("projectName"),
    clientName: must("clientName"),
    status: must("status"),
    notes: must("notes"),
    createdAt: must("createdAt"),
    updatedAt: must("updatedAt")
  };
}
function api_getMembersMasterForNewProject(){
  if (!isAdmin_()) return { ok:false, members:[] };

  // ★正本：DB_Members.status だけで active/inactive を判定する
  try{
    const sh = getSheet_("DB_Members");
    const values = sh.getDataRange().getValues();
    if (!values || values.length < 2) return { ok:true, members:[] };

    const h = values[0].map(x => String(x||"").trim());
    const iMemberId = h.indexOf("memberId");
    const iCodeName = h.indexOf("codeName");
    const iStatus   = h.indexOf("status");

    if (iMemberId < 0 || iCodeName < 0) {
      return { ok:false, members:[], message:"DB_Members missing memberId/codeName" };
    }
    if (iStatus < 0) {
      // ★statusが無いなら正しく判定できないので落とす（黙って全員出すのが一番危険）
      return { ok:false, members:[], message:"DB_Members missing status" };
    }

    const out = [];
    for (let r=1; r<values.length; r++){
      const mid = String(values[r][iMemberId]||"").trim();
      if (!mid) continue;

      const st = String(values[r][iStatus]||"").trim().toLowerCase();
      if (st !== "active") continue;

      const codeName = String(values[r][iCodeName]||"").trim() || mid;
      out.push({ memberId: mid, codeName });
    }

    return { ok:true, members: out };
  } catch(e){
    return { ok:false, members:[], message: (e && e.message) ? e.message : String(e) };
  }
}

function debug_homeRoutineProbe(){
  const ym = getCurrentYm_();
  const m = getBillingTaskStatusMap_(ym);

  const pick = ["p21","p26","p31","p32","p33"];

  const out = {
    ym,
    keysCount: Object.keys(m || {}).length,
    picked: {}
  };

  pick.forEach(pid => {
    out.picked[pid] = m[pid] || null;
  });

  Logger.log("[debug_homeRoutineProbe] %s", JSON.stringify(out));
  return out;
}

function stablePickIndex(seedStr){
  // FNV-1a風（軽くて十分）
  const s = String(seedStr || "");
  let h = 2166136261;
  for (let i=0; i<s.length; i++){
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
