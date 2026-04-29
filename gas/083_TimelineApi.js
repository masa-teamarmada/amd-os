/** 083_TimelineApi.gs
 * 役割：
 * - TimelinePage 用のサーバAPI入口
 * - Billing（api_getBillingPageDataLite / api_getBillingPageExtras）を正本として「読んで」Timeline用DTOに変換して返す
 * - 書き込みはしない（Phase1）
 *
 * 返却DTO（UI向け）：
 * {
 *   ok, message,
 *   projectId, baseYmKey, laneCount,
 *   lanes: ["yyyymm", ...],
 *   dateRange: { startIso:"YYYY-MM-DD", endIso:"YYYY-MM-DD" },
 *   bizTasks: [ { bizYm, taskKey, title, kind, startIso, endIso, spanDays, dueIso, status:{done,level,text} } ... ],
 *   pjTasks: [] // Phase1は空
 * }
 */

function api_getTimelineInit(payload){
  payload = payload || {};

  const prof = _tl_profStart_("api_getTimelineInit");

  const projectId = String(payload.projectId || "").trim();
  const baseYmKey = _tl_normYmKey(String(payload.baseYmKey || payload.ymKey || "").trim());
  const laneCount = 4;

  if (!projectId){
    return { ok:false, message:"projectId required", profile:_tl_profEnd_(prof) };
  }
  if (!canAccessProject_(projectId)){
    return { ok:false, message:"access denied", profile:_tl_profEnd_(prof) };
  }

  const baseKey = baseYmKey || _tl_yyyymmFromDate_(new Date());

  // init cache（DTO丸ごと）
  const cache = CacheService.getScriptCache();
  const initKey = `TL_INIT|${projectId}|${baseKey}|${laneCount}`;

  try{
    const hit = cache.get(initKey);
    if (hit){
      const obj = JSON.parse(hit);
      if (obj && obj.ok){
        _tl_profMark_(prof, "cacheHit:init");
        obj.profile = _tl_profEnd_(prof);
        return obj;
      }
    }
  }catch(e){
    _tl_profMark_(prof, "cacheGet:init:fail", { err: String(e && (e.message || e) || "unknown") });
  }
  _tl_profMark_(prof, "cacheMiss:init");

  // lanes
  const lanes = [];
  for (let i=0; i<laneCount; i++){
    lanes.push(_tl_addMonthsYmKey_(baseKey, i));
  }
  _tl_profMark_(prof, "lanesBuilt", { lanes: lanes.length });

  // ★DB_BillingCycle を4ヶ月分まとめ取り
  const tBatch0 = Date.now();
  const cycleMap = _tl_fetchCyclesBatch_(projectId, lanes); // key=yyyymm
  const tBatch1 = Date.now();
  _tl_profMark_(prof, "cyclesBatchFetched", { ms: (tBatch1 - tBatch0) });

  const today = _tl_todayJst_();
  const bizTasks = [];

  let globalMin = null;
  let globalMax = null;

  for (let i=0; i<lanes.length; i++){
    const bizYm = lanes[i];

    const cyc = (cycleMap && cycleMap[bizYm]) ? cycleMap[bizYm] : null;

    const pack = {
      lite: { billing: cyc || {} },
      extras: null
    };

    const tl = _tl_buildBizTasksFromBilling_(bizYm, pack, today);
    (tl || []).forEach(t=>{
      bizTasks.push(t);
      const s = _tl_dateFromIso_(t.startIso);
      const e = _tl_dateFromIso_(t.endIso);
      globalMin = globalMin ? _tl_minDate_(globalMin, s) : s;
      globalMax = globalMax ? _tl_maxDate_(globalMax, e) : e;
    });
  }

  if (!globalMin) globalMin = today;
  if (!globalMax) globalMax = today;

  const rangeStart = _tl_addDays_(globalMin, -2);
  const rangeEnd   = _tl_addDays_(globalMax, 2);

  // ★monthlyObserve は init では作らない（重いので後追いロード）
  _tl_profMark_(prof, "monthlyObserveSkipped");

  const out = {
    ok: true,
    message: "",
    projectId,
    baseYmKey: baseKey,
    laneCount,
    lanes,
    dateRange: {
      startIso: _tl_isoDate_(rangeStart),
      endIso: _tl_isoDate_(rangeEnd)
    },
    bizTasks,
    pjTasks: [],
    monthlyObserve: null,
    monthlyObserveDeferred: true
  };

  try{
    cache.put(initKey, JSON.stringify(out), 120);
    _tl_profMark_(prof, "cachePut:init", { ttlSec:120 });
  }catch(e){
    _tl_profMark_(prof, "cachePut:init:fail", { err: String(e && (e.message || e) || "unknown") });
  }

  out.profile = _tl_profEnd_(prof);
  return out;
}

/**
 * Monthly Observe をキャッシュして返す（initキャッシュとは別キー）
 * - initKeyは120秒、observeKeyは120秒（まず体感優先）
 */
function _tl_getMonthlyObserveCached_(projectId, ymKey, optMonthly){
  const cache = CacheService.getScriptCache();

  // ★monthlyが渡ってきた場合、cache key に updatedAt を混ぜて「古いobserve返し」を避ける
  const m = (optMonthly && typeof optMonthly === "object") ? optMonthly : null;
  const upd = m ? String(m.updatedAt || "").trim() : "";
  const obsKey = `TL_OBS|${projectId}|${ymKey}|${upd || "-"}`;

  try{
    const hit = cache.get(obsKey);
    if (hit){
      const obj = JSON.parse(hit);
      if (obj && obj.ok) return obj;
    }
  }catch(e){}

  const obs = _tl_buildMonthlyObserve_(projectId, ymKey, optMonthly);

  try{
    cache.put(obsKey, JSON.stringify(obs), 120);
  }catch(e){}

  return obs;
}

/**
 * Timeline最上段カード用：
 * - Navigator月次（projectId+ym）を読んで観測メタを作る
 * - “前回スナップショット” は別キャッシュ（10分）で差分を作る
 */
