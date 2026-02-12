/**
 * 305_MonthlyReport_NotionExtract.gs
 * 
 * 役割:
 * - Notion議事録DBからPJリレーションでフィルタして今月の議事録を抽出
 * - 議事録DB（NOTION_DATABASE_ID）は全PJ共通、PJプロパティで識別
 * 
 * 依存:
 * - CalendarToNotionMinutes.gs (_notion_buildPjCodeToPageIdMap_, _notion_fetch_, _notion_normId_, _notion_guessPageTitle_)
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 前提:
 * - Script Properties: NOTION_TOKEN, NOTION_DATABASE_ID（議事録DB）, NOTION_PJ_DATABASE_ID（PJ DB）
 * - 議事録DBの「PJ」プロパティはPJ DBへのリレーション
 * - PJ DBのtitleがprojectName（SX, ORB等）と一致
 */

/**
 * Notionから今月の議事録を抽出（PJリレーションでフィルタ）
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromNotion_(projectId, startDate, endDate) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('NOTION_TOKEN');
    if (!token) {
      return { success: false, error: 'NOTION_TOKEN未設定', pages: [] };
    }
    
    var minutesDbId = props.getProperty('NOTION_DATABASE_ID');
    if (!minutesDbId) {
      return { success: false, error: 'NOTION_DATABASE_ID未設定', pages: [] };
    }
    
    var pjDbId = props.getProperty('NOTION_PJ_DATABASE_ID');
    if (!pjDbId) {
      return { success: false, error: 'NOTION_PJ_DATABASE_ID未設定', pages: [] };
    }
    
    // projectId → projectName を取得
    var projectName = mr_notion_getProjectName_(projectId);
    if (!projectName) {
      return { success: false, error: 'projectNameが見つかりません: ' + projectId, pages: [] };
    }
    
    // PJ DB辞書を取得（pjCode → pageId）
    var pjMap = _notion_buildPjCodeToPageIdMap_(token, pjDbId);
    var pjPageId = pjMap[projectName];
    if (!pjPageId) {
      return { success: false, error: 'NotionのPJ DBに該当PJが見つかりません: ' + projectName, pages: [] };
    }
    
    // 議事録DBをPJリレーション＋日付でフィルタしてquery
    var pages = mr_notion_queryMinutesByPj_(token, minutesDbId, pjPageId, startDate, endDate);
    
    // ページ情報を拡充
    var enrichedPages = mr_notion_enrichPages_(token, pages);
    
    return {
      success: true,
      projectName: projectName,
      pjPageId: pjPageId,
      pages: enrichedPages,
      stats: {
        totalPages: enrichedPages.length
      },
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Notion抽出エラー: ' + error);
    return { success: false, error: error.toString(), pages: [] };
  }
}

/**
 * projectId → projectName を取得
 * @param {string} projectId
 * @return {string|null}
 */
function mr_notion_getProjectName_(projectId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DB_Projects');
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIdx = headers.indexOf('projectId');
  var nameIdx = headers.indexOf('projectName');
  if (idIdx === -1 || nameIdx === -1) return null;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][idIdx] === projectId) {
      return String(data[i][nameIdx] || '').trim();
    }
  }
  return null;
}

/**
 * 議事録DBをPJリレーション＋日付範囲でquery
 * @param {string} token
 * @param {string} minutesDbId
 * @param {string} pjPageId - PJ DBのページID
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array} Notionページ配列
 */
