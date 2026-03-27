/**
 * R004_BillingDomain.gs
 * 役割：Report GAS用のBillingCycle参照関数
 *
 * 本体GASの 004_BillingDomain.gs から、参照系のみを移植。
 * 依存: R000_Sheets.gs（b_getSheet_, b_readTable_, __B_CYCLE_CACHE__）
 *       R003_Util.gs（b_normYm_, b_groupConsecutive_）
 */

// ================================================================
// BillingCycle 取得（projectId指定 → ym別最新行）
// ================================================================

function b_getCycleByYmLatest_(projectId) {
  projectId = String(projectId || '').trim();
  if (!projectId) return {};

  var rows = b_readBillingCycleForProject_(projectId);
  var mapped = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    r.ym = b_normYm_(r.ym);
    if (r.ym) mapped.push(r);
  }

  var byYm = {};
  for (var j = 0; j < mapped.length; j++) {
    var row = mapped[j];
    var key = String(row.ym);
    var cur = byYm[key];
    if (!cur) { byYm[key] = row; continue; }
    if (String(row.updatedAt || '') > String(cur.updatedAt || '')) byYm[key] = row;
  }
  return byYm;
}

function b_getCycleOne_(projectId, ym) {
  var byYm = b_getCycleByYmLatest_(projectId);
  return byYm[String(b_normYm_(ym))] || null;
}

// ================================================================
// projectId指定でBillingCycle行を効率的に読む
// ================================================================

function b_readBillingCycleForProject_(projectId) {
  projectId = String(projectId || '').trim();
  if (!projectId) return [];

  var cacheKey = 'DB_BillingCycle::' + projectId;
  if (__B_CYCLE_CACHE__[cacheKey]) return __B_CYCLE_CACHE__[cacheKey];

  var sh = b_getSheet_('DB_BillingCycle');
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(x) { return String(x || '').trim(); });
  var iPid = header.indexOf('projectId');
  if (iPid < 0) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  var pidCol = sh.getRange(2, iPid + 1, lastRow - 1, 1);
  var hits = pidCol.createTextFinder(projectId).matchEntireCell(true).findAll();
  if (!hits || !hits.length) {
    __B_CYCLE_CACHE__[cacheKey] = [];
    return [];
  }

  var hitRows = hits.map(function(c) { return c.getRow(); });
  var blocks = b_groupConsecutive_(hitRows);

  var out = [];
  for (var bi = 0; bi < blocks.length; bi++) {
    var s = blocks[bi][0], e = blocks[bi][1];
    var vals = sh.getRange(s, 1, e - s + 1, lastCol).getValues();
    for (var vi = 0; vi < vals.length; vi++) {
      if (String(vals[vi][iPid] || '').trim() !== projectId) continue;
      var obj = {};
      for (var hi = 0; hi < header.length; hi++) {
        obj[header[hi]] = vals[vi][hi];
      }
      out.push(obj);
    }
  }

  __B_CYCLE_CACHE__[cacheKey] = out;
  return out;
}
