/**
 * A151_TsukuyomiProfilesOps.gs
 *
 * 役割：
 * - DB_BillingCycle + DB_Projects から、DB_TsukuyomiProfiles を自動更新する
 * - 「覚えてくれてる感」を事実ベースで作るための土台（avgCloseDay / lastClosed / stuckStatus）
 *
 * 前提：
 * - DB_TsukuyomiProfiles のヘッダは admin_ensureTsukuyomiProfilesHeader() 済み
 *
 * 注意：
 * - closeAt は paymentConfirmedAt があるものだけを「クローズ済み」として扱う（嘘を作らない）
 * - 日時は JST（Asia/Tokyo）で保存する
 */

function admin_recalcTsukuyomiProfilesFromBilling(payload){
  payload = payload || {};
  const monthsBack = Number(payload.monthsBack || 6); // デフォ6ヶ月
  const now = new Date();

  // 対象ym一覧（新しい順）
  const yms = tsuListRecentYms(now, monthsBack);

  const cycles = tsuReadTable("DB_BillingCycle");
  const projects = tsuReadTable("DB_Projects");
  const profiles = tsuReadTable("DB_TsukuyomiProfiles");

  const projectById = {};
  for (const p of projects.rows){
    const pid = String(p.projectId || "").trim();
    if (!pid) continue;
    projectById[pid] = p;
  }

  // cyclesを対象ymでフィルタ
  const targetCycles = [];
  for (const c of cycles.rows){
    const ym = Number(c.ym || 0);
    if (!ym) continue;
    if (yms.indexOf(ym) === -1) continue;
    const projectId = String(c.projectId || "").trim();
    if (!projectId) continue;
    targetCycles.push(c);
  }

  // PM×PJで集計
  // key = projectId:pmMemberId
  const aggByKey = {};

  for (const c of targetCycles){
    const projectId = String(c.projectId || "").trim();
    const pj = projectById[projectId];
    if (!pj) continue;

    const pmMemberId = String(pj.pmMemberId || "").trim();
    if (!pmMemberId) continue;

    const key = projectId + ":" + pmMemberId;

    if (!aggByKey[key]){
      aggByKey[key] = {
        projectId,
        pmMemberId,
        closeDays: [],
        lastClosed: null, // { ym, closeAt }
        stuckSecByStatus: {
          draft: 0,
          budget_confirmed: 0,
          allocation_confirmed: 0,
          invoice_issued: 0
        }
      };
    }

    // close（paymentConfirmedAt があるときのみ）
    const closeAt = tsuParseDate(c.paymentConfirmedAt);
    if (closeAt){
      const closeDay = tsuGetJstDayOfMonth(closeAt);
      if (closeDay) aggByKey[key].closeDays.push(closeDay);

      const ym = Number(c.ym || 0);
      const prev = aggByKey[key].lastClosed;
      if (!prev || (prev.closeAt && closeAt > prev.closeAt) || (!prev.closeAt)){
        aggByKey[key].lastClosed = { ym, closeAt };
      }
    }

    // stuck（区間滞在時間）
    // createdAt -> budgetConfirmedAt = draft
    // budgetConfirmedAt -> allocationConfirmedAt = budget_confirmed
    // allocationConfirmedAt -> invoiceIssuedAt = allocation_confirmed
    // invoiceIssuedAt -> paymentConfirmedAt = invoice_issued
    const tCreated = tsuParseDate(c.createdAt) || tsuParseDate(c.createdAt2) || tsuParseDate(c.updatedAt2) || null;
    const tBudget  = tsuParseDate(c.budgetConfirmedAt);
    const tAlloc   = tsuParseDate(c.allocationConfirmedAt);
    const tInv     = tsuParseDate(c.invoiceIssuedAt);
    const tPaid    = tsuParseDate(c.paymentConfirmedAt);

    const sDraft = tsuDiffSec(tCreated, tBudget);
    if (sDraft !== null) aggByKey[key].stuckSecByStatus.draft += sDraft;

    const sBudget = tsuDiffSec(tBudget, tAlloc);
    if (sBudget !== null) aggByKey[key].stuckSecByStatus.budget_confirmed += sBudget;

    const sAlloc = tsuDiffSec(tAlloc, tInv);
    if (sAlloc !== null) aggByKey[key].stuckSecByStatus.allocation_confirmed += sAlloc;

    const sInv = tsuDiffSec(tInv, tPaid);
    if (sInv !== null) aggByKey[key].stuckSecByStatus.invoice_issued += sInv;
  }

  // profiles 既存行を map 化
  const profileRowByKey = {};
  for (const r of profiles.rows){
    const k = String(r.profileKey || "").trim();
    if (!k) continue;
    profileRowByKey[k] = r;
  }

  // upsert：既存があれば更新、なければ追加
  const nowJst = tsuToJstIso(new Date());

  const upserts = [];
  for (const key of Object.keys(aggByKey)){
    const a = aggByKey[key];

    const closeDays = a.closeDays;
    const closeSamples = closeDays.length;
    const avgCloseDay = closeSamples ? tsuMedian(closeDays) : "";

    // stuckStatus（最大秒のstatus）
    let stuckStatus = "";
    let best = -1;
    for (const st of Object.keys(a.stuckSecByStatus)){
      const sec = a.stuckSecByStatus[st] || 0;
      if (sec > best){
        best = sec;
        stuckStatus = st;
      }
    }
    if (best <= 0) stuckStatus = "";

    const lastClosedYm = a.lastClosed ? String(a.lastClosed.ym || "").trim() : "";
    const lastClosedAtJst = a.lastClosed ? tsuToJstIso(a.lastClosed.closeAt) : "";

    const existing = profileRowByKey[key] || null;

    // ===== 既存保持フィールド（再計算で消さない） =====
    const tone = (existing && String(existing.tone || "").trim())
      ? String(existing.tone || "").trim()
      : "gentle";

    const status = (existing && String(existing.status || "").trim())
      ? String(existing.status || "").trim()
      : "active";

    const createdAtJst = (existing && String(existing.createdAtJst || "").trim())
      ? String(existing.createdAtJst || "").trim()
      : nowJst;

    const note = (existing && String(existing.note || "").trim())
      ? String(existing.note || "").trim()
      : "";

    const lastRemindedAtJst = (existing && String(existing.lastRemindedAtJst || "").trim())
      ? String(existing.lastRemindedAtJst || "").trim()
      : "";

    // ★175で使うやつ。151が上書きで消すと行動ローテが壊れる
    const lastActionType = (existing && String(existing.lastActionType || "").trim())
      ? String(existing.lastActionType || "").trim()
      : "";

    const lastActionAtJst = (existing && String(existing.lastActionAtJst || "").trim())
      ? String(existing.lastActionAtJst || "").trim()
      : "";

    const row = {
      profileKey: key,
      projectId: a.projectId,
      pmMemberId: a.pmMemberId,

      // ===== 再計算フィールド（事実） =====
      avgCloseDay: avgCloseDay,
      closeSamples: closeSamples,
      stuckStatus: stuckStatus,

      lastClosedYm: lastClosedYm,
      lastClosedAtJst: lastClosedAtJst,

      // ===== 保持フィールド（運用） =====
      tone: tone,
      lastRemindedAtJst: lastRemindedAtJst,
      lastActionType: lastActionType,
      lastActionAtJst: lastActionAtJst,

      note: note,
      status: status,
      createdAtJst: createdAtJst,
      updatedAtJst: nowJst
    };

    upserts.push(row);
  }

  tsuUpsertRowsByKey("DB_TsukuyomiProfiles", "profileKey", upserts);

  return {
    ok: true,
    updated: upserts.length,
    monthsBack: monthsBack
  };
}

