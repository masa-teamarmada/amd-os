/**
 * R319_SourceCacheCron.gs
 * 一次情報の日次差分収集（L1パイプライン）。
 * 
 * 毎日3:10 JSTに実行。過去24hに更新されたNotion/Slack/Gmailを
 * DB_SourceCacheにupsertする。
 * 
 * 依存:
 *   - 311_SourceCacheRepo.gs（srcCache_upsert）
 *   - 305_MonthlyReport_NotionExtract.gs（mr_extractFromNotionDelta_）
 *   - 306_MonthlyReport_SlackExtract.gs（mr_slack_getMessages_, mr_slack_getThreadReplies_, mr_slack_getUserName_, mr_slack_getTextPreview_）
 *   - 307_MonthlyReport_GmailExtract.gs（mr_extractFromGmail_）
 *   - B_Sheets.gs（b_readTable_）
 */

// ========== 日次cron本体 ==========

/**
 * 日次トリガーから呼ばれるエントリポイント。
 * トリガー設定: 毎日3:10 JST
 */
function cron_collectSourceCacheDaily() {
  var startTime = new Date().getTime();
  var TIMEOUT_MS = 5 * 60 * 1000;
  var SINCE_HOURS = 26;

  var sinceDate = new Date(startTime - SINCE_HOURS * 60 * 60 * 1000);

  var now = new Date();
  var nowYm = String(now.getFullYear()) + ('0' + (now.getMonth() + 1)).slice(-2);

  var pjData = b_readTable_('DB_Projects');
  var activePjs = pjData.filter(function(r) {
    return String(r.status || '').toLowerCase() === 'active';
  });

  Logger.log('[L1 SourceCache] start: ' + activePjs.length + ' PJs, since=' + sinceDate.toISOString());

  var stats = { notion: 0, slack: 0, gmail: 0, gmeet: 0, errors: 0 };
  var pjDetails = []; // PJごとの内訳（Slack投稿用）

  for (var pi = 0; pi < activePjs.length; pi++) {
    if (new Date().getTime() - startTime > TIMEOUT_MS) {
      Logger.log('[L1] TIMEOUT at PJ index ' + pi);
      break;
    }

    var pj = activePjs[pi];
    var projectId = String(pj.projectId);
    Logger.log('[L1] ' + projectId + ' (' + (pj.projectName || '') + ')');

    var pjStat = { projectId: projectId, projectName: pj.projectName || '', notion: 0, slack: 0, gmail: 0, errors: [] };

    try {
      var notionCount = srcCacheCron_collectNotion_(projectId, sinceDate, nowYm);
      stats.notion += notionCount;
      pjStat.notion = notionCount;
    } catch (e) {
      Logger.log('  Notion error: ' + e);
      stats.errors++;
      pjStat.errors.push('Notion: ' + String(e).substring(0, 80));
    }

    if (new Date().getTime() - startTime > TIMEOUT_MS) { pjDetails.push(pjStat); break; }

    try {
      var slackCount = srcCacheCron_collectSlack_(projectId, pj, sinceDate, nowYm);
      stats.slack += slackCount;
      pjStat.slack = slackCount;
    } catch (e) {
      Logger.log('  Slack error: ' + e);
      stats.errors++;
      pjStat.errors.push('Slack: ' + String(e).substring(0, 80));
    }

    if (new Date().getTime() - startTime > TIMEOUT_MS) { pjDetails.push(pjStat); break; }

    try {
      var gmailCount = srcCacheCron_collectGmail_(projectId, pj, sinceDate, nowYm);
      stats.gmail += gmailCount;
      pjStat.gmail = gmailCount;
    } catch (e) {
      Logger.log('  Gmail error: ' + e);
      stats.errors++;
      pjStat.errors.push('Gmail: ' + String(e).substring(0, 80));
    }

    pjDetails.push(pjStat);
  }

  // --- Google Meet議事録（PJ横断・Gemini Notes）---
  try {
    var gmeetCount = srcCacheGMeet_collectDelta_(sinceDate);
    stats.gmeet += gmeetCount;
  } catch (e) {
    Logger.log('  GMeet error: ' + e);
    stats.errors++;
  }

  Logger.log('[L1 SourceCache] done: notion=' + stats.notion + ' slack=' + stats.slack + ' gmail=' + stats.gmail + ' gmeet=' + stats.gmeet + ' errors=' + stats.errors);

  // Slack投稿
  var elapsedSec = Math.round((new Date().getTime() - startTime) / 1000);
  try {
    cronReport_postL1Summary_(stats, pjDetails, elapsedSec);
  } catch (e) {
    Logger.log('[L1] Slack report error: ' + e);
  }
}

// ========== Notion差分収集 ==========

/**
 * @param {string} projectId
 * @param {Date} sinceDate
 * @param {string} nowYm
 * @return {number} upsert件数
 */
function srcCacheCron_collectNotion_(projectId, sinceDate, nowYm) {
  var result = mr_extractFromNotionDelta_(projectId, sinceDate);
  if (!result.success) {
    Logger.log('  Notion skip: ' + (result.error || 'unknown'));
    // エラー理由を呼び元に伝えるためthrow（catchでpjStat.errorsに入る）
    throw new Error('Notion: ' + (result.error || 'extract failed'));
  }
  if (!result.pages || result.pages.length === 0) return 0;

  var count = 0;
  for (var i = 0; i < result.pages.length; i++) {
    var page = result.pages[i];
    var pageDate = String(page.date || '');
    var ym = '';
    if (pageDate) {
      var parts = pageDate.split('-');
      if (parts.length >= 2) ym = parts[0] + parts[1];
    }
    if (!ym) ym = nowYm;

    srcCache_upsert({
      projectId: projectId,
      ym:        ym,
      source:    'notion',
      itemId:    String(page.id).replace(/-/g, ''),
      title:     page.title || '',
      itemDate:  page.last_edited_jst || pageDate,
      contentText: page.content_preview || '',
      metadataJson: JSON.stringify({
        url: page.url || '',
        notionDate: pageDate
      })
    });
    count++;
  }
  Logger.log('  Notion: ' + count + ' pages');
  return count;
}

