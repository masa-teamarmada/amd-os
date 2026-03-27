/**
 * R304_MonthlyReport_Repo.gs
 * 
 * 役割:
 * - DB_MonthlyReports の読み書き
 * - 月次報告書の正本管理
 * 
 * 依存:
 * - B_Sheets.gs (既存のDB操作)
 * - 310_MonthlyReport_Formatter.gs
 */

/**
 * DB_MonthlyReports のヘッダを保証
 * @return {Sheet}
 */
function mr_repo_ensureMonthlyReportsHeader_() {
  // スプレッドシートを取得
  const ss = b_ss_();
  let sheet = ss.getSheetByName('DB_MonthlyReports');
  
  const headers = [
    'reportId',           // レポートID (自動生成)
    'projectId',          // プロジェクトID
    'ym',                 // 対象年月(yyyymm)
    'draftContent',       // 生成ドラフト(Markdown)
    'finalContent',       // 最終版(Markdown)
    'totalValuePoints',   // 今月の総価値ポイント
    'generatedAtJst',     // 生成日時(JST)
    'generatedBy',        // 生成者(system/memberId)
    'approvedAtJst',      // 承認日時(JST)
    'approvedBy',         // 承認者(memberId)
    'submittedAtJst',     // 提出日時(JST)
    'submittedBy',        // 提出者(memberId)
    'status',             // draft/approved/submitted
    'pdfFileId',          // Drive上のPDFファイルID
    'collectionDataJson', // 収集データ(JSON) ※旧形式・互換用
    'collectionSummaryJson',
    'collectionSlackJson',
    'collectionNotionJson',
    'collectionGmailJson',
    'collectionDriveJson',
    'note',               // 備考
    'slideFileId',        // スライドファイルID
    'lastUpdateType',     // generated / delta_updated / manual
    'lastDeltaItems',     // 差分取り込み件数
    'lastCronAt',         // 最後にcronで処理された日時(JST)
    'sectionSummary',     // エグゼクティブサマリー
    'sectionProgress',    // 今月の主な進捗
    'sectionIssues',      // 課題と対応
    'sectionNextMonth',   // 次月の予定
    'sectionMembers',     // メンバー貢献サマリー
    'slideSummary',        // スライド用サマリー
    'pendingDraftContent', // 保留中の更新版テキスト
    'pendingDeltaSummary', // 差分概要（件数・ソース内訳）
    'pendingDeltaAt',      // 差分生成日時(JST)
    'pendingStatus',       // none / pending / rejected
    'fixedAtJst',          // FIX確定日時(JST)
    'fixedBy'              // FIX確定者(memberId/email)
  ];
  
  // シートが存在しない場合は作成してヘッダを設定
  if (!sheet) {
    Logger.log('DB_MonthlyReports シートを新規作成');
    sheet = ss.insertSheet('DB_MonthlyReports');
    
    // ヘッダを直接設定
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    
    // 列幅を自動調整
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    Logger.log('ヘッダ設定完了: ' + headers.length + '列');
    return sheet;
  }
  
  // 既存シートの場合、ヘッダを確認・修正
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow === 0 || lastCol === 0) {
    // 空シートの場合、ヘッダを設定
    Logger.log('空シートにヘッダを設定');
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
    return sheet;
  }
  
  // ヘッダの整合性確認
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // ヘッダが異なる、または不足している場合
  if (existingHeaders.length !== headers.length || !headers.every((h, i) => existingHeaders[i] === h)) {
    Logger.log('ヘッダを更新');
    
    // 必要に応じて列を追加
    if (lastCol < headers.length) {
      for (let i = lastCol + 1; i <= headers.length; i++) {
        sheet.insertColumnAfter(lastCol);
      }
    }
    
    // ヘッダを設定
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');
  }
  
  return sheet;
}

/**
 * 月次報告書ドラフトを保存
 * @param {string} projectId
 * @param {string} ym
 * @param {string} draftContent
 * @param {Object} collectionData
 * @return {string} reportId
 */
/**
 * 月次報告書ドラフトを保存
 * @param {string} projectId
 * @param {string} ym
 * @param {string} draftContent
 * @param {Object} collectionData
 * @param {Object} [meta] - オプション {updateType, deltaItems}
 * @return {string} reportId
 */
