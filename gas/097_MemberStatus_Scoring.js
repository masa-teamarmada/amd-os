/** 097_MemberStatus_Scoring.gs
 * メンバーステータス 5軸スコア算出
 *
 * 先手力: PJ単位のamdPct（initiativeOrigin）をメンバーの責任割合で加重平均
 * 実行力: confirmedイベント数 + impact×depth + 請求完了率
 * 発信力: 月次報告存在数 + 感謝メッセージ受信数
 * 連携力: 関与PJ数 + 共同責任イベント数
 * 成長力: 新規PJ参加数 + depth推移 + 在籍歴ボーナス
 */

function memberStatus_computeAllScores_() {
  var members = memberStatus_getActiveMembers_();
  if (!members.length) return [];

  // 全データを一括読取（N+1回避）
  var allEvents = memberStatus_listAllEvents_();
  var allResp = memberStatus_listAllResponsibilities_();
  var allBilling = memberStatus_readBillingCycles_();
  var allReports = memberStatus_readMonthlyReports_();

  // 直近3ヶ月のym範囲
  var ymRange = memberStatus_trailingYms_(3);
  var ymSet = {};
  ymRange.forEach(function(ym) { ymSet[ym] = true; });

  // イベントをPJ×ymでグループ化（rejected除外）
  var activeEvents = allEvents.filter(function(e) {
    return String(e.status || "").trim() !== "rejected";
  });

  // PJ単位の先手力算出
  var pjOriginRates = memberStatus_calcPjOriginRates_(activeEvents);

  // メンバー×イベント紐付け
  var memberEventMap = memberStatus_buildMemberEventMap_(activeEvents, allResp);

  // メンバーごとにraw score算出
  var rawScores = {};
  members.forEach(function(m) {
    var mid = m.memberId;
    var myEvents = memberEventMap[mid] || [];
    var myEventsInWindow = myEvents.filter(function(e) { return ymSet[e.ym]; });

    rawScores[mid] = {
      initiative: memberStatus_scoreInitiative_(mid, myEventsInWindow, pjOriginRates, allResp),
      execution: memberStatus_scoreExecution_(mid, myEventsInWindow, allBilling, ymRange),
      communication: memberStatus_scoreCommunication_(mid, m.codeName, allReports, ymRange),
      collaboration: memberStatus_scoreCollaboration_(mid, myEventsInWindow, allResp),
      growth: memberStatus_scoreGrowth_(mid, myEvents, myEventsInWindow, m, ymSet)
    };
  });

  // 正規化（メンバー間相対ランキング → 0-100）
  var normalized = memberStatus_normalizeScores_(rawScores, members);
  return normalized;
}

// ===== 先手力（Initiative）=====
// PJごとのamdPctを、メンバーがそのPJに持つ責任割合で加重平均

function memberStatus_scoreInitiative_(memberId, eventsInWindow, pjOriginRates, allResp) {
  // メンバーが関与するPJとその重み（責任割合の合計）を算出
  var pjWeights = {};
  for (var i = 0; i < eventsInWindow.length; i++) {
    var ev = eventsInWindow[i];
    var pid = String(ev.projectId || "").trim();
    if (!pid) continue;
    // このイベントにおけるメンバーの責任割合を取得
    var resp = memberStatus_findResp_(allResp, ev.eventId, memberId);
    if (!pjWeights[pid]) pjWeights[pid] = 0;
    pjWeights[pid] += resp;
  }

  var totalWeight = 0;
  var weightedPct = 0;
  Object.keys(pjWeights).forEach(function(pid) {
    var rate = pjOriginRates[pid];
    if (rate && rate.judgeable >= 1) {
      var w = pjWeights[pid];
      weightedPct += rate.amdPct * w;
      totalWeight += w;
    }
  });

  // 先手力 = 関与PJのamdPctの加重平均（0-100）
  return totalWeight > 0 ? weightedPct / totalWeight : 0;
}

// ===== 実行力（Execution）=====

function memberStatus_scoreExecution_(memberId, eventsInWindow, allBilling, ymRange) {
  var confirmed = 0;
  var impactDepthSum = 0;
  for (var i = 0; i < eventsInWindow.length; i++) {
    var ev = eventsInWindow[i];
    if (String(ev.status || "").trim() === "confirmed") {
      confirmed++;
      impactDepthSum += Number(ev.impact || 0) * Number(ev.depth || 0);
    }
  }

  // 請求完了率（このメンバーが関与するBillingCycleで、ymRange内のclosed率）
  var billingTotal = 0;
  var billingClosed = 0;
  for (var i = 0; i < allBilling.length; i++) {
    var bc = allBilling[i];
    var bcYm = String(bc.ym || "").trim();
    if (!ymRange.some(function(ym) { return ym === bcYm; })) continue;
    // メンバーが担当しているかの判定（pmMemberIdで）
    if (String(bc.pmMemberId || "").trim() !== memberId) continue;
    billingTotal++;
    var bcStatus = String(bc.status || "").toLowerCase().trim();
    if (bcStatus === "closed" || bcStatus === "confirmed" || bcStatus === "paid") billingClosed++;
  }
  var billingRate = billingTotal > 0 ? billingClosed / billingTotal : 0;

  return (confirmed * 1.5) + (impactDepthSum * 0.3) + (billingRate * 20);
}

