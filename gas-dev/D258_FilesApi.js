// D258_FilesApi.gs
// 全GASプロジェクトのファイル一覧を横断取得するAPI

function admin_listAllGasFiles(appId) {
  const token  = ScriptApp.getOAuthToken();
  let projects = GAS_PROJECTS_;
  if (appId) {
    try {
      const cfg = getAppConfig_(appId);
      if (cfg.gasProjects && Object.keys(cfg.gasProjects).length > 0) projects = cfg.gasProjects;
    } catch(e) {}
  }
  const result = {};
  Object.keys(projects).forEach(name => {
    const scriptId = projects[name];
    try {
      const res  = UrlFetchApp.fetch(
        'https://script.googleapis.com/v1/projects/' + scriptId + '/content',
        { headers:{ Authorization:'Bearer ' + token }, muteHttpExceptions:true }
      );
      const data = JSON.parse(res.getContentText());
      if (data.files) {
        result[name] = data.files.map(f => ({
          name: f.name, type: f.type,
          lines: f.source ? f.source.split('\n').length : 0,
        })).sort((a,b) => a.name.localeCompare(b.name));
      } else {
        result[name] = { error: JSON.stringify(data) };
      }
    } catch(e) {
      result[name] = { error: String(e) };
    }
  });
  return { ok: true, projects: result };
}

function admin_getFileFunctions(appId, params) {
  const projectName = String((params || {}).projectName || '').trim();
  const fileName    = String((params || {}).fileName    || '').trim();
  if (!projectName || !fileName) return { ok: false, message: 'params missing' };

  let projects = GAS_PROJECTS_;
  if (appId) {
    try {
      const cfg = getAppConfig_(appId);
      if (cfg.gasProjects && Object.keys(cfg.gasProjects).length > 0) projects = cfg.gasProjects;
    } catch(e) {}
  }

  const scriptId = projects[projectName];
  if (!scriptId) return { ok: false, message: 'project not found: ' + projectName };

  const token = ScriptApp.getOAuthToken();
  const res   = UrlFetchApp.fetch(
    'https://script.googleapis.com/v1/projects/' + scriptId + '/content',
    { headers:{ Authorization:'Bearer ' + token }, muteHttpExceptions:true }
  );
  const data = JSON.parse(res.getContentText());
  if (!data.files) return { ok: false, message: JSON.stringify(data) };
  const file = data.files.find(f => f.name === fileName);
  if (!file) return { ok: false, message: 'file not found: ' + fileName };
  const stripped = (file.source||'').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const fns = [];
  const re  = /function\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(stripped)) !== null) fns.push(m[1]);
  return { ok: true, functions: fns, total: fns.length };
}