/**
 * 074f_MeetingWorkflow.gs
 *
 * MTG終了後フロー用の薄い Calendar adapter。
 * PWA /api/meeting-workflow/finalize から pwaApi runFunc 経由で呼ばれ、
 * 次MTGの Calendar event を作成し、参加者へ invite を飛ばす。
 *
 * 仕様正本: pwa/design/meeting_summaries.md 「Phase 4: MTG後ワークフロー」
 */

function nav_meeting_createCalendarEventForPrep_(payload) {
  payload = payload || {};

  const projectId = String(payload.projectId || payload.project_id || "").trim();
  const title = String(payload.title || "").trim();
  const startISO = String(payload.startISO || payload.start_iso || payload.meetingStartAt || "").trim();
  const endISO = String(payload.endISO || payload.end_iso || payload.meetingEndAt || "").trim();
  const description = String(payload.description || "").trim();
  const attendeeEmails = Array.isArray(payload.attendeeEmails || payload.attendee_emails)
    ? (payload.attendeeEmails || payload.attendee_emails)
    : [];
  const sourceMeetingId = String(payload.sourceMeetingId || payload.source_meeting_id || "").trim();
  const prepMeetingId = String(payload.prepMeetingId || payload.prep_meeting_id || "").trim();

  if (!title) return { ok: false, message: "title empty" };
  if (!startISO || !endISO) return { ok: false, message: "startISO/endISO empty" };

  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, message: "invalid start/end" };
  if (end.getTime() <= start.getTime()) return { ok: false, message: "end must be after start" };

  let calendarId = String(payload.calendarId || payload.calendar_id || "").trim();
  if (!calendarId && typeof _meeting_resolveCalendarId_ === "function") {
    const calRes = _meeting_resolveCalendarId_("");
    if (calRes && calRes.ok) calendarId = String(calRes.calendarId || "").trim();
  }
  if (!calendarId) return { ok: false, message: "calendarId empty" };

  const attendees = [];
  const seen = {};
  for (let i = 0; i < attendeeEmails.length; i++) {
    const email = String(attendeeEmails[i] || "").toLowerCase().trim();
    if (!email || seen[email]) continue;
    seen[email] = true;
    attendees.push({ email: email });
  }

  const operatorEmail = String(Session.getActiveUser().getEmail() || "").trim();
  const nowIso = new Date().toISOString();
  const audit = [
    "-----",
    "[AMD OS] MTG workflow",
    "projectId: " + projectId,
    sourceMeetingId ? "sourceMeetingId: " + sourceMeetingId : "",
    prepMeetingId ? "prepMeetingId: " + prepMeetingId : "",
    "operator: " + (operatorEmail || "(unknown)"),
    "createdAt: " + nowIso
  ].filter(function (s) { return !!s; }).join("\n");

  const event = {
    summary: title,
    description: [description, audit].filter(function (s) { return !!s; }).join("\n\n"),
    start: { dateTime: start.toISOString(), timeZone: "Asia/Tokyo" },
    end: { dateTime: end.toISOString(), timeZone: "Asia/Tokyo" },
    conferenceData: { createRequest: { requestId: Utilities.getUuid() } },
    attendees: attendees,
    extendedProperties: {
      private: {
        amdOsProjectId: projectId,
        amdOsSourceMeetingId: sourceMeetingId,
        amdOsPrepMeetingId: prepMeetingId,
        amdOsWorkflow: "meeting_prep",
        amdOsOperatedAt: nowIso
      }
    }
  };

  const created = Calendar.Events.insert(event, calendarId, {
    conferenceDataVersion: 1,
    sendUpdates: attendees.length > 0 ? "all" : "none"
  });

  return {
    ok: true,
    calendarId: calendarId,
    eventId: String(created.id || ""),
    htmlLink: String(created.htmlLink || ""),
    start: created.start && created.start.dateTime ? String(created.start.dateTime) : start.toISOString(),
    end: created.end && created.end.dateTime ? String(created.end.dateTime) : end.toISOString(),
    attendees: attendees.length
  };
}
