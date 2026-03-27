/**
 * R309_MonthlyReport_DriveExtract.gs
 * 
 * 役割:
 * - Google Driveから今月更新されたファイルを抽出
 * - プロジェクト関連のドキュメント、資料を収集
 * 
 * 依存:
 * - 310_MonthlyReport_Formatter.gs
 * 
 * 方針:
 * - プロジェクトフォルダ配下のファイルを対象
 * - ドキュメント、スプレッドシート、プレゼンを優先
 */

/**
 * Google Driveから今月の活動を抽出
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} 抽出結果
 */
function mr_extractFromDrive_(projectId, startDate, endDate) {
  try {
    // プロジェクトフォルダを取得
    const folderId = mr_drive_getProjectFolderId_(projectId);
    if (!folderId) {
      return {
        success: false,
        error: 'プロジェクトフォルダが見つかりません',
        files: []
      };
    }
    
    // 期間内に更新されたファイルを取得
    const files = mr_drive_getUpdatedFiles_(folderId, startDate, endDate);
    
    // ファイル情報を拡充
    const enrichedFiles = mr_drive_enrichFiles_(files);
    
    // タイプ別に分類
    const categorized = mr_drive_categorizeFiles_(enrichedFiles);
    
    // 統計情報を計算
    const stats = mr_drive_calculateStats_(enrichedFiles);
    
    return {
      success: true,
      folderId: folderId,
      files: enrichedFiles,
      categorized: categorized,
      stats: stats,
      period: {
        start: mr_formatReadable_(startDate),
        end: mr_formatReadable_(endDate)
      }
    };
    
  } catch (error) {
    Logger.log('Drive抽出エラー: ' + error);
    return {
      success: false,
      error: error.toString(),
      files: []
    };
  }
}

/**
 * プロジェクトフォルダIDを取得
 * @param {string} projectId
 * @return {string|null}
 */
function mr_drive_getProjectFolderId_(projectId) {
  try {
    const ss = b_ss_();
    const sheet = ss.getSheetByName('DB_Projects');
    
    if (!sheet) {
      Logger.log('DB_Projects シートが見つかりません');
      return null;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return null;
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const driveFolderIdIdx = headers.indexOf('driveFolderId');
    
    if (projectIdIdx === -1) {
      Logger.log('projectId 列が見つかりません');
      return null;
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        const folderId = driveFolderIdIdx !== -1 ? data[i][driveFolderIdIdx] : '';
        if (folderId) {
          return folderId;
        }
        Logger.log('driveFolderId が設定されていません');
        return null;
      }
    }
    
    Logger.log('プロジェクトが見つかりません: ' + projectId);
    return null;
    
  } catch (error) {
    Logger.log('フォルダID取得エラー: ' + error);
    return null;
  }
}

/**
 * 期間内に更新されたファイルを取得
 * @param {string} folderId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array}
 */
/**
 * 期間内に更新されたファイルを取得（Drive API v3 の Files.list を使用）
 * DriveAppの再帰走査ではなくAPI側で modifiedTime フィルタをかけるため高速。
 * @param {string} folderId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Array} DriveApp.File オブジェクトの配列
 */
function mr_drive_getUpdatedFiles_(folderId, startDate, endDate) {
  try {
    var startIso = startDate.toISOString();
    var endIso = endDate.toISOString();

    var folderIds = [];
    mr_drive_collectFolderIds_(folderId, folderIds);
    folderIds.push(folderId);

    var allFiles = [];
    var BATCH = 50;

    for (var b = 0; b < folderIds.length; b += BATCH) {
      var batch = folderIds.slice(b, b + BATCH);
      var parentClauses = batch.map(function(id) {
        return "'" + id + "' in parents";
      });
      var q = "(" + parentClauses.join(" or ") + ")"
        + " and modifiedTime >= '" + startIso + "'"
        + " and modifiedTime <= '" + endIso + "'"
        + " and trashed = false"
        + " and mimeType != 'application/vnd.google-apps.folder'";

      var pageToken = null;
      do {
        var params = {
          q: q,
          pageSize: 100,
          fields: "nextPageToken,files(id)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageToken: pageToken || undefined
        };
        var res = b_retry_(function() { return Drive.Files.list(params); }, { maxRetries: 2, label: 'Drive files' });
        if (res.files && res.files.length > 0) {
          for (var i = 0; i < res.files.length; i++) {
            try {
              allFiles.push(DriveApp.getFileById(res.files[i].id));
            } catch (e) {
              Logger.log("[Drive] ファイル取得スキップ: " + res.files[i].id + " " + e);
            }
          }
        }
        pageToken = res.nextPageToken;
      } while (pageToken);
    }

    Logger.log("[Drive] フォルダ数: " + folderIds.length + ", 該当ファイル: " + allFiles.length);
    return allFiles;

  } catch (error) {
    Logger.log('Driveファイル取得エラー: ' + error);
    return [];
  }
}

