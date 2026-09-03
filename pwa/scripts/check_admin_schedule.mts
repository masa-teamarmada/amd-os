import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addDays, adjustToNextBusinessDay, dateAtDay, nextMonthDay, nextMonthEnd, rollingScheduleWindow, scheduleGenerationRange, ymFromDate } from "../src/lib/admin-schedule/date.ts";
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
  isEligibleTaxSocialObligation,
  isScheduleActionItem,
  isStatutoryScheduleObligation,
} from "../src/lib/admin-schedule/predicates.ts";
import { buildMonthGrid, CALENDAR_WEEKDAYS, isDatePrecisionDay, mondayIndex, rollingCalendarMonths } from "../src/lib/admin-schedule/calendar.ts";
import {
  annualPaymentSummary,
  counterpartyFor,
  formatScheduleYen,
  nextPayment,
  paymentTimingSummary,
} from "../src/lib/admin-schedule/operations.ts";
import { OFFICIAL_RULES } from "../src/lib/admin-schedule/rules/official.ts";
import {
  addInternalPrepMilestones,
  canonicalShareholderMeetingForYear,
  generateShareholderMeeting,
  INTERNAL_PREP_SPECS,
  paymentObligationEventKind,
  SHAREHOLDER_MEETING_FLOW,
} from "../src/lib/admin-schedule/generator.ts";
import type { GeneratedOccurrence, OperatingFact } from "../src/lib/admin-schedule/types.ts";

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

// --- rolling current-3..current+8 month window: range / cross-year / leap ---
assert.deepEqual(rollingScheduleWindow("2026-08-19"), { from: "2026-05-01", to: "2027-04-30" }, "default 3-back/8-forward window");
assert.deepEqual(rollingScheduleWindow("2026-02-10"), { from: "2025-11-01", to: "2026-10-31" }, "monthsBack crosses a year boundary");
assert.deepEqual(rollingScheduleWindow("2027-06-19"), { from: "2027-03-01", to: "2028-02-29" }, "monthsForward lands on a leap-year February");
assert.deepEqual(rollingScheduleWindow("2026-11-19", 3, 8), { from: "2026-08-01", to: "2027-07-31" }, "explicit monthsBack/monthsForward matches defaults");
assert.deepEqual(rollingCalendarMonths("202605", "202607"), [{ year: 2026, month: 5 }, { year: 2026, month: 6 }, { year: 2026, month: 7 }]);
assert.deepEqual(rollingCalendarMonths("202611", "202702"), [{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }, { year: 2027, month: 2 }], "month list rolls across a year boundary");

// --- Gmail unreviewed tax/social exclusion, retaining statutory/reviewed/manual ---
assert.equal(isEligibleTaxSocialObligation({ category: "tax", source_kind: "gmail", review_status: "unreviewed" }), false, "unreviewed gmail tax obligation is excluded");
assert.equal(isEligibleTaxSocialObligation({ category: "social_insurance", source_kind: "gmail", review_status: "" }), false, "blank review_status from gmail is treated as unreviewed");
assert.equal(isEligibleTaxSocialObligation({ category: "tax", source_kind: "gmail", reviewed_at: "2026-08-19T00:00:00Z" }), true, "gmail obligation with current-schema reviewed_at evidence is retained");
assert.equal(isEligibleTaxSocialObligation({ category: "tax", source_kind: "gmail", review_status: "reviewed" }), true, "reviewed gmail tax obligation is retained");
assert.equal(isEligibleTaxSocialObligation({ category: "social_insurance", source_kind: "gmail", review_status: "manual" }), true, "manual gmail social obligation is retained");
assert.equal(isEligibleTaxSocialObligation({ category: "tax", source_kind: "official_rule" }), true, "statutory-sourced obligation is retained regardless of review_status");
assert.equal(isEligibleTaxSocialObligation({ category: "invoice", source_kind: "gmail", review_status: "reviewed" }), false, "non tax/social category is excluded upstream");
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
  category: "labor",
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
const paymentTiming = paymentTimingSummary(paymentFixture, 2026, "2026-07-17");
assert.equal(paymentTiming.paid.totalAmountYen, 1_333_332, "completed remittances are not future cash outflow");
assert.equal(paymentTiming.reconcile.totalAmountYen, 686_554, "past-due open remittances need reconciliation");
assert.equal(paymentTiming.upcoming.totalAmountYen, 2_079_290, "future-dated remittances stay upcoming even when estimated");
assert.equal(paymentTiming.actionableAmountYen, 2_765_844, "actionable cash excludes already-paid remittances");
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
const scheduleApiRoute = read("src/app/api/admin/schedule/route.ts");
const cronRoute = read("src/app/api/cron/company-schedule/route.ts");
const migration = read("scripts/migrations/178_admin_operating_calendar.sql");
const ui = read("src/components/admin/AdminScheduleClient.tsx");

