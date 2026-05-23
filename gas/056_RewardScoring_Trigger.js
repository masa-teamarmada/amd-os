/** 056_RewardScoring_Trigger.gs
 * 報酬スコアリング用の日次トリガー。
 * 毎日3:00 JST に、過去24hで報告書が更新されたPJ×ymの進捗イベントをLLM抽出する。
 * 同PJ×ymの既存draftイベント＋責任分担は削除して再抽出（confirmed/rejectedは保持）。
 */

var REWARD_SCORING_DAILY_CRON_DISABLED_20260522 = true;

// ===== トリガー本体 =====

/**
 * 日次バッチ：過去24hで更新があった月次報告書から進捗イベントを差分抽出
 */
function reward_trigger_dailyExtract() {
  if (REWARD_SCORING_DAILY_CRON_DISABLED_20260522) {
    return { ok: true, disabled: true, message: "Reward scoring daily extraction cron disabled. Use Codex automation/review batches." };
  }
  var startTime = new Date();
  var log = [];

  try {
    // 1) 過去24hで更新された報告書を取得
    var cutoff = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    var targets = reward_trigger_getUpdatedReports_(cutoff);

    if (!targets.length) {
      reward_trigger_log_("過去24hで更新された報告書なし", log);
      reward_trigger_saveLog_(log, startTime);
      return;
    }

    // アクティブPJだけに絞る
    var activePids = reward_trigger_getActivePidSet_();
    targets = targets.filter(function(t) { return activePids[t.projectId]; });

    if (!targets.length) {
      reward_trigger_log_("更新ありだがアクティブPJ対象なし", log);
      reward_trigger_saveLog_(log, startTime);
      return;
    }

    reward_trigger_log_("差分抽出対象: " + targets.length + "件", log);

    // 2) 1件ずつ処理（5件/回、4分タイムアウト）
    var MAX_PER_RUN = 5;
    var processed = 0;

    for (var i = 0; i < targets.length && processed < MAX_PER_RUN; i++) {
      var t = targets[i];

      var elapsed = (new Date().getTime() - startTime.getTime()) / 1000;
      if (elapsed > 240) {
        reward_trigger_log_("時間制限により中断（" + processed + "/" + targets.length + "件処理）", log);
        break;
      }

      try {
        reward_trigger_log_("処理開始: " + t.projectId + " / " + t.ym + "（更新: " + t.lastFixedAtJst + "）", log);

        // 2a) 既存draftイベント＋その責任分担を削除
        var deleted = reward_trigger_deleteDraftEvents_(t.projectId, t.ym);
        reward_trigger_log_("  → draft削除: " + deleted.events + "イベント, " + deleted.responsibilities + "責任分担", log);

        // 2b) 再抽出
        var result = reward_extractEvents({ projectId: t.projectId, ym: t.ym });

        if (result.ok) {
          reward_trigger_log_("  → 抽出成功: " + (result.eventCount || 0) + "イベント, " + (result.responsibilityCount || 0) + "責任分担", log);
        } else {
          reward_trigger_log_("  → スキップ: " + (result.message || "不明"), log);
        }
        processed++;
      } catch (e) {
        reward_trigger_log_("  → エラー: " + String(e), log);
        processed++;
      }

      Utilities.sleep(1000);
    }

    reward_trigger_log_("完了: " + processed + "件処理", log);

  } catch (e) {
    reward_trigger_log_("致命的エラー: " + String(e), log);
  }

  reward_trigger_saveLog_(log, startTime);
}

// ===== トリガー設置・解除 =====

function reward_trigger_install() {
  if (REWARD_SCORING_DAILY_CRON_DISABLED_20260522) return reward_trigger_uninstall();
  reward_trigger_uninstall();
  ScriptApp.newTrigger("reward_trigger_dailyExtract")
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .inTimezone("Asia/Tokyo")
    .create();
  Logger.log("トリガー設置完了: reward_trigger_dailyExtract / 毎日4:00 JST");
}

function reward_trigger_uninstall() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "reward_trigger_dailyExtract") {
      ScriptApp.deleteTrigger(t);
      Logger.log("既存トリガー削除: reward_trigger_dailyExtract");
    }
  });
}

// ===== 内部関数 =====

/** 過去24hで lastFixedAtJst が更新された報告書を返す */
function reward_trigger_getUpdatedReports_(cutoff) {
  var results = [];
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_MonthlyReports");
  if (!sh) return results;
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return results;

  var colFixed = header.lastFixedAtJst;
  if (!colFixed) return results;

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var fixedRaw = values[i][colFixed - 1];
    if (!fixedRaw) continue;

    var fixedDate = (fixedRaw instanceof Date) ? fixedRaw : new Date(String(fixedRaw));
    if (isNaN(fixedDate.getTime())) continue;
    if (fixedDate.getTime() < cutoff.getTime()) continue;

    var pid = String(values[i][header.projectId - 1] || "").trim();
    var ym = String(values[i][header.ym - 1] || "").trim();
    if (!pid || !ym) continue;

    // 報告書本文があるかチェック
    var content = "";
    if (header.finalContent) content = String(values[i][header.finalContent - 1] || "").trim();
    if (!content && header.draftContent) content = String(values[i][header.draftContent - 1] || "").trim();
    if (!content) continue;

    results.push({
      projectId: pid,
      ym: ym,
      lastFixedAtJst: Utilities.formatDate(fixedDate, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss")
    });
  }
  return results;
}

