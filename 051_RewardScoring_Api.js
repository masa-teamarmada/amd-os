/** 051_RewardScoring_Api.gs
 * 報酬スコアリングのAPIエントリポイント
 * UIから呼ばれる公開関数を集約
 */

/** 進捗イベント抽出（LLM）を実行 */
function reward_api_extractEvents(payload) {
  return reward_extractEvents(payload);
}

/** 指定PJ×ymの進捗イベント一覧＋responsibility付きで返す */
function reward_api_getEventsWithResponsibility(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId and ym required" };

  var events = reward_repo_listEvents_(projectId, ym);
  if (!events.length) return { ok: true, events: [], message: "イベントなし" };

  var eventIds = events.map(function(e) { return e.eventId; });
  var allResp = reward_repo_listResponsibilities_(eventIds);

  // eventIdでグルーピング
  var respMap = {};
  allResp.forEach(function(r) {
    if (!respMap[r.eventId]) respMap[r.eventId] = [];
    respMap[r.eventId].push(r);
  });

  var result = events.map(function(e) {
    e.responsibilities = respMap[e.eventId] || [];
    return e;
  });

  return { ok: true, events: result };
}

/** イベントのステータスを確定に変更 */
function reward_api_confirmEvent(payload) {
  payload = payload || {};
  var eventId = String(payload.eventId || "").trim();
  var memberId = String(payload.memberId || "").trim();
  if (!eventId) return { ok: false, message: "eventId required" };

  var updated = reward_repo_updateEventStatus_(eventId, "confirmed", memberId);
  return { ok: updated, message: updated ? "confirmed" : "event not found" };
}

/** イベントのimpact/depth/responsibilityをPMが修正 */
function reward_api_updateEventScores(payload) {
  payload = payload || {};
  var eventId = String(payload.eventId || "").trim();
  if (!eventId) return { ok: false, message: "eventId required" };

  // イベント本体の更新
  if (payload.impact !== undefined || payload.depth !== undefined) {
    var sh = reward_repo_getSheet_("DB_ProgressEvents");
    var header = reward_repo_headerMap_(sh);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { ok: false, message: "event not found" };

    var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    var found = false;
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][header.eventId - 1] || "").trim() === eventId) {
        var rowIdx = i + 2;
        if (payload.impact !== undefined) {
          sh.getRange(rowIdx, header.impact).setValue(Number(payload.impact));
        }
        if (payload.depth !== undefined) {
          sh.getRange(rowIdx, header.depth).setValue(Number(payload.depth));
        }
        found = true;
        break;
      }
    }
    if (!found) return { ok: false, message: "event not found" };
  }

  // responsibility の更新（配列で渡す）
  if (Array.isArray(payload.responsibilities)) {
    var shR = reward_repo_getSheet_("DB_EventResponsibility");
    var hR = reward_repo_headerMap_(shR);
    var lastRowR = shR.getLastRow();

    if (lastRowR >= 2) {
      var valsR = shR.getRange(2, 1, lastRowR - 1, shR.getLastColumn()).getValues();
      payload.responsibilities.forEach(function(update) {
        var targetMid = String(update.memberId || "").trim();
        for (var j = 0; j < valsR.length; j++) {
          if (String(valsR[j][hR.eventId - 1] || "").trim() === eventId &&
              String(valsR[j][hR.memberId - 1] || "").trim() === targetMid) {
            var rIdx = j + 2;
            if (update.responsibility !== undefined) {
              shR.getRange(rIdx, hR.responsibility).setValue(Number(update.responsibility));
            }
            break;
          }
        }
      });
    }
  }

  return { ok: true };
}

/** 月次スコア計算を実行してDB_MonthlyRewardPayoutに書き込み */
function reward_api_calculateMonthlyScore(payload) {
  return reward_ops_calculateAndSave(payload);
}

/** 月次配分結果を取得 */
function reward_api_getMonthlyPayout(payload) {
  payload = payload || {};
  var projectId = String(payload.projectId || "").trim();
  var ym = String(payload.ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId and ym required" };

  var payouts = reward_repo_listPayouts_(projectId, ym);
  return { ok: true, payouts: payouts };
}

/** イベントをreject（スコープ外等） */
function reward_api_rejectEvent(payload) {
  payload = payload || {};
  var eventId = String(payload.eventId || "").trim();
  var reason = String(payload.reason || "").trim();
  if (!eventId) return { ok: false, message: "eventId required" };

  var sh = reward_repo_getSheet_("DB_ProgressEvents");
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, message: "event not found" };

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][header.eventId - 1] || "").trim() === eventId) {
      var rowIdx = i + 2;
      sh.getRange(rowIdx, header.status).setValue("rejected");
      if (reason && header.rejectReason) {
        sh.getRange(rowIdx, header.rejectReason).setValue(reason);
      }
      return { ok: true };
    }
  }
  return { ok: false, message: "event not found" };
}