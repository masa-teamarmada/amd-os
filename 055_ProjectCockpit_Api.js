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

  var months = Number(payload.months || 6);
  if (months < 1) months = 6;
  if (months > 24) months = 24;

  // 1) PJ基本情報
  var project = cockpit_getProject_(projectId);
  if (!project) return { ok: false, message: "PJが見つからない: " + projectId };

  // 2) 対象年月リスト（今月から過去N月）
  var now = new Date();
  var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  var currentYm = String(jst.getFullYear()) + ("0" + (jst.getMonth() + 1)).slice(-2);
  var ymList = cockpit_buildYmList_(currentYm, months);

  // 3) BillingCycle一括取得
  var billingMap = cockpit_getBillingMap_(projectId, ymList);

  // 4) MonthlyReports一括取得（冒頭抜粋のみ）
  var reportMap = cockpit_getReportExcerptMap_(projectId, ymList);

  // 5) サマリ組み立て
  var summaries = ymList.map(function(ym) {
    var b = billingMap[ym] || {};
    var excerpt = reportMap[ym] || "";

    return {
      ym: ym,
      meetingDone: !!(b.meetingStartAt || b.meetingEventId),
      budgetDone: !!b.budgetConfirmedAt,
      allocDone: !!b.allocationConfirmedAt,
      reportDone: !!(b.monthlyReportFileId || b.monthlyReportUrl),
      invoiceDone: !!b.invoiceSentAt,
      paymentDone: !!b.paymentConfirmedAt,
      billingAmount: Number(b.fixedTotalYen || b.budgetYen || b.budgetTotal || 0),
      reportExcerpt: excerpt
    };
  });

  return {
    ok: true,
    project: project,
    currentYm: currentYm,
    monthlySummaries: summaries
  };
}

/**
 * モーダル用：指定月の詳細データを取得
 * @param {Object} payload { projectId, ym }
 * @return {Object} { ok, report, billing, rewardEvents[], rewardPayouts[] }
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

  return {
    ok: true,
    report: report,
    billing: billing,
    rewardEvents: events,
    rewardPayouts: payouts
  };
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
 * 目標階層データを取得（年次/Q/月次マイルストーン）
 * @param {Object} payload { projectId: string }
 * @return {Object} { ok, planCycle, milestones: { annual[], quarterly:{}, monthly:{} } }
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
    return { ok: true, planCycle: null, milestones: { annual: [], quarterly: {}, monthly: {} } };
  }

  // 1) DB_ValuePlanCycles から projectId の最新を取る
  var planCycle = cockpit_getLatestPlanCycle_(ss, projectId);
  if (!planCycle) {
    return { ok: true, planCycle: null, milestones: { annual: [], quarterly: {}, monthly: {} } };
  }

  // 2) DB_ValueMilestones から planCycleId + isActive=true を取得
  var allMs = cockpit_getActiveMilestones_(ss, planCycle.planCycleId);

  // 3) goalLevel でグループ分け
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

  return {
    ok: true,
    planCycle: planCycle,
    milestones: result
  };
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
 * 報酬ダッシュボード（モーダル報酬タブ用）
 * マイルストーン消化状況 + イベント詳細 + メンバー配分を一括返却
 */
