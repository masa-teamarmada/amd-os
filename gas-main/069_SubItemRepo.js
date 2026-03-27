/**
 * 069_SubItemRepo.gs
 * サブ項目（Sub-Item）のデータアクセス層。
 * DB_MilestoneSubItems + DB_SubItemResponsibility のヘッダ保証・CRUD。
 *
 * 依存:
 *   - B_Sheets.gs（b_ensureHeader_, b_readTable_, b_upsertRow_）
 *   - B_Util.gs（b_normYm_）
 *   - 10_Utils.gs（jstNow_ 等）
 */

/* ====== ヘッダ定義（正本） ====== */

var SUBITEM_HEADERS_ = [
  'milestoneId', 'subItemId', 'orderNo', 'title',
  'startYm', 'targetYm', 'isDone', 'doneAt', 'updatedAt', 'createdAt'
];

var SUBITEM_RESP_HEADERS_ = [
  'subItemId', 'memberId', 'share', 'updatedAt'
];

/* ====== Navigatorスプシ読み取りヘルパー ====== */

function subItem_getNavSs_() {
  return SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
}

function subItem_readNavTable_(sheetName) {
  var ss = subItem_getNavSs_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = data[r][c];
    }
    rows.push(obj);
  }
  return rows;
}

/* ====== ヘッダ保証 ====== */
function subItem_ensureHeaders() {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh1 = ss.getSheetByName('DB_MilestoneSubItems');
  if (!sh1) sh1 = ss.insertSheet('DB_MilestoneSubItems');
  ensureHeader_(sh1, SUBITEM_HEADERS_);

  var sh2 = ss.getSheetByName('DB_SubItemResponsibility');
  if (!sh2) sh2 = ss.insertSheet('DB_SubItemResponsibility');
  ensureHeader_(sh2, SUBITEM_RESP_HEADERS_);

  return { ok: true };
}

/* ====== ID生成 ====== */
function subItem_generateId_() {
  return 'sub_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

/* ====== JST日時文字列 ====== */

function subItem_jstNow_() {
  var d = new Date();
  d.setTime(d.getTime() + 9 * 60 * 60 * 1000);
  var yyyy = d.getUTCFullYear();
  var mm   = ('0' + (d.getUTCMonth() + 1)).slice(-2);
  var dd   = ('0' + d.getUTCDate()).slice(-2);
  var hh   = ('0' + d.getUTCHours()).slice(-2);
  var mi   = ('0' + d.getUTCMinutes()).slice(-2);
  return yyyy + '年' + parseInt(mm) + '月' + parseInt(dd) + '日 ' + hh + ':' + mi;
}

/* ====== DB_MilestoneSubItems CRUD ====== */

/**
 * 指定milestoneIdのサブ項目を全取得（orderNo順）
 */
function subItem_listByMilestone(milestoneId) {
  var rows = subItem_readNavTable_('DB_MilestoneSubItems');
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].milestoneId) === String(milestoneId)) {
      result.push(rows[i]);
    }
  }
  result.sort(function(a, b) { return (Number(a.orderNo) || 0) - (Number(b.orderNo) || 0); });
  return result;
}

/**
 * 指定PJの全サブ項目を取得（milestoneId群を渡す）
 */
function subItem_listByMilestoneIds(milestoneIds) {
  var idSet = {};
  for (var i = 0; i < milestoneIds.length; i++) idSet[milestoneIds[i]] = true;
  var rows = subItem_readNavTable_('DB_MilestoneSubItems');
  var result = [];
  for (var j = 0; j < rows.length; j++) {
    if (idSet[rows[j].milestoneId]) result.push(rows[j]);
  }
  result.sort(function(a, b) {
    if (a.milestoneId !== b.milestoneId) return a.milestoneId < b.milestoneId ? -1 : 1;
    return (Number(a.orderNo) || 0) - (Number(b.orderNo) || 0);
  });
  return result;
}

