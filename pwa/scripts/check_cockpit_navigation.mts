import assert from "node:assert/strict";
import {
  COCKPIT_GROUPS,
  COCKPIT_TABS,
  cockpitGroupForTab,
  resolveCockpitTab,
} from "../src/lib/cockpit-tabs.ts";

assert.ok(!COCKPIT_TABS.includes("themes" as never), "themes must stay out of the PJ cockpit");

assert.deepEqual(
  COCKPIT_GROUPS.normal.map((group) => group.label),
  ["進捗管理", "事業計画", "PJ管理"],
);
assert.deepEqual(
  COCKPIT_GROUPS.institution.map((group) => group.label),
  ["進捗管理", "シーズリスト", "規程・内規", "PJ管理"],
);

for (const [kind, groups] of Object.entries(COCKPIT_GROUPS)) {
  const children = groups.flatMap((group) => group.children);
  assert.equal(
    new Set(children).size,
    children.length,
    `${kind} cockpit tabs must belong to only one group`,
  );
}

assert.equal(cockpitGroupForTab("gantt", false).label, "進捗管理");
assert.equal(cockpitGroupForTab("capital-policy", false).label, "事業計画");
assert.equal(cockpitGroupForTab("overview", false).label, "PJ管理");
assert.equal(cockpitGroupForTab("seeds", true).label, "シーズリスト");
assert.equal(cockpitGroupForTab("regulations", true).label, "規程・内規");

assert.equal(resolveCockpitTab("capital-policy", true), "progress");
assert.equal(resolveCockpitTab("business-plan", true), "progress");
assert.equal(resolveCockpitTab("seeds", false), "progress");
assert.equal(resolveCockpitTab("regulations", false), "progress");
assert.equal(resolveCockpitTab("overview", true), "overview");

console.log("cockpit navigation grouping contract: ok");
