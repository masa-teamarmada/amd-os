// 523_CockpitMacroApi.gs
// Cockpitマクロ提言パネル向けAPI。DB_TsukuyomiContextからprojectMacroを取得して返す。
function cockpit_api_getMacroInsights(params) {
  try {
    const projectId = params.projectId;
    if (!projectId) return { ok: false, message: 'projectId missing' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('DB_TsukuyomiContext');
    if (!sheet) return { ok: true, items: [] };

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx = h => headers.indexOf(h);

    const items = data.slice(1)
      .filter(row =>
        row[idx('contextType')] === 'projectMacro' &&
        row[idx('scope')] === 'project' &&
        String(row[idx('scopeKey')]) === String(projectId) &&
        row[idx('status')] === 'active' &&
        String(row[idx('tags')]).split(',').includes('macro')
      )
      .map(row => ({
        contextId:       row[idx('contextId')],
        priority:        Number(row[idx('priority')]) || 0,
        systemPrompt:    row[idx('systemPrompt')],
        rationale:       row[idx('rationale')],
        evidenceSnippet: row[idx('evidenceSnippet')],
        updatedAtJst:    row[idx('updatedAtJst')]
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);

    return JSON.parse(JSON.stringify({ ok: true, items }));
  } catch (e) {
    return { ok: false, message: e.message };
  }
}