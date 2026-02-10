/**
 * 303_MonthlyReport_Generator.gs
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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
          members: mr_gen_getProjectMembers_(projectId)
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
function mr_gen_getProjectMembers_(projectId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // DB_ProjectMembers を取得
    const pmSheet = ss.getSheetByName('DB_ProjectMembers');
    if (!pmSheet) {
      Logger.log('DB_ProjectMembers シートが見つかりません');
      return [];
    }
    
    const pmData = pmSheet.getDataRange().getValues();
    if (pmData.length === 0) return [];
    
    const pmHeaders = pmData[0];
    const pmProjectIdIdx = pmHeaders.indexOf('projectId');
    const pmMemberIdIdx = pmHeaders.indexOf('memberId');
    const pmIsActiveIdx = pmHeaders.indexOf('isActive');
    const pmIsPMIdx = pmHeaders.indexOf('isPM');
    const pmRoleLabelIdx = pmHeaders.indexOf('roleLabel');
    
    if (pmProjectIdIdx === -1 || pmMemberIdIdx === -1) {
      return [];
    }
    
    // DB_Members を取得
    const membersSheet = ss.getSheetByName('DB_Members');
    const membersData = membersSheet ? membersSheet.getDataRange().getValues() : [];
    const memberHeaders = membersData.length > 0 ? membersData[0] : [];
    const memberIdIdx = memberHeaders.indexOf('memberId');
    const memberNameIdx = memberHeaders.indexOf('memberName');
    
    // プロジェクトメンバーを抽出
    const members = [];
    for (let i = 1; i < pmData.length; i++) {
      if (pmData[i][pmProjectIdIdx] === projectId) {
        const isActive = pmIsActiveIdx !== -1 ? pmData[i][pmIsActiveIdx] : true;
        if (!isActive) continue;
        
        const memberId = pmData[i][pmMemberIdIdx];
        let memberName = memberId;
        
        // DB_Membersから名前を取得
        if (membersData.length > 0 && memberIdIdx !== -1 && memberNameIdx !== -1) {
          for (let j = 1; j < membersData.length; j++) {
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
 * つくよみ人格コンテキストを取得
 * @param {string} projectId
 * @return {string}
 */
function mr_gen_getTsukuyomiContext_(projectId) {
  // シンプルなデフォルトを返す
  return `あなたはAMD OSの月次報告書生成アシスタント「つくよみ」です。

役割:
- 収集されたプロジェクトの活動データから、クライアントに提出する月次報告書を作成する
- 事実ベースで、分かりやすく、プロフェッショナルな文章を心がける
- 具体的な数値や成果物名を明記する
- 内部用語は避け、クライアントが理解できる言葉で書く`;
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
  const ymFormatted = mr_formatYm_(ym);
  
  let prompt = `${tsukuyomiContext}

# 依頼内容
${projectInfo.projectName}の${ymFormatted}の月次報告書ドラフトを作成してください。

# プロジェクト情報
- プロジェクト名: ${projectInfo.projectName}
- クライアント: ${projectInfo.clientName}
- PM: ${projectInfo.PM}
- メンバー: ${projectInfo.members.map(m => `${m.memberName}(${m.roleLabel})`).join(', ')}
`;

  // 年間価値計画がある場合
  if (valuePlan) {
    prompt += `\n# 年間価値計画\n${JSON.stringify(valuePlan, null, 2)}\n`;
  }

  prompt += `\n# 今月の活動データ\n`;
  
  // Notion
  if (activities.notion && activities.notion.success && activities.notion.pages.length > 0) {
    prompt += `\n## Notion (${activities.notion.pages.length}ページ更新)\n`;
    prompt += mr_notion_formatForSummary_(activities.notion.pages.slice(0, 20));
  }
  
  // Slack
  if (activities.slack && activities.slack.success && activities.slack.messages.length > 0) {
    prompt += `\n## Slack (${activities.slack.stats.totalInteractions}件の投稿・返信)\n`;
    prompt += `統計: ${JSON.stringify(activities.slack.stats, null, 2)}\n`;
    prompt += mr_slack_formatForSummary_(activities.slack.messages, 30);
  }
  
  // Gmail
  if (activities.gmail && activities.gmail.success && activities.gmail.threads.length > 0) {
    prompt += `\n## Gmail (${activities.gmail.threads.length}スレッド)\n`;
    prompt += mr_gmail_formatForSummary_(activities.gmail.threads, 15);
  }
  
  // Calendar
  if (activities.calendar && activities.calendar.success && activities.calendar.events.length > 0) {
    prompt += `\n## Calendar (${activities.calendar.events.length}件のMTG, ${activities.calendar.stats.totalHours}時間)\n`;
    prompt += mr_calendar_formatForSummary_(activities.calendar.events);
  }
  
  // Drive
  if (activities.drive && activities.drive.success && activities.drive.files.length > 0) {
    prompt += `\n## Google Drive (${activities.drive.files.length}ファイル更新)\n`;
    prompt += mr_drive_formatForSummary_(activities.drive.files, 20);
  }
  
  // Navigator
  if (activities.navigator && activities.navigator.success && activities.navigator.logs.length > 0) {
    prompt += `\n## Navigator観測ログ (${activities.navigator.logs.length}件)\n`;
    prompt += JSON.stringify(activities.navigator.logs, null, 2);
  }
  
  prompt += `\n\n# 出力形式

クライアントに提出できるレベルの月次報告書を作成してください。

## 構成

### 1. エグゼクティブサマリー
今月の主な成果を3-5文で簡潔に要約

### 2. 今月の主な進捗
カテゴリ別に整理:
#### 2.1 [カテゴリ名]
- 具体的な成果
- 達成したマイルストーン
- 関与したメンバーと役割

#### 2.2 [カテゴリ名]
...

### 3. 課題と対応
今月発生した課題と、その対応状況・今後の予定

### 4. 次月の予定
${valuePlan ? '年間価値計画に照らして、' : ''}次月の重点施策と目標

### 5. メンバー貢献サマリー
各メンバーの主な貢献を簡潔に記載

---

# 重要な注意事項
- 事実ベースで記載し、憶測や誇張を避ける
- 数値や具体的な成果物名を明記
- クライアントが理解できる言葉で書く
- 内部の技術用語は必要に応じて説明を加える
${valuePlan ? '- 年間価値計画との関連を意識し、進捗状況を明示する' : ''}
- Markdown形式で出力
- 見出しは ## から始める(# は使わない)
`;

  return prompt;
}

/**
 * Claude APIを呼び出し
 * @param {string} prompt
 * @return {Object}
 */
function mr_gen_callClaude_(prompt) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません');
  }
  
  const url = 'https://api.anthropic.com/v1/messages';
  
  const payload = {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  };
  
  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());
  
  if (data.error) {
    throw new Error(`Claude API Error: ${data.error.message}`);
  }
  
  return data;
}