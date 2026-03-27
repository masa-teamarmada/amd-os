/**
 * 320_AnnualReport_OneShot.gs
 * BWE（p11）年次報告書ワンショット生成
 *
 * 使い方:
 *   1. ANNUAL_collectSlack()  を手動実行（タイムアウト時は再実行）
 *   2. ANNUAL_collectGmail()  を手動実行（タイムアウト時は再実行）
 *   3. ANNUAL_collectDrive()  を手動実行（1回で全期間走査）
 *   4. ANNUAL_collectNotion() を手動実行（タイムアウト時は再実行）
 *   5. ANNUAL_generateReport() を手動実行 → TMP_AnnualReport に出力
 *   6. 完了後 TMP_AnnualCollectionCache / TMP_AnnualReport は削除してOK
 */

/* ===== 設定 ===== */
var ANNUAL_CFG_ = {
  projectId:  'p11',
  startYm:    '202408',
  endYm:      '202601',
  cacheSheet: 'TMP_AnnualCollectionCache',
  outSheet:   'TMP_AnnualReport',
  timeoutMs:  240000
};

/* ===== キャッシュ管理 ===== */
function annual_getCache_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ANNUAL_CFG_.cacheSheet);
  if (!sheet) {
    sheet = ss.insertSheet(ANNUAL_CFG_.cacheSheet);
    sheet.appendRow(['source', 'ym', 'text', 'itemCount', 'collectedAtJst']);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }
  return sheet;
}

function annual_isDone_(sheet, source, ym) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === source && String(rows[i][1]) === ym) return true;
  }
  return false;
}

function annual_saveCache_(sheet, source, ym, text, count) {
  sheet.appendRow([
    source, ym, text, count,
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
  ]);
}

