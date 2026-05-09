/** 154_PwaCronCaller.gs — Phase 4 PWA cron をGAS time-trigger から叩くアダプタ
 *
 * Vercel Hobby plan は cron schedule が "daily 1 回まで" に制限されている。
 * Phase 4 ③ MS進捗の毎時 polling を Vercel cron では実現できないため、
 * 本体GAS の毎時 time-trigger から PWA の `/api/cron/hourly-estimate` を curl で叩く。
 *
 * 仕様正本: pwa/design/ms_progress.md (Phase 4 セクション)
 *
 * ─────────────────────────────────────────────
 * 動き方
 * ─────────────────────────────────────────────
 * 1. setup: 一度だけ `nav_pwa_setupHourlyPwaTrigger_` を実行
 *    → 毎時 0 分発火の time-trigger 1 個が作られる
 * 2. 毎時 0 分: `nav_pwa_pingHourlyEstimate` が呼ばれる
 *    → PWA の `/api/cron/hourly-estimate` を `Authorization: Bearer $CRON_SECRET` で GET
 *    → PWA 側で source_hash 差分検知 + LLM 抽出 + Supabase upsert
 *
 * ─────────────────────────────────────────────
 * ScriptProperties (`nav_pwa_setProps_` で 1 度だけ設定)
 * ─────────────────────────────────────────────
 * - PWA_BASE_URL  = "https://amd-os-pwa.vercel.app"
 * - CRON_SECRET   = Vercel Production env の CRON_SECRET と同じ値
 */

// ============================================================
// 公開関数
// ============================================================

/**
 * PWA `/api/cron/hourly-estimate` を 1 回叩く (毎時 0 分 trigger callback)。
 *
 * @param {Object} [opts] {force?: boolean, ym?: string, maxItems?: number}
 *   force: true で強制再推定 (差分検知無視)。本番 cron では未指定 (= source_hash 一致でスキップ)
 *   ym: 特定月 (YYYYMM) を指定。未指定なら PWA 側で当月 + 前月を回す
 *   maxItems: 1 cron 内の LLM call 上限 (PWA default 14)
 */
function nav_pwa_pingHourlyEstimate(opts) {
  opts = opts || {};
  const props = PropertiesService.getScriptProperties();
  const baseUrl = String(props.getProperty("PWA_BASE_URL") || "").trim();
  const cronSecret = String(props.getProperty("CRON_SECRET") || "").trim();
  if (!baseUrl) return { ok: false, message: "PWA_BASE_URL missing in ScriptProperties" };
  if (!cronSecret) return { ok: false, message: "CRON_SECRET missing in ScriptProperties" };

  const params = [];
  if (opts.force) params.push("force=1");
  if (opts.ym) params.push("ym=" + encodeURIComponent(String(opts.ym)));
  if (opts.maxItems) params.push("maxItems=" + encodeURIComponent(String(opts.maxItems)));
  const qs = params.length ? "?" + params.join("&") : "";
  const url = baseUrl.replace(/\/+$/, "") + "/api/cron/hourly-estimate" + qs;

  const startMs = Date.now();
  let res = null;
  try {
    res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { Authorization: "Bearer " + cronSecret },
      muteHttpExceptions: true,
      followRedirects: true
    });
  } catch (e) {
    return { ok: false, message: "fetch error: " + (e && e.message ? e.message : e), url: url };
  }
  const status = res.getResponseCode();
  const bodyText = String(res.getContentText() || "");
  let parsed = null;
  try { parsed = JSON.parse(bodyText); } catch (_e) { parsed = null; }
  const ms = Date.now() - startMs;

  Logger.log("[nav_pwa_pingHourlyEstimate] status=" + status + " ms=" + ms + " body=" + bodyText.slice(0, 800));
  return {
    ok: status >= 200 && status < 300,
    status: status,
    ms: ms,
    url: url,
    body: parsed || bodyText.slice(0, 1000)
  };
}

/**
 * 毎時 0 分の trigger を 1 個だけセット (1 度実行)。
 * 既存の同名 trigger があれば消してから作成。
 */
function nav_pwa_setupHourlyPwaTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction && t.getHandlerFunction() === "nav_pwa_pingHourlyEstimate") {
      try { ScriptApp.deleteTrigger(t); removed++; } catch (e) {}
    }
  }
  ScriptApp.newTrigger("nav_pwa_pingHourlyEstimate")
    .timeBased()
    .everyHours(1)
    .create();
  return { ok: true, removed: removed, message: "hourly PWA ping trigger set (every 1 hour)" };
}

/**
 * ScriptProperties を setup する (curl から runFunc 経由で 1 度だけ呼ぶ)。
 * @param {Object} props {PWA_BASE_URL?: string, CRON_SECRET?: string}
 */
function nav_pwa_setProps_(props) {
  if (!props || typeof props !== "object") return { ok: false, message: "props object required" };
  const sp = PropertiesService.getScriptProperties();
  const set = {};
  if (props.PWA_BASE_URL) { sp.setProperty("PWA_BASE_URL", String(props.PWA_BASE_URL).trim()); set.PWA_BASE_URL = "set"; }
  if (props.CRON_SECRET) { sp.setProperty("CRON_SECRET", String(props.CRON_SECRET).trim()); set.CRON_SECRET = "set"; }
  return { ok: true, set: set };
}