/**
 * フォルダ配下のサブフォルダIDを再帰的に収集（ファイルは触らない→高速）
 * @param {string} parentId
 * @param {Array} out
 * @param {number} [depth=0] - 現在の再帰深度
 */
var MR_DRIVE_MAX_FOLDERS_ = 200;   // フォルダ数上限（深度制限なし。Collector側のタイムバジェットが全体の安全弁）

function mr_drive_collectFolderIds_(parentId, out, depth) {
  depth = depth || 0;
  if (out.length >= MR_DRIVE_MAX_FOLDERS_) {
    Logger.log('[Drive] フォルダ数上限(' + MR_DRIVE_MAX_FOLDERS_ + ')到達 → 打ち切り (depth=' + depth + ')');
    return;
  }

  var pageToken = null;
  do {
    var params = {
      q: "'" + parentId + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      pageSize: 200,
      fields: "nextPageToken,files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken: pageToken || undefined
    };
    var res = b_retry_(function() { return Drive.Files.list(params); }, { maxRetries: 2, label: 'Drive folders' });
    if (res.files) {
      for (var i = 0; i < res.files.length; i++) {
        if (out.length >= MR_DRIVE_MAX_FOLDERS_) break;
        out.push(res.files[i].id);
        mr_drive_collectFolderIds_(res.files[i].id, out, depth + 1);
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken && out.length < MR_DRIVE_MAX_FOLDERS_);
}

/**
 * ファイル情報を拡充
 * @param {Array} files
 * @return {Array}
 */
function mr_drive_enrichFiles_(files) {
  return files.map(file => {
    const mimeType = file.getMimeType();
    const fileType = mr_drive_getFileType_(mimeType);
    
    // ownerがnullの場合に対応
    let ownerEmail = '';
    try {
      const owner = file.getOwner();
      ownerEmail = owner ? owner.getEmail() : '';
    } catch (error) {
      Logger.log(`Owner取得エラー (ファイル: ${file.getName()}): ${error}`);
    }
    
    return {
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      mime_type: mimeType,
      file_type: fileType,
      size: file.getSize(),
      last_updated: file.getLastUpdated(),
      last_updated_jst: mr_formatReadable_(file.getLastUpdated()),
      created_date: file.getDateCreated(),
      owner: ownerEmail,
      editors: mr_drive_getEditors_(file)
    };
  });
}

/**
 * ファイルタイプを判定
 * @param {string} mimeType
 * @return {string}
 */
function mr_drive_getFileType_(mimeType) {
  const typeMap = {
    'application/vnd.google-apps.document': 'ドキュメント',
    'application/vnd.google-apps.spreadsheet': 'スプレッドシート',
    'application/vnd.google-apps.presentation': 'プレゼンテーション',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'image/png': '画像(PNG)',
    'image/jpeg': '画像(JPEG)',
    'text/plain': 'テキスト'
  };
  
  return typeMap[mimeType] || 'その他';
}

/**
 * ファイルの編集者を取得
 * @param {File} file
 * @return {Array}
 */
function mr_drive_getEditors_(file) {
  try {
    const editors = file.getEditors();
    return editors.map(e => e.getEmail());
  } catch (error) {
    return [];
  }
}

/**
 * ファイルをタイプ別に分類
 * @param {Array} files
 * @return {Object}
 */
function mr_drive_categorizeFiles_(files) {
  const categorized = {};
  
  files.forEach(file => {
    const type = file.file_type;
    if (!categorized[type]) {
      categorized[type] = [];
    }
    categorized[type].push(file);
  });
  
  return categorized;
}

/**
 * 統計情報を計算
 * @param {Array} files
 * @return {Object}
 */
function mr_drive_calculateStats_(files) {
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMB = Math.round(totalSize / 1024 / 1024 * 10) / 10;
  
  // タイプ別集計
  const byType = {};
  files.forEach(file => {
    const type = file.file_type;
    byType[type] = (byType[type] || 0) + 1;
  });
  
  // 編集者別集計
  const editorCounts = {};
  files.forEach(file => {
    editorCounts[file.owner] = (editorCounts[file.owner] || 0) + 1;
  });
  
  const topEditors = Object.entries(editorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, count]) => ({ email, count }));
  
  return {
    totalFiles: totalFiles,
    totalSizeMB: totalSizeMB,
    byType: byType,
    topEditors: topEditors
  };
}

/**
 * Driveファイルを要約用テキストに変換
 * @param {Array} files
 * @param {number} limit
 * @return {string}
 */
function mr_drive_formatForSummary_(files, limit) {
  limit = limit || 30;
  
  if (!files || files.length === 0) {
    return '期間内に更新されたDriveファイルはありません。';
  }
  
  const selected = files.slice(0, limit);
  
  const formatted = selected.map(file => {
    return `【${file.file_type}】${file.name}\n更新: ${file.last_updated_jst}\n編集者: ${file.owner}\nURL: ${file.url}`;
  }).join('\n\n');
  
  return formatted;
}