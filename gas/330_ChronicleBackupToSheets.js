/** 330_ChronicleBackupToSheets.gs
 *
 * Chronicle Supabase (alflpkgezztswgynnlmy = KAGAMI / Fudoki / Roadmaster 共有DB) の
 * public 全テーブルを Google スプレッドシートへ「日次フル・ミラー」バックアップする。
 *
 * 方針:
 *   - 各テーブル → 同名タブへ毎回 clearContents → 全書き換え（最新スナップショットのミラー）
 *   - 過去日の復元は スプレッドシートの版履歴（ファイル > 変更履歴）で行う（上書き式でも戻せる）
 *   - 全セルをテキスト書式('@')で書くので "=..." 等が数式解釈されず、型崩れもしない（バックアップ忠実性優先）
 *   - 最後に `_backup_meta` タブへ実行時刻・テーブルごとの件数/状態を記録
 *
 * GAS が まさの Google アカウントで動く＝対象スプシを openById で直接編集できる。
 * よってサービスアカウント / 共有設定 / Supabase 側 Secrets は不要。
 *
 * ScriptProperties（gas/CLAUDE.md「ScriptProperties 正本リスト」参照）:
 *   - CHRONICLE_SUPABASE_URL          例: https://alflpkgezztswgynnlmy.supabase.co
 *   - CHRONICLE_SUPABASE_SERVICE_KEY  Chronicle の service_role secret（RLSバイパス読み取り用）
 *   - CHRONICLE_BACKUP_SHEET_ID       書き込み先スプレッドシートID
 *
 * テーブル列挙は Chronicle 側の RPC public.list_public_tables()（text[] を返す）を使う。
 *   migration: kagami/supabase/migrations/20260607_backup_list_tables_fn.sql（適用済み）
 *
 * 使い方:
 *   - 日次トリガー設置: setupChronicleBackupTrigger() を1回実行（毎日 03:00 JST）
 *   - 手動実行:        chronicleBackupToSheets()
 */

var CHRONICLE_MAX_ROWS_PER_TABLE_ = 200000; // 1テーブル上限（暴走/セル上限の保険。現状最大 locations ~36k）
var CHRONICLE_PAGE_SIZE_ = 1000;            // PostgREST 1リクエストあたり取得行数

