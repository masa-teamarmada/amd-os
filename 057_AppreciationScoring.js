/** 057_AppreciationScoring.gs
 * Appreciation（感謝）スコアの算出。
 * PJのSlackチャンネルから感謝シグナルを集計し、メンバーごとのraw→正規化スコアを返す。
 */

/**
 * 指定PJ×ymのAppreciationスコアを算出
 * @param {string} projectId
 * @param {string} ym yyyymm
 * @return {Object} { ok, scores: [{ memberId, rawScore, bonusRatio }] }
 */
function appreciation_calculate(projectId, ym) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !ym) return { ok: false, message: "projectId and ym required" };

  // PJのSlackチャンネルID取得
  var channelId = appreciation_getChannelId_(projectId);
  if (!channelId) return { ok: true, scores: [], message: "slackChannelId not found" };

  // PJメンバー一覧
  var members = appreciation_getProjectMembers_(projectId);
  if (!members.length) return { ok: true, scores: [], message: "no members" };

  // ym → 期間（月初〜月末）のUNIXタイムスタンプ
  var year = Number(ym.substring(0, 4));
  var month = Number(ym.substring(4, 6));
  var start = new Date(year, month - 1, 1, 0, 0, 0);
  var end = new Date(year, month, 1, 0, 0, 0); // 翌月1日
  var oldest = String(Math.floor(start.getTime() / 1000));
  var latest = String(Math.floor(end.getTime() / 1000));

  // Slack履歴取得
  var messages = appreciation_fetchMessages_(channelId, oldest, latest);

  // memberIdとslackUserIdの対応
  var memberSlackMap = {};  // slackUserId -> memberId
  var memberIdSet = {};
  members.forEach(function(m) {
    if (m.slackId) memberSlackMap[m.slackId] = m.memberId;
    memberIdSet[m.memberId] = true;
  });

  // 各メンバーのraw appreciation集計（ベース1.0）
  var rawScores = {};
  members.forEach(function(m) {
    rawScores[m.memberId] = 1.0;
  });

  // スタンプ判定ルール
  var STAMP_RULES = {
    "神": 1.0,
    "kami": 1.0,
    "arigatou": 0.5,
    "pray": 0.5,
    "bow": 0.5,
    "person_bowing": 0.5,
    "nice": 0.5,
    "thumbsup": 0.1,
    "+1": 0.1
  };

  // お礼メッセージ判定パターン
  var THANKS_PATTERNS = [
    /ありがと/,
    /助かり/,
    /感謝/,
    /さすが/,
    /ナイス/,
    /nice/i,
    /thx/i,
    /thanks/i
  ];

  messages.forEach(function(msg) {
    var msgUserId = String(msg.user || "").trim();

    // --- リアクション（スタンプ）集計 ---
    var reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
    reactions.forEach(function(reaction) {
      var name = String(reaction.name || "").trim().toLowerCase();
      var score = 0;

      // 完全一致
      if (STAMP_RULES[name] !== undefined) {
        score = STAMP_RULES[name];
      } else {
        // 部分一致（「神」を含むカスタムスタンプ等）
        var keys = Object.keys(STAMP_RULES);
        for (var k = 0; k < keys.length; k++) {
          if (name.indexOf(keys[k]) >= 0) {
            score = STAMP_RULES[keys[k]];
            break;
          }
        }
      }

      if (score > 0) {
        // リアクションの対象 = メッセージ投稿者
        var targetMemberId = memberSlackMap[msgUserId];
        if (targetMemberId && rawScores[targetMemberId] !== undefined) {
          // リアクションした人たち
          var reactUsers = Array.isArray(reaction.users) ? reaction.users : [];
          reactUsers.forEach(function(reactUserId) {
            // 自分へのスタンプは除外
            if (reactUserId === msgUserId) return;
            // リアクションした人がPJメンバーかは問わない（クライアントからのスタンプも有効）
            rawScores[targetMemberId] += score;
          });
        }
      }
    });

    // --- お礼メッセージ判定 ---
    var text = String(msg.text || "").trim();
    if (text && msgUserId) {
      var isThanks = THANKS_PATTERNS.some(function(pat) { return pat.test(text); });
      if (isThanks) {
        // メンションされた人に1.0加算
        var mentionPattern = /<@(U[A-Z0-9]+)>/g;
        var match;
        while ((match = mentionPattern.exec(text)) !== null) {
          var mentionedSlackId = match[1];
          if (mentionedSlackId === msgUserId) continue; // 自分メンション除外
          var mentionedMemberId = memberSlackMap[mentionedSlackId];
          if (mentionedMemberId && rawScores[mentionedMemberId] !== undefined) {
            rawScores[mentionedMemberId] += 1.0;
          }
        }
      }
    }
  });

  // ボーナス算出（raw - 1.0 = 加算分）
  var totalBonus = 0;
  var bonusRaw = {};
  Object.keys(rawScores).forEach(function(mid) {
    var b = Math.max(0, rawScores[mid] - 1.0);
    bonusRaw[mid] = b;
    totalBonus += b;
  });

  // bonusRatio: 各メンバーがappreciation枠のうち何%をもらうか
  var scores = members.map(function(m) {
    var mid = m.memberId;
    return {
      memberId: mid,
      memberName: m.memberName || "",
      rawScore: rawScores[mid] || 1.0,
      bonusRaw: bonusRaw[mid] || 0,
      bonusRatio: totalBonus > 0 ? (bonusRaw[mid] || 0) / totalBonus : 0
    };
  });

  return { ok: true, scores: scores, totalBonus: totalBonus };
}

