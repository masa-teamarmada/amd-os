/**
 * 059_RewardV2_Ops.gs
 * 報酬v2のドメインロジック
 *
 * 計算式：
 *   月次消化pt = Σ（MSのmaxPt × progressPct / 100）
 *   個人進捗pt = Σ（MS消化pt × share）
 *   ベース報酬 = 個人進捗pt × ptUnit
 *
 * 依存：
 *   - 058_RewardV2_Repo.gs
 *   - 086_ValuePlanRepo.gs（DB_ValuePlanCycles, DB_ValueMilestones）
 *   - B_Sheets.gs（b_readTable_ for DB_Members）
 */

// ===== JST日時ヘルパー =====
function rv2_nowJst_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ss") + "+09:00";
}

function rv2_prevYm_(ym) {
  var s = String(ym || "").trim();
  var y = parseInt(s.substring(0, 4), 10);
  var m = parseInt(s.substring(4, 6), 10);
  if (!y || !m) return "";
  var pm = m === 1 ? 12 : m - 1;
  var py = m === 1 ? y - 1 : y;
  return String(py) + ("0" + pm).slice(-2);
}

function rv2_monthDiffInclusive_(startYm, endYm) {
  var s = String(startYm || "").trim();
  var e = String(endYm || "").trim();
  if (!s || !e) return 1;
  var sy = parseInt(s.substring(0, 4), 10);
  var sm = parseInt(s.substring(4, 6), 10);
  var ey = parseInt(e.substring(0, 4), 10);
  var em = parseInt(e.substring(4, 6), 10);
  if (!sy || !sm || !ey || !em) return 1;
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function rv2_getBillingCycleRow_(projectId, ym) {
  try {
    var rows = b_readTable_("DB_BillingCycle");
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].projectId || "").trim() === String(projectId || "").trim() &&
          String(rows[i].ym || "").trim() === String(ym || "").trim()) {
        return rows[i];
      }
    }
  } catch (e) {}
  return null;
}

function rv2_calcMonthlyCapBudget_(projectId, ym, planCycle, feeAmount, cycleMonths) {
  var cycle = rv2_getBillingCycleRow_(projectId, ym);
  if (cycle) {
    var cycleBudget = Number(cycle.budgetYen || cycle.budgetTotal || 0);
    if (cycleBudget > 0) return Math.round(cycleBudget);
  }
  var monthlyGross = Number(feeAmount || 0) * 0.65;
  if (monthlyGross > 0) return Math.round(monthlyGross);
  var cycleBudgetYen = Number(planCycle && planCycle.budgetYen || 0);
  if (cycleBudgetYen > 0) return Math.round(cycleBudgetYen / Math.max(1, cycleMonths || 1));
  return 0;
}

function rv2_readCarryStock_(projectId, ym) {
  var stock = {};
  var prevYm = rv2_prevYm_(ym);
  if (!prevYm) return stock;
  var prev = rv2_getBillingCycleRow_(projectId, prevYm);
  if (!prev || !prev.rewardSummaryJson) return stock;
  try {
    var summary = typeof prev.rewardSummaryJson === "string"
      ? JSON.parse(prev.rewardSummaryJson)
      : prev.rewardSummaryJson;
    var members = summary && summary.members || [];
    for (var i = 0; i < members.length; i++) {
      var mid = String(members[i].memberId || "").trim();
      var amount = Number(members[i].stockYen || members[i].deferredYen || 0);
      if (mid && amount > 0) stock[mid] = Math.round(amount);
    }
  } catch (e) {}
  return stock;
}

