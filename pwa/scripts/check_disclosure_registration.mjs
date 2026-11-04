import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const surface = "data-amie-disclosure-surface";
const trigger = "data-amie-disclosure-trigger";
const attrs = (node) => new Map(node.attributes.properties.filter(ts.isJsxAttribute).map((attr) => [attr.name.getText(), attr.initializer?.getText() ?? "true"]));
function inspect(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  let surfaces = 0;
  let native = 0;
  function visit(node, owner) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const a = attrs(opening);
      const tag = opening.tagName.getText();
      if (tag === "summary") native += 1;
      if (a.has(surface)) {
        owner = { count: 0, line: ast.getLineAndCharacterOfPosition(opening.getStart()).line + 1 };
        surfaces += 1;
      }
      if (a.has(trigger)) {
        if (!owner) errors.push("trigger has no owning surface");
        else owner.count += 1;
        if (tag !== "button" || a.get("type") !== '"button"' || !a.has("aria-expanded")) errors.push("trigger must be a native type=button with aria-expanded");
      }
      ts.forEachChild(node, (child) => visit(child, owner));
      if (a.has(surface) && owner.count !== 1) errors.push(`surface at line ${owner.line} has ${owner.count} own triggers; exactly one is required`);
      return;
    }
    ts.forEachChild(node, (child) => visit(child, owner));
  }
  visit(ast, null);
  return { errors, surfaces, native };
}

// Fail broken wiring, including nested cards accidentally targeting their parent.
assert.equal(inspect('<div data-amie-disclosure-surface><button type="button" aria-expanded={false} data-amie-disclosure-trigger /></div>', "fixture.tsx").errors.length, 0);
assert.ok(inspect('<div data-amie-disclosure-surface />', "fixture.tsx").errors.length);
assert.ok(inspect('<button data-amie-disclosure-trigger />', "fixture.tsx").errors.length);
assert.ok(inspect('<div data-amie-disclosure-surface><section data-amie-disclosure-surface><button type="button" aria-expanded={false} data-amie-disclosure-trigger /></section></div>', "fixture.tsx").errors.length);

const registeredFiles = new Set();
let surfaces = 0;
let native = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith(".tsx")) {
      const result = inspect(readFileSync(file, "utf8"), file);
      assert.deepEqual(result.errors, [], path.relative(root, file));
      if (result.surfaces) registeredFiles.add(path.basename(file));
      surfaces += result.surfaces;
      native += result.native;
    }
  }
}
walk(path.join(root, "src"));
for (const file of ["AdminContextsTable.tsx", "AdminProtocolsClient.tsx", "AdminPromptsClient.tsx", "AdminChangeHistoryClient.tsx", "AdminMsOverviewClient.tsx", "EvidencePanel.tsx", "AppNotificationsSection.tsx", "MeetingRoadmap.tsx", "MilestoneGanttChart.tsx", "CockpitBusinessPlan.tsx", "ProjectFinanceFormat.tsx", "CapitalPlanMatrix.tsx", "SeedNeedsWorkspace.tsx", "MarketNeedsList.tsx", "ProjectCardDesigns.tsx", "InstitutionSupportProfile.tsx", "CockpitOrgSection.tsx"]) {
  assert.ok(registeredFiles.has(file), `${file}: retain the reviewed header hit area`);
}
console.log(`Disclosure registration: ${surfaces} custom headers in ${registeredFiles.size} components; ${native} native summaries inventoried (the shared rule applies only to application scope).`);
