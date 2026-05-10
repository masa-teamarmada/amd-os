/** 160_MeetingAiBackfill.gs — Notion AI ミーティングノートの 3 プロパティ後付け
 *
 * 背景:
 *   Notion AI が会議終了時に自動生成する議事録ページは、title に ISO 日時 (例:
 *   "SX定例MTG 2026-04-14T16:00:00.000+09:00") が入るが、
 *   「日付」「eventId」「PJ」relation の 3 プロパティが **空のまま生成される**。
 *   このため:
 *   - `nav_repo_notion_queryMinutesByYmFull_` の date filter から漏れる
 *   - `_meeting_findNotionPageByEventId_` の eventId equals search に失敗
 *   - cron が拾えず、PWA cockpit に MTG サマリが表示されない (まさ指摘 2026-05-11、SX で発覚)
 *
 *   この backfill 関数は 1 回流せば過去全 AI ページが救済される。
 *   今後の AI ページについても日次 cron で叩けば自動カバー。
 *
 * 処理フロー:
 *   1. Notion 議事録 DB を sinceDays で query (last_edited_time / created_time の or filter)
 *   2. 各ページについて 3 プロパティの現在値を見て、空のものだけ後付け対象に
 *   3. title から ISO 日時 regex parse → 「日付」プロパティ用 YYYY-MM-DD と event 検索用 timestamp
 *   4. CFG_PJAlias で title から pjCode 判定 → PJ DB から page id 引き
 *   5. calendar API で同時刻 ±5 分の events 取得 → タイトル類似度で 1 件絞り込み → eventId
 *   6. Notion API で空プロパティのみ patch
 *
 * 仕様: pwa/BUGS.md `[GAS] SX (p21) 繰り返し MTG ...` 参照
 *
 * 使い方:
 *   nav_meeting_backfillAiPages_({ dryRun: true })                                   // 全件 dry run
 *   nav_meeting_backfillAiPages_({ projectIdFilter: "p21", dryRun: true })           // SX のみ dry run
 *   nav_meeting_backfillAiPages_({ projectIdFilter: "p21", dryRun: false })          // SX のみ実 patch
 *   nav_meeting_backfillAiPages_({ sinceDays: 90, dryRun: false })                   // 直近 90 日のみ全 PJ
 *
 * 依存:
 *   - 074_MeetingSummaryRepo.js: _meeting_extractTitleFromPage_, _meeting_extractEventIdFromPage_,
 *                                _meeting_extractDateStartFromPage_
 *   - 153_MeetingHourlyTrigger.js: _meeting_resolveCalendarId_
 *   - CalendarToNotionMinutes.js: _loadPJAliasesForMinutes_, _matchAlias_,
 *                                  _notion_buildPjCodeToPageIdMap_, _notion_normId_
 *   - CalendarApiAdapter.js: listEventsByApi_
 *   - NotionProtocolSync.js: _resolveAmdProjectIdByProjectNameOrCode_
 *   - 内部: _notion_fetch_ (CalendarToNotionMinutes 経由)
 */

