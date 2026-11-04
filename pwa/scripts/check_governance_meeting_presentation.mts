import assert from "node:assert/strict";
import type { CompanyMeeting } from "../src/lib/company-overview.ts";
import { governanceMeetingLabel } from "../src/lib/governance-meeting-kind.ts";
import { filterGovernanceMeetings, governanceMeetingDateLabel, governanceMeetingResults, governanceResultTone, governanceResponseLabel } from "../src/lib/governance-meeting-presentation.ts";

const make = (values: Partial<CompanyMeeting>): CompanyMeeting => ({
  id: "record", meeting_type: "board", meeting_date: null, meeting_ym: null,
  location: null, agenda_summary: null, resolutions_json: null,
  amd_response: null, attachments_json: null, source_ref: null, notes: null, ...values,
});
const older = make({ id: "older", meeting_date: "2025-03-31", agenda_summary: "個別配分" });
const latest = make({ id: "latest", meeting_date: "2026-01-01", meeting_type: "director_decision",
  resolutions_json: [{ title: "国内旅費", result: "確認書記載・署名未確認" }, { title: "宿泊旅費", result: "確認書記載・署名未確認" }],
  attachments_json: [{ name: "規程２０２６.docx" }], notes: "署名待ち" });
const monthly = make({ id: "month", meeting_ym: "202611", resolutions_json: [{ title: "予算" }] });
const undated = make({ id: "undated" });
const records = [older, undated, latest, monthly];
assert.deepEqual(filterGovernanceMeetings(records, "", "").map((row) => row.id), ["month", "latest", "older", "undated"]);
assert.deepEqual(records.map((row) => row.id), ["older", "undated", "latest", "month"], "sorting must preserve cached source order");
assert.deepEqual(filterGovernanceMeetings(records, "規程2026 署名", "2026").map((row) => row.id), ["latest"]);
assert.equal(filterGovernanceMeetings(records, "取締役決定", "2025").length, 0);
assert.equal(filterGovernanceMeetings(records, "国内旅費", "").length, 1, "closed details remain searchable");
assert.deepEqual(governanceMeetingResults(latest), ["確認書記載・署名未確認"]);
assert.deepEqual(governanceMeetingResults(monthly), ["未確認"]);
assert.equal(governanceResultTone("可決"), "complete");
assert.equal(governanceResultTone("否決"), "critical");
assert.equal(governanceResultTone("approved"), "complete");
assert.deepEqual(governanceMeetingResults(make({resolutions_json: [{result:"approved"},{result:"可決"}]})), ["可決"]);
assert.equal(governanceMeetingLabel("board_written_resolution"), "取締役会（書面決議）");
for (const result of ["未確認", "継続審議", "可決・署名未確認", "資料記載・成立未確認", ""]) {
  assert.equal(governanceResultTone(result), "neutral", `${result} must not imply a confirmed outcome`);
}
assert.equal(governanceMeetingDateLabel(monthly), "2026/11");
assert.equal(governanceMeetingDateLabel(undated), "日付未登録");
assert.equal(governanceResponseLabel("attended"), "出席");
assert.equal(governanceResponseLabel("原記録の値"), "原記録の値");
console.log("governance meeting presentation checks passed");
