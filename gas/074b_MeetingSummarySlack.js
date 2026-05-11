/**
 * 074b_MeetingSummarySlack.js
 *
 * 074_MeetingSummaryRepo.js を Slack ソース統合に拡張する新規ファイル。
 * 元の 074 は Notion + Gmail ベースで動いており、Notion 議事録のない PJ は
 * project_meeting_summaries が空になる事故が発生していた (まさ要望 2026-05-11)。
 *
 * 設計:
 *  - 該当 PJ の Slack channel から、過去 N ヶ月の thread (reply_count >= 2) を抽出
 *  - 各 thread = 1 meeting として project_meeting_summaries に upsert
 *  - meeting_id = "slack-{channelId}-{threadTs}" 形式
 *  - bot メッセージは除外 (= R306 と同じ方針、つくよみ等の自動投稿を除外)
 *  - LLM (default config 経由) で thread 全文 → summary_short / decided / risks / next_actions
 *  - system prompt は llm_prompts.meeting_extract.slack (is_active=TRUE) から取得 (AGENTS ルール)
 *
 * 公開関数:
 *  - nav_meeting_extractSlackThreadsForProjectYm_(projectId, ym, opts)
 *  - nav_meeting_backfillSlackAllActive_(opts)
 *
 * 依存:
 *  - 185_SlackNotify.js / 115_SlackNotify.js (slack_callApi, slackNotifyGetProjectChannelId_)
 *  - 180_SupabaseClient.js (supa_select, supa_upsert)
 *  - 163_LlmRouter.js (llm_callJson)
 *  - 074_MeetingSummaryRepo.js (_meeting_loadExistingForProjectYm_)
 */

/**
 * Slack Web API を **form-encoded** で叩く専用 helper。
 *
 * 既存の slack_callApi (185_SlackNotify.js) は POST + application/json で送信していて、
 * conversations.history は通るが conversations.replies が `invalid_arguments` を返す事象を確認。
 * Slack 側で `ts="1777355520.959369"` を JSON body で受けると内部 parser が precision を
 * 失うパターン (= 多くの公式 SDK が form-encoded を採用している理由)。
 *
 * 074b では history / replies 両方ともこの form-encoded helper 経由で叩く。
 */
function _meeting_slack_callForm_(path, params) {
  var token = slack_getBotToken();
  var url = "https://slack.com/api/" + String(path || "").replace(/^\/+/, "");
  var payload = {};
  Object.keys(params || {}).forEach(function (k) {
    var v = params[k];
    if (v === null || v === undefined) return;
    payload[k] = String(v);
  });
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/x-www-form-urlencoded; charset=utf-8",
    headers: { Authorization: "Bearer " + token },
    payload: payload,
    muteHttpExceptions: true
  });
  var text = res.getContentText() || "";
  var obj = null;
  try { obj = JSON.parse(text); } catch (e) { /* fall through */ }
  if (!obj || obj.ok !== true) {
    var msg = obj && obj.error ? obj.error : text.slice(0, 200);
    throw new Error("Slack API (form) failed: " + msg);
  }
  return obj;
}

/** Slack message が bot かどうか判定 (R306 と同じ仕様) */
function _meeting_slack_isBotMessage_(msg) {
  if (!msg) return true;
  if (msg.subtype === "bot_message") return true;
  if (msg.bot_id) return true;
  if (msg.app_id) return true;
  if (msg.user === "USLACKBOT") return true;
  return false;
}

/** Slack ts (= "1715000000.123456") を Date に */
function _meeting_slack_tsToDate_(ts) {
  const secs = parseFloat(String(ts || "0"));
  if (!Number.isFinite(secs) || secs <= 0) return new Date(0);
  return new Date(secs * 1000);
}

/** llm_prompts.meeting_extract.slack を取得 (is_active=TRUE 必須、AGENTS ルール) */
function _meeting_slack_loadSystemPrompt_() {
  try {
    const pRes = supa_select("llm_prompts", {
      select: "body,is_active",
      filter: "prompt_key=eq.meeting_extract.slack&is_active=eq.true",
      limit: 1
    });
    if (pRes && pRes.ok && pRes.rows && pRes.rows.length > 0 && pRes.rows[0].body) {
      return String(pRes.rows[0].body || "");
    }
  } catch (e) { /* fall through */ }
  return "";
}