// ========== Slack差分収集 ==========

/**
 * @param {string} projectId
 * @param {Object} pj - DB_Projectsの行
 * @param {Date} sinceDate
 * @param {string} nowYm
 * @return {number} upsert件数
 */
function srcCacheCron_collectSlack_(projectId, pj, sinceDate, nowYm) {
  var channelId;
  try {
    channelId = slackNotifyGetProjectChannelId_(projectId);
  } catch (e) {
    throw new Error('Slack chId取得失敗: ' + String(e).substring(0, 60));
  }
  if (!channelId) {
    Logger.log('  Slack skip: channelId未設定 for ' + projectId);
    return 0;
  }

  var endDate = new Date();
  var messages = mr_slack_getMessages_(channelId, sinceDate, endDate);
  if (!messages || messages.length === 0) return 0;

  // スレッド単位でグループ化（801のバックフィルと同じロジック）
  var seen = {};
  var threads = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.thread_ts && msg.thread_ts !== msg.ts) continue;
    var key = msg.thread_ts || msg.ts;
    if (seen[key]) continue;
    seen[key] = true;
    threads.push({ parentTs: msg.ts, parent: msg });
  }

  var count = 0;
  for (var ti = 0; ti < threads.length; ti++) {
    var thread = threads[ti];
    var threadTs = thread.parentTs;

    // 返信取得
    var replyTexts = [];
    if (thread.parent.reply_count && parseInt(thread.parent.reply_count) > 0 && thread.parent.thread_ts === thread.parent.ts) {
      try {
        var replies = mr_slack_getThreadReplies_(channelId, threadTs);
        for (var ri = 0; ri < replies.length; ri++) {
          var r = replies[ri];
          replyTexts.push((r.user_name || r.user || '?') + ': ' + (r.text || ''));
        }
      } catch (re) { /* skip */ }
    }

    var parentUser = mr_slack_getUserName_(thread.parent.user);
    var parentText = parentUser + ': ' + (thread.parent.text || '');
    var fullText = parentText;
    if (replyTexts.length > 0) {
      fullText += '\n---replies---\n' + replyTexts.join('\n');
    }

    var msgDate = new Date(parseFloat(threadTs) * 1000);
    var msgYm = String(msgDate.getFullYear()) + ('0' + (msgDate.getMonth() + 1)).slice(-2);

    srcCache_upsert({
      projectId: projectId,
      ym: msgYm || nowYm,
      source: 'slack',
      itemId: threadTs.replace('.', '_'),
      title: (parentUser + ': ' + mr_slack_getTextPreview_(thread.parent.text)).substring(0, 100),
      itemDate: srcCacheCron_formatJst_(msgDate),
      contentText: fullText,
      metadataJson: JSON.stringify({
        channelId: channelId,
        replyCount: replyTexts.length,
        reactions: (thread.parent.reactions || []).map(function(rx) { return rx.name + ':' + rx.count; }).join(',')
      })
    });
    count++;
  }
  Logger.log('  Slack: ' + count + ' threads');
  return count;
}

// ========== Gmail差分収集 ==========

/**
 * @param {string} projectId
 * @param {Object} pj - DB_Projectsの行
 * @param {Date} sinceDate
 * @param {string} nowYm
 * @return {number} upsert件数
 */
function srcCacheCron_collectGmail_(projectId, pj, sinceDate, nowYm) {
  var rawEmails = String(pj.reportEmails || '');
  var emails = rawEmails.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e.length > 0; });
  if (emails.length === 0) return 0;

  var endDate = new Date();
  var result = mr_extractFromGmail_(projectId, sinceDate, endDate, 100);
  if (!result.success || !result.threads || result.threads.length === 0) return 0;

  var count = 0;
  for (var ti = 0; ti < result.threads.length; ti++) {
    var thread = result.threads[ti];

    srcCache_upsert({
      projectId: projectId,
      ym: nowYm,
      source: 'gmail',
      itemId: thread.thread_id,
      title: (thread.subject || '(no subject)').substring(0, 100),
      itemDate: thread.first_message_jst || '',
      contentText: thread.preview || '',
      metadataJson: JSON.stringify({
        from: thread.from || '',
        to: thread.to || '',
        messageCount: thread.message_count || 0,
        lastMessageJst: thread.last_message_jst || ''
      })
    });
    count++;
  }
  Logger.log('  Gmail: ' + count + ' threads');
  return count;
}

// ========== ヘルパー ==========

/**
 * JST日時文字列
 */
function srcCacheCron_formatJst_(date) {
  var d = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 '
    + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
}

// ========== トリガー設定 ==========

/**
 * 日次トリガーを設定（1回だけ手動実行）
 * 手動実行: 316_SourceCacheCron.gs → setupSourceCacheDailyTrigger
 */
function setupSourceCacheDailyTrigger() {
  // 既存トリガー削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cron_collectSourceCacheDaily') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 毎日3:00-4:00（JSTで3:10頃）
  ScriptApp.newTrigger('cron_collectSourceCacheDaily')
    .timeBased()
    .everyDays(1)
    .atHour(18) // UTC 18:00 = JST 3:00
    .create();
  Logger.log('Trigger created: cron_collectSourceCacheDaily (daily 3:00-4:00 JST)');
}