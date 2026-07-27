import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "src", "components", "cockpit", "CapitalPlanWorkspace.tsx");
const src = fs.readFileSync(filePath, "utf8");
const matrixFilePath = path.join(__dirname, "..", "src", "components", "cockpit", "CapitalPlanMatrix.tsx");
const matrixSrc = fs.readFileSync(matrixFilePath, "utf8");

function expectMatrixIncludes(needles: string[]) {
  const missing = needles.filter((needle) => !matrixSrc.includes(needle));
  assert.equal(missing.length, 0, `CapitalPlanMatrix.tsx missing required anchors: ${missing.join(", ")}`);
}

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

// 8. shareClass defaulting rule: a per-event-type lookup table (DEFAULT_SHARE_CLASS_BY_EVENT_TYPE),
// falling back to "common" for any event type not listed. equity_issue/convertible_conversion
// default to "preferred", option_pool to "option", convertible_issue to "convertible",
// ipo/secondary/incorporation to "common".
expectIncludes([
  "const DEFAULT_SHARE_CLASS_BY_EVENT_TYPE: Partial<Record<CapitalEventType, ShareClass>> = {",
  "function defaultShareClassForNewAllocation(eventType: CapitalEventType): ShareClass",
  "return DEFAULT_SHARE_CLASS_BY_EVENT_TYPE[eventType] ?? \"common\";",
]);
{
  const declStart = src.indexOf("const DEFAULT_SHARE_CLASS_BY_EVENT_TYPE:");
  assert.ok(declStart >= 0, "DEFAULT_SHARE_CLASS_BY_EVENT_TYPE not found");
  const declEnd = src.indexOf("};", declStart);
  const decl = src.slice(declStart, declEnd);
  for (const [eventType, shareClass] of [
    ["equity_issue", "preferred"],
    ["ipo", "common"],
    ["convertible_issue", "convertible"],
    ["option_pool", "option"],
    ["convertible_conversion", "preferred"],
    ["secondary", "common"],
    ["incorporation", "common"],
  ] as const) {
    assert.match(
      decl,
      new RegExp(`${eventType}:\\s*"${shareClass}"`),
      `DEFAULT_SHARE_CLASS_BY_EVENT_TYPE must default ${eventType} to "${shareClass}"`,
    );
  }
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
  const section = src.slice(startIdx, startIdx + 5200);
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

// 27. CapitalPlanMatrix root carries a stable test hook, and the driver/output classification
// helpers exist with the exact per-calculationBasis rules the engine (deriveEvent) applies:
// - preMoneyValuation is a driver for manual/valuation_and_investment/ownership_target, output
//   only for price_and_shares
// - pricePerShare is a driver for manual/price_and_shares, output otherwise
// - postMoneyValuation/primaryRaise/newShares are always calculated outputs across every event
//   type that shows the row at all (no basis check); option_pool's operative driver is poolSize
//   (a separate row), not newShares itself
expectMatrixIncludes(['data-testid="capital-plan-matrix"']);
{
  const fnStart = matrixSrc.indexOf("function preMoneyIsDriver(");
  assert.ok(fnStart >= 0, "preMoneyIsDriver not found");
  const fnBody = matrixSrc.slice(fnStart, matrixSrc.indexOf("\n}", fnStart));
  assert.match(fnBody, /isManualBasis\(basis\)/, "preMoneyIsDriver must treat manual/undefined basis as a driver");
  assert.match(fnBody, /basis === 'valuation_and_investment'/, "preMoneyIsDriver must treat valuation_and_investment as a driver");
  assert.match(fnBody, /basis === 'ownership_target'/, "preMoneyIsDriver must treat ownership_target as a driver");
  assert.doesNotMatch(fnBody, /basis === 'price_and_shares'/, "preMoneyIsDriver must NOT treat price_and_shares as a driver (preMoney is a calculated output there)");
}
{
  const fnStart = matrixSrc.indexOf("function pricePerShareIsDriver(");
  assert.ok(fnStart >= 0, "pricePerShareIsDriver not found");
  const fnBody = matrixSrc.slice(fnStart, matrixSrc.indexOf("\n}", fnStart));
  assert.match(fnBody, /isManualBasis\(basis\)/, "pricePerShareIsDriver must treat manual/undefined basis as a driver");
  assert.match(fnBody, /basis === 'price_and_shares'/, "pricePerShareIsDriver must treat price_and_shares as a driver");
}
{
  const postMoneyIdx = matrixSrc.indexOf("ポストマネー評価額");
  const postMoneyBlock = matrixSrc.slice(postMoneyIdx, postMoneyIdx + 900);
  assert.doesNotMatch(postMoneyBlock, /EditableValueCell/, "postMoneyValuation must always be a calculated output for financing types, never a driver input");
  const primaryRaiseIdx = matrixSrc.indexOf("調達額（新規資金）");
  const primaryRaiseBlock = matrixSrc.slice(primaryRaiseIdx, primaryRaiseIdx + 700);
  assert.doesNotMatch(primaryRaiseBlock, /EditableValueCell/, "primaryRaise must always be a calculated output, never a driver input");
  const newSharesIdx = matrixSrc.indexOf("新規発行株式数");
  const newSharesBlock = matrixSrc.slice(newSharesIdx, newSharesIdx + 1200);
  assert.match(newSharesBlock, /if \(!NEW_SHARES_TYPES\.has\(event\.type\)\) return <DashCell/, "newShares must dash out for event types outside NEW_SHARES_TYPES");
  assert.doesNotMatch(newSharesBlock, /<EditableValueCell/, "newShares must never be a plain authored driver — even for option_pool the operative driver is poolSize, not newShares");
  assert.match(newSharesBlock, /forceOverride\(event\.newShares, n\)/, "newShares override must go through forceOverride so the override captures the current derived value");
}
// Every driver/output branch in the row renderers must route through OutputCell (labeled 自動)
// when the field is not a driver, never a plain editable cell.
for (const row of ["プレマネー評価額", "調達額（新規資金）", "ポストマネー評価額", "1株あたり単価", "新規発行株式数"]) {
  const idx = matrixSrc.indexOf(row);
  assert.ok(idx >= 0, `${row} row not found`);
  const block = matrixSrc.slice(idx, idx + 1500);
  assert.match(block, /<OutputCell/, `${row} row must render OutputCell for the non-driver branch`);
}
expectMatrixIncludes(["自動"]);

// 28. Holder x event cells with no allocation are actionable wherever the event/basis supports
// that field as a driver (blank input, wired to the existing edit callbacks), and stay dash
// otherwise. holderAmountActionable/holderSharesActionable encode exactly which event
// types/bases are money-bearing vs. share-bearing drivers.
expectMatrixIncludes([
  "function holderAmountActionable(",
  "function holderSharesActionable(",
  "agg.count === 0",
]);
{
  const fnStart = matrixSrc.indexOf("function holderAmountActionable(");
  const fnBody = matrixSrc.slice(fnStart, matrixSrc.indexOf("\n}", fnStart));
  assert.match(fnBody, /AMOUNT_BEARING_TYPES\.has\(event\.type\)/, "holderAmountActionable must gate on money-bearing event types");
  assert.match(fnBody, /FINANCING_TYPES\.has\(event\.type\)/, "holderAmountActionable must further gate financing-type events on calculationBasis");
  assert.match(fnBody, /valuation_and_investment/, "holderAmountActionable must treat valuation_and_investment as the amount-driving basis");
}
{
  const fnStart = matrixSrc.indexOf("function holderSharesActionable(");
  const fnBody = matrixSrc.slice(fnStart, matrixSrc.indexOf("\n}", fnStart));
  assert.match(fnBody, /share_split/, "holderSharesActionable must exclude share_split (ratio-driven, no per-holder shares input)");
  assert.match(fnBody, /price_and_shares/, "holderSharesActionable must treat price_and_shares as the shares-driving basis");
}
// The amount/shares row renderers must branch on both agg.count and the actionable flag, only
// falling back to DashCell when the cell is genuinely unsupported.
{
  const amountRowIdx = matrixSrc.indexOf("holderAmountActionable(event)");
  assert.ok(amountRowIdx >= 0, "amount row must call holderAmountActionable(event)");
  const block = matrixSrc.slice(amountRowIdx, amountRowIdx + 700);
  assert.match(block, /agg\.count === 0/, "amount row must check agg.count === 0 before deciding dash vs. blank input");
  assert.match(block, /<DashCell/, "amount row must still dash unsupported empty cells");
  assert.match(block, /onEditHolderAmount\(event\.id, holder\.id, n\)/, "empty actionable amount cell must commit via the existing onEditHolderAmount callback");
}
{
  const sharesRowIdx = matrixSrc.indexOf("holderSharesActionable(event)");
  assert.ok(sharesRowIdx >= 0, "shares row must call holderSharesActionable(event)");
  const block = matrixSrc.slice(sharesRowIdx, sharesRowIdx + 700);
  assert.match(block, /agg\.count === 0/, "shares row must check agg.count === 0 before deciding dash vs. blank input");
  assert.match(block, /onEditHolderEventShares\(event\.id, holder\.id, n\)/, "empty actionable shares cell must commit via the existing onEditHolderEventShares callback");
}

// 29. Inline "new holder" + "+event" affordances exist above the matrix, wired through new
// onAddHolder/onAddEvent props (not hidden behind the advanced EventEditor details panel), and
// CapitalPlanWorkspace's addHolder() accepts the typed name so a new VC/holder appears immediately.
expectMatrixIncludes([
  "onAddHolder: (name?: string) => void;",
  "onAddEvent: () => void;",
  "function AddHolderAndEventBar(",
  "onAddHolder(trimmed || undefined)",
]);
expectIncludes(["function addHolder(name?: string) {", "onAddHolder={addHolder}", "onAddEvent={addEvent}"]);

// 30. NumberCell is a controlled component with a local draft: it commits on every keystroke that
// parses to a valid number (immediate recalc) and again on Enter, resyncs from external
// recalculation only when the incoming value actually changed, and never force-remounts via a
// `key` prop keyed off the value (which would reset the cursor position on every commit).
{
  const fnStart = matrixSrc.indexOf("function NumberCell(");
  assert.ok(fnStart >= 0, "NumberCell not found");
  const fnEnd = matrixSrc.indexOf("\nfunction ", fnStart + 10);
  const fnBody = matrixSrc.slice(fnStart, fnEnd);
  assert.match(fnBody, /useState\(\(\) => \(value != null \? (?:String|formatNumberForDisplay)\(value\) : ''\)\)/, "NumberCell must seed local draft state from the incoming value");
  assert.match(fnBody, /if \(value !== lastKnownValue\) \{/, "NumberCell must resync from external recalculation only when the incoming value actually changed");
  assert.doesNotMatch(fnBody, /useEffect\(/, "NumberCell must resync during render, not via a useEffect (avoids react-hooks/set-state-in-effect and the extra-render flicker)");
  assert.match(fnBody, /onChange=\{\(e\) => \{\s*\n\s*setDraft\(e\.target\.value\);\s*\n\s*commitDraft\(e\.target\.value\);/, "onChange must update the draft and commit immediately");
  assert.match(fnBody, /e\.key === 'Enter'/, "Enter key must also commit the current draft");
  assert.match(fnBody, /onClear\(\)/, "commitDraft must call onClear when the field is cleared and onClear is provided");
  assert.doesNotMatch(fnBody, /key=\{value\}/, "must not force-remount the input via key={value} (defeats the controlled draft and jumps the cursor)");
}
// Clearing an already-empty new cell must not create a phantom allocation: blank actionable
// holder cells (agg.count === 0) must NOT be given an onClear callback.
{
  const amountRowIdx = matrixSrc.indexOf("holderAmountActionable(event)");
  const block = matrixSrc.slice(amountRowIdx, amountRowIdx + 1200);
  const emptyBranchIdx = block.indexOf("agg.count === 0");
  const filledBranchIdx = block.indexOf("return actionable ? <td key={event.id}><NumberCell value={agg.amount}");
  assert.ok(emptyBranchIdx >= 0 && filledBranchIdx > emptyBranchIdx, "expected empty-cell branch before filled-cell branch");
  const emptyBranch = block.slice(emptyBranchIdx, filledBranchIdx);
  assert.doesNotMatch(emptyBranch, /onClear=/, "a brand-new empty holder amount cell must not be given onClear (nothing to clear yet, and clearing an untouched blank cell must not create a phantom allocation)");
  const filledBranch = block.slice(filledBranchIdx);
  assert.match(filledBranch, /onClear=\{\(\) => onEditHolderAmount\(event\.id, holder\.id, 0\)\}/, "clearing an existing allocation amount must zero it out via the existing edit callback rather than leaving stale data with a blank display");
}

// 31. convertible_conversion must not be treated as a new-cash financing event: it is excluded
// from the primaryRaise-eligible type set even though it still shows a calculation-basis
// selector, pre/post-money valuation, and price/shares (FINANCING_TYPES / PRICE_TYPES /
// NEW_SHARES_TYPES).
{
  const declIdx = matrixSrc.indexOf("const PRIMARY_RAISE_TYPES = new Set(");
  assert.ok(declIdx >= 0, "PRIMARY_RAISE_TYPES not found");
  const decl = matrixSrc.slice(declIdx, matrixSrc.indexOf(";", declIdx));
  assert.doesNotMatch(decl, /convertible_conversion/, "PRIMARY_RAISE_TYPES must exclude convertible_conversion (converting an existing instrument is not a new cash raise)");
  assert.match(decl, /equity_issue/, "PRIMARY_RAISE_TYPES must still include equity_issue");
  assert.match(decl, /ipo/, "PRIMARY_RAISE_TYPES must still include ipo");
}
{
  const declIdx = matrixSrc.indexOf("const AMOUNT_BEARING_TYPES = new Set(");
  const decl = matrixSrc.slice(declIdx, matrixSrc.indexOf(";", declIdx));
  assert.match(decl, /convertible_issue/, "convertible_issue must remain amount-bearing (it can accept an issuance amount in holder amount rows)");
}

// 32. Holder rows are grouped contiguously per holder. FD% is always the compact summary row;
// amount, event shares, post-issued and post-FD rows appear only after that holder is expanded.
// Totals render once after every holder block (not interleaved between row kinds).
{
  const holderMapMatches = [...matrixSrc.matchAll(/plan\.holders\.map\(\(holder\) => \{/g)];
  assert.equal(holderMapMatches.length, 1, `expected exactly one plan.holders.map((holder) => { ... }) call building the contiguous per-holder row block, found ${holderMapMatches.length}`);
  const mapIdx = holderMapMatches[0].index!;
  const nextTopLevelIdx = matrixSrc.indexOf("発行済株式数合計", mapIdx);
  assert.ok(nextTopLevelIdx > mapIdx, "totals rows must come after the per-holder block");
  const block = matrixSrc.slice(mapIdx, nextTopLevelIdx);
  assert.match(block, /<Fragment key=\{holder\.id\}>/, "each holder's summary/detail rows must share one Fragment keyed by holder.id");
  assert.match(block, /aria-expanded=\{expanded\}/, "holder summary must expose its expand/collapse state");
  const amountIdx = block.indexOf("｜金額");
  const sharesIdx = block.indexOf("｜株数");
  const issuedIdx = block.indexOf("｜発行済株式数");
  const fdIdx = block.indexOf("｜完全希薄化後株式数");
  const pctIdx = block.indexOf("｜FD比率");
  assert.ok(
    pctIdx >= 0 && pctIdx < amountIdx && amountIdx < sharesIdx && sharesIdx < issuedIdx && issuedIdx < fdIdx,
    "per-holder rows must appear in order: FD% summary, amount, shares, post-issued, post-FD",
  );
  // totals must not be interleaved: no per-holder row label may reappear after the totals rows.
  assert.doesNotMatch(matrixSrc.slice(nextTopLevelIdx), /｜金額/, "totals must render after all per-holder blocks, not have holder rows interleaved after them");
}

// 33. The event header row is sticky at the top of the scroll container (readable scroll sense
// on a tall matrix), alongside the existing sticky-left row labels.
{
  const theadIdx = matrixSrc.indexOf("<thead>");
  const theadEnd = matrixSrc.indexOf("</thead>", theadIdx);
  const thead = matrixSrc.slice(theadIdx, theadEnd);
  assert.match(thead, /sticky top-0/, "event header cells must be sticky at the top of the scrolling container");
}

// 34. TableNumberInput carries an explicit Japanese aria-label tied to event/holder/field, and
// every call site in the allocations flat table supplies a distinct one.
{
  const fnStart = src.indexOf("function TableNumberInput(");
  const fnBody = src.slice(fnStart, src.indexOf("\nfunction ", fnStart + 10));
  assert.match(fnBody, /ariaLabel: string;/, "TableNumberInput must declare a required ariaLabel prop");
  assert.match(fnBody, /aria-label=\{ariaLabel\}/, "TableNumberInput must wire ariaLabel onto the input element");
}
{
  const startIdx = src.indexOf("このイベントの割当");
  const section = src.slice(startIdx, startIdx + 5200);
  for (const [field, label] of [
    ["shares", "株数"],
    ["amount", "金額"],
    ["pricePerShare", "1株価格"],
  ] as const) {
    const fieldIdx = section.indexOf(`ev={alloc.${field}}`);
    assert.ok(fieldIdx >= 0, `TableNumberInput call for alloc.${field} not found`);
    const call = section.slice(fieldIdx, section.indexOf("/>", fieldIdx));
    assert.match(call, new RegExp(`ariaLabel=\\{\`${label} `), `TableNumberInput for alloc.${field} must carry a "${label}" aria-label tied to event/holder`);
  }
  // targetOwnershipPercentage is unit-scaled (ratio -> percent) via scaleEditableValue, see
  // check 55, so it does not use the bare `ev={alloc.<field>}` shape the other fields use.
  const targetFieldIdx = section.indexOf("ev={scaleEditableValue(alloc.targetOwnershipPercentage, 100)}");
  assert.ok(targetFieldIdx >= 0, "TableNumberInput call for alloc.targetOwnershipPercentage (scaled to percent) not found");
  const targetCall = section.slice(targetFieldIdx, section.indexOf("/>", targetFieldIdx));
  assert.match(targetCall, /ariaLabel=\{`目標比率（%） /, 'TableNumberInput for alloc.targetOwnershipPercentage must carry a "目標比率（%）" aria-label tied to event/holder');
}

// 35. Error/status alert banners are announced to assistive tech via role="alert" (top-level
// error, deriveError, directEditError).
for (const anchor of [
  '{error && (\n        <div role="alert"',
  '{deriveError && (\n            <div role="alert"',
  '{directEditError && (\n            <div role="alert"',
]) {
  assert.ok(src.includes(anchor), `alert banner missing role="alert": ${JSON.stringify(anchor)}`);
}

// 36. Basis-normalization handler: changeCalculationBasis is the single place that renormalizes an
// event's fields when calculationBasis changes (forcing non-driver fields back to "calculated"
// unless already overridden), and it is wired in as the onChangeCalculationBasis prop consumed by
// CapitalPlanMatrix's algorithm-basis <select> (not a bare setState/patch).
expectIncludes([
  "function changeCalculationBasis(eventId: string, basis: CalculationBasis)",
  "onChangeCalculationBasis={changeCalculationBasis}",
]);
expectMatrixIncludes([
  "onChangeCalculationBasis: (eventId: string, basis: CalculationBasis) => void;",
  "onChange={(e) => onChangeCalculationBasis(event.id, e.target.value as CalculationBasis)}",
]);
{
  const fnStart = src.indexOf("function changeCalculationBasis(eventId: string, basis: CalculationBasis)");
  assert.ok(fnStart >= 0, "changeCalculationBasis not found");
  const fnBody = src.slice(fnStart, fnStart + 2600);
  assert.match(fnBody, /toCalculated\(e\.postMoneyValuation\)/, "changeCalculationBasis's window must reach toCalculated usage");
  assert.match(fnBody, /postMoneyValuation: toCalculated\(e\.postMoneyValuation\)/, "switching basis must renormalize postMoneyValuation back to calculated, clearing stale overrides");
  assert.match(fnBody, /preMoneyValuation: toInputResolved\(e\.preMoneyValuation\)/, "manual basis must promote preMoneyValuation to an input driver");
}

// 37. valuation_and_investment basis: switching to it forces allocation shares/pricePerShare to
// calculated outputs (toCalculatedShares / toCalculated), i.e. they
// stop being raw drivers once this basis is selected.
{
  const fnStart = src.indexOf('if (basis === "valuation_and_investment") {');
  assert.ok(fnStart >= 0, "valuation_and_investment branch of changeCalculationBasis not found");
  const fnBody = src.slice(fnStart, fnStart + 800);
  assert.match(fnBody, /shares: toCalculatedShares\(a\.shares\)/, "valuation_and_investment must force allocation shares to a calculated output");
  assert.match(fnBody, /pricePerShare: toCalculated\(a\.pricePerShare\)/, "valuation_and_investment must force allocation pricePerShare to a calculated output");
}
// The matrix's own driver classification agrees: preMoneyIsDriver treats valuation_and_investment
// as a driver for the valuation itself, while holderSharesActionable does NOT list
// valuation_and_investment among the shares-driving bases (only price_and_shares is).
{
  const fnStart = matrixSrc.indexOf("function holderSharesActionable(");
  const fnBody = matrixSrc.slice(fnStart, matrixSrc.indexOf("\n}", fnStart));
  assert.doesNotMatch(fnBody, /valuation_and_investment/, "holderSharesActionable must not treat valuation_and_investment as a shares-driving basis (shares are calculated there)");
}

// 38. secondary events allow negative shares/amounts: no negative-guard blocks a "secondary"
// transfer (the seller's row must be allowed to go negative).
{
  const fnStart = src.indexOf("function allowsNegativeShares(event: CapitalEvent, holderId: string): boolean {");
  assert.ok(fnStart >= 0, "allowsNegativeShares not found");
  const fnBody = src.slice(fnStart, src.indexOf("\n  }", fnStart));
  assert.match(fnBody, /if \(event\.type === "secondary"\) return true;/, "secondary events must always allow negative shares/amounts, unconditionally");
}

// 39. convertible_conversion negative guard is a class-guard: negative values are only permitted
// when the specific allocation's shareClass is "convertible" (the instrument being consumed on
// conversion), not for convertible_conversion allocations in general.
{
  const fnStart = src.indexOf("function allowsNegativeShares(event: CapitalEvent, holderId: string): boolean {");
  const fnBody = src.slice(fnStart, src.indexOf("\n  }", fnStart));
  assert.match(fnBody, /if \(event\.type !== "convertible_conversion"\) return false;/, "only convertible_conversion (besides secondary) may allow negative shares");
  assert.match(
    fnBody,
    /return event\.allocations\.some\(\(a\) => a\.holderId === holderId && a\.shareClass === "convertible"\);/,
    "convertible_conversion's negative allowance must be gated on the holder's allocation shareClass === 'convertible' (a class-guard, not a blanket allowance)",
  );
}
// editHolderEventShares actually consults this guard before rejecting negative targets.
{
  const fnStart = src.indexOf("function editHolderEventShares(eventId: string, holderId: string, targetShares: number)");
  assert.ok(fnStart >= 0, "editHolderEventShares not found");
  const fnBody = src.slice(fnStart, fnStart + 800);
  assert.match(fnBody, /const allowNegative = allowsNegativeShares\(event, holderId\);/, "editHolderEventShares must consult allowsNegativeShares for this event/holder");
  assert.match(fnBody, /if \(target < 0 && !allowNegative\)/, "editHolderEventShares must only reject negative targets when allowsNegativeShares is false");
}

// 40. Post-issued and post-FD (fully diluted) per-holder output rows exist in the matrix, rendered
// via OutputCell (never a plain editable cell) from the per-event RoundSnapshot.
{
  const issuedIdx = matrixSrc.indexOf("｜発行済株式数");
  assert.ok(issuedIdx >= 0, "post-issued row label not found");
  const issuedBlock = matrixSrc.slice(issuedIdx, issuedIdx + 700);
  assert.match(issuedBlock, /standing\.issuedShares/, "post-issued row must read standing.issuedShares from the snapshot");
  assert.match(issuedBlock, /<OutputCell key=\{event\.id\} value=\{standing\.issuedShares\}/, "post-issued row must render via OutputCell, not an editable input");

  const fdIdx = matrixSrc.indexOf("｜完全希薄化後株式数");
  assert.ok(fdIdx >= 0, "post-FD row label not found");
  const fdBlock = matrixSrc.slice(fdIdx, fdIdx + 700);
  assert.match(fdBlock, /standing\.fullyDilutedShares/, "post-FD row must read standing.fullyDilutedShares from the snapshot");
  assert.match(fdBlock, /<OutputCell key=\{event\.id\} value=\{standing\.fullyDilutedShares\}/, "post-FD row must render via OutputCell, not an editable input");
}

// 41. FD% cell is editable only under the ownership_target basis (the only mode where the engine
// solves shares FROM a target ratio); every other basis renders it as a read-only OutputCell.
{
  const pctIdx = matrixSrc.indexOf("｜FD比率");
  assert.ok(pctIdx >= 0, "FD% row label not found");
  const block = matrixSrc.slice(pctIdx, pctIdx + 2200);
  assert.match(block, /event\.calculationBasis === 'ownership_target'/, "FD% row must gate the editable branch on calculationBasis === 'ownership_target'");
  const gateIdx = block.indexOf("event.calculationBasis === 'ownership_target'");
  const editableBranch = block.slice(gateIdx, block.indexOf("const standing = snapshotByEventId.get(event.id)", gateIdx));
  assert.match(editableBranch, /<NumberCell/, "the ownership_target branch of the FD% cell must be an editable NumberCell");
  const readonlyBranch = block.slice(block.indexOf("const standing = snapshotByEventId.get(event.id)", gateIdx));
  assert.match(readonlyBranch, /<OutputCell/, "every non-ownership_target basis must render the FD% cell as a read-only OutputCell");
}

// 42. Summary output cells (OutputCell) carry an explicit "上書き" (override) mode driven by the
// shared sourceBadgeText/sourceAriaWord helpers (source-aware, not just override-vs-not): the
// badge reads 上書き when the underlying EditableValue's source is "override" and otherwise falls
// back to the per-source label (自動/確定/取込/入力). An onOverride affordance opens an inline
// editable input with explicit 保存/取消 (save/cancel) buttons — distinct from a normal driver
// cell and cancelable without committing.
{
  const helperStart = matrixSrc.indexOf("function sourceBadgeText(");
  assert.ok(helperStart >= 0, "sourceBadgeText helper not found");
  const helperBody = matrixSrc.slice(helperStart, matrixSrc.indexOf("\n}", helperStart));
  assert.match(helperBody, /editable\?\.source === 'override'\) return '上書き';/, "sourceBadgeText must read 上書き when overridden");

  const ariaStart = matrixSrc.indexOf("function sourceAriaWord(");
  assert.ok(ariaStart >= 0, "sourceAriaWord helper not found");
  const ariaBody = matrixSrc.slice(ariaStart, matrixSrc.indexOf("\n}", ariaStart));
  assert.match(ariaBody, /editable\?\.source === 'override'\) return '上書き値';/, "sourceAriaWord must read 上書き値 when overridden");

  const fnStart = matrixSrc.indexOf("function OutputCell({");
  assert.ok(fnStart >= 0, "OutputCell not found");
  const fnEnd = matrixSrc.indexOf("\nfunction ", fnStart + 10);
  const fnBody = matrixSrc.slice(fnStart, fnEnd);
  assert.match(fnBody, /const isOverridden = editable\?\.source === 'override';/, "OutputCell must detect override mode from editable.source");
  assert.match(fnBody, /\{sourceBadgeText\(editable\)\}/, "OutputCell badge must render via the shared sourceBadgeText helper");
  assert.match(fnBody, /aria-label=\{`\$\{label\}（\$\{sourceAriaWord\(editable\)\}）`\}/, "OutputCell cell must expose a source-aware aria-label via sourceAriaWord");
  assert.match(fnBody, /const overrideAriaLabel = overrideNote \? `\$\{label\} を上書き（\$\{overrideNote\}）` : `\$\{label\} を上書き`;/, "OutputCell must expose an explicit '...を上書き' affordance, appending overrideNote when a basis-switching override is passed");
  assert.match(fnBody, /aria-label=\{overrideAriaLabel\}/, "OutputCell's override button must use the note-aware overrideAriaLabel");
  assert.match(fnBody, /aria-label=\{`\$\{label\} 上書きを保存`\}/, "OutputCell's editing mode must expose an explicit 保存 (save) control");
  assert.match(fnBody, />\s*保存\s*</, "OutputCell's editing mode must render a visible 保存 button");
  assert.match(fnBody, /aria-label=\{`\$\{label\} 上書きをキャンセル`\}/, "OutputCell's editing mode must expose an explicit 取消 (cancel) control");
  assert.match(fnBody, />\s*取消\s*</, "OutputCell's editing mode must render a visible 取消 button");
  assert.match(fnBody, /min-h-\[44px\]/, "OutputCell controls must carry the 44px touch target sizing");
  assert.match(fnBody, /aria-label=\{`\$\{label\} の上書きを解除`\}/, "OutputCell must expose an explicit clear-override control");
}

// 43. The "＋入力" (+ input) affordance for empty actionable cells is visible by default (a real
// placeholder string on the input), not hidden/sr-only text.
{
  const fnStart = matrixSrc.indexOf("function NumberCell({");
  assert.ok(fnStart >= 0, "NumberCell not found");
  const fnEnd = matrixSrc.indexOf("\nfunction ", fnStart + 10);
  const fnBody = matrixSrc.slice(fnStart, fnEnd);
  assert.match(fnBody, /placeholder = '＋入力'/, "NumberCell must default its placeholder to the visible ＋入力 affordance");
  assert.match(fnBody, /placeholder=\{placeholder\}/, "NumberCell must wire the placeholder onto the actual <input>, not hide it");
  assert.doesNotMatch(fnBody, /sr-only/, "the ＋入力 affordance must not be visually hidden via sr-only");
}

// 44. The matrix scrolls horizontally only. Page scroll owns the vertical movement so the annual
// projection below stays reachable, while the <table> remains fixed-layout from sticky label plus
// one width per event column.
expectMatrixIncludes([
  'className="w-full overflow-x-auto border border-slate-200 dark:border-slate-800"',
  "style={{ tableLayout: 'fixed', width: 152 + sortedEvents.length * 144 }}",
  "全株主を展開",
]);
assert.doesNotMatch(matrixSrc, /max-h-\[70vh\]|overflow-auto/, "CapitalPlanMatrix must not create an internal vertical scroll container");

// 45. Eligibility issues (blocking errors + warnings from checkPublishEligibility) are surfaced as a
// clickable validation summary list, each entry jumping to the offending event.
expectIncludes([
  "checkPublishEligibility,",
  "const eligibility = useMemo(() => checkPublishEligibility(plan), [plan]);",
  "const issues = useMemo(",
  "...eligibility.blockingIssues, ...eligibility.warnings",
  "onClick={() => selectEventFromIssue(issue.eventId)}",
]);

// 46. The advanced "詳細設定" (株主・イベント詳細設定) section's controls carry Japanese aria-labels
// (event status select, holder name/kind fields), not just visual labels.
expectIncludes([
  'aria-label="イベントステータス（確定履歴／将来計画）"',
  "aria-label={`株主名 ${h.name}`}",
  "aria-label={`株主種別 ${h.name}`}",
]);

// 47. No "protect holder" (守りたい株主) concept remains anywhere in the workspace source: neither
// as intro copy (already covered by #25) nor as a field/function/identifier name.
expectNotIncludes(["protectHolder", "protectedHolder", "ProtectHolder", "守りたい株主"]);

// 48. Editing event.pricePerShare on a valuation_and_investment/ownership_target event, or
// event.preMoneyValuation on a price_and_shares event, auto-switches calculationBasis coherently
// (editing changes the calculation basis rather than being blocked) — updateEvent detects the
// patched field against the event's current basis before falling through to the raw merge. The
// auto-switch is gated on an actual entered value (`!== undefined`): clearing an existing override
// (patch.pricePerShare / patch.preMoneyValuation explicitly set to undefined) must NOT trigger the
// switch — it must fall through to the raw merge instead, which simply clears the field so
// deriveCapitalPlan recomputes it fresh, rather than silently resolving the clear to 0 via
// resolvedValue(undefined) and forcing an unwanted basis change.
{
  const fnStart = src.indexOf("function updateEvent(eventId: string, patch: Partial<CapitalEvent>)");
  assert.ok(fnStart >= 0, "updateEvent not found");
  const fnBody = src.slice(fnStart, fnStart + 1400);
  assert.match(
    fnBody,
    /Object\.prototype\.hasOwnProperty\.call\(patch, "pricePerShare"\)\s*&&\s*\n\s*patch\.pricePerShare !== undefined\s*&&\s*\n\s*\(event\.calculationBasis === "valuation_and_investment" \|\| event\.calculationBasis === "ownership_target"\)/,
    "updateEvent must only auto-switch on a pricePerShare edit when patch.pricePerShare is an actual entered value (not undefined/clearing)",
  );
  assert.match(fnBody, /switchToPriceAndSharesOnPriceEdit\(eventId, patch\.pricePerShare\);/, "must delegate to switchToPriceAndSharesOnPriceEdit with the incoming patch value");
  assert.match(
    fnBody,
    /Object\.prototype\.hasOwnProperty\.call\(patch, "preMoneyValuation"\)\s*&&\s*\n\s*patch\.preMoneyValuation !== undefined\s*&&\s*\n\s*event\.calculationBasis === "price_and_shares"/,
    "updateEvent must only auto-switch on a preMoneyValuation edit when patch.preMoneyValuation is an actual entered value (not undefined/clearing)",
  );
  assert.match(
    fnBody,
    /switchToValuationAndInvestmentOnPreMoneyEdit\(eventId, patch\.preMoneyValuation\);/,
    "must delegate to switchToValuationAndInvestmentOnPreMoneyEdit with the incoming patch value",
  );
  assert.match(
    fnBody,
    /patch\.type === "convertible_conversion" &&\s*\n\s*event\.type !== "convertible_conversion"/,
    "updateEvent must detect a type change into convertible_conversion",
  );
  assert.match(fnBody, /switchToConvertibleConversionType\(eventId, patch\);/, "must delegate to switchToConvertibleConversionType");

  // Reference-model sanity check mirroring the exact guard shape: clearing (undefined) must be
  // excluded even though hasOwnProperty is true for an explicit `{ pricePerShare: undefined }` patch.
  function wouldAutoSwitch(patchHasOwn: boolean, patchValue: unknown, basisMatches: boolean) {
    return patchHasOwn && patchValue !== undefined && basisMatches;
  }
  assert.equal(wouldAutoSwitch(true, undefined, true), false, "an explicit clear (undefined value, own-property true) must not auto-switch");
  assert.equal(wouldAutoSwitch(true, 12345, true), true, "an actual entered value must still auto-switch");
}

// 49. switchToPriceAndSharesOnPriceEdit: the newly-typed price becomes the input driver (taken from
// the incoming patch value, not the stale event field), allocation shares stay/become input,
// allocation amount + event aggregates become calculated, and every allocation's own pricePerShare
// is cleared so the event-level price is the single driver (a stale per-allocation price would
// otherwise silently override the event price inside deriveEvent's price_and_shares branch).
{
  const fnStart = src.indexOf("function switchToPriceAndSharesOnPriceEdit(");
  assert.ok(fnStart >= 0, "switchToPriceAndSharesOnPriceEdit not found");
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.match(fnBody, /calculationBasis: "price_and_shares"/, "must switch calculationBasis to price_and_shares");
  assert.match(
    fnBody,
    /pricePerShare: editableValue\(resolvedValue\(nextPricePerShare\), "input"\)/,
    "event price must be adopted from the incoming patch value as a fresh input driver",
  );
  assert.match(fnBody, /preMoneyValuation: toCalculated\(e\.preMoneyValuation\)/, "preMoneyValuation must become a calculated output");
  assert.match(fnBody, /amount: toCalculated\(a\.amount\)/, "allocation amount must become a calculated output");
  assert.match(fnBody, /pricePerShare: undefined/, "every allocation's own pricePerShare must be cleared so the event price is the single driver");
}

// 50. switchToValuationAndInvestmentOnPreMoneyEdit: the newly-typed pre-money becomes the input
// driver (from the incoming patch, not the stale field), allocation amount becomes input,
// allocation shares/price and event aggregates become calculated.
{
  const fnStart = src.indexOf("function switchToValuationAndInvestmentOnPreMoneyEdit(");
  assert.ok(fnStart >= 0, "switchToValuationAndInvestmentOnPreMoneyEdit not found");
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.match(fnBody, /calculationBasis: "valuation_and_investment"/, "must switch calculationBasis to valuation_and_investment");
  assert.match(
    fnBody,
    /preMoneyValuation: editableValue\(resolvedValue\(nextPreMoneyValuation\), "input"\)/,
    "pre-money must be adopted from the incoming patch value as a fresh input driver",
  );
  assert.match(fnBody, /amount: toInputResolved\(a\.amount\)/, "allocation amount must become an input driver");
  assert.match(fnBody, /shares: toCalculatedShares\(a\.shares\)/, "allocation shares must become a calculated output");
  assert.match(fnBody, /pricePerShare: toCalculated\(a\.pricePerShare\)/, "allocation pricePerShare must become a calculated output");
}

// 51. convertible_conversion's calculation basis is a fixed Japanese manual-only display (no
// selector) in the detail EventEditor, mirroring the matrix; switching an event's type INTO
// convertible_conversion normalizes calculationBasis to manual via switchToConvertibleConversionType,
// while switching away leaves calculationBasis untouched (falls through updateEvent's raw merge).
{
  const labelIdx = src.indexOf('<span className="text-xs font-medium text-zinc-500">計算基準</span>');
  assert.ok(labelIdx >= 0, "計算基準 label not found");
  const block = src.slice(labelIdx, labelIdx + 900);
  assert.match(block, /event\.type === "convertible_conversion" \? \(/, "計算基準 field must branch on event.type === convertible_conversion");
  assert.match(block, /\{CALCULATION_BASIS_LABEL\.manual\}/, "convertible_conversion branch must render the fixed manual label, not a live value");
  assert.doesNotMatch(
    block.slice(0, block.indexOf(") : (")),
    /<select/,
    "convertible_conversion branch must not render a <select> (manual-only fixed display)",
  );
  assert.match(block, /<select[\s\S]*?onChange=\{\(e\) => onUpdateEvent\(event\.id, \{ calculationBasis: e\.target\.value as CalculationBasis \}\)\}/, "non-convertible_conversion branch must still render the live selector");
}
{
  const fnStart = src.indexOf("function switchToConvertibleConversionType(");
  assert.ok(fnStart >= 0, "switchToConvertibleConversionType not found");
  const fnBody = src.slice(fnStart, fnStart + 700);
  assert.match(fnBody, /calculationBasis: "manual"/, "switching type into convertible_conversion must force calculationBasis to manual");
  assert.match(fnBody, /preMoneyValuation: toInputResolved\(e\.preMoneyValuation\)/, "must renormalize preMoneyValuation to a manual input");
  assert.match(fnBody, /pricePerShare: toInputResolved\(e\.pricePerShare\)/, "must renormalize pricePerShare to a manual input");
}

// 52. addAllocation is basis-aware like the matrix: valuation_and_investment creates an input
// amount + calculated shares (never an input shares of zero, since amount is the driver there);
// price_and_shares creates an input shares + calculated amount; ownership_target creates
// calculated shares/amount/price with an input target ownership percentage; any other basis
// (including convertible_conversion, which is always manual) falls back to a plain input shares row.
{
  const fnStart = src.indexOf("function addAllocation(eventId: string)");
  assert.ok(fnStart >= 0, "addAllocation not found");
  const fnBody = src.slice(fnStart, fnStart + 1600);
  assert.match(fnBody, /const basis = event\?\.calculationBasis;/, "addAllocation must read the target event's calculationBasis");

  const valuationIdx = fnBody.indexOf('if (basis === "valuation_and_investment")');
  const priceIdx = fnBody.indexOf('else if (basis === "price_and_shares")');
  const ownershipIdx = fnBody.indexOf('else if (basis === "ownership_target")');
  const elseIdx = fnBody.indexOf("} else {", ownershipIdx);
  assert.ok(valuationIdx >= 0 && priceIdx > valuationIdx && ownershipIdx > priceIdx && elseIdx > ownershipIdx, "addAllocation must branch on valuation_and_investment / price_and_shares / ownership_target / default in that order");

  const valuationBlock = fnBody.slice(valuationIdx, priceIdx);
  assert.match(valuationBlock, /shares: editableValue\(0, "calculated"\)/, "valuation_and_investment must NOT create an input shares of zero — shares must be a calculated output");
  assert.match(valuationBlock, /amount: editableValue\(0, "input"\)/, "valuation_and_investment must create an input amount (the basis driver)");

  const priceBlock = fnBody.slice(priceIdx, ownershipIdx);
  assert.match(priceBlock, /shares: editableValue\(0, "input"\)/, "price_and_shares must create an input shares (the basis driver)");
  assert.match(priceBlock, /amount: editableValue\(0, "calculated"\)/, "price_and_shares must create a calculated amount");

  const ownershipBlock = fnBody.slice(ownershipIdx, elseIdx);
  assert.match(ownershipBlock, /shares: editableValue\(0, "calculated"\)/, "ownership_target must create calculated shares");
  assert.match(ownershipBlock, /amount: editableValue\(0, "calculated"\)/, "ownership_target must create calculated amount");
  assert.match(ownershipBlock, /pricePerShare: editableValue\(0, "calculated"\)/, "ownership_target must create calculated pricePerShare");
  assert.match(ownershipBlock, /targetOwnershipPercentage: editableValue\(0, "input"\)/, "ownership_target must create an input target ownership percentage");
}

// 53. Freeze exact-once behavior (migration 180, scripts/migrations/180_freeze_capital_plan_derived_document.sql):
// the DB-side freeze_capital_plan RPC resolves duplicate calls for the same (plan_id, source_revision)
// to the same version instead of double-appending. The client-side contract that makes this safe is:
// freezePlan captures a single fixed expectedRevision snapshot (latestRevisionRef.current, not a
// possibly-stale `revision` state closure) once per call and sends it as expectedRevision/source_revision,
// and the freeze action awaits flushPendingSave + is gated behind busyAction (see check 22) so a
// double-click cannot fire two overlapping freeze requests before the first one settles.
{
  const fnStart = src.indexOf("async function freezePlan()");
  assert.ok(fnStart >= 0, "freezePlan not found");
  const fnBody = src.slice(fnStart, fnStart + 900);
  assert.match(fnBody, /const flushed = await flushPendingSave\(\);/, "freezePlan must flush any pending save before requesting a freeze");
  assert.match(fnBody, /if \(!flushed\) return;/, "freezePlan must abort if flushPendingSave fails");
  assert.match(fnBody, /setBusyAction\("freeze"\);/, "freezePlan must mark busyAction so the freeze button disables against double-clicks");
  assert.match(
    fnBody,
    /const effectiveRevision = latestRevisionRef\.current;/,
    "freezePlan must capture a single fixed revision snapshot from the ref (not React state) at call time",
  );
  assert.match(
    fnBody,
    /body: JSON\.stringify\(\{ action: "freeze", planId: selectedPlanId, expectedRevision: effectiveRevision \}\)/,
    "freezePlan must send the captured effectiveRevision as expectedRevision (the source_revision the exact-once uniqueness constraint keys on)",
  );
}

// 54. EventEditor allocation 1株価格 cell: single issue-price semantics. Under manual basis the
// cell remains individually editable (bound to alloc.pricePerShare, routed to onUpdateAllocation
// so per-allocation pricing stays possible). Under valuation_and_investment / ownership_target /
// price_and_shares the cell must display the single event/derived price (event.pricePerShare) and
// route every edit/clear to onUpdateEvent(event.id, { pricePerShare: v }) instead of
// onUpdateAllocation — never storing a per-allocation price, so all allocation rows in the round
// reflect one price (a VC-submission contradiction otherwise: an allocation price that silently
// diverges from the event price while eligible stays true).
{
  const gridStart = src.indexOf('<span>1株価格</span>');
  assert.ok(gridStart >= 0, "allocation table header (1株価格) not found");
  const cellStart = src.indexOf("event.calculationBasis === \"manual\"", gridStart);
  assert.ok(cellStart >= 0, "allocation 1株価格 cell must branch on event.calculationBasis === \"manual\"");
  const cellBody = src.slice(cellStart, cellStart + 900);

  const manualBranch = cellBody.slice(0, cellBody.indexOf(") : ("));
  assert.match(manualBranch, /ev=\{alloc\.pricePerShare\}/, "manual basis must keep the cell bound to alloc.pricePerShare");
  assert.match(
    manualBranch,
    /onChange=\{\(v\) => onUpdateAllocation\(event\.id, alloc\.id, \{ pricePerShare: v \}\)\}/,
    "manual basis must keep routing edits to onUpdateAllocation (per-allocation pricing stays editable)",
  );

  const derivedBranch = cellBody.slice(cellBody.indexOf(") : ("));
  assert.match(derivedBranch, /ev=\{event\.pricePerShare\}/, "non-manual bases must display event.pricePerShare (the single effective/derived price), not alloc.pricePerShare");
  assert.match(
    derivedBranch,
    /onChange=\{\(v\) => onUpdateEvent\(event\.id, \{ pricePerShare: v \}\)\}/,
    "non-manual bases must route edits/clears to onUpdateEvent(event.id, { pricePerShare: v }), never onUpdateAllocation",
  );
  assert.ok(
    !derivedBranch.includes("onUpdateAllocation"),
    "non-manual bases must never call onUpdateAllocation for pricePerShare (would let allocation price diverge from the event price)",
  );
}

// 55. EventEditor allocation 目標比率（%） cell: the engine stores targetOwnershipPercentage as a
// ratio (0.2), matching CapitalPlanMatrix.tsx's FD% cell (which reads `resolvedValue(...) * 100`
// for display and divides by 100 on commit, see check below). TableNumberInput must mirror that
// unit contract via a scaleEditableValue helper so 0.2 renders as 20 and typing 20 saves 0.2,
// preserving EditableValue.source/calculatedValue/note and passing undefined through untouched.
{
  const helperStart = src.indexOf("function scaleEditableValue(");
  assert.ok(helperStart >= 0, "scaleEditableValue helper not found");
  const helperBody = src.slice(helperStart, src.indexOf("\n}", helperStart) + 2);
  assert.match(helperBody, /if \(!ev\) return undefined;/, "scaleEditableValue must handle undefined ev cleanly");
  assert.match(helperBody, /\.\.\.ev,/, "scaleEditableValue must spread ev to preserve source/note");
  assert.match(helperBody, /value: ev\.value \* factor/, "scaleEditableValue must scale value by factor");
  assert.match(
    helperBody,
    /calculatedValue: ev\.calculatedValue != null \? ev\.calculatedValue \* factor : ev\.calculatedValue/,
    "scaleEditableValue must scale calculatedValue by factor when present, and leave it untouched (undefined) otherwise",
  );

  const headerIdx = src.indexOf("<span>目標比率（%）</span>");
  assert.ok(headerIdx >= 0, "allocation table header must read 目標比率（%）, not 目標比率");

  const cellStart = src.indexOf("ev={scaleEditableValue(alloc.targetOwnershipPercentage, 100)}", headerIdx);
  assert.ok(cellStart >= 0, "目標比率（%） cell must display scaleEditableValue(alloc.targetOwnershipPercentage, 100) (ratio -> percent)");
  const cellBody = src.slice(cellStart, cellStart + 400);
  assert.match(
    cellBody,
    /targetOwnershipPercentage: scaleEditableValue\(v, 1 \/ 100\)/,
    "目標比率（%） cell onChange must save scaleEditableValue(v, 1 / 100) (percent -> ratio) via onUpdateAllocation",
  );
  assert.match(
    cellBody,
    /ariaLabel=\{`目標比率（%） /,
    "目標比率（%） cell aria-label must include （%） so screen reader users know the unit",
  );
}

// 56. OutputCell's overrideNote (short visible text + aria-label explaining that this override
// also switches calculationBasis, see check 48 / switchToPriceAndSharesOnPriceEdit /
// switchToValuationAndInvestmentOnPreMoneyEdit) is wired on exactly the two matrix cells whose
// onOverride triggers that switch: pricePerShare's OutputCell (rendered only under
// valuation_and_investment/ownership_target, mirroring updateEvent's switch-to-price_and_shares
// gate) and preMoneyValuation's OutputCell (rendered only under price_and_shares, mirroring
// updateEvent's switch-to-valuation_and_investment gate). Every other OutputCell call site is a
// plain in-place override and must not claim a basis change.
{
  assert.match(
    matrixSrc,
    /overrideNote\?: string;/,
    "OutputCell props must declare an optional overrideNote",
  );
  assert.match(
    matrixSrc,
    /overrideAriaLabel = overrideNote \? `\$\{label\} を上書き（\$\{overrideNote\}）` : `\$\{label\} を上書き`;/,
    "OutputCell must build overrideAriaLabel from overrideNote",
  );

  const preMoneyOutputIdx = matrixSrc.indexOf("value={event.preMoneyValuation?.value}");
  assert.ok(preMoneyOutputIdx >= 0, "preMoneyValuation OutputCell not found");
  const preMoneyOutputBlock = matrixSrc.slice(preMoneyOutputIdx, matrixSrc.indexOf("/>", preMoneyOutputIdx));
  assert.match(
    preMoneyOutputBlock,
    /overrideNote="評価額入力→評価額×投資額（投資額維持）"/,
    "preMoneyValuation OutputCell (shown only under price_and_shares) must carry the basis-switch overrideNote",
  );

  const priceOutputIdx = matrixSrc.indexOf("value={event.pricePerShare?.value}");
  assert.ok(priceOutputIdx >= 0, "pricePerShare OutputCell not found");
  const priceOutputBlock = matrixSrc.slice(priceOutputIdx, matrixSrc.indexOf("/>", priceOutputIdx));
  assert.match(
    priceOutputBlock,
    /overrideNote="単価入力→単価×株数（株数維持）"/,
    "pricePerShare OutputCell (shown only under valuation_and_investment/ownership_target) must carry the basis-switch overrideNote",
  );

  const overrideNoteOccurrences = matrixSrc.match(/overrideNote="/g) ?? [];
  assert.equal(
    overrideNoteOccurrences.length,
    2,
    "overrideNote must be wired on exactly the two basis-switching OutputCell call sites, not on any plain in-place override (postMoneyValuation/primaryRaise/newShares/holder aggregates)",
  );
}

console.log("check_capital_plan_workspace.mts: all checks passed");