function nav_meeting_backfillAiPages_(opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const sinceDays = Number(opts.sinceDays || 365);
  const projectIdFilter = String(opts.projectIdFilter || "").trim();
  const maxItems = Number(opts.maxItems || 0); // 0 = 無制限

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  const pjDbRaw = String(props.getProperty("NOTION_PJ_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok: false, message: "NOTION_DATABASE_ID missing" };
  if (!pjDbRaw) return { ok: false, message: "NOTION_PJ_DATABASE_ID missing" };

  if (typeof _notion_buildPjCodeToPageIdMap_ !== "function") return { ok: false, message: "_notion_buildPjCodeToPageIdMap_ unavailable" };
  if (typeof _loadPJAliasesForMinutes_ !== "function") return { ok: false, message: "_loadPJAliasesForMinutes_ unavailable" };
  if (typeof _matchAlias_ !== "function") return { ok: false, message: "_matchAlias_ unavailable" };
  if (typeof _meeting_resolveCalendarId_ !== "function") return { ok: false, message: "_meeting_resolveCalendarId_ unavailable" };
  if (typeof listEventsByApi_ !== "function") return { ok: false, message: "listEventsByApi_ unavailable" };
  if (typeof _notion_normId_ !== "function") return { ok: false, message: "_notion_normId_ unavailable" };
  if (typeof _notion_fetch_ !== "function") return { ok: false, message: "_notion_fetch_ unavailable" };

  // 1. PJ DB pageId map (cached 6h)
  let pjMap = {};
  try {
    pjMap = _notion_buildPjCodeToPageIdMap_(notionToken, pjDbRaw) || {};
  } catch (e) {
    Logger.log("[backfillAiPages] PJ map build error: " + (e && e.stack ? e.stack : e));
    return { ok: false, message: "PJ DB query error: " + e };
  }

  // 2. CFG_PJAlias
  const pjAliases = _loadPJAliasesForMinutes_() || [];
  if (!pjAliases.length) return { ok: false, message: "CFG_PJAlias empty (= スプシ未設定 or 読み込み失敗)" };

  // 3. calendar id resolve
  const calRes = _meeting_resolveCalendarId_();
  if (!calRes.ok) return { ok: false, message: "calendar resolve failed: " + (calRes.message || "") };
  const calendarId = calRes.calendarId;

  // 4. Notion 議事録 DB query (sinceDays、created/last_edited 両方の or)
  const dbId = _notion_normId_(notionDbRaw);
  const sinceISO = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  const allPages = [];
  let cursor = null;
  while (true) {
    const payload = {
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      filter: {
        or: [
          { timestamp: "last_edited_time", last_edited_time: { on_or_after: sinceISO } },
          { timestamp: "created_time", created_time: { on_or_after: sinceISO } }
        ]
      },
      page_size: 100
    };
    if (cursor) payload.start_cursor = cursor;

    let res;
    try {
      res = _notion_fetch_(notionToken, url, "post", payload);
    } catch (e) {
      Logger.log("[backfillAiPages] db query error: " + (e && e.stack ? e.stack : e));
      return { ok: false, message: "db query error: " + e, partialPages: allPages.length };
    }
    const results = res && res.results ? res.results : [];
    for (const p of results) allPages.push(p);
    cursor = res && res.next_cursor;
    if (!cursor) break;
  }

  // 5. 各ページ判定 + backfill
  const items = [];
  let scanned = 0, eligibleAi = 0, backfilled = 0, ambiguous = 0, skipped = 0, errors = 0;
  const titleIsoRegex = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

  for (const page of allPages) {
    scanned++;
    if (maxItems > 0 && backfilled >= maxItems) break;

    const pageId = String(page && page.id ? page.id : "").trim();
    if (!pageId) { skipped++; continue; }

    const title = (typeof _meeting_extractTitleFromPage_ === "function") ? _meeting_extractTitleFromPage_(page) : "";
    if (!title) { skipped++; continue; }

    // 現在の 3 プロパティ
    const curEventId = (typeof _meeting_extractEventIdFromPage_ === "function") ? _meeting_extractEventIdFromPage_(page) : "";
    const curDate = (typeof _meeting_extractDateStartFromPage_ === "function") ? _meeting_extractDateStartFromPage_(page) : "";
    let curPjRelIds = [];
    try {
      const pjProp = page && page.properties ? page.properties["PJ"] : null;
      if (pjProp && pjProp.type === "relation" && Array.isArray(pjProp.relation)) {
        curPjRelIds = pjProp.relation.map(function (r) { return r.id; });
      }
    } catch (e) { Logger.log("[backfillAiPages] PJ rel extract error: " + e); }

    // 既に全部入ってれば skip
    if (curEventId && curDate && curPjRelIds.length > 0) { skipped++; continue; }

    // title に ISO 日時 = AI 自動生成ページの強い signal
    const m = title.match(titleIsoRegex);
    if (!m) { skipped++; continue; }

    const datePart = m[1] + "-" + m[2] + "-" + m[3];
    const isoStr = m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6] + "+09:00";
    const eventStartTs = new Date(isoStr).getTime();
    if (isNaN(eventStartTs)) { skipped++; continue; }
    eligibleAi++;

    // CFG_PJAlias 経由で pjCode 判定
    const aliasHit = _matchAlias_(title, pjAliases);
    if (!aliasHit || !aliasHit.pjCode) {
      items.push({ pageId: pageId, title: title, action: "skipped_no_pj_alias" });
      skipped++;
      continue;
    }
    const pjCode = String(aliasHit.pjCode || "").trim();
    if (pjCode.toUpperCase() === "EXCLUDE") {
      items.push({ pageId: pageId, title: title, action: "skipped_alias_exclude" });
      skipped++;
      continue;
    }
    if (pjCode.toUpperCase() === "AMD") {
      items.push({ pageId: pageId, title: title, action: "skipped_amd_general" });
      skipped++;
      continue;
    }

    // pjCode → projectId resolve
    let projectId = "";
    try {
      if (typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function") {
        projectId = String(_resolveAmdProjectIdByProjectNameOrCode_(pjCode) || "").trim();
      }
    } catch (e) { Logger.log("[backfillAiPages] resolveProjectId error: " + e); }

    if (projectIdFilter && projectId !== projectIdFilter) {
      skipped++;
      continue;
    }

    const pjPageId = pjMap[pjCode] || "";

    // calendar event lookup (±5 分)
    let foundEventId = "";
    let foundEventTitle = "";
    let candidates = [];
    try {
      const winStart = new Date(eventStartTs - 5 * 60 * 1000);
      const winEnd = new Date(eventStartTs + 5 * 60 * 1000);
      const events = listEventsByApi_(calendarId, winStart, winEnd) || [];
      for (const ev of events) {
        if (!ev || !ev.id || !ev.start) continue;
        const evStartStr = ev.start.dateTime || ev.start.date;
        if (!evStartStr) continue;
        const evStartTs = new Date(evStartStr).getTime();
        if (Math.abs(evStartTs - eventStartTs) <= 5 * 60 * 1000) {
          candidates.push(ev);
        }
      }
    } catch (e) {
      Logger.log("[backfillAiPages] calendar lookup error: " + e);
      errors++;
      items.push({ pageId: pageId, title: title, action: "error_calendar", message: String(e && e.message ? e.message : e) });
      continue;
    }

    if (candidates.length === 0) {
      items.push({ pageId: pageId, title: title, pjCode: pjCode, projectId: projectId, datePart: datePart, action: "no_event_found" });
      skipped++;
      continue;
    }

    if (candidates.length === 1) {
      foundEventId = String(candidates[0].id || "");
      foundEventTitle = String(candidates[0].summary || "");
    } else {
      // タイトル先頭一致でスコアリング
      const titleHead = title.replace(/\s*\d{4}-\d{2}-\d{2}.*$/, "").trim().slice(0, 12);
      let best = null;
      let bestScore = 0;
      for (const ev of candidates) {
        const evSum = String(ev.summary || "").trim();
        const evHead = evSum.slice(0, 12);
        let score = 0;
        if (evHead === titleHead) score = 100;
        else if (titleHead && evSum.indexOf(titleHead) >= 0) score = 70;
        else if (evHead && title.indexOf(evHead) >= 0) score = 50;
        if (score > bestScore) { bestScore = score; best = ev; }
      }
      if (best && bestScore > 0) {
        foundEventId = String(best.id || "");
        foundEventTitle = String(best.summary || "");
      } else {
        ambiguous++;
        items.push({ pageId: pageId, title: title, pjCode: pjCode, projectId: projectId, action: "ambiguous_event", candidatesCount: candidates.length, candidatesTitles: candidates.map(function(e){return String(e.summary||"");}) });
        continue;
      }
    }

    // patch payload (空フィールドのみ)
    const patchProps = {};
    if (!curDate) patchProps["日付"] = { date: { start: datePart } };
    if (!curEventId && foundEventId) patchProps["eventId"] = { rich_text: [{ text: { content: foundEventId } }] };
    if (curPjRelIds.length === 0 && pjPageId) patchProps["PJ"] = { relation: [{ id: pjPageId }] };

    if (Object.keys(patchProps).length === 0) {
      skipped++;
      continue;
    }

    const planned = {
      pageId: pageId,
      title: title,
      pjCode: pjCode,
      projectId: projectId,
      datePart: datePart,
      eventId: foundEventId,
      eventTitle: foundEventTitle,
      pjPageId: pjPageId,
      curDate: curDate || "<empty>",
      curEventId: curEventId || "<empty>",
      curPjRelCount: curPjRelIds.length,
      patchKeys: Object.keys(patchProps)
    };

    if (dryRun) {
      items.push(Object.assign({ action: "dryrun_would_patch" }, planned));
      backfilled++;
      continue;
    }

    try {
      _notion_fetch_(notionToken, "https://api.notion.com/v1/pages/" + encodeURIComponent(pageId), "patch", { properties: patchProps });
      items.push(Object.assign({ action: "patched" }, planned));
      backfilled++;
    } catch (e) {
      Logger.log("[backfillAiPages] patch error: " + (e && e.stack ? e.stack : e));
      errors++;
      items.push({ pageId: pageId, title: title, action: "error_patch", message: String(e && e.message ? e.message : e) });
    }
  }

  return {
    ok: true,
    dryRun: dryRun,
    sinceDays: sinceDays,
    projectIdFilter: projectIdFilter,
    totalPagesFromNotion: allPages.length,
    scanned: scanned,
    eligibleAi: eligibleAi,
    backfilled: backfilled,
    ambiguous: ambiguous,
    skipped: skipped,
    errors: errors,
    items: items
  };
}
