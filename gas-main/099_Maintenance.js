/** 99_Maintenance.gs
 * 運用・移行用の手動コマンド置き場。
 * ymフォーマット移行など、日常UIからは呼ばない保守関数をまとめて隔離する。
 */
function fix_DB_BillingCycle_Ym_ToText(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName("DB_BillingCycle");
  if (!sh) throw new Error("DB_BillingCycle not found");

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) return { ok:true, updated:0, note:"no data" };

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iYm = header.indexOf("ym");
  if (iYm < 0) throw new Error("ym column not found");

  let updated = 0;

  for (let r=2; r<=lastRow; r++){
    const v = sh.getRange(r, iYm+1).getValue();
    let ym = "";

    if (v instanceof Date && !isNaN(v.getTime())) {
      ym = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM");
    } else {
      const s = String(v||"").trim();
      if (/^\d{4}-\d{2}$/.test(s)) ym = s;
      else {
        const d = new Date(s);
        if (!isNaN(d.getTime())) ym = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM");
      }
    }

    if (ym && String(v||"").trim() !== ym){
      sh.getRange(r, iYm+1).setValue(ym);
      updated++;
    }
  }

  return { ok:true, updated };
}
function migrateAllYmToYYYYMM(){
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function normYmKey_(v){
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyyMM");
    }
    const s = String(v).trim();
    if (/^\d{6}$/.test(s)) return s;
    if (/^\d{4}-\d{2}$/.test(s)) return s.replace("-", "");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMM");
    const digits = s.replace(/[^\d]/g,"");
    if (digits.length >= 6) return digits.slice(0,6);
    return s;
  }

  function migrateSheetYm_(sheetName, ymColName){
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return { sheet: sheetName, ok:false, reason:"not found", updated:0 };

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow < 2) return { sheet: sheetName, ok:true, updated:0 };

    const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
    const iYm = header.indexOf(ymColName);
    if (iYm < 0) return { sheet: sheetName, ok:false, reason:`${ymColName} not found`, updated:0 };

    let updated = 0;
    for (let r=2; r<=lastRow; r++){
      const cell = sh.getRange(r, iYm+1);
      const v = cell.getValue();
      const k = normYmKey_(v);
      const cur = (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyyMM") : String(v||"").trim();

      if (k && cur !== k){
        cell.setValue(k);
        updated++;
      }
    }

    // 日付化を防ぐため、列書式をテキストに
    sh.getRange(2, iYm+1, Math.max(lastRow-1,1), 1).setNumberFormat("@");

    return { sheet: sheetName, ok:true, updated };
  }

  const results = [];
  results.push(migrateSheetYm_("DB_BillingCycle", "ym"));
  results.push(migrateSheetYm_("DB_PayoutDetail", "ym"));
  results.push(migrateSheetYm_("DB_PayoutAgreement", "ym"));
  results.push(migrateSheetYm_("DB_PaymentConfirmTokens", "ym"));
  results.push(migrateSheetYm_("DB_ProjectMonthlyPayout", "ym"));

  Logger.log("[migrateAllYmToYYYYMM] %s", JSON.stringify(results));
  return { ok:true, results };
}