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

/** 1 PJ × 1 ym の Notion 議事録 DB ページを全件 inspect。
 *
 * SX (p21) 4/14 / 4/16 / 4/17 / 4/28 のように「議事録あるはずなのに
 * project_meeting_summaries に登録されてない」ケースの原因切り分け用。
 *
 * 各ページについて:
 *   - eventId プロパティ値 (空かどうか = AI ページ自動生成判定)
 *   - PJ relation の page id + 解決した PJ 名
 *   - _meeting_resolveProjectIdFromPage_ の結果 (= projectId)
 *   - 本文長 (props "内容" + 標準 blocks)
 *   - transcription block の有無 (= AI 議事録ページ判定)
 * を返す。
 *
 * @param {string} projectId 絞り込みたい AMD projectId ("p21" 等)
 * @param {string} ymKey yyyymm (例: "202604")
 * @return {Object} {ok, projectId, ym, totalPages, matched, pages: [...]}
 */
function debug_meeting_inspectYm(projectId, ymKey) {
  projectId = String(projectId || "").trim();
  ymKey = String(ymKey || "").trim();
  if (!projectId) return { ok: false, message: "projectId empty" };
  if (!/^\d{6}$/.test(ymKey)) return { ok: false, message: "ymKey invalid (need yyyymm)" };

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok: false, message: "NOTION_DATABASE_ID missing" };

  let pages;
  try {
    pages = nav_repo_notion_queryMinutesByYmFull_(notionToken, notionDbRaw, ymKey);
  } catch (e) {
    Logger.log("[debug_meeting_inspectYm] queryMinutesByYmFull error: " + (e && e.stack ? e.stack : e));
    return { ok: false, message: "queryMinutesByYmFull error: " + e };
  }
  pages = Array.isArray(pages) ? pages : [];

  const items = [];
  let matched = 0;
  for (const p of pages) {
    const pageId = String(p && p.id ? p.id : "").trim();
    const title = (typeof _meeting_extractTitleFromPage_ === "function") ? _meeting_extractTitleFromPage_(p) : "";
    const dateStart = (typeof _meeting_extractDateStartFromPage_ === "function") ? _meeting_extractDateStartFromPage_(p) : "";
    const eventId = (typeof _meeting_extractEventIdFromPage_ === "function") ? _meeting_extractEventIdFromPage_(p) : "";
    const lastEdited = String(p && p.last_edited_time ? p.last_edited_time : "");

    let pjRelationIds = [];
    try {
      if (typeof _notion_extractRelationIds_ === "function") {
        pjRelationIds = _notion_extractRelationIds_(p, "PJ") || [];
      }
    } catch (e) { Logger.log("[debug_meeting_inspectYm] PJ relation extract error: " + e); }

    const pjRelationNames = [];
    if (typeof _notion_resolvePageTitleCached_ === "function") {
      for (const relId of pjRelationIds) {
        try {
          const name = String(_notion_resolvePageTitleCached_(notionToken, relId) || "").trim();
          if (name) pjRelationNames.push(name);
        } catch (e) { Logger.log("[debug_meeting_inspectYm] resolvePageTitle error: " + e); }
      }
    }

    let resolvedProjectId = "";
    try {
      if (typeof _meeting_resolveProjectIdFromPage_ === "function") {
        resolvedProjectId = _meeting_resolveProjectIdFromPage_(notionToken, p) || "";
      }
    } catch (e) { Logger.log("[debug_meeting_inspectYm] resolveProjectId error: " + e); }

    const isTarget = resolvedProjectId === projectId;

    let bodyChars = 0;
    let hasTranscriptionBlock = false;
    let aiBodyChars = 0;
    if (isTarget) {
      try {
        if (typeof nav_repo_notion_fetchPageBodyText === "function") {
          const body = nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 3000 });
          bodyChars = String(body || "").length;
        }
      } catch (e) { Logger.log("[debug_meeting_inspectYm] fetchPageBodyText error: " + e); }

      try {
        const blocksUrl = "https://api.notion.com/v1/blocks/" + encodeURIComponent(pageId) + "/children?page_size=100";
        const res = UrlFetchApp.fetch(blocksUrl, {
          method: "get",
          headers: { "Authorization": "Bearer " + notionToken, "Notion-Version": "2022-06-28" },
          muteHttpExceptions: true
        });
        if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
          const j = JSON.parse(res.getContentText());
          const blocks = (j && j.results) || [];
          for (const b of blocks) {
            if (b && b.type === "transcription") { hasTranscriptionBlock = true; break; }
          }
        }
      } catch (e) { Logger.log("[debug_meeting_inspectYm] fetch blocks error: " + e); }

      try {
        if (hasTranscriptionBlock && typeof _meeting_fetchAiNotesBody_ === "function") {
          const aiBody = _meeting_fetchAiNotesBody_(notionToken, pageId, { maxChars: 3000 });
          aiBodyChars = String(aiBody || "").length;
        }
      } catch (e) { Logger.log("[debug_meeting_inspectYm] fetchAiNotesBody error: " + e); }
    }

    if (isTarget) matched++;

    items.push({
      pageId: pageId,
      title: title,
      dateStart: dateStart,
      eventId: eventId,
      lastEdited: lastEdited,
      pjRelationIds: pjRelationIds,
      pjRelationNames: pjRelationNames,
      resolvedProjectId: resolvedProjectId,
      isTarget: isTarget,
      bodyChars: bodyChars,
      hasTranscriptionBlock: hasTranscriptionBlock,
      aiBodyChars: aiBodyChars,
      url: String(p && p.url ? p.url : "")
    });
  }

  return {
    ok: true,
    projectId: projectId,
    ym: ymKey,
    totalPages: pages.length,
    matched: matched,
    pages: items
  };
}

