// D100_DevTicketRepo.gs
// DB_DevTickets の CRUD 操作

const TICKET_COLS = {
  TICKET_ID:    1,
  TYPE:         2,  // bug | feature
  TITLE:        3,
  DESCRIPTION:  4,
  TARGET_FILES: 5,
  PRIORITY:     6,  // high | medium | low
  STATUS:       7,  // open | done
  CREATED_AT:   8,
  RESOLVED_AT:  9,
};
const TICKET_HEADER = [
  'ticketId','type','title','description','targetFiles','priority','status','createdAt','resolvedAt'
];

function ensureDevTicketsSheet_() {
  const ss = getDevSpreadsheet_();
  let sh = ss.getSheetByName(SHEET.DEV_TICKETS);
  if (!sh) {
    sh = ss.insertSheet(SHEET.DEV_TICKETS);
    sh.appendRow(TICKET_HEADER);
    sh.getRange(1, 1, 1, TICKET_HEADER.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getAllTickets_() {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => ({
    ticketId:    row[0],
    type:        row[1],
    title:       row[2],
    description: row[3],
    targetFiles: row[4],
    priority:    row[5],
    status:      row[6],
    createdAt:   row[7],
    resolvedAt:  row[8],
  }));
}

function addTicket_(params) {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  const existingIds = data.slice(1).map(r => r[0]).filter(Boolean);
  const nextNum = existingIds.length > 0
    ? Math.max(...existingIds.map(id => parseInt(id.replace('T', '')) || 0)) + 1
    : 1;
  const ticketId = 'T' + String(nextNum).padStart(3, '0');
  const now = nowJst_();
  sh.appendRow([
    ticketId,
    params.type || 'feature',
    params.title || '',
    params.description || '',
    params.targetFiles || '',
    params.priority || 'medium',
    'open',
    now,
    '',
  ]);
  return ticketId;
}

function resolveTicket_(ticketId) {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      sh.getRange(i + 1, TICKET_COLS.STATUS).setValue('done');
      sh.getRange(i + 1, TICKET_COLS.RESOLVED_AT).setValue(nowJst_());
      return true;
    }
  }
  return false;
}

function reopenTicket_(ticketId) {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      sh.getRange(i + 1, TICKET_COLS.STATUS).setValue('open');
      sh.getRange(i + 1, TICKET_COLS.RESOLVED_AT).setValue('');
      return true;
    }
  }
  return false;
}

function deleteTicket_(ticketId) {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      sh.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function updateTicket_(ticketId, params) {
  const sh = ensureDevTicketsSheet_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === ticketId) {
      if (params.type        !== undefined) sh.getRange(i + 1, TICKET_COLS.TYPE).setValue(params.type);
      if (params.title       !== undefined) sh.getRange(i + 1, TICKET_COLS.TITLE).setValue(params.title);
      if (params.description !== undefined) sh.getRange(i + 1, TICKET_COLS.DESCRIPTION).setValue(params.description);
      if (params.targetFiles !== undefined) sh.getRange(i + 1, TICKET_COLS.TARGET_FILES).setValue(params.targetFiles);
      if (params.priority    !== undefined) sh.getRange(i + 1, TICKET_COLS.PRIORITY).setValue(params.priority);
      return true;
    }
  }
  return false;
}