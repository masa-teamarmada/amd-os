/**
 * R303_MonthlyReport_Generator.gs
 * 
 * 役割:
 * - 収集したデータからLLM(Claude)で月次報告書を生成
 * - つくよみの人格で生成
 * 
 * 依存:
 * - 090_OpenAIClient.gs (Claude API呼び出し)
 * - 172_TsukuyomiContextRepo.gs (つくよみ人格)
 * - 302_MonthlyReport_Collector.gs
 * - 310_MonthlyReport_Formatter.gs
 */

/**
 * 月次報告書のドラフトを生成
 * @param {string} projectId
 * @param {string} ym
 * @param {Object} activities - 収集した活動データ
 * @return {Object} 生成結果
 */
function mr_generateDraft_(projectId, ym, activities) {
  try {
    Logger.log('=== 月次報告書生成開始 ===');
    
    // プロジェクト情報を取得
    const projectInfo = mr_gen_getProjectInfo_(projectId);
    projectInfo.members = mr_gen_getProjectMembers_(projectId, ym);
    
    // 年間価値計画を取得
    const valuePlan = mr_gen_getValuePlan_(projectId);
    
    // つくよみ人格を取得
    const tsukuyomiContext = mr_gen_getTsukuyomiContext_(projectId);
    
    // プロンプトを構築
    const prompt = mr_gen_buildPrompt_(projectInfo, ym, activities, valuePlan, tsukuyomiContext);
    
    // Claude APIで生成
    const response = mr_gen_callClaude_(prompt);
    
    const draft = response.content[0].text;
    
    Logger.log('=== 報告書生成完了 ===');
    
    return {
      success: true,
      draft: draft,
      generated_at_jst: mr_formatReadable_(mr_now_()),
      token_usage: response.usage,
      model: response.model
    };
    
  } catch (error) {
    Logger.log('報告書生成エラー: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * プロジェクト情報を取得
 * @param {string} projectId
 * @return {Object}
 */
function mr_gen_getProjectInfo_(projectId) {
  try {
    const ss = b_ss_();
    const sheet = ss.getSheetByName('DB_Projects');
    
    if (!sheet) {
      throw new Error('DB_Projects シートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      throw new Error('DB_Projects にデータがありません');
    }
    
    const headers = data[0];
    const projectIdIdx = headers.indexOf('projectId');
    const projectNameIdx = headers.indexOf('projectName');
    const clientNameIdx = headers.indexOf('clientName');
    const pmIdx = headers.indexOf('PM');
    const statusIdx = headers.indexOf('status');
    
    if (projectIdIdx === -1) {
      throw new Error('projectId 列が見つかりません');
    }
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIdx] === projectId) {
        const projectInfo = {
          projectId: data[i][projectIdIdx],
          projectName: projectNameIdx !== -1 ? data[i][projectNameIdx] : '',
          clientName: clientNameIdx !== -1 ? data[i][clientNameIdx] : '',
          PM: pmIdx !== -1 ? data[i][pmIdx] : '',
          status: statusIdx !== -1 ? data[i][statusIdx] : '',
          members: [] // あとでym付きで取得するため空にしておく
        };
        
        return projectInfo;
      }
    }
    
    throw new Error('プロジェクトが見つかりません: ' + projectId);
    
  } catch (error) {
    Logger.log('プロジェクト情報取得エラー: ' + error);
    throw error;
  }
}

/**
 * プロジェクトメンバー情報を取得
 * @param {string} projectId
 * @return {Array}
 */
function mr_gen_getProjectMembers_(projectId, ym) {
  try {
    var ss = b_ss_();
    
    var pmSheet = ss.getSheetByName('DB_ProjectMembers');
    if (!pmSheet) {
      Logger.log('DB_ProjectMembers シートが見つかりません');
      return [];
    }
    
    var pmData = pmSheet.getDataRange().getValues();
    if (pmData.length === 0) return [];
    
    var pmHeaders = pmData[0];
    var pmProjectIdIdx = pmHeaders.indexOf('projectId');
    var pmMemberIdIdx = pmHeaders.indexOf('memberId');
    var pmIsActiveIdx = pmHeaders.indexOf('isActive');
    var pmIsPMIdx = pmHeaders.indexOf('isPM');
    var pmRoleLabelIdx = pmHeaders.indexOf('roleLabel');
    var pmJoinYmIdx = pmHeaders.indexOf('joinYm');
    var pmLeaveYmIdx = pmHeaders.indexOf('leaveYm');
    
    if (pmProjectIdIdx === -1 || pmMemberIdIdx === -1) {
      return [];
    }
    
    var membersSheet = ss.getSheetByName('DB_Members');
    var membersData = membersSheet ? membersSheet.getDataRange().getValues() : [];
    var memberHeaders = membersData.length > 0 ? membersData[0] : [];
    var memberIdIdx = memberHeaders.indexOf('memberId');
    var memberNameIdx = memberHeaders.indexOf('memberName');
    
    var members = [];
    for (var i = 1; i < pmData.length; i++) {
      if (pmData[i][pmProjectIdIdx] !== projectId) continue;
      
      var isActive = pmIsActiveIdx !== -1 ? pmData[i][pmIsActiveIdx] : true;
      
      // ym指定がある場合、joinYm/leaveYmで在籍判定
      if (ym && pmJoinYmIdx !== -1) {
        var joinYm = String(pmData[i][pmJoinYmIdx] || '').trim();
        var leaveYm = pmLeaveYmIdx !== -1 ? String(pmData[i][pmLeaveYmIdx] || '').trim() : '';
        
        // joinYmが空 → 不明なのでisActiveで判定（従来どおり）
        if (joinYm) {
          if (joinYm > ym) continue;           // まだ参加してない
          if (leaveYm && leaveYm < ym) continue; // もう離脱してる
        } else {
          // joinYm空の場合はisActiveのみで判定
          if (!isActive) continue;
        }
      } else {
        if (!isActive) continue;
      }
      
      var memberId = pmData[i][pmMemberIdIdx];
      var memberName = memberId;
      
      if (membersData.length > 0 && memberIdIdx !== -1 && memberNameIdx !== -1) {
        for (var j = 1; j < membersData.length; j++) {
          if (membersData[j][memberIdIdx] === memberId) {
            memberName = membersData[j][memberNameIdx] || memberId;
            break;
          }
        }
      }
      
      members.push({
        memberId: memberId,
        memberName: memberName,
        isPM: pmIsPMIdx !== -1 ? pmData[i][pmIsPMIdx] : false,
        roleLabel: pmRoleLabelIdx !== -1 ? pmData[i][pmRoleLabelIdx] : ''
      });
    }
    
    return members;
    
  } catch (error) {
    Logger.log('メンバー取得エラー: ' + error);
    return [];
  }
}

/**
 * 年間価値計画を取得
 * @param {string} projectId
 * @return {Object|null}
 */
function mr_gen_getValuePlan_(projectId) {
  // 一旦無効化してデフォルト値を返す
  // TODO: 後で実装
  Logger.log('価値計画取得: スキップ（未実装）');
  return null;
}

/**
 * つくよみ人格コンテキストを取得（DB_TsukuyomiContextから）
 * tags="monthlyreport" の active 行を4レイヤー順に合成して返す
 * DBに行がなければフォールバックのデフォルトを返す
 * @param {string} projectId
 * @return {string}
 */
function mr_gen_getTsukuyomiContext_(projectId) {
  try {
    // tag=monthlyreportの全active行を取得
    var allRows = tsukuyomi_listContextRows({
      tag: 'monthlyreport',
      status: 'active'
    }).rows || [];
    
    // global行 + 該当PJ行のみフィルタ
    var filtered = allRows.filter(function(r) {
      var s = String(r.scope || '').trim();
      var sk = String(r.scopeKey || '').trim();
      if (!s || s === 'global') return true;
      if (s === 'project' && sk === projectId) return true;
      return false;
    });
    
    // priority昇順ソート
    filtered.sort(function(a, b) {
      var pa = Number(a.priority || 999);
      var pb = Number(b.priority || 999);
      return pa - pb;
    });
    
    var prompt = filtered
      .map(function(r) { return String(r.systemPrompt || '').trim(); })
      .filter(Boolean)
      .join('\n\n');
    
    if (prompt) {
      Logger.log('つくよみcontext取得: ' + filtered.length + '行（global + PJ固有）');
      return prompt;
    }
    
    Logger.log('つくよみcontext: 該当行なし、フォールバック使用');
  } catch (e) {
    Logger.log('つくよみcontext取得エラー（フォールバック使用）: ' + e);
  }
  
  return 'あなたはAMD OSの月次報告書生成アシスタント「つくよみ」です。\n\n'
    + '役割:\n'
    + '- 収集されたプロジェクトの活動データから、クライアントに提出する月次報告書を作成する\n'
    + '- 事実ベースで、分かりやすく、プロフェッショナルな文章を心がける\n';
}

/**
 * Claude用プロンプトを構築
 * @param {Object} projectInfo
 * @param {string} ym
 * @param {Object} activities
 * @param {Object} valuePlan
 * @param {string} tsukuyomiContext
 * @return {string}
 */
function mr_gen_buildPrompt_(projectInfo, ym, activities, valuePlan, tsukuyomiContext) {
  var ymFormatted = mr_formatYm_(ym);
  var MAX_CHARS = 12000; // 活動データ部分の上限（≒3000トークン程度）

  var prompt = tsukuyomiContext + '\n\n'
    + '# 依頼内容\n'
    + projectInfo.projectName + 'の' + ymFormatted + 'の月次報告書ドラフトを作成してください。\n\n'
    + '# プロジェクト情報\n'
    + '- プロジェクト名: ' + projectInfo.projectName + '\n'
    + '- クライアント: ' + projectInfo.clientName + '\n'
    + '- PM: ' + projectInfo.PM + '\n'
    + '- メンバー: ' + projectInfo.members.map(function(m){ return m.memberName + '(' + m.roleLabel + ')'; }).join(', ') + '\n';

  // PJAlias（関連キーワード）を取得してフィルタ参考情報として追加
  var aliases = mr_gen_getPJAliases_(projectInfo.projectId);
  if (aliases) {
    prompt += '\n# PJ関連キーワード（参考）\n'
      + '以下はこのプロジェクトに関連する名称・キーワードです。\n'
      + '活動データの中にこれらと無関係な話題が含まれている場合は、報告書に含めないでください。\n'
      + '（ただし、関連性が判断しづらい場合は含めて構いません）\n'
      + aliases + '\n';
  }

  if (valuePlan) {
    prompt += '\n# 年間価値計画\n' + JSON.stringify(valuePlan, null, 2) + '\n';
  }

  prompt += '\n# 今月の活動データ\n';

  // 活動データを文字数上限で切る
  var dataParts = [];
  var usedChars = 0;

  // Notion（優先度高：議事録は報告書の根幹）
  if (activities.notion && activities.notion.success && activities.notion.pages && activities.notion.pages.length > 0) {
    var notionText = '## Notion (' + activities.notion.pages.length + 'ページ更新)\n'
      + mr_notion_formatForSummary_(activities.notion.pages.slice(0, 10));
    dataParts.push(notionText);
    usedChars += notionText.length;
  }

  // Slack（優先度中：量が多いので絞る）
  if (activities.slack && activities.slack.success && activities.slack.messages && activities.slack.messages.length > 0) {
    var slackLimit = (usedChars > MAX_CHARS * 0.5) ? 10 : 20;
    var slackText = '## Slack (' + activities.slack.stats.totalInteractions + '件の投稿・返信)\n'
      + mr_slack_formatForSummary_(activities.slack.messages, slackLimit);
    dataParts.push(slackText);
    usedChars += slackText.length;
  }

  // Gmail
  if (usedChars < MAX_CHARS && activities.gmail && activities.gmail.success && activities.gmail.threads && activities.gmail.threads.length > 0) {
    var gmailText = '## Gmail (' + activities.gmail.threads.length + 'スレッド)\n'
      + mr_gmail_formatForSummary_(activities.gmail.threads, 8);
    dataParts.push(gmailText);
    usedChars += gmailText.length;
  }

  // Drive
  if (usedChars < MAX_CHARS && activities.drive && activities.drive.success && activities.drive.files && activities.drive.files.length > 0) {
    var driveText = '## Drive (' + activities.drive.files.length + 'ファイル更新)\n'
      + mr_drive_formatForSummary_(activities.drive.files, 10);
    dataParts.push(driveText);
    usedChars += driveText.length;
  }

  // 合計が上限超えたら末尾から削る
  var combined = dataParts.join('\n\n');
  if (combined.length > MAX_CHARS) {
    combined = combined.slice(0, MAX_CHARS) + '\n\n（データ量が多いため一部省略）';
  }

  prompt += combined;

  prompt += '\n\n# 出力形式\n\n'
    + 'クライアントに提出できるレベルの月次報告書を作成してください。\n\n'
    + '## 構成\n\n'
    + '### 1. エグゼクティブサマリー\n'
    + '今月の主な成果を3-5文で簡潔に要約\n\n'
    + '### 2. 今月の主な進捗\n'
    + '### 3. 課題と対応\n'
    + '### 4. 次月の予定\n'
    + '### 5. メンバー貢献サマリー\n'
    + '### 6. スライド用サマリー\n';

  return prompt;
}

/**
 * CFG_PJAliasからプロジェクトの関連キーワードを取得
 * @param {string} projectId
 * @return {string|null}
 */
function mr_gen_getPJAliases_(projectId) {
  try {
    var ss = b_ss_();
    
    // projectId → projectName(=pjCode) を変換
    var projSheet = ss.getSheetByName('DB_Projects');
    if (!projSheet) return null;
    var projData = projSheet.getDataRange().getValues();
    var projHeaders = projData[0];
    var pidIdx = projHeaders.indexOf('projectId');
    var pnIdx = projHeaders.indexOf('projectName');
    if (pidIdx === -1 || pnIdx === -1) return null;
    
    var pjCode = null;
    for (var i = 1; i < projData.length; i++) {
      if (String(projData[i][pidIdx] || '').trim() === projectId) {
        pjCode = String(projData[i][pnIdx] || '').trim();
        break;
      }
    }
    if (!pjCode) return null;
    
    // CFG_PJAliasからpjCode一致行を取得
    var sheet = ss.getSheetByName('CFG_PJAlias');
    if (!sheet) return null;
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;
    
    var headers = data[0];
    var codeIdx = headers.indexOf('pjCode');
    var aliasIdx = headers.indexOf('alias');
    if (codeIdx === -1 || aliasIdx === -1) return null;
    
    var aliases = [];
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][codeIdx] || '').trim() === pjCode) {
        var a = String(data[j][aliasIdx] || '').trim();
        if (a) aliases.push(a);
      }
    }
    
    return aliases.length > 0 ? ('PJコード: ' + pjCode + '\n関連キーワード: ' + aliases.join(', ')) : null;
  } catch (e) {
    Logger.log('PJAlias取得エラー: ' + e);
    return null;
  }
}

