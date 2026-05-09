/** 157_MeetingDebugInspector.gs
 *
 * 目的: 1 calendar event について、Notion 議事録ページ本文 と Gmail thread 群 の
 *       生テキスト/メタを返す debug 用関数。
 *       「BWE 株主総会の議事録に CX が混入する」ような汚染源切り分け用。
 *
 * 仕様: pwa/BUGS.md の「BWE 議事録 CX 汚染」エントリ参照
 */

function debug_meeting_inspectEvent(eventId, projectId) {
  eventId = String(eventId || "").trim();
  projectId = String(projectId || "").trim();
  if (!eventId) return { ok: false, message: "eventId empty" };
  if (!projectId) return { ok: false, message: "projectId empty" };

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();

  const out = {
    ok: true,
    eventId: eventId,
    projectId: projectId,
    notion: { found: false },
    gmail: { threads: [] }
  };

  // Notion
  try {
    const page = _meeting_findNotionPageByEventId_(notionToken, notionDbRaw, eventId);
    if (page) {
      const pageId = String(page.id || "").trim();
      let propText = "";
      let blockText = "";
      try {
        if (typeof _notion_extractPropertyText_ === "function") {
          propText = String(_notion_extractPropertyText_(page, "内容") || "").trim();
        }
      } catch (_e) {}
      try {
        blockText = String(nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 8000 }) || "").trim();
      } catch (_e) {}
      const title = (typeof _meeting_extractTitleFromPage_ === "function") ? _meeting_extractTitleFromPage_(page) : "";
      out.notion = {
        found: true,
        pageId: pageId,
        url: String(page.url || ""),
        title: title,
        propTextLen: propText.length,
        blockTextLen: blockText.length,
        propTextSnippet: propText.slice(0, 600),
        blockTextSnippet: blockText.slice(0, 1500)
      };
    }
  } catch (e) {
    out.notion = { found: false, error: String(e && e.message ? e.message : e) };
  }

  // Gmail (会議日 ±1日 で取得 = nav_meeting_processOneEvent_ と同じロジック)
  try {
    const page = out.notion.found ? _meeting_findNotionPageByEventId_(notionToken, notionDbRaw, eventId) : null;
    let meetingDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    if (page) {
      const dateStart = _meeting_extractDateStartFromPage_(page);
      if (dateStart && /^\d{4}-\d{2}-\d{2}/.test(dateStart)) meetingDate = dateStart.slice(0, 10);
    }
    const gmailWindowStart = new Date(new Date(meetingDate + "T00:00:00+09:00").getTime() - 24 * 60 * 60 * 1000);
    const gmailWindowEnd = new Date(new Date(meetingDate + "T00:00:00+09:00").getTime() + 2 * 24 * 60 * 60 * 1000);
    const cache = _meeting_loadGmailCacheForMonth_(projectId, gmailWindowStart, gmailWindowEnd);
    const relevant = _meeting_pickRelevantGmailThreads_(cache.threads || [], meetingDate);
    out.gmail = {
      meetingDate: meetingDate,
      windowStart: gmailWindowStart.toISOString(),
      windowEnd: gmailWindowEnd.toISOString(),
      cacheSize: (cache.threads || []).length,
      relevantCount: relevant.length,
      cacheNote: cache.note || "",
      threads: relevant.map(function (t) {
        return {
          threadId: t.threadId,
          subject: t.subject,
          from: t.from,
          firstAt: t.firstAt instanceof Date ? Utilities.formatDate(t.firstAt, "Asia/Tokyo", "yyyy-MM-dd HH:mm") : "",
          lastAt: t.lastAt instanceof Date ? Utilities.formatDate(t.lastAt, "Asia/Tokyo", "yyyy-MM-dd HH:mm") : "",
          bodyTextSnippet: String(t.bodyText || "").slice(0, 1200)
        };
      })
    };
  } catch (e) {
    out.gmail = { error: String(e && e.message ? e.message : e), threads: [] };
  }

  return out;
}
