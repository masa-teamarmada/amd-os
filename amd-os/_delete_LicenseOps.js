
/**
 * ===== LicenseOps 設定 =====
 * - DB_Member を参照して、slackの非アクティブ者に警告→解除予定通知を出す
 * - 監査ログは DB_LicenseActionLog に記録（logLicenseAction_ を使用）
 */
/*
const LICENSE_CFG = {
  SHEET_MEMBER: 'DB_Members',
  TZ: 'Asia/Tokyo',

  INACTIVE_DAYS_THRESHOLD: 30, // ←何日間稼働なしだったら解除するかの閾値
  GRACE_DAYS_AFTER_WARNING: 14,
  OFFBOARD_LEAD_DAYS: 7,

  POLICY_ID: 'DEFAULT_V1',

  DRY_RUN: false, // 最初はtrueでログだけ。OKならfalseに
};

function Job_LicenseOpsDaily() {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) throw new Error('SLACK_BOT_TOKEN が Script Properties に入ってない');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(LICENSE_CFG.SHEET_MEMBER);
  if (!sh) throw new Error('DB_Members シートが見つからない');

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return;

  const header = values[0].map(x => String(x).trim());
  const idx = memberIdx_(header);

  const today = new Date();

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const memberId = s_(row[idx.memberId]);
    const memberName = s_(row[idx.memberName]);
    const status = s_(row[idx.status]);

    const slackId = s_(row[idx.slackId]);
    const slackState = s_(row[idx.slackState]); // paid/free/exempt/hold 想定
    const slackLastSeenAt = parseDate_(row[idx.slackLastSeenAt]);

    const exemptReason = idx.licenseExemptReason >= 0 ? s_(row[idx.licenseExemptReason]) : '';
    const noticeStage = idx.licenseNoticeStage >= 0 ? s_(row[idx.licenseNoticeStage]) : '';
    const lastNotifiedAt = idx.licenseLastNotifiedAt >= 0 ? parseDate_(row[idx.licenseLastNotifiedAt]) : null;

    // 対象外
    if (status !== 'active') continue;
    if (!memberId) continue;
    if (!slackId) continue;

    // 除外（OSが触らない）
    if (slackState === 'exempt' || exemptReason) continue;
    if (!slackLastSeenAt) continue; // ここは運用で埋める or 後でAPI連携

    const inactiveDays = diffDays_(slackLastSeenAt, today);

    // 可視化用に書く（列があれば）
    if (idx.inactiveDays >= 0 && !LICENSE_CFG.DRY_RUN) {
      sh.getRange(r + 1, idx.inactiveDays + 1).setValue(inactiveDays);
    }

    // ===== 1) WARN =====
    const shouldWarn =
      inactiveDays >= LICENSE_CFG.INACTIVE_DAYS_THRESHOLD &&
      noticeStage !== 'warned' &&
      noticeStage !== 'scheduled';

    if (shouldWarn) {
      const text = buildWarnMsg_(inactiveDays);

      // Slack DM送信
      const msgMeta = postSlackDm_(token, slackId, text);

      // 監査ログ
      logLicenseAction_({
        memberId,
        memberName,
        system: 'slack',
        actionType: 'WARN',
        fromState: 'paid_active',
        toState: 'paid_warned',
        inactiveDays,
        policyId: LICENSE_CFG.POLICY_ID,
        actorType: 'system',
        actorId: 'SYSTEM',
        notificationChannel: 'slack_dm',
        notificationMessageId: msgMeta.ts || '',
        reasonCode: `inactive_${LICENSE_CFG.INACTIVE_DAYS_THRESHOLD}d`,
        reasonNote: '',
        payload: { inactiveDays, threshold: LICENSE_CFG.INACTIVE_DAYS_THRESHOLD },
      });

      // DB_Member更新
      if (!LICENSE_CFG.DRY_RUN) {
        if (idx.licenseNoticeStage >= 0) sh.getRange(r + 1, idx.licenseNoticeStage + 1).setValue('warned');
        if (idx.licenseLastNotifiedAt >= 0) sh.getRange(r + 1, idx.licenseLastNotifiedAt + 1).setValue(today);
        if (idx.licenseLastNotifiedAt >= 0) sh.getRange(r + 1, idx.licenseLastNotifiedAt + 1).setNumberFormat('yyyy-mm-dd hh:mm');
      }
      continue;
    }

    // ===== 2) SCHEDULE =====
    if (noticeStage === 'warned' && lastNotifiedAt) {
      const daysAfterWarn = diffDays_(lastNotifiedAt, today);
      if (daysAfterWarn >= LICENSE_CFG.GRACE_DAYS_AFTER_WARNING) {
        const planned = addDays_(today, LICENSE_CFG.OFFBOARD_LEAD_DAYS);
        const text = buildScheduledMsg_(planned);

        const msgMeta = postSlackDm_(token, slackId, text);

        logLicenseAction_({
          memberId,
          memberName,
          system: 'slack',
          actionType: 'SCHEDULE',
          fromState: 'paid_warned',
          toState: 'paid_scheduled',
          inactiveDays,
          policyId: LICENSE_CFG.POLICY_ID,
          actorType: 'system',
          actorId: 'SYSTEM',
          notificationChannel: 'slack_dm',
          notificationMessageId: msgMeta.ts || '',
          reasonCode: 'no_response_after_warn',
          reasonNote: '',
          payload: { plannedAt: planned, graceDays: LICENSE_CFG.GRACE_DAYS_AFTER_WARNING },
        });

        if (!LICENSE_CFG.DRY_RUN) {
          if (idx.licenseNoticeStage >= 0) sh.getRange(r + 1, idx.licenseNoticeStage + 1).setValue('scheduled');
          if (idx.slackOffboardPlannedAt >= 0) {
            sh.getRange(r + 1, idx.slackOffboardPlannedAt + 1).setValue(planned);
            sh.getRange(r + 1, idx.slackOffboardPlannedAt + 1).setNumberFormat('yyyy-mm-dd');
          }
          if (idx.licenseLastNotifiedAt >= 0) sh.getRange(r + 1, idx.licenseLastNotifiedAt + 1).setValue(today);
          if (idx.licenseLastNotifiedAt >= 0) sh.getRange(r + 1, idx.licenseLastNotifiedAt + 1).setNumberFormat('yyyy-mm-dd hh:mm');
        }
      }
    }
  }
}

/**
 * Slack DM送信（SlackClient.gs の関数を利用）
 * 戻り値：{ channelId, ts }
 */
