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
function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

const timelineFile = "src/components/project-workspace/SxUnifiedTimeline.tsx";
const timeline = read(timelineFile);

// -- 1. Direct point confirmation never POSTs by itself; Y hands the parent a prefill -----------
assertIncludes(timelineFile, timeline, [
  "function placeMilestone(laneKey: SxDisplayLaneKey, date: string) {",
  "const laneOutcomes = outcomes.filter(",
  // 2026-08-13: レーン導出を src/lib/sx-display-lanes.ts の buildSxLaneFold へ集約。
  // 意味は不変 (このレーンへ写る outcome だけを親候補にする)。
  "laneFold.laneKeyForTrack(item.track) === laneKey",
  "const singleOutcome = laneOutcomes.length === 1 ? laneOutcomes[0] : null;",
  "milestonePromptSubmittingRef.current = true;",
  "Y　追加する",
  "N　閉じる",
  "timelineKind: \"milestone\"",
  // The only direct POST owned by the timeline is the separate schedule dependency resource;
  // point-MS placement itself still only calls onCreateMilestone with a prefill.
  'resource: "schedule_dependency"',
]);
const placeMilestoneBlock = timeline.slice(
  timeline.indexOf("function placeMilestone("),
  timeline.indexOf("return (", timeline.indexOf("function placeMilestone(")),
);
assertNotIncludes(timelineFile, placeMilestoneBlock, ["fetch(", 'method: "POST"']);

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
  "const TASK_BAR_HEIGHT_PX = 10;",
  "const TASK_BAR_TOP_PX = (ROW_H - TASK_BAR_HEIGHT_PX) / 2;",
  "data-gantt-task-bar={row.id}",
  "visibleBarGeometryPx(",
  "buildFinishToStartRoute(",
  "function dependencySourcePoint(row: DisplayRow, paneWidth: number) {",
  "const sourcePoint = dependencySourcePoint(row, paneRect.width);",
  "const sourcePoint = dependencySourcePoint(row, gridPaneWidth);",
  'refX="8"',
  'markerWidth="8"',
  'markerHeight="8"',
  'markerUnits="userSpaceOnUse"',
  "function barHitGeometryCss(startPct: number, endPct: number) {",
  "left: `calc(${barGeometry!.left} - 16px)`",
  "left: barGeometry!.right",
  "pointerOffsetToTimelinePct(clientX - rect.left, rect.width)",
  "canManage && !connectionDrafting && row.plannedStart != null && row.plannedEnd != null && !isMilestoneMarker",
  "(row.isBlockingMilestone || row.plannedStart != null)",
  "if (dragRef.current?.saving) return;",
]);
assertNotIncludes(timelineFile, timeline, [
  'className="pointer-events-none absolute h-[8px]',
  'orient="auto-start-reverse"',
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

// -- 6. The visible gantt has task rows only; MSs span the owning lane, never fake task rows --
assertNotIncludes(timelineFile, timeline, [
  "function rowKindLabel(row: DisplayRow): string {",
  "工程の直下に戻す",
  "data-gantt-nest-root-milestone",
]);
assertIncludes(timelineFile, timeline, [
  "function milestoneAnchorRow(",
  "data-gantt-lane-milestone-spine={milestone.id}",
  "data-gantt-milestone-marker={milestone.id}",
  "title: milestone.title,",
  "Point-MS records are kept",
  "最上位タスクに戻す",
  // 折りたたみ中は rows が空になるため、件数は畳んでも変わらない taskCount から出す（v3.58.14）
  "MS {laneMilestones.length} / タスク {taskCount}",
  "日程未登録のMS",
  "if (task.track) return laneFold.laneKeyForTrack(task.track);",
  "Only the MS marker is forced to the blocking-milestone lane",
]);
assertNotIncludes(timelineFile, timeline, [
  "title: milestone.gate || milestone.title",
  "sxMilestoneRequiredTaskSummary",
  "requiredTaskSummary",
  "必須タスク",
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
  'role="dialog"',
  'aria-modal="false"',
]);
assertCount(timelineFile, timeline, "data-gantt-add-task-lane={lane.key}", 2);
assertCount(timelineFile, timeline, "onClick={() => onCreateTask(lane.key)}", 2);

// -- 9b. The illustrative 12-task seed is a recoverable removal, not a broad task deletion ---
const fineSeedRemovalMigrationFile = "scripts/migrations/228_sx_remove_fine_seed_tasks.sql";
const fineSeedRemovalMigration = read(fineSeedRemovalMigrationFile);
assertIncludes(fineSeedRemovalMigrationFile, fineSeedRemovalMigration, [
  "UPDATE public.project_management_tasks",
  "deleted_at = now()",
  "deleted_by = 'migration:228_sx_remove_fine_seed_tasks'",
  "source_ref = '2026-08-02 週次管制 設立前提レーン要件'",
  "status = 'unassessed'",
  "planned_start IS NULL",
  "planned_end IS NULL",
  "actual_end IS NULL",
]);
assertNotIncludes(fineSeedRemovalMigrationFile, fineSeedRemovalMigration, ["DELETE FROM"]);

// -- 9c. The surviving MS copy cannot retain the removed detailed checklist -------------------
const gateCopyMigrationFile = "scripts/migrations/229_sx_remove_seeded_gate_checklists.sql";
const gateCopyMigration = read(gateCopyMigrationFile);
assertIncludes(gateCopyMigrationFile, gateCopyMigration, [
  "UPDATE public.project_management_milestones",
  "slug = 'business-paid-poc-oral-agreement'",
  "slug = 'funding-investment-oral-agreement'",
  "1社の有償PoC口頭合意を確認する",
  "出資の口頭合意を確認する",
  "next_deliverable LIKE 'NewCo設立の最低条件は1社の有償PoC口頭合意。A.%'",
  "next_deliverable LIKE '現時点は事業計画が未完成でDDは未着手。A.%'",
]);

// -- 9d. The live p21 gantt starts from exactly the nine agreed MS-derived root tasks ---------
const rootTaskReplacementMigrationFile =
  "scripts/migrations/230_sx_replace_root_tasks_from_newco_gates.sql";
const rootTaskReplacementMigration = read(rootTaskReplacementMigrationFile);
assertIncludes(rootTaskReplacementMigrationFile, rootTaskReplacementMigration, [
  "UPDATE public.project_management_schedule_dependencies",
  "UPDATE public.project_management_tasks",
  "deleted_by = 'migration:230_sx_replace_root_tasks_from_newco_gates'",
  "'business-paid-poc-oral-agreement'",
  "'funding-investment-oral-agreement'",
  "'対象企業と、有償で導入検討するための判断条件を定める'",
  "'実排液で判断条件を検証できるPoC装置を完成させる'",
  "'実排液で、費用を払う価値がある成果を実証する'",
  "'1社に有償PoCを提案し、条件交渉を完了する'",
  "'ユニットエコノミクスの成立性を検証する'",
  "'NewCoの事業実行体制と権利関係を固める'",
  "'投資判断に耐える事業計画を完成させる'",
  "'出資候補を絞り、DDを完了する'",
  "'出資条件の交渉を完了する'",
  "parent_task_id IS NULL",
  "active_task_count <> 9",
  "active_replacement_count <> 9",
  "successor_type text",
  "successor_milestone_id uuid",
  "schedule dependency would create a cycle",
  "active_dependency_count <> 9",
  "active_task_target_count <> 7",
  "paid_poc_milestone_link_count <> 1",
  "funding_milestone_link_count <> 1",
  "project_management_schedule_dependencies_task_to_milestone_unique",
  "'21c2a6fc-746e-46f4-9a54-6fd2eb4533b9'::uuid,\n      'milestone',\n      NULL::uuid,\n      'business-paid-poc-oral-agreement'",
  "'504ef913-7f24-4ca6-a580-e957d06c7809'::uuid,\n      'milestone',\n      NULL::uuid,\n      'funding-investment-oral-agreement'",
  "LEFT JOIN public.project_management_milestones successor_milestone",
]);
assertNotIncludes(rootTaskReplacementMigrationFile, rootTaskReplacementMigration, [
  "DELETE FROM",
]);

// -- 9e. Compact gantt titles preserve the original sentence in the detail description --------
const compactTaskTitleMigrationFile =
  "scripts/migrations/232_sx_shorten_newco_root_task_titles.sql";
const compactTaskTitleMigration = read(compactTaskTitleMigrationFile);
assertIncludes(compactTaskTitleMigrationFile, compactTaskTitleMigration, [
  "matched_count <> 9",
  "final_count <> 9",
  "NULLIF(btrim(task.description), '') IS NULL THEN expected.old_title",
  "task.title = expected.old_title",
  "'導入判断条件の定義'",
  "'実排液PoC装置の完成'",
  "'ユニットエコノミクス検証'",
  "'NewCo体制・権利確定'",
  "'出資候補選定・DD'",
]);
assertNotIncludes(compactTaskTitleMigrationFile, compactTaskTitleMigration, [
  "DELETE FROM",
]);

// -- 10. No role=alertdialog or nested editor: every PlanInspector value edits in place ---------
const dashboardFile = "src/components/project-workspace/SxWeeklyControlDashboard.tsx";
const dashboard = read(dashboardFile);
assertNotIncludes(dashboardFile, dashboard, [
  'role="alertdialog"',
  // Retired split: FACT_SLOTS restricted the shared tray to only 5 of the editable values.
  "FACT_SLOTS",
  "factEditableValue",
]);
assertNotIncludes(dashboardFile, dashboard, [
  "className={styles.inspectorEditTray}",
  "編集中｜",
  'label: "接続する工程"',
  "taskParentMilestones(management, editor.laneKey)",
  "親にしたいタスクまたは工程へドラッグ",
]);
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
  'taskParentTitle: string | null;',
  "タスク階層",
  'ガント左のグリップを、親にしたいタスクへドラッグ',
  // 2026-08-13: レーン導出の共有化で laneFold を引数に取るようになった (意味は不変)。
  "taskBackingMilestone(management, laneFold, editor.laneKey)",
  "const candidates = management.milestones.filter(",
  'milestone.status !== "completed"',
  'fields.track = selectedTaskMilestone?.track || "";',
  "className={styles.inspectorInlineSlot}",
  "className={styles.inspectorTitleEditor}",
  // 柱がPJ属性になったので、既定レーンの固定文字列 "organizational_building" は持たない。
  // ラベル解決は laneFold 経由 (未知トラックは先頭の柱へフォールバック)。
  "ganttLaneLabelForTrack(laneFold, task.track || milestone?.track)",
]);
assertNotIncludes(dashboardFile, dashboard, [
  'label: "ネスト先（親タスク）"',
  '"item-parent-task"',
]);
assertIncludes(timelineFile, timeline, [
  'from "@/lib/sx-gantt-task-nesting"',
  "taskNestCandidateIds(tasks, taskNestDrag?.taskId ?? null)",
  "data-gantt-task-nest-handle",
  "data-gantt-nest-target-task",
  "data-gantt-nest-root-lane",
  "data-gantt-milestone-marker",
  // 2026-08-08 #15: 別レーン移動で track も一緒にPATCHするため patch 変数化した
  "{ parent_task_id: parentTaskId, track: laneFold.trackForLane(crossLane) }",
  "ここを親タスクにする",
  "最上位タスクに戻す",
]);
assertNotIncludes(timelineFile, timeline, [
  'pointer-events-none absolute top-[13px] -translate-x-1/2 text-center',
]);