/** Gemini API を直接叩いて生 response (finishReason / safetyRatings / parts.text 全部) を返す。
 *  llm_callGemini_ は内部で text のみ抽出して safety filter 等で空を返すケースを区別できないため、
 *  error_llm の真因 (safety block / token 超え / parser 失敗) を切り分ける用。
 *
 *  使い方: combinedText は debug_meeting_dumpAiBody や手動構築で用意 → systemPrompt + userPrompt で投入。
 */
function debug_llm_geminiRaw(systemPrompt, userPrompt, opts) {
  opts = opts || {};
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty("GEMINI_API_KEY") || "").trim();
  if (!apiKey) return { ok: false, message: "GEMINI_API_KEY missing" };
  const model = String(opts.model || "gemini-2.5-flash").trim();
  const maxTokens = Number(opts.maxTokens || 2048);
  const temperature = (opts.temperature !== undefined && opts.temperature !== null) ? Number(opts.temperature) : 0.2;

  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" +
                   encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);
  const payload = {
    contents: [{ role: "user", parts: [{ text: String(userPrompt || "") }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature
    }
  };
  const sys = String(systemPrompt || "").trim();
  if (sys) payload.systemInstruction = { role: "system", parts: [{ text: sys }] };

  let resp;
  try {
    resp = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("[debug_llm_geminiRaw] fetch error: " + (e && e.stack ? e.stack : e));
    return { ok: false, message: "fetch error: " + e };
  }

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_e) {}

  const candidates = (parsed && Array.isArray(parsed.candidates)) ? parsed.candidates : [];
  const firstCand = candidates[0] || null;
  const finishReason = firstCand ? firstCand.finishReason : null;
  const safetyRatings = firstCand ? firstCand.safetyRatings : null;
  const promptFeedback = parsed ? parsed.promptFeedback : null;

  let responseText = "";
  if (firstCand && firstCand.content && Array.isArray(firstCand.content.parts)) {
    for (const p of firstCand.content.parts) {
      if (p && p.text) responseText += String(p.text);
    }
  }

  return {
    ok: code >= 200 && code < 300,
    statusCode: code,
    model: model,
    inputUserPromptLen: String(userPrompt || "").length,
    inputSystemPromptLen: sys.length,
    finishReason: finishReason,
    safetyRatings: safetyRatings,
    promptFeedback: promptFeedback,
    candidatesCount: candidates.length,
    responseTextLen: responseText.length,
    responseText: responseText.slice(0, 4000),
    rawSnippet: text.slice(0, 2500)
  };
}