/**
 * Slack channel から指定期間内の長スレッド (reply_count >= minReplies、default 2) を抽出。
 * 各スレッド = 1 候補 meeting (= 親メッセージ + 返信全部)。
 * parent text が >= longParentChars 文字あれば返信ゼロでも候補に含める (= 議事録貼り付け対応)
 */
function _meeting_loadSlackThreadsForMonth_(channelId, startDate, endDate, opts) {
  opts = opts || {};
  const minReplies = Number(opts.minReplies || 2);
  const maxPages = Number(opts.maxPages || 10);
  const longParentChars = Number(opts.longParentChars || 200);
  const oldest = String(Math.floor(startDate.getTime() / 1000));
  const latest = String(Math.floor(endDate.getTime() / 1000));

  const threads = [];
  let cursor = null;
  let page = 0;
  let apiErr = null;
  while (page < maxPages) {
    const params = { channel: channelId, oldest: oldest, latest: latest, limit: 100 };
    if (cursor) params.cursor = cursor;
    let resp = null;
    try { resp = _meeting_slack_callForm_("conversations.history", params); }
    catch (e) { apiErr = "history_throw: " + String(e).slice(0, 200); break; }
    if (!resp || !resp.ok) {
      apiErr = "history_err: " + (resp && resp.error ? String(resp.error) : "no_response");
      break;
    }
    const msgs = Array.isArray(resp.messages) ? resp.messages : [];
    for (const m of msgs) {
      if (_meeting_slack_isBotMessage_(m)) continue;
      // 親メッセージ (= thread root) のみ対象
      if (m.thread_ts && m.thread_ts !== m.ts) continue;
      const replyCount = Number(m.reply_count || 0);
      const textLen = String(m.text || "").length;
      // reply 2 以上 OR parent text が長い (= 議事録単独 post) を候補に
      if (replyCount < minReplies && textLen < longParentChars) continue;
      threads.push({
        threadTs: String(m.ts || ""),
        parentText: String(m.text || ""),
        parentUser: String(m.user || ""),
        parentDate: _meeting_slack_tsToDate_(m.ts).toISOString().slice(0, 10),
        replyCount: replyCount,
        parentTextLen: textLen,
      });
    }
    page++;
    if (resp.has_more && resp.response_metadata && resp.response_metadata.next_cursor) {
      cursor = resp.response_metadata.next_cursor;
    } else break;
  }
  return { threads: threads, apiErr: apiErr };
}

/**
 * スレッド返信を取得 (bot 除外)。
 * @return {{ok: boolean, replies: Array, error?: string}}
 *  error は ok=false かつ throw / API err 時に詳細を入れる (= 握り潰さず可視化)
 */
function _meeting_loadSlackThreadReplies_(channelId, threadTs) {
  if (!threadTs) return { ok: true, replies: [] };
  let resp = null;
  try {
    resp = _meeting_slack_callForm_("conversations.replies", { channel: channelId, ts: threadTs, limit: 100 });
  } catch (e) {
    return { ok: false, replies: [], error: "replies_throw: " + String(e).slice(0, 200) };
  }
  if (!resp || !resp.ok) {
    return { ok: false, replies: [], error: "replies_err: " + (resp && resp.error ? String(resp.error) : "no_response") };
  }
  const msgs = Array.isArray(resp.messages) ? resp.messages : [];
  const replies = msgs
    .slice(1) // 親を除く
    .filter(function (m) { return !_meeting_slack_isBotMessage_(m); })
    .map(function (m) {
      return {
        ts: String(m.ts || ""),
        user: String(m.user || ""),
        text: String(m.text || ""),
        date: _meeting_slack_tsToDate_(m.ts).toISOString().slice(0, 10),
      };
    });
  return { ok: true, replies: replies };
}