function annual_ymRange_(startYm, endYm) {
  var yms = [];
  var y = parseInt(startYm.substring(0, 4), 10);
  var m = parseInt(startYm.substring(4, 6), 10);
  var ey = parseInt(endYm.substring(0, 4), 10);
  var em = parseInt(endYm.substring(4, 6), 10);
  while (y < ey || (y === ey && m <= em)) {
    yms.push(String(y) + (m < 10 ? '0' + m : String(m)));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return yms;
}

function annual_monthDates_(ym) {
  var y = parseInt(ym.substring(0, 4), 10);
  var m = parseInt(ym.substring(4, 6), 10);
  var start = new Date(y, m - 1, 1, 0, 0, 0);
  var end   = new Date(y, m, 0, 23, 59, 59);
  return { start: start, end: end };
}

/* ==========================================================
   Step 1: Slack収集（月ごと・再実行対応）
   ========================================================== */
function ANNUAL_collectSlack() {
  var sheet = annual_getCache_();
  var yms   = annual_ymRange_(ANNUAL_CFG_.startYm, ANNUAL_CFG_.endYm);
  var t0    = new Date();
  var cnt   = 0;

  for (var i = 0; i < yms.length; i++) {
    var ym = yms[i];
    if (annual_isDone_(sheet, 'slack', ym)) { Logger.log('skip slack: ' + ym); continue; }
    if (new Date() - t0 > ANNUAL_CFG_.timeoutMs) {
      Logger.log('Slack タイムアウト。残り ' + (yms.length - i) + ' 月。再実行して');
      return;
    }

    var d = annual_monthDates_(ym);
    var r = mr_extractFromSlack_(ANNUAL_CFG_.projectId, d.start, d.end);
    var text = '';
    var count = 0;
    if (r && r.success) {
      text = mr_slack_formatForSummary_(r.messages, 100);
      count = r.messages ? r.messages.length : 0;
    }
    annual_saveCache_(sheet, 'slack', ym, text, count);
    cnt++;
    Logger.log('slack ' + ym + ': ' + count + '件');
  }
  Logger.log('=== Slack完了 (' + cnt + '月処理) ===');
}

/* ==========================================================
   Step 2: Gmail収集（月ごと・再実行対応）
   ========================================================== */
function ANNUAL_collectGmail() {
  var sheet = annual_getCache_();
  var yms   = annual_ymRange_(ANNUAL_CFG_.startYm, ANNUAL_CFG_.endYm);
  var t0    = new Date();
  var cnt   = 0;

  for (var i = 0; i < yms.length; i++) {
    var ym = yms[i];
    if (annual_isDone_(sheet, 'gmail', ym)) { Logger.log('skip gmail: ' + ym); continue; }
    if (new Date() - t0 > ANNUAL_CFG_.timeoutMs) {
      Logger.log('Gmail タイムアウト。残り ' + (yms.length - i) + ' 月。再実行して');
      return;
    }

    var d = annual_monthDates_(ym);
    var r = mr_extractFromGmail_(ANNUAL_CFG_.projectId, d.start, d.end, 300);
    var text = '';
    var count = 0;
    if (r && r.success) {
      text = mr_gmail_formatForSummary_(r.threads, 300);
      count = r.threads ? r.threads.length : 0;
    }
    annual_saveCache_(sheet, 'gmail', ym, text, count);
    cnt++;
    Logger.log('gmail ' + ym + ': ' + count + '件');
  }
  Logger.log('=== Gmail完了 (' + cnt + '月処理) ===');
}

/* ==========================================================
   Step 3: Drive収集（全期間1回・軽量版）
   ========================================================== */
function ANNUAL_collectDrive() {
  var sheet = annual_getCache_();
  if (annual_isDone_(sheet, 'drive', 'all')) {
    Logger.log('Drive 収集済み。スキップ');
    return;
  }

  var startD = annual_monthDates_(ANNUAL_CFG_.startYm).start;
  var endD   = annual_monthDates_(ANNUAL_CFG_.endYm).end;

  var folderId = mr_drive_getProjectFolderId_(ANNUAL_CFG_.projectId);
  if (!folderId) {
    Logger.log('DriveフォルダIDなし');
    annual_saveCache_(sheet, 'drive', 'all', 'フォルダ未設定', 0);
    return;
  }

  Logger.log('Drive走査開始...');
  var files = [];
  var folder = DriveApp.getFolderById(folderId);
  annual_driveCollectLight_(folder, files, startD, endD);

  // 更新日でソート
  files.sort(function(a, b) { return a.lastUpdated - b.lastUpdated; });

  // 軽量テキスト化（エディタ情報なし）
  var lines = files.map(function(f) {
    return Utilities.formatDate(f.lastUpdated, 'Asia/Tokyo', 'yyyy/MM/dd')
      + '\t' + f.type + '\t' + f.name + '\t' + f.url;
  });

  var text = 'Drive更新ファイル一覧（' + files.length + '件）\n日付\tタイプ\tファイル名\tURL\n' + lines.join('\n');
  annual_saveCache_(sheet, 'drive', 'all', text, files.length);
  Logger.log('=== Drive完了: ' + files.length + '件 ===');
}

/** 軽量版：名前・タイプ・更新日・URLだけ取得 */
function annual_driveCollectLight_(folder, files, startD, endD) {
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    var lu = f.getLastUpdated();
    if (lu >= startD && lu <= endD) {
      files.push({
        name: f.getName(),
        type: mr_drive_getFileType_(f.getMimeType()),
        lastUpdated: lu,
        url: f.getUrl()
      });
    }
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    annual_driveCollectLight_(subs.next(), files, startD, endD);
  }
}

/* ==========================================================
   Step 4: Notion収集（月ごと・再実行対応）
   ========================================================== */
function ANNUAL_collectNotion() {
  var sheet = annual_getCache_();
  var yms   = annual_ymRange_(ANNUAL_CFG_.startYm, ANNUAL_CFG_.endYm);
  var t0    = new Date();
  var cnt   = 0;

  for (var i = 0; i < yms.length; i++) {
    var ym = yms[i];
    if (annual_isDone_(sheet, 'notion', ym)) { Logger.log('skip notion: ' + ym); continue; }
    if (new Date() - t0 > ANNUAL_CFG_.timeoutMs) {
      Logger.log('Notion タイムアウト。残り ' + (yms.length - i) + ' 月。再実行して');
      return;
    }

    var d = annual_monthDates_(ym);
    var r = mr_extractFromNotion_(ANNUAL_CFG_.projectId, d.start, d.end);
    var text = '';
    var count = 0;
    if (r && r.success) {
      try {
        text = mr_notion_formatForSummary_(r.pages, 30);
      } catch (e) {
        text = JSON.stringify(r.pages || []).substring(0, 40000);
      }
      count = r.pages ? r.pages.length : 0;
    }
    annual_saveCache_(sheet, 'notion', ym, text, count);
    cnt++;
    Logger.log('notion ' + ym + ': ' + count + '件');
  }
  Logger.log('=== Notion完了 (' + cnt + '月処理) ===');
}

