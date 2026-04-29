/** 052_RewardScoring_Ops.gs
 * 報酬スコアリングのドメインロジック
 *
 * 計算モデル:
 *   pt単価 = annualBudget × 50% / totalPoints
 *   base_pay(u) = Σ[ contribPoints(e→ms) × C(e,u) ] × pt単価
 *   appreciation_bonus(u) = bonusRatio(u) × 月次appreciation枠
 *   total(u) = base_pay(u) + appreciation_bonus(u)
 *
 * 予算構造:
 *   クライアント請求額 100%
 *   ├ AMD運営費 30% + クローザー 5% → 控除
 *   └ メンバー枠 65%
 *     ├ スコア配分枠 50%  ← base_pay の原資
 *     ├ Appreciation枠 10% ← appreciation_bonus の原資
 *     └ イレギュラー枠 5%  ← 手動配分
 */

var REWARD_RATE_BASE = 0.50;
var REWARD_RATE_APPRECIATION = 0.10;

/**
 * 月次報酬を計算してDB_MonthlyRewardPayoutに保存
 */
function reward_ops_calculateAndSave(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId and ym required" };

  // --- 1) 年間計画（annualBudget / totalPoints）取得 ---
  var planInfo = reward_ops_getPlanInfo_(projectId);
  if (!planInfo) return { ok: false, message: "ValuePlanCycles(fixed)が見つからない" };

  var budgetYen = Number(planInfo.budgetYen || 0);
  var totalPoints = Number(planInfo.totalPoints || 100);
  if (budgetYen <= 0) return { ok: false, message: "budgetYenが未設定" };

  var ptUnit = budgetYen * REWARD_RATE_BASE / totalPoints;

  // --- 2) 今月のValueContributions取得 ---
  var contributions = vcListByProjectYm(projectId, ym);
  if (!contributions.length) return { ok: false, message: "ValueContributionsがない（先にLLM抽出を実行）" };

  // --- 3) イベントごとのResponsibility取得 & 正規化 ---
  var eventIds = [];
  var eventIdSet = {};
  contributions.forEach(function(c) {
    var eid = String(c.eventId || "").trim();
    if (eid && !eventIdSet[eid]) {
      eventIds.push(eid);
      eventIdSet[eid] = true;
    }
  });

  var allResp = reward_repo_listResponsibilities_(eventIds);

  // イベント内正規化: C(e,u) = R(e,u) / Σ R(e,*)
  var respByEvent = {};  // eventId -> [{ memberId, raw, normalized }]
  allResp.forEach(function(r) {
    var eid = String(r.eventId || "").trim();
    if (!respByEvent[eid]) respByEvent[eid] = [];
    respByEvent[eid].push({
      memberId: String(r.memberId || "").trim(),
      raw: Number(r.responsibility || 1.0)
    });
  });

  Object.keys(respByEvent).forEach(function(eid) {
    var arr = respByEvent[eid];
    var sum = 0;
    arr.forEach(function(r) { sum += r.raw; });
    arr.forEach(function(r) {
      r.normalized = sum > 0 ? r.raw / sum : 0;
    });
  });

  // --- 4) メンバーごとの貢献pt集計 ---
  //   member_pt(u) = Σ_contrib [ contribPoints × C(e,u) ]
  var memberPts = {};  // memberId -> pt

  contributions.forEach(function(c) {
    var eid = String(c.eventId || "").trim();
    var pts = Number(c.contribPoints || 0);
    if (!eid || pts <= 0) return;

    var resps = respByEvent[eid] || [];
    resps.forEach(function(r) {
      if (!memberPts[r.memberId]) memberPts[r.memberId] = 0;
      memberPts[r.memberId] += pts * r.normalized;
    });
  });

  // --- 5) base_pay計算 ---
  var basePay = {};  // memberId -> 円
  Object.keys(memberPts).forEach(function(mid) {
    basePay[mid] = Math.round(memberPts[mid] * ptUnit);
  });

  // --- 6) Appreciation計算 ---
  var appreciationResult = appreciation_calculate(projectId, ym);
  // planCycleの月数を算出
  var startYm = planInfo.periodStartYm;
  var endYm = planInfo.periodEndYm;
  var cycleMonths = reward_ops_calcMonths_(startYm, endYm);
  var monthlyAppreciationPool = Math.round(budgetYen * REWARD_RATE_APPRECIATION / cycleMonths);

  var appreciationBonus = {};  // memberId -> 円
  if (appreciationResult.ok && appreciationResult.totalBonus > 0) {
    appreciationResult.scores.forEach(function(s) {
      appreciationBonus[s.memberId] = Math.round(s.bonusRatio * monthlyAppreciationPool);
    });
  }

  // --- 7) 合計 & DB保存 ---
  var allMemberIds = {};
  Object.keys(memberPts).forEach(function(mid) { allMemberIds[mid] = true; });
  Object.keys(appreciationBonus).forEach(function(mid) { allMemberIds[mid] = true; });

  var results = [];
  Object.keys(allMemberIds).forEach(function(mid) {
    var bp = basePay[mid] || 0;
    var ab = appreciationBonus[mid] || 0;
    var total = bp + ab;

    var rec = {
      projectId: projectId,
      ym: ym,
      memberId: mid,
      earnedPoints: Math.round((memberPts[mid] || 0) * 100) / 100,
      ptUnit: Math.round(ptUnit),
      basePay: bp,
      appreciationRaw: 1.0,
      appreciationBonus: ab,
      totalPayout: total,
      status: "draft"
    };

    // appreciationRawを実値で上書き
    if (appreciationResult.ok) {
      var found = appreciationResult.scores.filter(function(s) { return s.memberId === mid; })[0];
      if (found) rec.appreciationRaw = Math.round(found.rawScore * 100) / 100;
    }

    reward_repo_upsertPayout_(rec);
    results.push(rec);
  });

  return {
    ok: true,
    projectId: projectId,
    ym: ym,
    budgetYen: budgetYen,
    totalPoints: totalPoints,
    ptUnit: Math.round(ptUnit),
    monthlyAppreciationPool: monthlyAppreciationPool,
    members: results
  };
}