/**
 * 指定 PJ × 月 の Slack スレッドから meeting summary を生成 + upsert。
 * 戻り値の items 配列で「何が起きたか」全部可視化 (skipped_existing / replies_err / chitchat / saved etc.)
 */
function nav_meeting_extractSlackThreadsForProjectYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};

  const channelId = (typeof slackNotifyGetProjectChannelId_ === "function")
    ? slackNotifyGetProjectChannelId_(projectId) : "";
  if (!channelId) return { ok: true, action: "no_channel", projectId: projectId, ym: ym, saved: 0 };

  const systemPrompt = _meeting_slack_loadSystemPrompt_();
  if (!systemPrompt) {
    return {
      ok: false, action: "missing_prompt", projectId: projectId, ym: ym, saved: 0,
      message: "llm_prompts.meeting_extract.slack (is_active=TRUE) が空"
    };
  }

  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const ymStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const ymEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  const scan = _meeting_loadSlackThreadsForMonth_(channelId, ymStart, ymEnd, opts);
  const threads = scan.threads;
  if (threads.length === 0) {
    return {
      ok: true, action: "no_threads", projectId: projectId, ym: ym, saved: 0,
      channel: channelId, scan_err: scan.apiErr || null
    };
  }

  // 既に upsert 済みの meeting_id を取得 (= 重複防止)。null になりうるので空 map で safety net。
  let existing = {};
  try {
    existing = (typeof _meeting_loadExistingForProjectYm_ === "function")
      ? (_meeting_loadExistingForProjectYm_(projectId, ym) || {}) : {};
  } catch (_e) { existing = {}; }
  const existingCount = Object.keys(existing).length;

  const maxLlmCalls = Number(opts.maxLlmCalls || 8);
  let saved = 0;
  let llmCalls = 0;
  const items = [];

  for (const t of threads) {
    if (llmCalls >= maxLlmCalls) { items.push({ action: "stop_max_llm_reached" }); break; }
    const meetingId = "slack-" + channelId + "-" + t.threadTs.replace(".", "_");
    if (existing[meetingId]) {
      items.push({ meetingId: meetingId, action: "skipped_existing" });
      continue;
    }

    const repliesRes = _meeting_loadSlackThreadReplies_(channelId, t.threadTs);
    if (!repliesRes.ok) {
      items.push({ meetingId: meetingId, action: "replies_err", message: repliesRes.error || "" });
      continue;
    }
    const replies = repliesRes.replies || [];
    const parentMsg = { ts: t.threadTs, user: t.parentUser, text: t.parentText, date: t.parentDate };
    const allMsgs = [parentMsg].concat(replies);

    // bot 除外後に有意な発話が 1 件も無い (= 親も空 + 返信ゼロ) なら chitchat 扱い
    const hasText = allMsgs.some(function (m) { return String(m.text || "").trim().length > 0; });
    if (!hasText) {
      items.push({ meetingId: meetingId, action: "skipped_no_text", replyCount: t.replyCount });
      continue;
    }
    // 返信ゼロ + parent も短文 (< 80) なら抽出意味薄い
    if (replies.length === 0 && String(t.parentText || "").length < 80) {
      items.push({ meetingId: meetingId, action: "skipped_short_solo", replyCount: t.replyCount, parentLen: t.parentTextLen });
      continue;
    }

    const inputText = allMsgs.map(function (msg) {
      return "[" + msg.date + " " + (msg.user || "?") + "] " + (msg.text || "").slice(0, 800);
    }).join("\n").slice(0, 12000);

    const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
    const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n" +
      "thread_replies: " + replies.length + " / parent_chars: " + t.parentTextLen + "\n\n" +
      (aliasBlock ? aliasBlock + "\n\n" : "") +
      "# Slack thread:\n" + inputText;

    let parsed = null;
    try {
      // usageKey は Notion 由来抽出 (_meeting_extractWithLLM_) と同じ "meeting_extract" を共用。
      // DB_LlmModelConfig で Slack 用に分けたい場合は後から "meeting_extract_slack" を seed して切替。
      parsed = llm_callJson("meeting_extract", systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.2 });
      llmCalls++;
    } catch (e) {
      items.push({ meetingId: meetingId, action: "llm_err", message: String(e).slice(0, 200) });
      continue;
    }
    if (!parsed || typeof parsed !== "object") {
      items.push({ meetingId: meetingId, action: "llm_parse_failed" });
      continue;
    }
    if (!parsed.title || String(parsed.title).trim() === "") {
      items.push({ meetingId: meetingId, action: "skipped_chitchat" });
      continue;
    }

    const slackUrl = "https://slack.com/archives/" + channelId + "/p" + t.threadTs.replace(".", "");
    try {
      const up = supa_upsert("project_meeting_summaries", {
        meeting_id: meetingId,
        project_id: projectId,
        ym: ym,
        meeting_date: t.parentDate,
        title: String(parsed.title || "").slice(0, 200),
        summary_short: String(parsed.summary_short || "").slice(0, 2000),
        decided: Array.isArray(parsed.decided) ? parsed.decided.slice(0, 20).map(String) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 20).map(String) : [],
        next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 20).map(String) : [],
        source_kinds: "slack",
        source_url: slackUrl,
        updated_at: new Date().toISOString(),
      }, "meeting_id");
      if (up.ok) {
        saved++;
        items.push({ meetingId: meetingId, action: "saved", title: String(parsed.title || "").slice(0, 60) });
      } else {
        items.push({ meetingId: meetingId, action: "upsert_err", status: up.status, message: String(up.body || "").slice(0, 200) });
      }
    } catch (e) {
      items.push({ meetingId: meetingId, action: "upsert_throw", message: String(e).slice(0, 200) });
    }
  }
  return {
    ok: true,
    projectId: projectId, ym: ym,
    channel: channelId,
    threads_found: threads.length,
    existing_count: existingCount,
    scan_err: scan.apiErr || null,
    saved: saved, llm_calls: llmCalls,
    items: items.slice(0, 40)
  };
}

