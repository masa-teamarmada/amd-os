/**
 * 188_L6CalendarColorDiagnostic.js
 *
 * L6 Phase A 前段の read-only Calendar color diagnostic。
 * Advanced Calendar Service (Calendar API v3) で event.colorId と
 * calendarList の default colorId を読むだけ。DB/API/outbox への write はしない。
 */

/**
 * L6用のCalendar色診断。
 * pwaApi runFunc からも呼べるように、戻り値はJSON safeなplain objectだけにする。
 *
 * @param {Object=} opts
 * @returns {Object}
 */
function l6_calendar_color_diagnostic(opts) {
  opts = opts || {};

  const calendarId = String(opts.calendarId || "primary").trim() || "primary";
  const now = new Date();
  const timeMin = _l6Color_parseDate_(opts.timeMin) || new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const timeMax = _l6Color_parseDate_(opts.timeMax) || new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const maxResults = Math.max(1, Math.min(250, Number(opts.maxResults || 50)));

  if (!(timeMin.getTime() < timeMax.getTime())) {
    return {
      ok: false,
      diagnostic: "l6_calendar_color",
      external_writes: "none",
      error_class: "invalid_window",
      message: "timeMin must be earlier than timeMax"
    };
  }

  const calendarDefault = _l6Color_getCalendarDefault_(calendarId);
  const aliasConfig = _l6Color_loadAliasConfig_();
  const events = _l6Color_listEvents_(calendarId, timeMin, timeMax, maxResults);
  const normalized = events.map(function (ev) {
    return _l6Color_normalizeEvent_(ev, calendarId, aliasConfig.aliases);
  });
  const explicitCount = normalized.filter(function (ev) {
    return !!ev.colorId;
  }).length;
  const aliasCandidateCount = normalized.filter(function (ev) {
    return ev.alias_candidate && ev.alias_candidate.candidate === true;
  }).length;

  return {
    ok: true,
    diagnostic: "l6_calendar_color",
    external_writes: "none",
    auth_mode: "gas_advanced_calendar_service",
    calendar_id: calendarId,
    time_min: timeMin.toISOString(),
    time_max: timeMax.toISOString(),
    calendar_default: calendarDefault,
    alias_config: {
      ok: aliasConfig.ok,
      source: aliasConfig.source,
      row_count: aliasConfig.rowCount,
      error_class: aliasConfig.errorClass
    },
    events_scanned: normalized.length,
    explicit_color_events: explicitCount,
    no_explicit_color_events: normalized.length - explicitCount,
    high_confidence_alias_events: aliasCandidateCount,
    events: normalized,
    next_recommendation: (explicitCount > 0 || aliasCandidateCount > 0)
      ? "resolve_color_history_or_high_confidence_alias_then_monitored_live_once"
      : "no_explicit_event_color_or_high_confidence_alias_stop"
  };
}

function _l6Color_parseDate_(value) {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function _l6Color_getCalendarDefault_(calendarId) {
  try {
    const entry = Calendar.CalendarList.get(calendarId);
    return _l6Color_normalizeCalendarListEntry_(entry, "calendarList.get");
  } catch (err) {
    try {
      const list = Calendar.CalendarList.list({ maxResults: 250 });
      const items = (list && list.items) || [];
      let hit = null;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id === calendarId || (calendarId === "primary" && item.primary === true)) {
          hit = item;
          break;
        }
      }
      if (hit) return _l6Color_normalizeCalendarListEntry_(hit, "calendarList.list");
    } catch (_ignored) {}
    return {
      ok: false,
      source: "calendarList.get",
      error_class: _l6Color_errorClass_(err),
      colorId: "",
      backgroundColor: "",
      foregroundColor: ""
    };
  }
}

function _l6Color_normalizeCalendarListEntry_(entry, source) {
  entry = entry || {};
  return {
    ok: true,
    source: source,
    id: String(entry.id || ""),
    summary: String(entry.summary || ""),
    primary: entry.primary === true,
    timeZone: String(entry.timeZone || ""),
    accessRole: String(entry.accessRole || ""),
    colorId: String(entry.colorId || ""),
    backgroundColor: String(entry.backgroundColor || ""),
    foregroundColor: String(entry.foregroundColor || "")
  };
}

function _l6Color_listEvents_(calendarId, timeMin, timeMax, maxResults) {
  const all = [];
  let pageToken = null;
  do {
    const remaining = maxResults - all.length;
    if (remaining <= 0) break;
    const res = Calendar.Events.list(calendarId, {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: Math.min(remaining, 250),
      pageToken: pageToken,
      fields: "items(id,summary,start,end,colorId,recurringEventId,originalStartTime,eventType,transparency,htmlLink),nextPageToken"
    });
    if (res && res.items && res.items.length) {
      Array.prototype.push.apply(all, res.items);
    }
    pageToken = res && res.nextPageToken ? res.nextPageToken : null;
  } while (pageToken);
  return all;
}

