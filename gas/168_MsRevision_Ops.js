/**
 * 168_MsRevision_Ops.gs
 * MS改定のドメインロジック。
 * diff生成、version切り替え、進捗マッピング（Phase2）を担当。
 *
 * 依存：
 *   - 086_ValuePlanRepo.gs（writeMilestonesForVersion, upsertPlanCycle, appendRevisionLog）
 *   - 058_RewardV2_Repo.gs（rv2_upsertProgress — Phase2で使用）
 */

// ================================================================
// diff生成
// ================================================================

/**
 * 旧MS一覧と新MS一覧からdiffを生成
 * @param {Array} oldMs  - session.revisableMs
 * @param {Array} newMs  - LLMが返したrevisedMs
 * @param {Array} mapping - LLMが返したmapping
 * @return {Array} [{type: "unchanged|modified|added|removed", old:{...}, new:{...}}]
 */
function msRev_buildDiff(oldMs, newMs, mapping) {
  mapping = mapping || [];
  var diff = [];

  // oldMsId → mappingエントリ
  var oldToMapping = {};
  for (var i = 0; i < mapping.length; i++) {
    var mp = mapping[i];
    var oldId = String(mp.oldMsId || "").trim();
    if (oldId) oldToMapping[oldId] = mp;
  }

  // newMs の originMsId → newMs index
  var originToNew = {};
  for (var i = 0; i < newMs.length; i++) {
    var origin = String(newMs[i].originMsId || "").trim();
    if (origin) originToNew[origin] = i;
  }

  // マッチ済みの旧MSを追跡
  var matchedOldIds = {};

  // 1. newMsを走査して modified / unchanged / added を判定
  for (var i = 0; i < newMs.length; i++) {
    var nm = newMs[i];
    var origin = String(nm.originMsId || "").trim();

    if (!origin) {
      // originMsId空 → 完全新規
      diff.push({
        type: "added",
        old: null,
        new: {
          orderNo: nm.orderNo || (i + 1),
          title: String(nm.title || ""),
          points: Number(nm.points || 0),
          targetYm: String(nm.targetYm || ""),
          tag: String(nm.tag || "normal"),
          subMilestones: nm.subMilestones || []
        }
      });
      continue;
    }

    // originMsIdから旧MSを探す
    var oldItem = null;
    for (var j = 0; j < oldMs.length; j++) {
      if (String(oldMs[j].milestoneId || "").trim() === origin) {
        oldItem = oldMs[j];
        break;
      }
    }

    matchedOldIds[origin] = true;

    if (!oldItem) {
      // originMsIdが指定されてるが旧MSに見つからない（LLMの誤り）→ addedとして扱う
      diff.push({
        type: "added",
        old: null,
        new: {
          orderNo: nm.orderNo || (i + 1),
          title: String(nm.title || ""),
          points: Number(nm.points || 0),
          targetYm: String(nm.targetYm || ""),
          tag: String(nm.tag || "normal")
        }
      });
      continue;
    }

    // modified or unchanged
    var titleChanged = String(oldItem.title || "") !== String(nm.title || "");
    var ptChanged = Number(oldItem.points || 0) !== Number(nm.points || 0);
    var ymChanged = String(oldItem.targetYm || "") !== String(nm.targetYm || "");
    var criteriaChanged = String(oldItem.successCriteria || "") !== String(nm.successCriteria || "");
    var tagChanged = String(oldItem.tag || "normal") !== String(nm.tag || "normal");
    var subsAdded = Array.isArray(nm.subMilestones) && nm.subMilestones.length > 0;

    diff.push({
      type: (titleChanged || ptChanged || ymChanged || criteriaChanged || tagChanged || subsAdded) ? "modified" : "unchanged",
      criteriaChanged: criteriaChanged,
      old: {
        milestoneId: String(oldItem.milestoneId || ""),
        orderNo: Number(oldItem.orderNo || 0),
        title: String(oldItem.title || ""),
        points: Number(oldItem.points || 0),
        targetYm: String(oldItem.targetYm || ""),
        tag: String(oldItem.tag || "normal"),
        successCriteria: String(oldItem.successCriteria || "")
      },
      new: {
        orderNo: nm.orderNo || (i + 1),
        title: String(nm.title || ""),
        points: Number(nm.points || 0),
        targetYm: String(nm.targetYm || ""),
        tag: String(nm.tag || "normal"),
        successCriteria: String(nm.successCriteria || ""),
        subMilestones: nm.subMilestones || []
      }
    });
  }

  // 2. oldMsの中でマッチしなかったもの → removed
  for (var j = 0; j < oldMs.length; j++) {
    var oldId = String(oldMs[j].milestoneId || "").trim();
    if (matchedOldIds[oldId]) continue;
    diff.push({
      type: "removed",
      old: {
        milestoneId: oldId,
        orderNo: Number(oldMs[j].orderNo || 0),
        title: String(oldMs[j].title || ""),
        points: Number(oldMs[j].points || 0),
        targetYm: String(oldMs[j].targetYm || ""),
        tag: String(oldMs[j].tag || "normal")
      },
      new: null
    });
  }

  return diff;
}

