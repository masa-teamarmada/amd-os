/**
 * 304_MonthlyReport_Repo.gs
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    'collectionDataJson', // 収集データ(JSON)
    'note'                // 備考
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
function mr_repo_saveDraft_(projectId, ym, draftContent, collectionData) {
  const sheet = mr_repo_ensureMonthlyReportsHeader_();
  
  // 既存のdraftがあるか確認
  const existing = mr_repo_getByProjectYm_(projectId, ym);
  
  const now = mr_now_();
  const reportId = existing ? existing.reportId : mr_repo_generateReportId_(projectId, ym);
  
  const row = {
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
    collectionDataJson: JSON.stringify(collectionData),
    note: existing ? existing.note : ''
  };
  
  b_upsertRow_(sheet, 'reportId', row);
  
  Logger.log(`月次報告書保存完了: ${reportId}`);
  
  return reportId;
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
  const data = b_readTable_(sheet);
  
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
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    throw new Error('報告書が見つかりません: ' + reportId);
  }
  
  const headers = data[0];
  const reportIdIdx = headers.indexOf('reportId');
  
  if (reportIdIdx === -1) {
    throw new Error('reportId 列が見つかりません');
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][reportIdIdx] === reportId) {
      const report = {};
      headers.forEach((header, idx) => {
        report[header] = data[i][idx];
      });
      
      const now = mr_now_();
      
      const updatedRow = {
        ...report,
        finalContent: finalContent || report.draftContent,
        approvedAtJst: mr_formatJst_(now),
        approvedBy: memberId,
        status: 'approved'
      };
      
      mr_repo_upsertRow_(sheet, 'reportId', updatedRow);
      
      Logger.log(`月次報告書承認完了: ${reportId} by ${memberId}`);
      return true;
    }
  }
  
  throw new Error('報告書が見つかりません: ' + reportId);
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
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    throw new Error('報告書が見つかりません: ' + reportId);
  }
  
  const headers = data[0];
  const reportIdIdx = headers.indexOf('reportId');
  
  if (reportIdIdx === -1) {
    throw new Error('reportId 列が見つかりません');
  }
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][reportIdIdx] === reportId) {
      const report = {};
      headers.forEach((header, idx) => {
        report[header] = data[i][idx];
      });
      
      const now = mr_now_();
      
      const updatedRow = {
        ...report,
        submittedAtJst: mr_formatJst_(now),
        submittedBy: memberId,
        status: 'submitted',
        pdfFileId: pdfFileId || report.pdfFileId
      };
      
      mr_repo_upsertRow_(sheet, 'reportId', updatedRow);
      
      Logger.log(`月次報告書提出完了: ${reportId} by ${memberId}`);
      
      // DB_BillingCycleにも反映
      mr_repo_updateBillingCycle_(report.projectId, report.ym, reportId, pdfFileId);
      
      return true;
    }
  }
  
  throw new Error('報告書が見つかりません: ' + reportId);
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    const data = sheet.getDataRange().getValues();
    
    if (data.length === 0) return [];
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    
    if (projectIdIdx === -1) return [];
    
    const results = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = data[i][idx];
        });
        results.push(row);
      }
    }
    
    // ym で降順ソート
    results.sort((a, b) => b.ym.localeCompare(a.ym));
    
    return results;
    
  } catch (error) {
    Logger.log('月次報告書一覧取得エラー: ' + error);
    return [];
  }
}

/**
 * 収集データJSONをパース
 * @param {string} collectionDataJson
 * @return {Object|null}
 */
function mr_repo_parseCollectionData_(collectionDataJson) {
  if (!collectionDataJson) return null;
  
  try {
    return JSON.parse(collectionDataJson);
  } catch (error) {
    Logger.log('収集データパースエラー: ' + error);
    return null;
  }
}