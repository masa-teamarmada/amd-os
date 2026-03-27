/**
 * R302_MonthlyReport_Collector.gs
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
  // ★ SourceCacheから読めればそちらを使う（API直叩きを回避）
  try {
    var cached = mr_collectFromSourceCache_(projectId, ym);
    if (cached && cached.summary && cached.summary.total_items > 0) {
      Logger.log('[mr_collectAllActivities_] SourceCacheから読み込み: ' + cached.summary.total_items + '件');
      return cached;
    }
  } catch (e) {
    Logger.log('[mr_collectAllActivities_] SourceCache読み込みエラー（API直接収集にフォールバック）: ' + e);
  }

  // フォールバック: 各APIから直接収集（従来ロジック）
  Logger.log('[mr_collectAllActivities_] SourceCache空/エラー → API直接収集');

  var startDate = mr_getMonthStart_(ym);
  var endDate = mr_getMonthEnd_(ym);

  Logger.log('=== 月次データ収集開始 ===');
  Logger.log('PJ: ' + projectId + ', 期間: ' + mr_formatYm_(ym));

  var startTime = new Date();

  // タイムバジェット: GAS 6分制限に対し5分を上限とし、残り60秒で打ち切り
  var budget = b_timeBudget_(300);

  var services = [
    { key: 'notion', label: 'Notion', fn: function() { return mr_extractFromNotion_(projectId, startDate, endDate); } },
    { key: 'slack',  label: 'Slack',  fn: function() { return mr_extractFromSlack_(projectId, startDate, endDate); } },
    { key: 'gmail',  label: 'Gmail',  fn: function() { return mr_extractFromGmail_(projectId, startDate, endDate); } },
    { key: 'drive',  label: 'Drive',  fn: function() { return mr_extractFromDrive_(projectId, startDate, endDate); } }
  ];

  var results = {
    projectId: projectId,
    ym: ym,
    period: {
      start: mr_formatReadable_(startDate),
      end: mr_formatReadable_(endDate),
      startDate: startDate,
      endDate: endDate
    },
    collected_at_jst: mr_formatReadable_(mr_now_()),
    skipped_services: []
  };

  for (var si = 0; si < services.length; si++) {
    var svc = services[si];
    if (budget.isExpired()) {
      Logger.log('[TimeBudget] 残り時間なし → ' + svc.label + ' をスキップ (' + budget.label() + ')');
      results[svc.key] = { success: false, error: 'タイムバジェット超過によりスキップ' };
      results.skipped_services.push(svc.label);
    } else {
      Logger.log('[TimeBudget] ' + svc.label + ' 開始 (経過: ' + budget.label() + ')');
      results[svc.key] = mr_collectWithLogging_(svc.label, svc.fn);
    }
  }

  var endTime = new Date();
  var duration = (endTime - startTime) / 1000;

  if (results.skipped_services.length > 0) {
    Logger.log('=== 収集完了（一部スキップ: ' + results.skipped_services.join(', ') + '） (' + duration + '秒) ===');
  } else {
    Logger.log('=== 収集完了 (' + duration + '秒) ===');
  }

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

/**
 * 過去24h窓で差分データを収集する。
 * 各Extractorに「過去24h ∩ 当月」の時間窓を渡す。
 * 差分件数がゼロなら total_items=0 で返る → 呼び出し側がスキップ判定に使う。
 *
 * @param {string} projectId
 * @param {string} ym - yyyymm形式
 * @return {Object} 収集結果（mr_collectAllActivities_ と同じ構造）
 */