/** planCycle期間の月数を算出 */
function reward_ops_calcMonths_(startYm, endYm) {
  var sy = Number(String(startYm || "").substring(0, 4));
  var sm = Number(String(startYm || "").substring(4, 6));
  var ey = Number(String(endYm || "").substring(0, 4));
  var em = Number(String(endYm || "").substring(4, 6));
  var months = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(months, 1);
}

/**
 * DB_ValuePlanCyclesからprojectIdの最新fixed計画を取得
 */
function reward_ops_getPlanInfo_(projectId) {
  try {
    var sh = valuePlan_repo_getCycleSheet();
    var values = sh.getDataRange().getValues();
    var header = values[0] || [];
    var idx = {};
    for (var c = 0; c < header.length; c++) {
      idx[String(header[c] || "").trim()] = c;
    }

    var pid = String(projectId || "").trim();
    var best = null;

    for (var r = 1; r < values.length; r++) {
      if (String(values[r][idx.projectId] || "").trim() !== pid) continue;
      if (String(values[r][idx.status] || "").trim() !== "fixed") continue;

      var candidate = {
        planCycleId: String(values[r][idx.planCycleId] || "").trim(),
        budgetYen: Number(values[r][idx.budgetYen] || 0),
        totalPoints: Number(values[r][idx.totalPoints] || 100),
        periodStartYm: String(values[r][idx.periodStartYm] || "").trim(),
        periodEndYm: String(values[r][idx.periodEndYm] || "").trim()
      };

      if (!best || Number(values[r][idx.fixedVersion] || 0) > Number(best._fv || 0)) {
        candidate._fv = Number(values[r][idx.fixedVersion] || 0);
        best = candidate;
      }
    }

    if (best) delete best._fv;
    return best;
  } catch (e) {
    return null;
  }
}

/** テスト用ラッパー */
function TEST_reward_ops_calculateMonthlyScore() {
  var result = reward_ops_calculateAndSave({
    projectId: "p21",
    ym: "202601"
  });
  Logger.log(JSON.stringify(result, null, 2));
}
