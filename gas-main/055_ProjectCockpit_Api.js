/** 055_ProjectCockpit_Api.gs
 * コックピット画面用APIエントリポイント。
 * PJ基本情報＋直近N月分のBilling/Report/Rewardサマリを一括返却。
 */

/**
 * コックピット初期データを一括取得
 * @param {Object} payload { projectId: string, months: number(default 6) }
 * @return {Object} { ok, project, monthlySummaries[], currentYm }
 */
function cockpit_api_getData(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };

  // 1) PJ基本情報
  var project = cockpit_getProject_(projectId);
  if (!project) return { ok: false, message: "PJが見つからない: " + projectId };

  // 2) currentYm を先に確定
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var currentYm = String(jst.getFullYear()) + ("0" + (jst.getMonth() + 1)).slice(-2);

  // 3) months: 指定があればそれ、なければ startYm から自動算出
  var months = Number(payload.months || 0);
  if (!months || months < 1) {
    var pjStartYm = cockpit_getProjectStartYm_(projectId);
    if (pjStartYm) {
      var sy = parseInt(pjStartYm.substring(0, 4), 10);
      var sm = parseInt(pjStartYm.substring(4, 6), 10);
      var cy = parseInt(currentYm.substring(0, 4), 10);
      var cm = parseInt(currentYm.substring(4, 6), 10);
      months = (cy - sy) * 12 + (cm - sm) + 1;
    }
    if (!months || months < 1) months = 6;
  }
  if (months > 60) months = 60;

  // 翌月分までコックピットに表示する
  var nextY = parseInt(currentYm.substring(0,4),10);
  var nextM = parseInt(currentYm.substring(4,6),10) + 1;
  if (nextM > 12) { nextM = 1; nextY++; }
  var nextYm = String(nextY) + ("0" + nextM).slice(-2);
  var ymList = cockpit_buildYmList_(nextYm, months + 1);

  // 3) BillingCycle一括取得
  var billingMap = cockpit_getBillingMap_(projectId, ymList);

  // 4) MonthlyReports一括取得（冒頭抜粋のみ）
  var reportMap = cockpit_getReportExcerptMap_(projectId, ymList);

  // 4.5) MonthlyReportsからpending/fix状態を取得
  var reportStatusMap = {};
  try {
    var _rpRows = b_readTable_("DB_MonthlyReports");
    for (var ri = 0; ri < _rpRows.length; ri++) {
      var _rr = _rpRows[ri];
      if (String(_rr.projectId || "").trim() !== projectId) continue;
      var _rym = b_normYm_(_rr.ym);
      if (!_rym) continue;
      reportStatusMap[_rym] = {
        hasContent: !!(_rr.draftContent || _rr.finalContent),
        isFixed: !!String(_rr.fixedAtJst || "").trim(),
        hasPending: String(_rr.pendingStatus || "").trim() === "pending"
      };
    }
  } catch(e) {}

  // 5) サマリ組み立て
  var summaries = ymList.map(function(ym) {
    var b = billingMap[ym] || {};
    var excerpt = reportMap[ym] || "";
    var rs = reportStatusMap[ym] || {};

    var msProgressSummary = [];
    try {
      if (b.msProgressSummaryJson) {
        msProgressSummary = JSON.parse(b.msProgressSummaryJson) || [];
      }
    } catch(e) {}

    return {
      ym: ym,
      meetingDone: !!(b.meetingStartAt || b.meetingEventId),
      budgetDone: !!b.budgetConfirmedAt,
      allocDone: !!b.allocationConfirmedAt,
      reportDone: !!(b.monthlyReportFixedAt),
      invoiceDone: !!b.invoiceSentAt,
      paymentDone: !!b.paymentConfirmedAt,
      billingAmount: Number(b.fixedTotalYen || b.budgetYen || b.budgetTotal || 0),
      reportExcerpt: excerpt,
      reportNeedsReview: (rs.hasContent && !rs.isFixed) || rs.hasPending,
      msProgressSummary: msProgressSummary
    };
  });

  // 6) Origin率（全期間、rejected除外）
  var originRate = null;
  try {
    var evRows = b_readTable_("DB_ProgressEvents");
    var oTotal = 0, oAmd = 0, oCo = 0, oClient = 0, oExternal = 0, oUnknown = 0;
    for (var ei = 0; ei < evRows.length; ei++) {
      var ev = evRows[ei];
      if (String(ev.projectId || "").trim() !== projectId) continue;
      if (String(ev.status || "").trim() === "rejected") continue;
      oTotal++;
      var orig = String(ev.initiativeOrigin || "unknown").trim();
      if (orig === "amd_proposed") oAmd++;
      else if (orig === "co_decided") oCo++;
      else if (orig === "client_requested" || orig === "partner_proposed") oClient++;
      else if (orig === "external") oExternal++;
      else oUnknown++;
    }
    var judgeable = oTotal - oExternal;
    if (oTotal >= 5) {
      originRate = {
        total: oTotal,
        amdProposed: oAmd,
        coDecided: oCo,
        clientRequested: oClient,
        external: oExternal,
        unknown: oUnknown,
        judgeable: judgeable,
        amdPct: judgeable >= 1 ? Math.round((oAmd + oCo) / judgeable * 100) : 0,
        clientPct: judgeable >= 1 ? Math.round(oClient / judgeable * 100) : 0
      };
    }
  } catch (e) {}

  // メンバー一覧（active）
  var members = [];
  try {
    var mRows = b_readTable_("DB_Members");
    for (var mi = 0; mi < mRows.length; mi++) {
      var mr = mRows[mi];
      if (String(mr.status || "active").toLowerCase() !== "active") continue;
      var cn = String(mr.codeName || mr.name || "").trim();
      if (cn) members.push(cn);
    }
    members.sort();
  } catch(e) {}

  return JSON.parse(JSON.stringify({
    ok: true,
    project: project,
    currentYm: currentYm,
    monthlySummaries: summaries,
    originRate: originRate,
    members: members
  }));
}

/**
 * モーダル用：指定月の詳細データを取得
 * @param {Object} payload { projectId, ym }
 * @return {Object} { ok, report, billing, rewardEvents[], rewardPayouts[], pending }
 */
function cockpit_api_getMonthDetail(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId and ym required" };

  // 報告書全文
  var report = cockpit_getFullReport_(projectId, ym);

  // Billing詳細
  var billing = cockpit_getBillingDetail_(projectId, ym);

  // pending情報
  var pending = null;
  if (report) {
    var pStatus = String(report.pendingStatus || "").trim();
    var pContent = String(report.pendingDraftContent || "").trim();
    if (pStatus === "pending" && pContent) {
      pending = {
        hasPending: true,
        pendingDraft: pContent,
        deltaSummary: String(report.pendingDeltaSummary || ""),
        deltaAt: String(report.pendingDeltaAt || "")
      };
    }
  }

  // 報酬イベント
  var events = [];
  var payouts = [];
  try {
    events = reward_repo_listEvents_(projectId, ym);
    var eventIds = events.map(function(e) { return e.eventId; });
    var allResp = eventIds.length ? reward_repo_listResponsibilities_(eventIds) : [];
    var respMap = {};
    allResp.forEach(function(r) {
      if (!respMap[r.eventId]) respMap[r.eventId] = [];
      respMap[r.eventId].push(r);
    });
    events = events.map(function(e) {
      e.responsibilities = respMap[e.eventId] || [];
      return e;
    });

    payouts = reward_repo_listPayouts_(projectId, ym);
  } catch (e) {}

  return JSON.parse(JSON.stringify({
    ok: true,
    report: report,
    billing: billing,
    pending: pending,
    rewardEvents: events,
    rewardPayouts: payouts
  }));
}

// ===== 内部関数 =====

function cockpit_getProject_(projectId) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
    if (!sh) return null;
    var header = cockpit_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.projectId - 1] || "").trim() === projectId) {
        return {
          projectId: projectId,
          projectName: String(values[i][(header.projectName || header.name) - 1] || "").trim(),
          clientName: String(values[i][(header.clientName || header.client) - 1] || "").trim(),
          status: String(values[i][(header.status || header.projectStatus) - 1] || "").trim()
        };
      }
    }
  } catch (e) {}
  return null;
}

function cockpit_buildYmList_(currentYm, count) {
  var list = [];
  var y = parseInt(currentYm.substring(0, 4), 10);
  var m = parseInt(currentYm.substring(4, 6), 10);
  for (var i = 0; i < count; i++) {
    list.push(String(y) + ("0" + m).slice(-2));
    m--;
    if (m < 1) { m = 12; y--; }
  }
  return list;
}

function cockpit_getBillingMap_(projectId, ymList) {
  var map = {};
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_BillingCycle");
    if (!sh) return map;
    var header = cockpit_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return map;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var ymSet = {};
    ymList.forEach(function(ym) { ymSet[ym] = true; });

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var ym = String(values[i][(header.ym || header.yearMonth) - 1] || "").trim();
      if (pid !== projectId || !ymSet[ym]) continue;
      var obj = {};
      Object.keys(header).forEach(function(k) {
        obj[k] = values[i][header[k] - 1];
      });
      map[ym] = obj;
    }
  } catch (e) {}
  return map;
}

function cockpit_getReportExcerptMap_(projectId, ymList) {
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

    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var ym = String(values[i][(header.ym || header.yearMonth) - 1] || "").trim();
      if (pid !== projectId || !ymSet[ym]) continue;
      var content = String(values[i][(header.finalContent || header.draftContent) - 1] || "").trim();
      if (!content && header.draftContent) {
        content = String(values[i][header.draftContent - 1] || "").trim();
      }
      map[ym] = content.substring(0, 120);
    }
  } catch (e) {}
  return map;
}

function cockpit_getFullReport_(projectId, ym) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_MonthlyReports");
    if (!sh) return null;
    var header = cockpit_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var rym = String(values[i][(header.ym || header.yearMonth) - 1] || "").trim();
      if (pid === projectId && rym === ym) {
        var obj = {};
        Object.keys(header).forEach(function(k) {
          obj[k] = String(values[i][header[k] - 1] || "");
        });
        return obj;
      }
    }
  } catch (e) {}
  return null;
}

function cockpit_getBillingDetail_(projectId, ym) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_BillingCycle");
    if (!sh) return null;
    var header = cockpit_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      var rym = String(values[i][(header.ym || header.yearMonth) - 1] || "").trim();
      if (pid === projectId && rym === ym) {
        var obj = {};
        Object.keys(header).forEach(function(k) {
          obj[k] = String(values[i][header[k] - 1] || "");
        });
        return obj;
      }
    }
  } catch (e) {}
  return null;
}

function cockpit_toBool_(val) {
  if (val === true || val === "TRUE" || val === "true" || val === "1" || val === 1) return true;
  var s = String(val || "").trim().toLowerCase();
  return s === "done" || s === "yes" || s === "confirmed" || s === "sent" || s === "scheduled" || s === "completed";
}

function cockpit_headerMap_(sh) {
  var row1 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var c = 0; c < row1.length; c++) {
    var key = String(row1[c] || "").trim();
    if (key) map[key] = c + 1;
  }
  return map;
}

// ===== ゴール階層 =====
/**
 * 目標階層データを取得（年次/Q/月次マイルストーン + Responsibility）
 * @param {Object} payload { projectId: string }
 * @return {Object} { ok, planCycle, milestones: { annual[], quarterly:{}, monthly:{} }, pjMembers[] }
 */
