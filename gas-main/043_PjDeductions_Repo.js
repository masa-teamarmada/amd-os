/**
 * 043_PjDeductions_Repo.gs
 * PJ予算控除枠（Deductions）のデータアクセス層。
 * DB_PjDeductions のヘッダ保証・CRUD・月別集計を担当。
 *
 * 控除タイプ：
 *   - rate型（buffer等）: PJ予算(65%)に対する割合控除。startYmから有効。
 *   - fixed型（salesFee等）: 月額固定控除。startYm〜endYm間有効。
 *
 * 依存:
 *   - B_Sheets.gs（b_ensureHeader_, b_readTable_）
 */

var PJDED_HEADERS_ = [
  "deductionId", "projectId", "type", "label", "mode",
  "ratePercent", "fixedAmount", "targetMemberId",
  "durationMonths", "startYm", "endYm",
  "status", "note", "createdAt", "updatedAt"
];

/** ヘッダ保証 */
function pjDed_ensureHeader_() {
  var ss = b_ss_();
  var sh = ss.getSheetByName("DB_PjDeductions");
  if (!sh) {
    sh = ss.insertSheet("DB_PjDeductions");
    sh.getRange(1, 1, 1, PJDED_HEADERS_.length).setValues([PJDED_HEADERS_]);
    // b_getSheet_ のキャッシュに乗せる
    __BILLING_SHEETS__["DB_PjDeductions"] = sh;
    return sh;
  }

  // ヘッダ補完
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var existing = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var existSet = {};
  for (var i = 0; i < existing.length; i++) {
    existSet[String(existing[i] || "").trim()] = true;
  }
  var missing = [];
  for (var j = 0; j < PJDED_HEADERS_.length; j++) {
    if (!existSet[PJDED_HEADERS_[j]]) missing.push(PJDED_HEADERS_[j]);
  }
  if (missing.length > 0) {
    sh.getRange(1, sh.getLastColumn() + 1, 1, missing.length).setValues([missing]);
  }
  __BILLING_SHEETS__["DB_PjDeductions"] = sh;
  return sh;
}

/** 指定PJの全deduction取得（status問わず） */
function pjDed_readAllForProject_(projectId) {
  var sh = pjDed_ensureHeader_();
  var pid = String(projectId || "").trim();
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var data = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var result = [];
  for (var r = 0; r < data.length; r++) {
    var row = {};
    for (var c = 0; c < headers.length; c++) {
      row[String(headers[c])] = data[r][c];
    }
    if (String(row.projectId || "").trim() === pid) {
      result.push(row);
    }
  }
  return result;
}

/** 指定PJのactiveなdeductionだけ取得 */
function pjDed_readActiveForProject_(projectId) {
  var all = pjDed_readAllForProject_(projectId);
  var result = [];
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].status || "") === "active") result.push(all[i]);
  }
  return result;
}

/**
 * 指定ymにactiveなdeductionを返す
 * - rate型: startYm <= ym かつ (endYmが空 or endYm >= ym)
 * - fixed型: startYm <= ym <= endYm
 */
function pjDed_readActiveForYm_(projectId, ym) {
  var active = pjDed_readActiveForProject_(projectId);
  var sym = String(ym || "").trim();
  var result = [];
  for (var i = 0; i < active.length; i++) {
    var d = active[i];
    var dStart = String(d.startYm || "").trim();
    var dEnd = String(d.endYm || "").trim();
    if (!dStart || dStart > sym) continue;
    if (dEnd && dEnd < sym) continue;
    result.push(d);
  }
  return result;
}

/**
 * サイクル期間（startYm〜endYm）の全月分の控除合計を計算
 * @param {string} projectId
 * @param {number} monthlyGross  月額gross予算（feeAmount × 0.65）
 * @param {string} cycleStartYm  サイクル開始（yyyymm）
 * @param {string} cycleEndYm    サイクル終了（yyyymm）
 * @return {number} サイクル全体の控除合計額
 */