function mr_repo_saveDraft_(projectId, ym, draftContent, collectionData, meta) {
  var sheet = mr_repo_ensureMonthlyReportsHeader_();
  
  var existing = mr_repo_getByProjectYm_(projectId, ym);
  
  var now = mr_now_();
  var reportId = existing ? existing.reportId : mr_repo_generateReportId_(projectId, ym);
  
  // collectionDataをソース別に分割保存
  var split = mr_repo_splitCollectionData_(collectionData);
  
  // メタ情報（渡されなければデフォルト）
  var m = meta || {};
  var updateType = m.updateType || 'generated';
  var deltaItems = (m.deltaItems !== undefined) ? m.deltaItems : '';
  var cronAt = m.cronAt || '';
  
  // draftContentからセクション分離
  var sec = mr_repo_parseSections_(draftContent);

  var row = {
    reportId: reportId,
    projectId: projectId,
    ym: ym,
    draftContent: draftContent,
    finalContent: existing ? existing.finalContent : '',
    totalValuePoints: 0,
    generatedAtJst: mr_formatJst_(now),
    generatedBy: 'system',
    approvedAtJst: existing ? existing.approvedAtJst : '',
    approvedBy: existing ? existing.approvedBy : '',
    submittedAtJst: existing ? existing.submittedAtJst : '',
    submittedBy: existing ? existing.submittedBy : '',
    status: 'draft',
    pdfFileId: existing ? existing.pdfFileId : '',
    collectionSummaryJson: split.summary,
    collectionSlackJson: split.slack,
    collectionNotionJson: split.notion,
    collectionGmailJson: split.gmail,
    collectionDriveJson: split.drive,
    collectionDataJson: '',
    note: existing ? existing.note : '',
    slideFileId: existing ? (existing.slideFileId || '') : '',
    lastUpdateType: updateType,
    lastDeltaItems: String(deltaItems),
    lastCronAt: cronAt,
    sectionSummary: sec.sectionSummary,
    sectionProgress: sec.sectionProgress,
    sectionIssues: sec.sectionIssues,
    sectionNextMonth: sec.sectionNextMonth,
    sectionMembers: sec.sectionMembers,
    slideSummary: sec.slideSummary,
    pendingDraftContent: existing ? (existing.pendingDraftContent || '') : '',
    pendingDeltaSummary: existing ? (existing.pendingDeltaSummary || '') : '',
    pendingDeltaAt: existing ? (existing.pendingDeltaAt || '') : '',
    pendingStatus: existing ? (existing.pendingStatus || 'none') : 'none'
  };
  
  b_upsertRow_('DB_MonthlyReports', ['reportId'], row);
  
  // ym列を文字列フォーマットに強制
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var ymColIdx = headers.indexOf('ym');
  if (ymColIdx >= 0) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][headers.indexOf('reportId')] || '') === reportId) {
        sheet.getRange(i + 1, ymColIdx + 1).setNumberFormat('@');
        break;
      }
    }
  }
  
  Logger.log('月次報告書保存完了: ' + reportId);
  return reportId;
}

/**
 * collectionDataをソース別JSONに分割
 * 各ソース40,000文字上限でtruncate
 */
/**
 * collectionDataから各ソースの要約テキストを抽出して保存用に整形。
 * 生データではなくフォーマット済みの抽出情報を保存する。
 */
