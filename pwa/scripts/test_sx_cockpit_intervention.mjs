import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deriveSxCockpitInterventions } from "../src/lib/sx-cockpit-intervention.ts";

const summary = deriveSxCockpitInterventions(
  {
    asOf: "2026-08-12",
    decisions: [
      {
        id: "future",
        issueId: "issue-future",
        title: "NewCoの設立条件を決める",
        context: "大学条件と役割を分ける",
        status: "open",
        ownerLabel: "SX経営担当",
        dueDate: "2026-08-31",
        isThisWeek: false,
        sortOrder: 3,
        track: "organizational_building",
      },
      {
        id: "overdue",
        issueId: "issue-overdue",
        title: "PoC候補の不足条件を確認する",
        context: "誰がいつ確認するか",
        status: "open",
        ownerLabel: "SX経営担当",
        dueDate: "2026-07-31",
        isThisWeek: true,
        sortOrder: 1,
        track: "business_development",
      },
      {
        id: "soon",
        issueId: "issue-soon",
        title: "処理コストの比較前提を決める",
        context: "比較条件を固定する",
        status: "open",
        ownerLabel: "技術側担当",
        dueDate: "2026-08-14",
        isThisWeek: true,
        sortOrder: 2,
        track: "technology_development",
      },
      {
        id: "done",
        issueId: "issue-done",
        title: "完了済み判断",
        context: "",
        status: "decided",
        ownerLabel: "担当",
        dueDate: "2026-08-10",
        isThisWeek: true,
        sortOrder: 0,
        track: "funding",
      },
      {
        id: "unlinked",
        issueId: null,
        title: "元論点のない判断",
        context: "",
        status: "open",
        ownerLabel: "担当",
        dueDate: null,
        isThisWeek: false,
        sortOrder: 4,
        track: "funding",
      },
    ],
  },
  "p21",
);

assert.deepEqual(
  summary.items.map((item) => item.id),
  ["overdue", "soon", "future"],
  "human-curated this-week decisions should lead; closed or unlinked rows must not leak into the rail",
);
assert.equal(summary.items[0].dueState, "overdue");
assert.equal(summary.items[0].dueLabel, "期限超過 7/31");
assert.equal(summary.items[1].dueState, "due_soon");
assert.equal(summary.items[1].dueLabel, "8/14まで");
assert.equal(summary.unlinkedDecisionCount, 1);
assert.equal(
  summary.items[0].workspaceHref,
  "/project/p21/workspace?focusKind=decision&focusId=overdue#issue-hypothesis",
);
assert.equal(
  summary.items.some((item) => item.dueLabel.startsWith("次の期限")),
  false,
  "a past date must never be mislabeled as the next deadline",
);

const cockpitSource = readFileSync(
  new URL("../src/components/cockpit/CockpitView.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL(
    "../src/components/project-workspace/SxWeeklyControlDashboard.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.match(
  cockpitSource,
  /project\.projectId === "p21"[\s\S]*SxCockpitInterventionRail/,
  "the AMD intervention rail must stay scoped to SX",
);
assert.match(workspaceSource, /params\.get\("focusKind"\)/);
assert.match(workspaceSource, /item\.kind === focusKind && item\.id === focusId/);
assert.match(
  workspaceSource,
  /navigateToWorkUnit\(unit\)/,
  "a cockpit row must resolve the exact workspace work unit before opening it",
);

console.log("sx cockpit intervention contract: OK");
