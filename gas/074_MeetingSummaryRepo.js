/** 074_MeetingSummaryRepo.gs — Phase 2
 *
 * 1 calendar event = 1 行 (PK: meeting_id = calendar event id)。
 * Notion 議事録本文 + Gmail 議事録メール (CircleBack 要約 / GMeet recording 通知 等) を
 * 結合して Gemini で summary_short + decided/progress/next_actions/risks を抽出し
 * Supabase project_meeting_summaries に upsert する。
 *
 * 仕様正本: pwa/design/meeting_summaries.md (Phase 2 セクション)
 *
 * ─────────────────────────────────────────────
 * 設計の要点 (Phase 1 から変わったところ)
 * ─────────────────────────────────────────────
 * 1. 主軸が calendar event。1 calendar event = 1 行。
 *    Notion 議事録 DB を月単位で query し、各ページの「eventId」プロパティ
 *    (= calendar event id) を meeting_id にする。
 *    Notion 議事録ページは別 cron `cron_createMinutesFromCalendar` (CalendarToNotionMinutes.js)
 *    が毎日 03:00 JST に「明日分の議事録枠」を自動生成済の前提。
 *
 * 2. 議事録ソースは複数:
 *    a) Notion ページ本文 (`nav_repo_notion_fetchPageBodyText` / 122)
 *    b) Gmail スレッド (`mr_extractFromGmail_` / 307)
 *       — DB_Projects.reportEmails (from/to filter) 経由で
 *         CircleBack 要約 / GMeet recording 通知 / クライアント往復メール 等を拾う。
 *
 * 3. Gmail は **daily cron 実行のたびに 1 回だけ** 月単位クエリで取って memory cache。
 *    各 calendar event ごとには呼ばない (GmailApp.search のコスト圧縮)。
 *    各 event については cache から「event 日 ±1日」の thread を pickup。
 *
 * 4. 議事録なし (Notion 本文も Gmail thread も空) の MTG は
 *    summary_short = "議事録なし" / items 全て空配列 / source_kinds = "none" で
 *    マーカー行として残す (UI が「議事録なし」表示する根拠)。
 *
 * 5. source_hash は (Notion 本文 + Gmail 結合テキスト) の sha256。
 *    変わってない議事録は Gemini call せずスキップ。
 *
 * ─────────────────────────────────────────────
 * 依存
 * ─────────────────────────────────────────────
 * - 073_NavigatorRepo.js: nav_repo_notion_queryMinutesByYmFull_
 * - 122_NotionBlocksRepo.js: nav_repo_notion_fetchPageBodyText
 * - 307_MonthlyReport_GmailExtract.js: mr_gmail_getProjectInfo_, mr_gmail_buildSearchQuery_
 * - 163_LlmRouter.js: llm_callJson (gemini provider)
 * - 092_AdminLLMExtractors.js: meeting_extract プロンプト (Protocol Store)
 * - 180_SupabaseClient.js: supa_upsert / supa_select
 * - NotionProtocolSync.js: _notion_extractRelationIds_, _notion_resolvePageTitleCached_,
 *                          _resolveAmdProjectIdByProjectNameOrCode_, _notion_extractPropertyText_
 */

// ============================================================
// 公開関数
// ============================================================

/**
 * 1 PJ × 1 ym 分の議事録を Phase 2 ロジックで抽出して Supabase に upsert。
 * GAS の 6 分実行制限を考慮して 1 回あたり最大 maxItems 件まで Gemini call。
 *
 * @param {string} projectId AMD projectId (例: "p21")
 * @param {string} ymKey yyyymm
 * @param {Object} [opts] {maxItems?: number}
 * @return {Object} {ok, processed, skipped, errors, items, hasMore, llmCalls, gmailThreads}
 */
