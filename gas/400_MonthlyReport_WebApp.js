/**
 * 400_MonthlyReport_WebApp.gs
 * 
 * 役割:
 * - 月次報告書管理ウェブアプリのバックエンド
 * - doGet()でHTMLを返す
 * - フロントエンドからのAPI呼び出しに応答
 * 
 * 依存:
 * - 301_MonthlyReport_Api.gs
 * - 304_MonthlyReport_Repo.gs
 * - B_Sheets.gs
 */

/**
 * ウェブアプリのエントリーポイント
 * GASのウェブアプリとして公開するための関数
 */
/*function doGet(e) {
  const template = HtmlService.createTemplateFromFile('401_MonthlyReport_WebApp');
  
  // テンプレートに変数を渡すことも可能
  // template.data = { ... };
  
  return template.evaluate()
    .setTitle('月次報告書管理システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTMLファイル内の<?!= include('ファイル名') ?>を処理
 * CSSやJSを別ファイルに分離したい場合に使用
 */
/*
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
*/

/**
 * プロジェクト一覧を取得
 * @return {Array<Object>}
 */
function mrweb_getProjects(options) {
  try {
    const opt = options || {};
    const includeAll = !!opt.includeAll;
    const projects = b_cachedReadProjects_();
    
    // includeAll=false（デフォルト）ならactiveのみ
    const filtered = includeAll
      ? projects
      : projects.filter(p => 
          String(p.status || '').trim().toLowerCase() === 'active'
        );
    
    return filtered.map(p => ({
      projectId: p.projectId || '',
      projectName: p.projectName || '',
      clientName: p.clientName || '',
      status: p.status || '',
      startYm: p.startYm || ''
    }));
    
  } catch (error) {
    Logger.log('プロジェクト一覧取得エラー: ' + error);
    throw new Error('プロジェクト一覧の取得に失敗しました: ' + error.message);
  }
}
/**
 * プロジェクトの月次報告書一覧を取得
 * @param {string} projectId
 * @return {Array<Object>}
 */
function mrweb_getReportsByProject(projectId) {
  try {
    if (!projectId) {
      return [];
    }
    
    const reports = mr_repo_getAllByProject_(projectId);
    
    Logger.log('[mrweb] raw count: ' + (reports ? reports.length : 'null'));
    
    if (!reports || !Array.isArray(reports)) {
      return [];
    }
    
    const mapped = [];
    for (var i = 0; i < reports.length; i++) {
      var r = reports[i];
      mapped.push({
        reportId: String(r.reportId || ''),
        projectId: String(r.projectId || ''),
        ym: String(r.ym || ''),
        status: String(r.status || 'draft'),
        generatedAtJst: String(r.generatedAtJst || ''),
        approvedAtJst: String(r.approvedAtJst || ''),
        submittedAtJst: String(r.submittedAtJst || ''),
        hasContent: !!(r.draftContent || r.finalContent),
        pdfFileId: String(r.pdfFileId || '')
      });
    }
    
    Logger.log('[mrweb] mapped count: ' + mapped.length);
    Logger.log('[mrweb] mapped[0]: ' + JSON.stringify(mapped[0]));
    
    return mapped;
    
  } catch (error) {
    Logger.log('[mrweb] ERROR: ' + error);
    Logger.log('[mrweb] stack: ' + error.stack);
    return [];
  }
}
/**
 * 月次報告書の詳細を取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function mrweb_getReportDetail(projectId, ym) {
  try {
    if (!projectId || !ym) {
      throw new Error('プロジェクトIDまたは年月が指定されていません');
    }
    
    const report = mr_repo_getByProjectYm_(projectId, String(ym));
    
    if (!report) {
      return null;
    }
    
    var collectionData = null;
    try {
      if (report.collectionDataJson) {
        collectionData = JSON.parse(report.collectionDataJson);
      }
    } catch (e) {
      Logger.log('収集データパースエラー: ' + e);
    }
    
    return {
      reportId: String(report.reportId || ''),
      projectId: String(report.projectId || ''),
      ym: String(report.ym || ''),
      draftContent: String(report.draftContent || ''),
      finalContent: String(report.finalContent || ''),
      status: String(report.status || 'draft'),
      generatedAtJst: String(report.generatedAtJst || ''),
      generatedBy: String(report.generatedBy || ''),
      approvedAtJst: String(report.approvedAtJst || ''),
      approvedBy: String(report.approvedBy || ''),
      submittedAtJst: String(report.submittedAtJst || ''),
      submittedBy: String(report.submittedBy || ''),
      pdfFileId: String(report.pdfFileId || ''),
      totalValuePoints: Number(report.totalValuePoints || 0),
      note: String(report.note || ''),
      collectionData: null
    };
    
  } catch (error) {
    Logger.log('報告書詳細取得エラー: ' + error);
    throw new Error('報告書詳細の取得に失敗しました: ' + error.message);
  }
}
/**
 * 月次報告書を生成
 * @param {string} projectId
 * @param {string} ym
 * @param {boolean} forceRecollect
 * @return {Object}
 */
