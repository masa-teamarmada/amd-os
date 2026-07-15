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

/**
 * 保存済み project_meeting_summaries の notion_page_id を正として、
 * Notion 議事録ページの空メタデータだけを後付けする。
 *
 * - eventId は空のときだけ calendar_event_id / meeting_id を入れる
 * - PJ relation は空のときだけ project_id -> project_name -> Notion PJ DB で解決して入れる
 * - member relation は既存値を消さず、設定済みの既定 member page だけを union 追加する
 * - 既存値が別値の場合は上書きせず conflict として返す
 *
 * 使い方:
 *   nav_meeting_backfillMinutesMetadataFromSummaries_({ dryRun: true, sinceDays: 365, limit: 100 })
 *   nav_meeting_backfillMinutesMetadataFromSummaries_({ dryRun: false, sinceDays: 365, limit: 50, offset: 0 })
 */
function nav_meeting_backfillMinutesMetadataFromSummaries_(opts) {
  opts = opts || {};
  const dryRun = opts.dryRun !== false;
  const sinceDays = Number(opts.sinceDays || 365);
  const limit = Math.max(1, Math.min(Number(opts.limit || opts.maxItems || 100), 200));
  const offset = Math.max(0, Number(opts.offset || 0));
  const projectIdFilter = String(opts.projectIdFilter || "").trim();

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const pjDbRaw = String(props.getProperty("NOTION_PJ_DATABASE_ID") || "").trim();
  const memberPropConfigured = String(props.getProperty("NOTION_MINUTES_MEMBER_PROP") || "").trim();
  const defaultMemberPageId = String(props.getProperty("NOTION_MINUTES_DEFAULT_MEMBER_PAGE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!pjDbRaw) return { ok: false, message: "NOTION_PJ_DATABASE_ID missing" };
  if (typeof _notion_fetch_ !== "function") return { ok: false, message: "_notion_fetch_ unavailable" };
  if (typeof _notion_buildPjCodeToPageIdMap_ !== "function") return { ok: false, message: "_notion_buildPjCodeToPageIdMap_ unavailable" };
  if (typeof _meeting_resolveProjectName_ !== "function") return { ok: false, message: "_meeting_resolveProjectName_ unavailable" };
  if (typeof _supa_props_ !== "function") return { ok: false, message: "_supa_props_ unavailable" };

  let pjMap = {};
  try {
    pjMap = _notion_buildPjCodeToPageIdMap_(notionToken, pjDbRaw) || {};
  } catch (e) {
    return { ok: false, message: "PJ DB query error: " + String(e && e.message ? e.message : e) };
  }

  const sinceISO = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const nowISO = new Date().toISOString();
  const rowsRes = _meeting_backfillFetchSummaryRows_({
    sinceISO: sinceISO,
    nowISO: nowISO,
    projectIdFilter: projectIdFilter,
    limit: limit,
    offset: offset
  });
  if (!rowsRes.ok) return rowsRes;

  const rows = rowsRes.rows || [];
  const counts = {
    scanned: 0,
    eligible: 0,
    wouldPatch: 0,
    patched: 0,
    eventIdFilled: 0,
    dateFilled: 0,
    pjFilled: 0,
    memberFilled: 0,
    conflicts: 0,
    skipped: 0,
    errors: 0
  };
  const items = [];

  for (let i = 0; i < rows.length; i++) {
    counts.scanned++;
    const row = rows[i] || {};
    const meetingId = String(row.meeting_id || "").trim();
    const pageId = String(row.notion_page_id || "").trim();
    const projectId = String(row.project_id || "").trim();
    const title = _meeting_backfillSafeTitle_(row.title || "");
    const meetingDate = _meeting_backfillDatePart_(row.meeting_date || row.meeting_start_at || "");
    const eventId = String(row.calendar_event_id || "").trim() || (/^upcoming:/.test(meetingId) ? "" : meetingId);

    if (!pageId || !projectId || !meetingId || /^upcoming:/.test(meetingId)) {
      counts.skipped++;
      continue;
    }
    counts.eligible++;

    let page;
    try {
      page = _notion_fetch_(notionToken, "https://api.notion.com/v1/pages/" + encodeURIComponent(pageId), "get", null);
    } catch (e) {
      counts.errors++;
      items.push(_meeting_backfillItem_(row, "error_fetch_page", { message: _meeting_backfillShortError_(e) }));
      continue;
    }

    const patchProps = {};
    const patchKeys = [];
    const conflictKeys = [];
    const skipReasons = [];

    const curEventId = _meeting_backfillExtractEventId_(page);
    if (!curEventId && eventId) {
      patchProps["eventId"] = { rich_text: [{ text: { content: eventId } }] };
      patchKeys.push("eventId");
    } else if (curEventId && eventId && curEventId !== eventId) {
      conflictKeys.push("eventId");
    }

    const curDate = _meeting_backfillExtractDate_(page);
    if (!curDate && meetingDate) {
      patchProps["日付"] = { date: { start: meetingDate } };
      patchKeys.push("date");
    }

    const curPjRelIds = _meeting_backfillRelationIds_(page, "PJ");
    if (curPjRelIds.length === 0) {
      const projectName = String(_meeting_resolveProjectName_(projectId) || "").trim();
      const pjPageId = (projectName && pjMap[projectName]) ? pjMap[projectName] : (pjMap[projectId] || "");
      if (pjPageId) {
        patchProps["PJ"] = { relation: [{ id: pjPageId }] };
        patchKeys.push("PJ");
      } else {
        skipReasons.push("pj_page_unresolved");
      }
    }

    const memberProp = _meeting_backfillPickMemberProp_(page, memberPropConfigured);
    if (memberProp && defaultMemberPageId) {
      const curMemberIds = _meeting_backfillRelationIds_(page, memberProp);
      if (curMemberIds.indexOf(defaultMemberPageId) < 0) {
        const nextMemberIds = curMemberIds.concat([defaultMemberPageId]).map(function (id) { return { id: id }; });
        patchProps[memberProp] = { relation: nextMemberIds };
        patchKeys.push("member");
      }
    } else if (!memberProp) {
      skipReasons.push("member_prop_unresolved");
    } else if (!defaultMemberPageId) {
      skipReasons.push("default_member_missing");
    }

    if (conflictKeys.length > 0) {
      counts.conflicts++;
      items.push(_meeting_backfillItem_(row, "conflict_no_patch", { conflictKeys: conflictKeys }));
      continue;
    }

    if (patchKeys.length === 0) {
      counts.skipped++;
      items.push(_meeting_backfillItem_(row, "skipped_no_empty_fields", { skipReasons: skipReasons }));
      continue;
    }

    if (patchKeys.indexOf("eventId") >= 0) counts.eventIdFilled++;
    if (patchKeys.indexOf("date") >= 0) counts.dateFilled++;
    if (patchKeys.indexOf("PJ") >= 0) counts.pjFilled++;
    if (patchKeys.indexOf("member") >= 0) counts.memberFilled++;

    if (dryRun) {
      counts.wouldPatch++;
      items.push(_meeting_backfillItem_(row, "dryrun_would_patch", { patchKeys: patchKeys, skipReasons: skipReasons }));
      continue;
    }

    try {
      _notion_fetch_(notionToken, "https://api.notion.com/v1/pages/" + encodeURIComponent(pageId), "patch", { properties: patchProps });
      counts.patched++;
      items.push(_meeting_backfillItem_(row, "patched", { patchKeys: patchKeys, skipReasons: skipReasons }));
    } catch (e2) {
      counts.errors++;
      items.push(_meeting_backfillItem_(row, "error_patch", { patchKeys: patchKeys, message: _meeting_backfillShortError_(e2) }));
    }
  }

  return {
    ok: true,
    dryRun: dryRun,
    sinceDays: sinceDays,
    limit: limit,
    offset: offset,
    projectIdFilter: projectIdFilter,
    fetchedRows: rows.length,
    scanned: counts.scanned,
    eligible: counts.eligible,
    wouldPatch: counts.wouldPatch,
    patched: counts.patched,
    eventIdFilled: counts.eventIdFilled,
    dateFilled: counts.dateFilled,
    pjFilled: counts.pjFilled,
    memberFilled: counts.memberFilled,
    conflicts: counts.conflicts,
    skipped: counts.skipped,
    errors: counts.errors,
    items: items
  };
}

/**
 * 既存ドキュメントで名前が先行していた関数名。
 * 今後は metadata backfill の thin wrapper として維持する。
 */
function nav_meeting_backfillMinutesDefaultMember_(opts) {
  return nav_meeting_backfillMinutesMetadataFromSummaries_(opts || {});
}

function _meeting_backfillFetchSummaryRows_(opts) {
  opts = opts || {};
  const sp = _supa_props_();
  const params = [];
  params.push("select=" + encodeURIComponent("meeting_id,calendar_event_id,project_id,title,meeting_start_at,meeting_date,notion_page_id,source_kinds,updated_at"));
  params.push("notion_page_id=not.is.null");
  if (opts.sinceISO) params.push("meeting_start_at=gte." + encodeURIComponent(opts.sinceISO));
  if (opts.nowISO) params.push("meeting_start_at=lte." + encodeURIComponent(opts.nowISO));
  if (opts.projectIdFilter) params.push("project_id=eq." + encodeURIComponent(opts.projectIdFilter));
  params.push("order=" + encodeURIComponent("meeting_start_at.desc"));
  params.push("limit=" + Number(opts.limit || 100));
  params.push("offset=" + Number(opts.offset || 0));
  const endpoint = sp.url + "/rest/v1/project_meeting_summaries?" + params.join("&");
  const res = UrlFetchApp.fetch(endpoint, {
    method: "get",
    headers: { "apikey": sp.key, "Authorization": "Bearer " + sp.key },
    muteHttpExceptions: true
  });
  const status = res.getResponseCode();
  const text = res.getContentText();
  if (status < 200 || status >= 300) {
    return { ok: false, status: status, message: "summary rows query failed", body: text };
  }
  let rows = [];
  try { rows = JSON.parse(text); } catch (e) { rows = []; }
  return { ok: true, status: status, rows: rows };
}

function _meeting_backfillExtractEventId_(page) {
  if (typeof _meeting_extractEventIdFromPage_ === "function") return String(_meeting_extractEventIdFromPage_(page) || "").trim();
  try {
    const pr = page && page.properties ? page.properties["eventId"] : null;
    if (pr && pr.type === "rich_text" && Array.isArray(pr.rich_text)) {
      return pr.rich_text.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("").trim();
    }
  } catch (e) {}
  return "";
}

function _meeting_backfillExtractDate_(page) {
  if (typeof _meeting_extractDateStartFromPage_ === "function") return String(_meeting_extractDateStartFromPage_(page) || "").trim();
  try {
    const pr = page && page.properties ? page.properties["日付"] : null;
    if (pr && pr.type === "date" && pr.date && pr.date.start) return String(pr.date.start || "").trim();
  } catch (e) {}
  return "";
}

function _meeting_backfillRelationIds_(page, propName) {
  try {
    const pr = page && page.properties ? page.properties[propName] : null;
    if (pr && pr.type === "relation" && Array.isArray(pr.relation)) {
      return pr.relation.map(function (r) { return String(r && r.id ? r.id : "").trim(); }).filter(function (id) { return !!id; });
    }
  } catch (e) {}
  return [];
}

function _meeting_backfillPickMemberProp_(page, configured) {
  const props = page && page.properties ? page.properties : {};
  const candidates = [];
  if (configured) candidates.push(configured);
  candidates.push("メンバー");
  candidates.push("参加メンバー");
  for (let i = 0; i < candidates.length; i++) {
    const name = candidates[i];
    const pr = props ? props[name] : null;
    if (pr && pr.type === "relation") return name;
  }
  return "";
}

function _meeting_backfillDatePart_(v) {
  const s = String(v || "").trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

function _meeting_backfillSafeTitle_(v) {
  let s = String(v || "").replace(/\s+/g, " ").trim();
  if (s.length > 80) s = s.slice(0, 77) + "...";
  return s;
}

function _meeting_backfillItem_(row, action, extra) {
  extra = extra || {};
  const out = {
    action: action,
    title: _meeting_backfillSafeTitle_(row && row.title ? row.title : ""),
    meetingDate: _meeting_backfillDatePart_(row && (row.meeting_date || row.meeting_start_at) ? (row.meeting_date || row.meeting_start_at) : ""),
    projectId: String(row && row.project_id ? row.project_id : "").trim()
  };
  const keys = Object.keys(extra);
  for (let i = 0; i < keys.length; i++) out[keys[i]] = extra[keys[i]];
  return out;
}

function _meeting_backfillShortError_(e) {
  const s = String(e && e.message ? e.message : e || "").replace(/\s+/g, " ").trim();
  return s.length > 180 ? s.slice(0, 177) + "..." : s;
}
