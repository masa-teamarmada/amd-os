/** 067_PjChronicleApi.gs
 * PJクロニクル（通期俯瞰）ページ用API。
 * 全月分のサマリ行を軽量で返す。展開時の詳細は既存APIを再利用。
 */

/**
 * クロニクル初期データ取得
 * @param {Object} payload { projectId: string }
 * @return {Object}
 */
function chronicle_api_getData(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };

  // PJ基本情報
  var project = cockpit_getProject_(projectId);
  if (!project) return { ok: false, message: "PJが見つからない: " + projectId };

  // 月額予算をDB_Projectsから取得
  project.monthlyBudgetYen = chronicle_getMonthlyBudget_(projectId);

  // currentYm
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var currentYm = String(jst.getFullYear()) + ("0" + (jst.getMonth() + 1)).slice(-2);

  // startYmから全月分のymListを生成
  var startYm = cockpit_getProjectStartYm_(projectId);
  var months;
  if (startYm) {
    var sy = parseInt(startYm.substring(0, 4), 10);
    var sm = parseInt(startYm.substring(4, 6), 10);
    var cy = parseInt(currentYm.substring(0, 4), 10);
    var cm = parseInt(currentYm.substring(4, 6), 10);
    months = (cy - sy) * 12 + (cm - sm) + 1;
  }
  if (!months || months < 1) months = 6;
  if (months > 60) months = 60;

  var ymList = cockpit_buildYmList_(currentYm, months);

  // BillingCycle一括取得
  var billingMap = cockpit_getBillingMap_(projectId, ymList);

  // メンバー別報酬をBillingCycleから抽出
  var allocMap = chronicle_getAllocMap_(billingMap);

  // MonthlyReports一括取得（slideSummary + sectionSummary）
  var reportMap = chronicle_getReportSummaryMap_(projectId, ymList);

  // PJメンバー一覧（列ヘッダ用）
  var pjMembers = chronicle_getProjectMembers_(projectId);

  // サマリ組み立て
  var monthRows = ymList.map(function(ym) {
    var b = billingMap[ym] || {};
    var r = reportMap[ym] || {};

    return {
      ym: ym,
      budgetYen: Number(b.fixedTotalYen || b.budgetYen || b.budgetTotal || 0),
      allocations: allocMap[ym] || {},
      // 5タスクバッジ
      meetingDone: !!(b.meetingStartAt || b.meetingEventId),
      meetingSkipped: String(b.meetingSkipped || "") === "TRUE",
      budgetDone: !!b.budgetConfirmedAt,
      reportDone: !!(b.monthlyReportFileId || b.monthlyReportUrl),
      invoiceDone: !!b.invoiceSentAt,
      paymentDone: !!b.paymentConfirmedAt,

      // 請求・入金の日付（未入金アラート用）
      invoiceSentAt: String(b.invoiceSentAt || ""),
      paymentConfirmedAt: String(b.paymentConfirmedAt || ""),

      // レポートサマリ
      slideSummary: r.slideSummary || "",
      sectionSummary: r.sectionSummary || "",
      hasReport: !!(r.slideSummary || r.sectionSummary || r.hasDraft)
    };
  });

  return {
    ok: true,
    project: project,
    currentYm: currentYm,
    months: monthRows,
    members: pjMembers
  };
}

// ===== 内部関数 =====

/**
 * DB_Projectsから月額予算を取得
 */
function chronicle_getMonthlyBudget_(projectId) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
    if (!sh) return 0;
    var header = cockpit_headerMap_(sh);
    if (!header.projectId) return 0;
    var budgetCol = header.monthlyBudgetYen || header.budgetYen || header.monthlyFee || 0;
    if (!budgetCol) return 0;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return 0;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.projectId - 1] || "").trim() === projectId) {
        return Number(values[i][budgetCol - 1] || 0);
      }
    }
  } catch (e) {}
  return 0;
}

/**
 * DB_MonthlyReportsからslideSummary + sectionSummaryを一括取得
 */
