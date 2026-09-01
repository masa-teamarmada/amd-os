import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COCKPIT_GROUPS,
  COCKPIT_TABS,
  cockpitGroupForTab,
  resolveCockpitTab,
} from "../src/lib/cockpit-tabs.ts";

assert.ok(!COCKPIT_TABS.includes("themes" as never), "themes must stay out of the PJ cockpit");
assert.ok(COCKPIT_TABS.includes("objective-structure"), "objective structure must be a cockpit tab");

assert.deepEqual(
  COCKPIT_GROUPS.normal.map((group) => group.label),
  ["進捗管理", "事業計画", "ドライブ", "PJ管理"],
);
assert.deepEqual(
  COCKPIT_GROUPS.institution.map((group) => group.label),
  ["進捗管理", "シーズリスト", "規程・内規", "ドライブ", "PJ管理"],
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
assert.equal(cockpitGroupForTab("objective-structure", false).label, "進捗管理");
assert.equal(cockpitGroupForTab("objective-structure", true).label, "進捗管理");
assert.equal(cockpitGroupForTab("capital-policy", false).label, "事業計画");
assert.equal(cockpitGroupForTab("overview", false).label, "PJ管理");
assert.equal(cockpitGroupForTab("seeds", true).label, "シーズリスト");
// ドライブは PJ管理 の中ではなく分類そのもの (2026-09-02 まさ依頼)
assert.equal(cockpitGroupForTab("documents", false).label, "ドライブ");
assert.equal(cockpitGroupForTab("documents", true).label, "ドライブ");
assert.equal(cockpitGroupForTab("regulations", true).label, "規程・内規");

assert.equal(resolveCockpitTab("capital-policy", true), "progress");
assert.equal(resolveCockpitTab("business-plan", true), "progress");
assert.equal(resolveCockpitTab("seeds", false), "progress");
assert.equal(resolveCockpitTab("regulations", false), "progress");
assert.equal(resolveCockpitTab("overview", true), "overview");

const cockpitViewSource = fs.readFileSync(
  new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
  "utf8",
);
assert.match(cockpitViewSource, /min-h-11 sm:min-h-9/, "mobile group touch target with compact desktop height");
assert.match(cockpitViewSource, /min-h-11 sm:min-h-8/, "mobile child touch target with compact desktop height");
assert.match(cockpitViewSource, /min-h-11 sm:min-h-7/, "mobile float target with compact desktop height");
assert.doesNotMatch(cockpitViewSource, /className={`min-h-12 w-full/, "legacy oversized group height must not return");
assert.doesNotMatch(cockpitViewSource, /className={`flex min-h-11 w-full cursor-pointer items-center/, "legacy oversized float height must not return");

const kuteSeedsSource = fs.readFileSync(
  new URL("../src/components/cockpit/CockpitKuteSeeds.tsx", import.meta.url),
  "utf8",
);
for (const retiredCopy of ["連携シーズ比較", "優先順位と次の検証を決める候補一覧"]) {
  assert.doesNotMatch(kuteSeedsSource, new RegExp(retiredCopy), `KUTE seeds retired header copy must stay absent: ${retiredCopy}`);
}
assert.match(
  kuteSeedsSource,
  /scope === "all" && \([\s\S]*?aria-label="シーズ集計"/,
  "global seed list header and summary must remain scoped away from cockpit tab",
);

console.log("cockpit navigation grouping contract: ok");