/* ==========================================================
   Step 5: LLMで年次報告書生成（2パス方式）
   ========================================================== */

/**
 * Pass 1: 3ヶ月ずつMTG・契約情報を抽出
 * タイムアウト時は再実行可能
 */
/**
 * Pass 1: 1ヶ月ずつMTG・契約情報を抽出
 * タイムアウト・レートリミット時は再実行可能
 */
function ANNUAL_extractPass1() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ANNUAL_CFG_.cacheSheet);
  if (!sheet) { Logger.log('キャッシュなし'); return; }

  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) { Logger.log('ANTHROPIC_API_KEY 未設定'); return; }

  // --- キャッシュ読み出し ---
  var rows = sheet.getDataRange().getValues();
  var srcData = {};
  for (var i = 1; i < rows.length; i++) {
    var src = String(rows[i][0]);
    var ym  = String(rows[i][1]);
    var txt = String(rows[i][2] || '');
    if (!txt || src === 'pass1' || src === 'pass1drive') continue;
    if (src === 'drive' && ym === 'all') continue;
    if (!srcData[ym]) srcData[ym] = {};
    srcData[ym][src] = txt;
  }

  // --- Pass1済み確認 ---
  var doneYms = {};
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'pass1') doneYms[String(rows[i][1])] = true;
  }

  var sysPrompt = [
    'あなたはプロジェクトの活動ログから、MTG（会議）と契約に関する情報だけを抽出するアシスタント。',
    '',
    '以下のデータはBlue Water Energy株式会社（BWE）への経営支援に関するSlack/Gmail/Notionのログ。',
    '',
    '【やること】',
    '以下の2カテゴリに該当する情報だけを抽出。それ以外は完全に無視。',
    '',
    '■ MTG情報: 日時・参加者・議題・決定事項（分かる範囲で）',
    '■ 契約情報: 契約書名・相手先・交渉経緯・締結日（分かる範囲で）',
    '',
    '【ルール】',
    '- 推測しない。データにある事実のみ',
    '- 該当情報がなければ「該当なし」と書く',
    '- 簡潔に箇条書きで出力',
    '- 日時は yyyy/MM/dd 形式',
    '- メールの署名やフッターは無視'
  ].join('\n');

  var yms = annual_ymRange_(ANNUAL_CFG_.startYm, ANNUAL_CFG_.endYm);
  var t0 = new Date();
  var processed = 0;

  for (var j = 0; j < yms.length; j++) {
    var ym = yms[j];
    if (doneYms[ym]) { Logger.log('skip pass1: ' + ym); continue; }

    if (new Date() - t0 > ANNUAL_CFG_.timeoutMs) {
      Logger.log('Pass1 タイムアウト。再実行して');
      return;
    }

    var d = srcData[ym] || {};
    var label = ym.substring(0, 4) + '年' + parseInt(ym.substring(4), 10) + '月';
    var blockText = '--- ' + label + ' ---\n';
    var hasContent = false;

    // 各ソースを文字数制限して結合（OpenAIは制限緩いので大きめ）
    var limit = 30000;
    if (d.slack)  { blockText += '【Slack】\n'  + d.slack.substring(0, limit)  + '\n'; hasContent = true; }
    if (d.gmail)  { blockText += '【Gmail】\n'  + d.gmail.substring(0, limit)  + '\n'; hasContent = true; }
    if (d.notion) { blockText += '【Notion】\n' + d.notion.substring(0, limit) + '\n'; hasContent = true; }

    if (!hasContent) {
      annual_saveCache_(sheet, 'pass1', ym, '該当なし', 0);
      Logger.log('pass1 ' + ym + ': データなし');
      processed++;
      continue;
    }

    Logger.log('pass1 ' + ym + ' LLM呼び出し中... (' + blockText.length + '文字)');

    try {
      var resp = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + (PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || ''),
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify({
          model: 'gpt-4o-mini',
          input: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: '以下のデータからMTGと契約の情報だけ抽出して。\n\n' + blockText }
          ]
        }),
        muteHttpExceptions: true
      });

      var body = JSON.parse(resp.getContentText());
      var extracted = body.output_text || '';
      if (!extracted && body.output) {
        try {
          body.output.forEach(function(o) {
            if (o.content) o.content.forEach(function(c) {
              if (c.type === 'output_text' && c.text) extracted = c.text;
            });
          });
        } catch(e2) {}
      }
      if (extracted) {
        annual_saveCache_(sheet, 'pass1', ym, extracted, extracted.length);
        Logger.log('pass1 ' + ym + ': 抽出完了 (' + extracted.length + '文字)');
      } else {
        Logger.log('pass1 ' + ym + ' LLMエラー: ' + JSON.stringify(body).substring(0, 500));
        if (body.error && (body.error.type === 'rate_limit_error' || body.error.code === 'rate_limit_exceeded')) {
          Logger.log('rate limit hit。30秒待機...');
          Utilities.sleep(30000);
          j--;
          continue;
        }
        annual_saveCache_(sheet, 'pass1', ym, 'LLMエラー', 0);
      }
    } catch (e) {
      Logger.log('pass1 ' + ym + ' 例外: ' + e);
      annual_saveCache_(sheet, 'pass1', ym, '例外: ' + e.toString(), 0);
    }

    processed++;

    // レートリミット対策
    if (j < yms.length - 1) {
      Logger.log('120秒待機...');
      Utilities.sleep(120000);
    }
  }

  Logger.log('=== Pass1完了 (' + processed + '月処理) ===');
}