/**
 * Claude APIを呼び出し
 * @param {string} prompt
 * @return {Object}
 */
/**
 * Claude APIを呼び出し（Overloaded時は30秒待って1回リトライ）
 * @param {string} prompt
 * @return {Object}
 */
function mr_gen_callClaude_(prompt) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません');
  }

  var url = 'https://api.anthropic.com/v1/messages';

  var payload = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt
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

  var MAX_RETRIES = 1;
  var RETRY_WAIT_MS = 30000;

  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());

    if (data.error) {
      var errMsg = String(data.error.message || data.error.type || '');
      var errType = String(data.error.type || '');

      // Overloaded or rate limit → リトライ
      if (attempt < MAX_RETRIES && (errType === 'overloaded_error' || errMsg.indexOf('Overloaded') >= 0 || response.getResponseCode() === 529)) {
        Logger.log('[Claude API] Overloaded検知、' + (RETRY_WAIT_MS / 1000) + '秒後にリトライ (attempt ' + (attempt + 1) + ')');
        Utilities.sleep(RETRY_WAIT_MS);
        continue;
      }

      throw new Error('Claude API Error: ' + errMsg);
    }

    return data;
  }

  throw new Error('Claude API Error: リトライ上限到達');
}

/**
 * 既存の月次報告書を、差分データで更新した版を生成する。
 * 日次cronから呼ばれる。差分が少量なので入力トークンも少なく済む。
 *
 * @param {string} projectId
 * @param {string} ym
 * @param {string} existingDraft - 既存の報告書テキスト（Markdown）
 * @param {Object} deltaActivities - mr_collectDeltaActivities_ の戻り値
 * @return {Object} 生成結果（mr_generateDraft_ と同じ構造）
 */
