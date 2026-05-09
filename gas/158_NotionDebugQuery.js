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

/** Notion ページの blocks を直接 fetch して block type 一覧 + 各 block の生 JSON を返す
 *  AI 自動生成ページの <meeting-notes> 構造を解明する用。
 */
function debug_meeting_inspectBlocks(pageId) {
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };

  const url = "https://api.notion.com/v1/blocks/" + encodeURIComponent(pageId) + "/children?page_size=100";
  let res;
  try {
    res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        "Authorization": "Bearer " + notionToken,
        "Notion-Version": "2022-06-28"
      },
      muteHttpExceptions: true
    });
  } catch (e) { return { ok: false, message: "fetch error: " + e }; }
  const status = res.getResponseCode();
  let body = null;
  try { body = JSON.parse(res.getContentText()); } catch (_e) { body = null; }
  if (status < 200 || status >= 300) {
    return { ok: false, status: status, body: String(res.getContentText() || "").slice(0, 600) };
  }
  const blocks = (body && body.results) || [];
  const types = {};
  for (const b of blocks) {
    types[b.type || "unknown"] = (types[b.type || "unknown"] || 0) + 1;
  }
  return {
    ok: true,
    pageId: pageId,
    blockCount: blocks.length,
    typesSummary: types,
    blocks: blocks.slice(0, 30).map(function (b) {
      // block の生 JSON を 1500 字までに truncate して返す
      const raw = JSON.stringify(b).slice(0, 1500);
      return { id: b.id, type: b.type, has_children: b.has_children, raw: raw };
    })
  };
}
