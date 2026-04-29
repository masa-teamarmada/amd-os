/**
 * 004_BillingDomain.gs
 *
 * 目的：
 * Billingの中核となる“状態管理”と“DB更新ルール”を集約する。
 * BillingCycle / BillingLog / 履歴生成など、業務概念としてのBillingをここに固定する。
 *
 * このファイルが担当するもの：
 * - DB_BillingCycle / DB_BillingLog のヘッダ保証
 * - BillingCycle の取得（最新化、当月/前月の参照など）
 * - BillingLog の append-only 記録
 * - history / saveLog の生成（UI表示用の整形）
 * - Billing文脈でのアクセス制御（b_assertProjectAccess_ など）
 *
 * ルール：
 * - freee / Gmail / Calendar / Drive など外部I/Oは置かない（Domain純度を保つ）。
 * - UIから直接呼ばれる api_ は原則ここに置かず、B_BillingApi.gs に置く。
 * - ここは他モジュールから参照されやすいので、関数名の破壊的変更を避ける。
 */

function b_assertProjectAccess_(projectId){
  projectId = String(projectId || "").trim();

  // canAccessProject_ は Code.gs 側の関数（同一GASプロジェクト内なので呼べる）
  if (!canAccessProject_(projectId)) {
    throw new Error("access denied");
  }
}
/** ====== ProjectName ====== */
function b_getProjectName_(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return "";
  try {
    const rows = b_readTable_("DB_Projects");
    const hit = rows.find(r => String(r.projectId).trim() === projectId);
    return String(hit?.projectName || "");
  } catch (e) {
    return "";
  }
}
/** ====== BillingCycle read (latest by ym) ====== */
function b_getCycleByYmLatest_(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return {};

  // ★全表readをやめて、projectId一致行だけ拾う
  const rows = b_readBillingCycleForProject_(projectId)
    .map(r => ({ ...r, ym: b_normYm_(r.ym) }))
    .filter(r => r.ym);

  const byYm = {};
  rows.forEach(r => {
    const key = String(r.ym);
    const cur = byYm[key];
    if (!cur) { byYm[key] = r; return; }
    if (String(r.updatedAt || "") > String(cur.updatedAt || "")) byYm[key] = r;
  });
  return byYm; // {ym: row}
}
function b_getCycleOne_(projectId, ym) {
  const byYm = b_getCycleByYmLatest_(projectId);
  return byYm[String(b_normYm_(ym))] || null;
}
/** ====== DB headers (new model) ====== */
function b_ensureBillingCycleHeader_() {
  const headers = [
    "cycleId","projectId","ym","projectName",
    "budgetTotal","budgetConfirmedAt","budgetConfirmedBy",
    "memberAllocationsJson","allocationConfirmedAt","allocationConfirmedBy",
    "status","note",
    "monthlyReportFileId","monthlyReportUrl",
    "monthlyReportFixedAt","monthlyReportFixedBy",
    "meetingEventId","meetingStartAt","meetingEndAt","meetingHtmlLink",
    "meetingSkipped","meetingSkipReason",
    "fixedTotalYen",

    // task confirmation (翌月タスク確認)
    "taskConfirmedAt","taskConfirmedBy",

    // 一括請求月（空 or ymと同じ=通常、未来月=その月にまとめて請求）
    "invoiceYm",

    // invoice/payment tasks
    "invoiceIssuedAt","invoiceIssuedBy","invoicePdfUrl",
    "invoiceSentAt","invoiceSentBy",
    "paymentConfirmedAt","paymentConfirmedBy","paymentNote",

    // payout notice (支払通知書きよ確認)
    "payoutNoticeUploadedAt","payoutNoticeUploadedBy",

    // freee invoice linkage
    "freeeInvoiceId","freeeInvoiceNumber","invoicePdfFileId",

    // admin override
    "adminOverrideJson","adminOverrideUpdatedAt","adminOverrideBy",

    "createdAt","updatedAt"
  ];
  b_ensureHeader_("DB_BillingCycle", headers);

  // 旧列互換
  b_ensureHeader_("DB_BillingCycle", ["budgetYen"]);
}

