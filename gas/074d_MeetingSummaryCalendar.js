/**
 * 074d_MeetingSummaryCalendar.js
 *
 * Calendar event (description + attendees) を MTG サマリに変換して
 * project_meeting_summaries に upsert する backfill 関数群。
 *
 * 074b (Slack) と同じ pattern。meeting_id = "calendar-{eventId}" 形式。
 *
 * PJ 紐付け:
 *  - CalendarPJResolver.js の resolve... 関数があれば優先利用 (= 既存実装の流用)
 *  - 無ければ event タイトルからの alias matching (= CFG_PJAlias)
 *
 * 公開関数:
 *  - nav_meeting_extractCalendarForProjectYm_(projectId, ym, opts)
 *  - nav_meeting_backfillCalendarAllActive_(opts)
 */

/** event タイトルに PJ alias 名が含まれてれば match する簡易実装 (fallback) */
function _meeting_cal_titleMatchesPj_(eventTitle, projectId) {
  if (!eventTitle || !projectId) return false;
  const t = String(eventTitle).toLowerCase();
  // CFG_PJAlias は外部スプシだが、本実装では projects.project_name で simple match
  try {
    const r = supa_select("projects", { select: "project_name", filter: "project_id=eq." + encodeURIComponent(projectId), limit: 1 });
    if (r.ok && r.rows && r.rows.length > 0) {
      const name = String(r.rows[0].project_name || "").toLowerCase();
      if (name && t.includes(name)) return true;
    }
  } catch (_) {}
  // projectId 直接マッチ (= "p06" 等)
  return t.includes(String(projectId).toLowerCase());
}

/** Calendar から指定期間の events を取得 (default は primary calendar) */
function _meeting_cal_listEventsForPj_(projectId, startDate, endDate) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const allEvents = cal.getEvents(startDate, endDate) || [];
    const matched = [];
    for (const ev of allEvents) {
      const title = ev.getTitle() || "";
      if (!_meeting_cal_titleMatchesPj_(title, projectId)) continue;
      matched.push({
        eventId: ev.getId(),
        title: title,
        startAt: ev.getStartTime().toISOString(),
        endAt: ev.getEndTime().toISOString(),
        description: (ev.getDescription() || "").slice(0, 12000),
        location: ev.getLocation() || "",
        guests: ev.getGuestList(true).map(function (g) {
          return { email: g.getEmail(), name: g.getName() || g.getEmail() };
        }),
      });
    }
    return { events: matched, err: null };
  } catch (e) {
    return { events: [], err: "cal_list_throw: " + String(e).slice(0, 200) };
  }
}