function _tl_buildMonthlyObserve_(projectId, ymKey, optMonthly){
  const out = {
    ok: true,
    ym: String(ymKey || "").trim(),
    updatedAtJst: "",
    sourceCounts: { monthlyItems:0, nudgeItems:0, issuesOpen:0 },
    diff: { itemsDelta:0, prevUpdatedAtJst:"", fieldsChanged:[] },
    meaningDiff: "",
    profile: [] // ★追加：どこが重いか返す
  };

  const tAll0 = Date.now();
  function mark_(step){
    out.profile.push({ step: String(step||""), ms: Date.now() - tAll0 });
  }

  if (!projectId || !/^\d{6}$/.test(String(ymKey||""))){
    out.ok = false;
    out.meaningDiff = "projectId/ymが無い";
    mark_("invalidArgs");
    return out;
  }

  // 1) monthly
  mark_("monthly:begin");
  let monthly = null;

  if (optMonthly && typeof optMonthly === "object"){
    monthly = optMonthly;
    mark_("monthly:fromPayload");
  } else {
    let nav = null;
    try{
      if (typeof nav_getNavigatorPageData === "function"){
        nav = nav_getNavigatorPageData({ projectId: projectId, ym: ymKey });
      }
    }catch(e){
      nav = null;
    }
    monthly = (nav && nav.ok && nav.monthly) ? nav.monthly : {};
    mark_("monthly:fromNav");
  }

  const updatedAtRaw = String(monthly.updatedAt || "").trim();
  out.updatedAtJst = _tl_fmtJstDateTime_(updatedAtRaw);

  const mItems = (monthly && Array.isArray(monthly.items)) ? monthly.items : [];
  out.sourceCounts.monthlyItems = mItems.length;
  mark_("monthly:done");

  // 2) nudge
  mark_("nudge:begin");
  let nudgeCount = 0;
  try{
    if (typeof nav_listMonthlyNudgeProgressItems === "function"){
      const rN = nav_listMonthlyNudgeProgressItems({ projectId: projectId, ym: ymKey, limit: 9999 });
      if (rN && rN.ok && Array.isArray(rN.items)) nudgeCount = rN.items.length;
    }
  }catch(e){
    nudgeCount = 0;
  }
  out.sourceCounts.nudgeItems = nudgeCount;
  mark_("nudge:done");

  // 3) issues
  mark_("issues:begin");
  let issuesOpen = 0;
  try{
    if (typeof nav_listIssues === "function"){
      const rI = nav_listIssues({ projectId: projectId });
      const issues = (rI && rI.ok && Array.isArray(rI.issues)) ? rI.issues : [];
      issuesOpen = issues.filter(x=>{
        const st = String(x && x.status ? x.status : "").toLowerCase();
        return st !== "decided" && st !== "closed";
      }).length;
    }
  }catch(e){
    issuesOpen = 0;
  }
  out.sourceCounts.issuesOpen = issuesOpen;
  mark_("issues:done");

  // 4) snapshot/diff
  mark_("snap:begin");
  const cache = CacheService.getScriptCache();
  const snapKey = `TL_OBS_SNAP|${projectId}|${ymKey}`;

  const curSnap = {
    updatedAtJst: out.updatedAtJst,
    itemsCount: out.sourceCounts.monthlyItems,
    fp: _tl_fingerprintMonthly_(monthly)
  };

  let prevSnap = null;
  try{
    const raw = cache.get(snapKey);
    if (raw) prevSnap = JSON.parse(raw);
  }catch(e){
    prevSnap = null;
  }

  if (prevSnap && prevSnap.fp){
    out.diff.itemsDelta = Number(curSnap.itemsCount || 0) - Number(prevSnap.itemsCount || 0);
    out.diff.prevUpdatedAtJst = String(prevSnap.updatedAtJst || "").trim();

    const changed = _tl_diffMonthlyFp_(String(prevSnap.fp||""), String(curSnap.fp||""));
    out.diff.fieldsChanged = changed;

    out.meaningDiff = _tl_buildMeaningDiffText_(out);
  } else {
    out.diff.itemsDelta = 0;
    out.diff.prevUpdatedAtJst = "";
    out.diff.fieldsChanged = [];
    out.meaningDiff = "初回観測。ここから育つ";
  }

  try{
    cache.put(snapKey, JSON.stringify(curSnap), 600);
  }catch(e){}
  mark_("snap:done");

  mark_("end");
  return out;
}

function _tl_fingerprintMonthly_(monthly){
  const m = monthly || {};
  const parts = [
    "summary=" + _tl_fpPart_(m.summary),
    "decided=" + _tl_fpPart_(m.decided),
    "openQuestions=" + _tl_fpPart_(m.openQuestions),
    "gapToPlan=" + _tl_fpPart_(m.gapToPlan),
    "risks=" + _tl_fpPart_(m.risks),
    "nextMeetingAdvice=" + _tl_fpPart_(m.nextMeetingAdvice)
  ];
  return parts.join("|");
}

function _tl_fpPart_(s){
  const t = String(s || "").trim();
  if (!t) return "0";
  return String(t.length) + ":" + t.slice(0, 80);
}

