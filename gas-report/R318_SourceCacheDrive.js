/** R318_SourceCacheDrive.gs
 * Drive → PDF → Claude API（ビジュアル込み要約）→ SourceCache のL1パイプライン。
 *
 * 処理フロー：
 *   1. 全activePJのdriveFolderIdを取得
 *   2. Phase1: 直近26h更新ファイル（差分優先）
 *   3. Phase2: 未処理の過去ファイル（budget残り分でバックフィル）
 *   4. 各ファイル → PDF化 → base64 → Claude API(document) → 要約テキスト
 *   5. SourceCacheにupsert (source='drive')
 *
 * 日次tokenバジェット（DRIVE_DAILY_INPUT_BUDGET_）で課金制御。
 * 差分が少ない日は自動的に過去ファイルが処理されていく。
 *
 * cron: 毎日 3:30 JST（317_SourceCacheCron完了後）
 *
 * 依存:
 *   - 311_SourceCacheRepo.gs（srcCache_upsert）
 *   - 309_MonthlyReport_DriveExtract.gs（mr_drive_getFileType_ 参照のみ）
 *   - 163_LlmRouter.gs（llm_getConfig で drive_extract のモデル設定を取得）
 *   - B_Sheets.gs（b_readTable_）
 *
 * ScriptProperties:
 *   - ANTHROPIC_API_KEY
 *   - NAVIGATOR_SPREADSHEET_ID
 */

// ===== 定数 =====
var DRIVE_DAILY_INPUT_BUDGET_ = 300000;       // 日次input tokenバジェット
var DRIVE_TIMEOUT_MS_         = 5 * 60 * 1000; // 5分（6分制限に余裕）
var DRIVE_MAX_BLOB_BYTES_     = 10 * 1024 * 1024; // 10MB（base64後≒13MB）
var DRIVE_SINCE_HOURS_        = 26;            // 差分ウィンドウ

// ===== cron エントリ =====

/**
 * 日次トリガーから呼ばれるエントリポイント。
 * トリガー設定: 毎日 3:30 JST
 */
function cron_collectDriveToSourceCache() {
  var startTime = Date.now();
  var tokensUsed = 0;
  var now = new Date();
  var sinceDate = new Date(startTime - DRIVE_SINCE_HOURS_ * 3600000);

  // 全activePJ（driveFolderId設定済みのみ）
  var pjs = b_readTable_('DB_Projects').filter(function(r) {
    return String(r.status || '').toLowerCase() === 'active'
      && String(r.driveFolderId || '').trim();
  });
  Logger.log('[Drive L1] start: ' + pjs.length + ' PJs with Drive folder');

  var stats = { delta: 0, backfill: 0, skipped: 0, errors: 0 };

  // === Phase 1: 差分（26h以内の更新ファイル）===
  for (var pi = 0; pi < pjs.length; pi++) {
    if (srcDrv_isOver_(startTime, tokensUsed)) break;
    var pj = pjs[pi];
    var projectId = String(pj.projectId);
    var folderId  = String(pj.driveFolderId).trim();

    try {
      var existingMap = srcDrv_loadExisting_(projectId);
      var deltaFiles  = srcDrv_listUpdated_(folderId, sinceDate, now);
      Logger.log('[Drive L1] ' + projectId + ' delta candidates: ' + deltaFiles.length);

      for (var fi = 0; fi < deltaFiles.length; fi++) {
        if (srcDrv_isOver_(startTime, tokensUsed)) break;
        var res = srcDrv_processFile_(projectId, deltaFiles[fi], existingMap);
        if (res.ok)          { tokensUsed += res.inputTokens; stats.delta++; }
        else if (res.skipped){ stats.skipped++; }
        else                 { stats.errors++; }
      }
    } catch (e) {
      Logger.log('[Drive L1] delta error ' + projectId + ': ' + e);
      stats.errors++;
    }
  }

  // === Phase 2: バックフィル（budget残り → 過去ファイルを古い順に処理）===
  if (!srcDrv_isOver_(startTime, tokensUsed)) {
    var bf = srcDrv_backfill_(pjs, tokensUsed, startTime);
    stats.backfill += bf.count;
    tokensUsed     += bf.tokensUsed;
  }

  Logger.log('[Drive L1] done: delta=' + stats.delta + ' backfill=' + stats.backfill
    + ' skip=' + stats.skipped + ' err=' + stats.errors + ' tok=' + tokensUsed);
}