function mr_repo_splitCollectionData_(collectionData) {
  var result = { summary: '', slack: '', notion: '', gmail: '', drive: '' };
  
  if (!collectionData) return result;
  
  // summary（メタ情報）
  try {
    result.summary = JSON.stringify({
      summary: collectionData.summary || {},
      collectedAt: collectionData.collectedAt || ''
    });
  } catch (e) { result.summary = '{}'; }
  
  // Notion → フォーマット済みテキスト
  try {
    if (collectionData.notion && collectionData.notion.success && collectionData.notion.pages && collectionData.notion.pages.length > 0) {
      var notionFormatted = mr_notion_formatForSummary_(collectionData.notion.pages.slice(0, 15));
      result.notion = JSON.stringify({
        pageCount: collectionData.notion.pages.length,
        formatted: notionFormatted
      });
    }
  } catch (e) { result.notion = '{"error":"' + String(e).substring(0, 100) + '"}'; }
  
  // Slack → フォーマット済みテキスト
  try {
    if (collectionData.slack && collectionData.slack.success && collectionData.slack.messages && collectionData.slack.messages.length > 0) {
      var slackFormatted = mr_slack_formatForSummary_(collectionData.slack.messages, 20);
      result.slack = JSON.stringify({
        messageCount: collectionData.slack.messages.length,
        stats: collectionData.slack.stats || {},
        formatted: slackFormatted
      });
    }
  } catch (e) { result.slack = '{"error":"' + String(e).substring(0, 100) + '"}'; }
  
  // Gmail → フォーマット済みテキスト
  try {
    if (collectionData.gmail && collectionData.gmail.success && collectionData.gmail.threads && collectionData.gmail.threads.length > 0) {
      var gmailFormatted = mr_gmail_formatForSummary_(collectionData.gmail.threads, 10);
      result.gmail = JSON.stringify({
        threadCount: collectionData.gmail.threads.length,
        formatted: gmailFormatted
      });
    }
  } catch (e) { result.gmail = '{"error":"' + String(e).substring(0, 100) + '"}'; }
  
  // Drive → フォーマット済みテキスト
  try {
    if (collectionData.drive && collectionData.drive.success && collectionData.drive.files && collectionData.drive.files.length > 0) {
      var driveFormatted = mr_drive_formatForSummary_(collectionData.drive.files, 15);
      result.drive = JSON.stringify({
        fileCount: collectionData.drive.files.length,
        formatted: driveFormatted
      });
    }
  } catch (e) { result.drive = '{"error":"' + String(e).substring(0, 100) + '"}'; }
  
  return result;
}

/**
 * レポートIDを生成
 * @param {string} projectId
 * @param {string} ym
 * @return {string}
 */
function mr_repo_generateReportId_(projectId, ym) {
  return `MR_${projectId}_${ym}`;
}

/**
 * プロジェクトと年月で月次報告書を取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object|null}
 */
function mr_repo_getByProjectYm_(projectId, ym) {
  const sheet = mr_repo_ensureMonthlyReportsHeader_();
  const data = b_readTable_('DB_MonthlyReports');
  
  return data.find(row => 
    row.projectId === projectId && 
    row.ym === ym
  );
}

/**
 * 月次報告書を承認
 * @param {string} reportId
 * @param {string} memberId
 * @param {string} finalContent - 最終版(編集後)
 * @return {boolean}
 */
function mr_repo_approve_(reportId, memberId, finalContent) {
  const sheet = mr_repo_ensureMonthlyReportsHeader_();
  const data = b_readTable_('DB_MonthlyReports');
  
  const report = data.find(row => row.reportId === reportId);
  
  if (!report) {
    throw new Error('報告書が見つかりません: ' + reportId);
  }
  
  const now = mr_now_();
  
  const updatedRow = {
    ...report,
    finalContent: finalContent || report.draftContent,
    approvedAtJst: mr_formatJst_(now),
    approvedBy: memberId,
    status: 'approved'
  };
  
  // 修正: シート名を渡す、keyFieldsを配列にする
  b_upsertRow_('DB_MonthlyReports', ['reportId'], updatedRow);
  
  Logger.log(`月次報告書承認完了: ${reportId} by ${memberId}`);
  return true;
}

/**
 * 月次報告書を提出済みに更新
 * @param {string} reportId
 * @param {string} memberId
 * @param {string} pdfFileId
 * @return {boolean}
 */
function mr_repo_submit_(reportId, memberId, pdfFileId) {
  const sheet = mr_repo_ensureMonthlyReportsHeader_();
  const data = b_readTable_('DB_MonthlyReports');
  
  const report = data.find(row => row.reportId === reportId);
  
  if (!report) {
    throw new Error('報告書が見つかりません: ' + reportId);
  }
  
  const now = mr_now_();
  
  const updatedRow = {
    ...report,
    submittedAtJst: mr_formatJst_(now),
    submittedBy: memberId,
    status: 'submitted',
    pdfFileId: pdfFileId || report.pdfFileId
  };
  
  // 修正: シート名を渡す、keyFieldsを配列にする
  b_upsertRow_('DB_MonthlyReports', ['reportId'], updatedRow);
  
  Logger.log(`月次報告書提出完了: ${reportId} by ${memberId}`);
  
  // DB_BillingCycleにも反映
  mr_repo_updateBillingCycle_(report.projectId, report.ym, reportId, pdfFileId);
  
  return true;
}

