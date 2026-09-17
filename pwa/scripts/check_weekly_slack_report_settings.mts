import assert from "node:assert/strict";
import {
  isWeeklySlackReportProjectId,
  weeklySlackReportSettingKey,
  weeklySlackReportStatuses,
} from "../src/lib/weekly-slack-report-settings.ts";

assert.equal(isWeeklySlackReportProjectId("ctb"), true);
assert.equal(isWeeklySlackReportProjectId("se"), true);
assert.equal(isWeeklySlackReportProjectId("p06"), false);
assert.equal(weeklySlackReportSettingKey("ctb"), "weekly_slack_report.ctb.enabled");

const defaults = weeklySlackReportStatuses([]);
assert.deepEqual(defaults.map((report) => [report.id, report.enabled]), [["ctb", false], ["se", false]]);

const configured = weeklySlackReportStatuses([
  { key: "weekly_slack_report.ctb.enabled", value: "true", updated_at: "2026-09-17T00:00:00.000Z" },
  { key: "weekly_slack_report.se.enabled", value: "TRUE" },
]);
assert.equal(configured[0].enabled, true);
assert.equal(configured[1].enabled, false);

console.log("weekly Slack report settings: ok");
