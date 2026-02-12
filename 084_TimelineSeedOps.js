/** 084_TimelineSeedOps.gs
 * 役割：
 * - 202601以降の全active PJについて、DB_BillingCycle を“存在保証”する（なければ作る）
 * - Timeline の7タスクを「枠として必ず出す」ための seed
 *
 * 方針：
 * - Timeline は Billing を正本として読むので、ここでは BillingCycle を upsert する
 * - status は DB_Projects.status === "active" を採用
 * - ym は yyyymm を扱う
 *
 * 公開関数：
 * - admin_seedTimelineFrom202601()
 * - cron_ensureTimelineSeedsDaily_()
 */

function admin_seedTimelineFrom202601(){
  if (!isAdmin_()) return { ok:false, message:"admin only" };

  const startYm = "202601";
  const endYm = _tlSeed_endYmKey_(6); // 当月〜+6ヶ月
  const pids = _tlSeed_listActiveProjectIds_();

  let created = 0;
  let touched = 0;

  pids.forEach(projectId => {
    const yms = _tlSeed_rangeYmKeys_(startYm, endYm);
    yms.forEach(ymKey => {
      const res = b_upsertBillingCycleMinimalForTimeline_(projectId, ymKey, "timelineSeed");
      if (res && res.created) created++;
      else touched++;
    });
  });

  return { ok:true, message:"", startYm, endYm, projectCount:pids.length, created, touched };
}

/** 日次で軽くensure（新規PJがactive化しても穴が空かない） */
function cron_ensureTimelineSeedsDaily_(){
  // admin限定チェックは中でやる（トリガー実行は権限が強いので事故防止）
  const res = admin_seedTimelineFrom202601();
  return res;
}

/* =========================
 * 内部：active PJ一覧
 * ========================= */

function _tlSeed_listActiveProjectIds_(){
  const sh = getSheet_("DB_Projects");
  const header = ensureHeader_(sh, ["projectId","status"]);
  const iPid = header.indexOf("projectId");
  const iStatus = header.indexOf("status");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const vals = sh.getRange(2, 1, lastRow-1, sh.getLastColumn()).getValues();

  const out = [];
  vals.forEach(row => {
    const pid = String(row[iPid] || "").trim();
    const st = String(row[iStatus] || "").trim().toLowerCase();
    if (!pid) return;
    if (st === "active") out.push(pid);
  });
  return out;
}

/* =========================
 * 内部：ym range
 * ========================= */

function _tlSeed_rangeYmKeys_(startYm, endYm){
  const a = String(startYm||"").trim();
  const b = String(endYm||"").trim();
  if (!/^\d{6}$/.test(a) || !/^\d{6}$/.test(b)) return [];
  if (a > b) return [];

  const out = [];
  let cur = a;
  while (cur <= b){
    out.push(cur);
    cur = _tlSeed_addMonthsYmKey_(cur, 1);
  }
  return out;
}

function _tlSeed_endYmKey_(plusMonths){
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth()+1;
  const base = String(y) + String(m).padStart(2,"0");
  return _tlSeed_addMonthsYmKey_(base, Number(plusMonths||0));
}

function _tlSeed_addMonthsYmKey_(ymKey, delta){
  const y = Number(String(ymKey).slice(0,4));
  const m = Number(String(ymKey).slice(4,6));
  const d = new Date(y, (m||1)-1, 1, 0,0,0,0);
  d.setMonth(d.getMonth() + Number(delta||0));
  const yy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  return String(yy) + mm;
}