/**
 * BillingCycleに月次報告書情報を反映
 * @param {string} projectId
 * @param {string} ym
 * @param {string} reportId
 * @param {string} pdfFileId
 */
function mr_repo_updateBillingCycle_(projectId, ym, reportId, pdfFileId) {
  try {
    const ss = b_ss_();
    const sheet = ss.getSheetByName('DB_BillingCycle');
    
    if (!sheet) {
      Logger.log('DB_BillingCycle シートが見つかりません');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return;
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const ymIdx = headers.indexOf('ym');
    const billingCycleIdIdx = headers.indexOf('billingCycleId');
    
    if (projectIdIdx === -1 || ymIdx === -1) return;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId && data[i][ymIdx] === ym) {
        const cycle = {};
        headers.forEach((header, idx) => {
          cycle[header] = data[i][idx];
        });
        
        const updatedCycle = {
          ...cycle,
          monthlyReportGenerated: true,
          monthlyReportId: reportId,
          monthlyReportPdfFileId: pdfFileId || cycle.monthlyReportPdfFileId
        };
        
        // b_upsertRow_ の代わりに直接更新
        const rowArray = headers.map(header => updatedCycle[header] || '');
        sheet.getRange(i + 1, 1, 1, rowArray.length).setValues([rowArray]);
        
        Logger.log(`BillingCycle更新完了: ${projectId} ${ym}`);
        return;
      }
    }
  } catch (error) {
    Logger.log('BillingCycle更新エラー: ' + error);
  }
}

/**
 * プロジェクトの全月次報告書を取得
 * @param {string} projectId
 * @return {Array}
 */
function mr_repo_getAllByProject_(projectId) {
  try {
    const sheet = mr_repo_ensureMonthlyReportsHeader_();
    const data = b_readTable_('DB_MonthlyReports');
    
    const results = data.filter(row => row.projectId === projectId);
    
    // ym で降順ソート
    results.sort((a, b) => b.ym.localeCompare(a.ym));
    
    return results;
    
  } catch (error) {
    Logger.log('月次報告書一覧取得エラー: ' + error);
    return [];
  }
}

/**
 * collectionDataを復元（新形式・旧形式両対応）
 * 新形式: ソース別列から合成
 * 旧形式: collectionDataJson 1列からパース
 */
function mr_repo_parseCollectionData_(jsonOrRow) {
  // 旧形式（JSON文字列が直接渡された場合）
  if (typeof jsonOrRow === 'string') {
    try { return JSON.parse(jsonOrRow); } catch (e) { return null; }
  }
  return null;
}

/**
 * DB行オブジェクトからcollectionDataを復元（新形式優先）
 */
function mr_repo_restoreCollectionData_(row) {
  if (!row) return null;
  
  // 新形式チェック（分割列があるか）
  if (row.collectionSummaryJson || row.collectionSlackJson) {
    var data = {};
    try {
      var summaryObj = JSON.parse(row.collectionSummaryJson || '{}');
      data.summary = summaryObj.summary || {};
      data.collectedAt = summaryObj.collectedAt || '';
    } catch (e) { data.summary = {}; }
    
    var sources = ['slack', 'notion', 'gmail', 'drive'];
    for (var i = 0; i < sources.length; i++) {
      var key = sources[i];
      var colName = 'collection' + key.charAt(0).toUpperCase() + key.slice(1) + 'Json';
      try {
        data[key] = JSON.parse(row[colName] || 'null');
      } catch (e) { data[key] = null; }
    }
    return data;
  }
  
  // 旧形式フォールバック
  if (row.collectionDataJson) {
    try { return JSON.parse(row.collectionDataJson); } catch (e) { return null; }
  }
  
  return null;
}

/**
 * draftContent(Markdown)からセクションを分離抽出する。
 * ## or ### の見出しで区切る。見出し番号・表記揺れに対応。
 * @param {string} md
 * @return {Object} { sectionSummary, sectionProgress, sectionIssues, sectionNextMonth, sectionMembers, slideSummary }
 */