/**
 * サブ項目を1件 upsert
 * @param {Object} item - { milestoneId, subItemId?, orderNo, title, startYm?, targetYm?, isDone? }
 * @return {Object} 保存後のitem
 */
function subItem_upsert(item) {
  var isNew = !item.subItemId;
  if (isNew) item.subItemId = subItem_generateId_();
  item.updatedAt = subItem_jstNow_();
  if (isNew && !item.createdAt) item.createdAt = item.updatedAt;
  if (item.startYm) item.startYm = String(item.startYm).replace(/-/g, '');
  if (item.targetYm) item.targetYm = String(item.targetYm).replace(/-/g, '');
  if (item.isDone === true || item.isDone === 'TRUE') {
    item.isDone = true;
    if (!item.doneAt) item.doneAt = subItem_jstNow_();
  } else {
    item.isDone = false;
    item.doneAt = '';
  }
  b_upsertRow_('DB_MilestoneSubItems', 'subItemId', item.subItemId, item);
  return item;
}

/**
 * サブ項目を一括保存（milestoneId単位で全件置換）
 * @param {string} milestoneId
 * @param {Array} items - [{ orderNo, title, startYm, targetYm, isDone, subItemId? }]
 */
function subItem_bulkSave(milestoneId, items) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh = ss.getSheetByName('DB_MilestoneSubItems');
  if (!sh) {
    b_ensureHeader_(ss, 'DB_MilestoneSubItems', SUBITEM_HEADERS_);
    sh = ss.getSheetByName('DB_MilestoneSubItems');
  }

  // 既存行を読み込み
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var msCol = headers.indexOf('milestoneId');
  var sidCol = headers.indexOf('subItemId');

  // milestoneIdが一致する行を削除（下から）
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][msCol]) === String(milestoneId)) {
      sh.deleteRow(r + 1);
    }
  }

  // 新しい行を追記
  var now = subItem_jstNow_();
  var saved = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var sid = it.subItemId || subItem_generateId_();
    var startYm = it.startYm ? String(it.startYm).replace(/-/g, '') : '';
    var targetYm = it.targetYm ? String(it.targetYm).replace(/-/g, '') : '';
    var isDone = (it.isDone === true || it.isDone === 'TRUE');
    var doneAt = isDone ? (it.doneAt || now) : '';

    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var col = headers[c];
      if (col === 'milestoneId') row.push(milestoneId);
      else if (col === 'subItemId') row.push(sid);
      else if (col === 'orderNo') row.push(i + 1);
      else if (col === 'title') row.push(String(it.title || ''));
      else if (col === 'startYm') row.push(startYm);
      else if (col === 'targetYm') row.push(targetYm);
      else if (col === 'isDone') row.push(isDone);
      else if (col === 'doneAt') row.push(doneAt);
      else if (col === 'updatedAt') row.push(now);
      else if (col === 'createdAt') row.push(it.createdAt || now);
      else row.push('');
    }
    sh.appendRow(row);
    saved.push({
      milestoneId: milestoneId, subItemId: sid, orderNo: i + 1,
      title: it.title, startYm: startYm, targetYm: targetYm,
      isDone: isDone, doneAt: doneAt, updatedAt: now, createdAt: it.createdAt || now
    });
  }
  return saved;
}

function subItem_clearSuccessCriteria_(milestoneId) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh = ss.getSheetByName('DB_ValueMilestones');
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var msIdCol = headers.indexOf('milestoneId');
  var critCol = headers.indexOf('successCriteria');
  if (msIdCol === -1 || critCol === -1) return;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][msIdCol]) === String(milestoneId)) {
      sh.getRange(r + 1, critCol + 1).setValue('');
    }
  }
}

/**
 * サブ項目を1件削除
 */
function subItem_delete(subItemId) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh = ss.getSheetByName('DB_MilestoneSubItems');
  if (!sh) return { ok: false, message: 'シートなし' };

  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf('subItemId');
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][col]) === String(subItemId)) {
      sh.deleteRow(r + 1);
      // Responsibilityも削除
      subItemResp_deleteBySubItem_(subItemId);
      return { ok: true };
    }
  }
  return { ok: false, message: '該当なし' };
}