/* ===== helpers（末尾_禁止ルールに合わせて全部camelCase） ===== */

function tsuReadTable(sheetName){
  // 返り値ゆれを吸収して { headers, rows } に正規化する

  // 1) b_readTableThin_ があれば使う
  try{
    if (typeof b_readTableThin_ === "function"){
      const r = b_readTableThin_(sheetName);

      // r が配列（= rows 直返し）パターン
      if (Array.isArray(r)){
        return { headers: [], rows: r };
      }

      // r が {rows:[...]} パターン
      if (r && Array.isArray(r.rows)){
        return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.rows };
      }

      // r が {data:[...]} とか別名パターン（保険）
      if (r && Array.isArray(r.data)){
        return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.data };
      }

      // それ以外はフォールバックへ
    }
  }catch(e){}

  // 2) b_readTable_ があれば使う
  try{
    if (typeof b_readTable_ === "function"){
      const r = b_readTable_(sheetName);

      if (Array.isArray(r)){
        return { headers: [], rows: r };
      }
      if (r && Array.isArray(r.rows)){
        return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.rows };
      }
      if (r && Array.isArray(r.data)){
        return { headers: Array.isArray(r.headers) ? r.headers : [], rows: r.data };
      }
    }
  }catch(e){}

  // 3) 最終手段：シート直読み（ヘッダ + 行オブジェクト）
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return { headers:[], rows:[] };

  const values = sh.getDataRange().getValues();
  if (!values.length) return { headers:[], rows:[] };

  const headers = values[0].map(x => String(x || "").trim());
  const rows = [];

  for (let i=1;i<values.length;i++){
    const obj = {};
    for (let j=0;j<headers.length;j++){
      obj[headers[j]] = values[i][j];
    }
    rows.push(obj);
  }
  return { headers, rows };
}

