// D101_DevTicketApi.gs
// Dev Ticket の google.script.run 公開API

function api_getTickets(appId) {
  try {
    const sh = ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER);
    return toClientSafe_(getAllTicketsBySheet_(sh));
  } catch(e) {
    return { error: e.message };
  }
}

function api_addTicket(appId, params) {
  try {
    const sh       = ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER);
    const ticketId = addTicketToSheet_(sh, params);
    return toClientSafe_({ ok: true, ticketId });
  } catch(e) {
    return { error: e.message };
  }
}

function api_resolveTicket(appId, ticketId) {
  try {
    resolveTicketInSheet_(ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER), ticketId);
    return toClientSafe_({ ok: true });
  } catch(e) {
    return { error: e.message };
  }
}

function api_reopenTicket(appId, ticketId) {
  try {
    reopenTicketInSheet_(ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER), ticketId);
    return toClientSafe_({ ok: true });
  } catch(e) {
    return { error: e.message };
  }
}

function api_updateTicket(appId, ticketId, params) {
  try {
    updateTicketInSheet_(ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER), ticketId, params);
    return toClientSafe_({ ok: true });
  } catch(e) {
    return { error: e.message };
  }
}

function api_bulkAddTickets(appId, itemsJson) {
  try {
    const items = JSON.parse(itemsJson || '[]');
    if (!Array.isArray(items)) return { error: '配列でない' };
    const sh      = ensureSheetByApp_(appId, SHEET.DEV_TICKETS, TICKET_HEADER);
    const results = items.map(item => addTicketToSheet_(sh, item));
    return toClientSafe_({ ok: true, added: results.length, ticketIds: results });
  } catch(e) {
    return { error: e.message };
  }
}

// ── 内部ヘルパー ──
function getSheetByApp_(appId, sheetName) {
  const ss = getDevSsByApp_(appId);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('シートが見つからない: ' + sheetName);
  return sh;
}

function ensureSheetByApp_(appId, sheetName, headers) {
  const ss = getDevSsByApp_(appId);
  let sh   = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getAllTicketsBySheet_(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => ({
    ticketId:    row[0], type:        row[1],
    title:       row[2], description: row[3],
    targetFiles: row[4], priority:    row[5],
    status:      row[6], createdAt:   row[7],
    resolvedAt:  row[8],
  }));
}

function addTicketToSheet_(sh, params) {
  const data        = sh.getDataRange().getValues();
  const existingIds = data.slice(1).map(r => r[0]).filter(Boolean);
  const nextNum     = existingIds.length > 0
    ? Math.max(...existingIds.map(id => parseInt(String(id).replace('T','')) || 0)) + 1
    : 1;
  const ticketId = 'T' + String(nextNum).padStart(3, '0');
  sh.appendRow([
    ticketId, params.type || 'feature', params.title || '',
    params.description || '', params.targetFiles || '',
    params.priority || 'medium', 'open', nowJst_(), '',
  ]);
  return ticketId;
}

function resolveTicketInSheet_(sh, ticketId) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      sh.getRange(i+1, TICKET_COLS.STATUS).setValue('done');
      sh.getRange(i+1, TICKET_COLS.RESOLVED_AT).setValue(nowJst_());
      return true;
    }
  }
  return false;
}

function reopenTicketInSheet_(sh, ticketId) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      sh.getRange(i+1, TICKET_COLS.STATUS).setValue('open');
      sh.getRange(i+1, TICKET_COLS.RESOLVED_AT).setValue('');
      return true;
    }
  }
  return false;
}

function updateTicketInSheet_(sh, ticketId, params) {
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      if (params.type        !== undefined) sh.getRange(i+1, TICKET_COLS.TYPE).setValue(params.type);
      if (params.title       !== undefined) sh.getRange(i+1, TICKET_COLS.TITLE).setValue(params.title);
      if (params.description !== undefined) sh.getRange(i+1, TICKET_COLS.DESCRIPTION).setValue(params.description);
      if (params.targetFiles !== undefined) sh.getRange(i+1, TICKET_COLS.TARGET_FILES).setValue(params.targetFiles);
      if (params.priority    !== undefined) sh.getRange(i+1, TICKET_COLS.PRIORITY).setValue(params.priority);
      return true;
    }
  }
  return false;
}