/** 074_MeetingSummaryRepo.gs
 *
 * 各 MTG 議事録 (Notion 1ページ) を Gemini で
 * summary_short + decided/progress/next_actions/risks に構造化して
 * Supabase project_meeting_summaries に upsert する。
 *
 * 仕様正本: pwa/design/meeting_summaries.md
 *
 * 既存の navigator_extract (月単位フラット抽出) とは別パイプで並走する。
 * 月単位抽出は廃止せず生かしたまま。R313 monthly_reports の
 * 「集約方式への書き換え」は AMD-Report GAS の別セッションで実施する。
 *
 * 依存:
 * - gas/180_SupabaseClient.js: supa_upsert / supa_select
 * - gas/163_LlmRouter.js: llm_callJson (gemini provider 対応)
 * - gas/092_AdminLLMExtractors.js: meeting_extract プロンプトを Protocol Store に登録済み
 * - gas/073_NavigatorRepo.js: nav_repo_notion_queryMinutesByYmFull_, nav_repo_notion_fetchPageBodyText
 */

// ============================================================
// 公開関数
// ============================================================

/**
 * 1 PJ × 1 ym 分の議事録を Gemini で抽出して Supabase に upsert。
 * GAS の 6 分実行制限を考慮して 1 回あたり最大 maxItems 件まで処理 (default 8)。
 * 残りは次回 cron 実行 or 同関数の再呼び出しで処理される (source_hash で重複スキップ)。
 *
 * @param {string} projectId AMD projectId (例: "p21")
 * @param {string} ymKey yyyymm
 * @param {Object} [opts] {maxItems?: number}
 * @return {Object} {ok, processed, skipped, errors, items, hasMore}
 */
function nav_meeting_extractForProjectYm_(projectId, ymKey, opts) {
  projectId = String(projectId || "").trim();
  ymKey = String(ymKey || "").trim();
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 8); // 0 だと無制限。GAS 6分制限避け
  if (!projectId) return { ok: false, message: "projectId empty" };
  if (!/^\d{6}$/.test(ymKey)) return { ok: false, message: "ymKey invalid" };

  const props = PropertiesService.getScriptProperties();
  const notionToken = String(props.getProperty("NOTION_TOKEN") || "").trim();
  const notionDbRaw = String(props.getProperty("NOTION_DATABASE_ID") || "").trim();
  if (!notionToken) return { ok: false, message: "NOTION_TOKEN missing" };
  if (!notionDbRaw) return { ok: false, message: "NOTION_DATABASE_ID missing" };

  // 1) Notion から ym の該当ページを全件取得
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

  // 3) 既存サマリを引いて source_hash を比較できるようにする
  //    (URL 長制限を避けるため meeting_id IN (...) ではなく project_id+ym で取る)
  const existingByMeetingId = _meeting_loadExistingForProjectYm_(projectId, ymKey);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let llmCalls = 0;
  let hasMore = false;
  const items = [];

  for (const p of filtered) {
    const pageId = String(p && p.id ? p.id : "").trim();
    if (!pageId) continue;

    // 6 分制限避け: LLM コール回数で制限
    if (maxItems > 0 && llmCalls >= maxItems) {
      hasMore = true;
      items.push({ meetingId: pageId, action: "deferred_maxItems" });
      continue;
    }

    try {
      // 本文取得: 「内容」プロパティ + blocks 本文 を **両方結合** して Gemini に渡す
      // (片方しか書かない運用も両方書く運用も拾えるように)
      let propText = "";
      let blockText = "";
      try {
        if (typeof _notion_extractPropertyText_ === "function") {
          propText = String(_notion_extractPropertyText_(p, "内容") || "").trim();
        }
      } catch (_e1) {}
      try {
        blockText = String(nav_repo_notion_fetchPageBodyText(notionToken, pageId, { maxChars: 12000 }) || "").trim();
      } catch (_e2) {}
      const minutesText = [propText, blockText].filter(function (s) { return s && s.length > 0; }).join("\n\n").trim();

      if (minutesText.length < 30) {
        items.push({ meetingId: pageId, action: "skipped_thin", textLen: minutesText.length });
        skipped++;
        continue;
      }

      const newHash = _meeting_sha256_(minutesText);
      const existing = existingByMeetingId[pageId];
      if (existing && String(existing.source_hash || "") === newHash) {
        items.push({ meetingId: pageId, action: "skipped_unchanged" });
        skipped++;
        continue;
      }

      // Gemini 抽出
      llmCalls++;
      const extracted = _meeting_extractWithLLM_(minutesText, { projectId, ymKey });
      if (!extracted) {
        items.push({ meetingId: pageId, action: "error_llm" });
        errors++;
        continue;
      }

      const title = _meeting_extractTitleFromPage_(p) || "MTG";
      const dateStart = _meeting_extractDateStartFromPage_(p);
      const meetingDate = dateStart && /^\d{4}-\d{2}-\d{2}/.test(dateStart)
        ? dateStart.slice(0, 10)
        : (ymKey.slice(0, 4) + "-" + ymKey.slice(4, 6) + "-01");
      const notionUrl = String(p && p.url ? p.url : "").trim();

      const row = {
        meeting_id: pageId,
        project_id: projectId,
        ym: ymKey,
        meeting_date: meetingDate,
        title: title,
        notion_url: notionUrl || null,
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
        items.push({ meetingId: pageId, action: existing ? "updated" : "inserted", title: title });
        processed++;
      } else {
        items.push({ meetingId: pageId, action: "error_upsert", status: upRes.status, body: String(upRes.body || "").slice(0, 300) });
        errors++;
      }
    } catch (e) {
      items.push({ meetingId: pageId, action: "error_exception", message: String(e && e.message ? e.message : e) });
      errors++;
    }
  }

  return { ok: true, processed: processed, skipped: skipped, errors: errors, hasMore: hasMore, llmCalls: llmCalls, items: items };
}