// ===== 発信力（Communication）=====

function memberStatus_scoreCommunication_(memberId, codeName, allReports, ymRange) {
  // 月次報告の存在数
  var reportCount = 0;
  for (var i = 0; i < allReports.length; i++) {
    var r = allReports[i];
    var rYm = String(r.ym || "").trim();
    if (!ymRange.some(function(ym) { return ym === rYm; })) continue;
    // reporterMemberIdまたはpmMemberIdでマッチ
    if (String(r.reporterMemberId || r.pmMemberId || "").trim() === memberId) {
      reportCount++;
    }
  }

  return reportCount * 5;
}

// ===== 連携力（Collaboration）=====

function memberStatus_scoreCollaboration_(memberId, eventsInWindow, allResp) {
  // 関与PJ数
  var pjSet = {};
  for (var i = 0; i < eventsInWindow.length; i++) {
    var pid = String(eventsInWindow[i].projectId || "").trim();
    if (pid) pjSet[pid] = true;
  }
  var distinctPjCount = Object.keys(pjSet).length;

  // 共同責任イベント数（他メンバーと一緒に責任を持つイベント）
  var sharedEventCount = 0;
  for (var i = 0; i < eventsInWindow.length; i++) {
    var eid = eventsInWindow[i].eventId;
    var respForEvent = allResp.filter(function(r) {
      return String(r.eventId || "").trim() === String(eid).trim();
    });
    if (respForEvent.length > 1) sharedEventCount++;
  }

  return (distinctPjCount * 3) + (sharedEventCount * 2);
}

// ===== 成長力（Growth）=====

function memberStatus_scoreGrowth_(memberId, allMyEvents, eventsInWindow, memberMeta, ymSet) {
  // 新規PJ参加数（ウィンドウ内で初めて出現したPJ）
  var oldPjs = {};
  var newPjCount = 0;
  for (var i = 0; i < allMyEvents.length; i++) {
    var ev = allMyEvents[i];
    var pid = String(ev.projectId || "").trim();
    if (!pid) continue;
    if (ymSet[String(ev.ym || "").trim()]) {
      if (!oldPjs[pid]) newPjCount++;
    } else {
      oldPjs[pid] = true;
    }
  }

  // depth推移（ウィンドウ内の前半 vs 後半）
  var depthTrend = 0;
  if (eventsInWindow.length >= 4) {
    var half = Math.floor(eventsInWindow.length / 2);
    var firstHalf = 0, secondHalf = 0;
    for (var i = 0; i < half; i++) firstHalf += Number(eventsInWindow[i].depth || 0);
    for (var i = half; i < eventsInWindow.length; i++) secondHalf += Number(eventsInWindow[i].depth || 0);
    firstHalf /= half;
    secondHalf /= (eventsInWindow.length - half);
    depthTrend = secondHalf - firstHalf; // 正なら成長
  }

  // 在籍歴ボーナス（6ヶ月以内 = 新人ボーナス）
  var tenureBonus = 0;
  var joinYm = String(memberMeta.joinYm || "").trim().replace(/[-\/]/g, "").substring(0, 6);
  if (joinYm) {
    var now = memberStatus_currentYm_();
    var diff = memberStatus_ymDiff_(joinYm, now);
    if (diff <= 6) tenureBonus = 5;
  }

  return (newPjCount * 5) + (depthTrend * 10) + tenureBonus;
}

// ===== 正規化 =====

function memberStatus_normalizeScores_(rawScores, members) {
  var axes = ["initiative", "execution", "communication", "collaboration", "growth"];
  var result = {};

  axes.forEach(function(axis) {
    // 全メンバーのraw scoreを集め、ランキング
    var vals = [];
    members.forEach(function(m) {
      vals.push({ memberId: m.memberId, raw: rawScores[m.memberId][axis] });
    });
    vals.sort(function(a, b) { return a.raw - b.raw; });

    // 同率スコアも考慮したランキング → 0-100
    for (var i = 0; i < vals.length; i++) {
      var mid = vals[i].memberId;
      if (!result[mid]) result[mid] = {};
      if (vals[i].raw === 0) {
        result[mid][axis] = 0; // データなしは0
      } else if (vals.length <= 1) {
        result[mid][axis] = 50; // メンバー1人なら50
      } else {
        result[mid][axis] = Math.round((i / (vals.length - 1)) * 100);
      }
    }
  });

  // 先手力はamdPctベースなので正規化せず、そのまま使う（0-100の絶対値）
  members.forEach(function(m) {
    var mid = m.memberId;
    var rawInit = rawScores[mid].initiative;
    // amdPctは既に0-100スケールなのでそのまま
    result[mid].initiative = Math.round(rawInit);
  });

  return result;
}

// ===== 充填率 =====

