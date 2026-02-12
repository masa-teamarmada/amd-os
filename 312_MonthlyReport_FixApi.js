/**
 * 312_MonthlyReport_FixApi.gs
 * 役割：月次報告書の「修正プロンプト → LLM修正 → ログ保存」フロー
 *
 * 依存:
 * - 172_TsukuyomiContextRepo.gs (つくよみcontext)
 * - 310_MonthlyReport_Formatter.gs (日時フォーマット)
 */

/**
 * 月次報告書をフィードバックで修正する（メインエントリ）
 * @param {string} projectId
 * @param {string} ym - yyyymm形式
 * @param {string} feedback - ユーザーの修正指示
 * @return {Object} { ok, text, editId, fixCount, error }
 */
function mr_fix_execute_(projectId, ym, feedback) {
  var pid = String(projectId || '').trim();
  var ymKey = String(ym || '').replace(/[^0-9]/g, '').trim();
  var fb = String(feedback || '').trim();

  if (!pid) return { ok: false, error: 'projectId が空' };
  if (!ymKey || ymKey.length !== 6) return { ok: false, error: 'ym が不正（yyyymm形式で指定）' };
  if (!fb) return { ok: false, error: '修正指示が空' };

  // 1) 現在の報告書を取得
  var current = mr_fix_getCurrentReport_(pid, ymKey);
  if (!current) return { ok: false, error: '報告書が見つからない（projectId=' + pid + ', ym=' + ymKey + '）' };

  var currentText = String(current.draftContent || current.finalContent || '').trim();
  if (!currentText) return { ok: false, error: '報告書の本文が空' };

  // 2) つくよみcontext取得
  var context = mr_fix_getContext_();

  // 3) 過去の修正ログ取得（学習用）
  var pastEdits = mr_fix_getPastEdits_(pid, 10);

  // 4) プロンプト構築 & Claude API呼び出し
  var prompt = mr_fix_buildPrompt_(currentText, fb, pastEdits, context);
  var response = mr_fix_callClaude_(context, prompt);

  if (!response || !response.text) {
    return { ok: false, error: 'LLMが空のテキストを返した' };
  }

  var fixedText = response.text;

  // 5) DB_MonthlyReports を更新（draftContent上書き + fixCount/lastFixedAtJst更新）
  var newFixCount = mr_fix_updateReport_(pid, ymKey, fixedText, current.rowIndex, current.fixCount);

  // 6) DB_MonthlyReportEdits にログ追記
  var editId = mr_fix_appendLog_({
    projectId: pid,
    ym: ymKey,
    beforeText: currentText,
    afterText: fixedText,
    feedback: fb,
    model: response.model || '',
    tokenUsage: response.tokenUsage || ''
  });

  return {
    ok: true,
    text: fixedText,
    editId: editId,
    fixCount: newFixCount
  };
}

// ===== 内部関数 =====

/**
 * DB_MonthlyReports から該当行を取得
 */
function mr_fix_getCurrentReport_(projectId, ym) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DB_MonthlyReports');
  if (!sh) return null;

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return null;

  var data = sh.getDataRange().getValues();
  var headers = data[0];

  var col = {};
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim();
    if (key) col[key] = c;
  }

  if (col.projectId === undefined || col.ym === undefined) return null;

  for (var i = 1; i < data.length; i++) {
    var rowPid = String(data[i][col.projectId] || '').trim();
    var rowYm = String(data[i][col.ym] || '').replace(/[^0-9]/g, '').trim();

    if (rowPid === projectId && rowYm === ym) {
      return {
        rowIndex: i + 1,
        draftContent: col.draftContent !== undefined ? String(data[i][col.draftContent] || '') : '',
        finalContent: col.finalContent !== undefined ? String(data[i][col.finalContent] || '') : '',
        status: col.status !== undefined ? String(data[i][col.status] || '') : '',
        fixCount: col.fixCount !== undefined ? Number(data[i][col.fixCount] || 0) : 0
      };
    }
  }

  return null;
}

/**
 * つくよみ monthlyreport context を取得
 */
function mr_fix_getContext_() {
  try {
    var result = tsukuyomi_getActiveSystemPrompt({
      tag: 'monthlyreport',
      scope: '',
      scopeKey: ''
    });

    if (result && result.ok && result.systemPrompt && result.count > 0) {
      return result.systemPrompt;
    }
  } catch (e) {
    Logger.log('mr_fix context取得エラー: ' + e);
  }

  // フォールバック
  return 'あなたはAMD OSの月次報告書修正アシスタント「つくよみ」です。指示に従って報告書を修正してください。';
}

/**
 * DB_MonthlyReportEdits から過去の修正ログを取得
 */