// ===== トリガー設定（1回だけ手動実行）=====

function setupDriveSourceCacheTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'cron_collectDriveToSourceCache') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // JST 3:30 ≒ UTC 18:30 → atHour(18).nearMinute(30)
  ScriptApp.newTrigger('cron_collectDriveToSourceCache')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .nearMinute(30)
    .create();
  Logger.log('Trigger created: cron_collectDriveToSourceCache (daily ~3:30 JST)');
}

// ================================================================
//  ファイル処理
// ================================================================

/**
 * 1ファイルを処理: PDF化 → Claude API → SourceCache upsert
 * @param {string} projectId
 * @param {GoogleAppsScript.Drive.File} file
 * @param {Object} existingMap  itemId → modifiedTimeISO
 * @return {{ ok:boolean, skipped?:boolean, inputTokens?:number }}
 */
function srcDrv_processFile_(projectId, file, existingMap) {
  var fileId   = file.getId();
  var fileName = file.getName();
  var mimeType = file.getMimeType();
  var modISO   = file.getLastUpdated().toISOString();

  // フォルダ除外
  if (mimeType === 'application/vnd.google-apps.folder') return { skipped: true };

  // AMD OS生成物を除外（月次進捗スライド/PDF）
  if (fileName.indexOf('月次進捗_') !== -1) return { skipped: true };

  // 対象形式チェック
  if (!srcDrv_isSupported_(mimeType)) return { skipped: true };

  // 既にキャッシュ済み＆未更新ならスキップ
  if (existingMap && existingMap[fileId] === modISO) return { skipped: true };

  // --- PDF化 ---
  var pdfBlob;
  try {
    pdfBlob = srcDrv_toPdf_(file, mimeType);
  } catch (e) {
    Logger.log('  PDF変換失敗 [' + fileName + ']: ' + e);
    return { ok: false, error: 'pdf: ' + e };
  }
  if (!pdfBlob) return { skipped: true };

  var blobSize = pdfBlob.getBytes().length;
  if (blobSize > DRIVE_MAX_BLOB_BYTES_) {
    Logger.log('  サイズ超過 [' + fileName + ']: ' + Math.round(blobSize / 1024 / 1024) + 'MB');
    return { skipped: true };
  }

  // --- Claude API ---
  var summary, inputTokens = 0;
  try {
    var res = srcDrv_askClaude_(pdfBlob, fileName, mimeType);
    summary     = res.text;
    inputTokens = res.inputTokens || 0;
  } catch (e) {
    Logger.log('  Claude API失敗 [' + fileName + ']: ' + e);
    return { ok: false, error: 'claude: ' + e };
  }

  // --- SourceCache upsert ---
  var modDate = file.getLastUpdated();
  var ym = String(modDate.getFullYear()) + ('0' + (modDate.getMonth() + 1)).slice(-2);

  srcCache_upsert({
    projectId:    projectId,
    ym:           ym,
    source:       'drive',
    itemId:       fileId,
    title:        fileName,
    itemDate:     srcDrv_fmtJst_(modDate),
    contentText:  summary || '',
    metadataJson: JSON.stringify({
      mimeType:     mimeType,
      fileType:     mr_drive_getFileType_(mimeType),
      url:          file.getUrl(),
      size:         file.getSize(),
      modifiedTime: modISO,
      owner: (function() { try { return file.getOwner().getEmail(); } catch(_) { return ''; } })()
    })
  });

  Logger.log('  ✓ ' + fileName + ' (' + inputTokens + ' tok, ' + Math.round(blobSize / 1024) + 'KB)');
  return { ok: true, inputTokens: inputTokens };
}

// ================================================================
//  PDF変換
// ================================================================

/**
 * 任意のDriveファイルをPDF Blobに変換
 * @param {GoogleAppsScript.Drive.File} file
 * @param {string} mimeType
 * @return {GoogleAppsScript.Base.Blob|null}
 */