function nav_meeting_extractForProjectYm_(projectId, ymKey, opts) {
  projectId = String(projectId || "").trim();
  ymKey = String(ymKey || "").trim();
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 8);
  if (!projectId) return { ok: false, message: "projectId empty" };
  if (!/^\d{6}$/.test(ymKey)) return { ok: false, message: "ymKey invalid" };

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok: false, message: "NOTION_DATABASE_ID missing" };

  // 1) Notion 議事録 DB から ym の該当ページを全件取得
  const pages = nav_repo_notion_queryMinutesByYmFull_(notionToken, notionDbRaw, ymKey);
  if (!pages || !pages.length) {
    return { ok: true, processed: 0, skipped: 0, errors: 0, items: [], message: "no pages in ym" };
  }

  // 2) PJ 解決して projectId に一致するページに絞る
  const filtered = [];
  for (const p of pages) {
    const pid = _meeting_resolveProjectIdFromPage_(notionToken, p);
    if (pid === projectId) filtered.push(p);
  }
  if (!filtered.length) {
    return { ok: true, processed: 0, skipped: 0, errors: 0, items: [], message: "no pages for project" };
  }

  // 3) 既存サマリ load (project_id+ym で取り、meeting_id Map を作る)
  const existingByMeetingId = _meeting_loadExistingForProjectYm_(projectId, ymKey);

  // 4) Gmail を 月単位で 1 度だけ取得 (memory cache)。GmailApp.search コスト圧縮。
  const ymStart = _meeting_ymToStartDate_(ymKey);
  const ymEnd = _meeting_ymToEndDate_(ymKey);
  let gmailCache = null;
  try {
    gmailCache = _meeting_loadGmailCacheForMonth_(projectId, ymStart, ymEnd);
  } catch (e) {
    gmailCache = { threads: [], note: "gmail load error: " + (e && e.message ? e.message : String(e)) };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let llmCalls = 0;
  let hasMore = false;
  const items = [];

  for (const p of filtered) {
    const pageId = String(p && p.id ? p.id : "").trim();
    if (!pageId) continue;

    // 5) calendar event id を取得 (meeting_id PK の値)
    const eventId = _meeting_extractEventIdFromPage_(p);
    if (!eventId) {
      // eventId プロパティが空 = 古い議事録 (CalendarToNotionMinutes 導入前 or 手動作成) → skip
      items.push({ notionPageId: pageId, action: "skipped_no_event_id" });
      skipped++;
      continue;
    }

    try {
      // 6) Notion 本文 (props 「内容」 + blocks)
      let propText = "";
      let blockText = "";
      try {
        if (typeof _notion_extractPropertyText_ === "function") {
          propText = String(_notion_extractPropertyText_(p, "内容") || "").trim();
        }
      } catch (_e1) {}
      try {
        blockText = String(nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 20000 }) || "").trim();
      } catch (_e2) {}
      // AI 自動生成議事録ページ (transcription block 構造) の本文も結合
      let aiText = "";
      try {
        aiText = String(_meeting_fetchAiNotesBody_(notionToken, pageId, { maxChars: 18000 }) || "").trim();
      } catch (_e3) {}
      const notionText = [propText, blockText, aiText]
        .filter(function (s) { return s && s.length > 0; })
        .join("\n\n")
        .trim();

      // 7) Calendar event 日付
      const dateStart = _meeting_extractDateStartFromPage_(p);
      const meetingDate = dateStart && /^\d{4}-\d{2}-\d{2}/.test(dateStart)
        ? dateStart.slice(0, 10)
        : (ymKey.slice(0, 4) + "-" + ymKey.slice(4, 6) + "-01");
      const meetingStartAt = dateStart && /T/.test(dateStart) ? dateStart : null;

      // 8) Gmail cache から「event 日 ±1日」の thread を pickup
      const relevantThreads = _meeting_pickRelevantGmailThreads_(gmailCache.threads, meetingDate);
      const gmailText = _meeting_formatGmailThreadsForLLM_(relevantThreads);
      const gmailThreadIds = relevantThreads.map(function (t) { return t.threadId; });

      // 9) source_kinds 判定
      const hasNotion = notionText.length >= 30;
      const hasGmail = gmailText.length >= 30;
      const sourceKinds = hasNotion && hasGmail
        ? "notion+gmail"
        : hasNotion ? "notion"
          : hasGmail ? "gmail"
            : "none";

      const title = _meeting_extractTitleFromPage_(p) || "MTG";
      const notionUrl = String(p && p.url ? p.url : "").trim();

      // 10) 議事録なしケース: マーカー行として upsert (Gemini 呼ばない)
      if (sourceKinds === "none") {
        const noneHash = _meeting_sha256_("none|" + meetingDate + "|" + title);
        const existing = existingByMeetingId[eventId];
        if (existing && String(existing.source_hash || "") === noneHash) {
          items.push({ meetingId: eventId, action: "skipped_none_unchanged" });
          skipped++;
          continue;
        }
        const row = {
          meeting_id: eventId,
          project_id: projectId,
          ym: ymKey,
          meeting_date: meetingDate,
          meeting_start_at: meetingStartAt,
          title: title,
          notion_url: notionUrl || null,
          notion_page_id: pageId,
          calendar_event_id: eventId,
          gmail_thread_ids: [],
          source_kinds: "none",
          summary_short: "議事録なし",
          decided: [],
          progress: [],
          next_actions: [],
          risks: [],
          source_hash: noneHash,
          generated_at: new Date().toISOString(),
          generated_by_model: null
        };
        const upRes = supa_upsert("project_meeting_summaries", row, "meeting_id");
        if (upRes.ok) {
          items.push({ meetingId: eventId, action: existing ? "updated_none" : "inserted_none", title: title });
          processed++;
        } else {
          items.push({ meetingId: eventId, action: "error_upsert_none", status: upRes.status, body: String(upRes.body || "").slice(0, 300) });
          errors++;
        }
        continue;
      }

      // 11) 結合テキスト + sha256 で差分検知
      const combinedText = [
        hasNotion ? "=== notion ===\n" + notionText : "",
        hasGmail ? "=== gmail ===\n" + gmailText : ""
      ].filter(function (s) { return s.length > 0; }).join("\n\n").trim();
      // prompt rev + feedback hash を入力に混ぜる → 修正依頼追加で hash 不一致 → 自動再抽出
      const fbHashInput = _meeting_feedbackHashInput_(projectId, eventId);
      const newHash = _meeting_sha256_("rev=" + MEETING_EXTRACT_PROMPT_REV + "\nfb=" + fbHashInput + "\n" + combinedText);
      const existing = existingByMeetingId[eventId];
      if (existing && String(existing.source_hash || "") === newHash) {
        items.push({ meetingId: eventId, action: "skipped_unchanged" });
        skipped++;
        continue;
      }

      // 12) 6 分制限避け: LLM コール回数で制限 (差分検知ヒット後に判定して無駄カウントを避ける)
      if (maxItems > 0 && llmCalls >= maxItems) {
        hasMore = true;
        items.push({ meetingId: eventId, action: "deferred_maxItems" });
        continue;
      }

      // 13) Gemini 抽出
      llmCalls++;
      const extracted = _meeting_extractWithLLM_(combinedText, {
        projectId: projectId, ymKey: ymKey, sourceKinds: sourceKinds,
        meetingTitle: title, meetingDate: meetingDate, meetingId: eventId
      });
      if (!extracted) {
        items.push({ meetingId: eventId, action: "error_llm" });
        errors++;
        continue;
      }

      // 14) upsert
      const row = {
        meeting_id: eventId,
        project_id: projectId,
        ym: ymKey,
        meeting_date: meetingDate,
        meeting_start_at: meetingStartAt,
        title: title,
        notion_url: notionUrl || null,
        notion_page_id: pageId,
        calendar_event_id: eventId,
        gmail_thread_ids: gmailThreadIds,
        source_kinds: sourceKinds,
        summary_short: String(extracted.summary_short || ""),
        decided: Array.isArray(extracted.decided) ? extracted.decided : [],
        progress: Array.isArray(extracted.progress) ? extracted.progress : [],
        next_actions: Array.isArray(extracted.next_actions) ? extracted.next_actions : [],
        risks: Array.isArray(extracted.risks) ? extracted.risks : [],
        source_hash: newHash,
        generated_at: new Date().toISOString(),
        generated_by_model: "gemini-2.5-flash"
      };
      const upRes = supa_upsert("project_meeting_summaries", row, "meeting_id");
      if (upRes.ok) {
        items.push({
          meetingId: eventId, action: existing ? "updated" : "inserted",
          title: title, sourceKinds: sourceKinds, gmailThreads: gmailThreadIds.length
        });
        processed++;
      } else {
        items.push({ meetingId: eventId, action: "error_upsert", status: upRes.status, body: String(upRes.body || "").slice(0, 300) });
        errors++;
      }
    } catch (e) {
      items.push({ meetingId: eventId, action: "error_exception", message: String(e && e.message ? e.message : e) });
      errors++;
    }
  }

  return {
    ok: true,
    processed: processed,
    skipped: skipped,
    errors: errors,
    hasMore: hasMore,
    llmCalls: llmCalls,
    gmailThreads: gmailCache ? (gmailCache.threads || []).length : 0,
    gmailNote: gmailCache && gmailCache.note ? gmailCache.note : "",
    items: items
  };
}

