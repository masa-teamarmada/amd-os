// A270_SettingsApi.gs
// AMD-Admin設定値のCRUD

function admin_getSettings() {
  if (!isAdmin_()) throw new Error('admin only');
  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('DB_Settings');
  if (!sheet || sheet.getLastRow() < 2) return { ok: true, rows: [] };

  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h || '').trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    headers.forEach(function(h, j) { row[h] = data[i][j]; });
    if (String(row.settingKey || '').trim()) rows.push(row);
  }
  return { ok: true, rows: rows };
}

function admin_saveSetting(payload) {
  if (!isAdmin_()) throw new Error('admin only');
  payload = payload || {};
  var key = String(payload.settingKey || '').trim();
  var value = String(payload.settingValue || '').trim();
  var valueType = String(payload.valueType || 'string').trim();
  var label = String(payload.label || '').trim();
  var description = String(payload.description || '').trim();
  if (!key) throw new Error('settingKey required');

  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('DB_Settings');
  var nowJst = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
  var email = Session.getActiveUser().getEmail();

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var iKey = headers.indexOf('settingKey');
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][iKey] || '').trim() === key) {
        var row = data[i].slice();
        row[headers.indexOf('settingValue')] = value;
        row[headers.indexOf('valueType')] = valueType;
        row[headers.indexOf('label')] = label;
        row[headers.indexOf('description')] = description;
        row[headers.indexOf('updatedAtJst')] = nowJst;
        row[headers.indexOf('updatedBy')] = email;
        sheet.getRange(i + 2, 1, 1, lastCol).setValues([row]);
        return { ok: true, action: 'updated', key: key };
      }
    }
  }
  sheet.appendRow([key, value, valueType, label, description, nowJst, email]);
  return { ok: true, action: 'created', key: key };
}

function admin_deleteSetting(payload) {
  if (!isAdmin_()) throw new Error('admin only');
  var key = String((payload || {}).settingKey || '').trim();
  if (!key) throw new Error('settingKey required');

  var ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('ADMIN_SPREADSHEET_ID')
  );
  var sheet = ss.getSheetByName('DB_Settings');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: true };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var iKey = headers.indexOf('settingKey');
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (String(data[i][iKey] || '').trim() === key) {
      sheet.deleteRow(i + 2);
    }
  }
  return { ok: true };
}