const createTaskDefinitionStart = dashboard.indexOf(
  'if (editor.kind === "create_task" || editor.kind === "edit_task")',
  dashboard.indexOf("function editorDefinition"),
);
const createTaskDefinitionEnd = dashboard.indexOf(
  'if (editor.kind === "create_dependency"',
  createTaskDefinitionStart,
);
const taskDefinition = dashboard.slice(createTaskDefinitionStart, createTaskDefinitionEnd);
assertNotIncludes(dashboardFile, taskDefinition, [
  'key: "milestone_id"',
  'key: "parent_task_id"',
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
  // 配置先はグループの複数選択。個別の成果/タスクを1件選ばせる形へ戻さない。
  'key: "outcome_id"',
]);
assertIncludes(dashboardFile, dashboard, [
  // 2026-08-13: 柱がPJ属性になり、レーンのラベル解決は laneFold 経由になった。
  // p21の「組織開発」への合流ラベルは src/lib/sx-display-lanes.ts 側のアンカーで担保する。
  "function ganttLaneLabelForTrack(laneFold: SxLaneFold",
  // MSが立つ場所は「グループ」で選ぶ。1件で複数グループにまたがれる。DBの親成果は
  // 選んだ先頭グループから逆算するので、人に生のtrack/outcomeを見せない。
  'label: "配置するグループ"',
  'type: "lanes"',
  "function ganttLaneChoices(",
  "function milestoneOutcomeForLane(",
  "const selectedMilestoneOutcome =",
  "fields.display_lane_keys = selectedMilestoneLanes;",
  'fields.track = selectedMilestoneOutcome?.track || "";',
]);