function cockpit_api_getRewardDashboard(params) {
  var projectId = String(params.projectId || "");
  var ym        = String(params.ym || "");
  if (!projectId || !ym) return { ok: false, message: "projectId/ym必須" };

  // --- メンバーマスタ（コードネーム解決用） ---
  var memberRows = b_readTable_("DB_Members");
  var memberMap = {};
  for (var mi = 0; mi < memberRows.length; mi++) {
    var mm = memberRows[mi];
    memberMap[String(mm.memberId || "")] = String(mm.codeName || mm.name || mm.memberId || "");
  }
  function resolveCodeName(mid) {
    return memberMap[String(mid || "")] || String(mid || "");
  }

  // --- planCycle ---
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
  if (!plan) return { ok: true, noPlan: true, message: "ValuePlanCycles(fixed)なし" };

  var planCycleId = String(plan.planCycleId || "");
  var totalPoints = Number(plan.totalPoints || 0);
  var budgetYen   = Number(plan.budgetYen || 0);
  var startYm     = String(plan.periodStartYm || "");
  var endYm       = String(plan.periodEndYm || "");
  var cycleMonths = reward_ops_calcMonths_(startYm, endYm);
  var ptUnit      = totalPoints > 0 ? Math.round(budgetYen * 0.5 / totalPoints) : 0;

  // --- milestones ---
  var msRows = cpReadSheetAsTable_(navSs, "DB_ValueMilestones");
  var annualMs = [];
  var msKeySet = {};  // milestoneKeyのセット（contribフィルタ用）
  for (var m = 0; m < msRows.length; m++) {
    var msRow = msRows[m];
    if (String(msRow.planCycleId || "") !== planCycleId) continue;
    var gl = String(msRow.goalLevel || "annual");
    if (gl !== "annual") continue;
    annualMs.push(msRow);
    msKeySet[String(msRow.milestoneKey || msRow.milestoneId || "")] = true;
  }

  // --- contributions（milestoneKeyの所属で判定） ---
  var vcRows = cpReadSheetAsTable_(navSs, "DB_ValueContributions");
  var contribByMs = {};
  var contribByEvent = {};
  for (var c = 0; c < vcRows.length; c++) {
    var vc = vcRows[c];
    var msKey = String(vc.milestoneKey || "");
    if (!msKeySet[msKey]) continue;  // このplanCycleに属さないMSはスキップ

    var evId  = String(vc.eventId || "");
    var cPt   = Number(vc.contribPoints || 0);
    var cYm   = String(vc.ym || "");

    if (!contribByMs[msKey]) contribByMs[msKey] = { total: 0, thisMonth: 0 };
    contribByMs[msKey].total += cPt;
    if (cYm === ym) contribByMs[msKey].thisMonth += cPt;

    if (cYm === ym) {
      if (!contribByEvent[evId]) contribByEvent[evId] = [];
      contribByEvent[evId].push({
        milestoneKey: msKey,
        milestoneDesc: String(vc.milestoneDescription || ""),
        contribPt: cPt
      });
    }
  }

  // --- マイルストーン集計 ---
  var milestones = [];
  var cumulativeConsumed = 0;
  var monthConsumed = 0;
  for (var a = 0; a < annualMs.length; a++) {
    var ms = annualMs[a];
    var key = String(ms.milestoneKey || ms.milestoneId || "");
    var maxPt = Number(ms.points || 0);
    var consumed = (contribByMs[key] || {}).total || 0;
    var thisM = (contribByMs[key] || {}).thisMonth || 0;
    cumulativeConsumed += consumed;
    monthConsumed += thisM;
    milestones.push({
      key: key,
      orderNo: Number(ms.orderNo || a + 1),
      title: String(ms.title || ""),
      tag: String(ms.tag || "normal"),
      maxPt: maxPt,
      consumedPt: Math.round(consumed * 100) / 100,
      thisMonthPt: Math.round(thisM * 100) / 100,
      remainPt: Math.round(Math.max(0, maxPt - consumed) * 100) / 100,
      pctUsed: maxPt > 0 ? Math.round(consumed / maxPt * 100) : 0
    });
  }

  // --- events (当月) ---
  var evRows; try { evRows = b_readTable_("DB_ProgressEvents"); } catch(e) { evRows = []; }
  var respRows; try { respRows = b_readTable_("DB_EventResponsibility"); } catch(e) { respRows = []; }

  var respByEv = {};
  for (var r = 0; r < respRows.length; r++) {
    var rr = respRows[r];
    if (String(rr.projectId || "") !== projectId || String(rr.ym || "") !== ym) continue;
    var eId = String(rr.eventId || "");
    if (!respByEv[eId]) respByEv[eId] = [];
    respByEv[eId].push({
      memberId: String(rr.memberId || ""),
      memberName: resolveCodeName(rr.memberId),
      responsibility: Number(rr.responsibility || 0)
    });
  }

  var events = [];
  for (var e = 0; e < evRows.length; e++) {
    var ev = evRows[e];
    if (String(ev.projectId || "") !== projectId || String(ev.ym || "") !== ym) continue;
    var evId = String(ev.eventId || "");
    var impact = Number(ev.impact || 0);
    var depth  = Number(ev.depth || 0);
    events.push({
      eventId: evId,
      eventTitle: String(ev.eventTitle || ""),
      eventDescription: String(ev.eventDescription || ""),
      impact: impact,
      depth: depth,
      eventValue: Math.round(impact * depth * 100) / 100,
      status: String(ev.status || "draft"),
      rejectReason: String(ev.rejectReason || ""),
      responsibilities: respByEv[evId] || [],
      contributions: contribByEvent[evId] || []
    });
  }

  // --- payout (当月) ---
  var poRows; try { poRows = b_readTable_("DB_MonthlyRewardPayout"); } catch(e) { poRows = []; }
  var members = [];
  for (var p = 0; p < poRows.length; p++) {
    var po = poRows[p];
    if (String(po.projectId || "") !== projectId || String(po.ym || "") !== ym) continue;
    members.push({
      memberId: String(po.memberId || ""),
      memberName: resolveCodeName(po.memberId),
      earnedPoints: Number(po.earnedPoints || 0),
      ptUnit: Number(po.ptUnit || 0),
      basePay: Number(po.basePay || 0),
      appreciationRaw: Number(po.appreciationRaw || 0),
      appreciationBonus: Number(po.appreciationBonus || 0),
      totalPayout: Number(po.totalPayout || 0),
      status: String(po.status || "draft")
    });
  }

  return {
    ok: true,
    plan: {
      totalPoints: totalPoints,
      budgetYen: budgetYen,
      startYm: startYm,
      endYm: endYm,
      cycleMonths: cycleMonths,
      ptUnit: ptUnit
    },
    milestones: milestones,
    monthSummary: {
      ym: ym,
      monthConsumedPt: Math.round(monthConsumed * 100) / 100,
      cumulativeConsumedPt: Math.round(cumulativeConsumed * 100) / 100,
      progressPct: totalPoints > 0 ? Math.round(cumulativeConsumed / totalPoints * 100) : 0,
      members: members
    },
    events: events
  };
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