/* ====== DB_SubItemResponsibility CRUD ====== */

/**
 * 指定subItemIdの担当配分を取得
 */
function subItemResp_listBySubItem(subItemId) {
  var rows = subItem_readNavTable_('DB_SubItemResponsibility');
  var result = [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].subItemId) === String(subItemId)) result.push(rows[i]);
  }
  return result;
}

/**
 * 複数subItemIdの担当配分を一括取得
 */
function subItemResp_listBySubItemIds(subItemIds) {
  var idSet = {};
  for (var i = 0; i < subItemIds.length; i++) idSet[subItemIds[i]] = true;
  var rows = subItem_readNavTable_('DB_SubItemResponsibility');
  var result = [];
  for (var j = 0; j < rows.length; j++) {
    if (idSet[rows[j].subItemId]) result.push(rows[j]);
  }
  return result;
}

/**
 * 担当配分を一括保存（subItemId単位で全件置換）
 * @param {string} subItemId
 * @param {Array} entries - [{ memberId, share }]
 */
function subItemResp_bulkSave(subItemId, entries) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh = ss.getSheetByName('DB_SubItemResponsibility');
  if (!sh) {
    b_ensureHeader_(ss, 'DB_SubItemResponsibility', SUBITEM_RESP_HEADERS_);
    sh = ss.getSheetByName('DB_SubItemResponsibility');
  }

  // 既存行削除
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf('subItemId');
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][col]) === String(subItemId)) {
      sh.deleteRow(r + 1);
    }
  }

  // 新規追記
  var now = subItem_jstNow_();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var share = Number(e.share) || 0;
    if (share <= 0) continue; // 0は保存しない
    var row = [];
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      if (h === 'subItemId') row.push(subItemId);
      else if (h === 'memberId') row.push(String(e.memberId));
      else if (h === 'share') row.push(share);
      else if (h === 'updatedAt') row.push(now);
      else row.push('');
    }
    sh.appendRow(row);
  }
  return { ok: true };
}

/**
 * subItemId指定で担当配分を全削除（サブ項目削除時用）
 */
function subItemResp_deleteBySubItem_(subItemId) {
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('NAVIGATOR_SPREADSHEET_ID')
  );
  var sh = ss.getSheetByName('DB_SubItemResponsibility');
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  var col = data[0].indexOf('subItemId');
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][col]) === String(subItemId)) {
      sh.deleteRow(r + 1);
    }
  }
}

/* ====== 移行：successCriteria → DB_MilestoneSubItems ====== */

/**
 * 既存successCriteriaテキストからサブ項目レコードを生成して保存する。
 * startYm/targetYm は空欄（後から人間が設定）。
 *
 * @param {string} milestoneId
 * @param {string} criteriaText - "[x] done\n[ ] todo" 形式
 * @return {Array} 保存されたサブ項目
 */
function subItem_migrateFromCriteria(milestoneId, criteriaText) {
  if (!criteriaText) return [];
  var lines = String(criteriaText).split(/\n/);
  var items = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var doneMatch = line.match(/^\[x\]\s*(.+)/i);
    var openMatch = line.match(/^\[\s*\]\s*(.+)/);
    var suggestDoneMatch = line.match(/^\[\?x\]\s*(.+)/i);
    var suggestMatch = line.match(/^\[\?\]\s*(.+)/);
    var title, isDone;
    if (doneMatch) {
      title = doneMatch[1].trim();
      isDone = true;
    } else if (suggestDoneMatch) {
      // つくよみ提案の完了候補 → 完了扱い
      title = suggestDoneMatch[1].trim();
      isDone = true;
    } else if (openMatch) {
      title = openMatch[1].trim();
      isDone = false;
    } else if (suggestMatch) {
      // つくよみ提案の追加候補 → 未完了
      title = suggestMatch[1].trim();
      isDone = false;
    } else {
      title = line;
      isDone = false;
    }
    items.push({ title: title, isDone: isDone });
  }
  return subItem_bulkSave(milestoneId, items);
}