function mr_repo_parseSections_(md) {
  var result = {
    sectionSummary: '',
    sectionProgress: '',
    sectionIssues: '',
    sectionNextMonth: '',
    sectionMembers: '',
    slideSummary: ''
  };
  if (!md) return result;

  // 見出しキーワード→フィールドのマッピング
  var mapping = [
    { field: 'sectionSummary',  keywords: ['エグゼクティブサマリー', 'エグゼクティブ・サマリー', 'executive summary'] },
    { field: 'sectionProgress', keywords: ['今月の主な進捗', '主な進捗', '今月の進捗'] },
    { field: 'sectionIssues',   keywords: ['課題と対応', '課題'] },
    { field: 'sectionNextMonth',keywords: ['次月の予定', '来月の予定', '次月'] },
    { field: 'sectionMembers',  keywords: ['メンバー貢献サマリー', 'メンバー貢献', '貢献サマリー'] },
    { field: 'slideSummary',    keywords: ['スライド用サマリー', 'スライドサマリー'] }
  ];

  // ##/### の見出し行で分割
  var sections = [];
  var lines = md.split('\n');
  var current = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m = line.match(/^#{2,3}\s+(?:\d+\.\s*)?(.+)/);
    if (m) {
      if (current) current.body = current.lines.join('\n').trim();
      current = { heading: m[1].trim(), lines: [], body: '' };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) current.body = current.lines.join('\n').trim();

  // 各セクションをマッピング
  for (var mi = 0; mi < mapping.length; mi++) {
    var map = mapping[mi];
    for (var si = 0; si < sections.length; si++) {
      var sec = sections[si];
      var hLower = sec.heading.toLowerCase();
      for (var ki = 0; ki < map.keywords.length; ki++) {
        if (hLower.indexOf(map.keywords[ki].toLowerCase()) >= 0) {
          result[map.field] = sec.body;
          break;
        }
      }
      if (result[map.field]) break;
    }
  }

  return result;
}

/**
 * 既存のdraftContentからセクション分離列をバックフィルする。
 * 手動実行用。何度実行してもOK（冪等）。
 */
function admin_backfillReportSections() {
  var sheet = mr_repo_ensureMonthlyReportsHeader_();
  var rows = b_readTable_('DB_MonthlyReports');
  var count = 0;

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r.draftContent) continue;

    // 既にslideSummaryが入ってたらスキップ（済み判定）
    if (String(r.slideSummary || '').trim()) continue;

    var sec = mr_repo_parseSections_(r.draftContent);

    // 変更があるときだけupsert
    if (!sec.slideSummary && !sec.sectionSummary) continue;

    r.sectionSummary = sec.sectionSummary;
    r.sectionProgress = sec.sectionProgress;
    r.sectionIssues = sec.sectionIssues;
    r.sectionNextMonth = sec.sectionNextMonth;
    r.sectionMembers = sec.sectionMembers;
    r.slideSummary = sec.slideSummary;

    b_upsertRow_('DB_MonthlyReports', ['reportId'], r);
    count++;
  }

  Logger.log('バックフィル完了: ' + count + '件');
}

/**
 * draftContent(Markdown)からセクションを分離抽出する。
 * ## or ### の見出しで区切る。見出し番号・表記揺れに対応。
 * @param {string} md
 * @return {Object}
 */