/**
 * 1 calendar event をピンポイントで抽出して Supabase upsert。
 * 153_MeetingHourlyTrigger.js の trigger callback から呼ばれる
 * (会議終了 60 分後に 1 event だけを処理する Phase 3 ロジック)。
 *
 * @param {string} eventId calendar event id
 * @param {string} [projectId] (任意) PJ id がわかってれば渡す。無ければ Notion 議事録ページから resolve
 * @return {Object} {ok, action, sourceKinds, meetingId, title, projectId, message?}
 */
function nav_meeting_processOneEvent_(eventId, projectId) {
  eventId = String(eventId || "").trim();
  if (!eventId) return { ok: false, message: "eventId empty" };

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok: false, message: "NOTION_DATABASE_ID missing" };

  // 1) Notion 議事録 DB から eventId プロパティ equals でページを 1 件取得
  //    + 内容薄ければ「同日付・タイトル類似」の fallback ページに切替
  let primaryPage = _meeting_findNotionPageByEventId_(notionToken, notionDbRaw, eventId);
  if (primaryPage) {
    const dateStartTmp = _meeting_extractDateStartFromPage_(primaryPage);
    const meetingDateTmp = dateStartTmp && /^\d{4}-\d{2}-\d{2}/.test(dateStartTmp) ? dateStartTmp.slice(0, 10) : "";
    const titleTmp = _meeting_extractTitleFromPage_(primaryPage) || "";
    if (meetingDateTmp) {
      const better = _meeting_findNotionPageByEventId_(notionToken, notionDbRaw, eventId, {
        meetingDate: meetingDateTmp,
        titleHint: titleTmp.replace(/\s*<mention-date.*$/, "").replace(/\s*@今日.*$/, "").replace(/\s+\d{1,2}:\d{2}.*$/, "").trim()
      });
      if (better) primaryPage = better;
    }
  }
  const page = primaryPage;
  if (!page) {
    return { ok: false, action: "notion_page_not_found", eventId: eventId };
  }
  const pageId = String(page.id || "").trim();

  // 2) projectId 解決 (引数優先、無ければ Notion ページから resolve)
  let pid = String(projectId || "").trim();
  if (!pid) {
    pid = _meeting_resolveProjectIdFromPage_(notionToken, page);
  }
  if (!pid) {
    return { ok: false, action: "project_id_unresolved", eventId: eventId, pageId: pageId };
  }

  // 3) Notion 本文 (props 「内容」 + blocks)
  let propText = "";
  let blockText = "";
  try {
    if (typeof _notion_extractPropertyText_ === "function") {
      propText = String(_notion_extractPropertyText_(page, "内容") || "").trim();
    }
  } catch (_e1) {}
  try {
    blockText = String(nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 20000 }) || "").trim();
  } catch (_e2) {}
  // AI 自動生成議事録ページ (transcription block 構造) の本文も結合
  let aiText = "";
  try {
    aiText = String(_meeting_fetchAiNotesBody_(notionToken, pageId, { maxChars: 18000 }) || "").trim();
  } catch (_e3) {}
  const notionText = [propText, blockText, aiText]
    .filter(function (s) { return s && s.length > 0; })
    .join("\n\n")
    .trim();

  // 4) Calendar event 日付
  const dateStart = _meeting_extractDateStartFromPage_(page);
  const meetingDate = dateStart && /^\d{4}-\d{2}-\d{2}/.test(dateStart)
    ? dateStart.slice(0, 10)
    : Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  const meetingStartAt = dateStart && /T/.test(dateStart) ? dateStart : null;
  const ymKey = meetingDate.slice(0, 4) + meetingDate.slice(5, 7);

  // 5) Gmail を「会議日 ±1 日」だけクエリ (1 event 用なので狭い範囲で十分)
  const gmailWindowStart = new Date(new Date(meetingDate + "T00:00:00+09:00").getTime() - 24 * 60 * 60 * 1000);
  const gmailWindowEnd = new Date(new Date(meetingDate + "T00:00:00+09:00").getTime() + 2 * 24 * 60 * 60 * 1000);
  let gmailCache = { threads: [] };
  try {
    gmailCache = _meeting_loadGmailCacheForMonth_(pid, gmailWindowStart, gmailWindowEnd);
  } catch (e) {
    gmailCache = { threads: [], note: "gmail load error: " + (e && e.message ? e.message : String(e)) };
  }
  const relevantThreads = _meeting_pickRelevantGmailThreads_(gmailCache.threads, meetingDate);
  const gmailText = _meeting_formatGmailThreadsForLLM_(relevantThreads);
  const gmailThreadIds = relevantThreads.map(function (t) { return t.threadId; });

  // 6) source_kinds 判定
  const hasNotion = notionText.length >= 30;
  const hasGmail = gmailText.length >= 30;
  const sourceKinds = hasNotion && hasGmail
    ? "notion+gmail"
    : hasNotion ? "notion"
      : hasGmail ? "gmail"
        : "none";

  const title = _meeting_extractTitleFromPage_(page) || "MTG";
  const notionUrl = String(page && page.url ? page.url : "").trim();

  // 7) 既存サマリ取得 (差分検知)
  const existing = _meeting_loadOneByMeetingId_(eventId);

  // 8) 議事録なしケース
  if (sourceKinds === "none") {
    const noneHash = _meeting_sha256_("none|" + meetingDate + "|" + title);
    if (existing && String(existing.source_hash || "") === noneHash) {
      return { ok: true, action: "skipped_none_unchanged", meetingId: eventId, title: title, projectId: pid };
    }
    const row = {
      meeting_id: eventId,
      project_id: pid,
      ym: ymKey,
      meeting_date: meetingDate,
      meeting_start_at: meetingStartAt,
      title: title,
      notion_url: notionUrl || null,
      notion_page_id: pageId,
      calendar_event_id: eventId,
      gmail_thread_ids: [],
      source_kinds: "none",
      summary_short: "議事録なし",
      decided: [],
      progress: [],
      next_actions: [],
      risks: [],
      source_hash: noneHash,
      generated_at: new Date().toISOString(),
      generated_by_model: null
    };
    const upRes = supa_upsert("project_meeting_summaries", row, "meeting_id");
    if (!upRes.ok) {
      return { ok: false, action: "error_upsert_none", status: upRes.status, body: String(upRes.body || "").slice(0, 300), meetingId: eventId };
    }
    return { ok: true, action: existing ? "updated_none" : "inserted_none", meetingId: eventId, title: title, projectId: pid, sourceKinds: "none" };
  }

  // 9) 結合 + sha256 (prompt rev + feedback hash を混ぜる → 修正依頼追加で自動再抽出)
  const combinedText = [
    hasNotion ? "=== notion ===\n" + notionText : "",
    hasGmail ? "=== gmail ===\n" + gmailText : ""
  ].filter(function (s) { return s.length > 0; }).join("\n\n").trim();
  const fbHashInput = _meeting_feedbackHashInput_(pid, eventId);
  const newHash = _meeting_sha256_("rev=" + MEETING_EXTRACT_PROMPT_REV + "\nfb=" + fbHashInput + "\n" + combinedText);
  if (existing && String(existing.source_hash || "") === newHash) {
    return { ok: true, action: "skipped_unchanged", meetingId: eventId, title: title, projectId: pid, sourceKinds: sourceKinds };
  }

  // 10) Gemini 抽出
  const extracted = _meeting_extractWithLLM_(combinedText, {
    projectId: pid, ymKey: ymKey, sourceKinds: sourceKinds,
    meetingTitle: title, meetingDate: meetingDate, meetingId: eventId
  });
  if (!extracted) {
    return { ok: false, action: "error_llm", meetingId: eventId, title: title, projectId: pid };
  }

  // 11) upsert
  const row = {
    meeting_id: eventId,
    project_id: pid,
    ym: ymKey,
    meeting_date: meetingDate,
    meeting_start_at: meetingStartAt,
    title: title,
    notion_url: notionUrl || null,
    notion_page_id: pageId,
    calendar_event_id: eventId,
    gmail_thread_ids: gmailThreadIds,
    source_kinds: sourceKinds,
    summary_short: String(extracted.summary_short || ""),
    decided: Array.isArray(extracted.decided) ? extracted.decided : [],
    progress: Array.isArray(extracted.progress) ? extracted.progress : [],
    next_actions: Array.isArray(extracted.next_actions) ? extracted.next_actions : [],
    risks: Array.isArray(extracted.risks) ? extracted.risks : [],
    source_hash: newHash,
    generated_at: new Date().toISOString(),
    generated_by_model: "gemini-2.5-flash"
  };
  const upRes = supa_upsert("project_meeting_summaries", row, "meeting_id");
  if (!upRes.ok) {
    return { ok: false, action: "error_upsert", status: upRes.status, body: String(upRes.body || "").slice(0, 300), meetingId: eventId };
  }
  return {
    ok: true,
    action: existing ? "updated" : "inserted",
    meetingId: eventId,
    title: title,
    projectId: pid,
    sourceKinds: sourceKinds,
    gmailThreads: gmailThreadIds.length,
    summaryShort: row.summary_short
  };
}

