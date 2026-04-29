/**
 * 066_PayoutPaidRepo.gs
 *
 * 役割：
 * - DB_PayoutPaid（振込完了の正本）を読み書きする
 * - yyyymm + memberId を複合キーにして upsert
 *
 * 正本カラム：
 * ym, memberId, isPaid, checkedAtJst, checkedBy, note
 */

function admin_setPayoutPaid(payload){
  payload = payload || {};
  if (typeof canAccessAdmin === "function" && !canAccessAdmin()){
    return { ok:false, message:"access denied" };
  }

  const ym = String(payload.ym || "").trim();
  const memberId = String(payload.memberId || "").trim();
  const isPaid = !!payload.isPaid;
  const note = String(payload.note || "").trim();

  if (!/^\d{6}$/.test(ym)) return { ok:false, message:"ym invalid (yyyymm)" };
  if (!memberId) return { ok:false, message:"memberId empty" };

  const checkedBy = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  const checkedAtJst = formatNowJstForPayoutPaid();

  ensurePayoutPaidSheet();

  const row = {
    ym: ym,
    memberId: memberId,
    isPaid: isPaid ? "true" : "false",
    checkedAtJst: checkedAtJst,
    checkedBy: checkedBy,
    note: note,
    updatedAtJst: checkedAtJst
  };

  // upsert（ym+memberId）
  upsertPayoutPaidRow(row);

  // 監査ログ（あれば）
  try{
    if (typeof admin_appendActionLog === "function"){
      admin_appendActionLog({
        actionType: isPaid ? "PAYOUT_PAID_MARK" : "PAYOUT_PAID_UNMARK",
        targetType: "payout",
        targetId: ym + ":" + memberId,
        summary: (isPaid ? "mark paid" : "unmark paid") + " ym=" + ym + " memberId=" + memberId,
        detailJson: JSON.stringify({ ym, memberId, isPaid, note, checkedBy, checkedAtJst })
      });
    }
  }catch(e){}

  return {
    ok:true,
    ym: ym,
    memberId: memberId,
    isPaid: isPaid,
    checkedAtJst: checkedAtJst,
    checkedBy: checkedBy,
    note: note
  };
}

function admin_listPayoutYmCandidates(){
  if (typeof canAccessAdmin === "function" && !canAccessAdmin()){
    return { ok:false, message:"access denied", yms:[] };
  }

  const yms = [];

  // 1) DB_BillingCycle.ym（存在すれば）
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("DB_BillingCycle");
    if (sh){
      const vals = sh.getDataRange().getValues();
      const head = vals[0] || [];
      const idxYm = head.indexOf("ym");
      if (idxYm >= 0){
        for (let i=1; i<vals.length; i++){
          const v = String(vals[i][idxYm] || "").trim();
          if (/^\d{6}$/.test(v)) yms.push(v);
        }
      }
    }
  } catch(e){}

  // 2) DB_PayoutPaid.ym（存在すれば）
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("DB_PayoutPaid");
    if (sh){
      const vals = sh.getDataRange().getValues();
      const head = vals[0] || [];
      const idxYm = head.indexOf("ym");
      if (idxYm >= 0){
        for (let i=1; i<vals.length; i++){
          const v = String(vals[i][idxYm] || "").trim();
          if (/^\d{6}$/.test(v)) yms.push(v);
        }
      }
    }
  } catch(e){}

  // 3) DB_PayoutNotices.ym（存在すれば）
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("DB_PayoutNotices");
    if (sh){
      const vals = sh.getDataRange().getValues();
      const head = vals[0] || [];
      const idxYm = head.indexOf("ym");
      if (idxYm >= 0){
        for (let i=1; i<vals.length; i++){
          const v = String(vals[i][idxYm] || "").trim();
          if (/^\d{6}$/.test(v)) yms.push(v);
        }
      }
    }
  } catch(e){}

  const uniq = Array.from(new Set(yms)).sort((a,b)=>b.localeCompare(a));
  return { ok:true, yms: uniq };
}