assert.doesNotMatch(ui, /過去3か月＋今月から9か月/, "the UI does not explain the rolling-window formula");
assert.match(ui, /この月にやること/, "each month exposes a readable action list");
assert.match(ui, /function MonthlyActionRow/, "monthly actions use a dedicated readable row");
assert.match(ui, /item\.title/, "monthly action rows show the full canonical title");
assert.doesNotMatch(ui, /function RollingEventPill/, "event titles are not squeezed into narrow day cells");

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
assert.match(generator, /obligations\.filter\(isEligibleTaxSocialObligation\)/);

// --- parent-linked internal prep milestones: event-kind-specific titles/leadDays, not a generic -10 offset ---
assert.match(generator, /function addInternalPrepMilestones/);
assert.match(generator, /addInternalPrepMilestones\(\[\.\.\.corporateTaxRows, \.\.\.corporateTaxInterimRows\], from, to\)/);
assert.match(generator, /addInternalPrepMilestones\(withholdingRows, from, to\)/);
assert.match(generator, /addInternalPrepMilestones\(socialInsuranceRows, from, to\)/);
assert.match(generator, /addInternalPrepMilestones\(laborInsuranceRows, from, to\)/);
assert.match(generator, /addInternalPrepMilestones\(paymentObligationRows, from, to\)/);
assert.doesNotMatch(generator, /offsetDays: -10/);

assert.equal(paymentObligationEventKind({ title: "法人税等（確定納付）", category: "tax" }), "corporate_tax_filing");
assert.equal(paymentObligationEventKind({ title: "法人税等（中間納付）", category: "tax" }), "corporate_tax_interim");
assert.equal(paymentObligationEventKind({ title: "源泉所得税（納期の特例）", category: "tax" }), "withholding_tax_payment");
assert.equal(paymentObligationEventKind({ title: "社会保険料（2026年7月分）", category: "social_insurance" }), "social_insurance_payment");
// 加算税・延滞税は本税と同じ種別にしない。徴収高計算書のような社内締切を派生させないため。
assert.equal(paymentObligationEventKind({ title: "源泉所得税 不納付加算税（2026年1-6月分）", category: "tax" }), "tax_penalty_payment");
assert.equal(paymentObligationEventKind({ title: "法人税等 延滞税", category: "tax" }), "tax_penalty_payment");
assert.equal(paymentObligationEventKind({ title: "健康保険・厚生年金保険料 延滞金", category: "social_insurance" }), "social_insurance_penalty_payment");
assert.equal(INTERNAL_PREP_SPECS.tax_penalty_payment, undefined);
assert.equal(INTERNAL_PREP_SPECS.social_insurance_penalty_payment, undefined);
assert.equal(paymentObligationEventKind({ title: "労働保険料（年度更新・2026年度）", category: "social_insurance" }), "labor_insurance_annual_update");
assert.equal(paymentObligationEventKind({ title: "消費税等（確定納付）", category: "tax" }), "tax_payment");

const buildParentOccurrence = (overrides: Partial<GeneratedOccurrence>): GeneratedOccurrence => ({
  occurrence_key: "company:tax:corporate-tax-filing:FY2026",
  source_hash: "parent-hash",
  scope: "company",
  category: "tax",
  event_kind: "corporate_tax_filing",
  title: "法人税確定申告・納付",
  period_key: "FY2026",
  due_on: "2027-05-31",
  due_ym: "202705",
  date_precision: "day",
  date_kind: "法定期限",
  amount_yen: null,
  amount_status: "unknown",
  amount_role: "outgoing",
  project_id: null,
  owner_member_id: "ID_KIYO",
  source_kind: "official_rule",
  source_id: "FY2026",
  source_refs_json: [],
  rule_key: "corporate_tax_filing",
  rule_version: "runtime-1",
  official_refs_json: [],
  resolution_href: "/admin/finance#payment-obligations",
  missing_reason: null,
  source_observed_at: "2026-06-01T00:00:00Z",
  rule_review_after: null,
  lifecycle_status: "open",
  generation_state: "generated",
  notification_owner: "none",
  metadata_json: { fiscalYear: 2026, periodEnd: "2027-03-31" },
  ...overrides,
});

