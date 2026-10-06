import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COCKPIT_TABS,
  DEFAULT_COCKPIT_TAB,
  cockpitGroupForTabInType,
  cockpitGroupsForType,
  resolveCockpitTabForType,
} from "../src/lib/cockpit-tabs.ts";
import { PROJECT_FORMAT_TYPES, projectFormatTypeOf, WORKSPACE_TAB_FORMATS, DD_TAB_FORMAT } from "../src/lib/project-formats.ts";

// タブの並びはPJタイプ（大学発SU・新規事業・研究機関エコシステム・AMD本体）ごとに1つ。
// 同じタイプのPJは、データの有無にかかわらず同じタブを持つ（2026-10-03 まさ「全部統一してないとだめ。OSの大原則」、spec 3-23）。
const TYPES = PROJECT_FORMAT_TYPES.map((entry) => entry.type);
assert.deepEqual(TYPES, ["su", "new_business", "ecosystem", "amd"]);

assert.ok(!COCKPIT_TABS.includes("themes" as never), "themes must stay out of the PJ cockpit");
assert.ok(COCKPIT_TABS.includes("objective-structure"), "legacy objective URL must remain parseable");
assert.ok(COCKPIT_TABS.includes("cost-fuel"), "legacy fuel cost URL must remain parseable");
for (const type of TYPES) {
  const children = cockpitGroupsForType(type).flatMap((group) => group.children);
  assert.ok(!children.includes("objective-structure"), `${type}: objective structure must no longer be a visible cockpit tab`);
  assert.ok(!children.includes("cost-fuel"), `${type}: fuel cost lives inside the cost tab, not as its own tab`);
  assert.equal(new Set(children).size, children.length, `${type} cockpit tabs must belong to only one group`);
  assert.equal(resolveCockpitTabForType("contracts", type), "contracts");
  assert.equal(cockpitGroupForTabInType("contracts", type).label, "会社情報");
  assert.ok(WORKSPACE_TAB_FORMATS[type].some(group => group.tabs.includes("contracts")));
  assert.equal(resolveCockpitTabForType("killer-factors", type), "killer-factors", `${type}: catalog has its own URL`);
  assert.equal(cockpitGroupForTabInType("killer-factors", type).label, "会社情報");
  assert.ok(!WORKSPACE_TAB_FORMATS[type].some(group => group.tabs.includes("killer-factors")), `${type}: internal catalog page must not be shared`);
}
assert.ok(!DD_TAB_FORMAT.some(group => (group.tabs as readonly string[]).includes("killer-factors")), "DD must not expose the catalog page");

const STANDARD_GROUPS = ["進捗管理", "事業計画", "ドライブ", "PJ管理", "会社情報"];
for (const type of ["su", "new_business", "amd"] as const) {
  // DDパッケージのタブは、AMDの管理者が見るときだけ出る（表示条件は CockpitView の役割の判定）。PJでは出し分けない。
  assert.deepEqual(cockpitGroupsForType(type).map((group) => group.label), STANDARD_GROUPS, `${type} groups`);
}
assert.deepEqual(
  cockpitGroupsForType("ecosystem").map((group) => group.label),
  ["進捗管理", "シーズリスト", "規程・内規", "ドライブ", "PJ管理", "会社情報"],
);
// 事業計画グループの中身は大学発SU・新規事業で同じ。AMD本体は AMD Score の内訳だけを持たない。
const businessPlan = (type: "su" | "new_business" | "amd") =>
  cockpitGroupsForType(type).find((group) => group.key === "business-plan-group")?.children;
assert.deepEqual(businessPlan("su"), ["score-detail", "technology", "competition", "business-model", "business-plan", "financial-projection", "capital-plan", "cost-model", "ip"]);
assert.deepEqual(businessPlan("new_business"), businessPlan("su"));
assert.deepEqual(businessPlan("amd"), businessPlan("su")!.filter((tab) => tab !== "score-detail"));

// PJタイプは projects.project_category で決まる。顧問PJは大学発SUと同じ形（2026-10-03 まさ「おけ」）。
assert.equal(projectFormatTypeOf({ projectId: "pX", projectCategory: "dtsu" }), "su");
assert.equal(projectFormatTypeOf({ projectId: "pX", projectCategory: "advisor" }), "su");
assert.equal(projectFormatTypeOf({ projectId: "pX", projectCategory: "new_business" }), "new_business");
assert.equal(projectFormatTypeOf({ projectId: "pX", projectCategory: "ecosystem" }), "ecosystem");
assert.equal(projectFormatTypeOf({ projectId: "pX", projectCategory: null }), "su");

