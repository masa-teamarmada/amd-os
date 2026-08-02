#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// Structural contract guards for the 2026-08 SX gantt/modal audit fixes. These check source
// invariants that a full DOM-mounted test would also verify, but this repo's SX test suite is
// pure-logic node scripts (no jsdom/testing-library harness) — matching that existing convention
// (see scripts/check_pwa_critical_ui.cjs) rather than introducing a new test runner for this one
// audit. Pure date/version-decision logic itself is unit-tested directly in
// scripts/test_sx_gantt_drag.mjs; this script guards the wiring around it.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}
function assertIncludes(rel, text, needles) {
  const missing = needles.filter((needle) => !text.includes(needle));
  if (missing.length > 0) throw new Error(`${rel} missing: ${missing.join(", ")}`);
}
function assertNotIncludes(rel, text, needles) {
  const present = needles.filter((needle) => text.includes(needle));
  if (present.length > 0) throw new Error(`${rel} must not contain: ${present.join(", ")}`);
}
function assertCount(rel, text, needle, expected) {
  const actual = countOccurrences(text, needle);
  if (actual !== expected) {
    throw new Error(`${rel}: expected ${expected} occurrence(s) of "${needle}", found ${actual}`);
  }
}

const timelineFile = "src/components/project-workspace/SxUnifiedTimeline.tsx";
const timeline = read(timelineFile);

// -- 1. Direct point confirmation never POSTs by itself; Y hands the parent a prefill -----------
assertNotIncludes(timelineFile, timeline, [
  // The old placeMilestone POSTed directly with a fetch call — that whole code path is retired.
  'method: "POST"',
]);
assertIncludes(timelineFile, timeline, [
  "function placeMilestone(laneKey: SxDisplayLaneKey, date: string) {",
  "const laneOutcomes = outcomes.filter(",
  "displayLaneKeyForTrack(item.track) === laneKey",
  "const singleOutcome = laneOutcomes.length === 1 ? laneOutcomes[0] : null;",
  "milestonePromptSubmittingRef.current = true;",
  "Y　追加する",
  "N　閉じる",
  "timelineKind: \"milestone\"",
]);

// -- 2. Resize handles register pointerdown only; pointermove/up/cancel handled once on RowBar --
// The parent <button> is the only element wired to the shared onPointerMove/onPointerUp/
// onPointerCancel props — if a resize handle span were ever wired to them again (the double-PATCH
// regression: the same event fires on the span, then bubbles and fires again on the button), this
// count would go to 2.
assertCount(timelineFile, timeline, "onPointerMove={onPointerMove}", 1);
assertCount(timelineFile, timeline, "onPointerUp={onPointerUp}", 1);
assertCount(timelineFile, timeline, "onPointerCancel={onPointerCancel}", 1);
// Resize handles keep pointerdown + lostpointercapture only.
assertCount(timelineFile, timeline, "onPointerDownResizeStart(event);", 1);
assertCount(timelineFile, timeline, "onPointerDownResizeEnd(event);", 1);
assertNotIncludes(timelineFile, timeline, ["isShortBarSpan", "shortBar"]);
assertIncludes(timelineFile, timeline, [
  "const TIMELINE_SIDE_GUTTER_PX = 22;",
  "const MIN_BAR_HIT_WIDTH_PX = 16;",
  "function barHitGeometryCss(startPct: number, endPct: number) {",
  "left: `calc(${barGeometry!.left} - 16px)`",
  "left: barGeometry!.right",
  "pointerOffsetToTimelinePct(clientX - rect.left, rect.width)",
  "canManage && row.plannedStart != null && row.plannedEnd != null && !isMilestoneMarker",
  "(row.isBlockingMilestone || row.plannedStart != null)",
  "if (dragRef.current?.saving) return;",
]);

// -- 3. Move-drag starts only from the actual bar/diamond hit target, never empty row space ------
assertNotIncludes(timelineFile, timeline, [
  // The retired bug: the whole row <button> started a move-drag from anywhere in the row.
  "if (draggableBar) onPointerDownMove(event);\n      else if (draggableMilestone) onPointerDownMove(event);",
]);
assertIncludes(timelineFile, timeline, [
  "const DRAG_HIT_HEIGHT = 44;",
  // Dedicated move/detail button spans the actual bar, not the row.
  "{draggableBar && (\n        <button",
  // Dedicated diamond move/detail button, separate from the blank timeline button.
  "{draggableMilestone && (\n        <button",
]);