function cockpit_api_getGoalHierarchy(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };

  // Navigator スプシから読む
  var ss;
  try {
    ss = valuePlan_getDbSpreadsheet();
  } catch (e) {
    return { ok: true, planCycle: null, milestones: { annual: [], quarterly: {}, monthly: {} }, pjMembers: [] };
  }

  // 1) DB_ValuePlanCycles から projectId の最新を取る
  var planCycle = cockpit_getLatestPlanCycle_(ss, projectId);
  if (!planCycle) {
    return { ok: true, planCycle: null, milestones: { annual: [], quarterly: {}, monthly: {} }, pjMembers: [] };
  }

  // 2) DB_ValueMilestones から planCycleId + isActive=true を取得
  var allMs = cockpit_getActiveMilestones_(ss, planCycle.planCycleId);

  // 3) DB_MilestoneResponsibility からR値読み込み
  var respMap = {}; // milestoneKey -> [{memberId, share}]
  try {
    var respRows = cpReadSheetAsTable_(ss, "DB_MilestoneResponsibility");
    var pcId = String(planCycle.planCycleId || "");
    for (var ri = 0; ri < respRows.length; ri++) {
      var rr = respRows[ri];
      if (String(rr.projectId || "") !== projectId) continue;
      if (String(rr.planCycleId || "") !== pcId) continue;
      var mk = String(rr.milestoneKey || "").trim();
      var mid = String(rr.memberId || "").trim();
      var share = Number(rr.share || 0);
      if (!mk || !mid || share <= 0) continue;
      if (!respMap[mk]) respMap[mk] = {};
      // 同一MS×メンバーで複数行ある場合は最新（後勝ち）
      respMap[mk][mid] = share;
    }
  } catch (e) {
    // シートなければ空でOK
  }

  // メンバーマスタ（codeName解決用）
  var memberNameMap = {};
  try {
    var memberRows = b_readTable_("DB_Members");
    for (var mi = 0; mi < memberRows.length; mi++) {
      memberNameMap[String(memberRows[mi].memberId || "")] = String(memberRows[mi].codeName || memberRows[mi].name || "");
    }
  } catch (e) {}

  // PJメンバー一覧（編集UI用）
  var pjMembers = [];
  try {
    var pjmRows = b_readTable_("DB_ProjectMembers");
    for (var pi = 0; pi < pjmRows.length; pi++) {
      var pm = pjmRows[pi];
      if (String(pm.projectId || "") !== projectId) continue;
      if (String(pm.isActive || "true") === "false") continue;
      var pmId = String(pm.memberId || "").trim();
      pjMembers.push({
        memberId: pmId,
        memberName: memberNameMap[pmId] || pmId
      });
    }
  } catch (e) {}

  // 4) 各MSにresponsibilities配列を付与
  for (var i = 0; i < allMs.length; i++) {
    var ms = allMs[i];
    var msKey = String(ms.milestoneId || "").trim();
    var respEntries = respMap[msKey] || {};
    var resps = [];
    var mids = Object.keys(respEntries);
    for (var j = 0; j < mids.length; j++) {
      resps.push({
        memberId: mids[j],
        codeName: memberNameMap[mids[j]] || mids[j],
        share: respEntries[mids[j]]
      });
    }
    resps.sort(function(a, b) { return b.share - a.share; });
    ms.responsibilities = resps;
  }

  // 5) goalLevel でグループ分け
  var result = { annual: [], quarterly: {}, monthly: {} };
  for (var i = 0; i < allMs.length; i++) {
    var ms = allMs[i];
    var level = String(ms.goalLevel || "annual").toLowerCase();
    var targetYm = String(ms.targetYm || "").trim();

    if (level === "quarterly") {
      if (!result.quarterly[targetYm]) result.quarterly[targetYm] = [];
      result.quarterly[targetYm].push(ms);
    } else if (level === "monthly") {
      if (!result.monthly[targetYm]) result.monthly[targetYm] = [];
      result.monthly[targetYm].push(ms);
    } else {
      result.annual.push(ms);
    }
  }

  // orderNoソート
  result.annual.sort(function(a, b) { return Number(a.orderNo || 0) - Number(b.orderNo || 0); });
  Object.keys(result.quarterly).forEach(function(k) {
    result.quarterly[k].sort(function(a, b) { return Number(a.orderNo || 0) - Number(b.orderNo || 0); });
  });
  Object.keys(result.monthly).forEach(function(k) {
    result.monthly[k].sort(function(a, b) { return Number(a.orderNo || 0) - Number(b.orderNo || 0); });
  });

  return JSON.parse(JSON.stringify({
    ok: true,
    planCycle: planCycle,
    milestones: result,
    pjMembers: pjMembers
  }));
}

/** DB_ValuePlanCycles から projectId の最新（fixed優先、なければdraft）を返す */
function cockpit_getLatestPlanCycle_(ss, projectId) {
  var sh = ss.getSheetByName("DB_ValuePlanCycles");
  if (!sh) return null;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var header = cockpit_headerMap_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();

  var fixed = null;
  var draft = null;
  for (var i = 0; i < values.length; i++) {
    var pid = String(values[i][header.projectId - 1] || "").trim();
    if (pid !== projectId) continue;

    var obj = {};
    Object.keys(header).forEach(function(k) { obj[k] = values[i][header[k] - 1]; });

    var st = String(obj.status || "").toLowerCase();
    if (st === "fixed") {
      if (!fixed || String(obj.updatedAt || "") > String(fixed.updatedAt || "")) fixed = obj;
    } else {
      if (!draft || String(obj.updatedAt || "") > String(draft.updatedAt || "")) draft = obj;
    }
  }
  return fixed || draft || null;
}

/** DB_ValueMilestones から planCycleId + isActive=true を全取得 */
function cockpit_getActiveMilestones_(ss, planCycleId) {
  var sh = ss.getSheetByName("DB_ValueMilestones");
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  var header = cockpit_headerMap_(sh);
  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  var pid = String(planCycleId || "").trim();
  var results = [];

  for (var i = 0; i < values.length; i++) {
    var cid = String(values[i][header.planCycleId - 1] || "").trim();
    if (cid !== pid) continue;

    var active = values[i][(header.isActive || 0) - 1];
    if (active === false || active === "false" || active === "FALSE") continue;

    var obj = {};
    Object.keys(header).forEach(function(k) { obj[k] = values[i][header[k] - 1]; });
    results.push(obj);
  }
  return results;
}

/**
 * 報酬ダッシュボード（v2: マイルストーン月次進捗率モデル）
 * マイルストーン進捗状況 + メンバー配分 + 参考イベントを一括返却
 */
function cockpit_api_getRewardDashboard(params) {
  var projectId = String(params.projectId || "");
  var ym        = String(params.ym || "");
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  // --- キャッシュ読み取り ---
  var rv2 = null;
  try {
    var sheet = b_ss_().getSheetByName('DB_BillingCycle');
    if (sheet) {
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
      var jsonIdx = headers.indexOf('rewardSummaryJson');
      var pidIdx = headers.indexOf('projectId');
      var ymIdx = headers.indexOf('ym');
      if (jsonIdx >= 0 && pidIdx >= 0 && ymIdx >= 0 && sheet.getLastRow() >= 2) {
        var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
        for (var i = 0; i < data.length; i++) {
          if (String(data[i][pidIdx]).trim() === projectId && String(data[i][ymIdx]).trim() === ym) {
            var cached = String(data[i][jsonIdx] || '').trim();
            if (cached) rv2 = JSON.parse(cached);
            break;
          }
        }
      }
    }
  } catch(e) {}

  // --- キャッシュミス時はリアルタイム計算 ---
  if (!rv2) {
    try {
      rv2 = rv2_calcRewardSummary(projectId, ym);
    } catch (e) {
      return { ok: false, message: "rv2_calcRewardSummary失敗: " + e.message };
    }
  }

  if (rv2.error) {
    return { ok: true, noPlan: true, message: rv2.error };
  }

  // --- planCycle情報 ---
  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
  var plan = null;
  for (var i = 0; i < pcRows.length; i++) {
    if (String(pcRows[i].projectId || "") === projectId && String(pcRows[i].status || "") === "fixed") {
      plan = pcRows[i]; break;
    }
  }
  var startYm = plan ? String(plan.periodStartYm || "") : "";
  var endYm   = plan ? String(plan.periodEndYm || "") : "";
  var cycleMonths = reward_ops_calcMonths_(startYm, endYm);

  // --- successCriteriaをDB_ValueMilestonesから補完 ---
  var criteriaMap = {};
  try {
    var scRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
    for (var sci = 0; sci < scRows.length; sci++) {
      var scr = scRows[sci];
      criteriaMap[String(scr.milestoneId || "").trim()] = String(scr.successCriteria || "");
    }
  } catch (e) {}

  // --- source情報取得 ---
  var sourceMap = {};
  try {
    var progRows = cpReadSheetAsTable_(navSs, "DB_MilestoneMonthlyProgress");
    for (var si = 0; si < progRows.length; si++) {
      var sr = progRows[si];
      if (String(sr.projectId || "") !== projectId) continue;
      if (String(sr.ym || "") !== ym) continue;
      sourceMap[String(sr.milestoneKey || "").trim()] = String(sr.source || "");
    }
  } catch (e) {}

  // --- マイルストーンUI用整形 ---
  var milestones = [];
  var msList = rv2.milestones || [];
  for (var m = 0; m < msList.length; m++) {
    var ms = msList[m];
    milestones.push({
      key: ms.milestoneKey,
      orderNo: m + 1,
      title: ms.title,
      tag: ms.tag || "normal",
      maxPt: ms.maxPt,
      consumedPt: ms.cumPt,
      thisMonthPt: ms.consumedPt,
      thisMonthPct: ms.progressPct,
      remainPt: Math.round(Math.max(0, ms.maxPt - ms.cumPt) * 100) / 100,
      pctUsed: ms.maxPt > 0 ? Math.round(ms.cumPt / ms.maxPt * 100) : 0,
      cumPct: ms.cumPct,
      successCriteria: criteriaMap[ms.milestoneKey] || "",
      source: sourceMap[ms.milestoneKey] || ""
    });
  }

  // --- 参考イベント ---
  var events = [];
  try {
    var evRows = b_readTable_("DB_ProgressEvents");
    var respRows = b_readTable_("DB_EventResponsibility");
    var memberRows = b_readTable_("DB_Members");
    var memberMap = {};
    for (var mi = 0; mi < memberRows.length; mi++) {
      var mm = memberRows[mi];
      memberMap[String(mm.memberId || "")] = String(mm.codeName || mm.name || mm.memberId || "");
    }
    var respByEv = {};
    for (var r = 0; r < respRows.length; r++) {
      var rr = respRows[r];
      if (String(rr.projectId || "") !== projectId || String(rr.ym || "") !== ym) continue;
      var eId = String(rr.eventId || "");
      if (!respByEv[eId]) respByEv[eId] = [];
      respByEv[eId].push({
        memberId: String(rr.memberId || ""),
        memberName: memberMap[String(rr.memberId || "")] || String(rr.memberId || ""),
        responsibility: Number(rr.responsibility || 0)
      });
    }
    for (var e = 0; e < evRows.length; e++) {
      var ev = evRows[e];
      if (String(ev.projectId || "") !== projectId || String(ev.ym || "") !== ym) continue;
      var evId = String(ev.eventId || "");
      events.push({
        eventId: evId,
        eventTitle: String(ev.eventTitle || ""),
        eventDescription: String(ev.eventDescription || ""),
        impact: Number(ev.impact || 0),
        depth: Number(ev.depth || 0),
        eventValue: Math.round(Number(ev.impact || 0) * Number(ev.depth || 0) * 100) / 100,
        status: String(ev.status || "draft"),
        rejectReason: String(ev.rejectReason || ""),
        initiativeOrigin: String(ev.initiativeOrigin || "unknown"),
        responsibilities: respByEv[evId] || []
      });
    }
  } catch (e) {}

  return JSON.parse(JSON.stringify({
    ok: true,
    version: "v2",
    plan: {
      totalPoints: rv2.totalPt,
      budgetYen: rv2.annualBudget,
      startYm: startYm,
      endYm: endYm,
      cycleMonths: cycleMonths,
      ptUnit: rv2.ptUnit
    },
    milestones: milestones,
    monthSummary: {
      ym: ym,
      monthConsumedPt: rv2.monthlyConsumedPt,
      cumulativeConsumedPt: rv2.cumulativeConsumedPt,
      progressPct: rv2.progressRate,
      expectedPct: rv2.expectedRate,
      members: rv2.members || [],
      monthlyBudget65: rv2.monthlyBudget65 || 0,
      totalPaySum: rv2.totalPaySum || 0,
      capped: !!rv2.capped,
      carryOverYen: rv2.carryOverYen || 0
    },
    events: events
  }));
}

/**
 * 任意のSpreadsheetオブジェクトからシートをテーブル読みする（Navigator等の外部スプシ用）
 */
function cpReadSheetAsTable_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  var vals = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = vals[0].map(function(h) { return String(h || "").trim(); });
  var out = [];
  for (var r = 1; r < vals.length; r++) {
    var any = false;
    for (var c = 0; c < headers.length; c++) {
      if (vals[r][c] !== "" && vals[r][c] !== null && vals[r][c] !== undefined) { any = true; break; }
    }
    if (!any) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) { obj[headers[c]] = vals[r][c]; }
    out.push(obj);
  }
  return out;
}

/**
 * 進捗率を保存（PM手動入力 or つくよみ提案の修正）
 * @param {Object} payload {
 *   projectId: string,
 *   ym: string (yyyymm),
 *   milestones: [{ milestoneKey: string, progressPct: number }]
 * }
 */
function cockpit_api_saveProgress(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  var milestones = payload.milestones || [];
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };
  if (!milestones.length) return { ok: false, message: "milestones空" };

  var email = Session.getActiveUser().getEmail();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";

  // planCycle取得（maxPt算出用）
  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
  var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");

  var plan = null;
  for (var i = 0; i < pcRows.length; i++) {
    if (String(pcRows[i].projectId || "") === projectId && String(pcRows[i].status || "") === "fixed") {
      plan = pcRows[i]; break;
    }
  }
  if (!plan) return { ok: false, message: "fixed planCycleなし" };

  var planCycleId = String(plan.planCycleId || "");

  // milestoneId → maxPt マップ
  var msMaxPt = {};
  for (var m = 0; m < msRows.length; m++) {
    var row = msRows[m];
    if (String(row.planCycleId || "") !== planCycleId) continue;
    if (row.isActive === false || row.isActive === "false" || row.isActive === "FALSE") continue;
    var key = String(row.milestoneId || "").trim();
    msMaxPt[key] = Number(row.points || 0);
  }

  // upsert
  var saved = 0;
  for (var i = 0; i < milestones.length; i++) {
    var ms = milestones[i];
    var key = String(ms.milestoneKey || "").trim();
    var pct = Number(ms.progressPct || 0);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    var maxPt = msMaxPt[key] || 0;
    var consumed = Math.round(maxPt * pct / 100 * 100) / 100;

    rv2_upsertProgress({
      projectId: projectId,
      planCycleId: planCycleId,
      milestoneKey: key,
      ym: ym,
      progressPct: pct,
      consumedPt: consumed,
      source: "pm_manual",
      confirmedBy: email,
      confirmedAtJst: now,
      note: ""
    });
    saved++;
  }

  cockpit_updateRewardSummaryCache_(projectId, ym);
  cockpit_updateMsProgressSummary_(projectId, ym);
  for (var pi = 0; pi < milestones.length; pi++) {
    var pms = milestones[pi];
    var pkey = String(pms.milestoneKey || "").trim();
    var ppct = Number(pms.progressPct || 0);
    if (ppct > 0 && pkey) {
      cockpit_propagateProgressForward_(projectId, planCycleId, pkey, ym, ppct, msMaxPt[pkey] || 0, email);
    }
  }
  return { ok: true, saved: saved };
}