function srcDrv_toPdf_(file, mimeType) {
  // --- Google native → getAs PDF ---
  if (mimeType === 'application/vnd.google-apps.document'
   || mimeType === 'application/vnd.google-apps.spreadsheet'
   || mimeType === 'application/vnd.google-apps.presentation') {
    return file.getAs('application/pdf');
  }

  // --- 元がPDF ---
  if (mimeType === 'application/pdf') {
    return file.getBlob();
  }

  // --- Office形式 → Drive APIでGoogle形式にコピー → PDF → 一時ファイル削除 ---
  var CONVERT_MAP = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':     'application/vnd.google-apps.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':           'application/vnd.google-apps.spreadsheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':   'application/vnd.google-apps.presentation',
    'application/msword':           'application/vnd.google-apps.document',
    'application/vnd.ms-excel':     'application/vnd.google-apps.spreadsheet',
    'application/vnd.ms-powerpoint':'application/vnd.google-apps.presentation'
  };
  var targetMime = CONVERT_MAP[mimeType];
  if (!targetMime) return null;

  var tempMeta = Drive.Files.copy(
    { name: '_tmp_amdos_' + file.getName(), mimeType: targetMime },
    file.getId()
  );
  try {
    var pdfBlob = DriveApp.getFileById(tempMeta.id).getAs('application/pdf');
    DriveApp.getFileById(tempMeta.id).setTrashed(true);
    return pdfBlob;
  } catch (e) {
    try { DriveApp.getFileById(tempMeta.id).setTrashed(true); } catch (_) {}
    throw e;
  }
}

// ================================================================
//  Claude API（PDFドキュメント送信）
// ================================================================

/**
 * PDF blobをClaude APIに送ってビジュアル込み要約を取得
 * @param {GoogleAppsScript.Base.Blob} pdfBlob
 * @param {string} fileName
 * @param {string} originalMime
 * @return {{ text:string, inputTokens:number }}
 */
function srcDrv_askClaude_(pdfBlob, fileName, originalMime) {
  var apiKey = String(
    PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || ''
  ).trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  var base64 = Utilities.base64Encode(pdfBlob.getBytes());

  // プロンプトはDB_TsukuyomiContextから取得
  var prompt = srcDrv_getPrompt_()
    .replace(/\{fileName\}/g,  fileName)
    .replace(/\{mimeType\}/g,  originalMime);
  if (!prompt || !prompt.trim()) {
    prompt = 'このドキュメント（' + fileName + '）の内容を日本語で構造化して要約してください。';
  }

  // モデル設定はDB_LlmModelConfigのusageKey="drive_extract"
  var cfg      = llm_getConfig('drive_extract');
  var model    = cfg.model || 'claude-sonnet-4-5-20250929';
  var maxTok   = Number(cfg.maxTokens || 2048);

  var payload = {
    model:      model,
    max_tokens: maxTok,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type:       'base64',
            media_type: 'application/pdf',
            data:       base64
          }
        },
        { type: 'text', text: prompt }
      ]
    }]
  };

  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:      'post',
    contentType: 'application/json',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version':  '2023-06-01',
      'anthropic-beta':     'pdfs-2024-09-25'
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Claude ' + code + ': ' + body.slice(0, 400));
  }

  var data   = JSON.parse(body);
  var inTok  = (data.usage && data.usage.input_tokens) || 0;
  var outTxt = '';
  if (Array.isArray(data.content)) {
    for (var i = 0; i < data.content.length; i++) {
      if (data.content[i].type === 'text') outTxt += data.content[i].text;
    }
  }
  return { text: outTxt.trim(), inputTokens: inTok };
}

// ================================================================
//  プロンプト取得
// ================================================================

/**
 * DB_TsukuyomiContext から tag='drive_extract' を探す。
 * なければハードコードfallback（初回セットアップ時のみ）。
 */
function srcDrv_getPrompt_() {
  var FALLBACK = 'ファイル名: {fileName}\n元の形式: {mimeType}\n\n'
    + 'このドキュメントの内容を日本語で構造化して抽出してください。'
    + '図表・グラフ・表の内容も含めてください。数値データは正確に残してください。'
    + '出力は2000文字以内。Markdown形式で構造化。';

  try {
    var rows = srcDrv_readContext_();
    for (var i = 0; i < rows.length; i++) {
      var tags = String(rows[i].tags || '');
      var status = String(rows[i].status || '');
      var content = String(rows[i].systemPrompt || rows[i].content || '').trim();
      if (tags.indexOf('drive_extract') !== -1
       && status !== 'archived'
       && content.length > 0) {
        return content;
      }
    }
  } catch (e) {
    Logger.log('[Drive] getPrompt error: ' + e);
  }
  Logger.log('[Drive] prompt fallback used');
  return FALLBACK;
}