/**
 * Pass 1b: Drive情報からMTG・契約関連ファイルだけ抽出
 */
function ANNUAL_extractPass1Drive() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ANNUAL_CFG_.cacheSheet);
  if (!sheet) { Logger.log('キャッシュなし'); return; }

  if (annual_isDone_(sheet, 'pass1drive', 'all')) {
    Logger.log('Pass1Drive 済み。スキップ');
    return;
  }

  var openaiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!openaiKey) { Logger.log('OPENAI_API_KEY 未設定'); return; }

  // Drive生データ取得
  var rows = sheet.getDataRange().getValues();
  var driveAll = '';
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'drive' && String(rows[i][1]) === 'all') {
      driveAll = String(rows[i][2] || '');
      break;
    }
  }

  if (!driveAll) {
    Logger.log('Driveデータなし');
    annual_saveCache_(sheet, 'pass1drive', 'all', '該当なし', 0);
    return;
  }

  // 40000文字に制限
  driveAll = driveAll.substring(0, 40000);

  Logger.log('Pass1Drive LLM呼び出し中... (' + driveAll.length + '文字)');

  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: [
        'あなたはファイル一覧から、MTG（会議）と契約に関連するファイルだけを抽出するアシスタント。',
        '',
        '以下はGoogle Driveのファイル一覧（日付・タイプ・ファイル名・URL）。',
        '',
        '【やること】',
        '- 議事録、会議メモ、契約書、覚書、NDA、MOU、見積書、請求書など、',
        '  MTGまたは契約に関連しそうなファイルだけをリストアップ',
        '- ファイル名から判断。関連なさそうなものは無視',
        '- 日付・ファイル名・URLをそのまま出力'
      ].join('\n'),
      messages: [{
        role: 'user',
        content: '以下のファイル一覧からMTG・契約関連のファイルだけ抽出して。\n\n' + driveAll
      }]
    }),
    muteHttpExceptions: true
  });

  var body = JSON.parse(resp.getContentText());
  if (body.content && body.content.length > 0) {
    var extracted = body.content[0].text;
    annual_saveCache_(sheet, 'pass1drive', 'all', extracted, extracted.length);
    Logger.log('Pass1Drive 完了 (' + extracted.length + '文字)');
  } else {
    Logger.log('LLMエラー: ' + JSON.stringify(body).substring(0, 500));
  }
}

/**
 * Pass 2: Pass1の抽出結果を統合して最終報告書生成
 */