/**
 * 1 PJ × 複数 ym のバックフィル (Phase 2)。
 * 各 ym で hasMore の限り再呼び (差分検知あるので何度繰り返してもムダにならない)。
 *
 * @param {string} projectId
 * @param {string[]} ymList
 * @param {Object} [opts] {maxItems?: number, retryHasMore?: boolean}
 */
function nav_meeting_backfillForProject_(projectId, ymList, opts) {
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 5);
  const retryHasMore = opts.retryHasMore !== false;
  const out = { ok: true, projectId: projectId, results: [] };
  if (!Array.isArray(ymList)) return { ok: false, message: "ymList not array" };

  for (const ym of ymList) {
    let totalProcessed = 0, totalSkipped = 0, totalErrors = 0, calls = 0, finalHasMore = false;
    let lastMessage = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 8;
    do {
      attempts++;
      let r;
      try {
        r = nav_meeting_extractForProjectYm_(projectId, ym, { maxItems: maxItems });
      } catch (e) {
        r = { ok: false, message: String(e && e.message ? e.message : e) };
      }
      calls++;
      totalProcessed += (r.processed || 0);
      totalSkipped += (r.skipped || 0);
      totalErrors += (r.errors || 0);
      finalHasMore = !!r.hasMore;
      lastMessage = r.message || "";
      if (!r.ok) break;
    } while (retryHasMore && finalHasMore && attempts < MAX_ATTEMPTS);

    out.results.push({
      ym: ym, calls: calls,
      processed: totalProcessed, skipped: totalSkipped, errors: totalErrors,
      hasMore: finalHasMore, message: lastMessage
    });
  }
  return out;
}

// ============================================================
// 内部 helper
// ============================================================