function mr_fix_getPastEdits_(projectId, count) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('DB_MonthlyReportEdits');
    if (!sh) return '';

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return '';

    var data = sh.getDataRange().getValues();
    var headers = data[0];

    var col = {};
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c] || '').trim();
      if (key) col[key] = c;
    }

    if (col.projectId === undefined) return '';

    var edits = [];
    for (var i = data.length - 1; i >= 1 && edits.length < count; i--) {
      if (String(data[i][col.projectId] || '').trim() === projectId) {
        var fb = col.feedback !== undefined ? String(data[i][col.feedback] || '').trim() : '';
        var after = col.afterText !== undefined ? String(data[i][col.afterText] || '').trim() : '';
        if (fb) {
          var afterPreview = after.length > 200 ? (after.slice(0, 200) + '…') : after;
          edits.push('#' + edits.length + ' 指示:' + fb + ' → 結果(冒頭):' + afterPreview);
        }
      }
    }

    return edits.join('\n');
  } catch (e) {
    Logger.log('mr_fix 過去ログ取得エラー: ' + e);
    return '';
  }
}

/**
 * 修正用プロンプトを構築（user message部分）
 */
function mr_fix_buildPrompt_(currentText, feedback, pastEditsText, context) {
  var parts = [];

  parts.push('# 修正依頼');
  parts.push('以下の月次報告書ドラフトに対して修正指示が出ています。');
  parts.push('指示に従って報告書全体を修正し、修正後の報告書全文を出力してください。');
  parts.push('');
  parts.push('## 現在の報告書');
  parts.push(currentText);
  parts.push('');
  parts.push('## 修正指示');
  parts.push(feedback);

  if (pastEditsText) {
    parts.push('');
    parts.push('## 過去の修正履歴（このPJで過去に出された修正指示の傾向。参考にすること）');
    parts.push(pastEditsText);
  }

  parts.push('');
  parts.push('## 出力ルール');
  parts.push('- 修正指示に従って報告書全体を修正し、全文を出力する');
  parts.push('- 修正指示に関係ない部分はそのまま維持する');
  parts.push('- Markdown形式を維持する');
  parts.push('- 見出しは ## から始める（# は使わない）');
  parts.push('- 修正についてのメタ説明（「以下を修正しました」等）は一切書かない');
  parts.push('- 出力は報告書本文のみ');

  return parts.join('\n');
}

/**
 * Claude API呼び出し（system prompt + user message分離版）
 */
function mr_fix_callClaude_(systemPrompt, userPrompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません');
  }

  var payload = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  var options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  var data = JSON.parse(response.getContentText());

  if (data.error) {
    throw new Error('Claude API Error: ' + data.error.message);
  }

  var text = (data.content && data.content[0]) ? String(data.content[0].text || '') : '';
  var usage = data.usage ? JSON.stringify(data.usage) : '';

  return {
    text: text,
    model: data.model || '',
    tokenUsage: usage
  };
}

/**
 * DB_MonthlyReports の draftContent / fixCount / lastFixedAtJst を更新
 * @return {number} 更新後の fixCount
 */
function mr_fix_updateReport_(projectId, ym, fixedText, rowIndex, currentFixCount) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DB_MonthlyReports');
  if (!sh) throw new Error('DB_MonthlyReports が見つからない');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim();
    if (key) col[key] = c + 1; // 1-based for getRange
  }

  var newFixCount = (Number(currentFixCount) || 0) + 1;
  var nowJst = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  if (col.draftContent) {
    sh.getRange(rowIndex, col.draftContent).setValue(fixedText);
  }
  if (col.fixCount) {
    sh.getRange(rowIndex, col.fixCount).setValue(newFixCount);
  }
  if (col.lastFixedAtJst) {
    sh.getRange(rowIndex, col.lastFixedAtJst).setValue(nowJst);
  }

  return newFixCount;
}

/**
 * DB_MonthlyReportEdits にログを追記
 * @return {string} editId
 */
function mr_fix_appendLog_(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('DB_MonthlyReportEdits');
  if (!sh) {
    Logger.log('DB_MonthlyReportEdits が見つからない（ログ保存スキップ）');
    return '';
  }

  var editId = Utilities.getUuid();
  var nowJst = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = {};
  for (var c = 0; c < headers.length; c++) {
    var key = String(headers[c] || '').trim();
    if (key) col[key] = c;
  }

  var row = new Array(headers.length).fill('');

  if (col.editId !== undefined) row[col.editId] = editId;
  if (col.projectId !== undefined) row[col.projectId] = String(params.projectId || '');
  if (col.ym !== undefined) row[col.ym] = String(params.ym || '');
  if (col.beforeText !== undefined) row[col.beforeText] = String(params.beforeText || '');
  if (col.afterText !== undefined) row[col.afterText] = String(params.afterText || '');
  if (col.feedback !== undefined) row[col.feedback] = String(params.feedback || '');
  if (col.fixedByModel !== undefined) row[col.fixedByModel] = String(params.model || '');
  if (col.tokenUsage !== undefined) row[col.tokenUsage] = String(params.tokenUsage || '');
  if (col.createdAtJst !== undefined) row[col.createdAtJst] = nowJst;

  sh.appendRow(row);

  // ym列を文字列フォーマットに強制（数値化防止）
  if (col.ym !== undefined) {
    var lastRow = sh.getLastRow();
    sh.getRange(lastRow, col.ym + 1).setNumberFormat('@');
  }

  return editId;
}