function b_ensureBillingLogHeader_() {
  const headers = [
    "logId","projectId","ym","cycleId",
    "actionType","target","beforeValue","afterValue","reason",
    "operatorUserId","operatorName",
    "createdAt",

    // ★追加：人間が見る用（JST確定・文字列で保持）
    "createdAtJst"
  ];
  b_ensureHeader_("DB_BillingLog", headers);
}

/** ====== BILLING LOG (append only) ====== */
function b_appendBillingLog_(row) {
  const sheetName = "DB_BillingLog";
  b_ensureBillingLogHeader_();
  const sh = b_getSheet_(sheetName);

  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h=>String(h||"").trim());
  const rec = {};
  headers.forEach(h => rec[h] = "");

  rec.logId = String(row.logId || Utilities.getUuid());
  rec.projectId = String(row.projectId || "");
  rec.ym = String(b_normYm_(row.ym || ""));
  rec.cycleId = String(row.cycleId || "");
  rec.actionType = String(row.actionType || "");
  rec.target = String(row.target || "");
  rec.beforeValue = (row.beforeValue === undefined || row.beforeValue === null) ? "" : String(row.beforeValue);
  rec.afterValue = (row.afterValue === undefined || row.afterValue === null) ? "" : String(row.afterValue);
  rec.reason = String(row.reason || "");
  rec.operatorUserId = String(row.operatorUserId || "");
  rec.operatorName = String(row.operatorName || "");

  // ★createdAtは必ずJST文字列で保存（シートTZやZ表記に左右されない）
  // 先頭に'を付けて勝手に日付型変換されるのを防ぐ
  const tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  const d = new Date();
  const jst = Utilities.formatDate(d, tz, "yyyy-MM-dd HH:mm:ss");
  rec.createdAt = "'" + jst;

  sh.appendRow(headers.map(h => rec[h]));
}

/** ====== history/saveLog ====== */
function b_buildBudgetAndPayoutHistory_(projectId, memberIds, maxMonths) {
  projectId = String(projectId || "").trim();
  const limit = Number(maxMonths || 0);

  const byYm = b_getCycleByYmLatest_(projectId);
  let cycles = Object.values(byYm).sort((a,b) => String(a.ym).localeCompare(String(b.ym)));

  if (limit > 0 && cycles.length > limit) {
    cycles = cycles.slice(-limit);
  }

  const needYms = new Set(cycles.map(c => String(c.ym)));
  const details = b_readTable_("DB_PayoutDetail")
    .map(d => ({ ...d, ym: b_normYm_(d.ym) }))
    .filter(x => String(x.projectId) === projectId && x.ym && needYms.has(String(x.ym)));

  return cycles.map(c => {
    const ym = String(c.ym);

    const budgetYen =
      (c.budgetTotal !== undefined && c.budgetTotal !== "") ? Number(c.budgetTotal || 0)
      : Number(c.budgetYen || 0);

    const alloc = b_safeJsonParse_(c.memberAllocationsJson, null);

    const adminOverrideJson = String(c.adminOverrideJson || "");
    const adminOverrideUpdatedAt = String(c.adminOverrideUpdatedAt || "");
    const adminOverrideBy = String(c.adminOverrideBy || "");

    if (alloc && typeof alloc === "object") {
      const plannedTotal = b_sum_(memberIds.map(id => Number(alloc[id] || 0)));
      const fixedTotal = plannedTotal;

      return {
        ym,
        budgetYen,
        plannedTotalYen: plannedTotal,
        fixedTotalYen: fixedTotal,

        meetingEventId: String(c.meetingEventId || ""),
        monthlyReportUrl: String(c.monthlyReportUrl || ""),
        budgetConfirmedAt: String(c.budgetConfirmedAt || ""),
        allocationConfirmedAt: String(c.allocationConfirmedAt || ""),
        invoiceSentAt: String(c.invoiceSentAt || ""),
        paymentConfirmedAt: String(c.paymentConfirmedAt || ""),

        // ★override
        adminOverrideJson,
        adminOverrideUpdatedAt,
        adminOverrideBy,

        agreement: b_getAgreementStatus_(projectId, ym, memberIds),
        details: memberIds.map(id => ({
          memberId: id,
          plannedYen: Number(alloc[id] || 0),
          fixedYen: Number(alloc[id] || 0),
        })),
      };
    }

    const monthDetails = details.filter(d => String(d.ym) === ym);
    const byMember = b_indexBy_(monthDetails, "memberId");

    const plannedTotal = b_sum_(memberIds.map(id => Number(byMember[id]?.plannedYen || 0)));
    const fixedTotal = b_sum_(memberIds.map(id => Number(byMember[id]?.fixedYen || 0)));

    return {
      ym,
      budgetYen,
      plannedTotalYen: plannedTotal,
      fixedTotalYen: fixedTotal,

      meetingEventId: String(c.meetingEventId || ""),
      monthlyReportUrl: String(c.monthlyReportUrl || ""),
      budgetConfirmedAt: String(c.budgetConfirmedAt || ""),
      allocationConfirmedAt: String(c.allocationConfirmedAt || ""),
      invoiceSentAt: String(c.invoiceSentAt || ""),
      paymentConfirmedAt: String(c.paymentConfirmedAt || ""),

      // ★override
      adminOverrideJson,
      adminOverrideUpdatedAt,
      adminOverrideBy,

      agreement: b_getAgreementStatus_(projectId, ym, memberIds),
      details: memberIds.map(id => ({
        memberId: id,
        plannedYen: Number(byMember[id]?.plannedYen || 0),
        fixedYen: Number(byMember[id]?.fixedYen || 0),
      })),
    };
  });
}