// ================================================================
// Fix実行（DB書き込み）
// ================================================================

/**
 * 改定を確定してDBに書き込む
 * @param {Object} session - CacheServiceから取得したセッション
 * @return {Object} { ok, planCycleId, newVersion, milestoneCount, totalPoints, periodEndYm }
 */
function msRev_executeFix_(session) {
  var projectId = session.projectId;
  var planCycleId = session.planCycleId;
  var currentVersion = session.currentVersion;
  var newVersion = currentVersion + 1;
  var revisionYm = session.revisionYm;
  var nowStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy年M月d日 HH:mm");

  // --- 1. 期間変更の反映 ---
  var periodChange = session.periodChange;
  var cycle = valuePlan_repo_getPlanCycle(planCycleId);
  if (!cycle) return { ok: false, message: "planCycle not found: " + planCycleId };

  var newEndYm = periodChange
    ? String(periodChange.newEndYm || cycle.periodEndYm || "")
    : String(cycle.periodEndYm || "");
  var newTotalPoints = periodChange
    ? Number(periodChange.newTotalPoints || cycle.totalPoints || 0)
    : Number(cycle.totalPoints || 0);

  // --- 2. frozenMs + revisedMs を結合 ---
  var allNewMs = [];

  // frozen: milestoneIdを維持して新versionに書き込む（進捗・背負い度そのまま使える）
  for (var i = 0; i < session.frozenMs.length; i++) {
    var fm = session.frozenMs[i];
    allNewMs.push({
      milestoneId: String(fm.milestoneId || ""),  // ★旧IDを維持
      title: String(fm.title || ""),
      points: Number(fm.points || 0),
      tag: String(fm.tag || "normal"),
      successCriteria: String(fm.successCriteria || ""),
      rationale: String(fm.rationale || ""),
      targetYm: String(fm.targetYm || ""),
      goalLevel: String(fm.goalLevel || "annual"),
      originMsId: String(fm.milestoneId || "")
    });
  }

  // revised: 新milestoneId生成（milestoneId空渡し）
  for (var i = 0; i < session.revisedMs.length; i++) {
    var rm = session.revisedMs[i];
    allNewMs.push({
      milestoneId: "",  // 新規生成
      title: String(rm.title || ""),
      points: Number(rm.points || 0),
      tag: String(rm.tag || "normal"),
      successCriteria: String(rm.successCriteria || ""),
      rationale: String(rm.rationale || ""),
      targetYm: String(rm.targetYm || ""),
      goalLevel: String(rm.goalLevel || "annual"),
      originMsId: String(rm.originMsId || "")
    });
  }

  // --- pt合計チェック ---
  var actualPtSum = 0;
  for (var i = 0; i < allNewMs.length; i++) actualPtSum += Number(allNewMs[i].points || 0);
  if (actualPtSum !== newTotalPoints) {
    Logger.log("WARNING: pt mismatch. expected=" + newTotalPoints + " actual=" + actualPtSum + ". Proceeding anyway.");
  }

  // --- 3. 旧version全MSをisActive=false → 新version書き込み ---
  msRev_deactivateAllMs_(planCycleId);
  var newMsIds = valuePlan_repo_writeMilestonesForVersion(planCycleId, newVersion, allNewMs);

  // --- 4. planCycle更新 ---
  valuePlan_repo_upsertPlanCycle({
    planCycleId: planCycleId,
    projectId: projectId,
    periodStartYm: String(cycle.periodStartYm || ""),
    periodEndYm: newEndYm,
    budgetYen: Number(cycle.budgetYen || 0),
    totalPoints: newTotalPoints,
    status: "fixed",
    fixedVersion: newVersion,
    fixedAt: nowStr,
    fixedBy: "ms_revision",
    updatedAt: nowStr
  });

  // --- 5. サブMS書き込み（revisedMSのみ。frozenMSはDB既存を維持） ---
  try {
    var revisedStartIdx = session.frozenMs.length;
    for (var si = 0; si < session.revisedMs.length; si++) {
      var rm = session.revisedMs[si];
      var subs = rm.subMilestones || [];
      if (!subs.length) continue;
      var newMsId = newMsIds[revisedStartIdx + si];
      if (!newMsId) continue;
      var subItems = [];
      for (var sj = 0; sj < subs.length; sj++) {
        subItems.push({
          title: String(subs[sj].title || ""),
          targetYm: String(subs[sj].targetYm || ""),
          isDone: false
        });
      }
      subItem_bulkSave(newMsId, subItems);
    }
  } catch (e) {
    Logger.log("msRev_executeFix_: subItem save error: " + e.message);
  }

  // --- 5b. revisedMSの責任配分を旧MSからコピー + サブMSにも適用 ---
  try {
    var oldAllResps = rv2_readResponsibilityForPlanCycle(planCycleId);
    for (var ri = 0; ri < session.revisedMs.length; ri++) {
      var rm = session.revisedMs[ri];
      var originId = String(rm.originMsId || "").trim();
      if (!originId) continue;

      var newMsId = newMsIds[session.frozenMs.length + ri];
      if (!newMsId) continue;

      // 旧MSのコミットスコアを抽出
      var msResps = [];
      for (var or2 = 0; or2 < oldAllResps.length; or2++) {
        if (String(oldAllResps[or2].milestoneKey || "").trim() === originId) {
          msResps.push(oldAllResps[or2]);
        }
      }
      if (msResps.length === 0) continue;

      // 新MSに同じshareをコピー
      for (var mr = 0; mr < msResps.length; mr++) {
        try {
          rv2_upsertResponsibility({
            projectId: projectId,
            planCycleId: planCycleId,
            milestoneKey: newMsId,
            ym: "",
            memberId: String(msResps[mr].memberId || "").trim(),
            share: Number(msResps[mr].share || 0),
            source: "ms_revision_copy",
            updatedAtJst: nowStr
          });
        } catch (e) {}
      }

      // サブMSにも同じshareを適用
      var subs = rm.subMilestones || [];
      if (subs.length > 0) {
        var savedSubs = subItem_listByMilestoneIds([newMsId]);
        for (var si2 = 0; si2 < savedSubs.length; si2++) {
          var subId = String(savedSubs[si2].subItemId || "").trim();
          if (!subId) continue;
          var entries = [];
          for (var mr2 = 0; mr2 < msResps.length; mr2++) {
            entries.push({
              memberId: String(msResps[mr2].memberId || "").trim(),
              share: Number(msResps[mr2].share || 0)
            });
          }
          subItemResp_bulkSave(subId, entries);
        }
      }
    }
  } catch (e) {
    Logger.log("msRev_executeFix_: responsibility copy error: " + e.message);
  }

  // --- 6. 背負い度コピー（frozenMSのみ。IDが維持されるので不要だが安全策） ---

  // --- 7. RevisionLog追記 ---
  valuePlan_repo_appendRevisionLog({
    planCycleId: planCycleId,
    fromVersion: currentVersion,
    toVersion: newVersion,
    reason: msRev_extractReason_(session),
    changedBy: "ms_revision_modal",
    changedAt: nowStr,
    revisionYm: revisionYm,
    mappingJson: JSON.stringify(session.mapping || [])
  });

  return {
    ok: true,
    planCycleId: planCycleId,
    newVersion: newVersion,
    milestoneCount: allNewMs.length,
    totalPoints: newTotalPoints,
    periodEndYm: newEndYm
  };
}

// ================================================================
// 内部ヘルパー
// ================================================================

/** チャット履歴からreasonを抽出（最初のユーザー指示を要約として使う） */
function msRev_extractReason_(session) {
  var history = session.chatHistory || [];
  for (var i = 0; i < history.length; i++) {
    if (history[i].role === "user") {
      var text = String(history[i].content || "").trim();
      return text.substring(0, 200);
    }
  }
  return "manual revision";
}

/** planCycleIdの全active MSをisActive=falseにする */
function msRev_deactivateAllMs_(planCycleId) {
  var sh = valuePlan_repo_getMilestoneSheet();
  var all = sh.getDataRange().getValues();
  var header = all[0] || [];
  var idx = {};
  for (var c = 0; c < header.length; c++) {
    var k = String(header[c] || "").trim();
    if (k) idx[k] = c;
  }

  var cid = String(planCycleId || "").trim();
  for (var r = 1; r < all.length; r++) {
    if (String(all[r][idx.planCycleId] || "").trim() !== cid) continue;
    var isActive = all[r][idx.isActive];
    if (isActive === true || String(isActive || "") === "true") {
      sh.getRange(r + 1, idx.isActive + 1).setValue(false);
    }
  }
}