function mr_generateDraftUpdate_(projectId, ym, existingDraft, deltaActivities) {
  try {
    Logger.log('=== 月次報告書 差分更新 ===');

    var projectInfo = mr_gen_getProjectInfo_(projectId);
    projectInfo.members = mr_gen_getProjectMembers_(projectId, ym);
    var tsukuyomiContext = mr_gen_getTsukuyomiContext_(projectId);
    var ymFormatted = mr_formatYm_(ym);

    // 差分データを整形
    var deltaText = mr_gen_buildDeltaSection_(deltaActivities);

    var prompt = tsukuyomiContext + '\n\n'
      + '# 依頼内容\n'
      + projectInfo.projectName + 'の' + ymFormatted + 'の月次報告書を **更新** してください。\n\n'
      + '以下に「現在の報告書」と「過去24時間に新たに収集されたデータ」を示します。\n'
      + '新しいデータの内容を適切に反映して、報告書全体を更新してください。\n\n'
      + '## ルール\n'
      + '- 新しいデータで判明した事実を既存の報告書に統合する\n'
      + '- 既存の記述と矛盾する場合は、新しいデータを優先する\n'
      + '- 既存の構成（セクション構造）は維持する\n'
      + '- 事実ベースで、憶測や誇張を避ける\n'
      + '- 出力はMarkdown形式、見出しは ## から始める\n'
      + '- 報告書全文を出力する（差分だけでなく）\n'
      + '- 報告書末尾に `## スライド用サマリー` を付記（5文250字以内で完結させる）\n\n'
      + '---\n\n'
      + '# 現在の報告書\n\n'
      + existingDraft + '\n\n'
      + '---\n\n'
      + '# 過去24時間の新規データ\n\n'
      + deltaText;

    var response = mr_gen_callClaude_(prompt);
    var draft = response.content[0].text;

    Logger.log('=== 差分更新完了 ===');

    return {
      success: true,
      draft: draft,
      generated_at_jst: mr_formatReadable_(mr_now_()),
      token_usage: response.usage,
      model: response.model
    };

  } catch (error) {
    Logger.log('差分更新エラー: ' + error);
    return { success: false, error: error.toString() };
  }
}