// -- 4. Generic point-MS vs NewCo end-only move are different drag modes ------------------------
assertIncludes(timelineFile, timeline, [
  '"move" | "resize-start" | "resize-end" | "milestone-move" | "milestone-end-move"',
  "computeMilestoneMove({ plannedDate: current.original.plannedEnd }, deltaX, current.pxPerDay)",
  "computeGateEndMove(current.original, deltaX, current.pxPerDay)",
]);

// -- 5. Non-409 failure best-effort refetches, and reports if that refetch itself fails ----------
assertIncludes(timelineFile, timeline, [
  "async function bestEffortRefetchManagement(",
  "保存できたか確認できなかったよ。画面を再読み込みしてね",
]);

// -- 6. Generic MS labels say MS/マイルストーン, not 工程; NewCo may say 設立ゲート ----------------
assertIncludes(timelineFile, timeline, [
  "function rowKindLabel(row: DisplayRow): string {",
  'if (row.isBlockingMilestone) return "設立ゲート";',
  'if (row.timelineKind === "milestone") return "マイルストーン";',
]);

// -- 9. Three permanent task-writer rows; MS creation starts from a true blank date point -------
assertNotIncludes(timelineFile, timeline, [
  "msPlacementMode",
  "placementHover",
  "日付上に置く",
  "{!hasBar && (",
  'onCreateMilestone({ track: null, timelineKind: "milestone" })',
  'aria-label={`${lane.label}のこの日付にMSを追加`}',
]);
assertIncludes(timelineFile, timeline, [
  "data-gantt-add-task-lane={lane.key}",
  "onClick={() => onCreateTask(lane.key)}",
  "新規タスク",
  "onTimelinePoint={(event) =>",
  "proposeMilestone(lane.key, event)",
  'aria-label={`${lane.label}のモバイル日付軸でMSを追加`}',
  "const MILESTONE_PROMPT_FLIP_Y = 138;",
  'side: clientY < MILESTONE_PROMPT_FLIP_Y ? "below" : "above"',
  'event.detail === 0 ? rect.left + rect.width / 2 : event.clientX',
  'className="pointer-events-none absolute inset-x-1 top-0.5',
  'role="dialog"',
  'aria-modal="false"',
]);
assertCount(timelineFile, timeline, "data-gantt-add-task-lane={lane.key}", 2);
assertCount(timelineFile, timeline, "onClick={() => onCreateTask(lane.key)}", 2);

// -- 10. No role=alertdialog; exactly one shared inline-edit tray for PlanInspector ---------------
const dashboardFile = "src/components/project-workspace/SxWeeklyControlDashboard.tsx";
const dashboard = read(dashboardFile);
assertNotIncludes(dashboardFile, dashboard, [
  'role="alertdialog"',
  // Retired split: FACT_SLOTS restricted the shared tray to only 5 of the editable values.
  "FACT_SLOTS",
  "factEditableValue",
]);
assertCount(dashboardFile, dashboard, "className={styles.inspectorEditTray}", 1);
assertIncludes(dashboardFile, dashboard, [
  'role="status" aria-live="assertive"',
  "className={styles.unsavedIndicator}",
  "const pendingPlanIntentRef = useRef<(() => void) | null>(null);",
  "pendingPlanIntentRef.current = intent;",
  "const lastFocusedFieldNameRef = useRef<string | null>(null);",
  "function focusLastEditableField() {",
  "onFocusCapture={rememberFocusedField}",
  "if (pendingIntent) pendingIntent();",
  'aria-label={`${targetLabel}の${label}を直接修正`}',
  'ariaDescribedBy="sx-plan-editor-context"',
  'label: "接続する工程"',
  "taskParentMilestones(management, editor.laneKey)",
  "const candidates = management.milestones.filter(",
  "management.judgment.dagValid",
  "candidates.filter(sxIsBlockingMilestone)",
  'milestone.status !== "completed"',
  '.filter((task) => task.milestoneId === values.milestone_id)',
  'current.milestone_id !== nextValue',
  '? { parent_task_id: "" }',
  'fields.track = selectedTaskMilestone?.track || "";',
]);

