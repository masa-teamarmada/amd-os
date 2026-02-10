/**
 * 307_MonthlyReport_GmailExtract.gs
 * 
 * 役割:
 * - Gmailから今月のプロジェクト関連メールを抽出
 * - 重要なやりとりを収集
 * 
 * 依存:
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 方針:
 * - クライアントメールアドレスでフィルタ
 * - 件名にプロジェクト名が含まれるものを抽出
 */

/**
 * Gmailから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromGmail_(projectId, startDate, endDate) {
  try {
    // プロジェクト情報を取得
    const projectInfo = mr_gmail_getProjectInfo_(projectId);
    if (!projectInfo) {
      return {
        success: false,
        error: 'プロジェクト情報が見つかりません',
        threads: []
      };
    }
    
    // 検索クエリを構築
    const query = mr_gmail_buildSearchQuery_(projectInfo, startDate, endDate);
    
    // スレッドを取得
    const threads = mr_gmail_getThreads_(query);
    
    // スレッド情報を拡充
    const enrichedThreads = mr_gmail_enrichThreads_(threads);
    
    // 統計情報を計算
    const stats = mr_gmail_calculateStats_(enrichedThreads);
    
    return {
      success: true,
      projectInfo: projectInfo,
      threads: enrichedThreads,
      stats: stats,
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Gmail抽出エラー: ' + error);
    return {
      success: false,
      error: error.toString(),
      threads: []
    };
  }
}

/**
 * プロジェクト情報を取得
 * @param {string} projectId
 * @return {Object|null}
 */
function mr_gmail_getProjectInfo_(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_Projects');
    
    if (!sheet) {
      Logger.log('DB_Projects シートが見つかりません');
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return null;
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const projectNameIdx = headers.indexOf('projectName');
    const clientNameIdx = headers.indexOf('clientName');
    const clientEmailIdx = headers.indexOf('clientEmail');
    
    if (projectIdIdx === -1) return null;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        return {
          projectId: data[i][projectIdIdx],
          projectName: projectNameIdx !== -1 ? data[i][projectNameIdx] : '',
          clientName: clientNameIdx !== -1 ? data[i][clientNameIdx] : '',
          clientEmail: clientEmailIdx !== -1 ? data[i][clientEmailIdx] : '',
          keywords: [
            projectNameIdx !== -1 ? data[i][projectNameIdx] : '',
            clientNameIdx !== -1 ? data[i][clientNameIdx] : ''
          ].filter(Boolean)
        };
      }
    }
    
    Logger.log('プロジェクトが見つかりません: ' + projectId);
    return null;
    
  } catch (error) {
    Logger.log('プロジェクト情報取得エラー: ' + error);
    return null;
  }
}

/**
 * Gmail検索クエリを構築
 * @param {Object} projectInfo
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {string}
 */
function mr_gmail_buildSearchQuery_(projectInfo, startDate, endDate) {
  const startStr = mr_formatJst_(startDate, 'yyyy/MM/dd');
  const endStr = mr_formatJst_(endDate, 'yyyy/MM/dd');
  
  const parts = [];
  
  // 日付範囲
  parts.push(`after:${startStr}`);
  parts.push(`before:${endStr}`);
  
  // クライアントメール
  if (projectInfo.clientEmail) {
    parts.push(`(from:${projectInfo.clientEmail} OR to:${projectInfo.clientEmail})`);
  }
  
  // キーワード(プロジェクト名など)
  if (projectInfo.keywords.length > 0) {
    const keywordQuery = projectInfo.keywords.map(k => `"${k}"`).join(' OR ');
    parts.push(`(${keywordQuery})`);
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
    const threads = GmailApp.search(query, 0, maxThreads);
    return threads;
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
  return threads.map(thread => {
    const messages = thread.getMessages();
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    
    return {
      thread_id: thread.getId(),
      subject: firstMessage.getSubject(),
      message_count: messages.length,
      first_message_date: firstMessage.getDate(),
      first_message_jst: mr_formatReadable_(firstMessage.getDate()),
      last_message_date: lastMessage.getDate(),
      last_message_jst: mr_formatReadable_(lastMessage.getDate()),
      from: firstMessage.getFrom(),
      to: firstMessage.getTo(),
      labels: thread.getLabels().map(l => l.getName()),
      is_unread: thread.isUnread(),
      is_important: thread.isImportant(),
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
  
  const previews = messages.slice(0, 3).map(msg => {
    const body = msg.getPlainBody();
    const preview = body.slice(0, 150).replace(/\n/g, ' ');
    return `${msg.getFrom()}: ${preview}...`;
  });
  
  return previews.join('\n---\n');
}

/**
 * 統計情報を計算
 * @param {Array} threads
 * @return {Object}
 */
function mr_gmail_calculateStats_(threads) {
  const totalThreads = threads.length;
  const totalMessages = threads.reduce((sum, t) => sum + t.message_count, 0);
  
  // 送信者別集計
  const senderCounts = {};
  threads.forEach(thread => {
    const sender = thread.from;
    senderCounts[sender] = (senderCounts[sender] || 0) + 1;
  });
  
  // 最も活発な送信者
  const topSenders = Object.entries(senderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, count]) => ({ email, count }));
  
  return {
    totalThreads: totalThreads,
    totalMessages: totalMessages,
    averageMessagesPerThread: totalThreads > 0 ? Math.round(totalMessages / totalThreads * 10) / 10 : 0,
    topSenders: topSenders
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
  
  const selected = threads.slice(0, limit);
  
  const formatted = selected.map(thread => {
    return `【件名】${thread.subject}\n期間: ${thread.first_message_jst} 〜 ${thread.last_message_jst}\nメッセージ数: ${thread.message_count}\n送信者: ${thread.from}\n\n${thread.preview}`;
  }).join('\n\n---\n\n');
  
  return formatted;
}