function chronicle_getReportSummaryMap_(projectId, ymList) {
  var map = {};
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_MonthlyReports");
    if (!sh) return map;
    var header = cockpit_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return map;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

    var ymSet = {};
    ymList.forEach(function(ym) { ymSet[ym] = true; });

    var slideSummaryCol = header.slideSummary || 0;
    var sectionSummaryCol = header.sectionSummary || 0;
    var draftContentCol = header.draftContent || 0;

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var ym = String(values[i][(header.ym || 0) - 1] || "").trim();
      if (pid !== projectId || !ymSet[ym]) continue;

      var slide = slideSummaryCol ? String(values[i][slideSummaryCol - 1] || "").trim() : "";
      var section = sectionSummaryCol ? String(values[i][sectionSummaryCol - 1] || "").trim() : "";
      var hasDraft = draftContentCol ? !!String(values[i][draftContentCol - 1] || "").trim() : false;

      // slideSummaryが空ならdraftContentからフォールバック抽出
      if (!slide && hasDraft) {
        var draft = String(values[i][draftContentCol - 1] || "");
        var m = draft.match(/##\s*(?:\d+\.\s*)?スライド用サマリー\s*\n+([\s\S]*?)(?=\n##|\n*$)/);
        if (m) slide = m[1].trim();
      }

      map[ym] = {
        slideSummary: slide,
        sectionSummary: section,
        hasDraft: hasDraft
      };
    }
  } catch (e) {}
  return map;
}

/**
 * BillingCycleのmemberAllocationsJsonからメンバー別報酬マップを抽出
 * @return {Object} { ym: { memberId: amount, ... }, ... }
 */
function chronicle_getAllocMap_(billingMap) {
  var map = {};
  var yms = Object.keys(billingMap);
  for (var i = 0; i < yms.length; i++) {
    var ym = yms[i];
    var raw = String(billingMap[ym].memberAllocationsJson || "").trim();
    if (!raw) { map[ym] = {}; continue; }
    try {
      map[ym] = JSON.parse(raw);
    } catch (e) {
      map[ym] = {};
    }
  }
  return map;
}

/**
 * PJメンバー一覧を取得（列ヘッダ用）
 * @param {string} projectId
 * @return {Array<{memberId, memberName}>}
 */
function chronicle_getProjectMembers_(projectId) {
  var members = [];
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var pmSheet = ss.getSheetByName("DB_ProjectMembers");
    if (!pmSheet) return [];
    var pmData = pmSheet.getDataRange().getValues();
    var pmH = pmData[0];
    var pidIdx = pmH.indexOf("projectId");
    var midIdx = pmH.indexOf("memberId");
    var activeIdx = pmH.indexOf("isActive");
    if (pidIdx === -1 || midIdx === -1) return [];

    var memberIds = [];
    for (var i = 1; i < pmData.length; i++) {
      if (String(pmData[i][pidIdx] || "").trim() !== projectId) continue;
      if (activeIdx !== -1 && (pmData[i][activeIdx] === false || String(pmData[i][activeIdx]) === "FALSE")) continue;
      memberIds.push(String(pmData[i][midIdx] || "").trim());
    }

    var mSheet = ss.getSheetByName("DB_Members");
    if (!mSheet) return memberIds.map(function(id) { return { memberId: id, memberName: id }; });
    var mData = mSheet.getDataRange().getValues();
    var mH = mData[0];
    var mIdIdx = mH.indexOf("memberId");
    var mNameIdx = mH.indexOf("memberName");
    if (mIdIdx === -1) return memberIds.map(function(id) { return { memberId: id, memberName: id }; });

    var nameMap = {};
    for (var j = 1; j < mData.length; j++) {
      nameMap[String(mData[j][mIdIdx] || "")] = mNameIdx !== -1 ? String(mData[j][mNameIdx] || "") : "";
    }

    for (var k = 0; k < memberIds.length; k++) {
      members.push({
        memberId: memberIds[k],
        memberName: nameMap[memberIds[k]] || memberIds[k]
      });
    }
  } catch (e) {}
  return members;
}