/** _meeting_fetchAiNotesBody_ の戻り値をそのまま返す debug。
 *  Gemini への入力 (combinedText の AI 部分) を実際に見る用。
 */
function debug_meeting_dumpAiBody(pageId) {
  pageId = String(pageId || "").trim();
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!pageId) return { ok: false, message: "pageId empty" };
  if (typeof _meeting_fetchAiNotesBody_ !== "function") return { ok: false, message: "_meeting_fetchAiNotesBody_ unavailable" };

  let body = "";
  try {
    body = String(_meeting_fetchAiNotesBody_(notionToken, pageId, { maxChars: 20000 }) || "");
  } catch (e) {
    return { ok: false, message: "fetchAiNotesBody error: " + (e && e.message ? e.message : e) };
  }
  return {
    ok: true,
    pageId: pageId,
    bodyLength: body.length,
    body: body
  };
}

/** Notion ページの properties を直接 fetch して全プロパティ + メタを返す。
 *  AI 自動生成ページの「日付 / PJ / eventId プロパティが入ってるか」を確認する用。
 */
function debug_meeting_inspectPage(pageId) {
  pageId = String(pageId || "").trim();
  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!pageId) return { ok: false, message: "pageId empty" };

  const url = "https://api.notion.com/v1/pages/" + encodeURIComponent(pageId);
  let res;
  try {
    res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { "Authorization": "Bearer " + notionToken, "Notion-Version": "2022-06-28" },
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log("[debug_meeting_inspectPage] fetch error: " + e);
    return { ok: false, message: "fetch error: " + e };
  }
  const status = res.getResponseCode();
  if (status < 200 || status >= 300) {
    return { ok: false, status: status, body: String(res.getContentText() || "").slice(0, 800) };
  }
  let body;
  try {
    body = JSON.parse(res.getContentText());
  } catch (e) {
    Logger.log("[debug_meeting_inspectPage] parse error: " + e);
    return { ok: false, message: "parse error" };
  }

  const propSummary = {};
  const properties = (body && body.properties) || {};
  for (const k in properties) {
    const p = properties[k];
    let val = "";
    if (p.type === "title" && Array.isArray(p.title)) {
      val = p.title.map(function (x) { return String((x && x.plain_text) || ""); }).join("");
    } else if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
      val = p.rich_text.map(function (x) { return String((x && x.plain_text) || ""); }).join("");
    } else if (p.type === "date" && p.date) {
      val = String(p.date.start || "") + (p.date.end ? " ~ " + p.date.end : "");
    } else if (p.type === "date") {
      val = "<empty>";
    } else if (p.type === "relation" && Array.isArray(p.relation)) {
      val = p.relation.map(function (x) { return x.id; }).join(",");
    } else if (p.type === "select" && p.select) {
      val = String(p.select.name || "");
    } else if (p.type === "select") {
      val = "<empty>";
    } else if (p.type === "multi_select" && Array.isArray(p.multi_select)) {
      val = p.multi_select.map(function (x) { return x.name; }).join(",");
    } else if (p.type === "people" && Array.isArray(p.people)) {
      val = p.people.map(function (x) { return x.id; }).join(",");
    } else {
      val = JSON.stringify(p).slice(0, 200);
    }
    propSummary[k] = { type: p.type, value: val };
  }

  return {
    ok: true,
    pageId: body.id,
    url: body.url,
    created_time: body.created_time,
    last_edited_time: body.last_edited_time,
    archived: body.archived,
    parent: body.parent,
    properties: propSummary
  };
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
