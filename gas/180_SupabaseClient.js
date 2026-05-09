/** 180_SupabaseClient.gs
 *
 * Supabase REST へ service_role 権限で読み書きする共通 helper。
 *
 * 仕様正本: pwa/design/meeting_summaries.md
 *
 * 前提: ScriptProperties に以下が設定済み。
 *   - SUPABASE_URL          例: https://nbnhrhybjslbawdukvvk.supabase.co
 *   - SUPABASE_SERVICE_KEY  Supabase dashboard の Settings → API → service_role secret
 *
 * (※ キー名は SUPABASE_SERVICE_KEY。SUPABASE_SERVICE_ROLE_KEY ではない。
 *     ScriptProperties 正本リストは gas/CLAUDE.md「ScriptProperties 正本」参照)
 */

function _supa_props_() {
  const props = PropertiesService.getScriptProperties();
  const url = String(props.getProperty("SUPABASE_URL") || "").trim();
  const key = String(props.getProperty("SUPABASE_SERVICE_KEY") || "").trim();
  if (!url) throw new Error("SUPABASE_URL missing in ScriptProperties");
  if (!key) throw new Error("SUPABASE_SERVICE_KEY missing in ScriptProperties");
  return { url: url.replace(/\/+$/, ""), key };
}

/**
 * Supabase に upsert (PostgREST)
 * @param {string} table       テーブル名
 * @param {Object|Array} rows  単一行 or 配列
 * @param {string} onConflict  競合解決キー (例: 'meeting_id')
 * @return {Object} {ok, status, body}
 */
function supa_upsert(table, rows, onConflict) {
  const { url, key } = _supa_props_();
  const payload = Array.isArray(rows) ? rows : [rows];
  const endpoint = url + "/rest/v1/" + encodeURIComponent(table) +
                   (onConflict ? ("?on_conflict=" + encodeURIComponent(onConflict)) : "");
  const res = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: {
      "apikey": key,
      "Authorization": "Bearer " + key,
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status >= 200 && status < 300) {
    return { ok: true, status: status, body: text };
  }
  return { ok: false, status: status, body: text };
}

/**
 * Supabase select (簡易)
 * @param {string} table
 * @param {Object} opts {select?, filter?, order?, limit?}
 *   filter は PostgREST 構文の "col=eq.value" などをそのまま渡す ("&" で複数連結可)
 * @return {Object} {ok, status, rows: any[], body?}
 */
function supa_select(table, opts) {
  const { url, key } = _supa_props_();
  opts = opts || {};
  const params = [];
  if (opts.select) params.push("select=" + encodeURIComponent(opts.select));
  if (opts.filter) params.push(opts.filter);
  if (opts.order) params.push("order=" + encodeURIComponent(opts.order));
  if (opts.limit) params.push("limit=" + Number(opts.limit));
  const qs = params.length ? "?" + params.join("&") : "";
  const endpoint = url + "/rest/v1/" + encodeURIComponent(table) + qs;
  const res = UrlFetchApp.fetch(endpoint, {
    method: "get",
    headers: {
      "apikey": key,
      "Authorization": "Bearer " + key
    },
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status >= 200 && status < 300) {
    let rows = [];
    try { rows = JSON.parse(text); } catch (e) { rows = []; }
    return { ok: true, status: status, rows: rows };
  }
  return { ok: false, status: status, body: text };
}

// ===== One-time setup =====

/**
 * ScriptProperties に任意のキー=値をセット (汎用)。
 * 使い方: pwaApi 経由で runFunc → fn=oneTime_setScriptProperty, args=[name, value]
 * 値は伏せて返す。
 */
function oneTime_setScriptProperty(name, value) {
  if (!name) throw new Error("name required");
  PropertiesService.getScriptProperties().setProperty(String(name), String(value == null ? "" : value));
  return {
    ok: true,
    name: String(name),
    length: String(value == null ? "" : value).length
  };
}

/**
 * 接続テスト: project_meeting_summaries に空クエリを投げる。
 */
function test_supabaseConnection() {
  return supa_select("project_meeting_summaries", { select: "meeting_id", limit: 1 });
}