const selectRendererStart = dashboard.indexOf(') : field.type === "select" ? (');
const selectRendererEnd = dashboard.indexOf(
  ') : field.type === "checkbox" ? (',
  selectRendererStart,
);
if (selectRendererStart < 0 || selectRendererEnd < 0) {
  throw new Error(`${dashboardFile}: select field renderer not found`);
}
const selectRenderer = dashboard.slice(selectRendererStart, selectRendererEnd);
assertIncludes(dashboardFile, selectRenderer, [
  'field.key === "milestone_id"',
  'current.milestone_id !== nextValue',
  '? { parent_task_id: "" }',
]);
const textareaRenderer = dashboard.slice(
  dashboard.indexOf('field.type === "textarea" ? ('),
  selectRendererStart,
);
assertNotIncludes(dashboardFile, textareaRenderer, [
  'field.key === "milestone_id"',
  'parent_task_id',
]);
assertNotIncludes(dashboardFile, dashboard, [
  "data-plan-add-child",
  "onAddChild",
]);

// -- 11. Gantt creation speaks exactly 3 display lanes; raw 4-track DB taxonomy stays hidden ---
// The selected outcome is the parent of record and supplies the exact raw track at save time.
// This lets funding + organizational_building share one visible 組織開発 lane without weakening
// the DB invariant milestone.track === outcome.track.
const createMilestoneDefinitionStart = dashboard.indexOf(
  'if (editor.kind === "create_milestone") {',
  dashboard.indexOf("function editorDefinition"),
);
const createMilestoneDefinitionEnd = dashboard.indexOf(
  'if (editor.kind === "edit_milestone")',
  createMilestoneDefinitionStart,
);
if (createMilestoneDefinitionStart < 0 || createMilestoneDefinitionEnd < 0) {
  throw new Error(`${dashboardFile}: create_milestone definition block not found`);
}
const createMilestoneDefinition = dashboard.slice(
  createMilestoneDefinitionStart,
  createMilestoneDefinitionEnd,
);
assertNotIncludes(dashboardFile, createMilestoneDefinition, [
  'key: "track"',
  "TRACKS.map((track)",
]);
assertIncludes(dashboardFile, dashboard, [
  "function ganttLaneLabelForTrack(track: SxTrackKey)",
  'return "組織開発";',
  'label: "接続する成果（配置レーン）"',
  'label: `${ganttLaneLabelForTrack(outcome.track)}｜${outcome.title}`',
  "const selectedMilestoneOutcome =",
  'fields.track = selectedMilestoneOutcome?.track || "";',
]);
const weeklyCssFile = "src/components/project-workspace/weekly-control.module.css";
const weeklyCss = read(weeklyCssFile);
assertIncludes(weeklyCssFile, weeklyCss, [
  '.editorPanel[data-editor-width="wide"] { width: min(840px, calc(100vw - 48px)); }',
  '.editorPanel,\n  .editorPanel[data-editor-width="wide"] { width: 100%;',
  "background: rgba(36, 35, 31, .46); backdrop-filter: blur(4px);",
  "font-size: 16px;",
]);

// -- expected_version required (400 missing/invalid, 409 stale); CAS rollback by updated version --
const routeFile = "src/app/api/project-workspace/[projectId]/management/route.ts";
const route = read(routeFile);
assertNotIncludes(routeFile, route, [
  // Retired: expected_version used to be optional for milestone/task PATCH.
  "function optionalExpectedVersion(",
]);
assertIncludes(routeFile, route, [
  "function requiredExpectedVersion(value: unknown): number {",
  "expectedVersion = requiredExpectedVersion(body.expected_version);",
  'if (Number(beforeRecord.version) !== expectedVersion) {',
  // History-insert compensation rollback CASes on the version our own update just produced.
  "if (hasVersionColumn && updatedVersion != null) rollbackQuery = rollbackQuery.eq(\"version\", updatedVersion);",
  "補償復元は安全に実行できなかったよ",
  // Milestone parent integrity (outcome belongs to objective; outcome.track === milestone.track).
  "async function assertMilestoneParentIntegrity(",
]);