function _meeting_resolveProjectIdFromPage_(notionToken, pageObj) {
  if (typeof _notion_extractRelationIds_ === "function" &&
      typeof _notion_resolvePageTitleCached_ === "function" &&
      typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function") {
    const relIds = _notion_extractRelationIds_(pageObj, "PJ");
    if (relIds && relIds.length) {
      const pjName = String(_notion_resolvePageTitleCached_(notionToken, relIds[0]) || "").trim();
      if (pjName) {
        const pid = String(_resolveAmdProjectIdByProjectNameOrCode_(pjName) || "").trim();
        if (pid) return pid;
      }
    }
  }
  const title = _meeting_extractTitleFromPage_(pageObj);
  if (title && typeof _resolveAmdProjectIdByProjectNameOrCode_ === "function") {
    const pid = String(_resolveAmdProjectIdByProjectNameOrCode_(title) || "").trim();
    if (pid) return pid;
  }
  return "";
}

function _meeting_extractTitleFromPage_(p) {
  try {
    const props = (p && p.properties) ? p.properties : {};
    const keys = Object.keys(props || {});
    for (let i = 0; i < keys.length; i++) {
      const prop = props[keys[i]];
      if (prop && prop.type === "title" && Array.isArray(prop.title)) {
        const t = prop.title.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("").trim();
        if (t) return t;
      }
    }
  } catch (e) {}
  return "";
}

function _meeting_extractDateStartFromPage_(p) {
  let dateProp = "日付";
  try {
    const props = PropertiesService.getScriptProperties();
    dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim() || "日付";
  } catch (e) {}
  try {
    const pp = (p && p.properties) ? p.properties : {};
    const pr = pp && pp[dateProp] ? pp[dateProp] : null;
    if (pr && pr.type === "date" && pr.date && pr.date.start) {
      return String(pr.date.start || "").trim();
    }
  } catch (e) {}
  return "";
}

/** Notion 議事録ページから eventId プロパティ (= calendar event id) を取り出す */
function _meeting_extractEventIdFromPage_(p) {
  try {
    const pp = (p && p.properties) ? p.properties : {};
    const pr = pp && pp["eventId"] ? pp["eventId"] : null;
    if (!pr || !pr.type) return "";
    if (pr.type === "rich_text" && Array.isArray(pr.rich_text)) {
      return pr.rich_text.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("").trim();
    }
    if (pr.type === "title" && Array.isArray(pr.title)) {
      return pr.title.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("").trim();
    }
    return "";
  } catch (e) { return ""; }
}

/** project_id から表示用 project_name を取得 (memo cache) */
const _meeting_pjNameCache = {};
function _meeting_resolveProjectName_(projectId) {
  projectId = String(projectId || "").trim();
  if (!projectId) return "";
  if (_meeting_pjNameCache[projectId]) return _meeting_pjNameCache[projectId];
  try {
    const res = supa_select("projects", {
      select: "project_id,project_name",
      filter: "project_id=eq." + encodeURIComponent(projectId),
      limit: 1
    });
    const name = res.ok && res.rows && res.rows[0] && res.rows[0].project_name ? res.rows[0].project_name : projectId;
    _meeting_pjNameCache[projectId] = name;
    return name;
  } catch (_e) { return projectId; }
}

/** prompt revision identifier (= source_hash の入力に混ぜて prompt 改訂時に全行再抽出を保証) */
const MEETING_EXTRACT_PROMPT_REV = "v4_alias_feedback";

/** meeting_summary 用 feedback hash 入力 (active feedback の id+text を hash 化、feedback 追加で source_hash 変わる) */
function _meeting_feedbackHashInput_(projectId, eventId) {
  if (typeof supa_select !== "function" || !projectId) return "";
  const filter = "l2_kind=eq.meeting_summary&target_id=eq." + encodeURIComponent(String(projectId)) +
                 "&status=eq.active";
  const res = supa_select("l2_feedbacks", {
    select: "feedback_id,scope_key,feedback_text,created_at",
    filter: filter,
    order: "created_at.desc",
    limit: 30
  });
  if (!res.ok || !res.rows || !res.rows.length) return "";
  const rows = res.rows.filter(function (r) {
    return r.scope_key === eventId || r.scope_key === "global";
  });
  if (!rows.length) return "";
  return rows.map(function (r) { return r.feedback_id + "|" + (r.feedback_text || ""); }).join("\n");
}

function _meeting_sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const v = (b < 0) ? (b + 256) : b;
    const h = v.toString(16);
    return h.length === 1 ? ("0" + h) : h;
  }).join("");
}

/**
 * Notion 議事録 DB から calendar event に対応するページを 1 件取得。
 *
 * 2026-05-09 (まさ判断 + cron テンプレ生成停止後の簡素化版):
 *   `cron_createMinutesFromCalendar` (= run_createMinutes_apply) は trigger 削除済で
 *   今後は Notion AI / Meet 連携の議事録ページのみが議事録 DB に並ぶ。
 *   AI ページは eventId プロパティが空のままなので、検索は:
 *     1) eventId equals (= 過去に cron テンプレが残ってる場合のみヒット)
 *     2) タイトル contains + 日付 equals (= AI ページを拾う)
 *   候補集合を **last_edited_time 降順** で並べ、先頭 (= 最新更新) を返す。
 *   cron テンプレと AI ページが両方あれば、後で更新された AI ページが選ばれる。
 *
 * @param {string} notionToken
 * @param {string} notionDbRaw
 * @param {string} eventId
 * @param {Object} [opts] {meetingDate?: 'YYYY-MM-DD', titleHint?: string}
 */
