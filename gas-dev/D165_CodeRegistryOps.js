// D165_CodeRegistryOps.gs
// ファイル台帳（DB_CodeRegistry）の自動生成。
// Apps Script APIから全ソースを取得し、ファイル名・冒頭コメント・公開関数一覧をDBに書き出す。

const CR_SHEET_NAME_ = 'DB_CodeRegistry';
const CR_HEADERS_    = ['fileName','fileNumber','fileType','headerComment','publicFunctions','allFunctions','lineCount','updatedAt'];

function admin_rebuildCodeRegistry() {
  const content = fetchProjectContentText();
  if (!content.ok) throw new Error('fetchProjectContentText failed: ' + content.message);

  const now  = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
  const rows = (content.files || []).map(f => {
    const name   = String(f.name   || '');
    const type   = String(f.type   || '');
    const source = String(f.source || '');
    const numMatch   = name.match(/^(\d{3})/);
    const fileNumber = numMatch ? numMatch[1] : '';
    const headerComment = extractHeaderComment_(source);
    const funcs      = extractFunctions_(source);
    const publicFuncs = funcs.filter(fn => fn.charAt(fn.length - 1) !== '_');
    return [name, fileNumber, type, headerComment, publicFuncs.join(', '), funcs.join(', '), source ? source.split(/\r?\n/).length : 0, now];
  });

  rows.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });

  const ss    = getDevSpreadsheet_();
  let sheet   = ss.getSheetByName(CR_SHEET_NAME_);
  if (!sheet) sheet = ss.insertSheet(CR_SHEET_NAME_);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, CR_HEADERS_.length).setValues([CR_HEADERS_]);
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, CR_HEADERS_.length).setValues(rows);
  sheet.setFrozenRows(1);

  return { ok: true, fileCount: rows.length };
}

function admin_getCodeRegistry() {
  const sheet = getDevSpreadsheet_().getSheetByName(CR_SHEET_NAME_);
  if (!sheet) return { ok: false, rows: [], message: 'シートなし。admin_rebuildCodeRegistry() を先に実行して' };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, rows: [] };
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, c) => {
      let val = row[c];
      if (val instanceof Date) val = Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy年M月d日 HH:mm');
      obj[h] = String(val || '');
    });
    return obj;
  });
  return JSON.parse(JSON.stringify({ ok: true, rows }));
}

function extractHeaderComment_(source) {
  if (!source) return '';
  const m = source.match(/^[\s\S]*?\/\*\*([\s\S]*?)\*\//);
  if (!m) return '';
  const result = m[1].split(/\r?\n/)
    .map(l => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .join(' / ');
  return result.length > 500 ? result.substring(0, 497) + '...' : result;
}

function extractFunctions_(source) {
  if (!source) return [];
  const re = /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  const names = [];
  let m;
  while ((m = re.exec(source)) !== null) names.push(m[1]);
  return names;
}