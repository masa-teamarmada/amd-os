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
    expected = String(PropertiesService.getScriptProperties().getProperty("PWA_API_KEY") || "").trim();
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

    return pwaApi_err_("unknown action: " + action);
  } catch (err) {
    return pwaApi_err_(err && err.stack ? err.stack : err);
  }
}