/**
 * 1 PJ × 複数 ym のバックフィル
 * GAS 6分制限内に収まるように 1 ym あたり最大 maxItems 件処理。
 * hasMore=true (= deferred 議事録あり) の場合は同 ym を1回だけ追加で呼ぶ。
 * (それ以上の追加は次回 cron 実行 or 再呼び出しで処理。source_hash で重複スキップ)
 *
 * @param {string} projectId
 * @param {string[]} ymList
 * @param {Object} [opts] {maxItems?: number, retryHasMore?: boolean}
 */
function nav_meeting_backfillForProject_(projectId, ymList, opts) {
  opts = opts || {};
  const maxItems = Number(opts.maxItems || 5); // GAS 6分制限内安全圏
  const retryHasMore = opts.retryHasMore !== false; // default true
  const out = { ok: true, projectId: projectId, results: [] };
  if (!Array.isArray(ymList)) return { ok: false, message: "ymList not array" };

  for (const ym of ymList) {
    let totalProcessed = 0, totalSkipped = 0, totalErrors = 0, calls = 0, finalHasMore = false;
    let lastMessage = "";
    let attempts = 0;
    const MAX_ATTEMPTS = 8; // 同 ym で最大 8 回まで (=最大 ~40 件)
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
      ym: ym,
      calls: calls,
      processed: totalProcessed,
      skipped: totalSkipped,
      errors: totalErrors,
      hasMore: finalHasMore,
      message: lastMessage
    });
  }
  return out;
}

// ============================================================
// 内部 helper
// ============================================================

/** Notion ページから AMD projectId を resolve (relation > title > suggested) */
function _meeting_resolveProjectIdFromPage_(notionToken, pageObj) {
  // 1) relation
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
  // 2) title fallback
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

function _meeting_sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ""), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    const v = (b < 0) ? (b + 256) : b;
    const h = v.toString(16);
    return h.length === 1 ? ("0" + h) : h;
  }).join("");
}

/** 既存の project_meeting_summaries を project_id+ym で取得して meeting_id Map に */
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

/**
 * Gemini で 1 議事録 → 構造化サマリ
 * @param {string} minutesText
 * @return {Object|null} {summary_short, decided, progress, next_actions, risks}
 */
function _meeting_extractWithLLM_(minutesText, meta) {
  meta = meta || {};

  // Protocol Store から meeting_extract のプロンプト取得 (既存ロジック流用)
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

  // Protocol Store にまだプロンプトが入ってない場合の安全網 (092_AdminLLMExtractors の installer 関数を一度実行すれば不要)
  if (!baseText && typeof meeting_extract_basePrompt_ === "function") {
    baseText = meeting_extract_basePrompt_();
  }
  if (!baseText) {
    throw new Error("meeting_extract prompt missing (run run_installMeetingExtractorConfig)");
  }

  const userPrompt = [
    "extractor: meeting_summary_v1",
    "projectId: " + String(meta.projectId || ""),
    "ym: " + String(meta.ymKey || ""),
    "",
    "=== minutes ===",
    String(minutesText || "")
  ].join("\n");

  const parsed = llm_callJson("meeting_extract", baseText, userPrompt, { maxTokens: 2048, temperature: 0.2 });
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