for (const type of ["su", "ecosystem"] as const) {
  assert.equal(cockpitGroupForTabInType("gantt", type).label, "進捗管理");
  assert.equal(cockpitGroupForTabInType("objective-structure", type).label, "進捗管理");
  assert.equal(cockpitGroupForTabInType("monthly-reports", type).label, "PJ管理");
  assert.equal(resolveCockpitTabForType("monthly-reports", type), "monthly-reports");
  // ドライブは PJ管理 の中ではなく分類そのもの (2026-09-02 まさ依頼)
  assert.equal(cockpitGroupForTabInType("documents", type).label, "ドライブ");
}
assert.equal(cockpitGroupForTabInType("capital-policy", "su").label, "会社情報");
assert.equal(cockpitGroupForTabInType("financial-projection", "su").label, "事業計画");
assert.equal(cockpitGroupForTabInType("capital-plan", "su").label, "事業計画");
assert.equal(cockpitGroupForTabInType("cost-fuel", "su").label, "事業計画");
assert.equal(cockpitGroupForTabInType("overview", "su").label, "PJ管理");
assert.equal(cockpitGroupForTabInType("project-contracts", "su").label, "PJ管理");
assert.equal(cockpitGroupForTabInType("project-finance", "su").label, "PJ管理");
assert.equal(cockpitGroupForTabInType("company", "su").label, "会社情報");
assert.equal(cockpitGroupForTabInType("activity", "su").label, "会社情報");
assert.equal(cockpitGroupForTabInType("seeds", "ecosystem").label, "シーズリスト");
assert.equal(cockpitGroupForTabInType("regulations", "ecosystem").label, "規程・内規");
assert.ok(TYPES.every((type) => !cockpitGroupsForType(type).some((group) => group.children.includes("dd"))), "DD is a parallel surface for all types");

// 進捗管理はゴールツリー → タスク → ガント → 残りは元の順。既定タブはその一番左
// （2026-09-13 まさ「進捗グループを使うときは最初に論点タブを開くので、一番左を論点、
//  次にタスク、次にガント、あとはそのままの順番に」）。開いたときのタブは全PJ同じ。
for (const type of TYPES) {
  const progress = cockpitGroupsForType(type).find((group) => group.key === "progress-group");
  assert.deepEqual(
    progress?.children,
    ["issues", "tasks", "gantt", "progress", "meetings", "slack", "weekly", "partners"],
    `${type} progress group order`,
  );
}
assert.equal(DEFAULT_COCKPIT_TAB, "issues");

assert.equal(resolveCockpitTabForType("capital-policy", "ecosystem"), "capital-policy");
assert.equal(resolveCockpitTabForType("capital-plan", "ecosystem"), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTabForType("business-plan", "ecosystem"), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTabForType("dd", "ecosystem"), DEFAULT_COCKPIT_TAB, "研究機関PJにはDDパッケージのタブを出さない");
assert.equal(resolveCockpitTabForType("dd", "su"), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTabForType("seeds", "su"), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTabForType("regulations", "su"), DEFAULT_COCKPIT_TAB);
assert.equal(resolveCockpitTabForType("score-detail", "amd"), DEFAULT_COCKPIT_TAB, "AMD本体は AMD Score の内訳を持たない");
assert.equal(resolveCockpitTabForType("overview", "ecosystem"), "overview");
assert.equal(resolveCockpitTabForType("project-contracts", "ecosystem"), "project-contracts");
assert.equal(resolveCockpitTabForType("project-finance", "ecosystem"), "project-finance");
assert.equal(resolveCockpitTabForType("activity", "ecosystem"), "activity");
assert.equal(resolveCockpitTabForType("objective-structure", "su"), "gantt");
assert.equal(resolveCockpitTabForType("objective-structure", "ecosystem"), "gantt");
assert.equal(resolveCockpitTabForType("cost-fuel", "su"), "cost-model", "旧 ?tab=cost-fuel はコスト試算タブを開く");

const cockpitViewSource = fs.readFileSync(
  new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
  "utf8",
);
const pageMenuSource = fs.readFileSync(new URL("../src/components/nav/ProjectPageMenu.tsx", import.meta.url), "utf8");
assert.match(cockpitViewSource, /<ProjectSpaceLayout/, "cockpit uses the shared left menu layout");
assert.match(cockpitViewSource, /children: group.children.map\(tabItem\)/, "all canonical child pages and prefetch handlers reach the shared menu");
assert.match(pageMenuSource, /min-h-11/, "left menu touch targets remain at least 44px");
assert.match(pageMenuSource, /selected && group.children.length > 1/, "only the chosen group expands, single-child pages are not repeated");
assert.match(pageMenuSource, /onMouseEnter={page.onHover}/, "reference data prefetch remains attached to page entries");
assert.match(cockpitViewSource, /const groups = cockpitGroupsForType\(formatType\);/, "groups come from the PJ type format");

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