function rv2_applyMonthlyCap_(members, capBudgetYen, carryStock, memberNameMap) {
  var cap = Math.round(Number(capBudgetYen || 0));
  var memberById = {};
  for (var i = 0; i < members.length; i++) {
    memberById[String(members[i].memberId || "").trim()] = members[i];
  }
  var carryIds = Object.keys(carryStock || {});
  for (var ci = 0; ci < carryIds.length; ci++) {
    var carryMid = carryIds[ci];
    if (!memberById[carryMid]) {
      var carryOnly = {
        memberId: carryMid,
        memberName: memberNameMap[carryMid] || carryMid,
        earnedPt: 0,
        basePay: 0,
        bonusPt: 0,
        totalPay: 0,
        breakdown: []
      };
      members.push(carryOnly);
      memberById[carryMid] = carryOnly;
    }
  }

  var totalGrossDue = 0;
  var carryInTotal = 0;
  for (var mi = 0; mi < members.length; mi++) {
    var member = members[mi];
    var mid = String(member.memberId || "").trim();
    var currentEarned = Math.round(Number(member.totalPay || member.basePay || 0));
    var carryIn = Math.round(Number(carryStock && carryStock[mid] || 0));
    var grossDue = Math.max(0, currentEarned + carryIn);
    member.carryInYen = carryIn;
    member.grossDueYen = grossDue;
    totalGrossDue += grossDue;
    carryInTotal += carryIn;
  }

  if (cap <= 0 || totalGrossDue <= cap) {
    var noCapTotal = 0;
    for (var ni = 0; ni < members.length; ni++) {
      members[ni].totalPay = Math.round(Number(members[ni].grossDueYen || 0));
      members[ni].deferredYen = 0;
      members[ni].stockYen = 0;
      noCapTotal += members[ni].totalPay;
    }
    return {
      members: members,
      totalPaySum: noCapTotal,
      totalGrossDueYen: Math.round(totalGrossDue),
      capBudgetYen: cap,
      capped: false,
      carryInYen: carryInTotal,
      carryOverYen: 0,
      monthlyBudget65: cap
    };
  }

  var remainingCap = cap;
  var remainingGross = totalGrossDue;
  var payTotal = 0;
  var carryOver = 0;
  for (var pi = 0; pi < members.length; pi++) {
    var gross = Math.round(Number(members[pi].grossDueYen || 0));
    var isLast = pi === members.length - 1;
    var paid = isLast ? remainingCap : Math.round(remainingCap * gross / Math.max(1, remainingGross));
    paid = Math.max(0, Math.min(gross, paid));
    remainingCap -= paid;
    remainingGross -= gross;
    var deferred = Math.max(0, gross - paid);
    members[pi].cappedFrom = gross;
    members[pi].totalPay = paid;
    members[pi].deferredYen = deferred;
    members[pi].stockYen = deferred;
    payTotal += paid;
    carryOver += deferred;
  }
  return {
    members: members,
    totalPaySum: payTotal,
    totalGrossDueYen: Math.round(totalGrossDue),
    capBudgetYen: cap,
    capped: true,
    carryInYen: carryInTotal,
    carryOverYen: carryOver,
    monthlyBudget65: cap
  };
}

/**
 * 指定PJ×ymの報酬サマリを計算して返す
 *
 * @param {string} projectId
 * @param {string} ym  yyyymm
 * @return {Object} {
 *   monthlyConsumedPt, cumulativeConsumedPt, annualTotalPt,
 *   progressRate, expectedRate,
 *   milestones: [{milestoneKey, title, maxPt, progressPct, consumedPt, cumPct, cumPt}],
 *   members: [{memberId, memberName, earnedPt, basePay, bonusPt, totalPay}],
 *   ptUnit
 * }
 */
