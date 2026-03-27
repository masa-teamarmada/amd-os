/**
 * R301_MonthlyReport_Api.gs
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
    Logger.log('=== 月次報告書自動生成 ===');
    Logger.log('PJ: ' + projectId + ', YM: ' + ym + ', 強制再収集: ' + (forceRecollect || false));

    var activities = mr_collectAllActivities_(projectId, ym);

    if (activities.summary.success_count === 0) {
      return { success: false, error: '全てのサービスでデータ収集に失敗しました' };
    }

    if (activities.summary.total_items === 0) {
      Logger.log('警告: 収集データが0件です。報告書は生成しますが内容が薄くなります。');
    }

    var generation = mr_generateDraft_(projectId, ym, activities);

    if (!generation.success) {
      return { success: false, error: '報告書生成に失敗しました: ' + generation.error };
    }

    var reportId = mr_repo_saveDraft_(projectId, ym, generation.draft, activities);

    // Dateオブジェクト混入によるシリアライズ失敗を防ぐため、必要最小限の値のみ返す
    return JSON.parse(JSON.stringify({
      success: true,
      reportId: String(reportId || ''),
      generated_at: String(generation.generated_at_jst || ''),
      fromSourceCache: !!activities.fromSourceCache
    }));

  } catch (error) {
    Logger.log('月次報告書生成エラー: ' + error);
    return { success: false, error: error.toString() };
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
    
    // 収集データをパース（新形式優先）
    const collectionData = mr_repo_restoreCollectionData_(report);
    
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
    var activities = mr_collectAllActivities_(projectId, ym);

    return {
      success: true,
      activities: activities,
      formatted: mr_formatCollectionForHuman_(activities),
      fromSourceCache: !!activities.fromSourceCache
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

    // 常に最新データで収集（302がSourceCache優先読み）
    var activities = mr_collectAllActivities_(projectId, ym);

    // LLMで再生成
    var generation = mr_generateDraft_(projectId, ym, activities);

    if (!generation.success) {
      return {
        success: false,
        error: '報告書再生成に失敗しました: ' + generation.error
      };
    }

    // DB保存(上書き)
    var reportId = mr_repo_saveDraft_(projectId, ym, generation.draft, activities);

    return {
      success: true,
      reportId: reportId,
      draft: generation.draft,
      regenerated: true,
      fromSourceCache: !!activities.fromSourceCache
    };

  } catch (error) {
    Logger.log('月次報告書再生成エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * 月次報告書を修正プロンプトで修正（Cockpitから呼ばれるAPI）
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

/**
 * 保留中の差分更新情報を取得
 * @param {string} projectId
 * @param {string} ym
 * @return {Object} {success, hasPending, pendingDraft, currentDraft, deltaSummary, deltaAt}
 */