// -- Point-MS creation stays lightweight: place/name/date are required, completion is optional --
const createMilestoneInitialStart = dashboard.indexOf(
  'if (editor.kind === "create_milestone") {',
  dashboard.indexOf("function editorInitialValues"),
);
const createMilestoneInitialEnd = dashboard.indexOf(
  'if (editor.kind === "edit_milestone")',
  createMilestoneInitialStart,
);
const createMilestoneInitial = dashboard.slice(
  createMilestoneInitialStart,
  createMilestoneInitialEnd,
);
assertIncludes(dashboardFile, createMilestoneInitial, [
  'display_lane_keys: editor.laneKey || ""',
  'title: ""',
  'planned_date: editor.plannedDate || ""',
  'completion_criteria: ""',
]);
assertNotIncludes(dashboardFile, createMilestoneInitial, [
  "gate:",
  "owner_label:",
  "next_deliverable:",
  "max_issue:",
  "criticality:",
  "confidence:",
]);
assertIncludes(dashboardFile, createMilestoneDefinition, [
  'key: "planned_date"',
  'label: "予定日"',
  "required: true",
  'key: "completion_criteria"',
  'label: "完了条件（任意）"',
]);
assertNotIncludes(dashboardFile, createMilestoneDefinition, [
  'key: "gate"',
  'key: "owner_label"',
  'key: "next_deliverable"',
  'key: "criticality"',
]);
const weeklyCssFile = "src/components/project-workspace/weekly-control.module.css";
const weeklyCss = read(weeklyCssFile);
assertIncludes(weeklyCssFile, weeklyCss, [
  '.editorPanel[data-editor-width="wide"] { width: min(760px, calc(100vw - 48px)); }',
  '.planInspector { display: flex; width: min(820px, calc(100vw - 48px)); max-height: min(720px, calc(100dvh - 48px));',
  '.field input, .field select, .field textarea, .fieldSpan input, .fieldSpan select, .fieldSpan textarea { width: 100%; min-height: 36px;',
  '.editorFooter .primaryButton, .editorFooter .secondaryButton, .editorFooter .dangerButton { min-height: 38px; }',
  '.editorPanel,\n  .editorPanel[data-editor-width="wide"] { width: 100%;',
  // v3.66.0: AMD標準カラートーン刷新でbackdrop rgba(36, 35, 31, .46)→rgba(29, 29, 31, .46) に置換
  "background: rgba(29, 29, 31, .46); backdrop-filter: blur(4px);",
  "font-size: 16px;",
]);