function _tl_diffMonthlyFp_(prevFp, curFp){
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

function _tl_buildMeaningDiffText_(obs){
  const d = obs && obs.diff ? obs.diff : {};
  const sc = obs && obs.sourceCounts ? obs.sourceCounts : {};
  const delta = Number(d.itemsDelta || 0);

  const parts = [];

  if (delta > 0) parts.push(`根拠ログ +${delta}`);
  if (delta < 0) parts.push(`根拠ログ ${delta}`);
  if (delta === 0) parts.push("根拠ログ ±0");

  const fc = Array.isArray(d.fieldsChanged) ? d.fieldsChanged : [];
  if (fc.length) parts.push(`本文更新: ${fc.join(", ")}`);
  else parts.push("本文更新なし");

  parts.push(`nudge:${Number(sc.nudgeItems||0)} issues:${Number(sc.issuesOpen||0)}`);

  return parts.join(" / ");
}

function _tl_fmtJstDateTime_(iso){
  const s = String(iso || "").trim();
  if (!s) return "";

  try{
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;

    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }catch(e){
    return s;
  }
}

/* =========================
 * 内部：Billing取得（Lite + Extras）
 * ========================= */

function _tl_fetchBillingPack_(projectId, ymInput, opt){
  opt = opt || {};
  const includeExtras = !!opt.includeExtras;

  // ===== 同リクエスト内メモ（最速）=====
  // Apps Scriptは同一実行内でglobalが生きるので、ここで8回を確実に潰す
  const memoKey = `${projectId}|${ymInput}|${includeExtras ? "1" : "0"}`;
  if (!_tl_fetchBillingPack_._memo) _tl_fetchBillingPack_._memo = {};
  const memo = _tl_fetchBillingPack_._memo;
  if (memo[memoKey]) return memo[memoKey];

  const out = { lite:null, extras:null };

  const cache = CacheService.getScriptCache();

  // ===== Lite（必須）をキャッシュ =====
  // TTLは少し長めでもOK（5分）
  const liteKey = `TL_BILL_LITE|${projectId}|${ymInput}`;
  const t0 = Date.now();

  try{
    const hit = cache.get(liteKey);
    if (hit){
      out.lite = JSON.parse(hit);
    }
  }catch(e){}

  if (!out.lite){
    out.lite = _tl_callGlobalFn_("api_getBillingPageDataLite", [projectId, ymInput]);
    try{
      if (out.lite) cache.put(liteKey, JSON.stringify(out.lite), 300);
    }catch(e){}
  }

  const t1 = Date.now();

  // ===== Extras（任意）をキャッシュ =====
  if (includeExtras){
    const exKey = `TL_BILL_EXTRAS|${projectId}|${ymInput}`;
    try{
      const hit2 = cache.get(exKey);
      if (hit2){
        out.extras = JSON.parse(hit2);
      }
    }catch(e){}

    if (!out.extras){
      out.extras = _tl_callGlobalFn_("api_getBillingPageExtras", [projectId, ymInput]);
      try{
        if (out.extras) cache.put(exKey, JSON.stringify(out.extras), 300);
      }catch(e){}
    }
  } else {
    out.extras = null;
  }

  const t2 = Date.now();

  // profileに入れたい人向け（api_getTimelineInit側が拾う）
  out._perf = {
    liteMs: (t1 - t0),
    extrasMs: includeExtras ? (t2 - t1) : 0,
    includeExtras: includeExtras
  };

  memo[memoKey] = out;
  return out;
}

function _tl_callGlobalFn_(fnName, args){
  try{
    const fn = this[fnName];
    if (typeof fn !== "function") return null;
    return fn.apply(this, args || []);
  } catch(e){
    return null;
  }
}

/* =========================
 * 内部：Timeline task 生成（bizYmレーン）
 * ========================= */

function _tl_buildBizTasksFromBilling_(bizYmKey, pack, todayJst){
  const lite = pack ? pack.lite : null;
  const extras = pack ? pack.extras : null;

  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});
  const agreement = _tl_pickAgreement_(extras);

  // ★ここが欠けてた（これが無いと t.push で落ちる）
  const t = [];

  // ===== 休日補正（UI側と同等） =====
  function isWeekend_(d){
    const w = d.getDay();
    return w === 0 || w === 6;
  }
  function isFixedHolidayJp_(d){
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const mmdd = `${mm}/${dd}`;
    const fixed = {
      "01/01":1,"02/11":1,"04/29":1,"05/03":1,"05/04":1,"05/05":1,"08/11":1,"11/03":1,"11/23":1
    };
    return !!fixed[mmdd];
  }
  function isHiddenDay_(d){
    return isWeekend_(d) || isFixedHolidayJp_(d);
  }
  function prevVisibleDay_(d){
    const x = new Date(d.getTime());
    for (let i=0; i<30; i++){
      if (!isHiddenDay_(x)) return x;
      x.setDate(x.getDate() - 1);
    }
    return x;
  }
  function adjustStart_(d){
    return isHiddenDay_(d) ? prevVisibleDay_(d) : d;
  }

  const ov = _tl_safeJson_(billing && billing.adminOverrideJson);
  const ovDone = function(key){
    return (ov && Object.prototype.hasOwnProperty.call(ov, key)) ? !!ov[key] : false;
  };

  const meetingFact = _tl_hasVal_(billing && billing.meetingEventId);
  const reportFact  = _tl_hasVal_(billing && billing.monthlyReportUrl);
  const budgetFact  = _tl_hasVal_(billing && billing.budgetConfirmedAt);

  const allocFact =
    _tl_hasVal_(billing && billing.allocationConfirmedAt) &&
    agreement &&
    _tl_hasVal_(agreement.latestVersion) &&
    Number(agreement.totalCount || 0) > 0 &&
    Number(agreement.agreedCount || 0) === Number(agreement.totalCount || 0);

  const invoiceFact = _tl_hasVal_(billing && billing.invoiceSentAt);
  const payFact     = _tl_hasVal_(billing && billing.paymentConfirmedAt);

  const done = {
    budgetAlloc:  (budgetFact || ovDone("nextBudget")) && (allocFact || ovDone("allocation")),
    report:       reportFact  || ovDone("report"),
    mtgSched:     meetingFact || ovDone("schedule"),
    mtgHeld:      meetingFact || ovDone("schedule"),
    reimbFix:     false,
    invoiceSend:  invoiceFact || ovDone("invoiceSend"),
    paidConfirm:  payFact     || ovDone("paymentCheck")
  };

  // 日付ルール（まさ仕様）
  const base = _tl_dateFromYmKey_(bizYmKey);
  const prev = _tl_addMonths_(base, -1);
  const next = _tl_addMonths_(base,  1);

  const dueBudget = _tl_makeDate_(prev.getFullYear(), prev.getMonth()+1, 15);

  const dueSched  = _tl_makeDate_(base.getFullYear(), base.getMonth()+1, 10);
  const meetStart = _tl_makeDate_(base.getFullYear(), base.getMonth()+1, 20);
  const meetEnd   = _tl_makeDate_(base.getFullYear(), base.getMonth()+1, 30);

  const reportDue = _tl_addDays_(meetStart, -1);

  const dueReimb  = _tl_makeDate_(next.getFullYear(), next.getMonth()+1, 4);
  const dueSend   = _tl_makeDate_(next.getFullYear(), next.getMonth()+1, 9);
  const duePaid   = _tl_makeDate_(next.getFullYear(), next.getMonth()+1, _tl_lastDayOfMonth_(next.getFullYear(), next.getMonth()+1));

  const band = function(due){
    const start = _tl_addDays_(due, -5);
    const end = due;
    return { start, end };
  };

  // ★会議枠：未確定なら「枠（20-30）」、確定したら「1日枠＋実線」
  const meetingStartAt = String(billing.meetingStartAt || "").trim();
  let mtgMode = "frame";
  let mtgDate = null;
  if (meetingStartAt){
    const d0 = new Date(meetingStartAt);
    if (!isNaN(d0.getTime())){
      mtgMode = "fixed";
      mtgDate = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0,0,0,0);
    }
  }

  // ① budgetAlloc
  (function(){
    const b = band(dueBudget);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "budgetAlloc",
      title: "予算配賦案確定",
      kind: "decision",
      start: s,
      end: b.end,
      due: dueBudget,
      done: !!done.budgetAlloc,
      today: todayJst
    }));
  })();

  // ② report
  (function(){
    const b = band(reportDue);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "report",
      title: "月次報告（前日まで）",
      kind: "ops",
      start: s,
      end: b.end,
      due: reportDue,
      done: !!done.report,
      today: todayJst
    }));
  })();

  // ③ mtgSched
  (function(){
    const b = band(dueSched);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "mtgSched",
      title: "月次報告会 スケジューリング",
      kind: "meeting",
      start: s,
      end: b.end,
      due: dueSched,
      done: !!done.mtgSched,
      today: todayJst
    }));
  })();

  // ④ mtgHeld
  (function(){
    if (mtgMode === "fixed" && mtgDate){
      t.push(_tl_task_({
        bizYm: bizYmKey,
        taskKey: "mtgHeld",
        title: "月次報告会",
        kind: "meeting",
        start: adjustStart_(mtgDate),
        end: mtgDate,
        due: mtgDate,
        done: !!done.mtgHeld,
        today: todayJst,
        ui: { meetingMode:"fixed" }
      }));
    } else {
      t.push(_tl_task_({
        bizYm: bizYmKey,
        taskKey: "mtgHeld",
        title: "月次報告会枠",
        kind: "meeting",
        start: adjustStart_(meetStart),
        end: meetEnd,
        due: meetEnd,
        done: !!done.mtgHeld,
        today: todayJst,
        ui: { meetingMode:"frame" }
      }));
    }
  })();

  // ⑤ reimbFix
  (function(){
    const b = band(dueReimb);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "reimbFix",
      title: "立替FIX",
      kind: "ops",
      start: s,
      end: b.end,
      due: dueReimb,
      done: !!done.reimbFix,
      today: todayJst
    }));
  })();

  // ⑥ invoiceSend
  (function(){
    const b = band(dueSend);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "invoiceSend",
      title: "請求書作成・送付",
      kind: "ops",
      start: s,
      end: b.end,
      due: dueSend,
      done: !!done.invoiceSend,
      today: todayJst
    }));
  })();

  // ⑦ paidConfirm
  (function(){
    const b = band(duePaid);
    const s = adjustStart_(b.start);
    t.push(_tl_task_({
      bizYm: bizYmKey,
      taskKey: "paidConfirm",
      title: "着金確認",
      kind: "ops",
      start: s,
      end: b.end,
      due: duePaid,
      done: !!done.paidConfirm,
      today: todayJst
    }));
  })();

  return t;
}