function api_getPendingDelta(projectId, ym) {
  try {
    var report = mr_repo_getByProjectYm_(projectId, ym);
    if (!report) {
      return { success: false, error: "報告書が見つからない" };
    }

    var hasPending = (String(report.pendingStatus || "") === "pending")
      && (String(report.pendingDraftContent || "").trim() !== "");

    return {
      success: true,
      hasPending: hasPending,
      pendingDraft: hasPending ? report.pendingDraftContent : "",
      currentDraft: report.draftContent || "",
      deltaSummary: report.pendingDeltaSummary || "",
      deltaAt: report.pendingDeltaAt || "",
      pendingStatus: report.pendingStatus || "none"
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * 保留中の差分更新を承認（draftContentに反映）
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function api_applyPendingDelta(projectId, ym) {
  try {
    var res = mr_repo_applyPending_(projectId, ym);
    return { success: res.ok, error: res.error || "" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * 保留中の差分更新を却下
 * @param {string} projectId
 * @param {string} ym
 * @return {Object}
 */
function api_rejectPendingDelta(projectId, ym) {
  try {
    var res = mr_repo_rejectPending_(projectId, ym);
    return { success: res.ok, error: res.error || "" };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * 月次報告書をFIX（確定）する
 * UIのFIXボタンから呼ばれる
 * @param {Object} payload {projectId, ym}
 * @return {Object} {ok, fixedAtJst, error}
 */
function mr_api_fixReport(payload) {
  try {
    var projectId = String((payload || {}).projectId || '').trim();
    var ym = String((payload || {}).ym || '').trim();
    if (!projectId || !ym) return { ok: false, error: 'projectId/ym required' };

    var actor = '';
    try { actor = Session.getActiveUser().getEmail(); } catch(e) {}

    var res = mr_repo_fixReport_(projectId, ym, actor);
    return res;
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * FIX済み報告書を編集して再FIXする
 * 修正指示でLLM修正した後の最終テキストを受け取って保存+再FIX
 * @param {Object} payload {projectId, ym, content}
 * @return {Object} {ok, fixedAtJst, error}
 */
function mr_api_editAndRefix(payload) {
  try {
    var projectId = String((payload || {}).projectId || '').trim();
    var ym = String((payload || {}).ym || '').trim();
    var content = String((payload || {}).content || '').trim();
    if (!projectId || !ym) return { ok: false, error: 'projectId/ym required' };
    if (!content) return { ok: false, error: 'content is empty' };

    var actor = '';
    try { actor = Session.getActiveUser().getEmail(); } catch(e) {}

    var res = mr_repo_updateFinalAndRefix_(projectId, ym, content, actor);
    return res;
  } catch(e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * 保留中の差分ドラフトを修正指示でLLM修正する
 * pendingDraftContent を上書きし、diffが再描画される想定
 * @param {string} projectId
 * @param {string} ym - yyyymm
 * @param {string} feedback - 修正指示テキスト
 * @return {Object} { success, text, error }
 */
function api_fixPendingDelta(projectId, ym, feedback) {
  try {
    var pid = String(projectId || '').trim();
    var ymKey = String(ym || '').replace(/[^0-9]/g, '').trim();
    var fb = String(feedback || '').trim();

    if (!pid) return { success: false, error: 'projectId が空' };
    if (!ymKey || ymKey.length !== 6) return { success: false, error: 'ym が不正' };
    if (!fb) return { success: false, error: '修正指示が空' };

    // 1) 現在のpendingを取得
    var report = mr_repo_getByProjectYm_(pid, ymKey);
    if (!report) return { success: false, error: '報告書が見つからない' };

    var pendingText = String(report.pendingDraftContent || '').trim();
    if (!pendingText || String(report.pendingStatus || '') !== 'pending') {
      return { success: false, error: '保留中の差分がない' };
    }

    // 2) つくよみcontext取得（312と同じ）
    var context = mr_fix_getContext_();

    // 3) 過去の修正ログ取得（312と同じ）
    var pastEdits = mr_fix_getPastEdits_(pid, 10);

    // 4) プロンプト構築 & Claude呼び出し（312と同じ）
    var prompt = mr_fix_buildPrompt_(pendingText, fb, pastEdits, context);
    var response = mr_fix_callClaude_(context, prompt);

    if (!response || !response.text) {
      return { success: false, error: 'LLMが空のテキストを返した' };
    }

    var fixedText = response.text;

    // 5) pendingDraftContent を上書き
    mr_fix_updatePending_(pid, ymKey, fixedText);

    // 6) ログ追記（source識別用に feedback に prefix）
    mr_fix_appendLog_({
      projectId: pid,
      ym: ymKey,
      beforeText: pendingText,
      afterText: fixedText,
      feedback: '[pending_fix] ' + fb,
      model: response.model || '',
      tokenUsage: response.tokenUsage || ''
    });

    return {
      success: true,
      text: fixedText
    };

  } catch (e) {
    Logger.log('api_fixPendingDelta エラー: ' + e);
    return { success: false, error: String(e) };
  }
}

/**
 * pendingDraftContent だけを上書きする内部関数
 */
function mr_fix_updatePending_(projectId, ym, fixedText) {
  var ss = b_ss_();
  var sh = ss.getSheetByName('DB_MonthlyReports');
  if (!sh) throw new Error('DB_MonthlyReports が見つからない');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim();
    if (key) col[key] = c;
  }

  var iPending = col.pendingDraftContent;
  var iPid = col.projectId;
  var iYm = col.ym;
  if (iPending === undefined || iPid === undefined || iYm === undefined) {
    throw new Error('必要な列が見つからない');
  }

  var lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('データなし');

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowPid = String(data[i][iPid] || '').trim();
    var rowYm = String(data[i][iYm] || '').replace(/[^0-9]/g, '').trim();
    if (rowPid === projectId && rowYm === ym) {
      sh.getRange(i + 1, iPending + 1).setValue(fixedText);
      return;
    }
  }
  throw new Error('該当行が見つからない');
}