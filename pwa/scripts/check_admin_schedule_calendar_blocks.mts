import assert from "node:assert/strict";
import { buildTimedEventPlans, workDurationMinutes } from "../../ios/supabase/functions/admin-schedule-calendar-sync/schedule.ts";

assert.equal(workDurationMinutes({ category: "tax", source_kind: "official_rule" }), 90);
assert.equal(workDurationMinutes({ category: "labor", source_kind: "company_payment_obligation" }), 60);
assert.equal(workDurationMinutes({ category: "labor", source_kind: "internal_prep_milestone" }), 120);
assert.equal(workDurationMinutes({ category: "report", source_kind: "contract_terms" }), 120);

const plans = buildTimedEventPlans([
  { occurrence_key: "c", title: "C", due_on: "2026-09-10", category: "tax", source_kind: "official_rule" },
  { occurrence_key: "a", title: "A", due_on: "2026-09-10", category: "report", source_kind: "contract_terms" },
  { occurrence_key: "b", title: "B", due_on: "2026-09-10", category: "labor", source_kind: "company_payment_obligation" },
  { occurrence_key: "d", title: "D", due_on: "2026-09-11", category: "labor", source_kind: "internal_prep_milestone" },
]);

assert.deepEqual(plans.map((plan) => [plan.occurrence_key, plan.start_time.slice(11, 16), plan.end_time.slice(11, 16)]), [
  ["a", "09:00", "11:00"],
  ["b", "11:00", "12:00"],
  ["c", "13:00", "14:30"],
  ["d", "09:00", "11:00"],
]);
assert.ok(plans.every((plan) => plan.start_time.endsWith("+09:00") && plan.end_time.endsWith("+09:00")));

console.log("admin schedule calendar block checks: ok");
