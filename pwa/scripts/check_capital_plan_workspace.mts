import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "src", "components", "cockpit", "CapitalPlanWorkspace.tsx");
const src = fs.readFileSync(filePath, "utf8");

function expectIncludes(needles: string[]) {
  const missing = needles.filter((needle) => !src.includes(needle));
  assert.equal(missing.length, 0, `CapitalPlanWorkspace.tsx missing required anchors: ${missing.join(", ")}`);
}

function expectNotIncludes(needles: string[]) {
  const present = needles.filter((needle) => src.includes(needle));
  assert.equal(present.length, 0, `CapitalPlanWorkspace.tsx contains forbidden anchors: ${present.join(", ")}`);
}

// 1. companyOverviewData prop is actually received and used for preset creation
expectIncludes([
  "projectId, projectName, companyOverviewData }: CapitalPlanWorkspaceProps",
  "createCapitalPlanDocumentFromCompanyOverview",
  "createStandardIpoCapitalPlanDocument",
]);

// 2. 3 creation entry buttons exist (blank must not be the only/primary entry point)
expectIncludes([
  "+ IPOまでの標準プラン",
  "+ 確定履歴から作成",
  "+ 空のプラン",
  "createStandardIpoPlan",
  "createPlanFromConfirmedHistory",
  "createEmptyPlan",
]);

// 3. createPlan is a single generic function that sends document_json to the create action
expectIncludes([
  'action: "create"',
  "document_json",
  "async function createPlan(",
]);

// 4. Part B: directEditError state + direct edit functions on the parent component
expectIncludes([
  "const [directEditError, setDirectEditError] = useState<string | null>(null);",
  "function editHolderPostEventShares(eventId: string, holderId: string, targetShares: number)",
  "function editHolderPostEventRatio(eventId: string, holderId: string, ratio: number)",
  "function editHolderEventAmount(eventId: string, holderId: string, targetAmount: number)",
  "function editHolderEventShares(eventId: string, holderId: string, targetShares: number)",
]);

