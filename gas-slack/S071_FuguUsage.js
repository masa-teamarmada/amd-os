/** S071_FuguUsage.gs
 * えいみ Slack 返答末尾に付ける Fugu usage footer + Supabase log。
 * 呼ぶのは S030_TsukuyomiReply.js (replyPersona='eimi' 時のみ)。
 */

const EIMI_USAGE_LOG_TABLE = "eimi_slack_usage_log";

function eimi_buildFuguUsageFooter_(usageRef) {
  const u = (usageRef && usageRef.usage) || {};
  const model = (usageRef && usageRef.model) || "fugu";
  const pt = Number(u.prompt_tokens || 0);
  const ct = Number(u.completion_tokens || 0);
  const tt = Number(u.total_tokens || (pt + ct));

  let todayTotal = 0;
  try { todayTotal = eimi_chatSumTokensSince_(eimi_chatJstMidnightIso_()) + tt; } catch (_e) {}
  let monthTotal = 0;
  try { monthTotal = eimi_chatSumTokensSince_(eimi_chatJstMonthStartIso_()) + tt; } catch (_e) {}

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  let footer = "\n\n━━━━━━━━━━━━━━━━━━━━\n";
  footer += "🐡 Fugu (" + model + ")\n";
  footer += "  in: " + fmt(pt) + " / out: " + fmt(ct) + " / total: " + fmt(tt);
  if (todayTotal > 0) footer += "\n  本日累計: " + fmt(todayTotal);
  if (monthTotal > 0) footer += "\n  今月累計: " + fmt(monthTotal);
  footer += "\n━━━━━━━━━━━━━━━━━━━━";
  return footer;
}

function eimi_logFuguUsage_(row) {
  const supabaseUrl = (utils_getProp_("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = utils_getProp_("SUPABASE_SERVICE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return;

  UrlFetchApp.fetch(supabaseUrl + "/rest/v1/" + EIMI_USAGE_LOG_TABLE, {
    method: "post",
    contentType: "application/json",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      Prefer: "return=minimal"
    },
    payload: JSON.stringify(row),
    muteHttpExceptions: true
  });
}

function eimi_chatJstMidnightIso_() {
  const tz = "Asia/Tokyo";
  const dateStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  return dateStr + "T00:00:00+09:00";
}

function eimi_chatJstMonthStartIso_() {
  const tz = "Asia/Tokyo";
  const ym = Utilities.formatDate(new Date(), tz, "yyyy-MM");
  return ym + "-01T00:00:00+09:00";
}

function eimi_chatSumTokensSince_(sinceIso) {
  const supabaseUrl = (utils_getProp_("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = utils_getProp_("SUPABASE_SERVICE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return 0;

  const url = supabaseUrl + "/rest/v1/" + EIMI_USAGE_LOG_TABLE +
    "?select=total_tokens&created_at=gte." + encodeURIComponent(sinceIso);

  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey
    },
    muteHttpExceptions: true
  });

  let arr = [];
  try { arr = JSON.parse(res.getContentText() || "[]"); } catch (_e) { arr = []; }
  if (!Array.isArray(arr)) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += Number(arr[i].total_tokens || 0);
  return sum;
}