/*
function postSlackDm_(token, slackUserId, text) {
  if (LICENSE_CFG.DRY_RUN) {
    console.log('[DRY_RUN] DM to', slackUserId, '\n', text);
    return { channelId: '', ts: '' };
  }
  const openRes = slackOpenDm_(token, slackUserId);
  const channelId = openRes?.channel?.id;
  if (!channelId) throw new Error('DM open failed: ' + JSON.stringify(openRes));

  const postRes = slackPostMessage_(token, channelId, text);
  return { channelId, ts: postRes?.ts || '' };
}
*/
/**
 * DB_Memberの列マッピング（ヘッダ名はシートに合わせて調整してOK）
 */
/*
function memberIdx_(h) {
  const m = {};
  h.forEach((x, i) => (m[x] = i));

  // 必須：この4つはDB_Memberにある前提
  const idx = {
    memberId: m['memberId'] ?? m['id'] ?? -1,
    memberName: m['memberName'] ?? m['name'] ?? -1,
    status: m['status'] ?? -1,
    slackId: m['slackId'] ?? -1,
    slackState: m['slackState'] ?? -1,
    slackLastSeenAt: m['slackLastSeenAt'] ?? -1,

    // 追加列（無いなら-1でOK）
    slackOffboardPlannedAt: m['slackOffboardPlannedAt'] ?? -1,
    licenseExemptReason: m['licenseExemptReason'] ?? -1,
    licenseNoticeStage: m['licenseNoticeStage'] ?? -1,
    licenseLastNotifiedAt: m['licenseLastNotifiedAt'] ?? -1,
    inactiveDays: m['inactiveDays'] ?? -1,
  };

  // 必須チェック（足りないと動かない）
  const must = ['memberId', 'memberName', 'status', 'slackId', 'slackState', 'slackLastSeenAt'];
  for (const k of must) {
    if (idx[k] < 0) throw new Error(`DB_Memberのヘッダに必要列が無い: ${k}`);
  }
  return idx;
}
*/
/** 文面（無機質運営通知） */
/*
function buildWarnMsg_(inactiveDays) {
  return [
    '【アカウント利用状況のご案内】',
    '',
    `直近 ${inactiveDays} 日間、Slack利用が確認できてないよ。`,
    '有償ライセンス最適化のため、一定期間利用がない場合は有償枠から外す運用にしてる。',
    '',
    '継続利用が必要なら、このDMに「継続希望」って返信してね。',
  ].join('\n');
}

function buildScheduledMsg_(plannedDate) {
  const d = formatDate_(plannedDate, 'yyyy-MM-dd');
  return [
    '【有償ライセンス解除予定】',
    '',
    `利用状況に基づき、${d} を目安に有償枠から解除予定になる。`,
    '継続利用が必要なら、このDMに「継続希望」って返信してね。',
    '',
    '※解除後もSlack自体は無料枠で使える',
  ].join('\n');
}

function s_(v) { return String(v ?? '').trim(); }
function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
function diffDays_(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
function addDays_(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function formatDate_(d, fmt) {
  return Utilities.formatDate(d, LICENSE_CFG.TZ, fmt);
}
*/