// 5. Negative delta (post-event FD shares below the prior round) is rejected without saving
{
  const fnStart = src.indexOf("function editHolderPostEventShares(");
  assert.ok(fnStart >= 0, "editHolderPostEventShares not found");
  const fnBody = src.slice(fnStart, fnStart + 1200);
  assert.match(fnBody, /delta < 0/, "editHolderPostEventShares must guard on negative delta");
  assert.match(fnBody, /setDirectEditError\(/, "editHolderPostEventShares must set an error on negative delta");
  const deltaIdx = fnBody.indexOf("delta < 0");
  const returnIdx = fnBody.indexOf("return;", deltaIdx);
  const updatePlanIdx = fnBody.indexOf("updatePlan(", deltaIdx);
  assert.ok(
    deltaIdx >= 0 && returnIdx >= 0 && (updatePlanIdx === -1 || returnIdx < updatePlanIdx),
    "negative delta branch must return before calling updatePlan (no save on error)",
  );
}

// 6. Ratio edit on financing events switches to ownership_target and delegates non-financing
// events to the shares-delta editor
expectIncludes([
  "FINANCING_EVENT_TYPES.includes(event.type)",
  'calculationBasis: "ownership_target"',
  "targetOwnershipPercentage: targetEv",
  "const targetShares = Math.round((ratio * otherTotal) / (1 - ratio));",
  "editHolderPostEventShares(eventId, holderId, targetShares);",
]);

// 7. Edited allocations are tagged source=override / input, values are integer (Math.round)
expectIncludes(["function overriddenSharesValue(", 'source === "override"', "overrideValue(current.value, nextValue)", "Math.round(targetShares)"]);

// 8. shareClass defaulting rule: option_pool -> option, every other supported type -> common
expectIncludes([
  "function defaultShareClassForNewAllocation(eventType: CapitalEventType): ShareClass",
  'if (eventType === "option_pool") return "option";',
  'return "common";',
]);
{
  const fnStart = src.indexOf("function defaultShareClassForNewAllocation(");
  const fnEnd = src.indexOf("\n  }", fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert.doesNotMatch(fnBody, /preferred/, "only option_pool may default away from common; equity_issue/ipo/incorporation/convertible_conversion must default to common");
}
// Existing allocation's shareClass must be preserved over the default rule
{
  const fnStart = src.indexOf("function editHolderPostEventShares(");
  const fnBody = src.slice(fnStart, fnStart + 2600);
  assert.match(
    fnBody,
    /existingIdx >= 0[\s\S]*?overriddenSharesValue\(alloc\.shares, firstAllocDelta\)/,
    "when an allocation already exists for the holder, only shares should be overridden (shareClass preserved)",
  );
}

// 8b. Same holder with multiple allocations in one event: the first allocation must absorb
// (target delta - other same-holder allocations), rejecting negative results instead of saving.
{
  const fnStart = src.indexOf("function editHolderPostEventShares(");
  assert.ok(fnStart >= 0, "editHolderPostEventShares not found");
  const fnBody = src.slice(fnStart, fnStart + 2600);
  assert.match(
    fnBody,
    /holderAllocIndices[\s\S]*?\.filter\(\(i\) => i >= 0\)/,
    "must locate every allocation index belonging to the same holder in this event",
  );
  assert.match(
    fnBody,
    /otherSameHolderTotal[\s\S]*?holderAllocIndices\s*\n?\s*\.slice\(1\)/,
    "must sum the other same-holder allocations (excluding the first) via resolvedValue",
  );
  assert.match(fnBody, /resolvedValue\(event\.allocations\[i\]\.shares\)/, "other-allocation sum must use resolvedValue, not raw override");
  assert.match(fnBody, /firstAllocDelta\s*=\s*delta\s*-\s*otherSameHolderTotal/, "first allocation's delta must be target delta minus other same-holder allocations");
  const negIdx = fnBody.indexOf("firstAllocDelta < 0");
  assert.ok(negIdx >= 0, "must reject a negative firstAllocDelta (other allocations already exceed target)");
  const negReturnIdx = fnBody.indexOf("return;", negIdx);
  const updatePlanIdx = fnBody.indexOf("updatePlan(", negIdx);
  assert.ok(
    negReturnIdx >= 0 && (updatePlanIdx === -1 || negReturnIdx < updatePlanIdx),
    "negative firstAllocDelta must return before calling updatePlan (no save on error)",
  );
}

// 8c. editHolderEventAmount / editHolderEventShares use the same aggregate rule (first same-holder
// allocation absorbs target minus other same-holder allocations), reject negatives, create if absent.
for (const [fnName, totalVar, fieldAccessor] of [
  ["editHolderEventAmount", "targetAmount", "amount"],
  ["editHolderEventShares", "target", "shares"],
] as const) {
  const fnStart = src.indexOf(`function ${fnName}(`);
  assert.ok(fnStart >= 0, `${fnName} not found`);
  const fnBody = src.slice(fnStart, fnStart + 2200);
  assert.match(fnBody, /holderAllocIndices/, `${fnName} must locate same-holder allocation indices`);
  assert.match(fnBody, /otherSameHolderTotal/, `${fnName} must sum other same-holder allocations`);
  assert.match(fnBody, /< 0/, `${fnName} must guard against negative results`);
  assert.match(
    fnBody,
    new RegExp(`overriddenSharesValue\\(alloc\\.${fieldAccessor}`),
    `${fnName} must preserve provenance via overriddenSharesValue on the ${fieldAccessor} field`,
  );
  assert.match(fnBody, /existingIdx >= 0/, `${fnName} must branch on whether an allocation already exists`);
  assert.match(fnBody, /const newAlloc: EventAllocation = \{/, `${fnName} must create a new allocation when none exists`);
}

// 9. Unsupported event types (secondary / share_split / convertible_issue) get a Japanese explanation, not direct editing
expectIncludes([
  "const DIRECT_EDIT_SUPPORTED_EVENT_TYPES: CapitalEventType[] = [",
  '"incorporation",',
  '"equity_issue",',
  '"option_pool",',
  '"convertible_conversion",',
  '"ipo",',
  "DIRECT_EDIT_UNSUPPORTED_MESSAGE",
]);
{
  const supportedIdx = src.indexOf("const DIRECT_EDIT_SUPPORTED_EVENT_TYPES: CapitalEventType[] = [");
  const supportedBlockEnd = src.indexOf("];", supportedIdx);
  const supportedBlock = src.slice(supportedIdx, supportedBlockEnd);
  for (const unsupported of ["secondary", "share_split", "convertible_issue"]) {
    assert.ok(!supportedBlock.includes(`"${unsupported}"`), `${unsupported} must not be in the direct-edit-supported list`);
  }
}

// 10. CapitalPlanMatrix is imported and rendered immediately after the validation summary and
// before the EventEditor details section
expectIncludes([
  'import { CapitalPlanMatrix } from "./CapitalPlanMatrix";',
  "<CapitalPlanMatrix",
  "onEditHolderAmount={editHolderEventAmount}",
  "onEditHolderEventShares={editHolderEventShares}",
  "onEditHolderPostShares={editHolderPostEventShares}",
  "onEditHolderPostRatio={editHolderPostEventRatio}",
]);
{
  const validationIdx = src.indexOf("検証結果（エラー");
  const matrixIdx = src.indexOf("<CapitalPlanMatrix");
  const eventEditorIdx = src.indexOf("<EventEditor");
  assert.ok(validationIdx >= 0, "validation summary not found");
  assert.ok(matrixIdx > validationIdx, "CapitalPlanMatrix must render after the validation summary");
  assert.ok(eventEditorIdx > matrixIdx, "CapitalPlanMatrix must render before EventEditor");
}

// 11. EventEditor is wrapped in a closed <details> titled 株主・イベント詳細設定, directly following the matrix
{
  const summaryIdx = src.indexOf("株主・イベント詳細設定");
  assert.ok(summaryIdx >= 0, "EventEditor <details> summary label not found");
  const detailsIdx = src.lastIndexOf("<details", summaryIdx);
  assert.ok(detailsIdx >= 0, "EventEditor must be wrapped in a <details> element");
  const eventEditorIdx = src.indexOf("<EventEditor", summaryIdx);
  assert.ok(eventEditorIdx > summaryIdx, "<EventEditor> must render inside the 株主・イベント詳細設定 details block");
  assert.doesNotMatch(src.slice(detailsIdx, detailsIdx + 40), /open/, "EventEditor details must be closed by default (no `open` attribute)");
}

// 12. Old inline chart/matrix components are deleted entirely
expectNotIncludes([
  "function PostEventShareholderTable(",
  "function OwnershipChartAndMatrix(",
  "function MatrixSectionHeader(",
  "function MatrixRow(",
  "function MatrixCell(",
  "<OwnershipChartAndMatrix",
  "<PostEventShareholderTable",
]);

// 13. EventEditor no longer renders the always-visible nine event numeric field grid
// (those fields now live in CapitalPlanMatrix)
expectNotIncludes([
  'label="プレマネー評価額"',
  'label="調達額（primaryRaise）"',
  'label="オプションプールサイズ"',
  'label="転換価格キャップ"',
]);

// 14. "このイベントの割当" allocation list is a compact flat table (no per-allocation card),
// while holder / shareClass / shares / amount / price / target percentage / delete / add remain editable
{
  const startIdx = src.indexOf("このイベントの割当");
  assert.ok(startIdx >= 0, "「このイベントの割当」section not found");
  const section = src.slice(startIdx, startIdx + 4000);
  assert.doesNotMatch(section, /rounded-md border border-zinc-200 p-2/, "must not wrap each allocation in its own bordered card");
  assert.match(section, /event\.allocations\.map\(\(alloc\)/, "allocation list must still render one row per allocation");
  assert.match(section, /TableNumberInput/, "flat table should use a compact (label-less) numeric input, not the boxed EditableNumberField");
  for (const needle of [
    "onUpdateAllocation(event.id, alloc.id, { holderId:",
    "onUpdateAllocation(event.id, alloc.id, { shareClass:",
    'shares: v ?? editableValue(0, "input")',
    "onUpdateAllocation(event.id, alloc.id, { amount:",
    "onUpdateAllocation(event.id, alloc.id, { pricePerShare:",
    "onUpdateAllocation(event.id, alloc.id, { targetOwnershipPercentage:",
    "onRemoveAllocation(event.id, alloc.id)",
    "onAddAllocation(event.id)",
  ]) {
    assert.ok(section.includes(needle), `allocation flat table missing editable anchor: ${needle}`);
  }
}

// 15. targetShares/delta formulas are internally consistent (reference-model sanity check)
{
  const resolveTargetShares = (ratio: number, otherTotal: number) => Math.round((ratio * otherTotal) / (1 - ratio));
  const target = resolveTargetShares(0.25, 300);
  assert.equal(target, 100);
  assert.ok(Math.abs(target / (target + 300) - 0.25) < 1e-9, "round(p*otherTotal/(1-p)) must round-trip back to ~p");
  const resolveDelta = (targetShares: number, priorHolderFd: number) => Math.round(targetShares) - priorHolderFd;
  assert.ok(resolveDelta(30, 50) < 0, "a target below the prior round's FD shares must yield a negative delta (rejected)");
}

// 16. Refs mirroring plan/revision/selection/dirty state must be assigned synchronously on every
// render, and per-plan edit/save generation counters must exist alongside them.
expectIncludes([
  "const latestPlanRef = useRef(plan);",
  "const latestRevisionRef = useRef(revision);",
  "const selectedPlanIdRef = useRef(selectedPlanId);",
  "const dirtyRef = useRef(dirty);",
  "const editGenerationRef = useRef(0);",
  "const savedGenerationRef = useRef(0);",
  "latestPlanRef.current = plan;",
  "latestRevisionRef.current = revision;",
  "selectedPlanIdRef.current = selectedPlanId;",
  "dirtyRef.current = dirty;",
]);

// 16b. selectPlan resets both generation counters synchronously (so a save loop left running for
// the previous plan cannot corrupt the freshly-selected plan's bookkeeping).
{
  const fnStart = src.indexOf("function selectPlan(row: PlanRow)");
  assert.ok(fnStart >= 0, "selectPlan not found");
  const fnBody = src.slice(fnStart, fnStart + 1600);
  assert.match(fnBody, /editGenerationRef\.current = 0;/, "selectPlan must reset editGenerationRef");
  assert.match(fnBody, /savedGenerationRef\.current = 0;/, "selectPlan must reset savedGenerationRef");
}

// 17. updatePlan computes from latestPlanRef.current (never stale React state), and synchronously
// assigns latestPlanRef.current / dirtyRef.current / bumps editGenerationRef BEFORE calling
// setState or scheduling the debounced save — so two edits made back to back (e.g. two onBlur
// handlers in the same tick) can never clobber each other via a stale closure.
{
  const fnStart = src.indexOf("function updatePlan(updater:");
  assert.ok(fnStart >= 0, "updatePlan not found");
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.match(fnBody, /updater\(latestPlanRef\.current\)/, "updatePlan must compute the next draft from latestPlanRef.current, not React state");
  const assignIdx = fnBody.indexOf("latestPlanRef.current = derived;");
  const dirtyRefIdx = fnBody.indexOf("dirtyRef.current = true;");
  const genIdx = fnBody.indexOf("editGenerationRef.current += 1;");
  const setPlanIdx = fnBody.indexOf("setPlan(derived);");
  const scheduleIdx = fnBody.indexOf("scheduleSave(planId);");
  assert.ok(assignIdx >= 0, "updatePlan must synchronously assign latestPlanRef.current = derived");
  assert.ok(dirtyRefIdx >= 0, "updatePlan must synchronously set dirtyRef.current = true");
  assert.ok(genIdx >= 0, "updatePlan must synchronously increment editGenerationRef.current");
  assert.ok(setPlanIdx >= 0, "updatePlan must call setPlan");
  assert.ok(scheduleIdx >= 0, "updatePlan must call scheduleSave");
  assert.ok(
    assignIdx < setPlanIdx && dirtyRefIdx < setPlanIdx && genIdx < setPlanIdx && genIdx < scheduleIdx,
    "latestPlanRef/dirtyRef/editGenerationRef must all be updated synchronously before setPlan/scheduleSave run",
  );
}

// 18. scheduleSave must funnel through the same serialized runner (runPersist), capturing the
// snapshot/generation only when it actually fires (not at schedule time)
{
  const fnStart = src.indexOf("const scheduleSave = useCallback(");
  assert.ok(fnStart >= 0, "scheduleSave not found");
  const fnBody = src.slice(fnStart, fnStart + 600);
  assert.match(fnBody, /void runPersist\(savePlanId\)/, "scheduleSave must call runPersist (the same serialized runner as flushPendingSave), not persist() directly");
}

// 19. runPersist reuses (does not duplicate) an in-flight save for the same plan, captures its own
// generation/snapshot/revision from the refs at call time, and — once a save for a stale
// generation succeeds — automatically chains another save if the plan is still current and still
// dirty, using a freshly captured (newer) snapshot rather than reusing the old in-flight promise.
{
  const fnStart = src.indexOf("const runPersist = useCallback(");
  assert.ok(fnStart >= 0, "runPersist not found");
  const fnBody = src.slice(fnStart, fnStart + 1200);
  assert.match(fnBody, /existing && existing\.planId === targetPlanId\) return existing\.promise/, "runPersist must reuse an in-flight promise for the same plan instead of firing a duplicate request");
  assert.match(fnBody, /const generation = editGenerationRef\.current;/, "runPersist must capture the generation at call time");
  assert.match(fnBody, /const snapshotPlan = latestPlanRef\.current;/, "runPersist must capture the plan snapshot at call time");
  assert.match(fnBody, /const expectedRevision = latestRevisionRef\.current;/, "runPersist must capture the expected revision at call time");
  assert.match(
    fnBody,
    /result\.success && targetPlanId === selectedPlanIdRef\.current && dirtyRef\.current\)\s*\{?\s*\n?\s*return runPersist\(targetPlanId\);/,
    "runPersist must chain a fresh runPersist() call (new snapshot/generation) after a successful save if the plan is still current and still dirty",
  );
}

// 20. persist() ignores stale responses for whatever plan is no longer selected, and only clears
// dirty / reports "saved" when the generation it just saved is still the latest one — otherwise a
// newer edit exists and the caller (runPersist) is responsible for chaining another save.
{
  const fnStart = src.indexOf("const persist = useCallback(");
  assert.ok(fnStart >= 0, "persist not found");
  const fnBody = src.slice(fnStart, fnStart + 2200);
  assert.match(fnBody, /const isCurrent = \(\) => targetPlanId === selectedPlanIdRef\.current;/, "persist must gate all current-plan state updates on an isCurrent() check against the live ref");
  assert.match(fnBody, /if \(isCurrent\(\)\) setSaveState\("saving"\)/, "persist must not touch saveState for a plan that is no longer selected");
  assert.match(fnBody, /savedGenerationRef\.current = generation;/, "persist must record the generation it just confirmed saved");
  assert.match(
    fnBody,
    /if \(savedGenerationRef\.current === editGenerationRef\.current\)\s*\{[\s\S]*?dirtyRef\.current = false;[\s\S]*?setDirty\(false\);[\s\S]*?setSaveState\("saved"\);/,
    "persist must only clear dirty / report saved when the saved generation equals the current (latest) generation",
  );
}

// 20b. forceSaveOverServer must go through the same serialized runPersist() mechanism (bumping the
// generation and marking dirty so runPersist captures latestPlanRef.current fresh) rather than
// calling persist() directly with a possibly-stale `plan` closure value.
{
  const fnStart = src.indexOf("function forceSaveOverServer(");
  assert.ok(fnStart >= 0, "forceSaveOverServer not found");
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.doesNotMatch(fnBody, /void persist\(/, "forceSaveOverServer must not call persist() directly");
  assert.match(fnBody, /editGenerationRef\.current \+= 1;/, "forceSaveOverServer must bump the generation so it's treated as a fresh edit");
  assert.match(fnBody, /dirtyRef\.current = true;/, "forceSaveOverServer must mark dirty before invoking the save loop");
  assert.match(fnBody, /void runPersist\(selectedPlanId\);/, "forceSaveOverServer must invoke the serialized runPersist() runner");
}

// 21. Every plan-switching / destructive action awaits flushPendingSave and aborts when it returns false
for (const [label, fnStart] of [
  ["plan selector onChange", src.indexOf("onChange={async (e) => {\n              const row = plans.find((p) => p.id === e.target.value);")],
  ["createPlan", src.indexOf("async function createPlan(")],
  ["duplicatePlan", src.indexOf("async function duplicatePlan()")],
  ["submitRename", src.indexOf("async function submitRename()")],
  ["archiveOrRestore", src.indexOf("async function archiveOrRestore(")],
  ["freezePlan", src.indexOf("async function freezePlan()")],
  ["restoreVersion", src.indexOf("async function restoreVersion(")],
] as const) {
  assert.ok(fnStart >= 0, `${label} not found`);
  const body = src.slice(fnStart, fnStart + 500);
  assert.match(body, /const flushed = await flushPendingSave\(\);/, `${label} must await flushPendingSave() before switching/mutating plan selection`);
  assert.match(body, /if \(!flushed\) (\{[\s\S]*?\}|return;)/, `${label} must abort when flushPendingSave() returns false`);
}

// 22. Freeze is disabled while dirty / saving / conflict / error / any busy action is in flight
{
  const freezeButtonIdx = src.indexOf("onClick={freezePlan}");
  assert.ok(freezeButtonIdx >= 0, "freeze button not found");
  const button = src.slice(freezeButtonIdx, freezeButtonIdx + 400);
  for (const needle of [
    "dirty",
    'saveState === "conflict"',
    'saveState === "saving"',
    'saveState === "error"',
    "!!busyAction",
  ]) {
    assert.ok(button.includes(needle), `freeze button disabled condition missing: ${needle}`);
  }
}

// 23. Save status indicator is announced to assistive tech
{
  const idx = src.indexOf('{saveState === "saving" && "保存中…"}');
  assert.ok(idx >= 0, "save status span not found");
  const spanStart = src.lastIndexOf("<span", idx);
  const spanTag = src.slice(spanStart, idx);
  assert.match(spanTag, /aria-live="polite"/, "save status span must be aria-live=\"polite\"");
}

// 24. Destructive mutations (event / holder / allocation removal) confirm with the user first,
// and removeHolder's confirmation warns about the cascading allocation deletion
{
  for (const [fnName, cascadeWarning] of [
    ["removeEvent", false],
    ["removeHolder", true],
    ["removeAllocation", false],
  ] as const) {
    const fnStart = src.indexOf(`function ${fnName}(`);
    assert.ok(fnStart >= 0, `${fnName} not found`);
    const fnBody = src.slice(fnStart, fnStart + 400);
    assert.match(fnBody, /window\.confirm\(/, `${fnName} must confirm before mutating`);
    const confirmIdx = fnBody.indexOf("window.confirm(");
    const returnIdx = fnBody.indexOf("return;", confirmIdx);
    assert.ok(returnIdx >= 0 && returnIdx < confirmIdx + 200, `${fnName} must bail out when the confirm is declined`);
    if (cascadeWarning) {
      const confirmCall = fnBody.slice(confirmIdx, fnBody.indexOf(")", confirmIdx + 200) + 1);
      assert.match(confirmCall, /割当/, "removeHolder's confirm must warn that allocations cascade-delete");
    }
  }
}

// 25. Intro copy describes the saved plan's real use (internal approval + VC submission) and
// carries none of the old hypothetical/unsaved/legal-current/protect-holder caveats
expectIncludes(["保存された資本政策表を社内承認とVC提出に使用します。"]);
expectNotIncludes([
  "仮説",
  "未保存",
  "現行の法的",
  "守りたい株主",
  "保存されない仮定",
]);

// 26. Duplicate React keys: every holders.map(...) call in this file must use a distinct key
// expression from any other holders.map(...) call within the same JSX subtree (spot-checked via
// a global scan for the literal `key={h.id}` / `key={holder.id}` patterns not colliding).
{
  const holderMapKeyPattern = /holders\.map\(\(h(?:older)?[,)][\s\S]{0,80}?key=\{([^}]+)\}/g;
  const seenAtSamePosition = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = holderMapKeyPattern.exec(src))) {
    seenAtSamePosition.set(match[1], (seenAtSamePosition.get(match[1]) ?? 0) + 1);
  }
  // This is a sanity check, not a hard uniqueness proof across different subtrees; it only fails
  // if the exact same key expression appears suspiciously often, which would suggest copy-paste
  // duplication within a single list.
  for (const [key, count] of seenAtSamePosition) {
    assert.ok(count <= 2, `holders.map key expression "${key}" appears ${count} times; check for duplicated holder rows sharing one key`);
  }
}

console.log("check_capital_plan_workspace.mts: all checks passed");