function nav_meeting_extractCalendarForProjectYm_(projectId, ym, opts) {
  projectId = String(projectId || "").trim();
  ym = String(ym || "").trim();
  if (!projectId || !/^\d{6}$/.test(ym)) return { ok: false, message: "projectId/ym invalid" };
  opts = opts || {};

  const systemPrompt = (typeof _meeting_loadSystemPrompt_ === "function")
    ? _meeting_loadSystemPrompt_("meeting_extract.calendar") : "";
  if (!systemPrompt) {
    return { ok: false, action: "missing_prompt", projectId: projectId, ym: ym, saved: 0,
             message: "llm_prompts.meeting_extract.calendar (is_active=TRUE) が空" };
  }

  const y = parseInt(ym.slice(0, 4), 10);
  const m = parseInt(ym.slice(4, 6), 10);
  const ymStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const ymEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59));

  const scan = _meeting_cal_listEventsForPj_(projectId, ymStart, ymEnd);
  if (scan.events.length === 0) {
    return { ok: true, action: scan.err ? "list_err" : "no_events", projectId: projectId, ym: ym,
             saved: 0, scan_err: scan.err };
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

  for (const ev of scan.events) {
    if (llmCalls >= maxLlmCalls) { items.push({ action: "stop_max_llm_reached" }); break; }
    const safeId = String(ev.eventId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    const meetingId = "calendar-" + safeId;
    if (existing[meetingId]) { items.push({ meetingId: meetingId, action: "skipped_existing" }); continue; }

    const descLen = (ev.description || "").length;
    if (descLen < 30 && (ev.guests || []).length < 2) {
      items.push({ meetingId: meetingId, action: "skipped_thin_event", descLen: descLen, guests: (ev.guests || []).length });
      continue;
    }

    const aliasBlock = (typeof nameAlias_buildBlock === "function") ? nameAlias_buildBlock() : "";
    const guestList = (ev.guests || []).slice(0, 20).map(function (g) {
      return "- " + (g.name || g.email);
    }).join("\n");
    const userPrompt = "project_id: " + projectId + " / ym: " + ym + "\n" +
      "event_title: " + ev.title + "\n" +
      "event_time: " + ev.startAt + " 〜 " + ev.endAt + "\n" +
      (ev.location ? "location: " + ev.location + "\n" : "") +
      (aliasBlock ? "\n" + aliasBlock + "\n" : "") +
      "\n# attendees:\n" + guestList +
      "\n\n# description:\n" + (ev.description || "").slice(0, 14000);

    let parsed = null;
    try {
      parsed = llm_callJson("meeting_extract", systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.2 });
      llmCalls++;
    } catch (e) { items.push({ meetingId: meetingId, action: "llm_err", message: String(e).slice(0, 200) }); continue; }
    if (!parsed || typeof parsed !== "object") { items.push({ meetingId: meetingId, action: "llm_parse_failed" }); continue; }
    if (!parsed.title || String(parsed.title).trim() === "") { items.push({ meetingId: meetingId, action: "skipped_chitchat" }); continue; }

    try {
      const meetingDate = ev.startAt.slice(0, 10);
      const up = supa_upsert("project_meeting_summaries", {
        meeting_id: meetingId,
        project_id: projectId,
        ym: ym,
        meeting_date: meetingDate,
        meeting_start_at: ev.startAt,
        calendar_event_id: ev.eventId,
        title: String(parsed.title || "").slice(0, 200),
        summary_short: String(parsed.summary_short || "").slice(0, 2000),
        decided: Array.isArray(parsed.decided) ? parsed.decided.slice(0, 20).map(String) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 20).map(String) : [],
        next_actions: Array.isArray(parsed.next_actions) ? parsed.next_actions.slice(0, 20).map(String) : [],
        source_kinds: "calendar",
        source_url: "https://calendar.google.com/calendar/u/0/r/eventedit/" + encodeURIComponent(ev.eventId),
        updated_at: new Date().toISOString(),
      }, "meeting_id");
      if (up.ok) { saved++; items.push({ meetingId: meetingId, action: "saved", title: String(parsed.title).slice(0, 60) }); }
      else { items.push({ meetingId: meetingId, action: "upsert_err", status: up.status, message: String(up.body || "").slice(0, 200) }); }
    } catch (e) { items.push({ meetingId: meetingId, action: "upsert_throw", message: String(e).slice(0, 200) }); }
  }
  return { ok: true, projectId: projectId, ym: ym,
           events_found: scan.events.length, existing_count: existingCount,
           saved: saved, llm_calls: llmCalls, scan_err: scan.err, items: items.slice(0, 40) };
}

function nav_meeting_backfillCalendarAllActive_(opts) {
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
        const r = nav_meeting_extractCalendarForProjectYm_(pj.project_id, ym, { maxLlmCalls: maxLlmPerCall });
        if (r && r.saved) totalSaved += r.saved;
        if (r && r.llm_calls) llmTotal += r.llm_calls;
        summary.push({ pj: pj.project_id, ym: ym, saved: r.saved || 0, events: r.events_found || 0,
                       existing: r.existing_count == null ? null : r.existing_count, action: r.action || "ok" });
      } catch (e) { summary.push({ pj: pj.project_id, ym: ym, error: String(e).slice(0, 200) }); }
    }
  }
  return { ok: true, projects: projects.length, months_back: monthsBack,
           total_saved: totalSaved, llm_calls: llmTotal, summary: summary };
}