/**
 * Responsibility（MS×メンバーのshare）を保存
 * @param {Object} payload {
 *   projectId, ym,
 *   responsibilities: [{ milestoneKey, memberId, share }]
 * }
 */
function cockpit_api_saveResponsibility(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  var rows = payload.responsibilities || [];
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };
  if (!rows.length) return { ok: false, message: "responsibilities空" };

  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
  var plan = null;
  for (var i = 0; i < pcRows.length; i++) {
    if (String(pcRows[i].projectId || "") === projectId && String(pcRows[i].status || "") === "fixed") {
      plan = pcRows[i]; break;
    }
  }
  if (!plan) return { ok: false, message: "fixed planCycleなし" };
  var planCycleId = String(plan.planCycleId || "");

  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";
  var saved = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    rv2_upsertResponsibility({
      projectId: projectId,
      planCycleId: planCycleId,
      milestoneKey: String(r.milestoneKey || ""),
      ym: ym,
      memberId: String(r.memberId || ""),
      share: Number(r.share || 0),
      source: "pm_manual",
      updatedAtJst: now
    });
    saved++;
  }
  cockpit_clearRewardSummaryCache_(projectId, ym);
  return { ok: true, saved: saved };
}

/**
 * 指定PJ×ymのresponsibilityデータを返す（編集UI用）
 */
function cockpit_api_getResponsibility(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  var rows = rv2_readResponsibilityForProjectYm(projectId, ym);

  // メンバーマスタ
  var memberRows = b_readTable_("DB_Members");
  var memberMap = {};
  for (var i = 0; i < memberRows.length; i++) {
    var mm = memberRows[i];
    memberMap[String(mm.memberId || "")] = String(mm.codeName || mm.name || mm.memberId || "");
  }

  // PJメンバー
  var pmRows = b_readTable_("DB_ProjectMembers");
  var pjMembers = [];
  for (var i = 0; i < pmRows.length; i++) {
    var pm = pmRows[i];
    if (String(pm.projectId || "") !== projectId) continue;
    if (String(pm.isActive || "") === "FALSE" || pm.isActive === false) continue;
    var mid = String(pm.memberId || "");
    pjMembers.push({
      memberId: mid,
      memberName: memberMap[mid] || mid
    });
  }

  return JSON.parse(JSON.stringify({
    ok: true,
    responsibilities: rows,
    pjMembers: pjMembers
  }));
}

/**
 * つくよみ推定を実行（ボタンから手動トリガー）
 * 報告書がなければ先に生成してから推定を実行
 * v2推定に加えてイベント抽出（054）も同時実行し、先手力データを生成する
 */
function cockpit_api_runEstimate(params) {
  params = params || {};
  var projectId = String(params.projectId || "").trim();
  var ym = String(params.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  // 報告書がなければ先に生成
  var reportText = rv2_est_getReportText_(projectId, ym);
  if (!reportText) {
    try {
      Logger.log("報告書なし → 自動生成開始: " + projectId + " / " + ym);
      var genRes = api_generateMonthlyReport(projectId, ym, true);
      Logger.log("報告書生成結果: " + JSON.stringify(genRes));
    } catch (e) {
      Logger.log("報告書生成エラー（推定は続行）: " + e.message);
    }
  }

  // イベント抽出（054）→ 先手力データ生成（既存あればスキップされる）
  var extractCount = 0;
  try {
    var extractRes = reward_extractEvents({ projectId: projectId, ym: ym });
    extractCount = (extractRes && extractRes.eventCount) || 0;
    Logger.log("イベント抽出結果: " + JSON.stringify(extractRes));
  } catch (e) {
    Logger.log("イベント抽出エラー（推定は続行）: " + e.message);
  }

  // v2推定
  var result = rv2_estimateFromSources(projectId, ym, true);
  if (result && result.ok) {
    result.extractedEvents = extractCount;
    try {
      cockpit_updateRewardSummaryCache_(projectId, ym);
      cockpit_updateMsProgressSummary_(projectId, ym);
    } catch(e) {
      Logger.log('[cockpit_api_runEstimate] cache update error: ' + e);
    }
  }
  return result;
}

/**
 * 未確認のつくよみ推定を取得
 */
function cockpit_api_getUnconfirmedEstimates(params) {
  var projectId = String((params || {}).projectId || "").trim();
  var ym = String((params || {}).ym || "").trim();
  if (!projectId || !ym) return { ok: false };

  // 前月ym算出
  var py = parseInt(ym.substring(0,4), 10);
  var pm = parseInt(ym.substring(4,6), 10) - 1;
  if (pm < 1) { pm = 12; py--; }
  var prevYm = String(py) + ("0" + pm).slice(-2);

  // 前月の確定progress取得
  var prevRows = rv2_readProgressForProjectYm(projectId, prevYm);
  var prevPctMap = {};
  for (var j = 0; j < prevRows.length; j++) {
    var pr = prevRows[j];
    var src = String(pr.source || "");
    if (src === "pm_confirmed" || src === "pm_manual") {
      prevPctMap[String(pr.milestoneKey || "")] = Number(pr.progressPct || 0);
    }
  }

  var rows = rv2_readProgressForProjectYm(projectId, ym);
  var unconfirmed = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.source || "") === "tsukuyomi_estimate") {
      var msKey = String(r.milestoneKey || "");
      // 前月すでに100%なら推定不要なのでスキップ
      if ((prevPctMap[msKey] || 0) >= 100) continue;
      unconfirmed.push({
        milestoneKey: msKey,
        progressPct: Number(r.progressPct || 0),
        reason: String(r.note || ""),
        confirmedAtJst: String(r.confirmedAtJst || "")
      });
    }
  }

  return { ok: true, unconfirmed: unconfirmed };
}

/**
 * つくよみ推定を一括確認（source → pm_confirmed）
 */
function cockpit_api_confirmEstimates(params) {
  var projectId = String((params || {}).projectId || "").trim();
  var ym = String((params || {}).ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  var email = Session.getActiveUser().getEmail();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  var rows = rv2_readProgressForProjectYm(projectId, ym);
  var confirmed = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.source || "") !== "tsukuyomi_estimate") continue;

    rv2_upsertProgress({
      projectId: projectId,
      planCycleId: String(r.planCycleId || ""),
      milestoneKey: String(r.milestoneKey || ""),
      ym: ym,
      progressPct: Number(r.progressPct || 0),
      consumedPt: Number(r.consumedPt || 0),
      source: "pm_confirmed",
      confirmedBy: email,
      confirmedAtJst: now,
      note: String(r.note || "")
    });
    confirmed++;
  }

  return { ok: true, confirmed: confirmed };
}
/**
 * つくよみ推定に対する個別アクション（採用/不採用/修正）
 * @param {Object} params { projectId, ym, milestoneKey, action, reason?, newPct? }
 *   action: "adopt" | "reject" | "modify"
 */
function cockpit_api_handleEstimateAction(params) {
  params = params || {};
  var projectId = String(params.projectId || "").trim();
  var ym = String(params.ym || "").trim();
  var milestoneKey = String(params.milestoneKey || "").trim();
  var action = String(params.action || "").trim();
  if (!projectId || !ym || !milestoneKey || !action) {
    return { ok: false, message: "パラメータ不足" };
  }

  var email = Session.getActiveUser().getEmail();
  var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  // 現在行を取得
  var rows = rv2_readProgressForProjectYm(projectId, ym);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].milestoneKey || "").trim() === milestoneKey &&
        String(rows[i].source || "") === "tsukuyomi_estimate") {
      target = rows[i];
      break;
    }
  }
  if (!target) return { ok: false, message: "対象の推定行が見つからない" };

  if (action === "adopt") {
    // 採用: source → pm_confirmed
    rv2_upsertProgress({
      projectId: projectId,
      planCycleId: String(target.planCycleId || ""),
      milestoneKey: milestoneKey,
      ym: ym,
      progressPct: Number(target.progressPct || 0),
      consumedPt: Number(target.consumedPt || 0),
      source: "pm_confirmed",
      confirmedBy: email,
      confirmedAtJst: now,
      note: String(target.note || "")
    });
    cockpit_updateRewardSummaryCache_(projectId, ym);
    cockpit_updateMsProgressSummary_(projectId, ym);
    cockpit_propagateProgressForward_(projectId, String(target.planCycleId || ""), milestoneKey, ym, Number(target.progressPct || 0), 0, email);
    return { ok: true, action: "adopt", milestoneKey: milestoneKey, newPct: Number(target.progressPct || 0) };

  } else if (action === "reject") {
    // 不採用: source → pm_rejected、前月値に戻す
    var reason = String(params.reason || "").trim();
    // 前月ym算出
    var py = parseInt(ym.substring(0,4),10);
    var pm = parseInt(ym.substring(4,6),10) - 1;
    if (pm < 1) { pm = 12; py--; }
    var prevYm = String(py) + ("0" + pm).slice(-2);

    // 前月の確定progressPctを取得
    var prevRows = rv2_readProgressForProjectYm(projectId, prevYm);
    var prevPct = 0;
    for (var j = 0; j < prevRows.length; j++) {
      if (String(prevRows[j].milestoneKey || "").trim() === milestoneKey) {
        prevPct = Number(prevRows[j].progressPct || 0);
        break;
      }
    }

    // maxPt取得（consumedPt再計算用）
    var navSs = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
    var maxPt = 0;
    for (var k = 0; k < msRows.length; k++) {
      if (String(msRows[k].milestoneId || "").trim() === milestoneKey) {
        maxPt = Number(msRows[k].points || 0);
        break;
      }
    }
    var revertConsumed = Math.round(maxPt * prevPct / 100 * 100) / 100;

    rv2_upsertProgress({
      projectId: projectId,
      planCycleId: String(target.planCycleId || ""),
      milestoneKey: milestoneKey,
      ym: ym,
      progressPct: prevPct,
      consumedPt: revertConsumed,
      source: "pm_rejected",
      confirmedBy: email,
      confirmedAtJst: now,
      note: "不採用: " + (reason || "理由なし")
    });

    // 学習用フィードバック保存
    cockpit_appendEstimateFeedback_({
      projectId: projectId,
      ym: ym,
      milestoneKey: milestoneKey,
      action: "reject",
      aiPct: Number(target.progressPct || 0),
      pmPct: prevPct,
      aiReason: String(target.note || ""),
      pmFeedback: reason || "理由なし",
      confirmedBy: email,
      confirmedAtJst: now
    });

    cockpit_updateRewardSummaryCache_(projectId, ym);
    cockpit_updateMsProgressSummary_(projectId, ym);
    return { ok: true, action: "reject", milestoneKey: milestoneKey, revertedPct: prevPct };

  } else if (action === "modify") {
    var newPct = Math.max(0, Math.min(100, Number(params.newPct || 0)));
    var modifyReason = String(params.reason || "").trim();

    var navSs2 = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var msRows2 = cpReadSheetAsTable_(navSs2, "DB_ValueMilestones");
    var maxPt2 = 0;
    for (var k2 = 0; k2 < msRows2.length; k2++) {
      if (String(msRows2[k2].milestoneId || "").trim() === milestoneKey) {
        maxPt2 = Number(msRows2[k2].points || 0);
        break;
      }
    }
    var newConsumed = Math.round(maxPt2 * newPct / 100 * 100) / 100;
    var origPct = Number(target.progressPct || 0);

    rv2_upsertProgress({
      projectId: projectId,
      planCycleId: String(target.planCycleId || ""),
      milestoneKey: milestoneKey,
      ym: ym,
      progressPct: newPct,
      consumedPt: newConsumed,
      source: "pm_manual",
      confirmedBy: email,
      confirmedAtJst: now,
      note: "推定" + origPct + "%→手動修正" + newPct + "%" + (modifyReason ? " / " + modifyReason : "")
    });

    // 学習用フィードバック保存
    cockpit_appendEstimateFeedback_({
      projectId: projectId,
      ym: ym,
      milestoneKey: milestoneKey,
      action: "modify",
      aiPct: origPct,
      pmPct: newPct,
      aiReason: String(target.note || ""),
      pmFeedback: modifyReason,
      confirmedBy: email,
      confirmedAtJst: now
    });

    cockpit_updateRewardSummaryCache_(projectId, ym);
    cockpit_updateMsProgressSummary_(projectId, ym);
    cockpit_propagateProgressForward_(projectId, String(target.planCycleId || ""), milestoneKey, ym, newPct, maxPt2, email);
    return { ok: true, action: "modify", milestoneKey: milestoneKey, newPct: newPct };
  }

  return { ok: false, message: "不明なaction: " + action };
}

