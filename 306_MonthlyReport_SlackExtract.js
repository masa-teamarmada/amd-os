/**
 * 306_MonthlyReport_SlackExtract.gs
 * 
 * 役割:
 * - Slackチャンネルから今月の活動を抽出
 * - メッセージ、スレッド、リアクションを収集
 * 
 * 依存:
 * - 185_SlackNotify.gs (slack_callApi, slack_getBotToken_)
 * - 310_MonthlyReport_Formatter.gs
 */

/**
 * Slackから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromSlack_(projectId, startDate, endDate) {
  try {
    const channelId = slackNotifyGetProjectChannelId_(projectId);
    if (!channelId) {
      return {
        success: false,
        error: 'Slackチャンネルが見つかりません',
        messages: []
      };
    }
    
    // メッセージ取得
    const messages = mr_slack_getMessages_(channelId, startDate, endDate);
    
    // スレッド返信を取得
    const enrichedMessages = mr_slack_enrichWithThreads_(channelId, messages);
    
    // 統計情報を計算
    const stats = mr_slack_calculateStats_(enrichedMessages);
    
    return {
      success: true,
      channelId: channelId,
      messages: enrichedMessages,
      stats: stats,
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Slack抽出エラー: ' + error);
    return {
      success: false,
      error: error.toString(),
      messages: []
    };
  }
}

/**
 * Slackメッセージを取得
 * @param {string} channelId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array} メッセージ配列
 */
function mr_slack_getMessages_(channelId, startDate, endDate) {
  const oldest = Math.floor(startDate.getTime() / 1000).toString();
  const latest = Math.floor(endDate.getTime() / 1000).toString();
  
  const messages = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    const params = {
      channel: channelId,
      oldest: oldest,
      latest: latest,
      limit: 100
    };
    
    if (cursor) {
      params.cursor = cursor;
    }
    
    const response = slack_callApi('conversations.history', params);
    
    if (response && response.ok) {
      messages.push(...response.messages);
      
      if (response.has_more && response.response_metadata && response.response_metadata.next_cursor) {
        cursor = response.response_metadata.next_cursor;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  // 新しい順から古い順に並び替え
  messages.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));
  
  return messages;
}

/**
 * スレッド返信を取得してメッセージに追加
 * @param {string} channelId
 * @param {Array} messages
 * @return {Array} スレッド情報を含むメッセージ配列
 */
function mr_slack_enrichWithThreads_(channelId, messages) {
  return messages.map(msg => {
    var enrichedMsg = {
      ts: msg.ts,
      user: msg.user,
      text: msg.text || '',
      type: msg.type,
      thread_ts: msg.thread_ts || null,
      reply_count: msg.reply_count || 0,
      reactions: (msg.reactions || []).map(function(r) {
        return { name: r.name, count: r.count };
      }),
      timestamp_jst: mr_formatReadable_(mr_slackTsToDate_(msg.ts)),
      user_name: mr_slack_getUserName_(msg.user),
      text_preview: mr_slack_getTextPreview_(msg.text),
      file_names: (msg.files || []).map(function(f) { return f.name || ''; }).filter(Boolean),
      replies: []
    };
    
    if (msg.thread_ts && msg.reply_count && parseInt(msg.reply_count) > 0) {
      if (msg.thread_ts === msg.ts) {
        enrichedMsg.replies = mr_slack_getThreadReplies_(channelId, msg.thread_ts);
      }
    }
    
    return enrichedMsg;
  });
}

/**
 * スレッド返信を取得
 * @param {string} channelId
 * @param {string} threadTs
 * @return {Array} 返信配列
 */
function mr_slack_getThreadReplies_(channelId, threadTs) {
  try {
    if (!threadTs) {
      return [];
    }
    
    const response = slack_callApi('conversations.replies', {
      channel: channelId,
      ts: threadTs,
      limit: 100
    });
    
    if (response && response.ok && response.messages) {
      // 最初のメッセージ(親)を除外
      return response.messages.slice(1).map(reply => ({
        ...reply,
        timestamp_jst: mr_formatReadable_(mr_slackTsToDate_(reply.ts)),
        user_name: mr_slack_getUserName_(reply.user),
        text_preview: mr_slack_getTextPreview_(reply.text)
      }));
    }
    
    if (response && !response.ok) {
      Logger.log(`スレッド取得エラー: ${response.error || 'Unknown error'}`);
    }
    
    return [];
  } catch (error) {
    Logger.log(`スレッド取得エラー: ${error}`);
    return [];
  }
}

/**
 * ユーザー名を取得(簡易版)
 * @param {string} userId
 * @return {string}
 */
function mr_slack_getUserName_(userId) {
  if (!userId) return '不明';
  
  // DB_MembersからslackIdで検索
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_Members');
    
    if (!sheet) {
      return userId; // フォールバック
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return userId;
    
    const headers = data[0];
    const slackIdIdx = headers.indexOf('slackId');
    const memberNameIdx = headers.indexOf('memberName');
    
    if (slackIdIdx === -1 || memberNameIdx === -1) {
      return userId;
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][slackIdIdx] === userId) {
        return data[i][memberNameIdx] || userId;
      }
    }
    
    return userId;
    
  } catch (error) {
    Logger.log('メンバー名取得エラー: ' + error);
    return userId;
  }
}

/**
 * テキストのプレビュー生成(最初の100文字)
 * @param {string} text
 * @return {string}
 */
function mr_slack_getTextPreview_(text) {
  if (!text) return '';
  
  // メンションやチャンネル参照を整形
  let preview = text
    .replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
      const name = mr_slack_getUserName_(userId);
      return `@${name}`;
    })
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/g, '#$2')
    .replace(/<([^>]+)>/g, '$1');
  
  if (preview.length > 100) {
    preview = preview.slice(0, 100) + '...';
  }
  
  return preview;
}

/**
 * 統計情報を計算
 * @param {Array} messages
 * @return {Object}
 */
function mr_slack_calculateStats_(messages) {
  const totalMessages = messages.length;
  const totalReplies = messages.reduce((sum, msg) => sum + (msg.replies ? msg.replies.length : 0), 0);
  
  // ユーザー別投稿数
  const userCounts = {};
  messages.forEach(msg => {
    const userName = msg.user_name || '不明';
    userCounts[userName] = (userCounts[userName] || 0) + 1;
    
    if (msg.replies) {
      msg.replies.forEach(reply => {
        const replyUserName = reply.user_name || '不明';
        userCounts[replyUserName] = (userCounts[replyUserName] || 0) + 1;
      });
    }
  });
  
  // 最も活発なユーザー
  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  
  return {
    totalMessages: totalMessages,
    totalReplies: totalReplies,
    totalInteractions: totalMessages + totalReplies,
    topUsers: topUsers,
    uniqueUsers: Object.keys(userCounts).length
  };
}

/**
 * Slackメッセージを要約用テキストに変換
 * @param {Array} messages
 * @param {number} limit - 最大メッセージ数
 * @return {string}
 */
function mr_slack_formatForSummary_(messages, limit) {
  limit = limit || 50;
  
  const selected = messages.slice(0, limit);
  
  const formatted = selected.map(msg => {
    let text = `【${msg.timestamp_jst}】${msg.user_name}:\n${msg.text}`;
    
    if (msg.replies && msg.replies.length > 0) {
      text += `\n  └ ${msg.replies.length}件の返信`;
      msg.replies.slice(0, 3).forEach(reply => {
        text += `\n  └ ${reply.user_name}: ${reply.text_preview}`;
      });
    }
    
    return text;
  }).join('\n\n');
  
  return formatted;
}