/**
 * 差分収集結果をプロンプト用テキストに整形
 * @param {Object} delta - mr_collectDeltaActivities_ の戻り値
 * @return {string}
 */
function mr_gen_buildDeltaSection_(delta) {
  var parts = [];

  parts.push('収集期間: ' + delta.period.start + ' 〜 ' + delta.period.end);
  parts.push('');

  // Notion
  if (delta.notion && delta.notion.success && delta.notion.pages && delta.notion.pages.length > 0) {
    parts.push('## Notion（' + delta.notion.pages.length + 'ページ更新）');
    parts.push(mr_notion_formatForSummary_(delta.notion.pages.slice(0, 10)));
    parts.push('');
  }

  // Slack
  if (delta.slack && delta.slack.success && delta.slack.messages && delta.slack.messages.length > 0) {
    parts.push('## Slack（' + delta.slack.messages.length + '件）');
    parts.push(mr_slack_formatForSummary_(delta.slack.messages, 15));
    parts.push('');
  }

  // Gmail
  if (delta.gmail && delta.gmail.success && delta.gmail.threads && delta.gmail.threads.length > 0) {
    parts.push('## Gmail（' + delta.gmail.threads.length + 'スレッド）');
    parts.push(mr_gmail_formatForSummary_(delta.gmail.threads, 10));
    parts.push('');
  }

  // Drive
  if (delta.drive && delta.drive.success && delta.drive.files && delta.drive.files.length > 0) {
    parts.push('## Drive（' + delta.drive.files.length + 'ファイル更新）');
    parts.push(mr_drive_formatForSummary_(delta.drive.files, 10));
    parts.push('');
  }

  if (parts.length <= 2) {
    return '新規データなし';
  }

  return parts.join('\n');
}