function b_buildSaveLog_(projectId, limitCount) {
  const byYm = b_getCycleByYmLatest_(projectId);
  const logs = Object.values(byYm)
    .filter(c => c.updatedAt)
    .map(c => {
      const budgetYen =
        (c.budgetTotal !== undefined && c.budgetTotal !== "") ? Number(c.budgetTotal || 0)
        : Number(c.budgetYen || 0);

      return {
        ym: String(c.ym || ""),
        updatedAt: String(c.updatedAt),
        budgetYen,
        meetingEventId: String(c.meetingEventId || ""),
        monthlyReportUrl: String(c.monthlyReportUrl || ""),
      };
    })
    .sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  const n = Number(limitCount || 30);
  return logs.slice(0, n);
}
function b_readBillingCycleForProject_(projectId){
  projectId = String(projectId || "").trim();
  if (!projectId) return [];

  const cacheKey = "DB_BillingCycle::" + projectId;
  if (__B_CYCLE_CACHE__[cacheKey]) return __B_CYCLE_CACHE__[cacheKey];

  const sh = b_getSheet_("DB_BillingCycle");
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x => String(x||"").trim());
  const iPid = header.indexOf("projectId");
  if (iPid < 0) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  const pidCol = sh.getRange(2, iPid+1, lastRow-1, 1);
  const hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();
  if (!hits || !hits.length) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  const hitRows = hits.map(c => c.getRow());
  const blocks = b_groupConsecutive_(hitRows);

  const out = [];
  blocks.forEach(([s,e]) => {
    const vals = sh.getRange(s, 1, e - s + 1, lastCol).getValues();
    vals.forEach(row => {
      // projectIdが一致する行だけ採用（保険）
      if (String(row[iPid]||"").trim() !== projectId) return;
      const obj = {};
      header.forEach((h, i) => (obj[h] = row[i]));
      out.push(obj);
    });
  });

  __B_CYCLE_CACHE__[cacheKey] = out;
  return out;
}