function mr_notion_queryMinutesByPj_(token, minutesDbId, pjPageId, startDate, endDate) {
  var dbId = _notion_normId_(minutesDbId);
  var url = 'https://api.notion.com/v1/databases/' + dbId + '/query';
  
  var filter = {
    and: [
      {
        property: 'PJ',
        relation: {
          contains: pjPageId
        }
      },
      {
        property: '日付',
        date: {
          on_or_after: startDate.toISOString()
        }
      },
      {
        property: '日付',
        date: {
          on_or_before: endDate.toISOString()
        }
      }
    ]
  };
  
  var allPages = [];
  var cursor = null;
  
  while (true) {
    var payload = {
      filter: filter,
      sorts: [{ property: '日付', direction: 'ascending' }],
      page_size: 100
    };
    if (cursor) payload.start_cursor = cursor;
    
    var res = _notion_fetch_(token, url, 'post', payload);
    var results = res.results || [];
    allPages = allPages.concat(results);
    
    cursor = res.next_cursor;
    if (!cursor) break;
  }
  
  Logger.log('Notion議事録取得: ' + allPages.length + '件 (PJ: ' + pjPageId + ')');
  return allPages;
}

/**
 * ページ情報を拡充
 * @param {string} token
 * @param {Array} pages
 * @return {Array}
 */
function mr_notion_enrichPages_(token, pages) {
  return pages.map(function(page) {
    var title = mr_notion_extractTitle_(page);
    var dateStr = mr_notion_extractDate_(page);
    var lastEdited = page.last_edited_time ? new Date(page.last_edited_time) : null;
    
    return {
      id: page.id,
      url: page.url,
      title: title,
      date: dateStr,
      last_edited_time: lastEdited,
      last_edited_jst: lastEdited ? mr_formatReadable_(lastEdited) : '',
      content_preview: mr_notion_getContentPreview_(token, page.id)
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
  
  // 「名前」プロパティ（議事録DBのtitle列）
  var nameProp = page.properties['名前'];
  if (nameProp && nameProp.type === 'title' && nameProp.title && nameProp.title.length > 0) {
    return nameProp.title.map(function(t) { return t.plain_text || ''; }).join('');
  }
  
  // フォールバック: titleタイプのプロパティを探す
  for (var key in page.properties) {
    var prop = page.properties[key];
    if (prop.type === 'title' && prop.title && prop.title.length > 0) {
      return prop.title.map(function(t) { return t.plain_text || ''; }).join('');
    }
  }
  
  return '無題';
}

/**
 * ページの日付を抽出
 * @param {Object} page
 * @return {string}
 */
function mr_notion_extractDate_(page) {
  if (!page.properties) return '';
  
  var dateProp = page.properties['日付'];
  if (dateProp && dateProp.type === 'date' && dateProp.date) {
    return dateProp.date.start || '';
  }
  return '';
}

/**
 * ページの内容プレビューを取得
 * @param {string} token
 * @param {string} pageId
 * @return {string}
 */
function mr_notion_getContentPreview_(token, pageId) {
  try {
    var url = 'https://api.notion.com/v1/blocks/' + pageId + '/children?page_size=10';
    var res = _notion_fetch_(token, url, 'get', null);
    
    if (res.results && res.results.length > 0) {
      var textBlocks = [];
      for (var i = 0; i < res.results.length; i++) {
        var block = res.results[i];
        var bType = block.type;
        if (bType === 'paragraph' || bType === 'heading_1' || bType === 'heading_2' || bType === 'heading_3' || bType === 'bulleted_list_item' || bType === 'numbered_list_item') {
          var richText = block[bType] && block[bType].rich_text ? block[bType].rich_text : [];
          var text = richText.map(function(t) { return t.plain_text || ''; }).join('');
          if (text) textBlocks.push(text);
        }
      }
      var preview = textBlocks.join('\n').slice(0, 500);
      return preview || '';
    }
    
    return '';
  } catch (error) {
    Logger.log('Notionコンテンツ取得エラー (' + pageId + '): ' + error);
    return '';
  }
}

/**
 * Notion議事録を要約用テキストに変換
 * @param {Array} pages
 * @return {string}
 */
function mr_notion_formatForSummary_(pages) {
  if (!pages || pages.length === 0) {
    return '期間内に該当PJの議事録はありません。';
  }
  
  return pages.map(function(page) {
    return '【' + (page.date || '日付不明') + '】' + page.title + '\n' + (page.content_preview || '（内容なし）');
  }).join('\n\n---\n\n');
}