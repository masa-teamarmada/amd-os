import assert from "node:assert/strict";
import {
  deriveSharedProjectControlView,
  parseSharedProjectControlPublication,
} from "../src/lib/shared-project-control.ts";

const revisionId = "11111111-1111-4111-8111-111111111111";
const researchPartyId = "22222222-2222-4222-8222-222222222222";
const amdPartyId = "33333333-3333-4333-8333-333333333333";
const milestoneId = "44444444-4444-4444-8444-444444444444";
const actionId = "55555555-5555-4555-8555-555555555555";
const milestoneItemId = `project_management_milestones:${milestoneId}`;
const actionItemId = `project_management_action_items:${actionId}`;

function publishedFixture() {
  return {
    state: "published",
    viewerPartyIds: [researchPartyId],
    revision: {
      id: revisionId,
      number: 3,
      asOf: "2026-08-12T00:00:00.000Z",
      publishedAt: "2026-08-12T00:05:00.000Z",
      contentHash: "a".repeat(64),
    },
    items: [
      {
        itemKind: "project_summary.v1",
        sourceTable: "projects",
        sourceId: "p21",
        sourceVersion: 1,
        payload: {
          projectId: "p21",
          projectName: "SX",
          asOf: "2026-08-12T00:00:00.000Z",
          lastVerifiedAt: null,
          verdict: { state: "attention", label: "要確認", reason: "公開済みの重要経路に対応中の項目がある" },
        },
      },
      {
        itemKind: "party.v1",
        sourceTable: "project_organization_parties",
        sourceId: researchPartyId,
        sourceVersion: 1,
        payload: { partyId: researchPartyId, kind: "research", displayLabel: "愛媛大学" },
      },
      {
        itemKind: "party.v1",
        sourceTable: "project_organization_parties",
        sourceId: amdPartyId,
        sourceVersion: 1,
        payload: { partyId: amdPartyId, kind: "amd", displayLabel: "チームアルマダ" },
      },
      ...([
        ["business_development", "事業開発"],
        ["technology_development", "技術開発"],
        ["organizational_building", "組織構築"],
        ["funding", "資金調達"],
      ] as const).map(([key, label]) => ({
        itemKind: "pillar.v1",
        sourceTable: "project_publication",
        sourceId: key,
        sourceVersion: 1,
        payload: {
          key,
          label,
          state: key === "technology_development" ? "attention" : "unknown",
          currentGateLabel: key === "technology_development" ? "共同研究テーマの確認" : null,
          nextDue: key === "technology_development" ? "2026-08-20" : null,
          blockedCount: 0,
          unknownCount: key === "technology_development" ? 0 : 1,
        },
      })),
      {
        itemKind: "control_item.v1",
        sourceTable: "project_management_milestones",
        sourceId: milestoneId,
        sourceVersion: 2,
        payload: {
          itemId: milestoneItemId,
          entityType: "milestone",
          entityId: milestoneId,
          pillarKey: "technology_development",
          label: "PRIVATE OUTER CANARYではなく承認済みテーマ確認",
          state: "in_progress",
          dueDate: "2026-08-20",
          ballPartyIds: [researchPartyId],
          jointDecision: true,
          criticalRank: 1,
          dependencyItemIds: [],
          downstreamImpactLabel: "実証計画の確定",
        },
      },
      {
        itemKind: "control_item.v1",
        sourceTable: "project_management_action_items",
        sourceId: actionId,
        sourceVersion: 1,
        payload: {
          itemId: actionItemId,
          entityType: "action",
          entityId: actionId,
          pillarKey: "technology_development",
          label: "提出済み資料の受領",
          state: "cancelled",
          dueDate: null,
          ballPartyIds: [amdPartyId],
          jointDecision: false,
          criticalRank: 2,
          dependencyItemIds: [milestoneItemId],
          downstreamImpactLabel: null,
        },
      },
    ],
  };
}

const parsed = parseSharedProjectControlPublication(publishedFixture());
assert.equal(parsed.state, "published");
if (parsed.state !== "published") throw new Error("fixture must parse");
assert.equal(parsed.summary.projectId, "p21");
assert.equal(parsed.controlItems[1]?.dueDate, null, "missing due date must remain null");

const view = deriveSharedProjectControlView(parsed);
assert.equal(view.lanes.my[0]?.itemId, milestoneItemId);
assert.equal(view.lanes.waiting[0]?.itemId, actionItemId);
assert.equal(view.criticalPath.currentItem?.itemId, milestoneItemId);
assert.equal(view.items.find((item) => item.itemId === actionItemId)?.terminal, true);
assert.equal(view.items.find((item) => item.itemId === actionItemId)?.tone, "neutral");

assert.deepEqual(parseSharedProjectControlPublication(null), { state: "unauthorized" });
assert.equal(
  parseSharedProjectControlPublication({ state: "unpublished", projectId: "p21", viewerPartyIds: [researchPartyId] }).state,
  "unpublished",
);

const withOuterCanary = publishedFixture() as ReturnType<typeof publishedFixture> & { internalDraft: string };
withOuterCanary.internalDraft = "PRIVATE_CANARY";
assert.equal(parseSharedProjectControlPublication(withOuterCanary).state, "invalid");

const withNestedCanary = publishedFixture();
(withNestedCanary.items[0]!.payload as Record<string, unknown>).internalDraft = "PRIVATE_CANARY";
assert.equal(parseSharedProjectControlPublication(withNestedCanary).state, "invalid");

const dangling = publishedFixture();
(dangling.items.at(-1)!.payload as Record<string, unknown>).dependencyItemIds = ["missing:item"];
assert.equal(parseSharedProjectControlPublication(dangling).state, "invalid");

const cycle = publishedFixture();
(cycle.items.at(-2)!.payload as Record<string, unknown>).dependencyItemIds = [actionItemId];
assert.equal(parseSharedProjectControlPublication(cycle).state, "invalid");

const rankConflict = publishedFixture();
(rankConflict.items.at(-1)!.payload as Record<string, unknown>).criticalRank = 1;
assert.equal(parseSharedProjectControlPublication(rankConflict).state, "invalid");

const duplicateParty = publishedFixture();
duplicateParty.viewerPartyIds.push(researchPartyId);
assert.equal(parseSharedProjectControlPublication(duplicateParty).state, "invalid");

console.log("shared project control production DTO core: ok");