function _meeting_findNotionPageByEventId_(notionToken, notionDbRaw, eventId, opts) {
  opts = opts || {};
  if (typeof _notion_normId_ !== "function") return null;
  const dbId = _notion_normId_(notionDbRaw);
  if (!dbId) return null;
  const url = "https://api.notion.com/v1/databases/" + dbId + "/query";

  let dateProp = "日付";
  try {
    const props = PropertiesService.getScriptProperties();
    dateProp = String(props.getProperty("NOTION_MINUTES_DATE_PROP") || "日付").trim() || "日付";
  } catch (e) {}

  const candidates = [];
  const seenIds = {};
  const addCandidates = function (results) {
    for (const r of (results || [])) {
      const id = String(r.id || "");
      if (id && !seenIds[id]) { seenIds[id] = true; candidates.push(r); }
    }
  };

  // 1) eventId equals (= 旧 cron テンプレが残ってる場合に取れる)
  try {
    const res = _notion_fetch_(notionToken, url, "post", {
      filter: { property: "eventId", rich_text: { equals: String(eventId) } },
      page_size: 5
    });
    addCandidates(res && res.results);
  } catch (_e) {}

  // 2) タイトル contains (= AI 自動生成ページを拾う、eventId 空でも OK)
  if (opts.titleHint) {
    try {
      const res = _notion_fetch_(notionToken, url, "post", {
        filter: { property: "名前", title: { contains: String(opts.titleHint) } },
        page_size: 10
      });
      addCandidates(res && res.results);
    } catch (_e) {}
  }

  // 3) 同日付 (= cron テンプレや 日付プロパティ入りのページ)
  if (opts.meetingDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.meetingDate)) {
    try {
      const res = _notion_fetch_(notionToken, url, "post", {
        filter: { property: dateProp, date: { equals: opts.meetingDate } },
        page_size: 10
      });
      addCandidates(res && res.results);
    } catch (_e) {}
  }

  if (!candidates.length) return null;

  // last_edited_time 降順 (= 新しく更新されたページを優先 = AI ページ通常)
  candidates.sort(function (a, b) {
    const at = String(a.last_edited_time || a.created_time || "");
    const bt = String(b.last_edited_time || b.created_time || "");
    return bt.localeCompare(at);
  });

  Logger.log("[_meeting_findNotionPageByEventId_] eventId=" + eventId + " candidates=" + candidates.length +
    " selected=" + candidates[0].id + " last_edited=" + (candidates[0].last_edited_time || ""));

  return candidates[0];
}

/**
 * Notion AI 自動生成議事録ページの transcription block 内 summary + notes 本文を取得。
 * 標準 block (paragraph 等) のみ取得する nav_repo_notion_fetchPageBodyText では取れないため。
 *
 * 構造:
 *   page → blocks → 1 個の transcription type block →
 *     transcription.children.summary_block_id (= 別 block) → 中に heading/bulleted_list_item
 *     transcription.children.notes_block_id   (= 別 block) → 同様
 *     transcription.children.transcript_block_id → 重いので skip
 *
 * @param {string} notionToken
 * @param {string} pageId
 * @param {Object} [opts] {maxChars?: 8000}
 * @return {string} 結合本文 (空なら "")
 */
function _meeting_fetchAiNotesBody_(notionToken, pageId, opts) {
  opts = opts || {};
  const maxChars = Number(opts.maxChars || 8000);
  if (!pageId) return "";

  const blocksUrl = "https://api.notion.com/v1/blocks/" + encodeURIComponent(pageId) + "/children?page_size=100";
  let topRes;
  try {
    topRes = UrlFetchApp.fetch(blocksUrl, {
      method: "get",
      headers: { "Authorization": "Bearer " + notionToken, "Notion-Version": "2022-06-28" },
      muteHttpExceptions: true
    });
  } catch (_e) { return ""; }
  if (topRes.getResponseCode() < 200 || topRes.getResponseCode() >= 300) return "";
  let topBody;
  try { topBody = JSON.parse(topRes.getContentText()); } catch (_e) { return ""; }
  const topBlocks = (topBody && topBody.results) || [];

  let outText = "";
  let totalLen = 0;
  for (const b of topBlocks) {
    if (b && b.type === "transcription" && b.transcription && b.transcription.children) {
      const ids = [];
      if (b.transcription.children.summary_block_id) ids.push({ kind: "summary", id: b.transcription.children.summary_block_id });
      if (b.transcription.children.notes_block_id)   ids.push({ kind: "notes",   id: b.transcription.children.notes_block_id });
      // transcript_block_id は重いので skip (= 数千〜数万字)
      for (const ent of ids) {
        if (totalLen >= maxChars) break;
        const sub = _meeting_fetchBlockChildrenText_(notionToken, ent.id, maxChars - totalLen);
        if (sub) {
          outText += "\n\n=== " + ent.kind + " ===\n" + sub;
          totalLen += sub.length + 20;
        }
      }
    }
  }
  return outText.trim();
}

/** Notion API /blocks/{id}/children を読んで標準 block (heading/paragraph/bulleted_list_item 等) の plain_text を結合 */
function _meeting_fetchBlockChildrenText_(notionToken, blockId, maxChars) {
  if (!blockId) return "";
  const url = "https://api.notion.com/v1/blocks/" + encodeURIComponent(blockId) + "/children?page_size=100";
  let res;
  try {
    res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { "Authorization": "Bearer " + notionToken, "Notion-Version": "2022-06-28" },
      muteHttpExceptions: true
    });
  } catch (_e) { return ""; }
  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) return "";
  let body;
  try { body = JSON.parse(res.getContentText()); } catch (_e) { return ""; }
  const blocks = (body && body.results) || [];

  const lines = [];
  let total = 0;
  const extractRichText = function (rt) {
    if (!Array.isArray(rt)) return "";
    return rt.map(function (x) { return String(x && x.plain_text ? x.plain_text : ""); }).join("");
  };
  for (const b of blocks) {
    if (total >= maxChars) break;
    const t = b && b.type;
    let line = "";
    if (t === "paragraph" && b.paragraph) line = extractRichText(b.paragraph.rich_text);
    else if (t === "heading_1" && b.heading_1) line = "# " + extractRichText(b.heading_1.rich_text);
    else if (t === "heading_2" && b.heading_2) line = "## " + extractRichText(b.heading_2.rich_text);
    else if (t === "heading_3" && b.heading_3) line = "### " + extractRichText(b.heading_3.rich_text);
    else if (t === "heading_4" && b.heading_4) line = "#### " + extractRichText(b.heading_4.rich_text);
    else if (t === "bulleted_list_item" && b.bulleted_list_item) line = "- " + extractRichText(b.bulleted_list_item.rich_text);
    else if (t === "numbered_list_item" && b.numbered_list_item) line = "1. " + extractRichText(b.numbered_list_item.rich_text);
    else if (t === "to_do" && b.to_do) line = "- [ ] " + extractRichText(b.to_do.rich_text);
    else if (t === "quote" && b.quote) line = "> " + extractRichText(b.quote.rich_text);
    else if (t === "callout" && b.callout) line = extractRichText(b.callout.rich_text);
    if (line && line.trim()) {
      lines.push(line.trim());
      total += line.length + 1;
    }
  }
  return lines.join("\n");
}

