/**
 * 074e_MeetingSummaryGmail.js
 *
 * Gmail 議事録メール / 打ち合わせ報告メールを MTG サマリに変換して
 * project_meeting_summaries に upsert する backfill 関数群。
 *
 * 074b (Slack) と同じ pattern。meeting_id = "gmail-{threadId}" 形式。
 *
 * 議事録メール identify:
 *   - 件名 regex: /(議事録|meeting.?notes?|打.合わせ|定例|kickoff|キックオフ|報告会)/i
 *   - 受信日 (= internalDate) が ym 期間内
 *   - bot / 自動配信は事前除外 (= R306 と同じ方針)
 *
 * PJ 紐付け:
 *   - 件名に project_name か projectId 文字列が含まれる (= simple match)
 *   - 後続実装で CFG_PJAlias と統合可能
 *
 * 公開関数:
 *  - nav_meeting_extractGmailForProjectYm_(projectId, ym, opts)
 *  - nav_meeting_backfillGmailAllActive_(opts)
 */

/** 自動配信 / bot メールかどうか (= header / from で判定) */
function _meeting_gmail_isBotMail_(msg) {
  if (!msg) return true;
  try {
    const from = String(msg.getFrom() || "").toLowerCase();
    if (!from) return true;
    if (/(noreply|no-reply|do.?not.?reply|notification@|alert@|mailer-daemon|donotreply)/i.test(from)) return true;
    const headers = msg.getRawContent() || "";
    if (/X-Auto-Response-Suppress:/i.test(headers)) return true;
    return false;
  } catch (e) { return true; }
}

/** thread が PJ にマッチするか (= 件名で project_name or projectId を含む) */
function _meeting_gmail_threadMatchesPj_(thread, projectName, projectId) {
  if (!thread) return false;
  const subj = String(thread.getFirstMessageSubject() || "").toLowerCase();
  if (projectName && subj.includes(String(projectName).toLowerCase())) return true;
  if (projectId && subj.includes(String(projectId).toLowerCase())) return true;
  return false;
}

/** ym 期間で議事録系メールを query */
function _meeting_gmail_searchMinuteThreads_(projectName, projectId, startDate, endDate) {
  const after = Math.floor(startDate.getTime() / 1000);
  const before = Math.floor(endDate.getTime() / 1000);
  // 議事録系キーワード + 期間。subject 検索は too narrow になりがちなので OR で広めに
  const kwQuery = '(subject:"議事録" OR subject:"meeting notes" OR subject:"打ち合わせ" OR subject:"定例" OR subject:"kickoff" OR subject:"報告会")';
  const q = kwQuery + " after:" + after + " before:" + before;
  let threads = [];
  try { threads = GmailApp.search(q, 0, 50); } catch (e) { return { threads: [], err: "search_throw: " + String(e).slice(0, 200) }; }
  // PJ 紐付け filter
  const matched = threads.filter(function (th) {
    return _meeting_gmail_threadMatchesPj_(th, projectName, projectId);
  });
  return { threads: matched, err: null };
}