for (const [eventKind, spec] of Object.entries(INTERNAL_PREP_SPECS)) {
  const parent = buildParentOccurrence({ event_kind: eventKind, occurrence_key: `company:test:${eventKind}` });
  const [milestone] = addInternalPrepMilestones([parent], "2020-01-01", "2030-12-31");
  assert.ok(milestone, `${eventKind} produces an internal-prep milestone`);
  assert.equal(milestone.title, spec.title, `${eventKind} internal-prep milestone uses its own title, not a generic label`);
  assert.equal(milestone.date_kind, "社内締切");
  assert.equal(milestone.due_on, addDays(parent.due_on as string, spec.offsetDays), "prep due date is the parent due date offset by leadDays");
  assert.equal(milestone.metadata_json.parentOccurrenceKey, parent.occurrence_key);
  assert.equal(milestone.metadata_json.parentEventKind, eventKind);
  assert.equal(milestone.metadata_json.leadDays, spec.offsetDays);
  assert.equal(milestone.metadata_json.parentSourceKind, parent.source_kind);
  assert.equal(milestone.metadata_json.parentSourceId, parent.source_id);
  assert.equal(milestone.metadata_json.parentSourceHash, parent.source_hash);
  assert.equal(milestone.metadata_json.fiscalYear, 2026, "parent metadata is preserved on the milestone");
  assert.equal(milestone.source_observed_at, parent.source_observed_at, "parent sourceObservedAt is preserved");
}
assert.deepEqual(addInternalPrepMilestones([buildParentOccurrence({ lifecycle_status: "needs_source" })], "2020-01-01", "2030-12-31"), [], "needs_source parents get no prep milestone");
assert.deepEqual(addInternalPrepMilestones([buildParentOccurrence({ event_kind: "monthly_report_submission" })], "2020-01-01", "2030-12-31"), [], "event kinds without a spec get no prep milestone");

// --- p00 shareholder meeting: month-precision needs_source guidance vs canonical -21/-14/0/+7 flow ---
assert.deepEqual(SHAREHOLDER_MEETING_FLOW.map((step) => step.days), [-21, -14, 0, 7]);
assert.match(generator, /elaws\.e-gov\.go\.jp|laws\.e-gov\.go\.jp/);
assert.match(generator, /417AC0000000086_20260624_508AC0000000046/);
assert.match(generator, /SHAREHOLDER_MEETING_AS_OF = "2026-08-19"/);
assert.match(generator, /generateShareholderMeeting\(facts, shareholderMeetings, ownerMemberId, from, to\)/);
assert.match(generator, /db\.from\("project_shareholder_meetings"\)/);
assert.match(generator, /\.eq\("project_id", "p00"\)/);
assert.match(generator, /\.in\("meeting_type", CANONICAL_SHAREHOLDER_MEETING_TYPES\)/);

const emptyFacts = new Map<string, OperatingFact>();
const guidanceRows = generateShareholderMeeting(emptyFacts, [], null, "2026-01-01", "2026-12-31");
assert.equal(guidanceRows.length, 2, "no authoritative date yields exactly two month-precision guidance rows");
const [prepGuidance, meetingGuidance] = guidanceRows;
assert.equal(prepGuidance.date_precision, "month");
assert.equal(prepGuidance.due_on, null, "no fake day is invented for the guidance row");
assert.equal(prepGuidance.due_ym, "202602");
assert.match(prepGuidance.title, /計算書類・事業報告・議案・招集通知の作成目安/);
assert.equal(prepGuidance.metadata_json.statutoryDeadline, false);
assert.match(String(prepGuidance.missing_reason), /正本要確認/);
assert.equal(meetingGuidance.due_ym, "202603");
assert.match(meetingGuidance.title, /定時株主総会/);
assert.doesNotMatch(meetingGuidance.title, /法定/);
assert.equal(meetingGuidance.metadata_json.statutoryDeadline, false);
assert.doesNotMatch(String(meetingGuidance.missing_reason), /会社法上の最短期間/, "no universal statutory three-month deadline is asserted");

const factsWithMeetingDate = new Map<string, OperatingFact>([
  ["shareholder_meeting_date", {
    fact_id: "f1",
    fact_key: "shareholder_meeting_date",
    value_json: { value: "2026-06-25" },
    source_kind: "company_profile_entries",
    source_ref: "company_profile_entries:shareholder_meeting_date",
    source_hash: "fact-hash",
    confidence: 0.7,
    valid_from: null,
    valid_to: null,
    observed_at: "2026-05-01T00:00:00Z",
    verified_at: null,
    superseded_at: null,
    updated_at: "2026-05-01T00:00:00Z",
  }],
]);
const factFlowRows = generateShareholderMeeting(factsWithMeetingDate, [], null, "2026-01-01", "2026-12-31");
assert.equal(factFlowRows.length, 4, "an operating-fact meeting date resolves the full -21/-14/0/+7 flow");
assert.deepEqual(factFlowRows.map((row) => row.due_on), ["2026-06-04", "2026-06-11", "2026-06-25", "2026-07-02"]);
assert.equal(factFlowRows.every((row) => row.metadata_json.authoritativeSource === "operating_fact"), true);
assert.equal(factFlowRows[0].title, "定時株主総会 / 計算書類・事業報告・議案・招集通知の確定");
assert.equal(factFlowRows[1].title, "定時株主総会 / 招集通知・総会資料の発送");
assert.equal(factFlowRows[2].title, "定時株主総会");
assert.equal(factFlowRows[3].title, "定時株主総会 / 株主総会議事録・登記要否の確認");
assert.equal(factFlowRows.every((row) => row.metadata_json.statutoryDeadline === false), true, "no step is ever claimed to be a Company Act statutory minimum");
assert.doesNotMatch(factFlowRows[1].title + String(factFlowRows[1].missing_reason ?? ""), /会社法上の最短期間/);