function initMonthlyReportDB() {
  mr_repo_ensureMonthlyReportsHeader_();
  Logger.log('DB_MonthlyReports initialized');
}

// 代替の初期化関数
function initMonthlyReportDB_Simple() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DB_MonthlyReports');
  
  if (sheet) {
    Logger.log('DB_MonthlyReports は既に存在します');
    return;
  }
  
  // シート作成
  sheet = ss.insertSheet('DB_MonthlyReports');
  
  // ヘッダ設定
  const headers = [
    'reportId', 'projectId', 'ym', 'draftContent', 'finalContent',
    'totalValuePoints', 'generatedAtJst', 'generatedBy', 'approvedAtJst',
    'approvedBy', 'submittedAtJst', 'submittedBy', 'status',
    'pdfFileId', 'collectionDataJson', 'note'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(1, 1, 1, headers.length).setBackground('#f3f3f3');
  
  Logger.log('DB_MonthlyReports 初期化完了!');
}

function testMonthlyReportGeneration() {
  const projectId = 'YOUR_PROJECT_ID';
  const ym = '202501'; // 2025年1月
  
  // データ収集テスト
  const collectionResult = api_collectMonthlyData(projectId, ym);
  Logger.log('=== 収集結果 ===');
  Logger.log(JSON.stringify(collectionResult, null, 2));
  
  // 報告書生成テスト
  const generateResult = api_generateMonthlyReport(projectId, ym);
  Logger.log('=== 生成結果 ===');
  Logger.log(JSON.stringify(generateResult, null, 2));
}

function testMonthlyReportWithRealProject() {
  const projectId = 'SX'; // ここに実際のIDを入れる
  const ym = '202601';
  
  const result = api_collectMonthlyData(projectId, ym);
  Logger.log(JSON.stringify(result, null, 2));
}

function checkProjectSettings() {
  const projectId = 'ACTUAL_PROJECT_ID_HERE';
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_Projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const projectIdIdx = headers.indexOf('projectId');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] === projectId) {
      Logger.log('=== プロジェクト設定 ===');
      headers.forEach((header, idx) => {
        Logger.log(`${header}: ${data[i][idx]}`);
      });
      break;
    }
  }
}

function listAllProjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_Projects');
  
  if (!sheet) {
    Logger.log('DB_Projects シートが見つかりません');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    Logger.log('DB_Projects にデータがありません');
    return;
  }
  
  const headers = data[0];
  Logger.log('=== ヘッダ ===');
  Logger.log(headers.join(', '));
  Logger.log('');
  
  Logger.log('=== プロジェクト一覧 ===');
  const projectIdIdx = headers.indexOf('projectId');
  const projectNameIdx = headers.indexOf('projectName');
  const statusIdx = headers.indexOf('status');
  
  for (let i = 1; i < Math.min(data.length, 21); i++) {
    const projectId = projectIdIdx !== -1 ? data[i][projectIdIdx] : '';
    const projectName = projectNameIdx !== -1 ? data[i][projectNameIdx] : '';
    const status = statusIdx !== -1 ? data[i][statusIdx] : '';
    
    Logger.log(`${i}. ID: "${projectId}" | 名前: "${projectName}" | ステータス: "${status}"`);
  }
}

function testMonthlyReportWithCorrectProjectId() {
  const projectId = 'p21'; // SX のプロジェクトID
  const ym = '202601'; // 2026年1月
  
  // データ収集テスト
  const collectionResult = api_collectMonthlyData(projectId, ym);
  Logger.log('=== 収集結果 ===');
  Logger.log(JSON.stringify(collectionResult, null, 2));
}

function checkP21Settings() {
  const projectId = 'p21';
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_Projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const projectIdIdx = headers.indexOf('projectId');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] === projectId) {
      Logger.log('=== p21 (SX) の設定 ===');
      
      // 重要な列だけ表示
      const importantCols = [
        'projectId', 'projectName', 'status', 'clientName',
        'slackChannelId', 'notionDatabaseId', 'calendarId', 
        'driveFolderId', 'clientEmail'
      ];
      
      importantCols.forEach(col => {
        const idx = headers.indexOf(col);
        const value = idx !== -1 ? data[i][idx] : '(列なし)';
        Logger.log(`${col}: "${value}"`);
      });
      
      return;
    }
  }
}