function nav_meeting_extractGmailForProjectYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};

  const systemPrompt = (typeof _meeting_loadSystemPrompt_ === "function")
    ? _meeting_loadSystemPrompt_("meeting_extract.gmail") : "";
  if (!systemPrompt) {
    return { ok: false, action: "missing_prompt", projectId: projectId, ym: ym, saved: 0,
             message: "llm_prompts.meeting_extract.gmail (is_active=TRUE) が空" };
  }

  // PJ 名を取得
  let projectName = "";
  try {
    const r = supa_select("projects", { select: "project_name", filter: "project_id=eq." + encodeURIComponent(projectId), limit: 1 });
    if (r.ok && r.rows && r.rows.length > 0) projectName = String(r.rows[0].project_name || "");
  } catch (_) {}

  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const ymStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const ymEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));

  const scan = _meeting_gmail_searchMinuteThreads_(projectName, projectId, ymStart, ymEnd);
  if (scan.threads.length === 0) {
    return { ok: true, action: scan.err ? "search_err" : "no_threads", projectId: projectId, ym: ym,
             project_name: projectName, saved: 0, scan_err: scan.err };
  }

  let existing = {};
  try {
    existing = (typeof _meeting_loadExistingForProjectYm_ === "function")
      ? (_meeting_loadExistingForProjectYm_(projectId, ym) || {}) : {};
  } catch (_) { existing = {}; }
  const existingCount = Object.keys(existing).length;

  const maxLlmCalls = Number(opts.maxLlmCalls || 4);
  let saved = 0;
  let llmCalls = 0;
  const items = [];

  for (const th of scan.threads) {
    if (llmCalls >= maxLlmCalls) { items.push({ action: "stop_max_llm_reached" }); break; }
    const threadId = th.getId();
    const meetingId = "gmail-" + threadId;
    if (existing[meetingId]) { items.push({ meetingId: meetingId, action: "skipped_existing" }); continue; }

    const subj = th.getFirstMessageSubject() || "";
    const msgs = th.getMessages() || [];
    if (msgs.length === 0) { items.push({ meetingId: meetingId, action: "skipped_no_messages" }); continue; }

    const bodyParts = [];
    for (let i = 0; i < msgs.length; i++) {
      const m2 = msgs[i];
      if (_meeting_gmail_isBotMail_(m2)) continue;
      const date = m2.getDate().toISOString().slice(0, 16);
      const from = (m2.getFrom() || "").replace(/<[^>]+>/, "").trim();
      const body = (m2.getPlainBody() || "").slice(0, 6000);
      bodyParts.push("--- [" + date + "] " + from + " ---\n" + body);
    }
    if (bodyParts.length === 0) { items.push({ meetingId: meetingId, action: "skipped_all_bots" }); continue; }
    const allText = bodyParts.join("\n\n").slice(0, 16000);
    const lastDate = msgs[msgs.length - 1].getDate().toISOString();

    const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
    const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n" +
      "gmail_subject: " + subj + "\n" +
      "thread_message_count: " + msgs.length + "\n\n" +
      (aliasBlock ? aliasBlock + "\n\n" : "") +
      "# Gmail thread body (newest last):\n" + allText;

    let parsed = null;
    try {
      parsed = llm_callJson("meeting_extract", systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.2 });
      llmCalls++;
    } catch (e) { items.push({ meetingId: meetingId, action: "llm_err", message: String(e).slice(0, 200) }); continue; }
    if (!parsed || typeof parsed !== "object") { items.push({ meetingId: meetingId, action: "llm_parse_failed" }); continue; }
    if (!parsed.title || String(parsed.title).trim() === "") { items.push({ meetingId: meetingId, action: "skipped_chitchat" }); continue; }

    try {
      const meetingDate = lastDate.slice(0, 10);
      const up = supa_upsert("project_meeting_summaries", {
        meeting_id: meetingId,
        project_id: projectId,
        ym: ym,
        meeting_date: meetingDate,
        title: String(parsed.title || "").slice(0, 200),
        summary_short: String(parsed.summary_short || "").slice(0, 2000),
        decided: Array.isArray(parsed.decided) ? parsed.decided.slice(0, 20).map(String) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 20).map(String) : [],
        next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 20).map(String) : [],
        source_kinds: "gmail",
        gmail_thread_ids: [threadId],
        source_url: "https://mail.google.com/mail/u/0/#all/" + threadId,
        updated_at: new Date().toISOString(),
      }, "meeting_id");
      if (up.ok) { saved++; items.push({ meetingId: meetingId, action: "saved", title: String(parsed.title).slice(0, 60) }); }
      else { items.push({ meetingId: meetingId, action: "upsert_err", status: up.status, message: String(up.body || "").slice(0, 200) }); }
    } catch (e) { items.push({ meetingId: meetingId, action: "upsert_throw", message: String(e).slice(0, 200) }); }
  }
  return { ok: true, projectId: projectId, ym: ym, project_name: projectName,
           threads_found: scan.threads.length, existing_count: existingCount,
           saved: saved, llm_calls: llmCalls, scan_err: scan.err, items: items.slice(0, 40) };
}

function nav_meeting_backfillGmailAllActive_(opts) {
  opts = opts || {};
  const monthsBack = Number(opts.monthsBack || 6);
  const maxLlmCallsPerRun = Number(opts.maxLlmCallsPerRun || 24);
  const maxLlmPerCall = Number(opts.maxLlmPerCall || 3);
  const projRes = supa_select("projects", { select: "project_id,status", filter: "status=in.(active,sales)" });
  const projects = projRes.ok ? (projRes.rows || []) : [];
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
        const r = nav_meeting_extractGmailForProjectYm_(pj.project_id, ym, { maxLlmCalls: maxLlmPerCall });
        if (r && r.saved) totalSaved += r.saved;
        if (r && r.llm_calls) llmTotal += r.llm_calls;
        summary.push({ pj: pj.project_id, ym: ym, saved: r.saved || 0, threads: r.threads_found || 0,
                       existing: r.existing_count == null ? null : r.existing_count, action: r.action || "ok" });
      } catch (e) { summary.push({ pj: pj.project_id, ym: ym, error: String(e).slice(0, 200) }); }
    }
  }
  return { ok: true, projects: projects.length, months_back: monthsBack,
           total_saved: totalSaved, llm_calls: llmTotal, summary: summary };
}