/** アクティブPJのprojectIdセットを返す */
function reward_trigger_getActivePidSet_() {
  var set = {};
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_Projects");
  if (!sh) return set;
  var header = reward_repo_headerMap_(sh);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return set;

  var values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var status = String(values[i][header.status - 1] || "").trim().toLowerCase();
    if (status === "active") {
      var pid = String(values[i][header.projectId - 1] || "").trim();
      if (pid) set[pid] = true;
    }
  }
  return set;
}

/**
 * 指定PJ×ymのdraftイベントとその責任分担を削除
 * confirmed / rejected は保持
 * @return {{ events: number, responsibilities: number }}
 */
function reward_trigger_deleteDraftEvents_(projectId, ym) {
  var deletedEvents = 0;
  var deletedResp = 0;

  // 1) DB_ProgressEvents から draftイベントのeventIdを収集＋行削除
  var shE = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_ProgressEvents");
  if (!shE) return { events: 0, responsibilities: 0 };
  var hE = reward_repo_headerMap_(shE);
  var lastRowE = shE.getLastRow();

  var draftEventIds = {};
  var deleteRowsE = [];

  if (lastRowE >= 2) {
    var valsE = shE.getRange(2, 1, lastRowE - 1, shE.getLastColumn()).getValues();
    for (var i = 0; i < valsE.length; i++) {
      var pid = String(valsE[i][hE.projectId - 1] || "").trim();
      var eym = String(valsE[i][hE.ym - 1] || "").trim();
      var st = String(valsE[i][hE.status - 1] || "").trim().toLowerCase();
      if (pid === projectId && eym === ym && st === "draft") {
        var eid = String(valsE[i][hE.eventId - 1] || "").trim();
        draftEventIds[eid] = true;
        deleteRowsE.push(i + 2); // 1-indexed行番号
      }
    }
  }

  // 下から削除（行ズレ防止）
  deleteRowsE.sort(function(a, b) { return b - a; });
  deleteRowsE.forEach(function(r) {
    shE.deleteRow(r);
    deletedEvents++;
  });

  // 2) DB_EventResponsibility から該当eventIdの行を削除
  if (Object.keys(draftEventIds).length > 0) {
    var shR = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_EventResponsibility");
    if (shR) {
      var hR = reward_repo_headerMap_(shR);
      var lastRowR = shR.getLastRow();
      if (lastRowR >= 2) {
        var valsR = shR.getRange(2, 1, lastRowR - 1, shR.getLastColumn()).getValues();
        var deleteRowsR = [];
        for (var j = 0; j < valsR.length; j++) {
          var eid2 = String(valsR[j][hR.eventId - 1] || "").trim();
          if (draftEventIds[eid2]) {
            deleteRowsR.push(j + 2);
          }
        }
        deleteRowsR.sort(function(a, b) { return b - a; });
        deleteRowsR.forEach(function(r) {
          shR.deleteRow(r);
          deletedResp++;
        });
      }
    }
  }

  return { events: deletedEvents, responsibilities: deletedResp };
}

// ===== ログ =====

function reward_trigger_log_(msg, logArr) {
  var ts = Utilities.formatDate(new Date(), "Asia/Tokyo", "HH:mm:ss");
  var line = "[" + ts + "] " + msg;
  logArr.push(line);
  Logger.log(line);
}

function reward_trigger_saveLog_(logArr, startTime) {
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DB_AdminActionLog");
    if (!sh) return;
    var header = reward_repo_headerMap_(sh);
    var now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    var elapsed = Math.round((new Date().getTime() - startTime.getTime()) / 1000);

    var row = [];
    for (var c = 0; c < sh.getLastColumn(); c++) row[c] = "";

    if (header.id) row[header.id - 1] = Utilities.getUuid();
    if (header.actionType) row[header.actionType - 1] = "reward_trigger_dailyExtract";
    if (header.actionDetail) row[header.actionDetail - 1] = logArr.join("\n");
    if (header.executedAt || header.createdAtJst) {
      row[(header.executedAt || header.createdAtJst) - 1] = now;
    }
    if (header.executedBy) row[header.executedBy - 1] = "system_trigger";
    if (header.note) row[header.note - 1] = "elapsed: " + elapsed + "s";

    sh.appendRow(row);
  } catch (e) {
    Logger.log("ログ保存失敗: " + e);
  }
}

/** テスト用ラッパー（手動実行ボタンで叩く） */
function TEST_reward_trigger_dailyExtract() {
  reward_trigger_dailyExtract();
}