// -- Schedule dependency drawing is an always-on "+" port, separate from NewCo gate dependencies ----
assertIncludes(timelineFile, timeline, [
  "scheduleDependencies?: SxScheduleDependency[];",
  "const dependencyDrawingEnabled = canManage && Boolean(projectId);",
  "const connectionDrafting = connectionSourceId != null;",
  "dependencyEnabled &&",
  "dependencyEnabled={dependencyDrawingEnabled}",
  '<Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />',
  "ドラッグして他のタスク・MSへ依存線を引く",
  'resource: "schedule_dependency"',
  'data-gantt-dependency-source={`${row.entity}:${row.id}`}',
  'data-gantt-dependency-target-entity={row.entity}',
  'data-gantt-dependency-target-id={row.id}',
  'data-gantt-dependency-target-entity=',
  "data-gantt-schedule-dependency-lines",
  "data-gantt-time-scale",
  "onPointerDownDependency={beginScheduleDependency}",
  "beginKeyboardScheduleDependency(row)",
  "接続先のタスクかMSを選んでね。Escで中止できるよ",
  "removeScheduleDependency(\n                        hoveredScheduleDependency.id,",
  "data-gantt-schedule-dependency-hit={edge.dependency.id}",
  "data-gantt-schedule-dependency-hover-remove",
  "DEPENDENCY_EDGE_HIT_WIDTH_PX = 10",
  "DEPENDENCY_HOVER_ACTION_WIDTH_PX = 56",
  "onPointerEnter={(event) =>",
  "hideScheduleDependencyActionsAfterLeave(",
  "A click arms the source",
  "起点と終点を順にクリックしてね",
  'data-gantt-sticky-header',
  'className="sticky top-0 z-50 grid',
  'className="sticky left-0 z-[51]',
  "const MONTH_ROW_H = 44;",
  "const MONTH_YEAR_ROW_H = 15;",
  // 年は月より上の段。重ねない。
  // v3.66.0: AMD標準カラートーン刷新で#24231f→#1d1d1f, #5f5a4d→#3c3c43, #5f4a66→#7c3aed に置換
  'className="absolute top-0 pl-1 text-[9px] font-bold leading-none text-[#1d1d1f]"',
  "{month.yearLabel}",
  'className={`absolute bottom-0 pl-1 text-[9px] ${month.isYearStart ? "font-bold text-[#1d1d1f]" : "text-[#3c3c43]"}`}',
  'className="absolute z-10 flex -translate-x-full items-center gap-0.5 whitespace-nowrap pr-1 text-[9px] font-bold leading-none text-[#7c3aed]"',
  'data-gantt-milestone-diamond={milestone.id}',
  'absolute -top-[5px] left-0 grid h-11 w-11',
  'markerPct >= 60 ? "right-3 pr-2 text-right" : "left-3 pl-2 text-left"',
  'max-h-[min(72vh,720px)] overflow-auto overscroll-contain',
  'aria-label="ガントチャート。上下左右にスクロールできる"',
]);
assertNotIncludes(timelineFile, timeline, [
  'className="absolute bottom-0 z-10 flex -translate-x-full',
  // 凡例は廃止 (2026-08-07)。読み方の説明はガント本体の表示で担保する。
  "function Legend()",
  "<Legend />",
  // レーン見出しの「詰まり」表示は廃止 (2026-08-07)。
  "詰まり: {lane.maxIssue}",
  // Dependency drawing must stay a permanent affordance: no mode toggle may come back.
  "dependencyMode",
]);
// -- MS is a lane-spanning gate: dependency lines meet it at the middle of the band, and one MS
// -- record can be drawn in several groups at once (display_lane_keys) ------------------------
assertIncludes(timelineFile, timeline, [
  "centerY: laneTop + laneSpanH / 2",
  "const chosenLanes = milestone.displayLaneKeys.filter(",
  "for (const laneKey of laneKeys)",
]);