/** Notion ページの本文長を概算 (props "内容" + 標準 blocks + AI transcription block の合計) */
function _meeting_estimatePageBodyLength_(notionToken, page) {
  let total = 0;
  try {
    if (typeof _notion_extractPropertyText_ === "function") {
      total += String(_notion_extractPropertyText_(page, "内容") || "").length;
    }
  } catch (_e) {}
  try {
    if (typeof nav_repo_notion_fetchPageBodyText === "function" && page && page.id) {
      const body = nav_repo_notion_fetchPageBodyText(notionToken, page.id, { maxChars: 3000 });
      total += String(body || "").length;
    }
  } catch (_e) {}
  // AI 自動生成議事録ページ対応
  try {
    if (page && page.id) {
      const aiBody = _meeting_fetchAiNotesBody_(String(PropertiesService.getScriptProperties().getProperty("NOTION_TOKEN") || ""), page.id, { maxChars: 3000 });
      total += String(aiBody || "").length;
    }
  } catch (_e) {}
  return total;
}

/** 1 meeting_id 用の既存サマリ取得 (差分検知用) */
function _meeting_loadOneByMeetingId_(meetingId) {
  const filter = "meeting_id=eq." + encodeURIComponent(meetingId);
  const res = supa_select("project_meeting_summaries", {
    select: "meeting_id,source_hash",
    filter: filter,
    limit: 1
  });
  if (!res.ok) return null;
  const rows = Array.isArray(res.rows) ? res.rows : [];
  return rows.length ? rows[0] : null;
}

function _meeting_loadExistingForProjectYm_(projectId, ymKey) {
  const map = {};
  const filter = "project_id=eq." + encodeURIComponent(projectId) + "&ym=eq." + encodeURIComponent(ymKey);
  const res = supa_select("project_meeting_summaries", {
    select: "meeting_id,source_hash",
    filter: filter
  });
  if (!res.ok) return map;
  const rows = Array.isArray(res.rows) ? res.rows : [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r.meeting_id) map[r.meeting_id] = { source_hash: r.source_hash };
  }
  return map;
}

function _meeting_ymToStartDate_(ymKey) {
  const y = Number(ymKey.slice(0, 4));
  const m = Number(ymKey.slice(4, 6));
  return new Date(y, m - 1, 1, 0, 0, 0);
}

function _meeting_ymToEndDate_(ymKey) {
  const y = Number(ymKey.slice(0, 4));
  const m = Number(ymKey.slice(4, 6));
  return new Date(y, m, 0, 23, 59, 59); // 当月末日 23:59:59
}

/**
 * Gmail を月単位で 1 回取得して memory cache 化。
 * 307 の mr_gmail_getProjectInfo_ / mr_gmail_buildSearchQuery_ を借りて
 * GmailApp.search → 各 thread の (firstAt, lastAt, subject, body) を抽出。
 *
 * @param {string} projectId
 * @param {Date} startDate
 * @param {Date} endDate
 * @return {Object} {threads: [{threadId, subject, from, firstAt:Date, lastAt:Date, bodyText}], note?}
 */
function _meeting_loadGmailCacheForMonth_(projectId, startDate, endDate) {
  if (typeof mr_gmail_getProjectInfo_ !== "function") {
    return { threads: [], note: "mr_gmail_getProjectInfo_ unavailable" };
  }
  const projectInfo = mr_gmail_getProjectInfo_(projectId);
  if (!projectInfo) return { threads: [], note: "project info missing" };
  if (!projectInfo.reportEmails || projectInfo.reportEmails.length === 0) {
    return { threads: [], note: "reportEmails empty" };
  }

  const query = mr_gmail_buildSearchQuery_(projectInfo, startDate, endDate);
  const rawThreads = GmailApp.search(query, 0, 200);
  const threads = [];
  const MAX_BODY = 4000; // 1 thread あたりの抜粋上限
  for (let i = 0; i < rawThreads.length; i++) {
    const t = rawThreads[i];
    let messages = [];
    try { messages = t.getMessages() || []; } catch (e) { messages = []; }
    if (!messages.length) continue;
    const first = messages[0];
    const last = messages[messages.length - 1];
    const subject = String(first.getSubject() || "").trim();
    const from = String(first.getFrom() || "").trim();
    const firstAt = first.getDate();
    const lastAt = last.getDate();

    // body は最大 5 messages × 各 800 字でまとめる (LLM トークン抑制)
    const bodyParts = [];
    let bodyTotal = 0;
    const MAX_PER_MSG = 800;
    for (let j = 0; j < Math.min(messages.length, 5); j++) {
      let raw = "";
      try { raw = String(messages[j].getPlainBody() || ""); } catch (e) { raw = ""; }
      const sender = String(messages[j].getFrom() || "");
      const date = messages[j].getDate();
      const snippet = raw.replace(/\s+/g, " ").trim().slice(0, MAX_PER_MSG);
      const piece = "[" + Utilities.formatDate(date, "Asia/Tokyo", "MM/dd HH:mm") + " " + sender + "] " + snippet;
      bodyParts.push(piece);
      bodyTotal += piece.length;
      if (bodyTotal >= MAX_BODY) break;
    }
    threads.push({
      threadId: String(t.getId() || ""),
      subject: subject,
      from: from,
      firstAt: firstAt,
      lastAt: lastAt,
      bodyText: bodyParts.join("\n\n")
    });
  }
  return { threads: threads };
}