function _chronicle_props_() {
  var p = PropertiesService.getScriptProperties();
  var url = String(p.getProperty('CHRONICLE_SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  var key = String(p.getProperty('CHRONICLE_SUPABASE_SERVICE_KEY') || '').trim();
  var sheetId = String(p.getProperty('CHRONICLE_BACKUP_SHEET_ID') || '').trim();
  if (!url) throw new Error('CHRONICLE_SUPABASE_URL missing in ScriptProperties');
  if (!key) throw new Error('CHRONICLE_SUPABASE_SERVICE_KEY missing in ScriptProperties');
  if (!sheetId) throw new Error('CHRONICLE_BACKUP_SHEET_ID missing in ScriptProperties');
  return { url: url, key: key, sheetId: sheetId };
}

function _chronicle_headers_(cfg) {
  return { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
}

// public の BASE TABLE 名一覧（"_" 始まりのメタタブ名と衝突しないよう除外）
function _chronicle_listTables_(cfg) {
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/rpc/list_public_tables', {
    method: 'post',
    contentType: 'application/json',
    headers: _chronicle_headers_(cfg),
    payload: '{}',
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('list_public_tables ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  var arr = JSON.parse(res.getContentText() || '[]'); // SQL関数の text[] はそのまま配列で返る
  return (arr || []).filter(function (t) { return t && String(t).charAt(0) !== '_'; });
}

// 1テーブルの全行を limit/offset でページング取得
function _chronicle_fetchRows_(cfg, table) {
  var rows = [];
  for (var from = 0; from < CHRONICLE_MAX_ROWS_PER_TABLE_; from += CHRONICLE_PAGE_SIZE_) {
    var endpoint = cfg.url + '/rest/v1/' + encodeURIComponent(table) +
      '?select=*&limit=' + CHRONICLE_PAGE_SIZE_ + '&offset=' + from;
    var res = UrlFetchApp.fetch(endpoint, {
      method: 'get',
      headers: _chronicle_headers_(cfg),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 300) throw new Error(table + ' fetch ' + code + ': ' + res.getContentText().slice(0, 200));
    var batch = JSON.parse(res.getContentText() || '[]');
    rows = rows.concat(batch);
    if (batch.length < CHRONICLE_PAGE_SIZE_) break;
  }
  return rows;
}

// 行配列 → 2次元配列（1行目=ヘッダ）。列順は最初の行のキー順＋後続行で出た新キーを末尾追加
function _chronicle_rowsToValues_(rows) {
  if (!rows || rows.length === 0) return [];
  var cols = [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    for (var k in rows[i]) {
      if (Object.prototype.hasOwnProperty.call(rows[i], k) && !seen[k]) {
        seen[k] = true;
        cols.push(k);
      }
    }
  }
  var out = [cols.slice()];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var line = [];
    for (var c = 0; c < cols.length; c++) line.push(_chronicle_cell_(row[cols[c]]));
    out.push(line);
  }
  return out;
}

function _chronicle_cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v); // json / array 列
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v); // 数値含め全てテキストとして保存（忠実性優先・数式解釈/型崩れ防止）
}

function _chronicle_writeTab_(ss, title, values) {
  var sh = ss.getSheetByName(title);
  if (!sh) sh = ss.insertSheet(title);
  sh.clearContents();
  if (!values || values.length === 0) return;
  var width = 0;
  for (var i = 0; i < values.length; i++) width = Math.max(width, values[i].length);
  if (width === 0) return;
  for (var j = 0; j < values.length; j++) {
    while (values[j].length < width) values[j].push('');
  }
  // 既存より小さい表でも余りが残らないよう、必要行列を確保してから書く
  var range = sh.getRange(1, 1, values.length, width);
  range.setNumberFormat('@'); // 全セル プレーンテキスト
  range.setValues(values);
}

/**
 * 本体: Chronicle 全テーブルをスプシへフル・ミラー。
 * @return {{ok:boolean, tables:number, total_rows:number, errors:Array}}
 */
function chronicleBackupToSheets() {
  var cfg = _chronicle_props_();
  var ss = SpreadsheetApp.openById(cfg.sheetId);
  var tables = _chronicle_listTables_(cfg);
  var startedAt = new Date();
  var meta = [];

  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    try {
      var rows = _chronicle_fetchRows_(cfg, t);
      _chronicle_writeTab_(ss, t, _chronicle_rowsToValues_(rows));
      meta.push([t, rows.length, rows.length >= CHRONICLE_MAX_ROWS_PER_TABLE_ ? 'truncated' : 'ok']);
    } catch (e) {
      meta.push([t, -1, 'error: ' + String(e).slice(0, 200)]);
    }
  }

  var metaValues = [
    ['backup_at (JST)', Utilities.formatDate(startedAt, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')],
    ['table', 'rows', 'status']
  ].concat(meta);
  _chronicle_writeTab_(ss, '_backup_meta', metaValues);

  var errors = meta.filter(function (m) { return m[1] === -1; });
  var total = meta.reduce(function (s, m) { return s + (m[1] > 0 ? m[1] : 0); }, 0);
  return { ok: errors.length === 0, tables: tables.length, total_rows: total, errors: errors };
}

/** 日次トリガー（毎日 03:00 JST）を設置。既存の同名トリガーは張り替える。 */
function setupChronicleBackupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'chronicleBackupToSheets') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('chronicleBackupToSheets').timeBased().everyDays(1).atHour(3).create();
  return { ok: true, scheduled: 'daily 03:00 JST', handler: 'chronicleBackupToSheets' };
}
