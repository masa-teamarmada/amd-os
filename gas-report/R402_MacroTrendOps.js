// R402_MacroTrendOps.gs
// DB_MacroTrendLogのrawエントリをLLMでスコアリングし、高スコアをDB_TsukuyomiContextへプロモート

function scoreMacroTrends() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID')
  );
  const logSheet = ss.getSheetByName('DB_MacroTrendLog');
  const contextSheet = ss.getSheetByName('DB_TsukuyomiContext');
  const projectSheet = ss.getSheetByName('DB_Projects');

  const data = logSheet.getDataRange().getValues();
  const headers = data[0];
  const idx = h => headers.indexOf(h);

  const rawRows = data.slice(1)
    .map((row, i) => ({ row, rowNum: i + 2 }))
    .filter(({ row }) => row[idx('status')] === 'raw' && row[idx('sourceUrl')] !== '');

  if (rawRows.length === 0) {
    Logger.log('スコアリング対象なし');
    return;
  }

  const projectMap = buildMacroProjectMap_(projectSheet);
  const prompt = getMacroScoringPrompt_();
  const nowJst = mr_formatJst_(new Date(), 'yyyy年MM月dd日 HH:mm');

  rawRows.forEach(({ row, rowNum }) => {
    try {
      const projectName = projectMap[row[idx('projectId')]] || row[idx('projectId')];
      const result = callMacroScoringLlm_(prompt, projectName, row[idx('title')]);

      logSheet.getRange(rowNum, idx('summaryLlm') + 1).setValue(result.summary);
      logSheet.getRange(rowNum, idx('relevanceScore') + 1).setValue(result.score);
      logSheet.getRange(rowNum, idx('insightForProject') + 1).setValue(result.insight);

      if (result.score >= 7) {
        const contextId = promoteMacroToContext_(contextSheet, row, headers, result, nowJst);
        logSheet.getRange(rowNum, idx('promotedContextId') + 1).setValue(contextId);
        logSheet.getRange(rowNum, idx('status') + 1).setValue('linked');
      } else {
        logSheet.getRange(rowNum, idx('status') + 1).setValue('dismissed');
      }

      Utilities.sleep(1000);
    } catch (e) {
      Logger.log(`スコアリングエラー row${rowNum}: ${e.message}`);
    }
  });
}

function getMacroScoringPrompt_() {
  const sheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID')
  ).getSheetByName('DB_TsukuyomiContext');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = h => headers.indexOf(h);
  const row = data.slice(1).find(r => r[idx('contextId')] === 'macro_scoring_prompt');
  if (!row) throw new Error('DB_TsukuyomiContextにmacro_scoring_promptが登録されていません');
  return row[idx('systemPrompt')];
}

function callMacroScoringLlm_(prompt, projectName, articleTitle) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  const payload = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: prompt,
    messages: [{ role: 'user', content: `プロジェクト名: ${projectName}\n記事タイトル: ${articleTitle}` }]
  };

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const text = JSON.parse(res.getContentText()).content[0].text;
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

function buildMacroProjectMap_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('projectId');
  const nameIdx = headers.indexOf('projectName');
  const map = {};
  data.slice(1).forEach(row => { map[row[idIdx]] = row[nameIdx]; });
  return map;
}

function promoteMacroToContext_(contextSheet, row, headers, result, nowJst) {
  const idx = h => headers.indexOf(h);
  const contextId = `ctx_macro_${Utilities.getUuid()}`;
  const ch = contextSheet.getDataRange().getValues()[0];
  const ci = h => ch.indexOf(h);

  const newRow = new Array(ch.length).fill('');
  newRow[ci('contextId')] = contextId;
  newRow[ci('contextType')] = 'projectMacro';
  newRow[ci('scope')] = 'project';
  newRow[ci('scopeKey')] = row[idx('projectId')];
  newRow[ci('tags')] = 'macro,trend';
  newRow[ci('status')] = 'active';
  newRow[ci('priority')] = result.score;
  newRow[ci('systemPrompt')] = result.insight;
  newRow[ci('rationale')] = result.summary;
  newRow[ci('evidenceSnippet')] = row[idx('title')];
  newRow[ci('sourceEventIdsJson')] = JSON.stringify([row[idx('logId')]]);
  newRow[ci('createdAtJst')] = nowJst;
  newRow[ci('updatedAtJst')] = nowJst;

  contextSheet.appendRow(newRow);
  return contextId;
}

function setup_macroTrendTriggers() {
  var targets = ['fetchMacroTrends', 'scoreMacroTrends'];
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (targets.indexOf(triggers[i].getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('fetchMacroTrends')
    .timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('scoreMacroTrends')
    .timeBased().atHour(2).nearMinute(30).everyDays(1).create();
  Logger.log('[setup_macroTrendTriggers] triggers created');
  return { ok: true };
}