/** DB_TsukuyomiContext読み出し（Protocol Store or 本体） */
function srcDrv_readContext_() {
  try {
    var ssId = PropertiesService.getScriptProperties()
      .getProperty('PROTOCOL_STORE_SPREADSHEET_ID');
    if (ssId) {
      var ss = SpreadsheetApp.openById(ssId);
      var sh = ss.getSheetByName('DB_TsukuyomiContext');
      if (sh && sh.getLastRow() >= 2) {
        var data = sh.getDataRange().getValues();
        var hdr  = data[0].map(function(h) { return String(h).trim(); });
        var out  = [];
        for (var i = 1; i < data.length; i++) {
          var obj = {};
          for (var c = 0; c < hdr.length; c++) obj[hdr[c]] = data[i][c];
          out.push(obj);
        }
        return out;
      }
    }
  } catch (_) {}
  return b_readTable_('DB_TsukuyomiContext');
}

// ================================================================
//  バックフィル（過去未処理ファイルを古い順に）
// ================================================================

function srcDrv_backfill_(pjs, tokensUsedSoFar, startTime) {
  var budget    = DRIVE_DAILY_INPUT_BUDGET_ - tokensUsedSoFar;
  var count     = 0;
  var tokUsed   = 0;

  for (var pi = 0; pi < pjs.length; pi++) {
    if (srcDrv_isOver_(startTime, tokensUsedSoFar + tokUsed)) break;

    var projectId  = String(pjs[pi].projectId);
    var folderId   = String(pjs[pi].driveFolderId).trim();
    var existMap   = srcDrv_loadExisting_(projectId);

    // フォルダ全ファイル取得（時間フィルタなし）
    var allFiles = srcDrv_listAllFiles_(folderId);

    Logger.log('[Drive backfill] ' + projectId + ': ' + allFiles.length + ' files, existMap=' + Object.keys(existMap).length);

    // 古い順ソート
    allFiles.sort(function(a, b) {
      return a.getLastUpdated().getTime() - b.getLastUpdated().getTime();
    });

    for (var fi = 0; fi < allFiles.length; fi++) {
      if (srcDrv_isOver_(startTime, tokensUsedSoFar + tokUsed)) break;
      if (tokUsed >= budget) break;

      var f    = allFiles[fi];
      var fId  = f.getId();
      var fMod = f.getLastUpdated().toISOString();

      // 既にキャッシュ済み＆同一modifiedTime → スキップ
      if (existMap[fId] === fMod) continue;

      var res = srcDrv_processFile_(projectId, f, existMap);
      if (res.ok) {
        tokUsed += res.inputTokens;
        count++;
      }
    }
  }
  return { count: count, tokensUsed: tokUsed };
}

// ================================================================
//  既存キャッシュ読み込み（dedup用）
// ================================================================

/**
 * SourceCacheからsource='drive'の既存itemId→modifiedTimeマップを返す
 */
function srcDrv_loadExisting_(projectId) {
  var map = {};
  try {
    var ssId = PropertiesService.getScriptProperties()
      .getProperty('NAVIGATOR_SPREADSHEET_ID');
    if (!ssId) return map;
    var ss = SpreadsheetApp.openById(ssId);
    var sh = ss.getSheetByName('DB_SourceCache');
    if (!sh || sh.getLastRow() < 2) return map;

    var data = sh.getDataRange().getValues();
    var hdr  = data[0].map(function(h) { return String(h).trim(); });
    var cPrj  = hdr.indexOf('projectId');
    var cSrc  = hdr.indexOf('source');
    var cItem = hdr.indexOf('itemId');
    var cMeta = hdr.indexOf('metadataJson');

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cPrj]) === projectId && String(data[i][cSrc]) === 'drive') {
        var itemId = String(data[i][cItem]);
        var modT   = '';
        try {
          var m = JSON.parse(String(data[i][cMeta] || '{}'));
          modT = m.modifiedTime || '';
        } catch (_) {}
        map[itemId] = modT;
      }
    }
  } catch (e) {
    Logger.log('[Drive] loadExisting error: ' + e);
  }
  return map;
}

