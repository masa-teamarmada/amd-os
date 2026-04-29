/**
 * 311_MonthlyReport_CollectionCache.gs
 * 
 * 役割:
 * - 収集データをスプシに保存・読み込み
 * - 再収集の手間を省く
 * 
 * 依存:
 * - 310_MonthlyReport_Formatter.gs
 */

/**
 * DB_MonthlyCollectionCache のヘッダを保証
 * @return {Sheet}
 */
function mr_cache_ensureHeader_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DB_MonthlyCollectionCache');
  
  const headers = [
    'cacheId',            // projectId_ym
    'projectId',          // プロジェクトID
    'ym',                 // 対象年月
    'collectedAtJst',     // 収集日時
    'collectionDataJson', // 収集データ(JSON)
    'totalItems',         // 総アイテム数
    'successCount',       // 成功サービス数
    'errorCount'          // エラーサービス数
  ];
  
  if (!sheet) {
    Logger.log('DB_MonthlyCollectionCache シートを新規作成');
    sheet = ss.insertSheet('DB_MonthlyCollectionCache');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#f3f3f3');
    return sheet;
  }
  
  // ヘッダ確認
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#f3f3f3');
  }
  
  return sheet;
}

/**
 * 収集データを保存
 * @param {string} projectId
 * @param {string} ym
 * @param {Object} collectionData
 * @return {string} cacheId
 */
function mr_cache_save_(projectId, ym, collectionData) {
  const sheet = mr_cache_ensureHeader_();
  const cacheId = `${projectId}_${ym}`;
  
  const row = {
    cacheId: cacheId,
    projectId: projectId,
    ym: ym,
    collectedAtJst: mr_formatJst_(mr_now_()),
    collectionDataJson: JSON.stringify(collectionData),
    totalItems: collectionData.summary ? collectionData.summary.total_items : 0,
    successCount: collectionData.summary ? collectionData.summary.success_count : 0,
    errorCount: collectionData.summary ? collectionData.summary.error_count : 0
  };
  
  // 既存データを検索
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const cacheIdIdx = headers.indexOf('cacheId');
  const ymColIdx = headers.indexOf('ym');   // ★ ym列の位置を取得
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][cacheIdIdx] === cacheId) {
      rowIndex = i + 1;
      break;
    }
  }
  
  const rowArray = headers.map(h => row[h] || '');
  
  if (rowIndex !== -1) {
    // 更新
    sheet.getRange(rowIndex, 1, 1, rowArray.length).setValues([rowArray]);
    // ★ ym列を文字列フォーマットに強制
    if (ymColIdx >= 0) {
      sheet.getRange(rowIndex, ymColIdx + 1).setNumberFormat('@');
    }
    Logger.log(`収集データ更新: ${cacheId}`);
  } else {
    // 追加
    sheet.appendRow(rowArray);
    const newRow = sheet.getLastRow();
    // ★ ym列を文字列フォーマットに強制
    if (ymColIdx >= 0) {
      sheet.getRange(newRow, ymColIdx + 1).setNumberFormat('@');
    }
    Logger.log(`収集データ保存: ${cacheId}`);
  }
  
  return cacheId;
}

/**
 * 収集データを取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object|null}
 */
function mr_cache_load_(projectId, ym) {
  try {
    const sheet = mr_cache_ensureHeader_();
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) return null;
    
    const headers = data[0];
    const cacheIdIdx = headers.indexOf('cacheId');
    const collectionDataJsonIdx = headers.indexOf('collectionDataJson');
    
    const cacheId = `${projectId}_${ym}`;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][cacheIdIdx] === cacheId) {
        const json = data[i][collectionDataJsonIdx];
        if (json) {
          return JSON.parse(json);
        }
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('キャッシュ読み込みエラー: ' + error);
    return null;
  }
}

/**
 * キャッシュが存在するか確認
 * @param {string} projectId
 * @param {string} ym
 * @return {boolean}
 */
function mr_cache_exists_(projectId, ym) {
  try {
    const sheet = mr_cache_ensureHeader_();
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) return false;
    
    const headers = data[0];
    const cacheIdIdx = headers.indexOf('cacheId');
    const cacheId = `${projectId}_${ym}`;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][cacheIdIdx] === cacheId) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    return false;
  }
}

/**
 * キャッシュ情報を取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object|null}
 */
function mr_cache_getInfo_(projectId, ym) {
  try {
    const sheet = mr_cache_ensureHeader_();
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) return null;
    
    const headers = data[0];
    const cacheIdIdx = headers.indexOf('cacheId');
    const cacheId = `${projectId}_${ym}`;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][cacheIdIdx] === cacheId) {
        const info = {};
        headers.forEach((h, idx) => {
          if (h !== 'collectionDataJson') {
            info[h] = data[i][idx];
          }
        });
        return info;
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('キャッシュ情報取得エラー: ' + error);
    return null;
  }
}