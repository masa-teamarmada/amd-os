#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMeetingCalendarUpsertPlans,
  type ExistingCalendarEvent,
  type MeetingCalendarSource,
} from "../src/lib/meeting-calendar-upsert-plan.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = process.argv.includes("--fixture")
  ? process.argv[process.argv.indexOf("--fixture") + 1]
  : path.join(__dirname, "__fixtures__", "meeting_calendar_upsert_plan.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
  meetings: MeetingCalendarSource[];
  existing_events: ExistingCalendarEvent[];
};

const plans = buildMeetingCalendarUpsertPlans(fixture.meetings, fixture.existing_events);
const byMeetingId = new Map(plans.map((plan) => [plan.meeting_id, plan]));

const kute = byMeetingId.get("upcoming:kute-20260611-onsite");
assert.equal(kute?.action, "create_candidate");
assert.equal(kute?.auto_write_eligible, true);
assert.equal(kute?.sendUpdates, "none");
assert.deepEqual(kute?.proposed_payload?.attendees, []);
assert.ok(kute?.risk_flags.includes("onsite"));
assert.ok(kute?.risk_flags.includes("university_or_research_partner"));
assert.ok(kute?.risk_flags.includes("carry_items"));
assert.ok((kute?.proposed_payload?.reminders.overrides ?? []).some((item) => item.minutes === 24 * 60));
assert.equal(kute?.proposed_payload?.extendedProperties.private.amd_os_mtg_card_id, "upcoming:kute-20260611-onsite");

const existing = byMeetingId.get("upcoming:evt_existing_001");
assert.equal(existing?.action, "update_existing");
assert.equal(existing?.target_event_id, "evt_existing_001");
assert.equal(existing?.duplicate_match?.reason, "calendar_event_id_exact");

const dateOnly = byMeetingId.get("upcoming:p25:20260613:date-only");
assert.equal(dateOnly?.action, "review_required");
assert.ok(dateOnly?.review_reasons.includes("date_only_wide_0800_2100_block"));
assert.equal(dateOnly?.proposed_payload?.start.dateTime, "2026-06-12T23:00:00.000Z");
assert.equal(dateOnly?.proposed_payload?.end.dateTime, "2026-06-13T12:00:00.000Z");

const lowConfidence = byMeetingId.get("upcoming:p25:low-confidence");
assert.equal(lowConfidence?.action, "hold");
assert.ok(lowConfidence?.review_reasons.includes("low_date_confidence"));

const externalInvite = byMeetingId.get("upcoming:p25:external-invite");
assert.equal(externalInvite?.action, "review_required");
assert.ok(externalInvite?.review_reasons.includes("external_attendee_invite_requested"));
assert.deepEqual(externalInvite?.proposed_payload?.attendees, []);

console.log(JSON.stringify({
  ok: true,
  total: plans.length,
  actions: plans.reduce((acc, plan) => {
    acc[plan.action] = (acc[plan.action] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>),
}, null, 2));