const canonicalMeetingRow = {
  id: "m-2026",
  project_id: "p00",
  meeting_type: "定時株主総会",
  meeting_date: "2026-06-28",
  source_ref: "docs/corporate/2026_sokai_gijiroku.pdf",
  updated_at: "2026-07-01T00:00:00Z",
};
assert.equal(canonicalShareholderMeetingForYear([canonicalMeetingRow], 2026)?.id, "m-2026");
assert.equal(canonicalShareholderMeetingForYear([canonicalMeetingRow], 2027), null);
const canonicalFlowRows = generateShareholderMeeting(emptyFacts, [canonicalMeetingRow], null, "2026-01-01", "2026-12-31");
assert.equal(canonicalFlowRows.length, 4, "a confirmed project_shareholder_meetings row takes priority over the operating fact and produces the full flow");
assert.deepEqual(canonicalFlowRows.map((row) => row.due_on), ["2026-06-07", "2026-06-14", "2026-06-28", "2026-07-05"]);
assert.equal(canonicalFlowRows.every((row) => row.metadata_json.authoritativeSource === "project_shareholder_meetings"), true);
assert.equal(canonicalFlowRows.every((row) => row.metadata_json.sourceRef === canonicalMeetingRow.source_ref), true);
assert.equal(canonicalFlowRows[0].source_refs_json.length, 1);
assert.equal((canonicalFlowRows[0].source_refs_json[0] as { kind: string }).kind, "project_shareholder_meetings");

// canonical row takes priority even when a stale operating fact points at a different year
const canonicalOverFact = generateShareholderMeeting(factsWithMeetingDate, [canonicalMeetingRow], null, "2026-01-01", "2026-12-31");
assert.deepEqual(canonicalOverFact.map((row) => row.due_on), ["2026-06-07", "2026-06-14", "2026-06-28", "2026-07-05"], "canonical row wins over the operating fact for the same year");
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
assert.match(scheduleApiRoute, /scheduleGenerationRange\(todayJst\(\)\)/);
assert.match(ui, /data-testid="rolling-schedule-calendar"/);
assert.match(ui, /rollingScheduleWindow/);
assert.match(ui, /rollingCalendarMonths/);
assert.doesNotMatch(ui, /過去3か月＋今月から9か月/);
assert.match(ui, /data-testid="rolling-calendar-months"/);
assert.match(ui, /function RollingCalendarMonth/);
assert.match(ui, /function MonthlyActionRow/);
assert.match(ui, /data-testid="annual-payment-summary"/);
assert.match(ui, /data-testid="annual-payment-rail"/);
assert.match(ui, /今から要対応の口座流出/);
assert.match(ui, /これからの口座流出/);
assert.match(ui, /納付済み/);
assert.match(ui, /paymentTimingSummary/);
assert.match(ui, /data-testid="annual-operations-view"/);
assert.match(ui, /data-testid="schedule-calendar-tab"/);
assert.match(ui, /function OperationsMonthCard/);
assert.match(ui, /function PaymentRow/);
assert.match(ui, /function PaymentLane/);
assert.match(ui, /支払先/);
assert.match(ui, /break-words text-\[13px\]/);
assert.match(ui, /その他の運営/);
assert.match(ui, /grid-cols-7/);
assert.match(ui, /grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3/);
assert.match(ui, /dateItems\.length\}件/);
assert.match(ui, /agendaDate && <DayAgenda/);
assert.match(ui, /今日へ移動/);
assert.match(ui, /function monthlyActionDate/);
assert.match(ui, /if \(item\.due_ym\) return "月内"/);
assert.match(ui, /日付を生成できない締切/);
assert.doesNotMatch(ui, /モバイルは月ごとのリスト/);
assert.doesNotMatch(ui, /予定を追加|日付を編集|金額を編集/);

console.log("admin schedule checks: ok");
