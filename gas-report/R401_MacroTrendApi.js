// R401_MacroTrendApi.gs
// GoogleアラートRSSフィードを取得しDB_MacroTrendLogに格納する

function fetchMacroTrends() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('MAIN_SPREADSHEET_ID')
  );
  const configSheet = ss.getSheetByName('DB_MacroAlertConfig');
  const logSheet = ss.getSheetByName('DB_MacroTrendLog');

  const configs = getMacroActiveConfigs_(configSheet);
  if (configs.length === 0) {
    Logger.log('有効なアラート設定がありません');
    return;
  }

  const existingUrls = getMacroExistingUrls_(logSheet);

  configs.forEach(config => {
    try {
      fetchAndWriteMacroRss_(config, logSheet, existingUrls);
    } catch (e) {
      Logger.log(`RSS取得エラー [${config.configId}]: ${e.message}`);
    }
  });
}

function getMacroActiveConfigs_(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = h => headers.indexOf(h);
  return data.slice(1)
    .filter(row => String(row[idx('isActive')]).toUpperCase() === 'TRUE')
    .map(row => ({
      configId: row[idx('configId')],
      projectId: row[idx('projectId')],
      keyword: row[idx('keyword')],
      rssUrl: row[idx('rssUrl')],
    }));
}

function getMacroExistingUrls_(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return new Set();
  const urlIdx = data[0].indexOf('sourceUrl');
  return new Set(data.slice(1).map(row => row[urlIdx]));
}

function fetchAndWriteMacroRss_(config, logSheet, existingUrls) {
  const response = UrlFetchApp.fetch(config.rssUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log(`HTTP ${response.getResponseCode()}: ${config.rssUrl}`);
    return;
  }

  const entries = parseMacroAtomFeed_(response.getContentText());
  const nowJst = mr_formatJst_(new Date(), 'yyyy年MM月dd日 HH:mm');
  let added = 0;

  entries.forEach(entry => {
    if (existingUrls.has(entry.url)) return;
    const logId = `mtl_${Utilities.getUuid()}`;
    logSheet.appendRow([
      logId, config.projectId, config.configId, nowJst,
      entry.url, entry.title,
      '', '', '', 'raw', '', nowJst
    ]);
    existingUrls.add(entry.url);
    added++;
  });

  Logger.log(`[${config.keyword}] ${added}件追加`);
}

function parseMacroAtomFeed_(xml) {
  const root = XmlService.parse(xml).getRootElement();
  const ns = root.getNamespace();
  return root.getChildren('entry', ns).map(entry => {
    const linkEl = entry.getChild('link', ns);
    return {
      title: entry.getChildText('title', ns) || '',
      url: linkEl && linkEl.getAttribute('href') ? linkEl.getAttribute('href').getValue() : ''
    };
  });
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