// --- 内部関数 ---

function appreciation_getChannelId_(projectId) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
  if (!sh) return null;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  var values = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();
  var head = values[0];
  var iPid = -1, iCh = -1;
  for (var c = 0; c < head.length; c++) {
    var h = String(head[c] || "").trim();
    if (h === "projectId") iPid = c;
    if (h === "slackChannelId") iCh = c;
  }
  if (iPid < 0 || iCh < 0) return null;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][iPid] || "").trim() === projectId) {
      return String(values[r][iCh] || "").trim() || null;
    }
  }
  return null;
}

function appreciation_getProjectMembers_(projectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var shPM = ss.getSheetByName("DB_ProjectMembers");
  var shM = ss.getSheetByName("DB_Members");
  if (!shPM || !shM) return [];

  // ProjectMembers からアクティブメンバーのmemberId取得
  var pmLast = shPM.getLastRow();
  if (pmLast < 2) return [];
  var pmVals = shPM.getRange(1, 1, pmLast, shPM.getLastColumn()).getValues();
  var pmHead = pmVals[0];
  var iPid = -1, iMid = -1, iActive = -1;
  for (var c = 0; c < pmHead.length; c++) {
    var h = String(pmHead[c] || "").trim();
    if (h === "projectId") iPid = c;
    if (h === "memberId") iMid = c;
    if (h === "isActive") iActive = c;
  }
  if (iPid < 0 || iMid < 0) return [];

  var memberIds = [];
  for (var r = 1; r < pmVals.length; r++) {
    if (String(pmVals[r][iPid] || "").trim() !== projectId) continue;
    if (iActive >= 0 && String(pmVals[r][iActive] || "").toUpperCase().trim() === "FALSE") continue;
    memberIds.push(String(pmVals[r][iMid] || "").trim());
  }

  // Members からslackId, memberName取得
  var mLast = shM.getLastRow();
  if (mLast < 2) return [];
  var mVals = shM.getRange(1, 1, mLast, shM.getLastColumn()).getValues();
  var mHead = mVals[0];
  var imId = -1, imName = -1, imSlack = -1;
  for (var c = 0; c < mHead.length; c++) {
    var h = String(mHead[c] || "").trim();
    if (h === "memberId") imId = c;
    if (h === "memberName") imName = c;
    if (h === "slackId") imSlack = c;
  }

  var result = [];
  for (var r = 1; r < mVals.length; r++) {
    var mid = String(mVals[r][imId] || "").trim();
    if (memberIds.indexOf(mid) < 0) continue;
    result.push({
      memberId: mid,
      memberName: imName >= 0 ? String(mVals[r][imName] || "").trim() : "",
      slackId: imSlack >= 0 ? String(mVals[r][imSlack] || "").trim() : ""
    });
  }
  return result;
}

function appreciation_fetchMessages_(channelId, oldest, latest) {
  var allMessages = [];
  var cursor = null;
  var maxPages = 10;

  for (var page = 0; page < maxPages; page++) {
    var params = {
      channel: channelId,
      oldest: oldest,
      latest: latest,
      limit: "200",
      inclusive: "true"
    };
    if (cursor) params.cursor = cursor;

    var res = slack_callApi("conversations.history", params);
    if (!res || !res.ok) break;

    var msgs = Array.isArray(res.messages) ? res.messages : [];
    allMessages = allMessages.concat(msgs);

    if (!res.has_more) break;
    cursor = res.response_metadata && res.response_metadata.next_cursor;
    if (!cursor) break;
  }

  return allMessages;
}