/**
 * 過去の修正フィードバックを取得（同PJの直近3件）
 * @param {string} projectId
 * @return {string|null}
 */
function mr_gen_getPastFeedback_(projectId) {
  try {
    var ss = b_ss_();
    var sheet = ss.getSheetByName('DB_MonthlyReportEdits');
    if (!sheet) return null;
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;
    
    var headers = data[0];
    var pidIdx = headers.indexOf('projectId');
    var fbIdx = headers.indexOf('feedback');
    var createdIdx = headers.indexOf('createdAtJst');
    if (pidIdx === -1 || fbIdx === -1) return null;
    
    // 該当PJのfeedbackを収集
    var feedbacks = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][pidIdx] || '').trim() === projectId) {
        var fb = String(data[i][fbIdx] || '').trim();
        if (fb) {
          feedbacks.push({
            feedback: fb,
            created: createdIdx >= 0 ? String(data[i][createdIdx] || '') : ''
          });
        }
      }
    }
    
    if (feedbacks.length === 0) return null;
    
    // 日付降順で直近3件
    feedbacks.sort(function(a, b) { return b.created.localeCompare(a.created); });
    var recent = feedbacks.slice(0, 3);
    
    return recent.map(function(f) { return '- ' + f.feedback; }).join('\n');
  } catch (e) {
    Logger.log('過去feedback取得エラー: ' + e);
    return null;
  }
}

