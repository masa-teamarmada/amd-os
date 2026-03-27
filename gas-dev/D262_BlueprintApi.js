// D262_BlueprintApi.gs
// Blueprint エントリの読み書きAPI（DB_Blueprint ↔ DEV_EXPORT_DOC）

const BLUEPRINT_SHEET_NAME_ = 'DB_Blueprint';
const BLUEPRINT_HEADERS_    = ['id','type','domain','priority','title','status','updatedAt','jsonBlob'];
const BLUEPRINT_DOC_MARKER_ = 'BLUEPRINT_JSON:';
const BLUEPRINT_DOC_HEADER_ = '## Blueprint';

function adminBlueprint_getAll(appId) {
  try {
    const ss    = appId ? getDevSsByApp_(appId) : getDevSpreadsheet_();
    const sheet = ss.getSheetByName(BLUEPRINT_SHEET_NAME_);
    if (!sheet) return { ok: true, json: JSON.stringify({ schemaVersion:'2.0', updatedAt:'', entries:[] }) };
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { ok: true, json: JSON.stringify({ schemaVersion:'2.0', updatedAt:'', entries:[] }) };
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const blob = rows[i][7];
      if (!blob) continue;
      try { entries.push(JSON.parse(blob)); } catch(e) {}
    }
    const latestAt = entries.reduce((acc, e) => ((e.updatedAt||'') > acc ? e.updatedAt : acc), '');
    return { ok: true, json: JSON.stringify({ schemaVersion:'2.0', updatedAt:latestAt, entries }) };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function adminBlueprint_save(appId, jsonStr) {
  try {
    const data    = JSON.parse(jsonStr || '{}');
    const entries = data.entries;
    if (!Array.isArray(entries)) return { ok: false, message: 'entriesが配列でない' };
    const ss    = appId ? getDevSsByApp_(appId) : getDevSpreadsheet_();
    let sheet   = ss.getSheetByName(BLUEPRINT_SHEET_NAME_);
    if (!sheet) {
      sheet = ss.insertSheet(BLUEPRINT_SHEET_NAME_);
      sheet.getRange(1, 1, 1, BLUEPRINT_HEADERS_.length).setValues([BLUEPRINT_HEADERS_]);
      sheet.setFrozenRows(1);
    }
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
    if (!entries.length) return { ok: true, saved: 0 };
    const rows = entries.map(e => [
      e.id||'', e.type||e.category||'', e.domain||e.category||'',
      e.priority||3, e.title||e.uiSection||'', e.status||'active',
      e.updatedAt||'', JSON.stringify(e),
    ]);
    sheet.getRange(2, 1, rows.length, BLUEPRINT_HEADERS_.length).setValues(rows);
    return { ok: true, saved: entries.length };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function adminBlueprint_generateViz(appId, jsonStr) {
  try {
    const data    = JSON.parse(jsonStr || '{}');
    const entries = (data.entries || []).filter(e => e.status !== 'deprecated');
    if (!entries.length) return { ok: false, message: 'エントリが0件です' };
    const cfg      = appId ? getAppConfig_(appId) : null;
    const mainSsId = cfg ? cfg.mainSpreadsheetId : PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID');
    const promptRows = dev_listContextRowsById_(mainSsId, { tag: 'blueprint_visualize', status: 'active' });
    if (!promptRows.length) return { ok: false, message: 'DB_TsukuyomiContextにtag=blueprint_visualizeのプロンプトが見つかりません' };
    const systemPrompt = promptRows.map(r => String(r.systemPrompt || '').trim()).filter(Boolean).join('\n\n');
    const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { ok: false, message: 'ANTHROPIC_API_KEY未設定' };
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:16000,
        messages:[{ role:'user', content: systemPrompt + '\n\n' + JSON.stringify(entries, null, 2) }] }),
      muteHttpExceptions: true,
    });
    const resJson = JSON.parse(res.getContentText());
    if (!resJson.content || !resJson.content[0]) return { ok: false, message: 'API応答異常: ' + res.getContentText().substring(0,200) };
    const raw      = resJson.content[0].text || '';
    const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/i);
    if (!svgMatch) return { ok: false, message: 'SVGが見つかりませんでした。LLMの応答: ' + raw.substring(0,200) };
    return { ok: true, svg: svgMatch[0] };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function adminBlueprint_generateSpec(appId, jsonStr) {
  try {
    const data    = JSON.parse(jsonStr || '{}');
    const entries = (data.entries || []).filter(e => e.status !== 'deprecated');
    if (!entries.length) return { ok: false, message: 'エントリが0件です' };
    const cfg      = appId ? getAppConfig_(appId) : null;
    const mainSsId = cfg ? cfg.mainSpreadsheetId : PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID');
    const promptRows = dev_listContextRowsById_(mainSsId, { tag: 'blueprint_spec', status: 'active' });
    if (!promptRows.length) return { ok: false, message: 'DB_TsukuyomiContextにtag=blueprint_specのプロンプトが見つかりません' };
    const systemPrompt = promptRows.map(r => String(r.systemPrompt || '').trim()).filter(Boolean).join('\n\n');
    const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!apiKey) return { ok: false, message: 'ANTHROPIC_API_KEY未設定' };
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:4096,
        messages:[{ role:'user', content: systemPrompt + '\n\n' + JSON.stringify(entries, null, 2) }] }),
      muteHttpExceptions: true,
    });
    const resJson = JSON.parse(res.getContentText());
    if (!resJson.content || !resJson.content[0]) return { ok: false, message: 'API応答異常: ' + res.getContentText().substring(0,200) };
    return { ok: true, markdown: resJson.content[0].text };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function adminBlueprint_exportToDoc(appId) {
  try {
    const result  = adminBlueprint_getAll(appId);
    if (!result.ok) return { ok: false, message: result.message };
    const entries = JSON.parse(result.json).entries || [];
    const cfg     = appId ? getAppConfig_(appId) : null;
    const docId   = cfg ? cfg.exportDocId : PropertiesService.getScriptProperties().getProperty('DEV_EXPORT_DOC_ID');
    if (!docId) return { ok: false, message: 'exportDocIdが未設定' };
    const doc  = DocumentApp.openById(docId);
    const body = doc.getBody();
    const n    = body.getNumChildren();
    const newText = BLUEPRINT_DOC_MARKER_ + JSON.stringify(entries);
    for (let i = 0; i < n; i++) {
      const el = body.getChild(i);
      if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      if (el.asParagraph().getText().indexOf(BLUEPRINT_DOC_MARKER_) === 0) {
        el.asParagraph().editAsText().setText(newText);
        doc.saveAndClose();
        return { ok: true, exported: entries.length };
      }
    }
    let sectionIdx = -1;
    for (let i = 0; i < n; i++) {
      const el = body.getChild(i);
      if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
      if (el.asParagraph().getText().trim() === BLUEPRINT_DOC_HEADER_) { sectionIdx = i; break; }
    }
    if (sectionIdx >= 0) { body.insertParagraph(sectionIdx + 1, newText); }
    else { body.appendParagraph(BLUEPRINT_DOC_HEADER_); body.appendParagraph(newText); }
    doc.saveAndClose();
    return { ok: true, exported: entries.length };
  } catch(e) {
    return { ok: false, message: e.message };
  }
}

function dev_listContextRows_(params) {
  const ssId = PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID');
  return dev_listContextRowsById_(ssId, params);
}

function dev_listContextRowsById_(ssId, params) {
  params = params || {};
  if (!ssId) throw new Error('MAIN_SPREADSHEET_IDが未設定');
  const sheet = SpreadsheetApp.openById(ssId).getSheetByName('DB_TsukuyomiContext');
  if (!sheet) throw new Error('DB_TsukuyomiContextシートが見つからない');
  const data    = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = String(row[i] || ''); });
    return obj;
  }).filter(r => {
    if (params.tag    && r.tags   !== params.tag)    return false;
    if (params.status && r.status !== params.status) return false;
    return true;
  }).sort((a, b) => Number(a.priority||999) - Number(b.priority||999));
}