/**
 * R307_MonthlyReport_GmailExtract.gs
 * 
 * 役割:
 * - Gmailから今月のプロジェクト関連メールを抽出
 * - DB_Projects.reportEmails（カンマ区切り複数）でフィルタ
 * 
 * 依存:
 * - 310_MonthlyReport_Formatter.gs
 */

/**
 * Gmailから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromGmail_(projectId, startDate, endDate, maxThreads) {
  try {
    // プロジェクト情報を取得
    var projectInfo = mr_gmail_getProjectInfo_(projectId);
    if (!projectInfo) {
      return { success: false, error: 'プロジェクト情報が見つかりません', threads: [] };
    }
    
    // reportEmailsが未設定なら空で成功扱い
    if (!projectInfo.reportEmails || projectInfo.reportEmails.length === 0) {
      return {
        success: true,
        threads: [],
        stats: { totalThreads: 0, totalMessages: 0 },
        period: { start: mr_formatReadable_(startDate), end: mr_formatReadable_(endDate) },
        note: 'reportEmailsが未設定のためスキップ'
      };
    }
    
    // 検索クエリを構築
    var query = mr_gmail_buildSearchQuery_(projectInfo, startDate, endDate);
    
    // スレッドを取得
    var threads = mr_gmail_getThreads_(query, maxThreads || 50);
    
    // スレッド情報を拡充
    var enrichedThreads = mr_gmail_enrichThreads_(threads);
    
    // 統計情報を計算
    var stats = mr_gmail_calculateStats_(enrichedThreads);
    
    return {
      success: true,
      projectInfo: { projectId: projectInfo.projectId, projectName: projectInfo.projectName },
      threads: enrichedThreads,
      stats: stats,
      period: { start: mr_formatReadable_(startDate), end: mr_formatReadable_(endDate) }
    };
    
  } catch (error) {
    Logger.log('Gmail抽出エラー: ' + error);
    return { success: false, error: error.toString(), threads: [] };
  }
}

/**
 * プロジェクト情報を取得（reportEmails対応）
 * @param {string} projectId
 * @return {Object|null}
 */
function mr_gmail_getProjectInfo_(projectId) {
  try {
    var ss = b_ss_();
    var sheet = ss.getSheetByName('DB_Projects');
    if (!sheet) return null;
    
    var data = sheet.getDataRange().getValues();
    if (data.length === 0) return null;
    
    var headers = data[0];
    var projectIdIdx = headers.indexOf('projectId');
    var projectNameIdx = headers.indexOf('projectName');
    var reportEmailsIdx = headers.indexOf('reportEmails');
    
    if (projectIdIdx === -1) return null;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        var rawEmails = reportEmailsIdx !== -1 ? String(data[i][reportEmailsIdx] || '') : '';
        var emails = rawEmails.split(',')
          .map(function(e) { return e.trim(); })
          .filter(function(e) { return e.length > 0; });
        
        return {
          projectId: data[i][projectIdIdx],
          projectName: projectNameIdx !== -1 ? String(data[i][projectNameIdx] || '') : '',
          reportEmails: emails
        };
      }
    }
    
    return null;
  } catch (error) {
    Logger.log('プロジェクト情報取得エラー: ' + error);
    return null;
  }
}

/**
 * Gmail検索クエリを構築（reportEmails対応）
 * @param {Object} projectInfo
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {string}
 */
function mr_gmail_buildSearchQuery_(projectInfo, startDate, endDate) {
  var startStr = Utilities.formatDate(startDate, 'Asia/Tokyo', 'yyyy/MM/dd');
  var endStr = Utilities.formatDate(endDate, 'Asia/Tokyo', 'yyyy/MM/dd');
  
  var parts = [];
  
  // 日付範囲
  parts.push('after:' + startStr);
  parts.push('before:' + endStr);
  
  // reportEmails: from/toのいずれかにマッチ
  if (projectInfo.reportEmails && projectInfo.reportEmails.length > 0) {
    var emailClauses = projectInfo.reportEmails.map(function(email) {
      return '(from:' + email + ' OR to:' + email + ')';
    });
    parts.push('(' + emailClauses.join(' OR ') + ')');
  }
  
  return parts.join(' ');
}

/**
 * Gmailスレッドを取得
 * @param {string} query
 * @param {number} maxThreads
 * @return {Array}
 */
function mr_gmail_getThreads_(query, maxThreads) {
  maxThreads = maxThreads || 50;
  
  try {
    return GmailApp.search(query, 0, maxThreads);
  } catch (error) {
    Logger.log('Gmailスレッド取得エラー: ' + error);
    return [];
  }
}

/**
 * スレッド情報を拡充
 * @param {Array} threads
 * @return {Array}
 */
function mr_gmail_enrichThreads_(threads) {
  return threads.map(function(thread) {
    var messages = thread.getMessages();
    var firstMessage = messages[0];
    var lastMessage = messages[messages.length - 1];
    
    return {
      thread_id: thread.getId(),
      subject: firstMessage.getSubject(),
      message_count: messages.length,
      first_message_jst: mr_formatReadable_(firstMessage.getDate()),
      last_message_jst: mr_formatReadable_(lastMessage.getDate()),
      from: firstMessage.getFrom(),
      to: firstMessage.getTo(),
      preview: mr_gmail_getThreadPreview_(messages)
    };
  });
}

/**
 * スレッドのプレビューを生成
 * @param {Array} messages
 * @return {string}
 */
function mr_gmail_getThreadPreview_(messages) {
  if (messages.length === 0) return '';
  
  return messages.slice(0, 3).map(function(msg) {
    var body = msg.getPlainBody();
    var preview = body.slice(0, 150).replace(/\n/g, ' ');
    return msg.getFrom() + ': ' + preview + '...';
  }).join('\n---\n');
}

/**
 * 統計情報を計算
 * @param {Array} threads
 * @return {Object}
 */
function mr_gmail_calculateStats_(threads) {
  var totalThreads = threads.length;
  var totalMessages = threads.reduce(function(sum, t) { return sum + t.message_count; }, 0);
  
  return {
    totalThreads: totalThreads,
    totalMessages: totalMessages
  };
}

/**
 * Gmailスレッドを要約用テキストに変換
 * @param {Array} threads
 * @param {number} limit
 * @return {string}
 */
function mr_gmail_formatForSummary_(threads, limit) {
  limit = limit || 20;
  
  if (!threads || threads.length === 0) {
    return '期間内にGmailスレッドはありません。';
  }
  
  return threads.slice(0, limit).map(function(thread) {
    return '【件名】' + thread.subject + '\n期間: ' + thread.first_message_jst + ' 〜 ' + thread.last_message_jst + '\nメッセージ数: ' + thread.message_count + '\n送信者: ' + thread.from + '\n\n' + thread.preview;
  }).join('\n\n---\n\n');
}