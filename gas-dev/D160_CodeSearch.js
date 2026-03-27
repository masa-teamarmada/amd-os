// D160_CodeSearch.gs
// コード横断検索（関数の定義位置・参照位置を探す）
// Apps Script API（projects.content）で全ファイルのソースを取得して検索する

const GAS_PROJECTS_ = {
  'main':   '18q6cSR9KXzX7vGfKiLPI5yNR8MMFeKi4qXYi2IvCI8R8GfcHaZAABq8c',
  'admin':  '1mZqDFgS0BHPquPp6hlteJVFEw6qhJrew6hI1LHJ9vCKZguPX6HqUOoLp',
  'report': '1r3Ak-tYASXYslWMnCGm_HIK0CAtISDQ-_emD8bg-k6RPMb1QFPNg7daR',
  'slack':  '1n1HgodXtQ34w6GHjWTZYYwv8F3yb2b10S-_uIWPQ574N1i8PRff4vFUB',
  'dev':    '1QtupbTVzNQ9vmudIiinyFps2-FCxoknFvnmZiqtlm1iBB83F4K7qgb5s',
};

function admin_findFunctionLocation(payload) {
  payload = payload || {};
  if (!canAccessDevForCodeSearch_()) return { ok: false, message: 'access denied', matches: [] };

  const functionNameRaw = String(payload.functionName || '').trim();
  const includeReferences = !!payload.includeReferences;
  const maxResults = (payload.maxResults != null) ? Number(payload.maxResults) : 200;
  const matchMode  = String(payload.matchMode || 'prefix').toLowerCase().trim();

  if (!functionNameRaw) return { ok: false, message: 'functionName empty', matches: [] };

  const content = fetchProjectContentText();
  if (!content.ok) return { ok: false, message: content.message, matches: [] };

  const files   = content.files || [];
  const matches = [];
  const qLower  = functionNameRaw.toLowerCase();

  const reAnyDecl = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/i;
  const reAnyCall = /\b([A-Za-z_$][\w$]*)\s*\(/g;

  function isMatch(name) {
    const n = String(name || '').toLowerCase();
    return matchMode === 'exact' ? n === qLower : n.indexOf(qLower) === 0;
  }

  for (const f of files) {
    const fileName = String(f.name || '');
    const fileType = String(f.type || '');
    const source   = String(f.source || '');
    if (!source) continue;
    const lines = source.split(/\r?\n/);

    for (let ln = 0; ln < lines.length; ln++) {
      const m = reAnyDecl.exec(lines[ln]);
      if (!m || !isMatch(m[1])) continue;
      matches.push({ kind: 'definition', fileName, fileType, line: ln + 1, foundName: m[1], snippet: lines[ln].trim() });
      if (maxResults > 0 && matches.length >= maxResults) return { ok: true, message: 'hit maxResults', matches: sortMatches_(matches) };
    }

    if (includeReferences) {
      for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        const declm = reAnyDecl.exec(line);
        if (declm && isMatch(declm[1])) continue;
        reAnyCall.lastIndex = 0;
        let m2;
        while ((m2 = reAnyCall.exec(line)) !== null) {
          if (!isMatch(m2[1])) continue;
          matches.push({ kind: 'reference', fileName, fileType, line: ln + 1, foundName: m2[1], snippet: line.trim() });
          if (maxResults > 0 && matches.length >= maxResults) return { ok: true, message: 'hit maxResults', matches: sortMatches_(matches) };
        }
      }
    }
  }

  if (!matches.length) return { ok: false, message: 'not found', matches: [] };
  return { ok: true, message: 'ok', matches: sortMatches_(matches) };
}

function admin_searchCode(payload) {
  payload = payload || {};
  if (!canAccessDevForCodeSearch_()) return { ok: false, message: 'access denied', matches: [] };

  const queryRaw   = String(payload.query || '').trim();
  const maxResults = (payload.maxResults != null) ? Number(payload.maxResults) : 200;
  if (!queryRaw) return { ok: false, message: 'query empty', matches: [] };

  const content = fetchProjectContentText();
  if (!content.ok) return { ok: false, message: content.message, matches: [] };

  const matches = [];
  const qLower  = queryRaw.toLowerCase();

  for (const f of content.files || []) {
    const fileName = String(f.name || '');
    const fileType = String(f.type || '');
    const source   = String(f.source || '');
    if (!source) continue;
    const lines = source.split(/\r?\n/);
    for (let ln = 0; ln < lines.length; ln++) {
      const line = String(lines[ln] || '');
      if (line.toLowerCase().indexOf(qLower) < 0) continue;
      matches.push({ kind: 'text', fileName, fileType, line: ln + 1, foundName: '', snippet: line.trim() });
      if (maxResults > 0 && matches.length >= maxResults) return { ok: true, message: 'hit maxResults', matches: sortMatches_(matches) };
    }
  }

  if (!matches.length) return { ok: false, message: 'not found', matches: [] };
  return { ok: true, message: 'ok', matches: sortMatches_(matches) };
}

function fetchProjectContentText() {
  const token    = ScriptApp.getOAuthToken();
  const allFiles = [];
  const projects = (typeof GAS_PROJECTS_ !== 'undefined') ? GAS_PROJECTS_ : {};
  const entries  = Object.keys(projects);
  if (entries.length === 0) {
    entries.push('(self)');
    projects['(self)'] = ScriptApp.getScriptId();
  }
  for (const projectName of entries) {
    const scriptId = projects[projectName];
    if (!scriptId) continue;
    const url = 'https://script.googleapis.com/v1/projects/' + encodeURIComponent(scriptId) + '/content';
    try {
      const res  = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
      const code = res.getResponseCode();
      if (code < 200 || code >= 300) continue;
      const json = JSON.parse(res.getContentText());
      if (!Array.isArray(json.files)) continue;
      json.files.forEach(f => allFiles.push(Object.assign({}, f, { _project: projectName })));
    } catch(e) {}
  }
  if (!allFiles.length) return { ok: false, message: 'no files fetched from any project', files: [] };
  return { ok: true, message: 'ok', files: allFiles };
}

function canAccessDevForCodeSearch_() {
  try {
    const eff = Session.getEffectiveUser().getEmail().toLowerCase();
    if (eff && eff.indexOf('@team-armada.jp') >= 0) return true;
  } catch(e) {}
  try {
    const act = Session.getActiveUser().getEmail().toLowerCase();
    if (act && act.indexOf('@team-armada.jp') >= 0) return true;
  } catch(e) {}
  return false;
}

function sortMatches_(list) {
  return list.slice().sort((a, b) => {
    const wa = a.kind === 'definition' ? 0 : 1;
    const wb = b.kind === 'definition' ? 0 : 1;
    if (wa !== wb) return wa - wb;
    if (a.fileName !== b.fileName) return a.fileName < b.fileName ? -1 : 1;
    return Number(a.line || 0) - Number(b.line || 0);
  });
}