function _l6Color_normalizeEvent_(event, calendarId, aliases) {
  event = event || {};
  const start = event.start || {};
  const end = event.end || {};
  const originalStart = event.originalStartTime || {};
  const summary = String(event.summary || "").trim();
  const colorId = String(event.colorId || "").trim();
  const isAllDay = !!(start.date && !start.dateTime);
  const prefixSkip = summary.indexOf("+") === 0 || summary.indexOf("＋") === 0;
  const aliasCandidate = _l6Color_highConfidenceAlias_(summary, aliases);
  const baseEligible = !isAllDay && summary && !prefixSkip;

  return {
    event_id: String(event.id || ""),
    calendar_id: calendarId,
    summary: summary || "(no title)",
    start: String(start.dateTime || start.date || ""),
    end: String(end.dateTime || end.date || ""),
    is_all_day: isAllDay,
    title_prefix_skip: prefixSkip,
    event_type: String(event.eventType || ""),
    transparency: String(event.transparency || ""),
    recurring_event_id: String(event.recurringEventId || ""),
    original_start_time: String(originalStart.dateTime || originalStart.date || ""),
    colorId: colorId,
    has_explicit_color: !!colorId,
    alias_candidate: aliasCandidate,
    l6_resolution_gate: colorId && baseEligible
      ? "eligible_for_color_history_resolution"
      : (aliasCandidate.candidate && baseEligible
        ? "eligible_for_cfg_alias_resolution"
        : "needs_explicit_color_or_high_confidence_alias")
  };
}

function _l6Color_loadAliasConfig_() {
  try {
    if (typeof _loadPJAliasesForMinutes_ !== "function") {
      return { ok: false, source: "unavailable", rowCount: 0, errorClass: "loader_missing", aliases: [] };
    }
    const aliases = _loadPJAliasesForMinutes_() || [];
    return { ok: true, source: "CFG_PJAlias", rowCount: aliases.length, errorClass: "", aliases: aliases };
  } catch (err) {
    return { ok: false, source: "CFG_PJAlias", rowCount: 0, errorClass: _l6Color_errorClass_(err), aliases: [] };
  }
}

function _l6Color_highConfidenceAlias_(summary, aliases) {
  const title = String(summary || "");
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle || !aliases || !aliases.length) {
    return { matched: false, candidate: false, reason: "no_alias_config_or_title" };
  }

  for (let i = 0; i < aliases.length; i++) {
    const a = aliases[i] || {};
    const alias = String(a.alias || "").trim();
    const pjCode = String(a.pjCode || "").trim();
    const matchType = String(a.matchType || "contains").trim().toLowerCase() || "contains";
    if (!alias || !pjCode) continue;

    const match = _l6Color_aliasMatchKind_(title, alias, matchType, a.re);
    if (!match.matched) continue;

    const excluded = pjCode.toUpperCase() === "EXCLUDE";
    const amd = pjCode.toUpperCase() === "AMD";
    const candidate = match.highConfidence && !excluded && !amd;
    return {
      matched: true,
      candidate: candidate,
      pjCode: pjCode,
      matchType: matchType,
      confidence: match.highConfidence ? "high" : "review_only",
      reason: excluded ? "exclude_alias" : (amd ? "amd_alias_skip" : match.reason),
      priority: Number(a.priority || 0),
      alias_length: alias.length
    };
  }

  return { matched: false, candidate: false, reason: "no_cfg_alias_hit" };
}

function _l6Color_aliasMatchKind_(title, alias, matchType, compiledRegex) {
  const t = String(title || "");
  const a = String(alias || "");
  const tLower = t.toLowerCase();
  const aLower = a.toLowerCase();

  if (matchType === "regex") {
    let re = compiledRegex || null;
    if (!re) {
      try { re = new RegExp(a, "i"); } catch (_err) { re = null; }
    }
    return { matched: !!(re && re.test(t)), highConfidence: !!(re && re.test(t)), reason: "cfg_regex" };
  }

  if (matchType === "exact") {
    return {
      matched: tLower === aLower,
      highConfidence: tLower === aLower,
      reason: "cfg_exact_title"
    };
  }

  const bracketed = ["[" + a + "]", "【" + a + "】", "(" + a + ")", "（" + a + "）"];
  for (let i = 0; i < bracketed.length; i++) {
    if (tLower.indexOf(bracketed[i].toLowerCase()) >= 0) {
      return { matched: true, highConfidence: true, reason: "cfg_bracketed_title_alias" };
    }
  }

  if (/^[A-Za-z0-9_-]{2,}$/.test(a)) {
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholeToken = new RegExp("(^|[^A-Za-z0-9])" + escaped + "([^A-Za-z0-9]|$)", "i");
    if (wholeToken.test(t)) {
      return { matched: true, highConfidence: true, reason: "cfg_whole_token_title_alias" };
    }
  }

  return {
    matched: t.indexOf(a) >= 0,
    highConfidence: false,
    reason: "cfg_contains_review_only"
  };
}

function _l6Color_errorClass_(err) {
  const msg = String((err && (err.message || err.toString && err.toString())) || "unknown_error");
  if (msg.indexOf("Exception:") === 0) return "gas_exception";
  return msg.slice(0, 120);
}
