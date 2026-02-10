/**
 * 305_MonthlyReport_NotionExtract.gs
 * 
 * 役割:
 * - Notionから今月更新されたページ/データベースを抽出
 * - 議事録、タスク、進捗メモを収集
 * 
 * 依存:
 * - NotionProtocolSync.gs (既存のNotion連携)
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 前提:
 * - Notion API tokenがScript Propertiesに設定済み
 * - プロジェクトごとのNotion workspace/databaseが紐付け済み
 */

/**
 * Notionから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromNotion_(projectId, startDate, endDate) {
  try {
    // プロジェクトのNotion設定を取得
    const notionConfig = mr_notion_getProjectConfig_(projectId);
    if (!notionConfig || !notionConfig.databaseId) {
      return {
        success: false,
        error: 'Notion設定が見つかりません',
        pages: []
      };
    }
    
    // 期間内に更新されたページを取得
    const pages = mr_notion_getUpdatedPages_(notionConfig.databaseId, startDate, endDate);
    
    // 各ページの詳細を取得
    const enrichedPages = mr_notion_enrichPages_(pages);
    
    // カテゴリ別に分類
    const categorized = mr_notion_categorizePages_(enrichedPages);
    
    return {
      success: true,
      databaseId: notionConfig.databaseId,
      pages: enrichedPages,
      categorized: categorized,
      stats: {
        totalPages: enrichedPages.length,
        byCategory: Object.keys(categorized).map(cat => ({
          category: cat,
          count: categorized[cat].length
        }))
      },
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Notion抽出エラー: ' + error);
    return {
      success: false,
      error: error.toString(),
      pages: []
    };
  }
}

/**
 * プロジェクトのNotion設定を取得
 * @param {string} projectId
 * @return {Object|null}
 */
function mr_notion_getProjectConfig_(projectId) {
  try {
    // SpreadsheetApp経由で直接取得
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
    const notionDbIdx = headers.indexOf('notionDatabaseId');
    const notionWsIdx = headers.indexOf('notionWorkspaceId');
    
    if (projectIdIdx === -1) {
      Logger.log('projectId 列が見つかりません');
      return null;
    }
    
    // プロジェクトを検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        const databaseId = notionDbIdx !== -1 ? data[i][notionDbIdx] : '';
        const workspaceId = notionWsIdx !== -1 ? data[i][notionWsIdx] : '';
        
        if (!databaseId) {
          Logger.log('Notion Database IDが設定されていません');
          return null;
        }
        
        return {
          databaseId: databaseId,
          workspaceId: workspaceId
        };
      }
    }
    
    Logger.log('プロジェクトが見つかりません: ' + projectId);
    return null;
    
  } catch (error) {
    Logger.log('Notion設定取得エラー: ' + error);
    return null;
  }
}

/**
 * 期間内に更新されたNotionページを取得
 * @param {string} databaseId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array}
 */
function mr_notion_getUpdatedPages_(databaseId, startDate, endDate) {
  const token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN') 
    || PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN');
  if (!token) {
    throw new Error('Notion API tokenが設定されていません (NOTION_TOKEN または NOTION_API_TOKEN)');
  }
  
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  
  const filter = {
    and: [
      {
        timestamp: 'last_edited_time',
        last_edited_time: {
          on_or_after: startDate.toISOString()
        }
      },
      {
        timestamp: 'last_edited_time',
        last_edited_time: {
          on_or_before: endDate.toISOString()
        }
      }
    ]
  };
  
  const payload = {
    filter: filter,
    sorts: [
      {
        timestamp: 'last_edited_time',
        direction: 'descending'
      }
    ],
    page_size: 100
  };
  
  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  
  if (data.results) {
    return data.results;
  }
  
  return [];
}

/**
 * ページ情報を拡充
 * @param {Array} pages
 * @return {Array}
 */
function mr_notion_enrichPages_(pages) {
  return pages.map(page => {
    const title = mr_notion_extractTitle_(page);
    const category = mr_notion_extractCategory_(page);
    const lastEditedTime = mr_isoToDate_(page.last_edited_time);
    
    return {
      id: page.id,
      url: page.url,
      title: title,
      category: category,
      last_edited_time: lastEditedTime,
      last_edited_jst: mr_formatReadable_(lastEditedTime),
      properties: page.properties,
      content_preview: mr_notion_getContentPreview_(page.id)
    };
  });
}

/**
 * ページのタイトルを抽出
 * @param {Object} page
 * @return {string}
 */
function mr_notion_extractTitle_(page) {
  if (!page.properties) return '無題';
  
  // 'Name'または'Title'プロパティを探す
  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title && prop.title[0]) {
      return prop.title[0].plain_text || '無題';
    }
  }
  
  return '無題';
}

/**
 * ページのカテゴリを抽出
 * @param {Object} page
 * @return {string}
 */
function mr_notion_extractCategory_(page) {
  if (!page.properties) return '未分類';
  
  // 'Category'や'Type'プロパティを探す
  for (const [key, prop] of Object.entries(page.properties)) {
    if ((key.toLowerCase() === 'category' || key.toLowerCase() === 'type') && prop.select) {
      return prop.select.name || '未分類';
    }
  }
  
  return '未分類';
}

/**
 * ページの内容プレビューを取得
 * @param {string} pageId
 * @return {string}
 */
function mr_notion_getContentPreview_(pageId) {
  try {
    const token = PropertiesService.getScriptProperties().getProperty('NOTION_TOKEN')
      || PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN');
    if (!token) return '';
    
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=5`;
    
    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28'
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (data.results && data.results.length > 0) {
      const textBlocks = data.results
        .filter(block => block.type === 'paragraph' || block.type === 'heading_1' || block.type === 'heading_2')
        .map(block => {
          if (block[block.type] && block[block.type].rich_text) {
            return block[block.type].rich_text.map(t => t.plain_text).join('');
          }
          return '';
        })
        .filter(text => text.length > 0);
      
      const preview = textBlocks.join(' ').slice(0, 200);
      return preview ? preview + '...' : '';
    }
    
    return '';
  } catch (error) {
    Logger.log('Notionコンテンツ取得エラー: ' + error);
    return '';
  }
}

/**
 * ページをカテゴリ別に分類
 * @param {Array} pages
 * @return {Object}
 */
function mr_notion_categorizePages_(pages) {
  const categorized = {};
  
  pages.forEach(page => {
    const category = page.category || '未分類';
    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(page);
  });
  
  return categorized;
}

/**
 * Notionページを要約用テキストに変換
 * @param {Array} pages
 * @return {string}
 */
function mr_notion_formatForSummary_(pages) {
  if (!pages || pages.length === 0) {
    return '期間内に更新されたNotionページはありません。';
  }
  
  const formatted = pages.map(page => {
    return `【${page.category}】${page.title}\n更新: ${page.last_edited_jst}\n${page.content_preview}\nURL: ${page.url}`;
  }).join('\n\n');
  
  return formatted;
}