// -- Manual task ordering: drag the grip, drop on a row edge to reorder, on the middle to nest --
assertIncludes(timelineFile, timeline, [
  "TASK_REORDER_EDGE_RATIO = 0.32",
  'kind: "reorder"; taskId: string; place: "before" | "after"',
  "function commitTaskReorder(",
  "function orderedSiblings(",
  "sort_order:",
  "data-gantt-task-reorder-indicator={reorderPlace}",
  // The dragged row must follow the pointer, not move invisibly.
  "data-gantt-task-drag-ghost={taskNestDrag.taskId}",
  "left: taskNestDrag.pointerClientX + 12",
]);

const scheduleMigrationFile =
  "scripts/migrations/221_sx_gantt_schedule_dependencies.sql";
const scheduleMigration = read(scheduleMigrationFile);
assertIncludes(scheduleMigrationFile, scheduleMigration, [
  "CREATE TABLE IF NOT EXISTS public.project_management_schedule_dependencies",
  "predecessor_task_id uuid REFERENCES public.project_management_tasks(id)",
  "predecessor_milestone_id uuid REFERENCES public.project_management_milestones(id)",
  "successor_task_id uuid NOT NULL REFERENCES public.project_management_tasks(id)",
  "pg_advisory_xact_lock",
  "schedule dependency would create a task cycle",
  "a milestone cannot gate a task that belongs to itself",
  "project_management_schedule_endpoint_guard",
  "disconnect active gantt dependencies before deleting this task",
  "a task cannot move under the milestone that gates it",
  "FOR UPDATE",
  "updated_by text",
  "project_management_schedule_dependencies_task_unique",
  "project_management_schedule_dependencies_milestone_unique",
]);
const endpointLockIndex = scheduleMigration.indexOf("ORDER BY id\n    FOR UPDATE;");
const graphLockIndex = scheduleMigration.indexOf(
  "pg_advisory_xact_lock(hashtextextended('sx-gantt-dependency:' || NEW.project_id, 0))",
);
assertTrue(endpointLockIndex >= 0, `${scheduleMigrationFile}: deterministic endpoint lock missing`);
assertTrue(graphLockIndex >= 0, `${scheduleMigrationFile}: graph advisory lock missing`);
assertTrue(
  endpointLockIndex < graphLockIndex,
  `${scheduleMigrationFile}: endpoint rows must be locked before the project advisory lock`,
);
const lockOrderMigrationFile = "scripts/migrations/222_sx_gantt_dependency_lock_order.sql";
const lockOrderMigration = read(lockOrderMigrationFile);
assertIncludes(lockOrderMigrationFile, lockOrderMigration, [
  "CREATE OR REPLACE FUNCTION public.project_management_schedule_dependency_guard()",
  "ORDER BY id",
  "FOR UPDATE",
  "pg_advisory_xact_lock",
  "endpoint-row then project-advisory lock order",
]);
assertTrue(
  lockOrderMigration.indexOf("ORDER BY id") < lockOrderMigration.indexOf("pg_advisory_xact_lock"),
  `${lockOrderMigrationFile}: endpoint rows must be locked before the project advisory lock`,
);
const mixedTargetMigrationFile =
  "scripts/migrations/230_sx_replace_root_tasks_from_newco_gates.sql";
