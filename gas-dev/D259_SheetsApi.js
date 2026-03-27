// D259_SheetsApi.gs
// 全スプレッドシートのシート一覧を取得するAPI

function admin_listAllSheets(appId, opts) {
  const forceRefresh = opts && opts.forceRefresh === true;
  const CACHE_KEY    = 'admin_allSheets:' + (appId || 'default');
  const cache        = CacheService.getScriptCache();

  if (!forceRefresh) {
    const l1 = cache.get(CACHE_KEY);
    if (l1) { try { return JSON.parse(l1); } catch(e) {} }
    const ssNames = ['本体スプシ','Navigatorスプシ','Navigator Store','Protocol Store','Dev Sheet'];
    let l2Sheets = [], l2Hit = false;
    ssNames.forEach(name => {
      const rows = getSheetCache_(CACHE_KEY + ':' + name);
      if (Array.isArray(rows)) { l2Sheets = l2Sheets.concat(rows); l2Hit = true; }
    });
    if (l2Hit && l2Sheets.length > 0) {
      const l2Result = { ok: true, sheets: l2Sheets };
      try { cache.put(CACHE_KEY, JSON.stringify(l2Result), 600); } catch(e) {}
      return l2Result;
    }
  }

  const props = PropertiesService.getScriptProperties();
  let cfg = null;
  if (appId) { try { cfg = getAppConfig_(appId); } catch(e) {} }

  const spreadsheets = {
    '本体スプシ':      (cfg ? cfg.mainSpreadsheetId : null) || props.getProperty('MAIN_SPREADSHEET_ID'),
    'Navigatorスプシ': props.getProperty('NAVIGATOR_SPREADSHEET_ID'),
    'Navigator Store': props.getProperty('NAVIGATOR_STORE_SPREADSHEET_ID'),
    'Protocol Store':  props.getProperty('PROTOCOL_STORE_SPREADSHEET_ID'),
    'Dev Sheet':       (cfg ? cfg.devSheetId : null) || props.getProperty('DEV_SHEET_ID'),
  };

  const allSheets = [];
  Object.keys(spreadsheets).forEach(ssName => {
    const ssId = spreadsheets[ssName];
    if (!ssId) {
      allSheets.push({ ssName, ssId: null, ssUrl: null, name:'(ID未設定)', rows:0, cols:0, headers:[], error:true });
      return;
    }
    try {
      const ss    = SpreadsheetApp.openById(ssId);
      const ssUrl = ss.getUrl();
      ss.getSheets().forEach(sh => {
        let headers = [];
        try {
          if (sh.getLastColumn() > 0)
            headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h => String(h||''));
        } catch(e) {}
        allSheets.push({ ssName, ssId, ssUrl, name:sh.getName(), rows:sh.getLastRow(), cols:sh.getLastColumn(), headers, error:false });
      });
    } catch(e) {
      allSheets.push({ ssName, ssId, ssUrl:null, name:'(読み込みエラー)', rows:0, cols:0, headers:[], error:true, errorMsg:String(e) });
    }
  });

  allSheets.sort((a,b) => a.name.localeCompare(b.name,'ja'));
  const result = { ok: true, sheets: allSheets };

  try {
    const byss = {};
    allSheets.forEach(sh => {
      const k = CACHE_KEY + ':' + sh.ssName;
      if (!byss[k]) byss[k] = [];
      byss[k].push(sh);
    });
    setSheetCacheBatch_(Object.keys(byss).map(k => ({ key:k, data:byss[k] })));
    const json = JSON.stringify(result);
    if (json.length < 90000) cache.put(CACHE_KEY, json, 600);
  } catch(e) {}

  return result;
}