/**
 * 302_MonthlyReport_Collector.gs
 * 
 * 役割:
 * - 各サービスからのデータ収集をオーケストレーション
 * - 収集結果を統合して返す
 * 
 * 依存:
 * - 305_MonthlyReport_NotionExtract.gs
 * - 306_MonthlyReport_SlackExtract.gs
 * - 307_MonthlyReport_GmailExtract.gs
 * - 309_MonthlyReport_DriveExtract.gs
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 変更履歴:
 * - Calendar/Navigator を情報ソースから除外（議事録はNotionに集約、Navigatorは未稼働のため）
 */

/**
 * 全サービスから今月の活動を収集
 * @param {string} projectId
 * @param {string} ym - yyyymm形式
 * @return {Object} 収集結果
 */
function mr_collectAllActivities_(projectId, ym) {
  const startDate = mr_getMonthStart_(ym);
  const endDate = mr_getMonthEnd_(ym);
  
  Logger.log('=== 月次データ収集開始 ===');
  Logger.log('PJ: ' + projectId + ', 期間: ' + mr_formatYm_(ym));
  
  const startTime = new Date();
  
  const results = {
    projectId: projectId,
    ym: ym,
    period: {
      start: mr_formatReadable_(startDate),
      end: mr_formatReadable_(endDate),
      startDate: startDate,
      endDate: endDate
    },
    collected_at_jst: mr_formatReadable_(mr_now_()),
    
    // 有効な4ソース
    notion: mr_collectWithLogging_('Notion', function() { return mr_extractFromNotion_(projectId, startDate, endDate); }),
    slack: mr_collectWithLogging_('Slack', function() { return mr_extractFromSlack_(projectId, startDate, endDate); }),
    gmail: mr_collectWithLogging_('Gmail', function() { return mr_extractFromGmail_(projectId, startDate, endDate); }),
    drive: mr_collectWithLogging_('Drive', function() { return mr_extractFromDrive_(projectId, startDate, endDate); })
  };
  
  var endTime = new Date();
  var duration = (endTime - startTime) / 1000;
  
  Logger.log('=== 収集完了 (' + duration + '秒) ===');
  
  results.collection_duration_sec = duration;
  results.summary = mr_createCollectionSummary_(results);
  
  return results;
}

/**
 * ログ付きで収集を実行
 * @param {string} serviceName
 * @param {Function} collectFunc
 * @return {Object}
 */
function mr_collectWithLogging_(serviceName, collectFunc) {
  Logger.log(serviceName + 'データ収集中...');
  var start = new Date();
  
  try {
    var result = collectFunc();
    var duration = (new Date() - start) / 1000;
    Logger.log(serviceName + '完了 (' + duration + '秒)');
    return result;
  } catch (error) {
    Logger.log(serviceName + 'エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 収集サマリーを作成
 * @param {Object} results
 * @return {Object}
 */
function mr_createCollectionSummary_(results) {
  var summary = {
    total_items: 0,
    by_service: {},
    success_count: 0,
    error_count: 0
  };
  
  var services = ['notion', 'slack', 'gmail', 'drive'];
  
  services.forEach(function(service) {
    var result = results[service];
    
    if (result && result.success) {
      summary.success_count++;
      
      var itemCount = 0;
      if (service === 'notion') itemCount = result.pages ? result.pages.length : 0;
      if (service === 'slack') itemCount = result.messages ? result.messages.length : 0;
      if (service === 'gmail') itemCount = result.threads ? result.threads.length : 0;
      if (service === 'drive') itemCount = result.files ? result.files.length : 0;
      
      summary.by_service[service] = {
        success: true,
        count: itemCount
      };
      summary.total_items += itemCount;
      
    } else {
      summary.error_count++;
      summary.by_service[service] = {
        success: false,
        error: result ? result.error : 'Unknown error'
      };
    }
  });
  
  return summary;
}

/**
 * 収集結果を人間が読める形式に整形
 * @param {Object} results
 * @return {string}
 */
function mr_formatCollectionForHuman_(results) {
  var lines = [];
  
  lines.push('# ' + mr_formatYm_(results.ym) + ' 活動データ収集結果');
  lines.push('収集日時: ' + results.collected_at_jst);
  lines.push('収集期間: ' + results.period.start + ' 〜 ' + results.period.end);
  lines.push('');
  
  lines.push('## サマリー');
  lines.push('- 総アイテム数: ' + results.summary.total_items);
  lines.push('- 成功: ' + results.summary.success_count + 'サービス');
  lines.push('- エラー: ' + results.summary.error_count + 'サービス');
  lines.push('');
  
  var services = [
    { key: 'notion', label: 'Notion', itemKey: 'pages' },
    { key: 'slack', label: 'Slack', itemKey: 'messages' },
    { key: 'gmail', label: 'Gmail', itemKey: 'threads' },
    { key: 'drive', label: 'Drive', itemKey: 'files' }
  ];
  
  services.forEach(function(s) {
    var result = results[s.key];
    
    lines.push('### ' + s.label);
    
    if (result && result.success) {
      var count = result[s.itemKey] ? result[s.itemKey].length : 0;
      lines.push('成功 - ' + count + '件');
    } else {
      lines.push('エラー: ' + (result ? result.error : 'Unknown'));
    }
    
    lines.push('');
  });
  
  return lines.join('\n');
}