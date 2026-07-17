import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adjustToNextBusinessDay, dateAtDay, nextMonthDay, nextMonthEnd, scheduleGenerationRange, ymFromDate } from "../src/lib/admin-schedule/date.ts";
import { deadlineForReportYm, planMonthlyReportSchedule } from "../src/lib/admin-schedule/report-plan.ts";
import {
  notificationStateLabel,
  scheduleKey,
  scheduleNotificationsEnabled,
  sendScheduleNotificationsWhenEnabled,
  stageFor,
} from "../src/lib/admin-schedule/notifications.ts";
import {
  isAcceptedAmdContract,
  isContractSigningExpected,
  isCurrentAmdContract,
  isScheduleActionItem,
  isStatutoryScheduleObligation,
} from "../src/lib/admin-schedule/predicates.ts";
import { buildMonthGrid, CALENDAR_WEEKDAYS, isDatePrecisionDay, mondayIndex } from "../src/lib/admin-schedule/calendar.ts";
import {
  annualPaymentSummary,
  counterpartyFor,
  formatScheduleYen,
  nextPayment,
} from "../src/lib/admin-schedule/operations.ts";
import { OFFICIAL_RULES } from "../src/lib/admin-schedule/rules/official.ts";

const root = join(import.meta.dirname, "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

assert.equal(nextMonthDay("202606", 10, false), "2026-07-10");
assert.equal(nextMonthEnd("202601", false), "2026-02-28");
assert.equal(adjustToNextBusinessDay("2026-02-28"), "2026-03-02");
assert.equal(dateAtDay("202602", 30), null);
assert.equal(dateAtDay("202602", 28), "2026-02-28");
assert.equal(ymFromDate("2026-01-01"), "202601");
assert.equal(ymFromDate("2026-12-31"), "202612");
assert.deepEqual(scheduleGenerationRange("2026-07-16"), { from: "2025-01-01", to: "2028-12-31" });
const resolvedMonthlyPlan = planMonthlyReportSchedule({ monthlyReportRequired: true, monthlyReportSubmissionDeadline: "各月末" });
assert.equal(resolvedMonthlyPlan.kind, "expanded");
if (resolvedMonthlyPlan.kind === "expanded") {
  assert.equal(deadlineForReportYm("202607", resolvedMonthlyPlan.rule), "2026-07-31");
}
const invoiceLinkedMonthlyPlan = planMonthlyReportSchedule({ monthlyReportRequired: true, monthlyReportSubmissionDeadline: "請求書提出時" }, "202601");
assert.equal(invoiceLinkedMonthlyPlan.kind, "contract_gap");
if (invoiceLinkedMonthlyPlan.kind === "contract_gap") {
  assert.match(invoiceLinkedMonthlyPlan.missingReason, /請求書提出時/);
}
const unspecifiedMonthlyPlan = planMonthlyReportSchedule({ monthlyReportRequired: true, monthlyReportSubmissionDeadline: "指定なし" }, "202601");
assert.equal(unspecifiedMonthlyPlan.kind, "contract_gap");
assert.equal(deadlineForReportYm("202602", { mode: "day", day: 31 }), null, "an invalid calendar day becomes a contract-level gap, not a month row");

assert.deepEqual(CALENDAR_WEEKDAYS, ["月", "火", "水", "木", "金", "土", "日"]);
assert.equal(mondayIndex(2026, 1), 3, "2026-01-01 is Thursday in a Monday-first grid");
const januaryGrid = buildMonthGrid(2026, 1);
assert.equal(januaryGrid.length % 7, 0, "month grid stays seven columns wide");
assert.equal(januaryGrid.find((cell) => cell.date === "2026-01-01")?.day, 1);
assert.equal(januaryGrid.find((cell) => cell.date === "2026-01-01")?.weekend, false);
const decemberDueCell = buildMonthGrid(2026, 12).find((cell) => cell.date === "2026-12-31");
assert.ok(decemberDueCell, "a due_on date maps to its exact calendar cell");
assert.equal(decemberDueCell?.day, 31);
assert.equal(isDatePrecisionDay({ date_precision: "day", due_on: "2026-12-31" }), true);
assert.equal(isDatePrecisionDay({ date_precision: "month", due_on: null }), false, "month-only item cannot receive a fake day");
assert.equal(isDatePrecisionDay({ date_precision: "period", due_on: null }), false, "period item cannot receive a fake day");
assert.equal(buildMonthGrid(2026, 2).some((cell) => cell.outside && cell.date !== null), false, "outside cells never receive dates");

const statutoryPayment = (dueOn: string, amountYen: number, amountStatus: "exact" | "estimated", computedStatus = "open") => ({
  source_kind: "company_payment_obligation",
  amount_role: "outgoing",
  category: "tax",
  computed_status: computedStatus,
  lifecycle_status: computedStatus,
  due_on: dueOn,
  amount_yen: amountYen,
  amount_status: amountStatus,
  metadata_json: { counterparty: "日本年金機構", obligationStatus: computedStatus },
});
const paymentFixture = [
  statutoryPayment("2026-03-02", 333_366, "exact", "completed"),
  statutoryPayment("2026-03-31", 333_366, "exact", "completed"),
  statutoryPayment("2026-04-30", 331_782, "exact", "completed"),
  statutoryPayment("2026-06-01", 334_818, "exact", "completed"),
  statutoryPayment("2026-06-30", 334_818, "exact", "overdue"),
  statutoryPayment("2026-07-10", 322_680, "estimated", "overdue"),
  statutoryPayment("2026-07-10", 29_056, "estimated", "overdue"),
  statutoryPayment("2026-07-31", 334_818, "estimated"),
  statutoryPayment("2026-08-31", 334_818, "estimated"),
  statutoryPayment("2026-08-31", 405_200, "estimated"),
  statutoryPayment("2026-09-30", 334_818, "estimated"),
  statutoryPayment("2026-11-02", 334_818, "estimated"),
  statutoryPayment("2026-11-30", 334_818, "estimated"),
];
const paymentSummary = annualPaymentSummary(paymentFixture, 2026);
assert.equal(paymentSummary.items.length, 13);
assert.equal(paymentSummary.totalAmountYen, 4_099_176);
assert.equal(paymentSummary.exactAmountYen, 1_668_150);
assert.equal(paymentSummary.estimatedAmountYen, 2_431_026);
assert.equal(paymentSummary.unknownCount, 0);
assert.equal(paymentSummary.peakMonth?.month, 8);
assert.equal(paymentSummary.peakMonth?.amountYen, 740_018);
assert.equal(nextPayment(paymentFixture, "2026-07-17")?.due_on, "2026-07-31");
assert.equal(counterpartyFor(paymentFixture[0]), "日本年金機構");
assert.equal(formatScheduleYen(334_818), "334,818円");

const overdue = { lifecycle_status: "open", notification_owner: "company_schedule", category: "report", due_on: "2026-07-15" };
assert.equal(stageFor(overdue, "2026-07-16"), "overdue:2026-07-16");
assert.equal(stageFor(overdue, "2026-07-16"), stageFor(overdue, "2026-07-16"), "same-day overdue is dedupable");
assert.notEqual(stageFor(overdue, "2026-07-16"), stageFor(overdue, "2026-07-17"), "next-day overdue is a new stage");
assert.equal(notificationStateLabel("overdue:2026-07-16"), "期限超過", "dated overdue stage uses overdue wording");

const needsSource = {
  lifecycle_status: "needs_source",
  generation_state: "needs_source",
  notification_owner: "company_schedule",
  created_at: "2026-07-09T00:00:00Z",
};
assert.equal(stageFor(needsSource, "2026-07-09"), "needs_source:initial:2026-07-09");
assert.equal(stageFor(needsSource, "2026-07-16"), "needs_source:cycle-1:2026-07-09");
assert.equal(stageFor(needsSource, "2026-07-23"), "needs_source:cycle-2:2026-07-09");

const ordinaryDay = { lifecycle_status: "open", notification_owner: "company_schedule", category: "invoice", due_on: "2026-07-20" };
assert.equal(stageFor(ordinaryDay, "2026-07-14"), null, "non-threshold day is not notified");
assert.equal(stageFor({ ...overdue, notification_owner: "payment_obligation" }, "2026-07-16"), null, "payment obligation is excluded");
assert.notEqual(scheduleKey({ source_hash: "hash-a" }), scheduleKey({ source_hash: "hash-b" }), "source hash change creates a new schedule key");
assert.equal(scheduleNotificationsEnabled({}), false);
assert.equal(scheduleNotificationsEnabled({ AMD_OS_SCHEDULE_NOTIFICATIONS_ENABLED: "1" }), true);
let notificationSendCalls = 0;
const disabledNotifications = await sendScheduleNotificationsWhenEnabled(async () => {
  notificationSendCalls += 1;
  return { ok: true, considered: 1, created: 1, sent: 1, skipped: 0, failed: 0, errors: [] };
}, {});
assert.equal(disabledNotifications.enabled, false);
assert.equal(disabledNotifications.reason, "disabled_by_env");
assert.equal(notificationSendCalls, 0, "disabled notifications never invoke Slack sender");
const enabledNotifications = await sendScheduleNotificationsWhenEnabled(async () => {
  notificationSendCalls += 1;
  return { ok: true, considered: 1, created: 1, sent: 1, skipped: 0, failed: 0, errors: [] };
}, { AMD_OS_SCHEDULE_NOTIFICATIONS_ENABLED: "1" });
assert.equal(enabledNotifications.enabled, true);
assert.equal(enabledNotifications.reason, "enabled");
assert.equal(notificationSendCalls, 1);

const acceptedAmdContract = {
  relationship_scope: "amd_contract",
  registry_status: "accepted",
  status: "planned",
  signed_at: null,
  expected_signing_date: "2026-08-01",
  is_current_for_project: true,
};
assert.equal(isAcceptedAmdContract(acceptedAmdContract), true);
assert.equal(isContractSigningExpected(acceptedAmdContract), true);
assert.equal(isCurrentAmdContract(acceptedAmdContract), true);
assert.equal(isAcceptedAmdContract({ ...acceptedAmdContract, relationship_scope: "external" }), false);
assert.equal(isAcceptedAmdContract({ ...acceptedAmdContract, registry_status: "needs_review" }), false);
assert.equal(isAcceptedAmdContract({ ...acceptedAmdContract, registry_status: "candidate" }), false);
assert.equal(isCurrentAmdContract({ ...acceptedAmdContract, is_current_for_project: false }), false);
assert.equal(isStatutoryScheduleObligation({ category: "tax" }), true);
assert.equal(isStatutoryScheduleObligation({ category: "social_insurance" }), true);
assert.equal(isStatutoryScheduleObligation({ category: "invoice" }), false);

const actionBase = { review_status: "confirmed", status: "open", due_at: "2026-08-01" };
assert.equal(isScheduleActionItem({ ...actionBase, scope: "company", category: "engineering" }), true, "company action is included");
assert.equal(isScheduleActionItem({ ...actionBase, scope: "project", category: "税務" }), true, "project tax action is included");
assert.equal(isScheduleActionItem({ ...actionBase, scope: "project", source: "legal" }), true, "project legal action is included");
assert.equal(isScheduleActionItem({ ...actionBase, scope: "project", metadata_json: { classification: "Finance" } }), true, "project finance action is included");
assert.equal(isScheduleActionItem({ ...actionBase, scope: "project", category: "engineering", source: "jira" }), false, "general project engineering action is excluded");

for (const key of ["corporate_tax_filing", "withholding_monthly", "withholding_special", "social_insurance_month_end", "labor_insurance_annual_update"]) {
  const rule = OFFICIAL_RULES[key];
  assert.ok(rule, `${key} rule exists`);
  assert.ok(rule.officialRefs.length > 0, `${key} official reference exists`);
  assert.ok(rule.officialRefs.every((ref) => /^https:\/\/(www\.)?(nta\.go\.jp|nenkin\.go\.jp|www\.mhlw\.go\.jp)\//.test(ref.url)), `${key} uses official source`);
}

const generator = read("src/lib/admin-schedule/generator.ts");
const notifications = read("src/lib/admin-schedule/notifications.ts");
const rebuildRoute = read("src/app/api/admin/schedule/rebuild/route.ts");
const actionsRoute = read("src/app/api/admin/schedule/actions/route.ts");
const cronRoute = read("src/app/api/cron/company-schedule/route.ts");
const migration = read("scripts/migrations/178_admin_operating_calendar.sql");
const ui = read("src/components/admin/AdminScheduleClient.tsx");

assert.match(generator, /amountRole: "outgoing"/);
assert.match(generator, /amountRole: "contract_reference"/);
assert.doesNotMatch(generator, /amountFields\(amountYen, amountStatus, "incoming"\)/);
assert.match(generator, /amount_status/);
assert.match(generator, /notification_owner: input\.notificationOwner \?\? scheduleNotificationOwner\(\)/);
assert.match(generator, /const fromYm = ymFromDate\(from\)/);
assert.match(generator, /const toYm = ymFromDate\(to\)/);
assert.match(generator, /!fromYm \|\| !toYm/);
assert.match(generator, /\.gte\("ym", fromYm\)\.lte\("ym", toYm\)/);
assert.doesNotMatch(generator, /\.gte\("ym", from\.slice\(0, 7\)\)/);
assert.match(generator, /\.in\("category", \["tax", "social_insurance"\]\)/);
assert.match(generator, /counterparty: text\(row\.counterparty\)/);
assert.match(generator, /obligationStatus: text\(row\.status\)/);
assert.match(generator, /\.eq\("relationship_scope", "amd_contract"\)\.eq\("registry_status", "accepted"\)/);
assert.match(generator, /contracts\.filter\(isAcceptedAmdContract\)/);
assert.match(generator, /generateContracts\(contracts, projects, projectMembers, members, from, to\)/);
assert.match(generator, /projectOwnerId\(projectId, project \?\? \{\}, contract, projectMembers, members\)/);
assert.match(generator, /isContractSigningExpected\(contract\)/);
assert.match(generator, /const current = isCurrentAmdContract\(contract\)/);
assert.match(generator, /const currentContracts = contracts\.filter\(isCurrentAmdContract\)/);
assert.doesNotMatch(generator, /is_current_for_project !== false/);
assert.match(generator, /planMonthlyReportSchedule\(terms\)/);
assert.match(generator, /eventKind: "report_deadline_missing"/);
assert.match(generator, /if \(!dueOn\) \{\s*unresolvedMonths \+= 1;\s*continue;/m);
assert.match(generator, /if \(reportPlan\.kind === "contract_gap" \|\| unresolvedMonths > 0\)/);
assert.doesNotMatch(generator, /db\.from\("billing_cycles"\)/);
assert.doesNotMatch(generator, /generateBilling\(/);
assert.doesNotMatch(generator, /source: "billing_cycles"/);
assert.match(generator, /actionItems\.filter\(isScheduleActionItem\)/);
assert.doesNotMatch(generator, /checked_at: new Date\(\)/);
assert.doesNotMatch(generator, /status: "clean"/);
assert.match(generator, /checked_at: `\$\{reference\.asOf\}T00:00:00\+09:00`/);
assert.match(generator, /status: "reviewed"/);
assert.match(generator, /本文hash自動監視は別writer/);
assert.match(generator, /local rule bundle hash/);
assert.match(notifications, /notification_owner.*company_schedule/);
assert.match(notifications, /payment_obligation/);
assert.match(notifications, /company_schedule_notifications/);
assert.match(notifications, /schedule-v1:/);
assert.match(notifications, /AMD_OS_SCHEDULE_NOTIFICATIONS_ENABLED === "1"/);
assert.doesNotMatch(rebuildRoute, /amount_yen|due_on|owner_member_id/);
assert.doesNotMatch(actionsRoute, /amount_yen|due_on|owner_member_id/);
assert.match(actionsRoute, /company_schedule_actions/);
assert.match(actionsRoute, /const db = createAdminClient\(\)/);
assert.match(actionsRoute, /auth\.user\.email/);
assert.doesNotMatch(actionsRoute, /auth\.supabase/);
assert.match(migration, /company_schedule_actions_admin_select/);
assert.doesNotMatch(migration, /CREATE POLICY company_schedule_actions_admin_insert/);
assert.doesNotMatch(migration, /GRANT INSERT ON public\.company_schedule_actions/);
assert.match(cronRoute, /scheduleGenerationRange\(todayJst\(\)\)/);
assert.match(cronRoute, /sendScheduleNotificationsWhenEnabled/);
assert.match(ui, /年間締切レール/);
assert.match(ui, /data-testid="annual-payment-summary"/);
assert.match(ui, /data-testid="annual-payment-rail"/);
assert.match(ui, /data-testid="annual-operations-view"/);
assert.match(ui, /data-testid="schedule-calendar-tab"/);
assert.match(ui, /function OperationsMonthCard/);
assert.match(ui, /function PaymentRow/);
assert.match(ui, /支払先/);
assert.match(ui, /その他の運営/);
assert.match(ui, /const displayMonth = item\.due_on/);
assert.match(ui, /grid-cols-7/);
assert.match(ui, /md:grid-cols-2 xl:grid-cols-3/);
assert.match(ui, /data-testid="mobile-calendar"/);
assert.match(ui, /ほか\{remainder\}件/);
assert.match(ui, /hidden md:block.*DayAgenda/);
assert.match(ui, /setYear\(todayYear\)/);
assert.match(ui, /shiftMobileMonth/);
assert.match(ui, /月内・日付未確定/);
assert.match(ui, /日付を生成できない締切/);
assert.doesNotMatch(ui, /モバイルは月ごとのリスト/);
assert.doesNotMatch(ui, /予定を追加|日付を編集|金額を編集/);

console.log("admin schedule checks: ok");
