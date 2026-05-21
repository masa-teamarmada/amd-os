/**
 * 099_PwaApi.gs
 * PWA/Next API からGAS側の既存収集器を呼ぶための薄いJSON bridge。
 */

function pwaApi_json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function pwaApi_ok_(data) {
  return pwaApi_json_({ ok: true, data: data || {} });
}

function pwaApi_err_(message) {
  return pwaApi_json_({ ok: false, error: String(message || "unknown error") });
}

function pwaApi_checkKey_(key) {
  var expected = "";
  try {
    var props = PropertiesService.getScriptProperties();
    expected = String(props.getProperty("PWA_API_KEY") || props.getProperty("CRON_SECRET") || "").trim();
  } catch (_e) {}
  if (!expected) return true;
  return String(key || "").trim() === expected;
}

function pwaApi_handle_(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    if (!pwaApi_checkKey_(p.key)) return pwaApi_err_("invalid key");

    var action = String(p.action || "").trim();
    var projectId = String(p.projectId || "").trim();
    var ym = String(p.ym || "").trim();

    if (action === "collectMonthlyData") {
      if (!projectId || !ym) return pwaApi_err_("projectId and ym required");
      return pwaApi_ok_(api_collectMonthlyData(projectId, ym));
    }

    if (action === "collectGmail") {
      if (!projectId || !ym) return pwaApi_err_("projectId and ym required");
      var startDate = mr_getMonthStart_(ym);
      var endDate = mr_getMonthEnd_(ym);
      return pwaApi_ok_({
        success: true,
        activities: {
          projectId: projectId,
          ym: ym,
          gmail: mr_extractFromGmail_(projectId, startDate, endDate)
        }
      });
    }

    // ============================================================
    // Admin actions — PWA_API_KEY 認証を通れば任意関数を呼べる
    // (えいみが clasp run の代わりに使う窓口。仕様: gas/CLAUDE.md「GAS 関数の実行手順」)
    // ============================================================

    // ScriptProperties のキー一覧 (値は伏せる)
    if (action === "listProps") {
      var keys = PropertiesService.getScriptProperties().getKeys();
      keys.sort();
      return pwaApi_ok_({ keys: keys, count: keys.length });
    }

    // 任意関数を名前指定で実行
    //   ?action=runFunc&fn=<関数名>&args=<JSON配列文字列>
    // または POST body に { fn, args }
    if (action === "runFunc") {
      var fnName = String(p.fn || "").trim();
      if (!fnName) {
        try {
          var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
          fnName = String(body.fn || "").trim();
        } catch (_e) {}
      }
      if (!fnName) return pwaApi_err_("fn required");
      var fn = (typeof globalThis !== "undefined" && globalThis[fnName]) || this[fnName];
      if (typeof fn !== "function") return pwaApi_err_("function not found: " + fnName);

      var args = [];
      try {
        if (p.args) args = JSON.parse(String(p.args));
        else if (e && e.postData && e.postData.contents) {
          var bd = JSON.parse(e.postData.contents);
          if (Array.isArray(bd.args)) args = bd.args;
        }
      } catch (_e) {}
      if (!Array.isArray(args)) args = [];

      var startTs = new Date().getTime();
      var result;
      try {
        result = fn.apply(null, args);
      } catch (err) {
        return pwaApi_err_("runFunc throw: " + (err && err.stack ? err.stack : err));
      }
      var ms = new Date().getTime() - startTs;
      return pwaApi_ok_({ fn: fnName, ms: ms, result: result });
    }

    return pwaApi_err_("unknown action: " + action);
  } catch (err) {
    return pwaApi_err_(err && err.stack ? err.stack : err);
  }
}