function mr_collectDeltaActivities_(projectId, ym) {
  var now = mr_now_();
  var since = new Date(now.getTime() - 26 * 60 * 60 * 1000);

  // ★ SourceCacheから直近26h分を読む
  try {
    var cached = mr_collectDeltaFromSourceCache_(projectId, ym, since);
    if (cached) {
      Logger.log('[mr_collectDeltaActivities_] SourceCacheから差分読み込み: ' + cached.summary.total_items + '件');
      return cached;
    }
    Logger.log('[mr_collectDeltaActivities_] SourceCache差分なし');
  } catch (e) {
    Logger.log('[mr_collectDeltaActivities_] SourceCache差分読みエラー（API直接にフォールバック）: ' + e);
  }

  // フォールバック: 各APIから直接収集（従来ロジック）
  var monthStart = mr_getMonthStart_(ym);
  var monthEnd = mr_getMonthEnd_(ym);
  var startDate = (since < monthStart) ? monthStart : since;
  var endDate = (now > monthEnd) ? monthEnd : now;

  Logger.log('=== 差分データ収集（APIフォールバック） ===');
  Logger.log('PJ: ' + projectId + ', 窓: ' + mr_formatReadable_(startDate) + ' 〜 ' + mr_formatReadable_(endDate));

  var startTime = new Date();

  var budget = b_timeBudget_(300);

  var services = [
    { key: 'notion', label: 'Notion(delta)', fn: function() { return mr_extractFromNotionDelta_(projectId, startDate); } },
    { key: 'slack',  label: 'Slack(delta)',  fn: function() { return mr_extractFromSlack_(projectId, startDate, endDate); } },
    { key: 'gmail',  label: 'Gmail(delta)',  fn: function() { return mr_extractFromGmail_(projectId, startDate, endDate); } },
    { key: 'drive',  label: 'Drive(delta)',  fn: function() { return mr_extractFromDrive_(projectId, startDate, endDate); } }
  ];

  var results = {
    projectId: projectId,
    ym: ym,
    isDelta: true,
    period: {
      start: mr_formatReadable_(startDate),
      end: mr_formatReadable_(endDate),
      startDate: startDate,
      endDate: endDate
    },
    collected_at_jst: mr_formatReadable_(now),
    skipped_services: []
  };

  for (var si = 0; si < services.length; si++) {
    var svc = services[si];
    if (budget.isExpired()) {
      Logger.log('[TimeBudget] 残り時間なし → ' + svc.label + ' をスキップ (' + budget.label() + ')');
      results[svc.key] = { success: false, error: 'タイムバジェット超過によりスキップ' };
      results.skipped_services.push(svc.label);
    } else {
      results[svc.key] = mr_collectWithLogging_(svc.label, svc.fn);
    }
  }

  var duration = (new Date() - startTime) / 1000;
  Logger.log('=== 差分収集完了 (' + duration + '秒) ===');

  results.collection_duration_sec = duration;
  results.summary = mr_createCollectionSummary_(results);

  return results;
}

// ============================================================
// SourceCache → activities構造 変換
// ============================================================

/**
 * DB_SourceCacheから全月データを読み、既存activities構造に変換する
 * @param {string} projectId
 * @param {string} ym - yyyymm
 * @return {Object|null} activities構造。データなしならnull
 */
function mr_collectFromSourceCache_(projectId, ym) {
  var rows = srcCache_listByProjectYm(projectId, ym);
  if (!rows || rows.length === 0) return null;

  var grouped = _srcCache_groupBySource_(rows);
  var now = mr_now_();
  var startDate = mr_getMonthStart_(ym);
  var endDate = mr_getMonthEnd_(ym);

  var activities = {
    projectId: projectId,
    ym: ym,
    fromSourceCache: true,
    period: {
      start: mr_formatReadable_(startDate),
      end: mr_formatReadable_(endDate),
      startDate: startDate,
      endDate: endDate
    },
    collected_at_jst: mr_formatReadable_(now),
    notion: _srcCache_toNotionActivities_(grouped.notion),
    slack:  _srcCache_toSlackActivities_(grouped.slack),
    gmail:  _srcCache_toGmailActivities_(grouped.gmail),
    drive:  _srcCache_toDriveActivities_(grouped.drive)
  };

  activities.summary = mr_createCollectionSummary_(activities);
  return activities;
}

/**
 * DB_SourceCacheから直近N時間以内に収集された行だけ読み、差分activities構造に変換する
 * @param {string} projectId
 * @param {string} ym - yyyymm
 * @param {Date} sinceDate - この日時以降に収集されたものだけ
 * @return {Object|null} activities構造。差分なしならnull
 */
function mr_collectDeltaFromSourceCache_(projectId, ym, sinceDate) {
  var rows = srcCache_listByProjectYm(projectId, ym);
  if (!rows || rows.length === 0) return null;

  var filtered = [];
  for (var i = 0; i < rows.length; i++) {
    var collected = _srcCache_parseJstDate_(rows[i].collectedAtJst);
    if (collected && collected.getTime() >= sinceDate.getTime()) {
      filtered.push(rows[i]);
    }
  }

  if (filtered.length === 0) return null;

  var grouped = _srcCache_groupBySource_(filtered);
  var now = mr_now_();

  var activities = {
    projectId: projectId,
    ym: ym,
    isDelta: true,
    fromSourceCache: true,
    period: {
      start: mr_formatReadable_(sinceDate),
      end: mr_formatReadable_(now),
      startDate: sinceDate,
      endDate: now
    },
    collected_at_jst: mr_formatReadable_(now),
    notion: _srcCache_toNotionActivities_(grouped.notion),
    slack:  _srcCache_toSlackActivities_(grouped.slack),
    gmail:  _srcCache_toGmailActivities_(grouped.gmail),
    drive:  _srcCache_toDriveActivities_(grouped.drive)
  };

  activities.summary = mr_createCollectionSummary_(activities);
  return activities;
}