// ================================================================
//  Drive ファイル一覧（v3 API）
// ================================================================

/**
 * フォルダ配下の全サブフォルダIDを再帰収集（Drive API v3）
 */
function srcDrv_collectFolderIds_(parentId, out) {
  var pageToken = null;
  do {
    var res = Drive.Files.list({
      q: "'" + parentId + "' in parents"
        + " and mimeType = 'application/vnd.google-apps.folder'"
        + " and trashed = false",
      pageSize: 200,
      fields:   'nextPageToken,files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken: pageToken || undefined
    });
    if (res.files) {
      for (var i = 0; i < res.files.length; i++) {
        out.push(res.files[i].id);
        srcDrv_collectFolderIds_(res.files[i].id, out);
      }
    }
    pageToken = res.nextPageToken;
  } while (pageToken);
}

/**
 * フォルダ配下の全ファイルを取得（時間フィルタなし、バックフィル用）
 */
function srcDrv_listAllFiles_(folderId) {
  var folderIds = [];
  srcDrv_collectFolderIds_(folderId, folderIds);
  folderIds.push(folderId);

  var allFiles = [];
  var BATCH = 50;

  for (var b = 0; b < folderIds.length; b += BATCH) {
    var batch = folderIds.slice(b, b + BATCH);
    var pClauses = batch.map(function(id) { return "'" + id + "' in parents"; });
    var q = '(' + pClauses.join(' or ') + ')'
      + ' and trashed = false'
      + " and mimeType != 'application/vnd.google-apps.folder'";

    var pageToken = null;
    do {
      var res = Drive.Files.list({
        q: q, pageSize: 100,
        fields: 'nextPageToken,files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken || undefined
      });
      if (res.files) {
        for (var i = 0; i < res.files.length; i++) {
          try { allFiles.push(DriveApp.getFileById(res.files[i].id)); } catch (_) {}
        }
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  }

  Logger.log('[Drive backfill] ' + folderId + ' total files: ' + allFiles.length);
  return allFiles;
}

/**
 * 直近26h更新ファイル取得（309のmr_drive_getUpdatedFiles_を利用）
 * 309に依存したくない場合はここで完結させる
 */
function srcDrv_listUpdated_(folderId, sinceDate, untilDate) {
  var folderIds = [];
  srcDrv_collectFolderIds_(folderId, folderIds);
  folderIds.push(folderId);

  var startIso = sinceDate.toISOString();
  var endIso   = untilDate.toISOString();
  var allFiles = [];
  var BATCH = 50;

  for (var b = 0; b < folderIds.length; b += BATCH) {
    var batch = folderIds.slice(b, b + BATCH);
    var pClauses = batch.map(function(id) { return "'" + id + "' in parents"; });
    var q = '(' + pClauses.join(' or ') + ')'
      + " and modifiedTime >= '" + startIso + "'"
      + " and modifiedTime <= '" + endIso + "'"
      + ' and trashed = false'
      + " and mimeType != 'application/vnd.google-apps.folder'";

    var pageToken = null;
    do {
      var res = Drive.Files.list({
        q: q, pageSize: 100,
        fields: 'nextPageToken,files(id)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken || undefined
      });
      if (res.files) {
        for (var i = 0; i < res.files.length; i++) {
          try { allFiles.push(DriveApp.getFileById(res.files[i].id)); } catch (_) {}
        }
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  }
  return allFiles;
}

// ================================================================
//  ヘルパー
// ================================================================

function srcDrv_isSupported_(mimeType) {
  return [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
  ].indexOf(mimeType) !== -1;
}

function srcDrv_isOver_(startTime, tokensUsed) {
  return (Date.now() - startTime > DRIVE_TIMEOUT_MS_)
      || (tokensUsed >= DRIVE_DAILY_INPUT_BUDGET_);
}

function srcDrv_fmtJst_(date) {
  var d = new Date(date.getTime() + 9 * 3600000);
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 '
    + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
}