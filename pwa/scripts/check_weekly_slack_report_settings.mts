import assert from "node:assert/strict";
import {
  canDeliverWeeklySlackReport,
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

assert.equal(canDeliverWeeklySlackReport({
  project_id: "p42",
  slack_channel_id: "C123",
  slack_channel_not_required: true,
}, true), false);

console.log("weekly Slack report gate: ok");