/** ソース別にグループ化 */
function _srcCache_groupBySource_(rows) {
  var g = { notion: [], slack: [], gmail: [], drive: [] };
  for (var i = 0; i < rows.length; i++) {
    var src = String(rows[i].source || '').toLowerCase();
    if (g[src]) g[src].push(rows[i]);
  }
  return g;
}

/** SourceCache行 → notion activities（pages配列） */
/** SourceCache行 → notion activities（pages配列） */
function _srcCache_toNotionActivities_(rows) {
  if (!rows || rows.length === 0) return { success: true, pages: [] };

  var pages = rows.map(function(r) {
    return {
      id: r.itemId || '',
      title: r.title || '(無題)',
      date: _srcCache_formatDate_(r.itemDate),
      content_preview: r.contentText || '',
      last_edited_time: _srcCache_formatDate_(r.itemDate)
    };
  });

  pages.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
  return { success: true, pages: pages };
}

/** SourceCache行 → slack activities（messages配列 + stats） */
function _srcCache_toSlackActivities_(rows) {
  if (!rows || rows.length === 0) return { success: true, messages: [], stats: { totalInteractions: 0 } };

  var totalInteractions = 0;
  var messages = rows.map(function(r) {
    var meta = {};
    try { meta = JSON.parse(r.metadataJson || '{}'); } catch(e) {}
    var replyCount = Number(meta.replyCount) || 0;
    totalInteractions += 1 + replyCount;

    return {
      timestamp_jst: _srcCache_formatDate_(r.itemDate),
      user_name: meta.firstUser || '不明',
      text: r.contentText || '',
      replies: [],
      thread_ts: meta.threadTs || r.itemId || ''
    };
  });

  messages.sort(function(a, b) { return (b.timestamp_jst || '').localeCompare(a.timestamp_jst || ''); });
  return { success: true, messages: messages, stats: { totalInteractions: totalInteractions } };
}

/** SourceCache行 → gmail activities（threads配列） */
function _srcCache_toGmailActivities_(rows) {
  if (!rows || rows.length === 0) return { success: true, threads: [] };

  var threads = rows.map(function(r) {
    var meta = {};
    try { meta = JSON.parse(r.metadataJson || '{}'); } catch(e) {}

    return {
      subject: r.title || '(件名なし)',
      first_message_jst: _srcCache_formatDate_(r.itemDate),
      last_message_jst: meta.lastDate ? _srcCache_formatDate_(meta.lastDate) : _srcCache_formatDate_(r.itemDate),
      message_count: Number(meta.messageCount) || 1,
      from: meta.from || '',
      preview: r.contentText || ''
    };
  });

  threads.sort(function(a, b) { return (b.first_message_jst || '').localeCompare(a.first_message_jst || ''); });
  return { success: true, threads: threads };
}

/** SourceCache行 → drive activities（files配列） */
function _srcCache_toDriveActivities_(rows) {
  if (!rows || rows.length === 0) return { success: true, files: [] };

  var files = rows.map(function(r) {
    var meta = {};
    try { meta = JSON.parse(r.metadataJson || '{}'); } catch(e) {}

    return {
      file_type: meta.fileType || 'file',
      name: r.title || '(無名)',
      last_updated_jst: _srcCache_formatDate_(r.itemDate),
      owner: meta.owner || '',
      url: meta.url || ''
    };
  });

  files.sort(function(a, b) { return (b.last_updated_jst || '').localeCompare(a.last_updated_jst || ''); });
  return { success: true, files: files };
}

/**
 * JST日時文字列をDateオブジェクトにパースする
 * 対応形式: "2027年2月9日 12:24" / ISO 8601 / "yyyy-mm-dd HH:MM:SS"
 */
function _srcCache_parseJstDate_(s) {
  if (!s) return null;
  var str = String(s);

  // "2027年2月9日 12:24"
  var m1 = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if (m1) return new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]), Number(m1[4]), Number(m1[5]), 0);

  // "2027-02-09 12:24:00"
  var m2 = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]), Number(m2[4]), Number(m2[5]), 0);

  // ISO / その他
  var d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Date型/文字列を人が読める日時形式に変換する
 * Date型 → "2026年2月15日 10:25"
 * 文字列でも同様にパースして変換。パース不能なら元文字列をそのまま返す
 */
function _srcCache_formatDate_(val) {
  if (!val) return '';
  var d;
  if (val instanceof Date) {
    d = val;
  } else {
    d = _srcCache_parseJstDate_(String(val));
  }
  if (!d) return String(val);

  return d.getFullYear() + '年'
    + (d.getMonth() + 1) + '月'
    + d.getDate() + '日 '
    + String(d.getHours()).padStart(2, '0') + ':'
    + String(d.getMinutes()).padStart(2, '0');
}