function ANNUAL_generateReport() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ANNUAL_CFG_.cacheSheet);
  if (!sheet) { Logger.log('キャッシュなし'); return; }

  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) { Logger.log('ANTHROPIC_API_KEY 未設定'); return; }

  // --- Pass1結果を収集 ---
  var rows = sheet.getDataRange().getValues();
  var pass1Blocks = [];
  for (var i = 1; i < rows.length; i++) {
    var rowSrc = String(rows[i][0]);
    if (rowSrc === 'pass1' || rowSrc === 'pass1drive') {
      var chunkLabel = String(rows[i][1]);
      var text = String(rows[i][2] || '');
      if (text && text !== '該当なし' && text !== 'LLMエラー') {
        var prefix = rowSrc === 'pass1drive' ? '【Drive関連ファイル】' : '【' + chunkLabel + '】';
        pass1Blocks.push(prefix + '\n' + text);
      }
    }
  }

  if (pass1Blocks.length === 0) {
    Logger.log('Pass1結果なし。先に ANNUAL_extractPass1() を実行して');
    return;
  }

  var combined = pass1Blocks.join('\n\n');
  Logger.log('Pass2入力: ' + combined.length + '文字');

  var sysPrompt = [
    'あなたはディープテックスタートアップの支援活動に関する年次報告書を作成するアシスタント。',
    '',
    '以下のデータは、Blue Water Energy株式会社（BWE）に対して',
    '株式会社チームアルマダ（AMD）が経営支援を行った期間（2024年8月〜2026年1月）について、',
    'MTGと契約に関する情報を抽出したもの。',
    '',
    '【報告書の構成】',
    '① 支援概要（この期間にAMDがBWEに対してどのような支援を行ったかの文章。',
    '   MTGと契約のデータから読み取れる範囲で、事実ベースに書く）',
    '② MTG概要リスト（時系列テーブル。日時・参加者・議題・決定事項。',
    '   データから読み取れる範囲で記載。推測はしない）',
    '③ 契約締結プロセス（締結された契約ごとに、経緯を時系列で記述。',
    '   契約書名、相手先、交渉過程、締結日など）',
    '',
    '【ルール】',
    '- 事実ベースで記載し、データにない情報は絶対に書かない',
    '- データが不十分で書けない項目は「データ不足のため記載不可」と明記する',
    '- 日時は日本時間で yyyy/MM/dd 形式',
    '- Markdown形式で出力。見出しは ## から',
    '- ②のMTGリストは表形式（Markdownテーブル）にする',
    '- 重複するMTGはマージすること'
  ].join('\n');

  Logger.log('Pass2 LLM呼び出し中...');
  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 12000,
      system: sysPrompt,
      messages: [{
        role: 'user',
        content: '以下がMTG・契約の抽出データ。年次報告書を作成して。\n\n' + combined
      }]
    }),
    muteHttpExceptions: true
  });

  var body = JSON.parse(resp.getContentText());
  if (!body.content || body.content.length === 0) {
    Logger.log('LLMエラー: ' + JSON.stringify(body));
    return;
  }

  var report = body.content[0].text;

  var outSheet = ss.getSheetByName(ANNUAL_CFG_.outSheet);
  if (!outSheet) {
    outSheet = ss.insertSheet(ANNUAL_CFG_.outSheet);
    outSheet.appendRow(['generatedAtJst', 'reportMarkdown']);
  }
  outSheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    report
  ]);
  Logger.log('=== 年次報告書生成完了。TMP_AnnualReport に保存 ===');
}

/* ==========================================================
   Step 1e: tl;dv収集（全期間1回）
   ========================================================== */