function memberStatus_computeCompletionPct_(scores, knowledge, titles) {
  var total = 13; // 5スコア + 7ナレッジカテゴリ + 1称号
  var filled = 0;

  // スコア（5軸）
  if (scores.initiative > 0) filled++;
  if (scores.execution > 0) filled++;
  if (scores.communication > 0) filled++;
  if (scores.collaboration > 0) filled++;
  if (scores.growth > 0) filled++;

  // ナレッジカテゴリ（7種）
  var categories = ["skills", "personality", "communication_style", "growth_areas", "work_style", "interests", "episodes"];
  var knowledgeMap = {};
  (knowledge || []).forEach(function(k) { knowledgeMap[k.category] = k; });
  categories.forEach(function(cat) {
    if (knowledgeMap[cat] && Number(knowledgeMap[cat].entityCount || 0) > 0) filled++;
  });

  // 称号
  if (titles && titles.length > 0) filled++;

  return Math.round((filled / total) * 100);
}

function memberStatus_computeNextFillable_(scores, knowledge, titles) {
  var hints = [];
  if (scores.initiative === 0) hints.push("PJの進捗イベントを登録すると先手力が解放されます");
  if (scores.execution === 0) hints.push("イベントをconfirmすると実行力が解放されます");
  if (scores.communication === 0) hints.push("月次報告を提出すると発信力が解放されます");

  var categories = ["skills", "personality", "communication_style", "growth_areas", "work_style", "interests", "episodes"];
  var knowledgeMap = {};
  (knowledge || []).forEach(function(k) { knowledgeMap[k.category] = k; });
  var emptyKnowledge = categories.filter(function(cat) {
    return !knowledgeMap[cat] || Number(knowledgeMap[cat].entityCount || 0) === 0;
  });
  if (emptyKnowledge.length > 0) {
    hints.push("Slackでの会話から " + emptyKnowledge.length + " カテゴリが自動収集されます");
  }

  if (!titles || titles.length === 0) {
    hints.push("いずれかのスコアが80を超えると称号を獲得");
  }

  return hints.slice(0, 3);
}

// ===== ヘルパー =====

function memberStatus_calcPjOriginRates_(events) {
  // PJごとに先手力%を算出（Cockpitと同じロジック）
  var pjMap = {};
  events.forEach(function(ev) {
    var pid = String(ev.projectId || "").trim();
    if (!pid) return;
    if (!pjMap[pid]) pjMap[pid] = { total: 0, amd: 0, co: 0, client: 0, external: 0, unknown: 0 };
    pjMap[pid].total++;
    var orig = String(ev.initiativeOrigin || "unknown").trim();
    if (orig === "amd_proposed") pjMap[pid].amd++;
    else if (orig === "co_decided") pjMap[pid].co++;
    else if (orig === "client_requested" || orig === "partner_proposed") pjMap[pid].client++;
    else if (orig === "external") pjMap[pid].external++;
    else pjMap[pid].unknown++;
  });

  var result = {};
  Object.keys(pjMap).forEach(function(pid) {
    var p = pjMap[pid];
    var judgeable = p.total - p.external;
    result[pid] = {
      total: p.total,
      judgeable: judgeable,
      amdPct: judgeable >= 1 ? Math.round((p.amd + p.co) / judgeable * 100) : 0
    };
  });
  return result;
}

function memberStatus_buildMemberEventMap_(events, responsibilities) {
  // eventId → イベントオブジェクト
  var eventById = {};
  events.forEach(function(e) { eventById[String(e.eventId || "").trim()] = e; });

  // memberId → イベント配列
  var map = {};
  responsibilities.forEach(function(r) {
    var mid = String(r.memberId || "").trim();
    var eid = String(r.eventId || "").trim();
    if (!mid || !eid || !eventById[eid]) return;
    if (!map[mid]) map[mid] = [];
    // イベント情報にresponsibility情報をマージ
    var ev = eventById[eid];
    map[mid].push(ev);
  });
  return map;
}

function memberStatus_findResp_(allResp, eventId, memberId) {
  var eid = String(eventId || "").trim();
  var mid = String(memberId || "").trim();
  for (var i = 0; i < allResp.length; i++) {
    if (String(allResp[i].eventId || "").trim() === eid &&
        String(allResp[i].memberId || "").trim() === mid) {
      return Number(allResp[i].responsibility || 1.0);
    }
  }
  return 0;
}

function memberStatus_trailingYms_(months) {
  var now = new Date();
  var result = [];
  for (var i = 0; i < months; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = Utilities.formatDate(d, "Asia/Tokyo", "yyyyMM");
    result.push(ym);
  }
  return result;
}

function memberStatus_currentYm_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMM");
}

function memberStatus_ymDiff_(ymA, ymB) {
  var yA = parseInt(ymA.substring(0, 4), 10);
  var mA = parseInt(ymA.substring(4, 6), 10);
  var yB = parseInt(ymB.substring(0, 4), 10);
  var mB = parseInt(ymB.substring(4, 6), 10);
  return (yB * 12 + mB) - (yA * 12 + mA);
}

function memberStatus_readBillingCycles_() {
  try { return b_readTable_("DB_BillingCycle"); } catch(e) { return []; }
}

function memberStatus_readMonthlyReports_() {
  try { return b_readTable_("DB_MonthlyReports"); } catch(e) { return []; }
}