function mrweb_generateReport(projectId, ym, forceRecollect) {
  try {
    if (!projectId || !ym) {
      throw new Error('プロジェクトIDまたは年月が指定されていません');
    }
    
    Logger.log(`[WebApp] 報告書生成開始: ${projectId} ${ym}`);
    
    // 301のAPI関数を呼び出し
    const result = api_generateMonthlyReport(projectId, ym, forceRecollect);
    
    Logger.log(`[WebApp] 報告書生成完了: ${result.reportId}`);
    
    return {
      success: true,
      reportId: result.reportId,
      message: '月次報告書を生成しました'
    };
    
  } catch (error) {
    Logger.log('[WebApp] 報告書生成エラー: ' + error);
    return {
      success: false,
      error: error.message || '報告書の生成に失敗しました'
    };
  }
}

/**
 * 月次報告書を承認
 * @param {string} reportId
 * @param {string} memberId
 * @param {string} finalContent
 * @return {Object}
 */
function mrweb_approveReport(reportId, memberId, finalContent) {
  try {
    if (!reportId) {
      throw new Error('レポートIDが指定されていません');
    }
    
    const success = mr_repo_approve_(reportId, memberId || 'web-user', finalContent);
    
    return {
      success: success,
      message: '月次報告書を承認しました'
    };
    
  } catch (error) {
    Logger.log('報告書承認エラー: ' + error);
    return {
      success: false,
      error: error.message || '報告書の承認に失敗しました'
    };
  }
}

/**
 * 月次報告書を提出
 * @param {string} reportId
 * @param {string} memberId
 * @return {Object}
 */
function mrweb_submitReport(reportId, memberId) {
  try {
    if (!reportId) {
      throw new Error('レポートIDが指定されていません');
    }
    
    // PDF生成は未実装なので空文字列
    const success = mr_repo_submit_(reportId, memberId || 'web-user', '');
    
    return {
      success: success,
      message: '月次報告書を提出しました'
    };
    
  } catch (error) {
    Logger.log('報告書提出エラー: ' + error);
    return {
      success: false,
      error: error.message || '報告書の提出に失敗しました'
    };
  }
}

/**
 * 利用可能な年月リストを生成
 * @param {string} projectId
 * @return {Array<string>}
 */
function mrweb_getAvailableYmList(projectId) {
  try {
    const project = b_cachedReadProjects_().find(p => p.projectId === projectId);
    
    if (!project || !project.startYm) {
      // デフォルト：過去12ヶ月
      const list = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
        list.push(ym);
      }
      return list;
    }
    
    // プロジェクト開始月から現在まで
    const startYm = String(project.startYm);
    const startYear = parseInt(startYm.substring(0, 4));
    const startMonth = parseInt(startYm.substring(4, 6));
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const list = [];
    let y = startYear;
    let m = startMonth;
    
    while (y < currentYear || (y === currentYear && m <= currentMonth)) {
      const ym = y + String(m).padStart(2, '0');
      list.push(ym);
      
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    
    // 降順にソート
    list.sort((a, b) => b.localeCompare(a));
    
    return list;
    
  } catch (error) {
    Logger.log('年月リスト生成エラー: ' + error);
    // エラー時はデフォルト
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
      list.push(ym);
    }
    return list;
  }
}

/**
 * テスト用：ウェブアプリURLを取得
 */
function mrweb_getWebAppUrl() {
  try {
    const url = ScriptApp.getService().getUrl();
    Logger.log('ウェブアプリURL: ' + url);
    return url;
  } catch (error) {
    Logger.log('URL取得エラー: ' + error);
    return null;
  }
}

/**
 * 月次報告書を修正プロンプトで修正（フロントから呼ばれるAPI）
 * @param {string} projectId
 * @param {string} ym
 * @param {string} feedback - 修正指示テキスト
 * @return {Object} { success, text, fixCount, error }
 */
function mrweb_fixReport(projectId, ym, feedback) {
  try {
    var result = mr_fix_execute_(
      String(projectId || ''),
      String(ym || ''),
      String(feedback || '')
    );

    if (result && result.ok) {
      return {
        success: true,
        text: String(result.text || ''),
        fixCount: Number(result.fixCount || 0),
        editId: String(result.editId || '')
      };
    } else {
      return {
        success: false,
        error: String((result && result.error) || '不明なエラー')
      };
    }
  } catch (error) {
    Logger.log('mrweb_fixReport エラー: ' + error);
    return {
      success: false,
      error: String(error.message || error)
    };
  }
}