function mr_repo_parseSections_(md) {
  var result = {
    sectionSummary: '',
    sectionProgress: '',
    sectionIssues: '',
    sectionNextMonth: '',
    sectionMembers: '',
    slideSummary: ''
  };
  if (!md) return result;

  var mapping = [
    { field: 'sectionSummary',  keywords: ['エグゼクティブサマリー', 'エグゼクティブ・サマリー', 'executive summary'] },
    { field: 'sectionProgress', keywords: ['今月の主な進捗', '主な進捗', '今月の進捗'] },
    { field: 'sectionIssues',   keywords: ['課題と対応', '課題'] },
    { field: 'sectionNextMonth',keywords: ['次月の予定', '来月の予定', '次月'] },
    { field: 'sectionMembers',  keywords: ['メンバー貢献サマリー', 'メンバー貢献', '貢献サマリー'] },
    { field: 'slideSummary',    keywords: ['スライド用サマリー', 'スライドサマリー'] }
  ];

  var sections = [];
  var lines = md.split('\n');
  var current = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m = line.match(/^#{2,3}\s+(?:\d+\.\s*)?(.+)/);
    if (m) {
      if (current) current.body = current.lines.join('\n').trim();
      current = { heading: m[1].trim(), lines: [], body: '' };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) current.body = current.lines.join('\n').trim();

  for (var mi = 0; mi < mapping.length; mi++) {
    var map = mapping[mi];
    for (var si = 0; si < sections.length; si++) {
      var sec = sections[si];
      var hLower = sec.heading.toLowerCase();
      for (var ki = 0; ki < map.keywords.length; ki++) {
        if (hLower.indexOf(map.keywords[ki].toLowerCase()) >= 0) {
          result[map.field] = sec.body;
          break;
        }
      }
      if (result[map.field]) break;
    }
  }

  return result;
}

/**
 * 既存のdraftContentからセクション分離列をバックフィルする。
 * 手動実行用。何度実行してもOK（冪等）。
 */
/**
 * 既存のdraftContentからセクション分離列をバックフィルする。
 * 手動実行用。何度実行してもOK（冪等）。
 * ★b_upsertRow_は使わず、対象6列だけを直接書き込む（50000字制限回避）
 */
function admin_backfillReportSections() {
  var sheet = mr_repo_ensureMonthlyReportsHeader_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('データなし'); return; }

  // 列インデックスマップ
  var colIdx = {};
  for (var c = 0; c < headers.length; c++) {
    colIdx[headers[c]] = c;
  }

  var draftCol = colIdx['draftContent'];
  var targetCols = ['sectionSummary', 'sectionProgress', 'sectionIssues', 'sectionNextMonth', 'sectionMembers', 'slideSummary'];

  // 対象列が全部あるか確認
  for (var t = 0; t < targetCols.length; t++) {
    if (colIdx[targetCols[t]] === undefined) {
      Logger.log('列が見つからない: ' + targetCols[t] + ' — 先にヘッダを更新して');
      return;
    }
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var count = 0;

  for (var i = 0; i < allData.length; i++) {
    var draft = String(allData[i][draftCol] || '').trim();
    if (!draft) continue;

    // 既にslideSummaryが入ってたらスキップ
    var existingSlide = String(allData[i][colIdx['slideSummary']] || '').trim();
    if (existingSlide) continue;

    var sec = mr_repo_parseSections_(draft);
    if (!sec.slideSummary && !sec.sectionSummary) continue;

    // 6列だけ書き込み
    var rowNum = i + 2; // 1-indexed, ヘッダ分+1
    for (var t = 0; t < targetCols.length; t++) {
      var col = colIdx[targetCols[t]] + 1; // 1-indexed
      var val = sec[targetCols[t]] || '';
      sheet.getRange(rowNum, col).setValue(val);
    }
    count++;

    // API制限対策：10件ごとにflush
    if (count % 10 === 0) {
      SpreadsheetApp.flush();
      Logger.log('進捗: ' + count + '件書き込み済み');
    }
  }

  SpreadsheetApp.flush();
  Logger.log('バックフィル完了: ' + count + '件');
}

/**
 * 差分更新を保留として保存（draftContentは上書きしない）
 * @param {string} projectId
 * @param {string} ym
 * @param {string} pendingDraft - LLMが生成した更新版テキスト
 * @param {Object} delta - 差分収集結果
 */
function mr_repo_savePending_(projectId, ym, pendingDraft, delta) {
  var sh = getSheet_("DB_MonthlyReports");
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rid = "MR_" + projectId + "_" + ym;

  var iRid = header.indexOf("reportId");
  var iPending = header.indexOf("pendingDraftContent");
  var iSummary = header.indexOf("pendingDeltaSummary");
  var iAt = header.indexOf("pendingDeltaAt");
  var iStatus = header.indexOf("pendingStatus");
  var iType = header.indexOf("lastUpdateType");
  var iItems = header.indexOf("lastDeltaItems");
  var iCron = header.indexOf("lastCronAt");

  if (iPending === -1) {
    Logger.log("[savePending] pendingDraftContent列が見つからない");
    return;
  }

  var totalItems = (delta && delta.summary) ? delta.summary.total_items : 0;
  var byService = (delta && delta.summary && delta.summary.by_service) ? delta.summary.by_service : {};
  var summaryParts = [];
  var services = ["notion", "slack", "gmail", "drive"];
  for (var s = 0; s < services.length; s++) {
    var svc = services[s];
    if (byService[svc] && byService[svc].success && byService[svc].count > 0) {
      summaryParts.push(svc + ":" + byService[svc].count);
    }
  }
  var summaryText = totalItems + "件 (" + summaryParts.join(", ") + ")";
  var nowStr = _mrCron_jstNow_();

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iRid] || "") === rid) {
      var row = i + 1;
      sh.getRange(row, iPending + 1).setValue(pendingDraft);
      sh.getRange(row, iSummary + 1).setValue(summaryText);
      sh.getRange(row, iAt + 1).setValue(nowStr);
      sh.getRange(row, iStatus + 1).setValue("pending");
      if (iType !== -1) sh.getRange(row, iType + 1).setValue("pending");
      if (iItems !== -1) sh.getRange(row, iItems + 1).setValue(String(totalItems));
      if (iCron !== -1) sh.getRange(row, iCron + 1).setValue(nowStr);
      Logger.log("[savePending] " + rid + " 保留保存完了 (" + summaryText + ")");
      return;
    }
  }
  Logger.log("[savePending] " + rid + " が見つからない");
}