function _tl_pickAgreement_(extras){
  // BillingPage.html は extras から agreement を差し込むので、それに寄せる
  if (!extras) return null;

  // ありがちな形：{agreement:{...}} or {data:{agreement:{...}}}
  if (extras.agreement) return extras.agreement;
  if (extras.data && extras.data.agreement) return extras.data.agreement;

  // 低確率の互換
  if (extras.latestVersion || extras.agreedCount || extras.totalCount){
    return {
      latestVersion: extras.latestVersion || "",
      agreedCount: Number(extras.agreedCount || 0),
      totalCount: Number(extras.totalCount || 0)
    };
  }

  return null;
}

/* =========================
 * 内部：task整形（status/level）
 * ========================= */

function _tl_task_(p){
  const spanDays = _tl_spanDays_(p.start, p.end);

  // deadline判定（Billingと同じ：diff<0 bad, diff<=3 warn）
  const level = (function(){
    if (p.done) return "ok";
    const diff = _tl_daysDiff_(p.today, p.due);
    if (diff < 0) return "bad";
    if (diff <= 3) return "warn";
    return "todo";
  })();

  const text = (function(){
    if (p.done) return "完";
    if (level === "bad") return "超過";
    if (level === "warn") return "期限";
    return "未";
  })();

  return {
    bizYm: p.bizYm,
    taskKey: p.taskKey,
    title: p.title,
    kind: p.kind,
    startIso: _tl_isoDate_(p.start),
    endIso: _tl_isoDate_(p.end),
    dueIso: _tl_isoDate_(p.due),
    spanDays: spanDays,
    status: {
      done: !!p.done,
      level,
      text
    }
  };
}

/* =========================
 * Server Profiler（Homeのprofile互換）
 * ========================= */

function _tl_profStart_(name){
  return {
    name: String(name || "").trim() || "profile",
    t0: Date.now(),
    rows: [{ step:"start", ms:0 }]
  };
}

function _tl_profMark_(prof, step, extra){
  if (!prof || !prof.rows) return;
  const ms = Date.now() - prof.t0;
  const row = { step: String(step || "").trim() || "?", ms: ms };
  if (extra && typeof extra === "object"){
    Object.keys(extra).forEach(k => { row[k] = extra[k]; });
  }
  prof.rows.push(row);
}

function _tl_profEnd_(prof){
  if (!prof || !prof.rows) return [];
  _tl_profMark_(prof, "end");
  return prof.rows;
}

/**
 * Timeline専用：BillingCycleから「必要最低限」だけ取るLite
 * - BillingPageのheavyな構築処理を踏まない
 * - 正本はあくまでDB_BillingCycle（Billingと同じ）
 *
 * 返す形は _tl_buildBizTasksFromBilling_ が期待する billing に寄せる
 */
function _tl_fetchTimelineCycleLite_(projectId, bizYmKey){
  const prof = _tl_profStart_("_tl_fetchTimelineCycleLite_");

  const ymKey = _tl_normYmKey(bizYmKey);
  const ymInput = _tl_ymInputFromKey_(ymKey);

  // キャッシュ（5分）
  const cache = CacheService.getScriptCache();
  const cacheKey = `TL_CYCLE_LITE|${projectId}|${ymKey}`;

  try{
    const hit = cache.get(cacheKey);
    if (hit){
      const obj = JSON.parse(hit);
      if (obj && obj.billing){
        _tl_profMark_(prof, "cacheHit", { ymKey: ymKey });
        obj._profile = _tl_profEnd_(prof);
        return obj;
      }
    }
  }catch(e){
    _tl_profMark_(prof, "cacheGetFail", { err: String(e && (e.message || e) || "unknown") });
  }

  _tl_profMark_(prof, "cacheMiss", { ymKey: ymKey });

  // BillingCycleを読む（正本）
  // b_getCycleOne_ は既にある想定（AMD OSのBilling正本）
  let cycle = {};
  try{
    if (typeof b_getCycleOne_ === "function"){
      cycle = b_getCycleOne_(projectId, ymInput) || {};
    }
  }catch(e){
    cycle = {};
  }
  _tl_profMark_(prof, "cycleFetched");

  // Timelineが必要なキーだけ抜く
  const billing = {
    // meeting
    meetingEventId: String(cycle.meetingEventId || "").trim(),
    meetingStartAt: String(cycle.meetingStartAt || "").trim(),

    // report
    monthlyReportUrl: String(cycle.monthlyReportUrl || "").trim(),

    // budget/alloc
    budgetConfirmedAt: String(cycle.budgetConfirmedAt || "").trim(),
    allocationConfirmedAt: String(cycle.allocationConfirmedAt || "").trim(),

    // invoice/payment
    invoiceSentAt: String(cycle.invoiceSentAt || "").trim(),
    paymentConfirmedAt: String(cycle.paymentConfirmedAt || "").trim(),

    // override
    adminOverrideJson: String(cycle.adminOverrideJson || "").trim()
  };

  const out = { billing: billing, ymInput: ymInput };

  try{
    cache.put(cacheKey, JSON.stringify(out), 300);
    _tl_profMark_(prof, "cachePut", { ttlSec: 300 });
  }catch(e){
    _tl_profMark_(prof, "cachePutFail", { err: String(e && (e.message || e) || "unknown") });
  }

  out._profile = _tl_profEnd_(prof);
  return out;
}