/**
 * 直近30件のfeedbackをLLMでサマライズしてDB_TsukuyomiContextに保存
 * @param {string} projectId
 * @return {Object}
 */
function mr_gen_regenerateFeedbackSummary_(projectId) {
  try {
    var ss = b_ss_();
    var sheet = ss.getSheetByName('DB_MonthlyReportEdits');
    if (!sheet) return { ok: false, error: 'DB_MonthlyReportEdits not found' };
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { ok: true, message: 'no edits' };
    
    var headers = data[0];
    var pidIdx = headers.indexOf('projectId');
    var fbIdx = headers.indexOf('feedback');
    var createdIdx = headers.indexOf('createdAtJst');
    if (pidIdx === -1 || fbIdx === -1) return { ok: false, error: 'missing columns' };
    
    // 該当PJのfeedbackを収集
    var feedbacks = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][pidIdx] || '').trim() !== projectId) continue;
      var fb = String(data[i][fbIdx] || '').trim();
      if (!fb) continue;
      feedbacks.push({
        feedback: fb,
        created: createdIdx >= 0 ? String(data[i][createdIdx] || '') : ''
      });
    }
    
    if (feedbacks.length === 0) return { ok: true, message: 'no feedbacks for ' + projectId };
    
    // 日付降順で直近30件
    feedbacks.sort(function(a, b) { return b.created.localeCompare(a.created); });
    var recent = feedbacks.slice(0, 30);
    
    // projectName取得
    var projectName = mr_notion_getProjectName_(projectId) || projectId;
    
    // LLMでサマライズ
    var feedbackText = recent.map(function(f, idx) {
      return (idx + 1) + '. [' + f.created + '] ' + f.feedback;
    }).join('\n');
    
    var prompt = '以下はプロジェクト「' + projectName + '」の月次報告書に対する過去の修正指示（直近' + recent.length + '件、新しい順）である。\n'
      + 'これらを分析し、以下の2カテゴリに整理せよ。\n\n'
      + '【カテゴリ1: 品質・文体に関する指示】\n'
      + '報告書の書き方、構成、詳細度、表現に関するルールを簡潔にまとめよ。\n\n'
      + '【カテゴリ2: PJ固有の知識】\n'
      + '人物の役割、組織のルール、技術的事実など、このPJ固有の情報を簡潔にまとめよ。\n'
      + '該当する情報がなければ「なし」と書け。\n\n'
      + '出力形式:\n'
      + '各カテゴリの内容だけを出力せよ。前置きや説明は不要。\n'
      + '報告書生成時のシステム指示としてそのまま使える文体で書け。\n\n'
      + '---\n\n'
      + feedbackText;
    
    var response = mr_gen_callClaude_(prompt);
    var summary = response.content[0].text;
    
    // カテゴリ1とカテゴリ2を分割
    var qualityText = '';
    var knowledgeText = '';
    
    var cat1Match = summary.match(/【カテゴリ1[^】]*】\s*([\s\S]*?)(?=【カテゴリ2|$)/);
    var cat2Match = summary.match(/【カテゴリ2[^】]*】\s*([\s\S]*?)$/);
    
    if (cat1Match) qualityText = cat1Match[1].trim();
    if (cat2Match) knowledgeText = cat2Match[1].trim();
    
    // DB_TsukuyomiContextに保存（品質）
    if (qualityText && qualityText !== 'なし') {
      tsukuyomi_upsertByContextId_({
        contextId: 'mr_fb_quality_' + projectId,
        tags: 'monthlyreport',
        status: 'active',
        systemPrompt: '【このPJでの過去の品質指示】\n' + qualityText,
        contextType: 'judge',
        priority: '15',
        scope: 'project',
        scopeKey: projectId
      });
    }
    
    // DB_TsukuyomiContextに保存（PJ知識）
    if (knowledgeText && knowledgeText !== 'なし') {
      tsukuyomi_upsertByContextId_({
        contextId: 'mr_fb_knowledge_' + projectId,
        tags: 'monthlyreport',
        status: 'active',
        systemPrompt: '【このPJ固有の知識】\n' + knowledgeText,
        contextType: 'memory',
        priority: '15',
        scope: 'project',
        scopeKey: projectId
      });
    }
    
    Logger.log('feedbackサマリー生成完了: ' + projectId + ' (品質: ' + qualityText.length + '字, 知識: ' + knowledgeText.length + '字)');
    return { ok: true, qualityLength: qualityText.length, knowledgeLength: knowledgeText.length };
    
  } catch (e) {
    Logger.log('feedbackサマリー生成エラー: ' + e);
    return { ok: false, error: e.toString() };
  }
}
function temp_regenFeedbackSummary() {
  var res = mr_gen_regenerateFeedbackSummary_("p21");
  Logger.log(JSON.stringify(res, null, 2));
}