/** Gmail thread のうち、event 日 ±1 日内に first or last message があるものを返す */
function _meeting_pickRelevantGmailThreads_(allThreads, meetingDateStr) {
  if (!allThreads || !allThreads.length) return [];
  const md = new Date(meetingDateStr + "T00:00:00+09:00");
  if (isNaN(md.getTime())) return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const lo = md.getTime() - dayMs;
  const hi = md.getTime() + 2 * dayMs; // 当日 + 翌日全部 = +2d (end-exclusive 風)
  const out = [];
  for (let i = 0; i < allThreads.length; i++) {
    const t = allThreads[i];
    const fa = t.firstAt instanceof Date ? t.firstAt.getTime() : 0;
    const la = t.lastAt instanceof Date ? t.lastAt.getTime() : 0;
    const inRange = (fa >= lo && fa < hi) || (la >= lo && la < hi);
    if (inRange) out.push(t);
  }
  return out;
}

/** Gemini に渡すための Gmail thread フォーマット */
function _meeting_formatGmailThreadsForLLM_(threads) {
  if (!threads || !threads.length) return "";
  const out = [];
  for (let i = 0; i < threads.length; i++) {
    const t = threads[i];
    const dateLabel = t.firstAt instanceof Date ? Utilities.formatDate(t.firstAt, "Asia/Tokyo", "MM/dd HH:mm") : "";
    out.push("--- mail [" + dateLabel + "] subject: " + (t.subject || "") + " ---\n" + (t.bodyText || ""));
  }
  return out.join("\n\n").trim();
}

/**
 * Gemini で 1 議事録 (combined text) → 構造化サマリ
 */
function _meeting_extractWithLLM_(combinedText, meta) {
  meta = meta || {};
  let baseText = "";
  try {
    const props = PropertiesService.getScriptProperties();
    const storeId = String(props.getProperty("PROTOCOL_STORE_SPREADSHEET_ID") || "").trim();
    if (storeId && typeof _pc_pickActiveExtractorPrompts_ === "function") {
      const picked = _pc_pickActiveExtractorPrompts_(storeId, {
        groupName: "meeting_extract",
        projectId: String(meta.projectId || ""),
        projectCode: "",
        genre: "",
        issueTags: []
      }, { groupName: "meeting_extract", maxAddons: 0 });
      if (picked && picked.base && picked.base.systemPrompt) {
        baseText = String(picked.base.systemPrompt || "").trim();
      }
    }
  } catch (e) {
    baseText = "";
  }

  if (!baseText && typeof meeting_extract_basePrompt_ === "function") {
    baseText = meeting_extract_basePrompt_();
  }
  if (!baseText) {
    throw new Error("meeting_extract prompt missing (run run_installMeetingExtractorConfig)");
  }

  // === v4_alias_feedback 拡張 ===
  // - meeting_meta セクション (BUGS.md 参照): 対象 PJ の唯一の正解
  // - alias block (BUGS.md 参照): 山田氏 = りょー 等の表記揺れマップ
  // - feedback block: まさからの修正依頼 (PWA /notifications で「つくよみに修正依頼」)
  const projectName = (typeof _meeting_resolveProjectName_ === "function")
    ? _meeting_resolveProjectName_(meta.projectId) : String(meta.projectId || "");
  const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";

  // 過去 feedback を取得 (l2_kind='meeting_summary', target_id=projectId, scope_key=meetingId or 'global')
  const eventId = String(meta.meetingId || "");
  let feedbackBlock = "";
  let feedbackIds = [];
  if (typeof _l2_loadFeedbackBlock_ === "function" && meta.projectId) {
    try {
      // 同 event 専用の feedback (scope_key=eventId) と、PJ 全体に効く feedback (scope_key='global') の両方を取る
      const fbEv = _l2_loadFeedbackBlock_("meeting_summary", String(meta.projectId), eventId || "global");
      if (fbEv && fbEv.block) {
        feedbackBlock = fbEv.block;
        feedbackIds = fbEv.ids || [];
      }
    } catch (_e) {}
  }

  const userPrompt = [
    "extractor: meeting_summary_v4_alias_feedback",
    "",
    "=== meeting_meta (これが対象 PJ の唯一の正解。これと無関係な内容は完全に無視) ===",
    "projectId: " + String(meta.projectId || ""),
    "projectName: " + String(projectName || ""),
    "meetingTitle: " + String(meta.meetingTitle || ""),
    "meetingDate: " + String(meta.meetingDate || ""),
    "meetingId: " + eventId,
    "ym: " + String(meta.ymKey || ""),
    "sourceKinds: " + String(meta.sourceKinds || ""),
    "",
    aliasBlock,
    "",
    feedbackBlock,
    "",
    "=== combined sources (notion + gmail) ===",
    String(combinedText || "")
  ].filter(function (s) { return s !== null && s !== undefined; }).join("\n");

  const parsed = llm_callJson("meeting_extract", baseText, userPrompt, { maxTokens: 2048, temperature: 0.2 });
  // feedback を反映できたら applied_count++
  if (parsed && feedbackIds.length && typeof _l2_recordFeedbackApplied_ === "function") {
    try { _l2_recordFeedbackApplied_(feedbackIds); } catch (_e) {}
  }
  if (!parsed || typeof parsed !== "object") return null;

  return {
    summary_short: String(parsed.summary_short || "").trim(),
    decided: _meeting_normStringArray_(parsed.decided),
    progress: _meeting_normStringArray_(parsed.progress),
    next_actions: _meeting_normStringArray_(parsed.next_actions),
    risks: _meeting_normStringArray_(parsed.risks)
  };
}

function _meeting_normStringArray_(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const s = String(v[i] == null ? "" : v[i]).trim();
    if (s) out.push(s);
  }
  return out;
}