/**
 * DB_BillingCycle を「projectId × ymKeys(set)」で一括取得する
 * - Spreadsheet読みは1回だけ
 * - 必要最低限の列だけ DTO 化
 * - ScriptCacheで5分キャッシュ
 *
 * returns:
 * {
 *   "yyyymm": { ...cycleRow... } | null,
 *   ...
 * }
 */
function _tl_fetchCyclesBatch_(projectId, ymKeys){
  const pid = String(projectId || "").trim();
  const keys = Array.isArray(ymKeys) ? ymKeys.map(x=>String(x||"").trim()).filter(x=>/^\d{6}$/.test(x)) : [];
  const uniq = Array.from(new Set(keys)).sort();

  const out = {};
  uniq.forEach(k => out[k] = null);

  if (!pid || !uniq.length) return out;

  const cache = CacheService.getScriptCache();
  const cacheKey = `TL_CYCLES_BATCH|${pid}|${uniq.join(",")}`;

  try{
    const hit = cache.get(cacheKey);
    if (hit){
      const obj = JSON.parse(hit);
      if (obj && typeof obj === "object"){
        uniq.forEach(k => { if (!(k in obj)) obj[k] = null; });
        return obj;
      }
    }
  }catch(e){}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_BillingCycle");
  if (!sh) return out;

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return out;

  // header
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(x => String(x || "").trim());
  const idx0 = {};
  header.forEach((h,i)=>{ if (h) idx0[h] = i; }); // ★0-based

  function idx_(name){
    const i = idx0[name];
    return (i !== undefined && i !== null && i >= 0) ? i : -1;
  }

  const iProjectId = idx_("projectId");
  const iYm        = idx_("ym");
  if (iProjectId < 0 || iYm < 0) return out;

  // 必要列（0-based index）
  const I = {
    meetingEventId:        idx_("meetingEventId"),
    meetingStartAt:        idx_("meetingStartAt"),
    monthlyReportUrl:      idx_("monthlyReportUrl"),
    budgetConfirmedAt:     idx_("budgetConfirmedAt"),
    allocationConfirmedAt: idx_("allocationConfirmedAt"),
    invoiceSentAt:         idx_("invoiceSentAt"),
    paymentConfirmedAt:    idx_("paymentConfirmedAt"),
    adminOverrideJson:     idx_("adminOverrideJson")
  };

  // ★ここが肝：データ領域を「1回だけ」読む（列ごと連打をやめる）
  const n = lastRow - 1;
  const values = sh.getRange(2, 1, n, lastCol).getValues();

  const want = new Set(uniq);

  for (let r = 0; r < values.length; r++){
    const row = values[r];

    const rowPid = String(row[iProjectId] || "").trim();
    if (rowPid !== pid) continue;

    const ym = String(row[iYm] || "").trim();
    if (!want.has(ym)) continue;

    out[ym] = {
      meetingEventId:        (I.meetingEventId        >= 0) ? String(row[I.meetingEventId]        || "").trim() : "",
      meetingStartAt:        (I.meetingStartAt        >= 0) ? String(row[I.meetingStartAt]        || "").trim() : "",
      monthlyReportUrl:      (I.monthlyReportUrl      >= 0) ? String(row[I.monthlyReportUrl]      || "").trim() : "",
      budgetConfirmedAt:     (I.budgetConfirmedAt     >= 0) ? String(row[I.budgetConfirmedAt]     || "").trim() : "",
      allocationConfirmedAt: (I.allocationConfirmedAt >= 0) ? String(row[I.allocationConfirmedAt] || "").trim() : "",
      invoiceSentAt:         (I.invoiceSentAt         >= 0) ? String(row[I.invoiceSentAt]         || "").trim() : "",
      paymentConfirmedAt:    (I.paymentConfirmedAt    >= 0) ? String(row[I.paymentConfirmedAt]    || "").trim() : "",
      adminOverrideJson:     (I.adminOverrideJson     >= 0) ? String(row[I.adminOverrideJson]     || "").trim() : ""
    };

    // 4ヶ月ぶん揃ったら早期終了
    // （uniqはlaneCount分でだいたい4）
    let filled = 0;
    for (let i=0; i<uniq.length; i++){
      if (out[uniq[i]]) filled++;
    }
    if (filled >= uniq.length) break;
  }

  try{
    cache.put(cacheKey, JSON.stringify(out), 300);
  }catch(e){}

  return out;
}

/* =========================
 * Util
 * ========================= */

function _tl_normYmKey(s){
  const v = String(s || "").trim();
  if (!v) return "";
  if (/^\d{6}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return v.replace("-", "");
  const d = v.replace(/[^\d]/g, "").slice(0, 6);
  return /^\d{6}$/.test(d) ? d : "";
}

function _tl_ymInputFromKey_(ymKey){
  const s = String(ymKey || "").trim();
  if (!/^\d{6}$/.test(s)) return "";
  return s.slice(0,4) + "-" + s.slice(4,6);
}

function _tl_dateFromYmKey_(ymKey){
  const s = String(ymKey || "").trim();
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6));
  return new Date(y, (m||1)-1, 1, 0,0,0,0);
}

function _tl_yyyymmFromDate_(d){
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  return String(yy) + mm;
}

function _tl_addMonthsYmKey_(ymKey, delta){
  const d = _tl_dateFromYmKey_(ymKey);
  const n = _tl_addMonths_(d, Number(delta || 0));
  return _tl_yyyymmFromDate_(n);
}

function _tl_addMonths_(dateObj, delta){
  const d = new Date(dateObj.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(delta || 0));
  return d;
}

function _tl_makeDate_(y, m1to12, day){
  return new Date(Number(y||0), Number(m1to12||1)-1, Number(day||1), 0,0,0,0);
}

function _tl_lastDayOfMonth_(y, m1to12){
  return new Date(Number(y||0), Number(m1to12||1), 0).getDate();
}

function _tl_isoDate_(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

function _tl_dateFromIso_(iso){
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 0,0,0,0);
}

function _tl_addDays_(d, delta){
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + Number(delta||0));
  return x;
}

function _tl_spanDays_(start, end){
  const ms = 24*60*60*1000;
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.max(1, Math.floor((b - a) / ms) + 1);
}

function _tl_daysDiff_(fromDate, toDate){
  const ms = 24*60*60*1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.floor((b - a) / ms);
}