function pjDed_calcCycleDeductionTotal_(projectId, monthlyGross, cycleStartYm, cycleEndYm) {
  var active = pjDed_readActiveForProject_(projectId);
  if (active.length === 0) return 0;

  var total = 0;
  var ym = String(cycleStartYm);
  var endYm = String(cycleEndYm);

  while (ym <= endYm) {
    var monthDeduction = 0;
    for (var i = 0; i < active.length; i++) {
      var d = active[i];
      var dStart = String(d.startYm || "").trim();
      var dEnd = String(d.endYm || "").trim();
      if (!dStart || dStart > ym) continue;
      if (dEnd && dEnd < ym) continue;

      var mode = String(d.mode || "").trim();
      if (mode === "rate") {
        monthDeduction += monthlyGross * Number(d.ratePercent || 0) / 100;
      } else if (mode === "fixed") {
        monthDeduction += Number(d.fixedAmount || 0);
      }
    }
    total += monthDeduction;
    ym = pjDed_nextYm_(ym);
  }
  return total;
}

/**
 * 指定ymの月次控除額を計算（Navigator/Billing表示用）
 */
function pjDed_calcMonthlyDeduction_(projectId, monthlyGross, ym) {
  var deds = pjDed_readActiveForYm_(projectId, ym);
  var total = 0;
  for (var i = 0; i < deds.length; i++) {
    var d = deds[i];
    if (String(d.mode || "") === "rate") {
      total += monthlyGross * Number(d.ratePercent || 0) / 100;
    } else if (String(d.mode || "") === "fixed") {
      total += Number(d.fixedAmount || 0);
    }
  }
  return total;
}

/** deduction 1件追加 */
function pjDed_insert_(data) {
  pjDed_ensureHeader_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_PjDeductions");
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
  var id = "ded_" + Utilities.getUuid().substring(0, 8);

  // fixed型: durationMonthsからendYm自動計算
  var startYm = String(data.startYm || "").trim();
  var endYm = String(data.endYm || "").trim();
  if (String(data.mode || "") === "fixed" && !endYm && data.durationMonths && startYm) {
    endYm = pjDed_addMonths_(startYm, Number(data.durationMonths) - 1);
  }

  var row = [
    id,
    String(data.projectId || ""),
    String(data.type || "other"),
    String(data.label || ""),
    String(data.mode || "fixed"),
    data.mode === "rate" ? Number(data.ratePercent || 0) : "",
    data.mode === "fixed" ? Number(data.fixedAmount || 0) : "",
    String(data.targetMemberId || ""),
    data.durationMonths ? Number(data.durationMonths) : "",
    startYm,
    endYm,
    "active",
    String(data.note || ""),
    now,
    now
  ];
  sh.appendRow(row);
  return { ok: true, deductionId: id };
}

/** deduction 1件更新（status変更等） */
function pjDed_update_(deductionId, fields) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_PjDeductions");
  if (!sh) return { ok: false, message: "DB_PjDeductions not found" };

  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var colMap = {};
  for (var c = 0; c < headers.length; c++) {
    colMap[String(headers[c])] = c;
  }
  var idCol = colMap.deductionId;
  if (idCol === undefined) return { ok: false, message: "deductionId column not found" };

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol] || "").trim() === String(deductionId).trim()) {
      var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
      for (var key in fields) {
        if (colMap[key] !== undefined) {
          sh.getRange(r + 1, colMap[key] + 1).setValue(fields[key]);
        }
      }
      if (colMap.updatedAt !== undefined) {
        sh.getRange(r + 1, colMap.updatedAt + 1).setValue(now);
      }
      return { ok: true };
    }
  }
  return { ok: false, message: "not found: " + deductionId };
}

/** rate型の変更: 旧行をexpired + 新行をinsert */
function pjDed_replaceRate_(oldDeductionId, newData) {
  // 旧行のendYmを設定してexpired
  var newStartYm = String(newData.startYm || "").trim();
  var prevYm = newStartYm ? pjDed_addMonths_(newStartYm, -1) : "";
  pjDed_update_(oldDeductionId, { status: "expired", endYm: prevYm });
  // 新行insert
  return pjDed_insert_(newData);
}

// ===== ym計算ヘルパー =====
function pjDed_nextYm_(ym) {
  var y = parseInt(ym.substring(0, 4), 10);
  var m = parseInt(ym.substring(4, 6), 10);
  m++;
  if (m > 12) { m = 1; y++; }
  return String(y) + (m < 10 ? "0" : "") + m;
}

function pjDed_addMonths_(ym, n) {
  var y = parseInt(ym.substring(0, 4), 10);
  var m = parseInt(ym.substring(4, 6), 10) - 1 + n;
  y += Math.floor(m / 12);
  m = (m % 12 + 12) % 12;
  return String(y) + (m + 1 < 10 ? "0" : "") + (m + 1);
}