function checkP21SlackChannel() {
  const projectId = 'p21';
  
  try {
    const channelId = slackNotifyGetProjectChannelId_(projectId);
    Logger.log(`✅ Slack Channel ID: ${channelId}`);
  } catch (error) {
    Logger.log(`❌ エラー: ${error}`);
  }
}

function testMonthlyReportP21() {
  const projectId = 'p21'; // SXのプロジェクトID
  const ym = '202601';
  
  const result = api_collectMonthlyData(projectId, ym);
  Logger.log('=== 収集結果 ===');
  Logger.log(JSON.stringify(result.activities.summary, null, 2));
}

function testMonthlyReportP21_Full() {
  const projectId = 'p21'; // SX
  const ym = '202601'; // 2026年1月
  
  Logger.log('=== ステップ1: データ収集 ===');
  const collectionResult = api_collectMonthlyData(projectId, ym);
  Logger.log('収集サマリー:');
  Logger.log(JSON.stringify(collectionResult.activities.summary, null, 2));
  
  Logger.log('\n=== ステップ2: 報告書生成 ===');
  const generateResult = api_generateMonthlyReport(projectId, ym);
  
  if (generateResult.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`Report ID: ${generateResult.reportId}`);
    Logger.log('\n--- 生成されたドラフト (最初の500文字) ---');
    Logger.log(generateResult.draft.slice(0, 500));
  } else {
    Logger.log('❌ 報告書生成失敗');
    Logger.log(`エラー: ${generateResult.error}`);
  }
}

function setNotionDatabaseForP21() {
  const projectId = 'p21';
  const notionDatabaseId = '2a297749c6088007abe6cc9a8fd70395'; // ここにNotion Database IDを入れる
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_Projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const projectIdIdx = headers.indexOf('projectId');
  const notionDbIdx = headers.indexOf('notionDatabaseId');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] === projectId) {
      sheet.getRange(i + 1, notionDbIdx + 1).setValue(notionDatabaseId);
      Logger.log('Notion Database ID設定完了!');
      return;
    }
  }
}

function viewMonthlyReport() {
  const projectId = 'p21';
  const ym = '202601';
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_MonthlyReports');
  
  if (!sheet) {
    Logger.log('DB_MonthlyReports シートが見つかりません');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const projectIdIdx = headers.indexOf('projectId');
  const ymIdx = headers.indexOf('ym');
  const draftContentIdx = headers.indexOf('draftContent');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] === projectId && data[i][ymIdx] === ym) {
      Logger.log('=== 月次報告書 ===');
      Logger.log(data[i][draftContentIdx]);
      return;
    }
  }
  
  Logger.log('報告書が見つかりませんでした');
}

function setDriveFolderForP21() {
  const projectId = 'p21';
  const driveFolderId = '1xI-g2nPE8fAeWa-9MrPlFtV0518EfNry';
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('DB_Projects');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const projectIdIdx = headers.indexOf('projectId');
  const driveFolderIdIdx = headers.indexOf('driveFolderId');
  
  if (driveFolderIdIdx === -1) {
    Logger.log('❌ driveFolderId 列が見つかりません');
    return;
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][projectIdIdx] === projectId) {
      sheet.getRange(i + 1, driveFolderIdIdx + 1).setValue(driveFolderId);
      Logger.log('✅ Drive Folder ID設定完了!');
      Logger.log(`   ${driveFolderId}`);
      return;
    }
  }
  
  Logger.log('❌ プロジェクトが見つかりませんでした');
}

function testMonthlyReportP21_v2() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== 月次報告書生成テスト (v2) ===');
  
  const result = api_generateMonthlyReport(projectId, ym);
  
  if (result.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`Report ID: ${result.reportId}`);
    Logger.log('\n--- 生成サマリー ---');
    Logger.log(`収集アイテム: ${result.activities.summary.total_items}件`);
    Logger.log(`成功サービス: ${result.activities.summary.success_count}/6`);
    Logger.log('\n--- ドラフト冒頭 (500文字) ---');
    Logger.log(result.draft.slice(0, 500));
    Logger.log('\n--- 全文表示 ---');
    Logger.log('DB_MonthlyReports シートで確認してください');
  } else {
    Logger.log('❌ 報告書生成失敗');
    Logger.log(`エラー: ${result.error}`);
  }
}