function b_upsertBillingCycleMinimalForTimeline_(projectId, ymKey, reason){
  if (!isAdmin_()) return { ok:false, message:"admin only" };

  projectId = String(projectId || "").trim();
  ymKey = String(ymKey || "").trim();
  reason = String(reason || "").trim();

  if (!projectId) return { ok:false, message:"projectId empty" };
  if (!/^\d{6}$/.test(ymKey)) return { ok:false, message:"ym invalid" };

  b_ensureBillingCycleHeader_();

  const sh = b_getSheet_("DB_BillingCycle");
  const lastCol = sh.getLastColumn();
  const header = sh.getRange(1,1,1,lastCol).getValues()[0].map(x=>String(x||"").trim());

  const iCycleId = header.indexOf("cycleId");
  const iPid = header.indexOf("projectId");
  const iYm = header.indexOf("ym");
  const iProjectName = header.indexOf("projectName");
  const iCreatedAt = header.indexOf("createdAt");
  const iUpdatedAt = header.indexOf("updatedAt");

  if (iPid < 0 || iYm < 0) return { ok:false, message:"header missing" };

  // 既存チェック（projectId + ym の最新を探す）
  const lastRow = sh.getLastRow();
  let hitRow = -1;

  if (lastRow >= 2){
    const values = sh.getRange(2,1,lastRow-1,lastCol).getValues();
    for (let i=0; i<values.length; i++){
      const pid = String(values[i][iPid]||"").trim();
      const ym = String(values[i][iYm]||"").trim();
      if (pid === projectId && b_normYm_(ym) === ymKey){
        hitRow = i + 2;
      }
    }
  }

  const tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  const now = new Date();
  const nowJst = Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss");

  const projectName = b_getProjectName_(projectId) || "";

  if (hitRow > 0){
    // 更新だけ（存在保証）
    if (iUpdatedAt >= 0) sh.getRange(hitRow, iUpdatedAt+1).setValue("'" + nowJst);
    if (iProjectName >= 0 && projectName) sh.getRange(hitRow, iProjectName+1).setValue(projectName);
    return { ok:true, created:false, projectId, ym:ymKey };
  }

  // 新規追加
  const row = header.map(() => "");
  if (iCycleId >= 0) row[iCycleId] = Utilities.getUuid();
  row[iPid] = projectId;
  row[iYm] = ymKey;
  if (iProjectName >= 0) row[iProjectName] = projectName;
  if (iCreatedAt >= 0) row[iCreatedAt] = "'" + nowJst;
  if (iUpdatedAt >= 0) row[iUpdatedAt] = "'" + nowJst;

  sh.appendRow(row);

  // 監査ログを残したいならここで BillingLog へ追記してもいい（今回は最小に留める）
  return { ok:true, created:true, projectId, ym:ymKey };
}

/**
 * 指定PJの全BillingCycleを返す
 * @param {string} projectId
 * @return {Array<Object>}
 */
function b_getCyclesByProject_(projectId) {
  var pid = String(projectId || "").trim();
  if (!pid) return [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("DB_BillingCycle");
  if (!sh || sh.getLastRow() < 2) return [];

  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(x) { return String(x || "").trim(); });
  var colPid = header.indexOf("projectId");
  if (colPid < 0) return [];

  var data = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
  var results = [];
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][colPid] || "").trim() !== pid) continue;
    var obj = {};
    for (var j = 0; j < header.length; j++) {
      obj[header[j]] = data[i][j];
    }
    results.push(obj);
  }
  return results;
}

/**
 * BillingCycleの現在ステータスをタイムスタンプから導出する
 * 全箇所でこれだけを見る（個別判定を散らさない）
 */
function b_deriveBillingStatus_(cycle) {
  if (!cycle) return "none";
  if (cycle.paymentConfirmedAt) return "closed";
  if (cycle.invoiceSentAt)      return "awaiting_payment";
  if (cycle.invoiceIssuedAt)    return "invoice_issued";
  if (cycle.budgetConfirmedAt)  return "ready_to_invoice";
  return "pending_budget";
}