function tsuUpsertRowsByKey(sheetName, keyCol, items){
  if (!items || !items.length) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error("sheet not found: " + sheetName);

  const values = sh.getDataRange().getValues();
  if (!values.length) throw new Error("empty header: " + sheetName);

  const headers = values[0].map(x => String(x || "").trim());
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx < 0) throw new Error("key col not found: " + keyCol);

  const colIdx = {};
  for (let i=0;i<headers.length;i++) colIdx[headers[i]] = i;

  // 既存行 index
  const rowIndexByKey = {};
  for (let r=1; r<values.length; r++){
    const k = String(values[r][keyIdx] || "").trim();
    if (k) rowIndexByKey[k] = r; // 0-based in values
  }

  // 書き込みバッファ
  const newRows = [];

  for (const it of items){
    const k = String(it[keyCol] || "").trim();
    if (!k) continue;

    if (rowIndexByKey[k] !== undefined){
      const rIdx = rowIndexByKey[k];
      const row = values[rIdx].slice();
      for (const hk of Object.keys(it)){
        if (colIdx[hk] === undefined) continue;
        row[colIdx[hk]] = it[hk];
      }
      values[rIdx] = row;
    } else {
      const row = new Array(headers.length).fill("");
      for (const hk of Object.keys(it)){
        if (colIdx[hk] === undefined) continue;
        row[colIdx[hk]] = it[hk];
      }
      newRows.push(row);
    }
  }

  // 既存更新
  if (values.length > 1){
    sh.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  }

  // 追加
  if (newRows.length){
    sh.getRange(sh.getLastRow()+1, 1, newRows.length, headers.length).setValues(newRows);
  }
}

function tsuParseDate(v){
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s) return null;

  // "2026-02-03 15:59:35" みたいなのも来るので、スペース区切りはTに寄せる
  const normalized = s.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ? s.replace(" ", "T") + "+09:00"
    : s;

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function tsuToJstIso(d){
  if (!d) return "";
  const t = (d instanceof Date) ? d.getTime() : (new Date(d)).getTime();
  if (!t || isNaN(t)) return "";
  const jst = new Date(t + 9*60*60*1000);
  // Zを付けず、JSTとして読める形にする（+09:00）
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth()+1).padStart(2,"0");
  const day = String(jst.getUTCDate()).padStart(2,"0");
  const hh = String(jst.getUTCHours()).padStart(2,"0");
  const mm = String(jst.getUTCMinutes()).padStart(2,"0");
  const ss = String(jst.getUTCSeconds()).padStart(2,"0");
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}+09:00`;
}

function tsuGetJstDayOfMonth(d){
  if (!d) return null;
  const t = d.getTime();
  if (isNaN(t)) return null;
  const jst = new Date(t + 9*60*60*1000);
  return jst.getUTCDate();
}

function tsuDiffSec(a, b){
  if (!a || !b) return null;
  const ta = a.getTime();
  const tb = b.getTime();
  if (isNaN(ta) || isNaN(tb)) return null;
  const diff = Math.floor((tb - ta) / 1000);
  return diff > 0 ? diff : null;
}

function tsuMedian(nums){
  const arr = (nums || []).map(n => Number(n)).filter(n => isFinite(n) && n > 0).sort((x,y)=>x-y);
  if (!arr.length) return "";
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) return arr[mid];
  return Math.round((arr[mid-1] + arr[mid]) / 2);
}

function tsuListRecentYms(now, monthsBack){
  const list = [];
  const base = new Date(now.getTime());
  for (let i=0;i<monthsBack;i++){
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const ym = d.getFullYear()*100 + (d.getMonth()+1);
    list.push(ym);
  }
  return list;
}

function admin_recalcTsukuyomiProfilesFromBilling6m(){
  return admin_recalcTsukuyomiProfilesFromBilling({ monthsBack: 6 });
}
