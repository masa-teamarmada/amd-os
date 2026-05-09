/** 158_NotionDebugQuery.gs — Notion 議事録 DB の query を debug 用に直接叩いて結果を返す
 *
 * BUGS.md `[GAS] Notion 議事録ページが 1 会議で 2 つ生成される` の調査用。
 * cron テンプレページと Notion AI ページが同じ DB に並んでいるはずなのに、
 * gas/074 の fallback (日付 + タイトル contains) で AI ページが拾えない問題を再現する。
 */

/** 議事録 DB を様々な filter で query して結果を返す
 *  @param {string} eventId
 *  @param {string} meetingDate "YYYY-MM-DD"
 *  @param {string} titleHint
 *  @return {Object} {byEventId, byDate, byTitle, allRecent}
 */
function debug_meeting_query(eventId, meetingDate, titleHint) {
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken || !notionDbRaw) return { ok: false, message: "NOTION_TOKEN or NOTION_DATABASE_ID missing" };

  const dbId = (typeof _notion_normId_ === "function") ? _notion_normId_(notionDbRaw) : notionDbRaw;
  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  const summarize = function (results) {
    return (results || []).map(function (p) {
      const title = _meeting_extractTitleFromPage_(p);
      const dateStart = _meeting_extractDateStartFromPage_(p);
      const evIdProp = (function () {
        try {
          const pp = (p && p.properties) ? p.properties : {};
          const pr = pp && pp["eventId"] ? pp["eventId"] : null;
          if (!pr) return "";
          if (pr.type === "rich_text" && Array.isArray(pr.rich_text)) {
            return pr.rich_text.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("");
          }
          return "";
        } catch (e) { return ""; }
      })();
      return { id: p.id, title: title, dateStart: dateStart, eventId: evIdProp };
    });
  };

  const out = {};

  // 1) eventId equals
  try {
    const r = _notion_fetch_(notionToken, url, "post", {
      filter: { property: "eventId", rich_text: { equals: String(eventId) } },
      page_size: 5
    });
    out.byEventId = summarize(r && r.results);
  } catch (e) { out.byEventId = { error: String(e) }; }

  // 2) date equals
  try {
    const r = _notion_fetch_(notionToken, url, "post", {
      filter: { property: "日付", date: { equals: meetingDate } },
      page_size: 20
    });
    out.byDate = summarize(r && r.results);
  } catch (e) { out.byDate = { error: String(e) }; }

  // 3) title contains
  try {
    const r = _notion_fetch_(notionToken, url, "post", {
      filter: { property: "名前", title: { contains: String(titleHint) } },
      page_size: 20
    });
    out.byTitle = summarize(r && r.results);
  } catch (e) { out.byTitle = { error: String(e) }; }

  // 4) 全件 (filter なし、最近 sort)
  try {
    const r = _notion_fetch_(notionToken, url, "post", {
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      page_size: 10
    });
    out.allRecent = summarize(r && r.results);
  } catch (e) { out.allRecent = { error: String(e) }; }

  return { ok: true, params: { eventId: eventId, meetingDate: meetingDate, titleHint: titleHint }, out: out };
}
