/** 095_MemberStatus_Api.gs
 * メンバーステータス 公開API（google.script.run用）
 */

function admin_listMemberStatus() {
  if (!canAccessAdminPage_()) return { ok: false, message: "access denied" };

  try {
    var members = memberStatus_getActiveMembers_();
    if (!members.length) return { ok: true, members: [], meta: {} };

    // キャッシュ確認（直近ymで計算済みなら再利用）
    var currentYm = memberStatus_currentYm_();
    var cached = memberStatus_listLatest_();
    var cachedMap = {};
    cached.forEach(function(c) { cachedMap[c.memberId] = c; });

    // 全員分のキャッシュがあるか確認
    var allCached = members.every(function(m) {
      var c = cachedMap[m.memberId];
      return c && String(c.ym).trim() === currentYm;
    });

    var result;
    if (allCached) {
      // キャッシュから返却
      result = members.map(function(m) {
        var c = cachedMap[m.memberId];
        return {
          memberId: m.memberId,
          codeName: m.codeName,
          scoreInitiative: Number(c.scoreInitiative || 0),
          scoreExecution: Number(c.scoreExecution || 0),
          scoreCommunication: Number(c.scoreCommunication || 0),
          scoreCollaboration: Number(c.scoreCollaboration || 0),
          scoreGrowth: Number(c.scoreGrowth || 0),
          titlesJson: c.titlesJson || "[]",
          completionPct: Number(c.completionPct || 0),
          computedAtJst: c.computedAtJst || ""
        };
      });
    } else {
      // 再計算
      result = memberStatus_recompute_(members, currentYm);
    }

    return JSON.parse(JSON.stringify({
      ok: true,
      members: result,
      meta: { currentYm: currentYm, computedAtJst: reward_repo_jstNow_() }
    }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

function admin_getMemberStatusDetail(payload) {
  if (!canAccessAdminPage_()) return { ok: false, message: "access denied" };
  var memberId = String((payload || {}).memberId || "").trim();
  if (!memberId) return { ok: false, message: "memberId required" };

  try {
    var members = memberStatus_getActiveMembers_();
    var memberMeta = null;
    for (var i = 0; i < members.length; i++) {
      if (members[i].memberId === memberId) { memberMeta = members[i]; break; }
    }
    if (!memberMeta) return { ok: false, message: "member not found" };

    // キャッシュ取得
    var cached = memberStatus_getByMemberId_(memberId);
    var currentYm = memberStatus_currentYm_();

    var scores, titles, knowledge, completionPct, nextFillable;

    if (cached && String(cached.ym).trim() === currentYm) {
      scores = {
        initiative: Number(cached.scoreInitiative || 0),
        execution: Number(cached.scoreExecution || 0),
        communication: Number(cached.scoreCommunication || 0),
        collaboration: Number(cached.scoreCollaboration || 0),
        growth: Number(cached.scoreGrowth || 0)
      };
      titles = JSON.parse(cached.titlesJson || "[]");
      knowledge = JSON.parse(cached.knowledgeJson || "[]");
      completionPct = Number(cached.completionPct || 0);
      nextFillable = JSON.parse(cached.nextFillableItems || "[]");
    } else {
      // 全員分再計算してからこのメンバーを返す
      memberStatus_recompute_(members, currentYm);
      cached = memberStatus_getByMemberId_(memberId);
      if (cached) {
        scores = {
          initiative: Number(cached.scoreInitiative || 0),
          execution: Number(cached.scoreExecution || 0),
          communication: Number(cached.scoreCommunication || 0),
          collaboration: Number(cached.scoreCollaboration || 0),
          growth: Number(cached.scoreGrowth || 0)
        };
        titles = JSON.parse(cached.titlesJson || "[]");
        knowledge = JSON.parse(cached.knowledgeJson || "[]");
        completionPct = Number(cached.completionPct || 0);
        nextFillable = JSON.parse(cached.nextFillableItems || "[]");
      } else {
        scores = { initiative: 0, execution: 0, communication: 0, collaboration: 0, growth: 0 };
        titles = [];
        knowledge = [];
        completionPct = 0;
        nextFillable = [];
      }
    }

    return JSON.parse(JSON.stringify({
      ok: true,
      member: {
        memberId: memberId,
        codeName: memberMeta.codeName,
        scores: scores,
        titles: titles,
        knowledge: knowledge,
        completionPct: completionPct,
        nextFillableItems: nextFillable
      }
    }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

function admin_recomputeMemberStatus() {
  if (!canAccessAdminPage_()) return { ok: false, message: "access denied" };

  try {
    var members = memberStatus_getActiveMembers_();
    var currentYm = memberStatus_currentYm_();
    var result = memberStatus_recompute_(members, currentYm);
    return JSON.parse(JSON.stringify({
      ok: true,
      count: result.length,
      message: result.length + "名のスコアを再計算しました"
    }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

// ===== 内部 =====

function memberStatus_recompute_(members, currentYm) {
  var normalized = memberStatus_computeAllScores_();
  var result = [];

  members.forEach(function(m) {
    var mid = m.memberId;
    var scores = normalized[mid] || { initiative: 0, execution: 0, communication: 0, collaboration: 0, growth: 0 };

    // ナレッジ取得
    var knowledge = memberStatus_fetchKnowledge_(m.codeName);

    // 称号判定
    var titles = memberStatus_computeTitles_(scores, m);

    // 充填率
    var completionPct = memberStatus_computeCompletionPct_(scores, knowledge, titles);
    var nextFillable = memberStatus_computeNextFillable_(scores, knowledge, titles);

    // DB書き込み
    memberStatus_upsertScores_(mid, m.codeName, currentYm, scores, titles, knowledge, completionPct, nextFillable);

    result.push({
      memberId: mid,
      codeName: m.codeName,
      scoreInitiative: scores.initiative,
      scoreExecution: scores.execution,
      scoreCommunication: scores.communication,
      scoreCollaboration: scores.collaboration,
      scoreGrowth: scores.growth,
      titlesJson: JSON.stringify(titles),
      completionPct: completionPct,
      computedAtJst: reward_repo_jstNow_()
    });
  });

  return result;
}
