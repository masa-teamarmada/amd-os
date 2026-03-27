/**
 * 070_SubItemApi.gs
 * サブ項目（Sub-Item）のAPI入口。
 * コックピット画面（225_ProjectCockpit.html）から google.script.run で呼ばれる。
 *
 * 依存:
 *   - 069_SubItemRepo.gs
 *   - 086_ValuePlanRepo.gs（DB_ValueMilestones読み取り）
 *   - B_Sheets.gs（b_readTable_）
 */

/* ====== サブ項目 取得 ====== */

/**
 * 指定PJの全MS＋サブ項目＋担当を一括返却
 * @param {Object} params - { projectId }
 * @return {Object} { ok, milestones: [{ milestoneId, title, subItems: [{ subItemId, title, startYm, targetYm, isDone, responsibilities }] }] }
 */
function cockpit_api_getSubItems(params) {
  try {
    var projectId = String(params.projectId || '');
    if (!projectId) return { ok: false, message: 'projectId必須' };

    // このPJのMS一覧を取得
    var allMs = subItem_readNavTable_('DB_ValueMilestones');
    var cycles = subItem_readNavTable_('DB_ValuePlanCycles');

    // アクティブなplanCycleIdを特定
    var activeCycleId = '';
    for (var c = 0; c < cycles.length; c++) {
      if (String(cycles[c].projectId) === projectId &&
          String(cycles[c].status) === 'fixed') {
        activeCycleId = String(cycles[c].planCycleId);
        break;
      }
    }
    if (!activeCycleId) return JSON.parse(JSON.stringify({ ok: true, milestones: [] }));

    // MSフィルタ
    var msIds = [];
    var msMap = {};
    for (var i = 0; i < allMs.length; i++) {
      var ms = allMs[i];
      if (String(ms.planCycleId) !== activeCycleId) continue;
      if (ms.isActive === false || ms.isActive === 'FALSE') continue;
      var msId = String(ms.milestoneId || ms.milestoneKey || '');
      if (!msId) continue;
      msIds.push(msId);
      msMap[msId] = {
        milestoneId: msId,
        title: String(ms.title || ''),
        orderNo: Number(ms.orderNo) || 0,
        points: Number(ms.points || ms.maxPt || 0),
        targetYm: String(ms.targetYm || ''),
        tag: String(ms.tag || ''),
        subItems: []
      };
    }

    if (msIds.length === 0) return JSON.parse(JSON.stringify({ ok: true, milestones: [] }));

    // サブ項目取得
    var subs = subItem_listByMilestoneIds(msIds);
    var subIds = [];
    for (var j = 0; j < subs.length; j++) {
      subIds.push(subs[j].subItemId);
    }

    // 担当配分取得
    var resps = subIds.length > 0 ? subItemResp_listBySubItemIds(subIds) : [];
    var respMap = {};
    for (var k = 0; k < resps.length; k++) {
      var r = resps[k];
      if (!respMap[r.subItemId]) respMap[r.subItemId] = [];
      respMap[r.subItemId].push({ memberId: r.memberId, share: Number(r.share) || 0 });
    }

    // サブ項目をMS単位でまとめる
    for (var s = 0; s < subs.length; s++) {
      var sub = subs[s];
      if (!msMap[sub.milestoneId]) continue;
      msMap[sub.milestoneId].subItems.push({
        subItemId: sub.subItemId,
        orderNo: Number(sub.orderNo) || 0,
        title: String(sub.title || ''),
        startYm: String(sub.startYm || ''),
        targetYm: String(sub.targetYm || ''),
        isDone: sub.isDone === true || sub.isDone === 'TRUE',
        doneAt: String(sub.doneAt || ''),
        responsibilities: respMap[sub.subItemId] || []
      });
    }

    // orderNo順でソート
    var result = [];
    for (var id in msMap) {
      result.push(msMap[id]);
    }
    result.sort(function(a, b) { return a.orderNo - b.orderNo; });

    return JSON.parse(JSON.stringify({ ok: true, milestones: result }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== サブ項目 一括保存 ====== */

/**
 * MS単位でサブ項目を一括保存
 * @param {Object} params - { milestoneId, items: [{ subItemId?, title, startYm?, targetYm?, isDone? }] }
 */
function cockpit_api_saveSubItems(params) {
  try {
    var milestoneId = String(params.milestoneId || '');
    if (!milestoneId) return { ok: false, message: 'milestoneId必須' };
    var items = params.items || [];

    subItem_ensureHeaders();
    var saved = subItem_bulkSave(milestoneId, items);

    return JSON.parse(JSON.stringify({ ok: true, saved: saved }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== サブ項目 完了トグル ====== */

/**
 * サブ項目の完了状態を切り替え
 * @param {Object} params - { subItemId, isDone }
 */
function cockpit_api_toggleSubItemDone(params) {
  try {
    var subItemId = String(params.subItemId || '');
    if (!subItemId) return { ok: false, message: 'subItemId必須' };

    // 現在の行を読み取り
    var rows = subItem_readNavTable_('DB_MilestoneSubItems');
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].subItemId) === subItemId) { target = rows[i]; break; }
    }
    if (!target) return { ok: false, message: '該当なし' };

    target.isDone = (params.isDone === true || params.isDone === 'TRUE');
    target.doneAt = target.isDone ? subItem_jstNow_() : '';
    target.updatedAt = subItem_jstNow_();
    b_upsertRow_('DB_MilestoneSubItems', 'subItemId', subItemId, target);

    return JSON.parse(JSON.stringify({ ok: true, item: target }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== サブ項目 担当配分保存 ====== */

/**
 * サブ項目ごとの担当配分を保存
 * @param {Object} params - { subItemId, entries: [{ memberId, share }] }
 */
function cockpit_api_saveSubItemResponsibility(params) {
  try {
    var subItemId = String(params.subItemId || '');
    if (!subItemId) return { ok: false, message: 'subItemId必須' };
    var entries = params.entries || [];

    subItem_ensureHeaders();
    subItemResp_bulkSave(subItemId, entries);

    return JSON.parse(JSON.stringify({ ok: true }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/**
 * 複数サブ項目の担当配分を一括保存
 * @param {Object} params - { assignments: [{ subItemId, entries: [{ memberId, share }] }] }
 */
function cockpit_api_bulkSaveSubItemResponsibilities(params) {
  try {
    var assignments = params.assignments || [];
    if (assignments.length === 0) return { ok: false, message: 'assignments空' };

    subItem_ensureHeaders();
    for (var i = 0; i < assignments.length; i++) {
      var a = assignments[i];
      subItemResp_bulkSave(String(a.subItemId), a.entries || []);
    }

    return JSON.parse(JSON.stringify({ ok: true, count: assignments.length }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== PJメンバー一覧（UI用） ====== */

/**
 * PJのメンバー一覧を返す（担当設定UIのドロップダウン用）
 * @param {Object} params - { projectId }
 */
function cockpit_api_getProjectMembersForSubItems(params) {
  try {
    var projectId = String(params.projectId || '');
    if (!projectId) return { ok: false, message: 'projectId必須' };

    var pmRows = b_readTable_('DB_ProjectMembers');
    var mbRows = b_readTable_('DB_Members');

    // メンバーマスタをindex化
    var mbMap = {};
    for (var i = 0; i < mbRows.length; i++) {
      mbMap[mbRows[i].memberId] = mbRows[i];
    }

    var members = [];
    for (var j = 0; j < pmRows.length; j++) {
      var pm = pmRows[j];
      if (String(pm.projectId) !== projectId) continue;
      if (pm.isActive === false || pm.isActive === 'FALSE') continue;
      var mb = mbMap[pm.memberId] || {};
      members.push({
        memberId: String(pm.memberId),
        codeName: String(mb.codeName || mb.displayName || pm.memberId),
        roleLabel: String(pm.roleLabel || '')
      });
    }

    return JSON.parse(JSON.stringify({ ok: true, members: members }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== 全MS一括保存 ====== */

/**
 * 全MSのサブ項目を一括保存
 * @param {Object} params - { milestoneItems: [{ milestoneId, items: [{ subItemId?, title, startYm?, targetYm?, isDone? }] }] }
 */
function cockpit_api_saveAllSubItems(params) {
  var projectId = String((params || {}).projectId || "").trim();
  try {
    var milestoneItems = params.milestoneItems || [];
    if (milestoneItems.length === 0) return JSON.parse(JSON.stringify({ ok: true, count: 0, savedMap: {} }));

    subItem_ensureHeaders();
    var totalSaved = 0;
    var savedMap = {};
    for (var i = 0; i < milestoneItems.length; i++) {
      var mi = milestoneItems[i];
      var msId = String(mi.milestoneId || '');
      if (!msId) continue;
      var saved = subItem_bulkSave(msId, mi.items || []);
      savedMap[msId] = saved;
      totalSaved += saved.length;
    }
    if (projectId) {
      try {
        var sheet = b_ss_().getSheetByName('DB_BillingCycle');
        if (sheet && sheet.getLastRow() >= 2) {
          var lastCol = sheet.getLastColumn();
          var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
          var jsonIdx = headers.indexOf('rewardSummaryJson');
          var pidIdx = headers.indexOf('projectId');
          if (jsonIdx >= 0 && pidIdx >= 0) {
            var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
            for (var r = 0; r < data.length; r++) {
              if (String(data[r][pidIdx]).trim() === projectId) {
                sheet.getRange(r + 2, jsonIdx + 1).setValue('');
              }
            }
          }
        }
      } catch(e) {}
    }
    if (projectId) {
      try {
        cockpit_clearRewardSummaryCache_(projectId, null);
      } catch(e) {}
    }
    return JSON.parse(JSON.stringify({ ok: true, count: totalSaved, savedMap: savedMap }));
  } catch (e) {
    return { ok: false, message: String(e) };
  }
}

/* ====== テスト用ラッパー ====== */

function test_cockpit_api_getSubItems() {
  // projectId を適宜変更
  var res = cockpit_api_getSubItems({ projectId: 'p09' });
  Logger.log(JSON.stringify(res, null, 2));
}

function test_cockpit_api_toggleSubItemDone() {
  var res = cockpit_api_toggleSubItemDone({ subItemId: 'sub_test001', isDone: true });
  Logger.log(JSON.stringify(res));
}