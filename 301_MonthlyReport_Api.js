/**
 * 301_MonthlyReport_Api.gs
 * 
 * 役割:
 * - 月次報告書機能のAPI入口
 * - UIから呼ばれる公開関数を集約
 * 
 * 依存:
 * - 302_MonthlyReport_Collector.gs
 * - 303_MonthlyReport_Generator.gs
 * - 304_MonthlyReport_Repo.gs
 */

/**
 * 月次報告書を自動生成
 * @param {string} projectId
 * @param {string} ym - yyyymm形式
 * @param {boolean} forceRecollect - 強制再収集フラグ
 * @return {Object} 生成結果
 */
function api_generateMonthlyReport(projectId, ym, forceRecollect) {
  try {
    Logger.log(`=== 月次報告書自動生成 ===`);
    Logger.log(`PJ: ${projectId}, YM: ${ym}, 強制再収集: ${forceRecollect || false}`);
    
    let activities;
    
    // キャッシュをチェック
    if (!forceRecollect && mr_cache_exists_(projectId, ym)) {
      Logger.log('キャッシュからデータを読み込みます...');
      activities = mr_cache_load_(projectId, ym);
      const cacheInfo = mr_cache_getInfo_(projectId, ym);
      Logger.log(`キャッシュ情報: ${cacheInfo.collectedAtJst} 収集, ${cacheInfo.totalItems}件`);
    } else {
      // 新規収集
      Logger.log('データを新規収集します...');
      activities = mr_collectAllActivities_(projectId, ym);
      
      // キャッシュに保存
      mr_cache_save_(projectId, ym, activities);
      Logger.log('収集データをキャッシュに保存しました');
    }
    
    // 収集に失敗が多い場合は警告
    // 少なくとも1つのサービスが成功していればOK
    if (activities.summary.success_count === 0) {
      return {
        success: false,
        error: '全てのサービスでデータ収集に失敗しました',
        activities: activities
      };
    }
    
    // データが少ない場合は警告
    if (activities.summary.total_items === 0) {
      Logger.log('警告: 収集データが0件です。報告書は生成しますが内容が薄くなります。');
    }
    
    // 2. LLMでドラフト生成
    const generation = mr_generateDraft_(projectId, ym, activities);
    
    if (!generation.success) {
      return {
        success: false,
        error: '報告書生成に失敗しました: ' + generation.error,
        activities: activities
      };
    }
    
    // 3. DB保存
    const reportId = mr_repo_saveDraft_(
      projectId, 
      ym, 
      generation.draft, 
      activities
    );
    
    return {
      success: true,
      reportId: reportId,
      draft: generation.draft,
      activities: activities,
      generated_at: generation.generated_at_jst,
      token_usage: generation.token_usage,
      used_cache: !forceRecollect && mr_cache_exists_(projectId, ym)
    };
    
  } catch (error) {
    Logger.log('月次報告書生成エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 月次報告書を取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function api_getMonthlyReport(projectId, ym) {
  try {
    const report = mr_repo_getByProjectYm_(projectId, ym);
    
    if (!report) {
      return {
        success: false,
        error: '報告書が見つかりません',
        exists: false
      };
    }
    
    // 収集データをパース
    const collectionData = mr_repo_parseCollectionData_(report.collectionDataJson);
    
    return {
      success: true,
      exists: true,
      report: {
        reportId: report.reportId,
        projectId: report.projectId,
        ym: report.ym,
        draftContent: report.draftContent,
        finalContent: report.finalContent,
        status: report.status,
        generatedAtJst: report.generatedAtJst,
        approvedAtJst: report.approvedAtJst,
        submittedAtJst: report.submittedAtJst,
        pdfFileId: report.pdfFileId
      },
      collectionSummary: collectionData ? collectionData.summary : null
    };
    
  } catch (error) {
    Logger.log('月次報告書取得エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 月次報告書を承認
 * @param {string} reportId
 * @param {string} memberId
 * @param {string} finalContent - 編集後の最終版
 * @return {Object}
 */
function api_approveMonthlyReport(reportId, memberId, finalContent) {
  try {
    mr_repo_approve_(reportId, memberId, finalContent);
    
    return {
      success: true,
      reportId: reportId
    };
    
  } catch (error) {
    Logger.log('月次報告書承認エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 月次報告書を提出済みに更新
 * @param {string} reportId
 * @param {string} memberId
 * @param {string} pdfFileId
 * @return {Object}
 */
function api_submitMonthlyReport(reportId, memberId, pdfFileId) {
  try {
    mr_repo_submit_(reportId, memberId, pdfFileId);
    
    return {
      success: true,
      reportId: reportId
    };
    
  } catch (error) {
    Logger.log('月次報告書提出エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * プロジェクトの月次報告書一覧を取得
 * @param {string} projectId
 * @return {Object}
 */
function api_listMonthlyReports(projectId) {
  try {
    const reports = mr_repo_getAllByProject_(projectId);
    
    return {
      success: true,
      reports: reports.map(r => ({
        reportId: r.reportId,
        ym: r.ym,
        ymFormatted: mr_formatYm_(r.ym),
        status: r.status,
        generatedAtJst: r.generatedAtJst,
        hasPdf: !!r.pdfFileId
      }))
    };
    
  } catch (error) {
    Logger.log('月次報告書一覧取得エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 収集データのみを取得(デバッグ用)
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function api_collectMonthlyData(projectId, ym) {
  try {
    const activities = mr_collectAllActivities_(projectId, ym);
    
    return {
      success: true,
      activities: activities,
      formatted: mr_formatCollectionForHuman_(activities)
    };
    
  } catch (error) {
    Logger.log('データ収集エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 月次報告書の再生成(既存を上書き)
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function api_regenerateMonthlyReport(projectId, ym) {
  try {
    Logger.log('=== 月次報告書再生成 ===');
    
    // 既存の収集データを取得
    const existing = mr_repo_getByProjectYm_(projectId, ym);
    let activities;
    
    if (existing && existing.collectionDataJson) {
      // 既存の収集データを再利用
      activities = mr_repo_parseCollectionData_(existing.collectionDataJson);
      Logger.log('既存の収集データを使用');
    } else {
      // 新規収集
      activities = mr_collectAllActivities_(projectId, ym);
    }
    
    // LLMで再生成
    const generation = mr_generateDraft_(projectId, ym, activities);
    
    if (!generation.success) {
      return {
        success: false,
        error: '報告書再生成に失敗しました: ' + generation.error
      };
    }
    
    // DB保存(上書き)
    const reportId = mr_repo_saveDraft_(
      projectId, 
      ym, 
      generation.draft, 
      activities
    );
    
    return {
      success: true,
      reportId: reportId,
      draft: generation.draft,
      regenerated: true
    };
    
  } catch (error) {
    Logger.log('月次報告書再生成エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}