function rv2_calcRewardSummary(projectId, ym) {
  var pid = String(projectId || "").trim();
  var sym = String(ym || "").trim();

  // --- 1. planCycle取得 ---
  var cycleSheet = valuePlan_repo_getCycleSheet();
  var cycleAll = cycleSheet.getDataRange().getValues();
  var cycleHeader = cycleAll[0] || [];
  var planCycle = null;
  for (var r = 1; r < cycleAll.length; r++) {
    var row = {};
    for (var c = 0; c < cycleHeader.length; c++) {
      row[cycleHeader[c]] = cycleAll[r][c];
    }
    if (String(row.projectId || "").trim() === pid &&
        String(row.status || "") === "fixed") {
      planCycle = row;
      break;
    }
  }
  if (!planCycle) {
    return { error: "planCycle not found", milestones: [], members: [] };
  }

  var planCycleId = String(planCycle.planCycleId || "").trim();
  var annualBudget = Number(planCycle.budgetYen || 0);
  var totalPt = Number(planCycle.totalPoints || 100);

  // --- 2. マイルストーン取得（active のみ） ---
  var msSheet = valuePlan_repo_getMilestoneSheet();
  var msAll = msSheet.getDataRange().getValues();
  var msHeader = msAll[0] || [];
  var milestones = [];
  var msMap = {}; // milestoneKey -> {title, maxPt}
  for (var r = 1; r < msAll.length; r++) {
    var msRow = {};
    for (var c = 0; c < msHeader.length; c++) {
      msRow[msHeader[c]] = msAll[r][c];
    }
    if (String(msRow.planCycleId || "").trim() !== planCycleId) continue;
    if (String(msRow.isActive || "") !== "true" && msRow.isActive !== true) continue;
    var gl = String(msRow.goalLevel || "annual");
    if (gl !== "annual") continue;

    var key = String(msRow.milestoneId || "").trim();
    msMap[key] = {
      milestoneKey: key,
      title: String(msRow.title || ""),
      maxPt: Number(msRow.points || 0),
      tag: String(msRow.tag || "")
    };
  }

  // --- 3. 全ymの進捗率を取得 ---
  var allProgress = rv2_readProgressForPlanCycle(planCycleId);

  // --- 3.5. routineタグのMS: 期間按分で自動進捗を補完 ---
  var cycleStartYm = String(planCycle.periodStartYm || "").trim();
  var cycleEndYm = String(planCycle.periodEndYm || "").trim();
  if (cycleStartYm && cycleEndYm) {
    var csY = parseInt(cycleStartYm.substring(0, 4), 10);
    var csM = parseInt(cycleStartYm.substring(4, 6), 10);
    var ceY = parseInt(cycleEndYm.substring(0, 4), 10);
    var ceM = parseInt(cycleEndYm.substring(4, 6), 10);
    var routineTotalMonths = Math.max(1, (ceY - csY) * 12 + (ceM - csM) + 1);
    var routineMonthPct = Math.round(100 / routineTotalMonths * 10) / 10;

    var rKeys = Object.keys(msMap);
    for (var rk = 0; rk < rKeys.length; rk++) {
      var rMs = msMap[rKeys[rk]];
      if (String(rMs.tag || "").toLowerCase() !== "routine") continue;

      // 対象ymまでの経過月数
      var tY = parseInt(sym.substring(0, 4), 10);
      var tM = parseInt(sym.substring(4, 6), 10);
      var elapsed = Math.max(0, (tY - csY) * 12 + (tM - csM) + 1);
      var autoCumPct = Math.min(100, Math.round(routineMonthPct * elapsed * 10) / 10);

      // DB上にpm_manualやpm_confirmedの進捗が既にあればそっちを優先（上書きしない）
      var hasManual = false;
      for (var rp = 0; rp < allProgress.length; rp++) {
        if (String(allProgress[rp].milestoneKey || "").trim() !== rKeys[rk]) continue;
        if (String(allProgress[rp].ym || "").trim() !== sym) continue;
        var src = String(allProgress[rp].source || "").trim();
        if (src === "pm_manual" || src === "pm_confirmed" || src === "criteria_toggle") {
          hasManual = true;
          break;
        }
      }
      if (hasManual) continue;

      // 自動進捗を注入（allProgressに追加。DBには書かない）
      allProgress.push({
        milestoneKey: rKeys[rk],
        ym: sym,
        progressPct: autoCumPct,
        source: "routine_auto"
      });
      // 前月分も補完（prevCumPct計算に必要）
      if (elapsed > 1) {
        var prevElapsed = elapsed - 1;
        var prevAutoPct = Math.min(100, Math.round(routineMonthPct * prevElapsed * 10) / 10);
        var prevYmDate = new Date(csY, csM - 1 + prevElapsed - 1, 1);
        var prevYmStr = Utilities.formatDate(prevYmDate, "Asia/Tokyo", "yyyyMM");
        allProgress.push({
          milestoneKey: rKeys[rk],
          ym: prevYmStr,
          progressPct: prevAutoPct,
          source: "routine_auto"
        });
      }
    }
  }

  // ymリスト（periodStartYm ~ periodEndYm）
  var startYm = String(planCycle.periodStartYm || "").trim();
  var endYm = String(planCycle.periodEndYm || "").trim();

  // MS別の今月進捗率 / 累計進捗率
  var msResults = [];
  var monthlyConsumedPt = 0;
  var cumulativeConsumedPt = 0;

  var keys = Object.keys(msMap);
  for (var k = 0; k < keys.length; k++) {
    var msKey = keys[k];
    var ms = msMap[msKey];

    var cumPct = 0;
    var cumPctSourcePri = -1;
    var CP_SOURCE_PRI = { pm_manual: 3, pm_confirmed: 3, criteria_toggle: 2, routine_auto: 1, tsukuyomi_estimate: 0 };

    // 当月行を優先して取得
    for (var p = 0; p < allProgress.length; p++) {
      var pg = allProgress[p];
      if (String(pg.milestoneKey || "").trim() !== msKey) continue;
      var pgYm = String(pg.ym || "").trim();
      var pct = Number(pg.progressPct || 0);
      var pgSrc = String(pg.source || "").trim();

      if (pgYm === sym) {
        var newPri = CP_SOURCE_PRI[pgSrc] !== undefined ? CP_SOURCE_PRI[pgSrc] : 0;
        if (newPri >= cumPctSourcePri) {
          cumPct = pct;
          cumPctSourcePri = newPri;
        }
      }
    }

    // 当月行がない場合は前月以前の最新累計値を引き継ぐ
    if (cumPctSourcePri === -1) {
      var carryPct = 0;
      var carryYm = "";
      for (var p = 0; p < allProgress.length; p++) {
        var pg = allProgress[p];
        if (String(pg.milestoneKey || "").trim() !== msKey) continue;
        var pgYm = String(pg.ym || "").trim();
        if (pgYm < sym && pgYm > carryYm) {
          carryPct = Number(pg.progressPct || 0);
          carryYm = pgYm;
        }
      }
      cumPct = carryPct;
    }

    // 前月値を正しく取得（上のロジック修正）
    var TRUSTED_SOURCES = { pm_manual:1, criteria_toggle:1, pm_confirmed:1 };
    var prevCumPct = 0;
    for (var p = 0; p < allProgress.length; p++) {
      var pg = allProgress[p];
      if (String(pg.milestoneKey || "").trim() !== msKey) continue;
      var pgYm = String(pg.ym || "").trim();
      var pgSource = String(pg.source || "").trim();
      if (pgYm < sym && Number(pg.progressPct || 0) > 0 && TRUSTED_SOURCES[pgSource]) {
        prevCumPct = Number(pg.progressPct || 0);
      }
    }

    // 今月増分 = 対象ymの累計 - 前月の累計
    var thisMonthPct = Math.max(0, cumPct - prevCumPct);

    var thisConsumed = ms.maxPt * thisMonthPct / 100;
    var cumConsumed = ms.maxPt * cumPct / 100;
    monthlyConsumedPt += thisConsumed;
    cumulativeConsumedPt += cumConsumed;

    // 対象ymのsource取得
    var msSource = "";
    for (var p = 0; p < allProgress.length; p++) {
      var pg = allProgress[p];
      if (String(pg.milestoneKey || "").trim() === msKey && String(pg.ym || "").trim() === sym) {
        msSource = String(pg.source || "");
        break;
      }
    }

    msResults.push({
      milestoneKey: msKey,
      title: ms.title,
      maxPt: ms.maxPt,
      tag: ms.tag,
      progressPct: thisMonthPct,
      pctUsed: cumPct,
      consumedPt: Math.round(thisConsumed * 100) / 100,
      cumPct: Math.round(cumPct * 10) / 10,
      cumPt: Math.round(cumConsumed * 100) / 100,
      source: msSource
    });
  }

  // --- 4. 進捗率と期待進捗率 ---
  var progressRate = totalPt > 0
    ? Math.round(cumulativeConsumedPt / totalPt * 1000) / 10
    : 0;

  var expectedRate = 0;
  if (startYm && endYm) {
    var sY = parseInt(startYm.substring(0, 4), 10);
    var sM = parseInt(startYm.substring(4, 6), 10);
    var eY = parseInt(endYm.substring(0, 4), 10);
    var eM = parseInt(endYm.substring(4, 6), 10);
    var cY = parseInt(sym.substring(0, 4), 10);
    var cM = parseInt(sym.substring(4, 6), 10);

    var totalMonths = (eY - sY) * 12 + (eM - sM) + 1;
    var elapsed = (cY - sY) * 12 + (cM - sM) + 1;
    if (totalMonths > 0) {
      expectedRate = Math.round(elapsed / totalMonths * 1000) / 10;
    }
  }

  // --- 5. ptUnit（deduction控除後のnetBudget / totalPt） ---
  var feeAmount = 0;
  try {
    var pjRows = b_readTable_("DB_Projects");
    for (var fi = 0; fi < pjRows.length; fi++) {
      if (String(pjRows[fi].projectId || "").trim() === pid) {
        feeAmount = Number(pjRows[fi].feeAmount || 0);
        break;
      }
    }
  } catch (e) {}
  var cycleMonths = rv2_monthDiffInclusive_(startYm, endYm);
  var monthlyGross = feeAmount * 0.65;
  var grossBudget = monthlyGross * cycleMonths;

  // Deduction控除（サイクル全期間の累計）
  var deductionTotal = 0;
  try {
    deductionTotal = pjDed_calcCycleDeductionTotal_(pid, monthlyGross, startYm, endYm);
  } catch (e) {
    // DB_PjDeductionsが未作成でもフォールバック
  }
  var netBudget = Math.max(0, grossBudget - deductionTotal);
  var ptUnit = totalPt > 0 ? Math.round(netBudget / totalPt) : 0;

  // --- 6. 背負い度 → 個人配分 ---
  // サブMSに担当配分が設定されていればそちらを正本とし、なければMS単位にフォールバック
  var respRows = rv2_readResponsibilityFromSubItems_(pid);
  var respRowsFiltered = [];
  for (var ri = 0; ri < respRows.length; ri++) {
    if (msMap[String(respRows[ri].milestoneKey || "").trim()]) {
      respRowsFiltered.push(respRows[ri]);
    }
  }
  if (respRowsFiltered.length === 0) {
    respRowsFiltered = rv2_readResponsibilityForProjectYm(pid, sym);
  }
  respRows = respRowsFiltered;

  // memberId -> { earnedPt, breakdown:[{msKey,title,msConsumedPt,share,earnedPt}] }
  var memberPt = {};
  var memberBreakdown = {};

  for (var k = 0; k < keys.length; k++) {
    var msKey = keys[k];
    var msConsumed = 0;
    var msTitle = "";
    for (var m = 0; m < msResults.length; m++) {
      if (msResults[m].milestoneKey === msKey) {
        msConsumed = msResults[m].consumedPt;
        msTitle = msResults[m].title;
        break;
      }
    }
    if (msConsumed <= 0) continue;

    var msResps = [];
    for (var rr = 0; rr < respRows.length; rr++) {
      if (String(respRows[rr].milestoneKey || "").trim() === msKey) {
        msResps.push(respRows[rr]);
      }
    }

    for (var rr = 0; rr < msResps.length; rr++) {
      var mid = String(msResps[rr].memberId || "").trim();
      var share = Number(msResps[rr].share || 0);
      if (!memberPt[mid]) memberPt[mid] = 0;
      memberPt[mid] += msConsumed * share;
      if (!memberBreakdown[mid]) memberBreakdown[mid] = [];
      memberBreakdown[mid].push({
        msKey: msKey,
        title: msTitle,
        msConsumedPt: Math.round(msConsumed * 100) / 100,
        share: share,
        earnedPt: Math.round(msConsumed * share * 100) / 100
      });
    }
  }

  // --- 7. メンバーマスタでコードネーム解決 ---
  var memberRows = b_readTable_("DB_Members");
  var memberNameMap = {};
  for (var mi = 0; mi < memberRows.length; mi++) {
    var mm = memberRows[mi];
    memberNameMap[String(mm.memberId || "")] = String(mm.codeName || mm.name || mm.memberId || "");
  }

  // --- 8. メンバー配分リスト ---
  var members = [];
  var mids = Object.keys(memberPt);
  for (var i = 0; i < mids.length; i++) {
    var mid = mids[i];
    var earned = Math.round(memberPt[mid] * 100) / 100;
    var basePay = Math.round(earned * ptUnit);
    members.push({
      memberId: mid,
      memberName: memberNameMap[mid] || mid,
      earnedPt: earned,
      basePay: basePay,
      bonusPt: 0,
      totalPay: basePay,
      breakdown: memberBreakdown[mid] || []
    });
  }

  // earnedPt降順
  members.sort(function(a, b) { return b.earnedPt - a.earnedPt; });

  // --- 9. 月次支払キャップ ---
  // 今月払ってよい額（PJ予算）を超えた分は member.stockYen として翌月へ繰り越す。
  var capBudgetYen = rv2_calcMonthlyCapBudget_(pid, sym, planCycle, feeAmount, cycleMonths);
  var carryStock = rv2_readCarryStock_(pid, sym);
  var capResult = rv2_applyMonthlyCap_(members, capBudgetYen, carryStock, memberNameMap);
  members = capResult.members;
  var totalPaySum = capResult.totalPaySum;

  return {
    totalPaySum: totalPaySum,
    totalGrossDueYen: capResult.totalGrossDueYen,
    capBudgetYen: capResult.capBudgetYen,
    capped: capResult.capped,
    carryInYen: capResult.carryInYen,
    carryOverYen: capResult.carryOverYen,
    monthlyBudget65: capResult.monthlyBudget65,
    planCycleId: planCycleId,
    annualBudget: annualBudget,
    grossBudget: grossBudget,
    deductionTotal: Math.round(deductionTotal),
    netBudget: Math.round(netBudget),
    totalPt: totalPt,
    ptUnit: ptUnit,
    monthlyConsumedPt: Math.round(monthlyConsumedPt * 100) / 100,
    cumulativeConsumedPt: Math.round(cumulativeConsumedPt * 100) / 100,
    progressRate: progressRate,
    expectedRate: expectedRate,
    milestones: msResults,
    members: members
  };
}