// -- The 2 NewCo blocking-gate exception is scoped to project_id='p21' AND the 2 slugs, not slug --
// alone — a same-named slug in a different project must not inherit the point-MS invariant
// exemption or the delete/restore expected_version bypass.
assertIncludes(routeFile, route, [
  'const SX_BLOCKING_MILESTONE_PROJECT_ID = "p21";',
  "function isBlockingMilestoneSlug(projectId: string, slug: string): boolean {",
  "projectId === SX_BLOCKING_MILESTONE_PROJECT_ID &&",
  "isBlockingMilestoneSlug(projectId, slug)",
  "isBlockingMilestoneSlug(projectId, String(beforeRecord.slug))",
]);
assertNotIncludes(routeFile, route, [
  // Retired: the old single-arg signature checked slug alone, with no project scoping.
  "function isBlockingMilestoneSlug(slug: string): boolean {",
]);
// delete/restore are intentionally exempt from expected_version (documented, not a bug) — the
// guard that actually implements the exemption must still be in place.
assertIncludes(routeFile, route, [
  "EXEMPT: soft-delete (`delete: true`) and restore (`restore: true`) calls for these same two",
  'if ((resource === "milestone" || resource === "task") && !deleting && !restoring) {',
]);

// -- migration 220: p21+slug-scoped point-MS exception, and a general (all-project) DB-level ----
// milestone parent-integrity trigger with its own precheck.
const migrationFile = "scripts/migrations/220_sx_gantt_direct_editing.sql";
const migration = read(migrationFile);
assertIncludes(migrationFile, migration, [
  // Backfill scoped to p21, not a blanket slug match.
  "WHERE project_id = 'p21'\n  AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')",
  // Point-MS CHECK exemption scoped to p21+slug, not slug alone.
  "OR (project_id = 'p21' AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement'))",
  "NOT (\n      project_id = 'p21'\n      AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')\n    )",
  // Parent-integrity precheck + trigger (general invariant, no project_id restriction).
  "project_management_milestone_parent_integrity()",
  "CREATE TRIGGER project_management_milestones_parent_integrity_trigger",
  "BEFORE INSERT OR UPDATE OF project_id, outcome_id, objective_id, track, deleted_at ON public.project_management_milestones",
  "LEFT JOIN public.project_management_objectives obj ON obj.id = m.objective_id",
  "o.deleted_at IS NOT NULL",
  "obj.deleted_at IS NOT NULL",
  "o.project_id IS DISTINCT FROM m.project_id",
  "obj.project_id IS DISTINCT FROM m.project_id",
  "outcome_objective_id IS DISTINCT FROM NEW.objective_id",
  "project_management_outcome_preserve_milestones()",
  "BEFORE UPDATE OF project_id, objective_id, track, deleted_at ON public.project_management_outcomes",
  "project_management_objective_preserve_milestones()",
  "BEFORE UPDATE OF project_id, deleted_at ON public.project_management_objectives",
]);

// -- Legacy workspace/nav edit paths must refresh and close stale editors on 409 ---------------
const workspaceFile = "src/components/project-workspace/ProjectWorkspaceDashboard.tsx";
const workspace = read(workspaceFile);
assertIncludes(workspaceFile, workspace, [
  "if (response.status === 409) {",
  'headers: { "Cache-Control": "no-store" }',
  "onConflict(latestBody as SxManagementBundle);",
  "timeline_kind: prefill.timelineKind",
  "planned_start: prefill.plannedDate, planned_end: prefill.plannedDate",
  "outcome_id: prefill.outcomeId",
  "track: prefill.track || outcome!.track",
]);
const managementEditorFile = "src/components/project-navigation/ManagementEditor.tsx";
const managementEditor = read(managementEditorFile);
assertIncludes(managementEditorFile, managementEditor, [
  "if (response.status === 409) {",
  'headers: { "Cache-Control": "no-store" }',
  'new CustomEvent("amd-management-conflict"',
  "router.refresh();",
  "return true;",
]);

console.log("sx gantt ui contract tests passed");
