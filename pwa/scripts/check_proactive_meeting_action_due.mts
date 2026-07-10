#!/usr/bin/env node
import assert from "node:assert/strict";
import { resolveMeetingNextActionDueAt } from "../src/lib/proactive/meeting-action-due.ts";

const kute = resolveMeetingNextActionDueAt(
  "まさが各事業化シナリオのメリット・デメリットを定量化し、2026-08-04次回MTGまでに提示資料を作成する。",
  "2026-06-24",
);
assert.equal(kute.source, "explicit_next_meeting_date");
assert.equal(kute.dueAt, "2026-08-04T00:00:00.000Z");

const monthDayNextMeeting = resolveMeetingNextActionDueAt(
  "8/4のMTGまでに先方へ提示する論点表を作る。",
  "2026-07-07",
);
assert.equal(monthDayNextMeeting.source, "explicit_next_meeting_date");
assert.equal(monthDayNextMeeting.dueAt, "2026-08-04T00:00:00.000Z");

const genericDeadline = resolveMeetingNextActionDueAt(
  "7/17までに修正案を回答する。",
  "2026-07-10",
);
assert.equal(genericDeadline.source, "explicit_deadline_date");
assert.equal(genericDeadline.dueAt, "2026-07-17T09:00:00.000Z");

const noExplicitDue = resolveMeetingNextActionDueAt(
  "まさが論点を整理して資料化する。",
  "2026-06-24",
);
assert.equal(noExplicitDue.source, "fallback_meeting_date_plus_days");
assert.equal(noExplicitDue.dueAt, "2026-07-01T00:00:00.000Z");

const oldContextDate = resolveMeetingNextActionDueAt(
  "6/1の議論を踏まえて制度案を整理する。",
  "2026-07-10",
);
assert.equal(oldContextDate.source, "fallback_meeting_date_plus_days");
assert.equal(oldContextDate.dueAt, "2026-07-17T00:00:00.000Z");

console.log(JSON.stringify({
  ok: true,
  checked: 5,
  kute_due_at: kute.dueAt,
}, null, 2));
