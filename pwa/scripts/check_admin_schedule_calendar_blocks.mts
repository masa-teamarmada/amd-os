import assert from "node:assert/strict";
import {
  buildTimedEventPlans,
  calendarEventColorId,
  calendarEventTitle,
  workDurationMinutes,
} from "../../ios/supabase/functions/admin-schedule-calendar-sync/schedule.ts";

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

// 管理カレンダーへ出す見出しは「＋<PJコード> <本文>」で、その PJ の色を付ける
// (manual 3-2 §PJ → カレンダー色)。元データの「PJ / 」接頭辞は二重に出さない。
assert.equal(
  calendarEventTitle({ title: "CX / 月次報告提出（2026年8月分）", project_id: "p20" }),
  "＋CX 月次報告提出（2026年8月分）",
);
assert.equal(
  calendarEventTitle({ title: "NIMS / 月次報告提出（2026年8月分）", project_id: "p28" }),
  "＋NIMS 月次報告提出（2026年8月分）",
);
assert.equal(
  calendarEventTitle({ title: "社会保険料（2026年7月分）", project_id: null }),
  "＋AMD 社会保険料（2026年7月分）",
);
assert.equal(calendarEventTitle({ title: "CX / 契約満了", project_id: "p20" }), "＋CX 契約満了");
// 既に＋が付いた見出しを二重に付けない
assert.equal(calendarEventTitle({ title: "＋CX 契約満了", project_id: "p20" }), "＋CX 契約満了");
// PJ 名が本文の一部で「PJ / 」接頭辞ではない場合は畳まない
assert.equal(
  calendarEventTitle({ title: "SX / CX 連携の確認", project_id: "p20" }),
  "＋CX SX / CX 連携の確認",
);

assert.equal(calendarEventColorId({ project_id: "p20", due_on: "2026-08-31" }), "9");
assert.equal(calendarEventColorId({ project_id: "p21", due_on: "2026-08-31" }), "4");
// 色が割り当たっていない PJ と会社全体の予定は色なし。空いている色を代用しない
assert.equal(calendarEventColorId({ project_id: "p28", due_on: "2026-08-31" }), null);
assert.equal(calendarEventColorId({ project_id: null, due_on: "2026-08-31" }), null);

console.log("admin schedule calendar block checks: ok");