/** 全 active PJ × 過去 N ヶ月 で Slack backfill を起動 */
function nav_meeting_backfillSlackAllActive_(opts) {
  opts = opts || {};
  const monthsBack = Number(opts.monthsBack || 6);
  const maxLlmCallsPerRun = Number(opts.maxLlmCallsPerRun || 30);
  const maxLlmPerCall = Number(opts.maxLlmPerCall || 4);
  const projRes = supa_select("projects", { select: "project_id,status", filter: "status=in.(active,sales)" });
  const projects = projRes.ok ? (projRes.rows || []) : [];

  // 過去 N ヶ月の ym リスト (新しい順)
  const yms = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    yms.push(String(d.getFullYear()) + ("0" + String(d.getMonth() + 1)).slice(-2));
  }

  const summary = [];
  let totalSaved = 0;
  let llmTotal = 0;
  for (const pj of projects) {
    if (llmTotal >= maxLlmCallsPerRun) break;
    for (const ym of yms) {
      if (llmTotal >= maxLlmCallsPerRun) break;
      try {
        const r = nav_meeting_extractSlackThreadsForProjectYm_(pj.project_id, ym, { maxLlmCalls: maxLlmPerCall });
        if (r && r.saved) totalSaved += r.saved;
        if (r && r.llm_calls) llmTotal += r.llm_calls;
        summary.push({
          pj: pj.project_id, ym: ym,
          saved: r.saved || 0,
          threads_found: r.threads_found || 0,
          existing_count: r.existing_count == null ? null : r.existing_count,
          llm_calls: r.llm_calls || 0,
          action: r.action || "ok",
          scan_err: r.scan_err || null,
        });
      } catch (e) { summary.push({ pj: pj.project_id, ym: ym, error: String(e).slice(0, 200) }); }
    }
  }
  return {
    ok: true, projects: projects.length, months_back: monthsBack,
    total_saved: totalSaved, llm_calls: llmTotal,
    summary: summary
  };
}