// ====== internal helpers ======

function ensurePayoutPaidSheet(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("DB_PayoutPaid");
  if (!sh) sh = ss.insertSheet("DB_PayoutPaid");

  const headers = [
    "ym","memberId","isPaid","checkedAtJst","checkedBy","note",
    "createdAtJst","updatedAtJst"
  ];

  const lastRow = sh.getLastRow();
  if (lastRow === 0){
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return;
  }

  const cur = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(x=>String(x||"").trim());
  const need = headers.filter(h => !cur.includes(h));
  if (need.length){
    const merged = cur.concat(need);
    sh.getRange(1,1,1,merged.length).setValues([merged]);
  }
}

function formatNowJstForPayoutPaid(){
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss");
}

function upsertPayoutPaidRow(row){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_PayoutPaid");
  const vals = sh.getDataRange().getValues();
  const head = vals[0].map(x=>String(x||"").trim());

  const idxYm = head.indexOf("ym");
  const idxMid = head.indexOf("memberId");

  const idx = {};
  head.forEach((h,i)=>{ if (h) idx[h]=i; });

  const ym = String(row.ym||"").trim();
  const mid = String(row.memberId||"").trim();

  let hitRow = -1;
  for (let i=1; i<vals.length; i++){
    if (String(vals[i][idxYm]||"").trim() === ym && String(vals[i][idxMid]||"").trim() === mid){
      hitRow = i+1; // sheet row number
      break;
    }
  }

  const now = String(row.updatedAtJst || formatNowJstForPayoutPaid());
  const created = String(row.createdAtJst || now);

  function getCell(h){
    return (h in row) ? row[h] : "";
  }

  if (hitRow < 0){
    // append
    const out = head.map(h=>{
      if (h === "createdAtJst") return created;
      if (h === "updatedAtJst") return now;
      return getCell(h);
    });
    sh.appendRow(out);
    return;
  }

  // update
  const out = head.map(h=>{
    if (h === "createdAtJst") return String(vals[hitRow-1][idx["createdAtJst"]] || created);
    if (h === "updatedAtJst") return now;
    return getCell(h);
  });
  sh.getRange(hitRow,1,1,out.length).setValues([out]);
}

/**
 * ym の振込完了一覧を memberId -> paid にして返す
 * return: { "ID001": {isPaid:true, checkedAtJst:"...", checkedBy:"...", note:"..."} }
 */
function payoutGetPaidMapByYm(ym){
  ym = String(ym || "").trim();
  if (!/^\d{6}$/.test(ym)) return {};

  // シートが無いなら空
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_PayoutPaid");
  if (!sh) return {};

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const lastCol = sh.getLastColumn();
  const values = sh.getRange(1, 1, lastRow, lastCol).getValues();

  const head = (values[0] || []).map(x=>String(x||"").trim());
  const idxYm = head.indexOf("ym");
  const idxMid = head.indexOf("memberId");
  const idxPaid = head.indexOf("isPaid");
  const idxAt = head.indexOf("checkedAtJst");
  const idxBy = head.indexOf("checkedBy");
  const idxNote = head.indexOf("note");

  if (idxYm < 0 || idxMid < 0) return {};

  const map = {};
  for (let i=1; i<values.length; i++){
    const r = values[i];
    const rowYm = String(r[idxYm] || "").trim();
    if (rowYm !== ym) continue;

    const mid = String(r[idxMid] || "").trim();
    if (!mid) continue;

    const paidRaw = String((idxPaid>=0 ? r[idxPaid] : "") || "").trim().toLowerCase();
    const isPaid = (paidRaw === "true" || paidRaw === "1" || paidRaw === "yes");

    map[mid] = {
      isPaid: isPaid,
      checkedAtJst: String(idxAt>=0 ? (r[idxAt]||"") : "").trim(),
      checkedBy: String(idxBy>=0 ? (r[idxBy]||"") : "").trim(),
      note: String(idxNote>=0 ? (r[idxNote]||"") : "").trim()
    };
  }
  return map;
}