const mixedTargetMigration = read(mixedTargetMigrationFile);
assertIncludes(mixedTargetMigrationFile, mixedTargetMigration, [
  "ALTER COLUMN successor_task_id DROP NOT NULL",
  "successor_type = 'milestone' AND successor_task_id IS NULL AND successor_milestone_id IS NOT NULL",
  "source_node := 'task:' || NEW.predecessor_task_id::text",
  "target_node := 'milestone:' || NEW.successor_milestone_id::text",
  "schedule dependency would create a cycle",
  "edge.successor_milestone_id = OLD.id",
]);

// -- expected_version required (400 missing/invalid, 409 stale); CAS rollback by updated version --
const routeFile = "src/app/api/project-workspace/[projectId]/management/route.ts";
const route = read(routeFile);
assertIncludes(routeFile, route, [
  '| "schedule_dependency"',
  'schedule_dependency: "project_management_schedule_dependencies"',
  'predecessor_type: predecessorType',
  'requiredEnum("successor_type", ["task", "milestone"])',
  'successor_type: successorType',
  'successor_task_id: successorType === "task" ? successorId : null',
  'successor_milestone_id: successorType === "milestone" ? successorId : null',
  "updated_by: memberId",
  'resource === "schedule_dependency" && (deleting || restoring)',
  'const pointMs = timelineKind === "milestone";',
  'gate: pointMs ? optionalTextValue("gate", 240) || "未設定"',
  'next_deliverable: pointMs ? optionalTextValue("next_deliverable", 500) || "次の成果未確認"',
  'completion_criteria: pointMs ? optionalTextValue("completion_criteria", 1200) || "未設定"',
  'pointMs ? "medium" : "high"',
]);
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
