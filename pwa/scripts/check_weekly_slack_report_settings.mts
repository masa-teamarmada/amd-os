import assert from "node:assert/strict";
import {
  canDeliverWeeklySlackReport,
  isWeeklySlackReportEvidence,
  observeWeeklySlackReportDelivery,
  weeklySlackReportEnabled,
  weeklySlackReportSettingKey,
} from "../src/lib/weekly-slack-report.ts";

assert.equal(weeklySlackReportSettingKey("p42"), "weekly_slack_report.p42.enabled");
assert.equal(weeklySlackReportEnabled("p42", []), false);
assert.equal(weeklySlackReportEnabled("p42", [
  { key: "weekly_slack_report.p42.enabled", value: "true" },
]), true);

const project = {
  project_id: "p42",
  slack_channel_id: "C123",
  slack_channel_not_required: false,
};

assert.equal(canDeliverWeeklySlackReport(project, false), false);
assert.equal(canDeliverWeeklySlackReport(project, true), true);

assert.equal(canDeliverWeeklySlackReport({
  project_id: "p42",
  slack_channel_id: null,
  slack_channel_not_required: false,
}, true), false);

const reportEvidence = {
  item_date: "2026-09-11T07:03:48.000Z",
  metadata_json: { text_full: "今週の週次レポートを共有します" },
};
assert.equal(isWeeklySlackReportEvidence(reportEvidence), true);
assert.equal(isWeeklySlackReportEvidence({
  item_date: "2026-09-12T00:00:00.000Z",
  metadata_json: { text_full: "次回の打合せについて" },
}), false);

assert.deepEqual(observeWeeklySlackReportDelivery([reportEvidence], new Date("2026-09-17T00:00:00.000Z")), {
  state: "delivering",
  latestReportAt: "2026-09-11T07:03:48.000Z",
  latestSlackAt: "2026-09-11T07:03:48.000Z",
});
assert.equal(observeWeeklySlackReportDelivery([{
  item_date: "2026-09-16T00:00:00.000Z",
  metadata_json: { text_full: "通常の進捗連絡" },
}], new Date("2026-09-17T00:00:00.000Z")).state, "not_detected");
assert.equal(observeWeeklySlackReportDelivery([], new Date("2026-09-17T00:00:00.000Z")).state, "unknown");

assert.equal(canDeliverWeeklySlackReport({
  project_id: "p42",
  slack_channel_id: "C123",
  slack_channel_not_required: true,
}, true), false);

console.log("weekly Slack report gate: ok");