function ANNUAL_collectTldv() {
  var sheet = annual_getCache_();
  if (annual_isDone_(sheet, 'tldv', 'all')) {
    Logger.log('tl;dv 収集済み。スキップ');
    return;
  }

  var apiKey = PropertiesService.getScriptProperties().getProperty('TLDV_API_KEY');
  if (!apiKey) {
    Logger.log('TLDV_API_KEY 未設定');
    return;
  }

  if (!apiKey) {
    Logger.log('TLDV_API_KEY 未設定');
    return;
  }

  var startDate = annual_monthDates_(ANNUAL_CFG_.startYm).start;
  var endDate   = annual_monthDates_(ANNUAL_CFG_.endYm).end;
  var startIso = startDate.toISOString();
  var endIso   = endDate.toISOString();

  // BWE関連キーワード（キーワードごとにAPI検索→重複排除）
  var keywords = ['BWE', 'YU', 'mari', 'SR', '山大', '協和機電', '長崎', 'UntroD'];

  var allMeetings = [];
  var seenIds = {};

  for (var k = 0; k < keywords.length; k++) {
    var keyword = keywords[k];
    var page = 1;
    var limit = 100;
    var hasMore = true;

    while (hasMore) {
      var url = 'https://pasta.tldv.io/v1alpha1/meetings'
        + '?from=' + encodeURIComponent(startIso)
        + '&to=' + encodeURIComponent(endIso)
        + '&limit=' + limit
        + '&page=' + page
        + '&query=' + encodeURIComponent(keyword);

      Logger.log('tl;dv [' + keyword + '] page ' + page + '...');

      var resp = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        muteHttpExceptions: true
      });

      var code = resp.getResponseCode();
      if (code !== 200) {
        Logger.log('tl;dv API エラー [' + keyword + ']: ' + code + ' ' + resp.getContentText().substring(0, 300));
        break;
      }

      var body = JSON.parse(resp.getContentText());
      var meetings = body.results || [];

      for (var i = 0; i < meetings.length; i++) {
        var mid = meetings[i].id;
        if (!seenIds[mid]) {
          seenIds[mid] = true;
          allMeetings.push(meetings[i]);
        }
      }

      page++;
      if (meetings.length < limit || page > (body.pages || 1)) hasMore = false;
    }
  }

  // 日時順ソート
  allMeetings.sort(function(a, b) {
    return String(a.happenedAt || '').localeCompare(String(b.happenedAt || ''));
  });

  Logger.log('tl;dv ユニークミーティング数: ' + allMeetings.length);

  if (allMeetings.length === 0) {
    annual_saveCache_(sheet, 'tldv', 'all', 'ミーティングなし', 0);
    return;
  }

  // 各ミーティングのハイライトを取得
  var t0 = new Date();
  var blocks = [];

  for (var i = 0; i < allMeetings.length; i++) {
    if (new Date() - t0 > ANNUAL_CFG_.timeoutMs) {
      Logger.log('tl;dv タイムアウト。' + blocks.length + '/' + allMeetings.length + '件処理済み。途中保存');
      break;
    }

    var mtg = allMeetings[i];
    var mtgId = mtg.id || '';
    var mtgName = mtg.name || '(無題)';
    var mtgDate = mtg.happenedAt || '';

    var dateLabel = '';
    if (mtgDate) {
      try {
        var d = new Date(mtgDate);
        dateLabel = Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
      } catch (e) {
        dateLabel = String(mtgDate);
      }
    }

    var participants = [];
    if (mtg.organizer) participants.push(mtg.organizer.name || mtg.organizer.email || '');
    if (Array.isArray(mtg.invitees)) {
      mtg.invitees.forEach(function(inv) {
        participants.push(inv.name || inv.email || '');
      });
    }

    var block = '【' + dateLabel + '】' + mtgName + '\n';
    block += '参加者: ' + (participants.length > 0 ? participants.join(', ') : '不明') + '\n';

    // ハイライト取得
    try {
      var hlResp = UrlFetchApp.fetch('https://pasta.tldv.io/v1alpha1/meetings/' + mtgId + '/highlights', {
        method: 'get',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        muteHttpExceptions: true
      });

      if (hlResp.getResponseCode() === 200) {
        var hlBody = JSON.parse(hlResp.getContentText());
        var highlights = hlBody.data || [];
        if (highlights.length > 0) {
          var hlTexts = highlights.map(function(hl) {
            var topicTitle = (hl.topic && hl.topic.title) ? '[' + hl.topic.title + '] ' : '';
            var topicSummary = (hl.topic && hl.topic.summary) ? hl.topic.summary : '';
            var text = hl.text || topicSummary || '';
            return '- ' + topicTitle + text.substring(0, 400);
          });
          block += 'ハイライト:\n' + hlTexts.join('\n') + '\n';
        } else {
          block += 'ハイライト: なし\n';
        }
      }
    } catch (e) {
      block += 'ハイライト取得エラー: ' + e + '\n';
    }

    blocks.push(block);
  }

  var text = 'tl;dv ミーティング一覧（' + blocks.length + '/' + allMeetings.length + '件）\n\n' + blocks.join('\n---\n');
  annual_saveCache_(sheet, 'tldv', 'all', text, blocks.length);
  Logger.log('=== tl;dv完了: ' + blocks.length + '件 ===');
}