function _tl_todayJst_(){
  // Apps Script実行はJST想定（プロジェクト設定でもJSTのはず）
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
}

function _tl_hasVal_(x){
  return !!(x && String(x).trim());
}

function _tl_safeJson_(s){
  try{
    const t = String(s || "").trim();
    if (!t) return {};
    return JSON.parse(t);
  } catch(e){
    return {};
  }
}

function _tl_clampInt(v, min, max, def){
  const n = parseInt(String(v ?? ""), 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function _tl_minDate_(a,b){ return (a.getTime() <= b.getTime()) ? a : b; }
function _tl_maxDate_(a,b){ return (a.getTime() >= b.getTime()) ? a : b; }

/** meetingSched モーダル用：Billing Lite を読んで必要情報だけ返す */
function api_getTimelineMeetingSchedDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = String(payload.bizYmKey || "").trim(); // yyyymm

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const ymInput = bizYmKey.slice(0,4) + "-" + bizYmKey.slice(4,6); // yyyy-mm

  // Billing Lite を正本として読む（存在しない/失敗しても落とさない）
  let lite = null;
  try{
    if (typeof api_getBillingPageDataLite === "function"){
      lite = api_getBillingPageDataLite(projectId, ymInput);
    }
  } catch(e){
    lite = null;
  }

  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});
  const invoiceRecipients = (lite && lite.invoiceRecipients) ? lite.invoiceRecipients : (lite && lite.data && lite.data.invoiceRecipients ? lite.data.invoiceRecipients : {});

  // 期間デフォルト（Billingの presetRangeDates と同じ：当月25〜月末）
  const y = Number(ymInput.slice(0,4));
  const m = Number(ymInput.slice(5,7));
  const rangeStart = new Date(y, m-1, 25, 0,0,0,0);
  const rangeEnd = new Date(y, m, 0, 0,0,0,0);

  function isoDate(d){
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yy}-${mm}-${dd}`;
  }

  return {
    ok: true,
    message: "",
    projectId,
    bizYmKey,
    ymInput,

    meeting: {
      meetingEventId: String(billing.meetingEventId || "").trim(),
      meetingStartAt: String(billing.meetingStartAt || "").trim(),
      meetingHtmlLink: String(billing.meetingHtmlLink || "").trim(),
      // 期限（表示したければ使う）
      dueDay: 10,
      // デフォ期間
      rangeStart: isoDate(rangeStart),
      rangeEnd: isoDate(rangeEnd)
    },

    // ついでに宛先系も返しておく（将来モーダルで使う余地）
    invoiceRecipients: invoiceRecipients || {}
  };
}

/** meetingHold モーダル用：開催帯の情報（会議/リンク/報告書URL）を返す */
function api_getTimelineMeetingHoldDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = String(payload.bizYmKey || "").trim(); // yyyymm

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const ymInput = bizYmKey.slice(0,4) + "-" + bizYmKey.slice(4,6); // yyyy-mm

  let lite = null;
  try{
    if (typeof api_getBillingPageDataLite === "function"){
      lite = api_getBillingPageDataLite(projectId, ymInput);
    }
  } catch(e){
    lite = null;
  }

  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});

  const meetingEventId = String(billing.meetingEventId || "").trim();
  const meetingStartAt = String(billing.meetingStartAt || "").trim();
  const meetingHtmlLink = String(billing.meetingHtmlLink || "").trim();

  // BillingCycle側の月報URL
  const monthlyReportUrl = String(billing.monthlyReportUrl || "").trim();

  // Calendar description（AMD OSブロック抜粋）
  let calendarDesc = "";
  let amdOsBlock = "";

  try{
    if (meetingEventId && typeof BILLING_CFG !== "undefined" && BILLING_CFG && BILLING_CFG.HUB_CALENDAR_ID){
      const calId = String(BILLING_CFG.HUB_CALENDAR_ID || "").trim();
      if (calId){
        const ev = Calendar.Events.get(calId, meetingEventId);
        calendarDesc = String(ev && ev.description ? ev.description : "");

        // AMD OSブロックの切り出し（B_CalendarMonthly.gsと同じマーカー）
        const START = "=== AMD OS ===";
        const END   = "=== /AMD OS ===";

        const s = calendarDesc.indexOf(START);
        const e = calendarDesc.indexOf(END);
        if (s >= 0 && e > s){
          amdOsBlock = calendarDesc.slice(s, e + END.length).trim();
        }
      }
    }
  } catch(e){
    // Calendar読めなくてもOK（落とさない）
    calendarDesc = "";
    amdOsBlock = "";
  }

  return {
    ok: true,
    message: "",
    projectId,
    bizYmKey,
    ymInput,
    meeting: {
      meetingEventId,
      meetingStartAt,
      meetingHtmlLink
    },
    report: {
      monthlyReportUrl
    },
    calendar: {
      description: calendarDesc,
      amdOsBlock: amdOsBlock
    }
  };
}

// mtgHeld（開催/議論内容）モーダル用：BillingLiteのmeetingEventIdから議事録DBを引く
function api_getTimelineMeetingHeldDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = String(payload.bizYmKey || "").trim(); // yyyymm
  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const ymInput = bizYmKey.slice(0,4) + "-" + bizYmKey.slice(4,6);

  let lite = null;
  try{
    if (typeof api_getBillingPageDataLite === "function"){
      lite = api_getBillingPageDataLite(projectId, ymInput);
    }
  } catch(e){
    lite = null;
  }

  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});
  const meetingEventId = String(billing.meetingEventId || "").trim();
  const meetingStartAt = String(billing.meetingStartAt || "").trim();
  const meetingHtmlLink = String(billing.meetingHtmlLink || "").trim();

  // Notion議事録（eventIdで検索）
  let minutes = null;
  if (meetingEventId && typeof notion_getMinutesByEventId === "function"){
    minutes = notion_getMinutesByEventId({ eventId: meetingEventId });
  }

  return {
    ok:true,
    projectId,
    bizYmKey,
    ymInput,
    meeting: { meetingEventId, meetingStartAt, meetingHtmlLink },
    minutes: minutes || { ok:false, message:"no minutes", eventId: meetingEventId }
  };
}

function api_getTimelineInvoiceSendDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = String(payload.bizYmKey || "").trim(); // yyyymm

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const ymInput = bizYmKey.slice(0,4) + "-" + bizYmKey.slice(4,6); // yyyy-mm

  let lite = null;
  try{
    if (typeof api_getBillingPageDataLite === "function"){
      lite = api_getBillingPageDataLite(projectId, ymInput);
    }
  } catch(e){
    lite = null;
  }

  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});
  const invoiceRecipients = (lite && lite.invoiceRecipients) ? lite.invoiceRecipients : (lite && lite.data && lite.data.invoiceRecipients ? lite.data.invoiceRecipients : {});

  // UIで欲しい最小限だけ返す（Billing正本の型を信じすぎない）
  const inv = {
    invoiceSentAt: String(billing.invoiceSentAt || "").trim(),
    invoicePdfFileId: String(billing.invoicePdfFileId || "").trim(),

    // あるかもしれない系（無ければ空で返す）
    invoiceNumber: String(billing.invoiceNumber || billing.freeeInvoiceNumber || "").trim(),
    freeeInvoiceId: String(billing.freeeInvoiceId || billing.invoiceId || "").trim()
  };

  // recipients は “Projects正本の形” を想定して配列に整形
  const rec = {
    invoiceToName: String(invoiceRecipients.invoiceToName || "").trim(),
    invoiceToEmails: _tl_splitEmails_(invoiceRecipients.invoiceToEmails),
    invoiceCcEmails: _tl_splitEmails_(invoiceRecipients.invoiceCcEmails),
    invoiceBccEmails: _tl_splitEmails_(invoiceRecipients.invoiceBccEmails)
  };

  return {
    ok:true,
    message:"",
    projectId,
    bizYmKey,
    ymInput,
    invoice: inv,
    recipients: rec
  };
}

function _tl_splitEmails_(v){
  if (!v) return [];
  if (Array.isArray(v)) return v.map(x => String(x||"").trim()).filter(Boolean);
  const s = String(v||"").trim();
  if (!s) return [];
  return s.split(/[,\n]/).map(x => String(x||"").trim()).filter(Boolean);
}

/**
 * Timeline: 予算配賦「案確定」
 * - budgetConfirmedAt/By を入れる（予算確定）
 * - allocationConfirmedAt/By を入れる（配賦案確定）
 * - memberAllocationsJson を保存（案）
 * - fixedTotalYen は触らない（実支払は別で確定する）
 *
 * payload:
 * { projectId, bizYmKey(yyyymm), budgetYen, payouts:[{memberId, plannedYen, fixedYen}] }
 */
function api_confirmTimelineBudgetAllocPlan(payload){
  payload = payload || {};

  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = _tl_normYmKey(String(payload.bizYmKey || "").trim()); // yyyymm
  const budgetYen = Number(payload.budgetYen || 0);
  const payouts = Array.isArray(payload.payouts) ? payload.payouts : [];

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  // headers
  if (typeof b_ensureBillingCycleHeader_ === "function") b_ensureBillingCycleHeader_();
  if (typeof b_ensureHeader_ === "function") b_ensureHeader_("DB_PayoutDetail", ["projectId","ym","memberId","plannedYen","fixedYen","updatedAt"]);

  const nowIso = (typeof b_nowIso_ === "function") ? b_nowIso_() : new Date().toISOString();
  const me = Session.getActiveUser().getEmail();

  // BillingCycle（正本）から現状を読む
  const ymInput = _tl_ymInputFromKey_(bizYmKey); // yyyy-mm
  const cur = (typeof b_getCycleOne_ === "function") ? (b_getCycleOne_(projectId, ymInput) || {}) : {};
  const createdAt = String(cur.createdAt || "") || nowIso;
  const cycleId = `${projectId}_${bizYmKey}`;

  // allocations snapshot（fixed>0を優先、無ければplanned）
  const alloc = {};
  payouts.forEach(p => {
    const mid = String(p.memberId || "").trim();
    if (!mid) return;
    const planned = Number(p.plannedYen || 0);
    const fixed = Number(p.fixedYen || 0);
    alloc[mid] = (fixed > 0) ? fixed : planned;
  });

  const before = {
    budgetTotal: (cur.budgetTotal !== undefined && cur.budgetTotal !== "") ? Number(cur.budgetTotal || 0) : Number(cur.budgetYen || 0),
    memberAllocationsJson: String(cur.memberAllocationsJson || ""),
    budgetConfirmedAt: String(cur.budgetConfirmedAt || ""),
    allocationConfirmedAt: String(cur.allocationConfirmedAt || "")
  };

  // ★案確定：確定スタンプを入れる（予算と配賦案）
  b_upsertRow_("DB_BillingCycle", ["projectId","ym"], {
    cycleId,
    projectId,
    ym: bizYmKey,
    projectName: String(cur.projectName || (typeof b_getProjectName_ === "function" ? (b_getProjectName_(projectId) || "") : "")),

    budgetTotal: budgetYen,
    budgetConfirmedAt: nowIso,
    budgetConfirmedBy: me,

    memberAllocationsJson: JSON.stringify(alloc),
    allocationConfirmedAt: nowIso,
    allocationConfirmedBy: me,

    status: String(cur.status || "draft") || "draft",
    note: String(cur.note || ""),

    // 他列は壊さない
    monthlyReportFileId: String(cur.monthlyReportFileId || ""),
    monthlyReportUrl: String(cur.monthlyReportUrl || ""),

    meetingEventId: String(cur.meetingEventId || ""),
    meetingStartAt: String(cur.meetingStartAt || ""),
    meetingEndAt: String(cur.meetingEndAt || ""),
    meetingHtmlLink: String(cur.meetingHtmlLink || ""),

    fixedTotalYen: Number(cur.fixedTotalYen || 0),

    invoiceIssuedAt: String(cur.invoiceIssuedAt || ""),
    invoiceIssuedBy: String(cur.invoiceIssuedBy || ""),
    invoicePdfUrl: String(cur.invoicePdfUrl || ""),

    invoiceSentAt: String(cur.invoiceSentAt || ""),
    invoiceSentBy: String(cur.invoiceSentBy || ""),

    paymentConfirmedAt: String(cur.paymentConfirmedAt || ""),
    paymentConfirmedBy: String(cur.paymentConfirmedBy || ""),
    paymentNote: String(cur.paymentNote || ""),

    freeeInvoiceId: String(cur.freeeInvoiceId || ""),
    freeeInvoiceNumber: String(cur.freeeInvoiceNumber || ""),
    invoicePdfFileId: String(cur.invoicePdfFileId || ""),

    adminOverrideJson: String(cur.adminOverrideJson || ""),
    adminOverrideUpdatedAt: String(cur.adminOverrideUpdatedAt || ""),
    adminOverrideBy: String(cur.adminOverrideBy || ""),

    createdAt,
    updatedAt: nowIso
  });

  // PayoutDetail 同期（planned/fixed を保存）
  payouts.forEach(p => {
    const mid = String(p.memberId || "").trim();
    if (!mid) return;
    b_upsertRow_("DB_PayoutDetail", ["projectId","ym","memberId"], {
      projectId,
      ym: bizYmKey,
      memberId: mid,
      plannedYen: Number(p.plannedYen || 0),
      fixedYen: Number(p.fixedYen || 0),
      updatedAt: nowIso
    });
  });

  // Log（あるなら）
  try{
    if (typeof b_appendBillingLog_ === "function"){
      b_appendBillingLog_({
        actionType: "BUDGET_ALLOC_PLAN_CONFIRM",
        target: "budgetTotal+memberAllocations",
        projectId,
        ym: bizYmKey,
        cycleId,
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify({ budgetTotal: budgetYen, memberAllocationsJson: alloc }),
        reason: "timeline_budget_alloc_plan_confirm",
        operatorUserId: me,
        operatorName: me,
        createdAt: new Date()
      });
    }
  }catch(e){}

  return { ok:true, projectId, bizYmKey, budgetYen, savedCount: payouts.length, updatedAt: nowIso };
}

/**
 * Timeline: 予算配賦案確定モーダル用の詳細
 * - 当月：budgetTotal / payouts（Billing Lite）
 * - 前月：budgetTotal / plannedTotal（cycleから集計）
 */
function api_getTimelineBudgetAllocPlanDetail(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const bizYmKey = _tl_normYmKey(String(payload.bizYmKey || "").trim()); // yyyymm

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(bizYmKey)) return { ok:false, message:"bizYmKey invalid" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const ymInput = _tl_ymInputFromKey_(bizYmKey); // yyyy-mm

  // 当月：Billing Lite（payoutsが欲しい）
  let lite = null;
  try{
    if (typeof api_getBillingPageDataLite === "function"){
      lite = api_getBillingPageDataLite(projectId, ymInput);
    }
  }catch(e){
    lite = null;
  }
  const billing = (lite && lite.billing) ? lite.billing : (lite && lite.data && lite.data.billing ? lite.data.billing : {});
  const payouts = (lite && Array.isArray(lite.payouts)) ? lite.payouts : (lite && lite.data && Array.isArray(lite.data.payouts) ? lite.data.payouts : []);

  // 前月：cycle
  const prevKey = _tl_addMonthsYmKey_(bizYmKey, -1); // yyyymm
  let prev = null;

  // b_getCycleOne_ の互換に合わせて両方試す
  try{
    if (typeof b_getCycleOne_ === "function"){
      prev = b_getCycleOne_(projectId, prevKey) || {};
    } else {
      prev = {};
    }
  }catch(e){
    try{
      const prevInputFallback = _tl_ymInputFromKey_(prevKey);
      prev = (typeof b_getCycleOne_ === "function") ? (b_getCycleOne_(projectId, prevInputFallback) || {}) : {};
    }catch(_e2){
      prev = {};
    }
  }

  const prevBudget =
    (prev && prev.budgetTotal !== undefined && prev.budgetTotal !== "") ? Number(prev.budgetTotal || 0)
    : Number(prev && prev.budgetYen ? prev.budgetYen : 0);

  const prevAlloc = _tl_safeJson_(prev && prev.memberAllocationsJson ? prev.memberAllocationsJson : "");
  const prevAllocMap = (prevAlloc && typeof prevAlloc === "object") ? prevAlloc : {};

  let prevPlannedTotal = 0;
  try{
    Object.keys(prevAllocMap).forEach(k => { prevPlannedTotal += Number(prevAllocMap[k] || 0); });
  }catch(e){
    prevPlannedTotal = 0;
  }

  return {
    ok:true,
    projectId,
    bizYmKey,
    ymInput,
    current: {
      budgetTotal: (billing && billing.budgetTotal !== undefined && billing.budgetTotal !== "") ? Number(billing.budgetTotal || 0) : 0,
      budgetConfirmedAt: String(billing.budgetConfirmedAt || ""),
      allocationConfirmedAt: String(billing.allocationConfirmedAt || ""),
      payouts: payouts
    },
    prev: {
      bizYmKey: prevKey,
      budgetTotal: prevBudget,
      plannedTotalYen: prevPlannedTotal,
      allocations: prevAllocMap // ★メンバー別の前月配賦（これをUIで初期値に使う）
    }
  };
}

function api_getTimelineMonthlyObserve(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymKey = _tl_normYmKey(String(payload.ymKey || payload.ym || "").trim());

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(ymKey)) return { ok:false, message:"ymKey invalid (yyyymm)" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  const prof = _tl_profStart_("api_getTimelineMonthlyObserve");

  // ★monthly を受け取れたら、それを使って build する（nav二重取りを潰す）
  const monthly = (payload && typeof payload.monthly === "object" && payload.monthly !== null) ? payload.monthly : null;

  const t0 = Date.now();
  const monthlyObserve = _tl_getMonthlyObserveCached_(projectId, ymKey, monthly);
  const t1 = Date.now();
  _tl_profMark_(prof, "monthlyObserveBuiltOrHit", { ms: (t1 - t0) });

  return {
    ok:true,
    message:"",
    projectId,
    ymKey,
    monthlyObserve: monthlyObserve,
    profile: _tl_profEnd_(prof)
  };
}

function api_getTimelineUiFlags(){
  return { ok:true, isAdmin: !!isAdmin_() };
}

function _tl_ensureNavigatorObserveLogSheet_(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = "DB_NavigatorObserveLog";

  let sh = ss.getSheetByName(name);
  if (!sh){
    sh = ss.insertSheet(name);
  }

  // ヘッダはGASで確定（手書き禁止）
  const headers = [
    "projectId",
    "ym",
    "rev",
    "eventType",
    "meaningDiff",
    "changedFields",
    "createdAt",
    "createdAtJst",
    "createdBy"
  ];

  const lastCol = sh.getLastColumn();
  const row1 = (lastCol > 0) ? sh.getRange(1,1,1,lastCol).getValues()[0] : [];
  const cur = row1.map(x => String(x || "").trim()).filter(Boolean);

  if (cur.length >= 2 && cur.includes("projectId") && cur.includes("ym")) return;

  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
}

/** Timeline: 観測ログ一覧（Timeline UI用） */
function api_listTimelineObserveLog(payload){
  payload = payload || {};
  const projectId = String(payload.projectId || "").trim();
  const ymKey = String(payload.ymKey || payload.ym || "").trim();
  const limit = (payload.limit !== undefined && payload.limit !== null) ? Number(payload.limit||0) : 80;

  if (!projectId) return { ok:false, message:"projectId required" };
  if (!/^\d{6}$/.test(ymKey)) return { ok:false, message:"ymKey invalid (yyyymm)" };
  if (!canAccessProject_(projectId)) return { ok:false, message:"access denied" };

  // 正道：必ずシートを用意する
  _tl_ensureNavigatorObserveLogSheet_();

  // 正本：navObserveListSnapshots（壊れたら壊れたと返す）
  return navObserveListSnapshots(projectId, ymKey, limit);
}
