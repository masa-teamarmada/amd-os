/**
 * R321_CronSlackReport.gs
 * 役割：L1(SourceCache) / L2(MonthlyReport) cronの実行結果をSlackに投稿する
 *
 * 投稿先: C0ALN2KDVAR（つくよみBot経由）
 * 依存: R115_SlackNotify.gs（slackNotifyPostToChannelTsukuyomi_）
 */

var CRON_REPORT_CHANNEL_ = 'C0ALN2KDVAR';

// ================================================================
// L1 SourceCache 完了レポート
// ================================================================

/**
 * L1 cron完了後に呼ぶ。PJごと・ソースごとの件数サマリをSlackに投稿。
 *
 * @param {Object} stats - { notion: N, slack: N, gmail: N, gmeet: N, errors: N }
 * @param {Array} pjDetails - [{ projectId, projectName, notion, slack, gmail }]
 * @param {number} elapsedSec - 実行時間（秒）
 */
function cronReport_postL1Summary_(stats, pjDetails, elapsedSec) {
  try {
    var now = _cronReport_jstNow_();
    var lines = [];
    lines.push(':satellite: *L1 SourceCache 完了*（' + now + '）');
    lines.push('実行時間: ' + elapsedSec + '秒');
    lines.push('');

    // 全体サマリ
    var total = (stats.notion || 0) + (stats.slack || 0) + (stats.gmail || 0) + (stats.gmeet || 0);
    lines.push('*全体: ' + total + '件*  (Notion ' + (stats.notion || 0)
      + ' / Slack ' + (stats.slack || 0)
      + ' / Gmail ' + (stats.gmail || 0)
      + ' / GMeet ' + (stats.gmeet || 0) + ')');
    if (stats.errors > 0) {
      lines.push(':warning: エラー: ' + stats.errors + '件');
    }

    // PJごとの内訳
    if (pjDetails && pjDetails.length > 0) {
      lines.push('');
      lines.push('--- PJ別 ---');
      for (var i = 0; i < pjDetails.length; i++) {
        var pj = pjDetails[i];
        var pjTotal = (pj.notion || 0) + (pj.slack || 0) + (pj.gmail || 0);
        var hasErrors = pj.errors && pj.errors.length > 0;
        if (pjTotal === 0 && !hasErrors) continue;
        var name = pj.projectName || pj.projectId;
        var line = '`' + name + '`  N:' + (pj.notion || 0)
          + ' S:' + (pj.slack || 0) + ' G:' + (pj.gmail || 0);
        if (hasErrors) {
          line += '\n    :warning: ' + pj.errors.join('\n    :warning: ');
        }
        lines.push(line);
      }
    }

    // GMeetは PJ横断なので別枠
    if (stats.gmeet > 0) {
      lines.push('`GMeet(横断)` ' + stats.gmeet + '件');
    }

    slackNotifyPostToChannelTsukuyomi_(CRON_REPORT_CHANNEL_, {
      text: lines.join('\n')
    });
  } catch (e) {
    Logger.log('[cronReport_postL1Summary_] Slack投稿エラー: ' + e);
  }
}

// ================================================================
// L2 MonthlyReport 完了レポート
// ================================================================

/**
 * L2 cron完了後に呼ぶ。PJごとの処理結果をSlackに投稿。
 *
 * @param {string} currentYm - 対象年月（yyyymm）
 * @param {Array} results - [{ projectId, ym, status, deltaItems, error }]
 * @param {number} elapsedSec - 実行時間（秒）
 */
function cronReport_postL2Summary_(currentYm, results, elapsedSec) {
  try {
    var now = _cronReport_jstNow_();
    var lines = [];
    lines.push(':memo: *L2 月次報告書 完了*（' + now + '）');
    lines.push('対象月: ' + currentYm + '  実行時間: ' + elapsedSec + '秒');
    lines.push('');

    // ステータス集計
    var counts = {};
    for (var i = 0; i < results.length; i++) {
      var s = results[i].status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    }

    var summaryParts = [];
    var statusLabels = {
      generated: '新規生成',
      pending: '差分更新',
      no_delta: '差分なし',
      already_updated_today: '更新済skip',
      no_cycle: 'Cycle無skip',
      timeout: 'タイムアウト',
      gen_failed: '生成失敗',
      gen_error: '生成エラー',
      collect_error: '収集エラー',
      update_failed: '更新失敗',
      update_error: '更新エラー',
      cycle_error: 'Cycleエラー'
    };
    for (var key in counts) {
      var label = statusLabels[key] || key;
      summaryParts.push(label + ': ' + counts[key]);
    }
    lines.push('*' + summaryParts.join(' / ') + '*');

    // PJごとの詳細
    lines.push('');
    lines.push('--- PJ別 ---');
    for (var j = 0; j < results.length; j++) {
      var r = results[j];
      var icon = _cronReport_statusIcon_(r.status);
      var line = icon + ' `' + (r.projectId || '?') + '` ' + (statusLabels[r.status] || r.status);
      if (r.deltaItems) line += '（' + r.deltaItems + '件）';
      if (r.error) line += ' _' + String(r.error).substring(0, 60) + '_';
      lines.push(line);
    }

    slackNotifyPostToChannelTsukuyomi_(CRON_REPORT_CHANNEL_, {
      text: lines.join('\n')
    });
  } catch (e) {
    Logger.log('[cronReport_postL2Summary_] Slack投稿エラー: ' + e);
  }
}

// ================================================================
// ヘルパー
// ================================================================

function _cronReport_statusIcon_(status) {
  var map = {
    generated: ':sparkles:',
    pending: ':arrows_counterclockwise:',
    no_delta: ':zzz:',
    already_updated_today: ':white_check_mark:',
    no_cycle: ':fast_forward:',
    timeout: ':hourglass:',
    gen_failed: ':x:',
    gen_error: ':x:',
    collect_error: ':warning:',
    update_failed: ':x:',
    update_error: ':x:',
    cycle_error: ':warning:'
  };
  return map[status] || ':grey_question:';
}

function _cronReport_jstNow_() {
  var now = new Date();
  return now.getFullYear() + '年'
    + (now.getMonth() + 1) + '月'
    + now.getDate() + '日 '
    + String(now.getHours()).padStart(2, '0') + ':'
    + String(now.getMinutes()).padStart(2, '0');
}
