import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COCKPIT_GROUPS,
  COCKPIT_TABS,
  DEFAULT_COCKPIT_TAB,
  cockpitGroupForTab,
  resolveCockpitTab,
} from "../src/lib/cockpit-tabs.ts";

assert.ok(!COCKPIT_TABS.includes("themes" as never), "themes must stay out of the PJ cockpit");
assert.ok(COCKPIT_TABS.includes("objective-structure"), "legacy objective URL must remain parseable");
assert.ok(
  !COCKPIT_GROUPS.normal.some((group) => group.children.includes("objective-structure")),
  "objective structure must no longer be a visible cockpit tab",
);

assert.deepEqual(
  COCKPIT_GROUPS.normal.map((group) => group.label),
  ["進捗管理", "事業計画", "ドライブ", "PJ管理", "会社情報"],
);
assert.deepEqual(
  COCKPIT_GROUPS.institution.map((group) => group.label),
  ["進捗管理", "シーズリスト", "規程・内規", "ドライブ", "PJ管理", "会社情報"],
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
assert.equal(cockpitGroupForTab("capital-policy", false).label, "会社情報");
assert.equal(cockpitGroupForTab("overview", false).label, "PJ管理");
assert.equal(cockpitGroupForTab("project-contracts", false).label, "PJ管理");
assert.equal(cockpitGroupForTab("project-finance", false).label, "PJ管理");
assert.equal(cockpitGroupForTab("company", false).label, "会社情報");
assert.equal(cockpitGroupForTab("activity", false).label, "会社情報");
assert.equal(cockpitGroupForTab("seeds", true).label, "シーズリスト");
// ドライブは PJ管理 の中ではなく分類そのもの (2026-09-02 まさ依頼)
assert.equal(cockpitGroupForTab("documents", false).label, "ドライブ");
assert.equal(cockpitGroupForTab("documents", true).label, "ドライブ");
assert.equal(cockpitGroupForTab("regulations", true).label, "規程・内規");

// 進捗管理はゴールツリー → タスク → ガント → 残りは元の順。既定タブはその一番左
// （2026-09-13 まさ「進捗グループを使うときは最初に論点タブを開くので、一番左を論点、
//  次にタスク、次にガント、あとはそのままの順番に」）。
for (const kind of ["normal", "institution"] as const) {
  const progress = COCKPIT_GROUPS[kind].find((group) => group.key === "progress-group");
  assert.deepEqual(
    progress?.children,
    ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"],
    `${kind} progress group order`,
  );
}
assert.equal(DEFAULT_COCKPIT_TAB, "issues");

assert.equal(resolveCockpitTab("capital-policy", true), "capital-policy");
assert.equal(resolveCockpitTab("business-plan", true), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTab("seeds", false), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTab("regulations", false), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTab("overview", true), "overview");
assert.equal(resolveCockpitTab("project-contracts", true), "project-contracts");
assert.equal(resolveCockpitTab("project-finance", true), "project-finance");
assert.equal(resolveCockpitTab("activity", true), "activity");
assert.equal(resolveCockpitTab("objective-structure", false), "gantt");
assert.equal(resolveCockpitTab("objective-structure", true), "gantt");

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