/**
 * 保留中の差分更新を承認（draftContentに反映）
 * @param {string} projectId
 * @param {string} ym
 * @return {Object} {ok, error}
 */
function mr_repo_applyPending_(projectId, ym) {
  var sh = getSheet_("DB_MonthlyReports");
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rid = "MR_" + projectId + "_" + ym;

  var iRid = header.indexOf("reportId");
  var iDraft = header.indexOf("draftContent");
  var iPending = header.indexOf("pendingDraftContent");
  var iStatus = header.indexOf("pendingStatus");
  var iType = header.indexOf("lastUpdateType");
  var iGenAt = header.indexOf("generatedAtJst");

  if (iPending === -1 || iDraft === -1) {
    return { ok: false, error: "pending列またはdraft列が見つからない" };
  }

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iRid] || "") === rid) {
      var pendingContent = String(data[i][iPending] || "").trim();
      var pendingStatus = String(data[i][iStatus] || "").trim();

      if (!pendingContent || pendingStatus !== "pending") {
        return { ok: false, error: "保留中の更新がない" };
      }

      var row = i + 1;
      sh.getRange(row, iDraft + 1).setValue(pendingContent);
      sh.getRange(row, iPending + 1).setValue("");
      sh.getRange(row, iStatus + 1).setValue("none");
      if (iType !== -1) sh.getRange(row, iType + 1).setValue("delta_updated");
      if (iGenAt !== -1) sh.getRange(row, iGenAt + 1).setValue(_mrCron_jstNow_());

      // セクション分離も更新
      try {
        var sec = mr_repo_parseSections_(pendingContent);
        var secCols = ["sectionSummary","sectionProgress","sectionIssues","sectionNextMonth","sectionMembers","slideSummary"];
        for (var c = 0; c < secCols.length; c++) {
          var ci = header.indexOf(secCols[c]);
          if (ci !== -1) sh.getRange(row, ci + 1).setValue(sec[secCols[c]] || "");
        }
      } catch (e) {
        Logger.log("[applyPending] セクション分離エラー: " + e);
      }

      Logger.log("[applyPending] " + rid + " 反映完了");
      return { ok: true };
    }
  }
  return { ok: false, error: rid + " が見つからない" };
}

/**
 * 保留中の差分更新を却下（pendingをクリア）
 * @param {string} projectId
 * @param {string} ym
 * @return {Object} {ok, error}
 */
function mr_repo_rejectPending_(projectId, ym) {
  var sh = getSheet_("DB_MonthlyReports");
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rid = "MR_" + projectId + "_" + ym;

  var iRid = header.indexOf("reportId");
  var iPending = header.indexOf("pendingDraftContent");
  var iSummary = header.indexOf("pendingDeltaSummary");
  var iAt = header.indexOf("pendingDeltaAt");
  var iStatus = header.indexOf("pendingStatus");
  var iType = header.indexOf("lastUpdateType");

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iRid] || "") === rid) {
      var row = i + 1;
      sh.getRange(row, iPending + 1).setValue("");
      sh.getRange(row, iSummary + 1).setValue("");
      sh.getRange(row, iAt + 1).setValue("");
      sh.getRange(row, iStatus + 1).setValue("rejected");
      if (iType !== -1) sh.getRange(row, iType + 1).setValue("rejected");
      Logger.log("[rejectPending] " + rid + " 却下完了");
      return { ok: true };
    }
  }
  return { ok: false, error: rid + " が見つからない" };
}