function testMonthlyReportP21_v3() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== 月次報告書生成テスト (v3) ===');
  
  const result = api_generateMonthlyReport(projectId, ym);
  
  if (result.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`Report ID: ${result.reportId}`);
    Logger.log(`Token使用量: ${JSON.stringify(result.token_usage)}`);
    Logger.log('\n--- 収集サマリー ---');
    Logger.log(JSON.stringify(result.activities.summary, null, 2));
    Logger.log('\n--- ドラフト冒頭 (800文字) ---');
    Logger.log(result.draft.slice(0, 800));
    Logger.log('\n...(続きはDB_MonthlyReportsシートで確認)');
  } else {
    Logger.log('❌ 報告書生成失敗');
    Logger.log(`エラー: ${result.error}`);
  }
}

function testMonthlyReportP21_Final() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== 月次報告書生成テスト (Final) ===');
  
  const result = api_generateMonthlyReport(projectId, ym);
  
  if (result.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`\nReport ID: ${result.reportId}`);
    Logger.log(`生成日時: ${result.generated_at}`);
    
    Logger.log('\n--- 収集サマリー ---');
    const summary = result.activities.summary;
    Logger.log(`総アイテム数: ${summary.total_items}`);
    Logger.log(`成功: ${summary.success_count}/6 サービス`);
    Object.entries(summary.by_service).forEach(([service, info]) => {
      const status = info.success ? `✅ ${info.count}件` : `❌ ${info.error}`;
      Logger.log(`  ${service}: ${status}`);
    });
    
    Logger.log('\n--- 生成された報告書 (冒頭1000文字) ---');
    Logger.log(result.draft.slice(0, 1000));
    Logger.log('\n...(続きはDB_MonthlyReportsシートまたはshowFullReport()で確認)');
    
  } else {
    Logger.log('❌ 報告書生成失敗');
    Logger.log(`エラー: ${result.error}`);
  }
}

function showFullReport() {
  const projectId = 'p21';
  const ym = '202601';
  
  const result = api_getMonthlyReport(projectId, ym);
  
  if (result.success && result.exists) {
    Logger.log('========================================');
    Logger.log('   SX プロジェクト 2026年1月 月次報告書');
    Logger.log('========================================');
    Logger.log('');
    Logger.log(result.report.draftContent);
    Logger.log('');
    Logger.log('========================================');
    Logger.log(`Status: ${result.report.status}`);
    Logger.log(`生成日時: ${result.report.generatedAtJst}`);
    Logger.log('========================================');
  } else {
    Logger.log('❌ 報告書が見つかりませんでした');
    if (!result.success) {
      Logger.log(`エラー: ${result.error}`);
    }
  }
}

// 1回目: データ収集して保存
function testCollectAndCache() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== データ収集 & キャッシュ保存 ===');
  
  const activities = mr_collectAllActivities_(projectId, ym);
  Logger.log('収集完了');
  Logger.log(JSON.stringify(activities.summary, null, 2));
  
  const cacheId = mr_cache_save_(projectId, ym, activities);
  Logger.log(`キャッシュ保存完了: ${cacheId}`);
  
  return activities;
}

// 2回目以降: キャッシュから読み込んで報告書生成
function testGenerateFromCache() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== キャッシュから報告書生成 ===');
  
  // forceRecollect = false (デフォルト)でキャッシュ使用
  const result = api_generateMonthlyReport(projectId, ym, false);
  
  if (result.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`キャッシュ使用: ${result.used_cache ? 'はい' : 'いいえ'}`);
    Logger.log(`Report ID: ${result.reportId}`);
    Logger.log('\n--- ドラフト冒頭 (1000文字) ---');
    Logger.log(result.draft.slice(0, 1000));
  } else {
    Logger.log('❌ 失敗');
    Logger.log(`エラー: ${result.error}`);
  }
}

// 強制再収集
function testForceRecollect() {
  const projectId = 'p21';
  const ym = '202601';
  
  Logger.log('=== 強制再収集 ===');
  
  // forceRecollect = true でキャッシュ無視
  const result = api_generateMonthlyReport(projectId, ym, true);
  
  if (result.success) {
    Logger.log('✅ 報告書生成成功!');
    Logger.log(`キャッシュ使用: ${result.used_cache ? 'はい' : 'いいえ'}`);
    Logger.log(`Report ID: ${result.reportId}`);
  } else {
    Logger.log('❌ 失敗');
    Logger.log(`エラー: ${result.error}`);
  }
}