/**
 * 811_DesignLogMdSync.js
 *
 * design_log/ 配下のmdファイルを読み取り、各DevスプシのDB_DesignLogシートに同期する。
 * mdが正本、スプシは閲覧用ビュー。
 *
 * dailyトリガーで実行: cron_syncDesignLogMdToSheet_
 * 手動実行: temp_testDesignLogSync（テスト用）
 */

// ── 設定 ──────────────────────────────────────────
var DESIGN_LOG_CONFIG_ = {
  projects: [
    {
      name: 'amd_os',
      folderId: '1wGcNmVPcBki1h9VJ8QAXFOgFIJEs8iP2',
      spreadsheetId: '14ty5PwSOxdbTMZYL9_YZumcs6GasHKD6_QWcvFIMotg',
      sheetName: 'DB_DesignLog'
    },
    {
      name: 'chronicle',
      folderId: '15qP7bliyhviMmUEIeeXD7NYpOkGvk7Tx',
      spreadsheetId: '1ztUTw1fXGzzMsaVp0GBD1PngtzG33il7qj4X6eSAZEQ',
      sheetName: 'DB_DesignLog'
    }
  ],
  headers: ['logId', 'datetime', 'category', 'targetFiles', 'summary', 'reason', 'sessionNote', 'author']
};

// ── メインcron ────────────────────────────────────
/**
 * dailyトリガーで実行。全プロジェクトのmd→スプシ同期を行う。
 */
function cron_syncDesignLogMdToSheet_() {
  var config = DESIGN_LOG_CONFIG_;
  var results = [];

  for (var i = 0; i < config.projects.length; i++) {
    var pj = config.projects[i];
    try {
      var count = syncProjectDesignLog_(pj);
      results.push({ project: pj.name, rows: count, status: 'ok' });
    } catch (e) {
      results.push({ project: pj.name, error: e.message, status: 'error' });
      Logger.log('[DesignLogSync] Error for ' + pj.name + ': ' + e.message);
    }
  }

  Logger.log('[DesignLogSync] Results: ' + JSON.stringify(results));
  return results;
}

// ── プロジェクト単位の同期 ─────────────────────────
function syncProjectDesignLog_(pj) {
  // 1. DriveフォルダからMDファイルを読み取り
  var mdFiles = readDesignLogMdFiles_(pj.folderId);

  // 2. 全mdファイルをパースして行データに変換
  var allRows = [];
  for (var i = 0; i < mdFiles.length; i++) {
    var parsed = parseMdToRows_(mdFiles[i].content, mdFiles[i].name);
    allRows = allRows.concat(parsed);
  }

  // 3. datetime昇順でソート
  allRows.sort(function(a, b) {
    return a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0;
  });

  // 4. スプシに書き込み（ヘッダー行は保持、データ行を全置換）
  writeToSheet_(pj.spreadsheetId, pj.sheetName, allRows);

  Logger.log('[DesignLogSync] ' + pj.name + ': ' + allRows.length + ' rows synced');
  return allRows.length;
}

// ── Drive読み取り ─────────────────────────────────
function readDesignLogMdFiles_(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var mdFiles = [];

  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    // YYYY-MM_*.md のみ対象（HANDOFF_*.md等は除外）
    if (name.match(/^\d{4}-\d{2}_.*\.md$/) && file.getMimeType() === 'text/plain') {
      mdFiles.push({
        name: name,
        content: file.getBlob().getDataAsString('UTF-8')
      });
    }
  }

  // ファイル名順にソート
  mdFiles.sort(function(a, b) { return a.name < b.name ? -1 : 1; });
  return mdFiles;
}

// ── Markdownパーサー ──────────────────────────────
/**
 * mdファイルの内容を行データの配列に変換する。
 *
 * 期待フォーマット:
 * ## YYYY-MM-DD
 * ### [変更] ファイル名
 * - **内容**: ...
 * - **理由**: ...
 * - **補足**: ...
 */
function parseMdToRows_(content, fileName) {
  var lines = content.split('\n');
  var rows = [];
  var currentDate = '';
  var currentEntry = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // ## YYYY-MM-DD — 日付ヘッダー
    var dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      if (currentEntry) rows.push(finalizeEntry_(currentEntry));
      currentDate = dateMatch[1];
      currentEntry = null;
      continue;
    }

    // ### [カテゴリ] ファイル名 — エントリヘッダー
    var entryMatch = line.match(/^### \[(.+?)\]\s*(.+)/);
    if (entryMatch) {
      if (currentEntry) rows.push(finalizeEntry_(currentEntry));
      var catLabel = entryMatch[1];
      var catMap = { '変更': 'change', '新規': 'new', '削除': 'delete' };
      currentEntry = {
        datetime: currentDate,
        category: catMap[catLabel] || catLabel,
        targetFiles: entryMatch[2].trim(),
        summary: '',
        reason: '',
        sessionNote: ''
      };
      continue;
    }

    // - **内容**: ... / - **理由**: ... / - **補足**: ...
    if (currentEntry) {
      var fieldMatch = line.match(/^- \*\*(.+?)\*\*:\s*(.+)/);
      if (fieldMatch) {
        var field = fieldMatch[1];
        var value = fieldMatch[2].trim();
        if (field === '内容') currentEntry.summary = value;
        else if (field === '理由') currentEntry.reason = value;
        else if (field === '補足') currentEntry.sessionNote = value;
      }
    }
  }

  // 最後のエントリ
  if (currentEntry) rows.push(finalizeEntry_(currentEntry));

  return rows;
}

function finalizeEntry_(entry) {
  // logIdを生成（日付+ハッシュ）
  var hashSrc = entry.datetime + entry.targetFiles + entry.summary;
  var hash = simpleHash_(hashSrc);
  var logId = 'DL-' + entry.datetime.replace(/-/g, '') + '-' + hash;

  return {
    logId: logId,
    datetime: entry.datetime,
    category: entry.category,
    targetFiles: entry.targetFiles,
    summary: entry.summary,
    reason: entry.reason,
    sessionNote: entry.sessionNote,
    author: 'md-sync'
  };
}

function simpleHash_(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & 0x7FFFFFFF; // 正の整数に
  }
  return hash.toString(36);
}

// ── スプシ書き込み ────────────────────────────────
function writeToSheet_(spreadsheetId, sheetName, rows) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  var headers = DESIGN_LOG_CONFIG_.headers;

  // ヘッダー行（1行目）は保持。2行目以降を全クリアして書き直す
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  if (rows.length === 0) return;

  // 行データを2次元配列に変換
  var data = rows.map(function(row) {
    return headers.map(function(h) { return row[h] || ''; });
  });

  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
}

// ── テスト用 ──────────────────────────────────────
function temp_testDesignLogSync() {
  var results = cron_syncDesignLogMdToSheet_();
  Logger.log('Test results: ' + JSON.stringify(results, null, 2));
}