/**
 * 全PJの全MSについてsuccessCriteriaからサブ項目を移行する（ワンショット）。
 * 既にサブ項目が存在するMSはスキップ。
 */
function admin_migrateAllCriteriaToSubItems() {
  subItem_ensureHeaders();
  var milestones = subItem_readNavTable_('DB_ValueMilestones');
  var existingSubs = subItem_readNavTable_('DB_MilestoneSubItems');

  // 既にサブ項目があるmilestoneIdを集合化
  var hasSubItems = {};
  for (var i = 0; i < existingSubs.length; i++) {
    hasSubItems[existingSubs[i].milestoneId] = true;
  }

  var migrated = 0;
  var skipped = 0;
  for (var j = 0; j < milestones.length; j++) {
    var ms = milestones[j];
    var msId = String(ms.milestoneId || ms.milestoneKey || '');
    if (!msId) continue;
    if (hasSubItems[msId]) { skipped++; continue; }
    var criteria = String(ms.successCriteria || '').trim();
    if (!criteria) { skipped++; continue; }
    var saved = subItem_migrateFromCriteria(msId, criteria);
    if (saved.length > 0) migrated++;
  }
  Logger.log('移行完了: ' + migrated + '件移行, ' + skipped + '件スキップ');
  return { ok: true, migrated: migrated, skipped: skipped };
}

/* ====== 遅延サブ項目の検出（ナッジ用） ====== */

/**
 * 全PJ横断で「遅延中のサブ項目」を返す。
 * 条件: targetYm <= 指定ym かつ isDone = FALSE かつ targetYm が設定済み
 *
 * @param {string} ym - yyyymm（省略時は今月）
 * @return {Array} [{ subItemId, milestoneId, title, targetYm, startYm, responsibilities }]
 */
function subItem_findOverdue(ym) {
  if (!ym) {
    var now = new Date();
    now.setTime(now.getTime() + 9 * 60 * 60 * 1000);
    ym = String(now.getUTCFullYear()) + ('0' + (now.getUTCMonth() + 1)).slice(-2);
  }
  ym = String(ym).replace(/-/g, '');

  var allSubs = subItem_readNavTable_('DB_MilestoneSubItems');
  var overdue = [];
  for (var i = 0; i < allSubs.length; i++) {
    var s = allSubs[i];
    var tYm = String(s.targetYm || '').replace(/-/g, '');
    if (!tYm) continue;
    if (s.isDone === true || s.isDone === 'TRUE' || s.isDone === true) continue;
    if (tYm <= ym) {
      overdue.push(s);
    }
  }

  // Responsibility情報を付与
  if (overdue.length > 0) {
    var subIds = [];
    for (var j = 0; j < overdue.length; j++) subIds.push(overdue[j].subItemId);
    var resps = subItemResp_listBySubItemIds(subIds);
    var respMap = {};
    for (var k = 0; k < resps.length; k++) {
      var r = resps[k];
      if (!respMap[r.subItemId]) respMap[r.subItemId] = [];
      respMap[r.subItemId].push({ memberId: r.memberId, share: Number(r.share) || 0 });
    }
    for (var m = 0; m < overdue.length; m++) {
      overdue[m].responsibilities = respMap[overdue[m].subItemId] || [];
    }
  }

  return overdue;
}

/* ====== テスト用ラッパー ====== */

function test_subItem_ensureHeaders() {
  var res = subItem_ensureHeaders();
  Logger.log(JSON.stringify(res));
}

function test_subItem_findOverdue() {
  var res = subItem_findOverdue();
  Logger.log(JSON.stringify(res, null, 2));
}

function test_admin_migrateAllCriteriaToSubItems() {
  var res = admin_migrateAllCriteriaToSubItems();
  Logger.log(JSON.stringify(res));
}