/** DB_Projects.startYm を取得 */
function cockpit_getProjectStartYm_(projectId) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
    if (!sh) return null;
    var header = cockpit_headerMap_(sh);
    if (!header.startYm || !header.projectId) return null;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.projectId - 1] || "").trim() === projectId) {
        var v = String(values[i][header.startYm - 1] || "").trim();
        if (/^\d{6}$/.test(v)) return v;
        return null;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * コックピットからMS設計セッションを開始する
 */
function cockpit_api_startMsDesign(payload) {
  return tsukuyomiMsDesign_start(payload);
}

/**
 * 月次Initiative Origin集計（AMD内部振り返り用）
 * @param {Object} payload { projectId: string, ym: string }
 * @return {Object} { ok, total, breakdown: { amd_proposed, co_decided, client_requested, unknown }, events[] }
 */
function cockpit_api_getOriginSummary(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  var events = [];
  try {
    events = reward_repo_listEvents_(projectId, ym);
  } catch (e) {
    return { ok: false, message: "イベント取得失敗: " + e };
  }

  // rejected除外で集計
  var active = events.filter(function(e) {
    return String(e.status || "").trim() !== "rejected";
  });

  var breakdown = { amd_proposed: 0, co_decided: 0, client_requested: 0, unknown: 0 };
  active.forEach(function(e) {
    var origin = String(e.initiativeOrigin || "unknown").trim();
    if (breakdown[origin] !== undefined) {
      breakdown[origin]++;
    } else {
      breakdown.unknown++;
    }
  });

  return JSON.parse(JSON.stringify({
    ok: true,
    total: active.length,
    breakdown: breakdown,
    events: active.map(function(e) {
      return {
        eventId: e.eventId,
        eventTitle: e.eventTitle,
        initiativeOrigin: String(e.initiativeOrigin || "unknown"),
        status: e.status
      };
    })
  }));
}

/** PJ全期間のOrigin率だけを軽量で返す */
function cockpit_api_getOriginRate(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return null;
  try {
    var evRows = b_readTable_("DB_ProgressEvents");
    var oTotal = 0, oAmd = 0, oCo = 0, oClient = 0, oExternal = 0, oUnknown = 0;
    for (var i = 0; i < evRows.length; i++) {
      if (String(evRows[i].projectId || "").trim() !== projectId) continue;
      if (String(evRows[i].status || "").trim() === "rejected") continue;
      oTotal++;
      var orig = String(evRows[i].initiativeOrigin || "unknown").trim();
      if (orig === "amd_proposed") oAmd++;
      else if (orig === "co_decided") oCo++;
      else if (orig === "client_requested" || orig === "partner_proposed") oClient++;
      else if (orig === "external") oExternal++;
      else oUnknown++;
    }
    var judgeable = oTotal - oExternal;
    if (judgeable < 5) return null;
    return { amdPct: Math.round((oAmd + oCo) / judgeable * 100), total: oTotal };
  } catch (e) { return null; }
}

// ===== 以下を055_ProjectCockpit_Api.gsの末尾に追加 =====

/**
 * コックピットからMS設計セッションを開始する
 * @param {object} payload - { projectId }
 * @return {object} { ok, sessionId, message }
 */
function cockpit_api_msDesign_start(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  return tsukuyomiMsDesign_start(projectId);
}

/**
 * MS設計セッションにPMの回答を送信する
 * @param {object} payload - { sessionId, text }
 * @return {object} { ok, phase, message, milestones?, summary? }
 */
function cockpit_api_msDesign_reply(payload) {
  payload = payload || {};
  var sessionId = String(payload.sessionId || "").trim();
  var text = String(payload.text || "").trim();
  return tsukuyomiMsDesign_reply(sessionId, text);
}

/**
 * MS設計案を仮確定する
 * @param {object} payload - { sessionId }
 * @return {object} { ok, planCycleId, milestoneCount }
 */
function cockpit_api_msDesign_fix(payload) {
  payload = payload || {};
  var sessionId = String(payload.sessionId || "").trim();
  return tsukuyomiMsDesign_fix(sessionId);
}

function cockpit_api_msDesign_saveDraft(params) {
  return tsukuyomiMsDesign_saveDraft(params.sessionId, params.answers);
}

function cockpit_api_msDesign_generate(params) {
  // 回答も同時に渡された場合は先に保存
  if (params.answers) {
    tsukuyomiMsDesign_saveDraft(params.sessionId, params.answers);
  }
  return tsukuyomiMsDesign_generate(params.sessionId, params.planMonths, params.budgetYen);
}

function cockpit_api_msDesign_backToHearing(params) {
  return tsukuyomiMsDesign_backToHearing(params.sessionId);
}

/**
 * 目標階層のMS別ポイントを一括更新
 * @param {{ projectId: string, milestones: Array<{milestoneId:string, points:number}>, newTotalPoints: number }}
 */
/**
 * 目標階層のMS別ポイント・タイトル・追加・削除を一括更新
 */
function cockpit_api_updateMsPoints(params) {
  try {
    var projectId = String(params.projectId || "").trim();
    var updates = params.milestones || [];
    var newTotal = Number(params.newTotalPoints || 0);
    if (!projectId || !updates.length) return { ok: false, message: "パラメータ不足" };

    var ss = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var msSheet = ss.getSheetByName("DB_ValueMilestones");
    if (!msSheet) return { ok: false, message: "DB_ValueMilestones not found" };

    var msData = msSheet.getDataRange().getValues();
    var msHeaders = msData[0];
    var colMsId     = msHeaders.indexOf("milestoneId");
    var colPoints   = msHeaders.indexOf("points");
    var colTargetYm = msHeaders.indexOf("targetYm");
    var colTitle    = msHeaders.indexOf("title");
    var colCriteria = msHeaders.indexOf("successCriteria");
    var colTag      = msHeaders.indexOf("tag");
    var colOrderNo  = msHeaders.indexOf("orderNo");
    var colIsActive = msHeaders.indexOf("isActive");
    var colProjId   = msHeaders.indexOf("projectId");
    var colPcId     = msHeaders.indexOf("planCycleId");
    if (colMsId < 0 || colPoints < 0) return { ok: false, message: "column not found" };

    // planCycleId取得
    var planCycleId = "";
    var pcSheet = ss.getSheetByName("DB_ValuePlanCycles");
    if (pcSheet) {
      var pcData = pcSheet.getDataRange().getValues();
      var pcHd = pcData[0];
      var cPcPjId = pcHd.indexOf("projectId");
      var cPcId   = pcHd.indexOf("planCycleId");
      if (cPcPjId >= 0 && cPcId >= 0) {
        for (var pr = 1; pr < pcData.length; pr++) {
          if (String(pcData[pr][cPcPjId] || "").trim() === projectId) {
            planCycleId = String(pcData[pr][cPcId] || "");
            break;
          }
        }
      }
    }

    var nowStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");
    var updatedCount = 0;
    var appendRows = [];

    for (var i = 0; i < updates.length; i++) {
      var u = updates[i];
      var targetId = String(u.milestoneId || "").trim();
      var isNew = u._isNew === true || u._isNew === "true";

      // --- 新規MS追加 ---
      if (isNew || !targetId) {
        var title = String(u.title || "").trim();
        if (!title) continue;
        var newMsId = "ms_" + projectId + "_" + Date.now() + "_" + i;
        var newRow = [];
        for (var ci = 0; ci < msHeaders.length; ci++) newRow.push("");
        if (colMsId >= 0)     newRow[colMsId]     = newMsId;
        if (colProjId >= 0)   newRow[colProjId]    = projectId;
        if (colPcId >= 0)     newRow[colPcId]      = planCycleId;
        if (colTitle >= 0)    newRow[colTitle]      = title;
        if (colPoints >= 0)   newRow[colPoints]     = Number(u.points || 0);
        if (colTag >= 0)      newRow[colTag]        = String(u.tag || "normal");
        if (colOrderNo >= 0)  newRow[colOrderNo]    = Number(u.orderNo || (i + 1));
        if (colIsActive >= 0) newRow[colIsActive]   = u.isActive !== false;
        if (colTargetYm >= 0 && u.targetYm) newRow[colTargetYm] = String(u.targetYm);
        if (colCriteria >= 0 && u.successCriteria) newRow[colCriteria] = String(u.successCriteria);
        appendRows.push(newRow);
        updatedCount++;
        continue;
      }

      // --- 既存MS更新 ---
      for (var r = 1; r < msData.length; r++) {
        if (String(msData[r][colMsId] || "").trim() === targetId) {
          msSheet.getRange(r + 1, colPoints + 1).setValue(Number(u.points || 0));
          // タイトル更新
          if (colTitle >= 0 && u.title !== undefined && u.title !== "") {
            msSheet.getRange(r + 1, colTitle + 1).setValue(String(u.title));
          }
          // targetYm更新
          if (colTargetYm >= 0 && u.targetYm !== undefined && u.targetYm !== "") {
            msSheet.getRange(r + 1, colTargetYm + 1).setValue(String(u.targetYm));
          }
          // successCriteria更新
          if (colCriteria >= 0 && u.successCriteria !== undefined) {
            msSheet.getRange(r + 1, colCriteria + 1).setValue(String(u.successCriteria));
          }
          // 論理削除/復活
          if (colIsActive >= 0 && u.isActive !== undefined) {
            msSheet.getRange(r + 1, colIsActive + 1).setValue(u.isActive !== false);
          }
          // orderNo更新
          if (colOrderNo >= 0 && u.orderNo !== undefined) {
            msSheet.getRange(r + 1, colOrderNo + 1).setValue(Number(u.orderNo));
          }
          updatedCount++;
          break;
        }
      }
    }

    // 新規行の一括追記
    if (appendRows.length > 0) {
      msSheet.getRange(msSheet.getLastRow() + 1, 1, appendRows.length, msHeaders.length)
        .setValues(appendRows);
    }

    // planCycleのtotalPoints更新
    if (pcSheet) {
      var pcData2 = pcSheet.getDataRange().getValues();
      var pcHd2 = pcData2[0];
      var colPcPjId2 = pcHd2.indexOf("projectId");
      var colPcTotal = pcHd2.indexOf("totalPoints");
      var colPcUpdated = pcHd2.indexOf("updatedAt");
      if (colPcPjId2 >= 0 && colPcTotal >= 0) {
        for (var r2 = 1; r2 < pcData2.length; r2++) {
          if (String(pcData2[r2][colPcPjId2] || "").trim() === projectId) {
            pcSheet.getRange(r2 + 1, colPcTotal + 1).setValue(newTotal);
            if (colPcUpdated >= 0) {
              pcSheet.getRange(r2 + 1, colPcUpdated + 1).setValue(nowStr);
            }
            break;
          }
        }
      }
    }

    // ===== R値（responsibility）保存 =====
    var respArr = params.responsibilities || [];
    if (respArr.length > 0) {
      try {
        var respSheet = ss.getSheetByName("DB_MilestoneResponsibility");
        if (respSheet) {
          var respData = respSheet.getDataRange().getValues();
          var respHeaders = respData[0] || [];
          var rColProjId  = respHeaders.indexOf("projectId");
          var rColPcId    = respHeaders.indexOf("planCycleId");
          var rColMsKey   = respHeaders.indexOf("milestoneKey");
          var rColYm      = respHeaders.indexOf("ym");
          var rColMemId   = respHeaders.indexOf("memberId");
          var rColShare   = respHeaders.indexOf("share");
          var rColSource  = respHeaders.indexOf("source");
          var rColUpdated = respHeaders.indexOf("updatedAtJst");

          if (rColProjId >= 0 && rColMsKey >= 0 && rColMemId >= 0 && rColShare >= 0) {
            var existingMap = {};
            for (var ei = 1; ei < respData.length; ei++) {
              var ePid  = String(respData[ei][rColProjId] || "");
              var ePcid = String(respData[ei][rColPcId] || "");
              var eMsKey = String(respData[ei][rColMsKey] || "").trim();
              var eMid   = String(respData[ei][rColMemId] || "").trim();
              if (ePid === projectId && ePcid === planCycleId) {
                existingMap[eMsKey + "_" + eMid] = ei + 1;
              }
            }

            var respAppend = [];
            for (var ri = 0; ri < respArr.length; ri++) {
              var rr = respArr[ri];
              var rMsKey = String(rr.milestoneKey || "").trim();
              var rMid   = String(rr.memberId || "").trim();
              var rShare = Number(rr.share || 0);
              if (!rMsKey || !rMid) continue;

              var lookupKey = rMsKey + "_" + rMid;
              var existRow = existingMap[lookupKey];

              if (existRow) {
                if (rColShare >= 0)   respSheet.getRange(existRow, rColShare + 1).setValue(rShare);
                if (rColSource >= 0)  respSheet.getRange(existRow, rColSource + 1).setValue("pm_manual");
                if (rColUpdated >= 0) respSheet.getRange(existRow, rColUpdated + 1).setValue(nowStr);
              } else {
                var nRow = [];
                for (var nci = 0; nci < respHeaders.length; nci++) nRow.push("");
                if (rColProjId >= 0)  nRow[rColProjId]  = projectId;
                if (rColPcId >= 0)    nRow[rColPcId]     = planCycleId;
                if (rColMsKey >= 0)   nRow[rColMsKey]    = rMsKey;
                if (rColYm >= 0)      nRow[rColYm]       = "";
                if (rColMemId >= 0)   nRow[rColMemId]    = rMid;
                if (rColShare >= 0)   nRow[rColShare]    = rShare;
                if (rColSource >= 0)  nRow[rColSource]   = "pm_manual";
                if (rColUpdated >= 0) nRow[rColUpdated]  = nowStr;
                respAppend.push(nRow);
              }
            }

            if (respAppend.length > 0) {
              respSheet.getRange(respSheet.getLastRow() + 1, 1, respAppend.length, respHeaders.length)
                .setValues(respAppend);
            }
          }
        }
      } catch (respErr) {
        Logger.log("R値保存エラー: " + respErr);
      }
    }

    return JSON.parse(JSON.stringify({ ok: true, updatedCount: updatedCount, newTotalPoints: newTotal }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/**
 * 月次仮配賦を算出（方式B: 各MSをperiodStart〜targetYmで均等割り）
 * @param {{ projectId: string, ym: string }}
 * @return {{ ok, monthlyPt, monthlyYen, ptUnit, milestones[], members[] }}
 */
function cockpit_api_getMonthBudgetEstimate(params) {
  var projectId = String((params || {}).projectId || "").trim();
  var ym = String((params || {}).ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  var navSs;
  try {
    navSs = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
  } catch (e) {
    return { ok: false, message: "Navigator DB接続失敗" };
  }

  // planCycle
  var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
  var plan = null;
  for (var i = 0; i < pcRows.length; i++) {
    if (String(pcRows[i].projectId || "") === projectId && String(pcRows[i].status || "") === "fixed") {
      plan = pcRows[i]; break;
    }
  }
  if (!plan) return { ok: true, noPlan: true };

  var startYm = String(plan.periodStartYm || "");
  var endYm = String(plan.periodEndYm || "");
  var totalPt = Number(plan.totalPoints || 0);
  var budgetYen = Number(plan.budgetYen || 0);
  // ptUnit: DB_Projects.feeAmount × cycleMonths × 0.65 / totalPt
  var feeAmount = 0;
  try {
    var pjRows = b_readTable_("DB_Projects");
    for (var fi = 0; fi < pjRows.length; fi++) {
      if (String(pjRows[fi].projectId || "").trim() === projectId) {
        feeAmount = Number(pjRows[fi].feeAmount || 0);
        break;
      }
    }
  } catch (e) {}
  var cycleMonths = cockpit_calcMonths_(startYm, endYm);
  var cycleBudget = feeAmount * cycleMonths;
  var ptUnit = totalPt > 0 ? Math.round(cycleBudget * 0.65 / totalPt) : 0;

  // 対象ymが期間外なら空
  if (ym < startYm || ym > endYm) {
    return JSON.parse(JSON.stringify({ ok: true, outOfRange: true, startYm: startYm, endYm: endYm }));
  }

  // MS一覧
  var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
  var planCycleId = String(plan.planCycleId || "");
  var milestones = [];
  for (var i = 0; i < msRows.length; i++) {
    var r = msRows[i];
    if (String(r.planCycleId || "") !== planCycleId) continue;
    if (r.isActive === false || r.isActive === "false" || r.isActive === "FALSE") continue;
    if (String(r.goalLevel || "annual") !== "annual") continue;
    milestones.push({
      milestoneId: String(r.milestoneId || ""),
      title: String(r.title || ""),
      points: Number(r.points || 0),
      tag: String(r.tag || "normal"),
      targetYm: String(r.targetYm || endYm),
      orderNo: Number(r.orderNo || 0)
    });
  }
  milestones.sort(function(a, b) { return a.orderNo - b.orderNo; });

  // Responsibility読み込み
  var respRows = cpReadSheetAsTable_(navSs, "DB_MilestoneResponsibility");
  var respMap = {}; // milestoneKey -> [{memberId, share}]
  for (var i = 0; i < respRows.length; i++) {
    var rr = respRows[i];
    if (String(rr.projectId || "") !== projectId) continue;
    if (String(rr.planCycleId || "") !== planCycleId) continue;
    var mk = String(rr.milestoneKey || "");
    if (!respMap[mk]) respMap[mk] = [];
    respMap[mk].push({ memberId: String(rr.memberId || ""), share: Number(rr.share || 0) });
  }

  // メンバーマスタ
  var memberRows;
  try { memberRows = b_readTable_("DB_Members"); } catch (e) { memberRows = []; }
  var memberNameMap = {};
  for (var i = 0; i < memberRows.length; i++) {
    memberNameMap[String(memberRows[i].memberId || "")] = String(memberRows[i].codeName || memberRows[i].name || "");
  }

  // 方式B: 各MSをstartYm〜targetYmで均等割り
  var monthlyPt = 0;
  var msBreakdown = [];
  var memberAccum = {}; // memberId -> { pt, yen }

  for (var i = 0; i < milestones.length; i++) {
    var ms = milestones[i];
    var msTargetYm = ms.targetYm || endYm;
    // 期間: startYm 〜 msTargetYm
    var msMonths = cockpit_calcMonths_(startYm, msTargetYm);
    if (msMonths < 1) msMonths = 1;

    // ymがこのMSの範囲内か
    // 期待累計消化%
    var elapsed = cockpit_calcMonths_(startYm, ym);
    var expectedCumPct;
    if (ym > msTargetYm) {
      expectedCumPct = 100;
    } else {
      expectedCumPct = Math.min(100, Math.round(elapsed / msMonths * 100));
    }

    if (ym > msTargetYm) {
      msBreakdown.push({ milestoneId: ms.milestoneId, title: ms.title, tag: ms.tag, orderNo: ms.orderNo, pt: 0, yen: 0, note: "完了済", expectedCumPct: expectedCumPct });
      continue;
    }

    var ptPerMonth = Math.round(ms.points / msMonths * 100) / 100;
    var yenPerMonth = Math.round(ptPerMonth * ptUnit);
    monthlyPt += ptPerMonth;

    msBreakdown.push({
      milestoneId: ms.milestoneId,
      title: ms.title,
      tag: ms.tag,
      orderNo: ms.orderNo,
      pt: ptPerMonth,
      yen: yenPerMonth,
      msMonths: msMonths,
      totalPt: ms.points,
      expectedCumPct: expectedCumPct
    });

    // メンバー配分
    var resps = respMap[ms.milestoneId] || [];
    for (var r = 0; r < resps.length; r++) {
      var mid = resps[r].memberId;
      var share = resps[r].share;
      var mPt = Math.round(ptPerMonth * share * 100) / 100;
      var mYen = Math.round(yenPerMonth * share);
      if (!memberAccum[mid]) memberAccum[mid] = { pt: 0, yen: 0, breakdown: [] };
      memberAccum[mid].pt += mPt;
      memberAccum[mid].yen += mYen;
      memberAccum[mid].breakdown.push({
        msKey: ms.milestoneId,
        title: ms.title,
        msMonthlyPt: ptPerMonth,
        share: share,
        earnedPt: mPt,
        earnedYen: mYen
      });
    }
  }

  monthlyPt = Math.round(monthlyPt * 100) / 100;
  var monthlyYen = Math.round(monthlyPt * ptUnit);

  var members = [];
  var mids = Object.keys(memberAccum);
  for (var i = 0; i < mids.length; i++) {
    var mid = mids[i];
    members.push({
      memberId: mid,
      codeName: memberNameMap[mid] || mid,
      pt: Math.round(memberAccum[mid].pt * 100) / 100,
      yen: Math.round(memberAccum[mid].yen),
      breakdown: memberAccum[mid].breakdown || []
    });
  }
  members.sort(function(a, b) { return b.pt - a.pt; });

  return JSON.parse(JSON.stringify({
    ok: true,
    ym: ym,
    startYm: startYm,
    endYm: endYm,
    totalPt: totalPt,
    budgetYen: budgetYen,
    ptUnit: ptUnit,
    monthlyPt: monthlyPt,
    monthlyYen: monthlyYen,
    milestones: msBreakdown,
    members: members
  }));
}

/** ym間の月数を算出（inclusive） */
function cockpit_calcMonths_(startYm, endYm) {
  if (!startYm || !endYm || startYm.length < 6 || endYm.length < 6) return 1;
  var sy = parseInt(startYm.substring(0, 4), 10);
  var sm = parseInt(startYm.substring(4, 6), 10);
  var ey = parseInt(endYm.substring(0, 4), 10);
  var em = parseInt(endYm.substring(4, 6), 10);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

/**
 * successCriteria の1行を更新（チェック切替/承認/却下）
 * @param {Object} payload { milestoneId, lineIndex, action }
 *   action: "check"([ ]→[x]) / "uncheck"([x]→[ ]) / "approve"([?]→[ ]) / "confirm"([?x]→[x]) / "delete"(行削除)
 */
function cockpit_api_updateCriteriaLine(payload) {
  payload = payload || {};
  var milestoneId = String(payload.milestoneId || "").trim();
  var lineIndex = Number(payload.lineIndex);
  var action = String(payload.action || "").trim();

  if (!milestoneId) return { ok:false, message:"milestoneId required" };
  if (isNaN(lineIndex) || lineIndex < 0) return { ok:false, message:"invalid lineIndex" };

  var navSs = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
  );
  var sh = navSs.getSheetByName("DB_ValueMilestones");
  if (!sh) return { ok:false, message:"sheet not found" };

  var data = sh.getDataRange().getValues();
  var hdr = data[0] || [];
  var idx = {};
  for (var c = 0; c < hdr.length; c++) idx[hdr[c]] = c;

  if (idx.milestoneId === undefined || idx.successCriteria === undefined) {
    return { ok:false, message:"required columns missing" };
  }

  var targetRow = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.milestoneId] || "").trim() === milestoneId) {
      targetRow = r; break;
    }
  }
  if (targetRow < 0) return { ok:false, message:"milestone not found" };

  var raw = String(data[targetRow][idx.successCriteria] || "");
  var lines = raw.split("\n");

  if (lineIndex >= lines.length) return { ok:false, message:"lineIndex out of range" };

  var actionYm = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMM");
  switch (action) {
    case "check":
      lines[lineIndex] = lines[lineIndex].replace(/^\[\s*\]/, "[x:" + actionYm + "]");
      break;
    case "uncheck":
      lines[lineIndex] = lines[lineIndex].replace(/^\[x(?::\d{6})?\]/i, "[ ]");
      break;
    case "approve":
      lines[lineIndex] = lines[lineIndex].replace(/^\[\?\]/, "[ ]");
      break;
    case "confirm":
      lines[lineIndex] = lines[lineIndex].replace(/^\[\?x\]/i, "[x:" + actionYm + "]");
      break;
    case "delete":
      lines.splice(lineIndex, 1);
      break;
    default:
      return { ok:false, message:"unknown action" };
  }

  var newCriteria = lines.join("\n");
  sh.getRange(targetRow + 1, idx.successCriteria + 1).setValue(newCriteria);

  if (idx.updatedAt !== undefined) {
    var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";
    sh.getRange(targetRow + 1, idx.updatedAt + 1).setValue(now);
  }

  // === successCriteria完了率 → 当月のDB_MilestoneMonthlyProgressに反映 ===
  try {
    var criteriaLines = newCriteria.split("\n");
    var total = 0;
    var done = 0;
    for (var cl = 0; cl < criteriaLines.length; cl++) {
      var cLine = criteriaLines[cl].trim();
      if (!cLine) continue;
      total++;
      if (/^\[x(?::\d{6})?\]/i.test(cLine)) done++;
    }
    if (total > 0) {
      var nowJst = new Date();
      var currentYm = Utilities.formatDate(nowJst, "Asia/Tokyo", "yyyyMM");
      var newPct = Math.round(done / total * 100);
      var nowStr = Utilities.formatDate(nowJst, "Asia/Tokyo", "yyyy年M月d日 HH:mm");

      // maxPt取得（consumedPt算出用）
      var maxPt = 0;
      if (idx.points !== undefined) {
        maxPt = Number(data[targetRow][idx.points] || 0);
      }
      var newConsumedPt = Math.round(maxPt * newPct / 100 * 100) / 100;

      var progSh = navSs.getSheetByName("DB_MilestoneMonthlyProgress");
      if (progSh) {
        var progData = progSh.getDataRange().getValues();
        var progHdr = progData[0] || [];
        var pi = {};
        for (var pc = 0; pc < progHdr.length; pc++) pi[progHdr[pc]] = pc;

        var progRow = -1;
        for (var pr = 1; pr < progData.length; pr++) {
          var pMsKey = String(progData[pr][pi.milestoneKey] || "").trim();
          var pYm = String(progData[pr][pi.ym] || "").trim();
          if (pMsKey === milestoneId && pYm === currentYm) {
            progRow = pr; break;
          }
        }

        if (progRow >= 0) {
          if (pi.progressPct !== undefined) progSh.getRange(progRow + 1, pi.progressPct + 1).setValue(newPct);
          if (pi.consumedPt !== undefined) progSh.getRange(progRow + 1, pi.consumedPt + 1).setValue(newConsumedPt);
          if (pi.source !== undefined) progSh.getRange(progRow + 1, pi.source + 1).setValue("criteria_toggle");
          if (pi.updatedAtJst !== undefined) progSh.getRange(progRow + 1, pi.updatedAtJst + 1).setValue(nowStr);
        } else {
          var newProgRow = [];
          for (var npc = 0; npc < progHdr.length; npc++) newProgRow.push("");
          if (pi.milestoneKey !== undefined) newProgRow[pi.milestoneKey] = milestoneId;
          if (pi.ym !== undefined) newProgRow[pi.ym] = currentYm;
          if (pi.progressPct !== undefined) newProgRow[pi.progressPct] = newPct;
          if (pi.consumedPt !== undefined) newProgRow[pi.consumedPt] = newConsumedPt;
          if (pi.source !== undefined) newProgRow[pi.source] = "criteria_toggle";
          if (pi.updatedAtJst !== undefined) newProgRow[pi.updatedAtJst] = nowStr;
          if (pi.projectId !== undefined && idx.projectId !== undefined) {
            newProgRow[pi.projectId] = String(data[targetRow][idx.projectId] || "");
          }
          if (pi.planCycleId !== undefined && idx.planCycleId !== undefined) {
            newProgRow[pi.planCycleId] = String(data[targetRow][idx.planCycleId] || "");
          }
          progSh.appendRow(newProgRow);
        }
      }
    }
  } catch (progErr) {
    Logger.log("criteria進捗反映エラー: " + progErr);
  }

  return JSON.parse(JSON.stringify({ ok:true, newCriteria:newCriteria }));
}

/**
 * 推定フィードバックをDB_EstimateFeedbackに保存（学習用）
 * つくよみの推定精度改善のための正本
 */
function cockpit_appendEstimateFeedback_(data) {
  try {
    var navSs = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var sheetName = "DB_EstimateFeedback";
    var sh = navSs.getSheetByName(sheetName);
    if (!sh) {
      sh = navSs.insertSheet(sheetName);
      sh.getRange(1, 1, 1, 10).setValues([[
        "projectId", "ym", "milestoneKey", "action",
        "aiPct", "pmPct", "aiReason", "pmFeedback", "confirmedBy", "confirmedAtJst"
      ]]);
    }
    sh.appendRow([
      data.projectId || "",
      data.ym || "",
      data.milestoneKey || "",
      data.action || "",
      data.aiPct || 0,
      data.pmPct || 0,
      data.aiReason || "",
      data.pmFeedback || "",
      data.confirmedBy || "",
      data.confirmedAtJst || ""
    ]);
  } catch (e) {
    Logger.log("EstimateFeedback保存エラー: " + e);
  }
}

/** 全期間の進捗イベント（Origin付き）をym降順で返す — 先手力モーダル用 */
function cockpit_api_getOriginEventList(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId missing" };
  try {
    var evRows = b_readTable_("DB_ProgressEvents");
    var events = [];
    var oTotal = 0, oAmd = 0, oCo = 0, oClient = 0, oExternal = 0, oUnknown = 0;
    for (var i = 0; i < evRows.length; i++) {
      var r = evRows[i];
      if (String(r.projectId || "").trim() !== projectId) continue;
      var origin = String(r.initiativeOrigin || "unknown").trim();
      var status = String(r.status || "").trim();
      events.push({
        eventId: r.eventId || "",
        ym: String(r.ym || ""),
        eventTitle: r.eventTitle || r.eventDescription || "",
        eventDescription: r.eventDescription || "",
        initiativeOrigin: origin,
        originLostReason: r.originLostReason || "",
        status: status,
        rejectReason: r.rejectReason || ""
      });
      if (status !== "rejected") {
        oTotal++;
        if (origin === "amd_proposed") oAmd++;
        else if (origin === "co_decided") oCo++;
        else if (origin === "client_requested" || origin === "partner_proposed") oClient++;
        else if (origin === "external") oExternal++;
        else oUnknown++;
      }
    }
    events.sort(function(a, b) { return a.ym > b.ym ? -1 : a.ym < b.ym ? 1 : 0; });
    var judgeable = oTotal - oExternal;
    var originRate = oTotal >= 1 ? {
      total: oTotal, amdProposed: oAmd, coDecided: oCo, clientRequested: oClient, external: oExternal, unknown: oUnknown,
      judgeable: judgeable,
      amdPct: judgeable >= 1 ? Math.round((oAmd + oCo) / judgeable * 100) : 0
    } : null;
    return JSON.parse(JSON.stringify({ ok: true, events: events, originRate: originRate }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/**
 * 月次ルーティンフロー図用データ取得
 * 「業務月」単位で前月・当月・翌月の3ヶ月分を返す
 *
 * 業務月Mのルーティン:
 *   ❶❷ → M-1月の25日（前月中）
 *   ❸〜⑨ → M+1月（翌月）
 *
 * @param {Object} payload { projectId }
 * @return {Object} { ok, flows[], today }
 */
function cockpit_api_getRoutineFlow(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };

  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var yy = jst.getFullYear();
  var mm = jst.getMonth() + 1;
  var dd = jst.getDate();
  var todayStr = yy + "-" + ("0" + mm).slice(-2) + "-" + ("0" + dd).slice(-2);
  var todayMs = new Date(yy, mm - 1, dd).getTime();

  var calYm = yy * 100 + mm;
  var bizMain = _rf_addMonth_(calYm, -1);
  var bizPrev = _rf_addMonth_(bizMain, -1);
  var bizNext = _rf_addMonth_(bizMain, 1);
  var bizNext2 = _rf_addMonth_(bizMain, 2);
  var bizYms = [bizPrev, bizMain, bizNext, bizNext2];

  var paymentDueRule = "issue_month_eom";
  try {
    var pjRows = b_readTable_("DB_Projects");
    for (var pi = 0; pi < pjRows.length; pi++) {
      if (String(pjRows[pi].projectId || "").trim() === projectId) {
        paymentDueRule = String(pjRows[pi].paymentDueRule || "issue_month_eom").trim();
        break;
      }
    }
  } catch (e) {}

  var cycles = b_readBillingCycleForProject_(projectId);
  var cycleMap = {};
  for (var i = 0; i < cycles.length; i++) {
    var c = cycles[i];
    var cym = b_normYm_(c.ym);
    if (cym) cycleMap[cym] = c;
  }

  var payoutRows = [];
  try { payoutRows = b_readTable_("DB_PayoutPaid"); } catch (e) {}

  var flows = [];
  for (var fi = 0; fi < bizYms.length; fi++) {
    var bizYm = String(bizYms[fi]);
    var cycle = cycleMap[bizYm] || {};
    var role = fi === 0 ? "prev" : fi === 1 ? "main" : "next";
    if (fi === 3) role = "next";

    var payoutDone = _rf_isPayoutComplete_(payoutRows, projectId, bizYm, cycle);
    var deadlines = _rf_calcDeadlines_(bizYm, paymentDueRule, cycle);

    // 翌月ym（報酬・報告タブのモーダルで開く対象）
    var nextYm = String(_rf_addMonth_(Number(bizYm), 1));

    var steps = [
      { id: "budget",       label: "請求額確定",       doneAt: cycle.budgetConfirmedAt || "",       doneBy: cycle.budgetConfirmedBy || "",      deadline: deadlines.budget,      action: "bbmOpen('" + projectId + "','" + bizYm + "')" },
      { id: "taskConfirm",  label: "翌月タスク確認",   doneAt: cycle.taskConfirmedAt || "",         doneBy: cycle.taskConfirmedBy || "",        deadline: deadlines.taskConfirm, action: "cpOpenModalToTab('" + nextYm + "','reward')" },
      { id: "meeting", label: "報告会日程調整", doneAt: _rf_meetingDoneAt_(cycle), doneBy: "", deadline: deadlines.meeting, href: cycle.meetingHtmlLink || "", action: _rf_meetingDoneAt_(cycle) ? (cycle.meetingHtmlLink ? "" : "cpShowMeetingInfo('" + String(cycle.meetingStartAt || "") + "')") : "cpOpenMeetingScheduleModal('" + bizYm + "')" },
      { id: "reportFix",    label: "月次報告書FIX",    doneAt: cycle.monthlyReportFixedAt || "",    doneBy: cycle.monthlyReportFixedBy || "",   deadline: deadlines.reportFix,   action: "cpOpenModalToTab('" + nextYm + "','report')" },
      { id: "invoiceIssue", label: "請求書発行",       doneAt: cycle.invoiceIssuedAt || "",         doneBy: cycle.invoiceIssuedBy || "",        deadline: deadlines.invoiceIssue, action: "cpOpenInvoiceModal('" + bizYm + "')" },
      { id: "invoiceSend",  label: "請求書送付",       doneAt: cycle.invoiceSentAt || "",           doneBy: cycle.invoiceSentBy || "",          deadline: deadlines.invoiceSend,  action: "cpOpenAdminBilling('" + projectId + "','" + bizYm + "')" },
      { id: "payoutNotice", label: "支払通知書確認",   doneAt: cycle.payoutNoticeUploadedAt || "",  doneBy: cycle.payoutNoticeUploadedBy || "", deadline: deadlines.payoutNotice, action: "cpOpenAdminPayouts('" + bizYm + "')" },
      { id: "payment",      label: "入金確認",         doneAt: cycle.paymentConfirmedAt || "",      doneBy: cycle.paymentConfirmedBy || "",     deadline: deadlines.payment,      action: "cpOpenModalToTab('" + nextYm + "','reward')" },
      { id: "payout",       label: "報酬支払い",       doneAt: payoutDone ? "done" : "",            doneBy: "",                                deadline: deadlines.payout,       action: "cpOpenAdminPayouts('" + bizYm + "')" }
    ];

    for (var si = 0; si < steps.length; si++) {
      var s = steps[si];
      s.done = !!s.doneAt;
      s.status = "future";
      if (s.done) {
        s.status = "done";
      } else if (s.deadline) {
        var dlMs = _rf_parseDeadlineMs_(s.deadline);
        if (dlMs) {
          var daysLeft = Math.ceil((dlMs - todayMs) / 86400000);
          if (daysLeft < 0) s.status = "overdue";
          else if (daysLeft <= 3) s.status = "warn";
        }
      }
    }

    flows.push({
      bizYm: bizYm,
      role: role,
      steps: steps,
      hasCycle: !!cycle.cycleId
    });
  }

  return JSON.parse(JSON.stringify({
    ok: true,
    today: todayStr,
    calendarYm: String(calYm),
    flows: flows
  }));
}

/**
 * 月次報告会スケジュール用：空き枠取得
 */
function api_getMeetingSlots(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId/ym required" };

  // 翌月第1週を対象期間にする
  var y = Number(ym.slice(0, 4));
  var m = Number(ym.slice(4, 6));
  var nextM = m + 1;
  var nextY = y;
  if (nextM > 12) { nextM = 1; nextY++; }
  var weekStart = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-01T00:00:00+09:00");
  var weekEnd   = new Date(nextY + "-" + ("0"+nextM).slice(-2) + "-08T00:00:00+09:00");

  // PMのemailをDB_Projects→DB_Membersで引く
  var emails = ["masa@team-armada.jp", "kyoko@team-armada.jp"];
  try {
    var pjRows = b_readTable_("DB_Projects") || [];
    var pmMemberId = "";
    for (var i = 0; i < pjRows.length; i++) {
      if (String(pjRows[i].projectId || "").trim() === projectId) {
        pmMemberId = String(pjRows[i].pmMemberId || "").trim();
        break;
      }
    }
    if (pmMemberId) {
      var memRows = b_readTable_("DB_Members") || [];
      for (var j = 0; j < memRows.length; j++) {
        if (String(memRows[j].memberId || "").trim() === pmMemberId) {
          var pmEmail = String(memRows[j].email || "").trim();
          if (pmEmail && emails.indexOf(pmEmail) < 0) emails.push(pmEmail);
          break;
        }
      }
    }
  } catch(e) {
    Logger.log("api_getMeetingSlots: PM email取得失敗 " + e.message);
  }

  var slots = [];
  try {
    slots = getAvailableMeetingSlotsAnd_(emails, weekStart, weekEnd);
  } catch(e) {
    return { ok: false, message: String(e.message || e) };
  }

  var result = slots.map(function(s) {
    return {
      startISO: s.start.toISOString(),
      endISO:   s.end.toISOString(),
      label:    Utilities.formatDate(s.start, "Asia/Tokyo", "M/d(EEE) HH:mm")
    };
  });

  return JSON.parse(JSON.stringify({ ok: true, slots: result }));
}

/* --- ルーティンフロー内部関数 --- */

function _rf_addMonth_(yyyymm, delta) {
  var y = Math.floor(yyyymm / 100);
  var m = (yyyymm % 100) + delta;
  while (m < 1)  { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return y * 100 + m;
}

function _rf_meetingDoneAt_(cycle) {
  if (!cycle) return "";
  if (cycle.meetingSkipped === true || cycle.meetingSkipped === "TRUE" || cycle.meetingSkipped === "true") {
    return "skipped";
  }
  // meetingStartAtが設定されていれば完了扱い（未来の予定もスケジュール済み＝done）
  if (cycle.meetingStartAt) {
    try {
      var d = new Date(cycle.meetingStartAt);
      if (!isNaN(d.getTime())) return String(cycle.meetingStartAt);
    } catch (e) {}
  }
  if (String(cycle.meetingEventId || "").trim()) return "done";
  return "";
}

function _rf_isPayoutComplete_(payoutRows, projectId, bizYm, cycle) {
  // DB_BillingCycle.rewardPaidAtがあれば完了（Admin Matrix経由）
  if (cycle && String(cycle.rewardPaidAt || "").trim()) return true;
  // DB_PayoutPaidに該当PJ×ymの行があり、全員isPaid=trueなら完了
  var matched = [];
  for (var i = 0; i < payoutRows.length; i++) {
    var r = payoutRows[i];
    if (String(r.projectId || "").trim() !== projectId) continue;
    if (b_normYm_(r.ym) !== bizYm) continue;
    matched.push(r);
  }
  if (matched.length === 0) return false;
  for (var j = 0; j < matched.length; j++) {
    var paid = matched[j].isPaid;
    if (paid !== true && paid !== "TRUE" && paid !== "true") return false;
  }
  return true;
}

function _rf_calcDeadlines_(bizYm, paymentDueRule, cycle) {
  var y = Math.floor(Number(bizYm) / 100);
  var m = Number(bizYm) % 100;

  // M-1月 = 前月
  var prevYm = _rf_addMonth_(Number(bizYm), -1);
  var prevY = Math.floor(prevYm / 100);
  var prevM = prevYm % 100;

  // M+1月 = 翌月
  var nextYm = _rf_addMonth_(Number(bizYm), 1);
  var nextY = Math.floor(nextYm / 100);
  var nextM = nextYm % 100;

  // M+2月
  var next2Ym = _rf_addMonth_(Number(bizYm), 2);
  var next2Y = Math.floor(next2Ym / 100);
  var next2M = next2Ym % 100;

  var d = {};
  d.budget      = prevY + "-" + ("0" + prevM).slice(-2) + "-25";
  d.taskConfirm = prevY + "-" + ("0" + prevM).slice(-2) + "-25";
  d.reportFix   = nextY + "-" + ("0" + nextM).slice(-2) + "-03";
  d.meeting     = y + "-" + ("0" + m).slice(-2) + "-10";
  d.invoiceIssue = nextY + "-" + ("0" + nextM).slice(-2) + "-07";
  d.invoiceSend = nextY + "-" + ("0" + nextM).slice(-2) + "-09";
  d.payoutNotice = nextY + "-" + ("0" + nextM).slice(-2) + "-15";

  // 入金確認：paymentDueRuleによる
  var rule = String(paymentDueRule || "issue_month_eom").trim();
  if (rule === "next_month_eom") {
    d.payment = _rf_endOfMonth_(next2Y, next2M);
  } else if (rule === "issue_month_25th") {
    d.payment = nextY + "-" + ("0" + nextM).slice(-2) + "-25";
  } else {
    // issue_month_eom（デフォルト）
    d.payment = _rf_endOfMonth_(nextY, nextM);
  }

  // 報酬支払い：入金確認が完了してれば入金日+7日（5営業日≒7暦日で概算）、未完了なら入金締切+7日
  var paymentDoneAt = cycle ? (cycle.paymentConfirmedAt || "") : "";
  if (paymentDoneAt) {
    var pDate = _rf_parseDeadlineMs_(String(paymentDoneAt));
    if (pDate) {
      var pd = new Date(pDate + 7 * 86400000);
      d.payout = pd.getFullYear() + "-" + ("0" + (pd.getMonth() + 1)).slice(-2) + "-" + ("0" + pd.getDate()).slice(-2);
    } else {
      d.payout = "";
    }
  } else {
    // 入金締切+7日を仮の締切として表示
    var payMs = _rf_parseDeadlineMs_(d.payment);
    if (payMs) {
      var est = new Date(payMs + 7 * 86400000);
      d.payout = est.getFullYear() + "-" + ("0" + (est.getMonth() + 1)).slice(-2) + "-" + ("0" + est.getDate()).slice(-2);
    } else {
      d.payout = "";
    }
  }

  return d;
}

function _rf_endOfMonth_(y, m) {
  // 翌月の0日 = 当月末日
  var d = new Date(y, m, 0);
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}

function _rf_parseDeadlineMs_(str) {
  if (!str) return null;
  // Date型の場合
  if (str instanceof Date) {
    return isNaN(str.getTime()) ? null : str.getTime();
  }
  var s = String(str);
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  var m2 = s.match(/(\d{4})年(\d+)月(\d+)日/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])).getTime();
  return null;
}

/** 請求書発行モーダル用：プレビューデータ返却 */
/** 請求書発行モーダル用：プレビューデータ返却 */
function cockpit_api_getInvoicePreview(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  var ym = b_normYm_((payload || {}).ym);
  if (!projectId || !ym) return { ok: false, message: "projectId/ym required" };

  var cur = b_getCycleOne_(projectId, ym) || {};

  /* PJマスタからfeeAmount/feeType取得 */
  var feeAmount = 0;
  var feeType = "";
  try {
    var clientName = "";
    var pjRows = b_readTable_("DB_Projects");
    for (var pi = 0; pi < pjRows.length; pi++) {
      if (String(pjRows[pi].projectId || "").trim() === projectId) {
        feeType = String(pjRows[pi].feeType || "").trim().toLowerCase();
        feeAmount = Number(pjRows[pi].feeAmount || 0);
        clientName = String(pjRows[pi].clientName || "").trim();
        break;
      }
    }
  } catch (e) {}

  /* 予算 */
  var budget65 = (cur.budgetTotal !== undefined && String(cur.budgetTotal).trim() !== "")
    ? Number(cur.budgetTotal || 0) : Number(cur.budgetYen || 0);
  var gross = budget65 > 0 ? Math.round(budget65 / 0.65) : 0;

  /* フォールバック：budgetが空でもfeeAmountから算出 */
  if (gross <= 0 && feeAmount > 0) {
    if (feeType === "fixed") {
      gross = feeAmount;
      budget65 = Math.round(feeAmount * 0.65);
    }
  }

  /* ============================================================
   * ★前月cycleからの引き継ぎ（対象月に保存データがないとき）
   * ============================================================ */
  var prevSubject = "";
  var prevBaseLinesJson = "";
  var prevReimbPrefix = "";
  var prevRemark = "";

  var curHasInvoiceData = !!(
    String(cur.invoiceSubject || "").trim() ||
    String(cur.invoiceBaseLinesJson || "").trim() ||
    String(cur.invoiceBaseLineDesc || "").trim()
  );

  if (!curHasInvoiceData) {
    var prevYm = b_addMonths_(ym, -1);
    var prevCycle = b_getCycleOne_(projectId, prevYm) || {};

    if (String(prevCycle.invoiceSubject || "").trim() ||
        String(prevCycle.invoiceBaseLinesJson || "").trim()) {
      prevSubject = cpInvAdvanceMonth_(String(prevCycle.invoiceSubject || ""), prevYm, ym);
      prevBaseLinesJson = String(prevCycle.invoiceBaseLinesJson || "");
      prevReimbPrefix = String(prevCycle.invoiceReimbPrefix || "");
      prevRemark = cpInvAdvanceMonth_(String(prevCycle.invoiceRemark || ""), prevYm, ym);

      // baseLinesのdescriptionも月進め
      if (prevBaseLinesJson) {
        try {
          var prevLines = JSON.parse(prevBaseLinesJson);
          if (Array.isArray(prevLines)) {
            for (var pli = 0; pli < prevLines.length; pli++) {
              if (prevLines[pli].description) {
                prevLines[pli].description = cpInvAdvanceMonth_(String(prevLines[pli].description), prevYm, ym);
              }
            }
            prevBaseLinesJson = JSON.stringify(prevLines);
          }
        } catch (e) {}
      }
    }
  }

  /* 基本行 */
  var baseLines = [];
  try {
    var raw = String(cur.invoiceBaseLinesJson || prevBaseLinesJson || "").trim();
    if (raw) baseLines = JSON.parse(raw);
  } catch (e) {}
  if (!Array.isArray(baseLines) || !baseLines.length) {
    var ymY = ym.substring(0, 4);
    var ymM = String(Number(ym.substring(4, 6)));
    var desc = String(cur.invoiceBaseLineDesc || "").trim() || ymY + "年" + ymM + "月分　◯◯業務委託費";
    baseLines = [{ description: desc, quantity: 1, unit_price: gross }];
  }
  var sumBase = 0;
  for (var i = 0; i < baseLines.length; i++) {
    sumBase += Number(baseLines[i].unit_price || 0) * Number(baseLines[i].quantity || 1);
  }
  if (sumBase <= 0 && gross > 0) baseLines[0].unit_price = gross;

  /* 立替 */
  var reimbItems = [];
  var reimbTotal = 0;
  try {
    var rr = cockpit_api_getReimburseForMonth({ projectId: projectId, ym: ym });
    if (rr && rr.ok && Array.isArray(rr.items)) {
      reimbItems = rr.items;
      for (var j = 0; j < reimbItems.length; j++) reimbTotal += Number(reimbItems[j].amount || 0);
    }
  } catch (e) {}

  /* 調整行 */
  var customLines = [];
  try {
    var cl = String(cur.invoiceCustomLinesJson || "").trim();
    if (cl) customLines = JSON.parse(cl);
  } catch (e) {}

  /* 日付デフォルト */
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 3600000);
  var todayStr = jst.getFullYear() + "-" + ("0" + (jst.getMonth() + 1)).slice(-2) + "-" + ("0" + jst.getDate()).slice(-2);
  var nm = new Date(jst.getFullYear(), jst.getMonth() + 2, 0);
  var dueStr = nm.getFullYear() + "-" + ("0" + (nm.getMonth() + 1)).slice(-2) + "-" + ("0" + nm.getDate()).slice(-2);

  /* freee設定 */
  var hasFreee = false;
  try {
    var s = b_getFreeeProjectSettings_(projectId);
    hasFreee = !!(s && s.partnerId);
  } catch (e) {}

  /* 件名（前月引き継ぎ反映） */
  var invoiceSubject = String(cur.invoiceSubject || prevSubject || "").trim();

  /* 立替接頭辞（前月引き継ぎ反映） */
  var invoiceReimbPrefix = String(cur.invoiceReimbPrefix || prevReimbPrefix || "").trim();

  /* 備考（前月引き継ぎ反映） */
  var invoiceRemark = String(cur.invoiceRemark || prevRemark || "").trim();

  return JSON.parse(JSON.stringify({
    ok: true,
    projectId: projectId,
    ym: ym,
    projectName: String(cur.projectName || "").trim() || projectId,
    clientName: clientName || String(cur.projectName || "").trim() || projectId,
    budget65: budget65,
    gross: gross,
    feeAmount: feeAmount,
    feeType: feeType,
    invoiceSubject: invoiceSubject,
    baseLines: baseLines,
    reimbItems: reimbItems,
    reimbTotal: reimbTotal,
    customLines: customLines,
    invoiceReimbPrefix: invoiceReimbPrefix,
    invoiceRemark: invoiceRemark,
    defaultIssueDate: todayStr,
    defaultDueDate: dueStr,
    hasFreeeSettings: hasFreee,
    alreadyIssued: !!(cur.freeeInvoiceId || cur.freeeInvoiceNumber)
  }));
}

/**
 * 文字列中の月表現をすべて +1ヶ月する
 * 対応パターン: 202603→202604, 2026年3月→2026年4月, 2026/03→2026/04, 3月→4月
 */
function cpInvAdvanceMonth_(text, prevYm, targetYm) {
  if (!text) return "";
  var s = String(text);

  // yyyymm（6桁数字）
  s = s.replace(/(\d{4})(0[1-9]|1[0-2])(?=\D|$)/g, function(m, y, mm) {
    var d = new Date(Number(y), Number(mm) - 1 + 1, 1);
    return String(d.getFullYear()) + ("0" + (d.getMonth() + 1)).slice(-2);
  });

  // yyyy年mm月 / yyyy年m月
  s = s.replace(/(\d{4})年(\d{1,2})月/g, function(m, y, mm) {
    var d = new Date(Number(y), Number(mm) - 1 + 1, 1);
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月";
  });

  // yyyy/mm / yyyy/m
  s = s.replace(/(\d{4})\/(0?[1-9]|1[0-2])(?=\D|$)/g, function(m, y, mm) {
    var d = new Date(Number(y), Number(mm) - 1 + 1, 1);
    return d.getFullYear() + "/" + ("0" + (d.getMonth() + 1)).slice(-2);
  });

  // mm月度 / m月度（年なし・単独月）
  s = s.replace(/(^|[^\d年/])(\d{1,2})(月度?)/g, function(m, pre, mm, suf) {
    var n = Number(mm);
    if (n < 1 || n > 12) return m;
    var next = n >= 12 ? 1 : n + 1;
    return pre + next + suf;
  });

  return s;
}

/** 請求書発行（api_issueInvoiceFreee のコックピット用ラッパー） */
function cockpit_api_issueInvoice(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  var ym = b_normYm_((payload || {}).ym);
  if (!projectId || !ym) return { ok: false, message: "projectId/ym required" };
  try {
    var result = api_issueInvoiceFreee(projectId, ym, payload);
    return result;
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Issues一覧取得 */
function cockpit_api_getIssues(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  try {
    var milestoneId = (payload || {}).milestoneId || null;
    var status = (payload || {}).status || null;
    var items = issuesApi_list({ projectId: projectId, milestoneId: milestoneId, status: status });
    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Issues追加・更新 */
function cockpit_api_upsertIssue(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  try {
    var result = issuesApi_upsert(payload);
    return { ok: true, issue: result };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Issue解決 */
function cockpit_api_resolveIssue(payload) {
  var issueId = String((payload || {}).issueId || "").trim();
  if (!issueId) return { ok: false, message: "issueId required" };
  try {
    issuesApi_resolve(issueId);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Tasks一覧取得 */
function cockpit_api_getTasks(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  try {
    var milestoneId = (payload || {}).milestoneId || null;
    var status = (payload || {}).status || null;
    var items = tasksApi_list({ projectId: projectId, milestoneId: milestoneId, status: status });
    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

function cockpit_api_getSourceCacheById(payload) {
  var cacheId = String((payload || {}).sourceCacheId || '').trim();
  if (!cacheId) return { ok: false, message: 'sourceCacheId required' };
  try {
    var ssId = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
    if (!ssId) return { ok: false, message: 'NAVIGATOR_SPREADSHEET_ID未設定' };
    var sheet = SpreadsheetApp.openById(ssId).getSheetByName('DB_SourceCache');
    if (!sheet || sheet.getLastRow() < 2) return { ok: true, item: null };
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      headers.forEach(function(h, idx) { obj[h] = data[i][idx]; });
      if (String(obj.cacheId) === cacheId) return { ok: true, item: JSON.parse(JSON.stringify(obj)) };
    }
    return { ok: true, item: null };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

function cockpit_api_recordTaskFeedback(payload) {
  var taskId      = String((payload || {}).taskId || '').trim();
  var type        = String((payload || {}).feedbackType || '').trim();
  if (!taskId || !type) return { ok: false, message: 'taskId/feedbackType required' };
  try {
    var ssId = PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID');
    if (!ssId) return { ok: false, message: 'NAVIGATOR_SPREADSHEET_ID未設定' };
    var sheet = SpreadsheetApp.openById(ssId).getSheetByName('DB_TaskFeedback');
    if (!sheet) return { ok: false, message: 'DB_TaskFeedback not found' };
    var headers = ['feedbackId','taskId','projectId','feedbackType','originalTitle','originalDesc','editedTitle','editedDesc','rejectReason','createdAtJst'];
    var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
    var row = headers.map(function(h) {
      if (h === 'feedbackId') return 'fb_' + Utilities.getUuid().replace(/-/g,'').slice(0,12);
      if (h === 'createdAtJst') return now;
      return String((payload || {})[h] || '');
    });
    sheet.appendRow(row);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Tasks追加・更新 */
function cockpit_api_upsertTask(payload) {
  var projectId = String((payload || {}).projectId || "").trim();
  if (!projectId) return { ok: false, message: "projectId required" };
  try {
    var result = tasksApi_upsert(payload);
    return { ok: true, task: result };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** Taskステータス更新 */
function cockpit_api_updateTaskStatus(payload) {
  var taskId = String((payload || {}).taskId || "").trim();
  var status = String((payload || {}).status || "").trim();
  if (!taskId || !status) return { ok: false, message: "taskId/status required" };
  try {
    tasksApi_updateStatus(taskId, status);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e.message || e) };
  }
}

/** MS進捗サマリをDB_BillingCyclesに書き込む（cronから呼ぶ） */
function cockpit_updateRewardSummaryCache_(projectId, ym) {
  try {
    var rv2 = rv2_calcRewardSummary(projectId, ym);
    var sheet = b_ss_().getSheetByName('DB_BillingCycle');
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    var jsonIdx = headers.indexOf('rewardSummaryJson');
    if (jsonIdx < 0) {
      sheet.getRange(1, lastCol + 1).setValue('rewardSummaryJson');
      jsonIdx = lastCol;
      lastCol = lastCol + 1;
    }
    var pidIdx = headers.indexOf('projectId');
    var ymIdx = headers.indexOf('ym');
    if (pidIdx < 0 || ymIdx < 0) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var r = 0; r < data.length; r++) {
      var rowYm2 = String(data[r][ymIdx] instanceof Date ? Utilities.formatDate(data[r][ymIdx], 'Asia/Tokyo', 'yyyyMM') : data[r][ymIdx] || '').trim();
      if (String(data[r][pidIdx]).trim() === projectId && rowYm2 === ym) {
        sheet.getRange(r + 2, jsonIdx + 1).setValue(JSON.stringify(rv2));
        return;
      }
    }
  } catch(e) {
    Logger.log('[cockpit_updateRewardSummaryCache_] ' + projectId + '/' + ym + ': ' + e);
  }
}

function cockpit_propagateProgressForward_(projectId, planCycleId, milestoneKey, fromYm, newPct, maxPt, email) {
  try {
    var navSs = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty("NAVIGATOR_SPREADSHEET_ID")
    );
    var pcRows = cpReadSheetAsTable_(navSs, "DB_ValuePlanCycles");
    var endYm = null;
    for (var i = 0; i < pcRows.length; i++) {
      if (String(pcRows[i].planCycleId || "").trim() === planCycleId) {
        endYm = String(pcRows[i].periodEndYm || "").trim();
        break;
      }
    }
    if (!endYm) return;

    if (!maxPt) {
      var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
      for (var j = 0; j < msRows.length; j++) {
        if (String(msRows[j].milestoneId || "").trim() === milestoneKey) {
          maxPt = Number(msRows[j].points || 0);
          break;
        }
      }
    }

    var TRUSTED = { pm_manual: 1, pm_confirmed: 1, criteria_toggle: 1 };
    var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

    var y = parseInt(fromYm.substring(0, 4), 10);
    var m = parseInt(fromYm.substring(4, 6), 10) + 1;
    if (m > 12) { m = 1; y++; }

    while (true) {
      var nextYm = String(y) + ("0" + m).slice(-2);
      if (nextYm > endYm) break;

      var existing = rv2_readProgressForProjectYm(projectId, nextYm);
      var existingPct = -1;
      for (var k = 0; k < existing.length; k++) {
        if (String(existing[k].milestoneKey || "").trim() !== milestoneKey) continue;
        if (!TRUSTED[String(existing[k].source || "")]) continue;
        var ep = Number(existing[k].progressPct || 0);
        if (ep > existingPct) existingPct = ep;
      }

      if (existingPct < newPct) {
        var consumed = Math.round(maxPt * newPct / 100 * 100) / 100;
        rv2_upsertProgress({
          projectId: projectId,
          planCycleId: planCycleId,
          milestoneKey: milestoneKey,
          ym: nextYm,
          progressPct: newPct,
          consumedPt: consumed,
          source: "pm_manual",
          confirmedBy: email,
          confirmedAtJst: now,
          note: fromYm + "の確定値" + newPct + "%を下限として伝播"
        });
        cockpit_updateRewardSummaryCache_(projectId, nextYm);
        cockpit_updateMsProgressSummary_(projectId, nextYm);
      }

      m++;
      if (m > 12) { m = 1; y++; }
    }
  } catch(e) {
    Logger.log('[cockpit_propagateProgressForward_] ' + e.message);
  }
}

function cockpit_clearRewardSummaryCache_(projectId, ym) {
  // ym=nullの場合はそのPJの全ymをクリア
  var clearAll = !ym;
  try {
    var sheet = b_ss_().getSheetByName('DB_BillingCycle');
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    var jsonIdx = headers.indexOf('rewardSummaryJson');
    if (jsonIdx < 0) return;
    var pidIdx = headers.indexOf('projectId');
    var ymIdx = headers.indexOf('ym');
    if (pidIdx < 0 || ymIdx < 0) return;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var r = 0; r < data.length; r++) {
      var pidMatch = String(data[r][pidIdx]).trim() === projectId;
      var ymMatch = clearAll || String(data[r][ymIdx]).trim() === ym;
      if (pidMatch && ymMatch) {
        sheet.getRange(r + 2, jsonIdx + 1).setValue('');
        if (!clearAll) return;
      }
    }
  } catch(e) {}
}

function cockpit_updateMsProgressSummary_(projectId, ym) {
  try {
    var navSs = valuePlan_getDbSpreadsheet();

    var cycleRows = cpReadSheetAsTable_(navSs, 'DB_ValuePlanCycles');
    var planCycleId = null;
    var periodStartYm = null;
    var periodEndYm = null;
    for (var ci = 0; ci < cycleRows.length; ci++) {
      var cy = cycleRows[ci];
      var cyPid = String(cy.projectId || '').trim();
      if (cyPid !== projectId) continue;
      var startYm = String(cy.periodStartYm || '').trim();
      var endYm = String(cy.periodEndYm || '').trim();
      if (startYm <= ym && ym <= endYm) {
        planCycleId = String(cy.planCycleId || '').trim();
        periodStartYm = startYm;
        periodEndYm = endYm;
        break;
      }
    }
    if (!planCycleId) return;

    var progRows = rv2_readProgressForProjectYm(projectId, ym);
    var progMap = {};
    for (var i = 0; i < progRows.length; i++) {
      var pr = progRows[i];
      progMap[String(pr.milestoneKey || '')] = Number(pr.progressPct || 0);
    }

    var msRows = cpReadSheetAsTable_(navSs, 'DB_ValueMilestones');
    Logger.log('[debug] planCycleId=' + planCycleId + ' msRows.length=' + msRows.length);
    var matchCount = 0; var activeCount = 0;
    for (var d = 0; d < msRows.length; d++) {
      if (String(msRows[d].planCycleId || '').trim() === planCycleId) {
        matchCount++;
        if (msRows[d].isActive === true || String(msRows[d].isActive).toUpperCase() === 'TRUE') activeCount++;
      }
    }
    Logger.log('[debug] planCycleId match=' + matchCount + ' isActive=true count=' + activeCount);
    var summary = [];
    for (var j = 0; j < msRows.length; j++) {
      var ms = msRows[j];
      if (String(ms.planCycleId || '').trim() !== planCycleId) continue;
      if (String(ms.isActive).toUpperCase() !== 'TRUE') continue;
      var msId = String(ms.milestoneId || '').trim();
      if (!msId) continue;
      summary.push({
        title: String(ms.title || ''),
        tag: String(ms.tag || 'normal'),
        points: Number(ms.points || 0),
        progressPct: progMap[msId] || 0
      });
    }

    var sheet = b_ss_().getSheetByName('DB_BillingCycle');
    if (!sheet) return;

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    var jsonIdx = headers.indexOf('msProgressSummaryJson');
    if (jsonIdx < 0) {
      sheet.getRange(1, lastCol + 1).setValue('msProgressSummaryJson');
      jsonIdx = lastCol;
    }

    var pidIdx = headers.indexOf('projectId');
    var ymIdx = headers.indexOf('ym');
    if (pidIdx < 0 || ymIdx < 0) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    Logger.log('[debug] summary.length=' + summary.length);
    for (var r = 0; r < data.length; r++) {
      if (r < 3) Logger.log('[debug] row' + r + ' pid=' + data[r][pidIdx] + ' ym=' + data[r][ymIdx] + ' ymType=' + typeof data[r][ymIdx]);
      var rowYm = String(data[r][ymIdx] instanceof Date ? Utilities.formatDate(data[r][ymIdx], 'Asia/Tokyo', 'yyyyMM') : data[r][ymIdx] || '').trim();
      if (String(data[r][pidIdx]).trim() === projectId && rowYm === ym) {
        var payload = {
          periodStartYm: periodStartYm,
          periodEndYm: periodEndYm,
          items: summary
        };
        sheet.getRange(r + 2, jsonIdx + 1).setValue(JSON.stringify(payload));
        return;
      }
    }
  } catch(e) {
    Logger.log('[cockpit_updateMsProgressSummary_] ' + projectId + '/' + ym + ': ' + e);
  }
}

function cpClearRewardSummaryCache_(projectId, ym) {
  try {
    var sheet = b_ss_().getSheetByName('DB_BillingCycle');
    if (!sheet) return;
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
    var jsonIdx = headers.indexOf('rewardSummaryJson');
    var pidIdx = headers.indexOf('projectId');
    var ymIdx = headers.indexOf('ym');
    if (jsonIdx < 0 || pidIdx < 0 || ymIdx < 0 || sheet.getLastRow() < 2) return;
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][pidIdx]).trim() === projectId && String(data[i][ymIdx]).trim() === ym) {
        sheet.getRange(i + 2, jsonIdx + 1).setValue('');
        break;
      }
    }
  } catch(e) {}
}

function cockpit_api_refreshMonthCache(payload) {
  var projectId = String((payload || {}).projectId || '').trim();
  var ym = String((payload || {}).ym || '').trim();
  if (!projectId || !ym) return { ok: false, message: 'projectId/ym required' };
  try {
    cockpit_updateRewardSummaryCache_(projectId, ym);
    cockpit_updateMsProgressSummary_(projectId, ym);
    return { ok: true };
  } catch(e) {
    return { ok: false, message: String(e) };
  }
}