/**
 * 月次報告書をFIX（確定）する
 * draftContent → finalContent にコピーし、fixedAtJst/fixedBy を記録
 * 既にfinalContentがある場合はそちらを正本としてfixedAtJst/fixedByだけ更新
 *
 * @param {string} projectId
 * @param {string} ym yyyymm
 * @param {string} actor メールアドレスまたはmemberId
 * @return {{ok:boolean, error:string}}
 */
function mr_repo_fixReport_(projectId, ym, actor) {
  var sh = b_ss_().getSheetByName('DB_MonthlyReports');
  if (!sh) return { ok: false, error: 'DB_MonthlyReports not found' };

  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var iRid    = header.indexOf('reportId');
  var iDraft  = header.indexOf('draftContent');
  var iFinal  = header.indexOf('finalContent');
  var iStatus = header.indexOf('status');
  var iFixAt  = header.indexOf('fixedAtJst');
  var iFixBy  = header.indexOf('fixedBy');
  if (iRid < 0 || iFixAt < 0) return { ok: false, error: 'header missing' };

  var rid = 'MR_' + projectId + '_' + ym;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'no data' };

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][iRid] || '').trim() !== rid) continue;

    // finalContentが空ならdraftContentをコピー
    var finalContent = String(data[i][iFinal] || '').trim();
    if (!finalContent) {
      var draft = String(data[i][iDraft] || '').trim();
      if (!draft) return { ok: false, error: 'draftContent is empty' };
      sh.getRange(i + 1, iFinal + 1).setValue(draft);
    }

    // JST現在時刻
    var now = new Date();
    var jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    var fixedAt = jst.getUTCFullYear() + '年'
      + (jst.getUTCMonth() + 1) + '月'
      + jst.getUTCDate() + '日 '
      + String(jst.getUTCHours()).padStart(2, '0') + ':'
      + String(jst.getUTCMinutes()).padStart(2, '0');

    sh.getRange(i + 1, iFixAt + 1).setValue(fixedAt);
    sh.getRange(i + 1, iFixBy + 1).setValue(actor || 'unknown');
    if (iStatus >= 0) sh.getRange(i + 1, iStatus + 1).setValue('fixed');

    // === DB_BillingCycleにも正本として書き込み ===
    try {
      var bcSh = b_ss_().getSheetByName('DB_BillingCycle');
      if (bcSh) {
        var bcHeader = bcSh.getRange(1, 1, 1, bcSh.getLastColumn()).getValues()[0];
        var bcPid = bcHeader.indexOf('projectId');
        var bcYm  = bcHeader.indexOf('ym');
        var bcFixAt = bcHeader.indexOf('monthlyReportFixedAt');
        var bcFixBy = bcHeader.indexOf('monthlyReportFixedBy');

        // ヘッダになければ追加
        if (bcFixAt < 0) {
          bcSh.getRange(1, bcSh.getLastColumn() + 1).setValue('monthlyReportFixedAt');
          bcFixAt = bcSh.getLastColumn() - 1;
        }
        if (bcFixBy < 0) {
          bcSh.getRange(1, bcSh.getLastColumn() + 1).setValue('monthlyReportFixedBy');
          bcFixBy = bcSh.getLastColumn() - 1;
        }

        if (bcPid >= 0 && bcYm >= 0) {
          var bcData = bcSh.getDataRange().getValues();
          for (var bi = 1; bi < bcData.length; bi++) {
            var bPid = String(bcData[bi][bcPid] || '').trim();
            var bYm  = String(bcData[bi][bcYm] || '').trim();
            if (bPid === projectId && bYm === ym) {
              bcSh.getRange(bi + 1, bcFixAt + 1).setValue(fixedAt);
              bcSh.getRange(bi + 1, bcFixBy + 1).setValue(actor || 'unknown');
              break;
            }
          }
        }
      }
    } catch (bcErr) {
      Logger.log('BillingCycle monthlyReportFixedAt 書き込みエラー（報告書FIXは成功）: ' + bcErr);
    }

    return { ok: true, fixedAtJst: fixedAt };
  }

  return { ok: false, error: 'report not found: ' + rid };
}

