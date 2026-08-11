import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fixture = JSON.parse(
  await readFile(new URL("./__fixtures__/three_party_project_view_p21.json", import.meta.url), "utf8"),
);
const surfaceCatalog = await readFile(new URL("../src/lib/surface-catalog.ts", import.meta.url), "utf8");

const LENSES = ["pj_workspace", "amd_cockpit", "institution_project"];
const ROUTES = {
  pj_workspace: "/project/[projectId]/workspace",
  amd_cockpit: "/project/[projectId]/cockpit",
  institution_project: "/workspace/[slug]/project/[projectId]",
};
const ACTION_ORDER = [
  "shared.update",
  "shared.confirm",
  "evidence.submit",
  "internal.assess",
  "publication.approve",
  "sovereign.confirm",
  "correction.request",
];
const VIEW_ITEM_KEYS = [
  "acceptanceCriteria",
  "accountablePartyId",
  "ballPartyIds",
  "correction",
  "criticalRank",
  "downstreamImpact",
  "downstreamItemIds",
  "dueOn",
  "duePrecision",
  "dueState",
  "evidenceState",
  "itemId",
  "label",
  "lastVerifiedAt",
  "mode",
  "publication",
  "responsiblePrincipalId",
  "sourceId",
  "sourceType",
  "sourceVersion",
  "state",
  "viewerRequiredAction",
  "visibility",
].sort();
const PUBLICATION_KEYS = [
  "approvedAt",
  "lastVerifiedAt",
  "publicationId",
  "revision",
  "sourceVersion",
].sort();
const CORRECTION_KEYS = [
  "reason",
  "requestedAt",
  "requestedByPartyId",
  "state",
  "targetSourceVersion",
].sort();
const CANONICAL_SHARED_FIELDS = [
  "itemId",
  "sourceType",
  "sourceId",
  "sourceVersion",
  "state",
  "dueOn",
  "duePrecision",
  "dueState",
  "accountablePartyId",
  "responsiblePrincipalId",
  "ballPartyIds",
  "acceptanceCriteria",
  "evidenceState",
  "visibility",
  "lastVerifiedAt",
];
const TERMINAL_STATES = new Set(["accepted_done", "completed", "cancelled", "rejected"]);

function isExpired(expiresAt, asOf) {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.parse(asOf);
}

function resolveViewer(fixtureInput, viewer) {
  if (!LENSES.includes(viewer.lens) || viewer.routePattern !== ROUTES[viewer.lens]) return null;

  const { principal, organizationMembership: membership, projectParty, grant } = viewer.auth;
  if (principal.status !== "active" || membership.status !== "active" || projectParty.status !== "active" || grant.status !== "active") {
    return null;
  }
  if (
    isExpired(membership.expiresAt, fixtureInput.asOf) ||
    isExpired(projectParty.expiresAt, fixtureInput.asOf) ||
    isExpired(grant.expiresAt, fixtureInput.asOf)
  ) return null;
  if (membership.principalId !== principal.id || grant.principalId !== principal.id) return null;
  if (grant.organizationMembershipId !== membership.id) return null;
  if (grant.organizationId !== membership.organizationId || grant.organizationId !== projectParty.organizationId) return null;
  if (grant.projectPartyId !== projectParty.partyId) return null;
  if (grant.projectId !== fixtureInput.projectId || projectParty.projectId !== fixtureInput.projectId) return null;

  const party = fixtureInput.parties.find((candidate) => candidate.partyId === projectParty.partyId);
  if (
    !party ||
    party.projectId !== fixtureInput.projectId ||
    party.status !== "active" ||
    party.organizationStatus !== "active" ||
    isExpired(party.partyExpiresAt, fixtureInput.asOf) ||
    isExpired(party.organizationExpiresAt, fixtureInput.asOf) ||
    party.organizationId !== projectParty.organizationId
  ) return null;

  const capabilities = new Set(grant.capabilities);
  if (!capabilities.has("project.view") || !capabilities.has("shared.view")) return null;
  if (
    capabilities.has("publication.approve") &&
    (party.partyRole !== "studio" || party.organizationKind !== "amd")
  ) return null;
  if (
    viewer.lens === "amd_cockpit" &&
    (party.partyRole !== "studio" || party.organizationKind !== "amd" || !capabilities.has("internal.view"))
  ) return null;
  if (
    viewer.lens === "institution_project" &&
    (party.kind !== "institution" ||
      !capabilities.has("institution.view") ||
      viewer.routeContext.workspaceSlug !== party.workspaceSlug)
  ) {
    return null;
  }

  return { party, principalId: principal.id, capabilities };
}

function publicationMetadata(value) {
  if (!value?.publicationId) return null;
  return {
    publicationId: value.publicationId,
    revision: value.revision,
    sourceVersion: value.sourceVersion,
    approvedAt: value.approvedAt,
    lastVerifiedAt: value.lastVerifiedAt,
  };
}

function viewItem(fact, value, resolved, mode, options = {}) {
  return {
    itemId: fact.itemId,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    sourceVersion: value.sourceVersion,
    mode,
    state: value.state,
    dueOn: value.dueOn,
    duePrecision: value.duePrecision,
    dueState: value.dueState,
    accountablePartyId: value.accountablePartyId,
    responsiblePrincipalId: value.responsiblePrincipalId,
    ballPartyIds: value.ballPartyIds,
    acceptanceCriteria: value.acceptanceCriteria,
    evidenceState: value.evidenceState,
    visibility: value.visibility,
    lastVerifiedAt: value.lastVerifiedAt,
    label: value.label,
    criticalRank: value.criticalRank ?? null,
    downstreamItemIds: value.downstreamItemIds ?? [],
    downstreamImpact: value.downstreamImpact ?? null,
    viewerRequiredAction: value.requiredActionByPartyId?.[resolved.party.partyId] ?? null,
    publication: options.publication ?? null,
    correction: options.correction ?? null,
  };
}

function projectFactView(fact, resolved) {
  const { capabilities, party } = resolved;

  if (fact.scope === "amd_private") {
    if (party.kind !== "studio" || !capabilities.has("internal.view")) return null;
    return viewItem(fact, fact, resolved, "internal_private");
  }

  if (fact.scope === "organization") {
    if (party.partyId === fact.ownerPartyId) {
      return viewItem(fact, fact, resolved, "organization_sovereign", { correction: fact.correction });
    }
    const confirmed = fact.confirmedShared;
    if (!capabilities.has("publication.view") || !confirmed.audiencePartyIds.includes(party.partyId)) return null;
    return viewItem(fact, confirmed, resolved, "sovereign_confirmed", {
      publication: publicationMetadata(confirmed),
    });
  }

  if (fact.scope === "published") {
    if (party.kind === "studio" && capabilities.has("internal.view")) {
      return viewItem(fact, fact.internalDraft, resolved, "internal_draft", {
        publication: publicationMetadata(fact.approved),
      });
    }
    if (!capabilities.has("publication.view") || !fact.approved.audiencePartyIds.includes(party.partyId)) return null;
    return viewItem(fact, fact.approved, resolved, "approved_revision", {
      publication: publicationMetadata(fact.approved),
    });
  }

  assert.equal(fact.scope, "joint", `unknown scope: ${fact.scope}`);
  if (!capabilities.has("shared.view")) return null;
  return viewItem(fact, fact, resolved, "live_shared");
}

function deriveDecisionFrame(items) {
  const active = items
    .filter((item) => item.mode === "live_shared" && !TERMINAL_STATES.has(item.state))
    .sort((a, b) => (a.criticalRank ?? Number.MAX_SAFE_INTEGER) - (b.criticalRank ?? Number.MAX_SAFE_INTEGER));
  const current = active[0] ?? null;
  const blocker = active.find((item) => item.state === "blocked") ?? null;
  const nextDue = active
    .filter((item) => item.dueState === "known" && item.dueOn)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? null;

  return {
    currentItemId: current?.itemId ?? null,
    criticalBlockerItemId: blocker?.itemId ?? null,
    downstreamImpact: blocker?.downstreamImpact ?? null,
    ballPartyIds: blocker?.ballPartyIds ?? [],
    viewerRequiredAction: blocker?.viewerRequiredAction ?? null,
    nextDueOn: nextDue?.dueOn ?? null,
  };
}

function deriveLens(fixtureInput, viewer) {
  const resolved = resolveViewer(fixtureInput, viewer);
  if (!resolved) return { result: "not_found" };

  const items = fixtureInput.facts
    .filter((fact) => fact.projectId === fixtureInput.projectId)
    .map((fact) => projectFactView(fact, resolved))
    .filter(Boolean);
  const actions = ACTION_ORDER.filter((action) => resolved.capabilities.has(action));

  return {
    result: "ok",
    projectId: fixtureInput.projectId,
    lens: viewer.lens,
    partyId: resolved.party.partyId,
    items,
    actions,
    decisionFrame: deriveDecisionFrame(items),
  };
}

function mutateViewer(viewer, path, value) {
  const clone = structuredClone(viewer);
  const parts = path.split(".");
  let cursor = clone;
  for (const part of parts.slice(0, -1)) cursor = cursor[part];
  cursor[parts.at(-1)] = value;
  return clone;
}

function readLatestPublication(testCase) {
  if (testCase.readError) return "error";
  const latest = [...testCase.revisions].sort((a, b) => b.revision - a.revision)[0];
  if (!latest || latest.status !== "sealed") return "unpublished";
  if (!latest.audiencePartyIds.includes(testCase.viewerPartyId)) return "unpublished";
  return latest.publicationId;
}

function applySovereignMutation(fixtureInput, testCase) {
  const viewer = fixtureInput.viewers.find((candidate) => candidate.viewerId === testCase.actorViewerId);
  const resolved = viewer ? resolveViewer(fixtureInput, viewer) : null;
  const sourceFact = fixtureInput.facts.find((candidate) => candidate.itemId === testCase.factItemId);
  const ownerParty = sourceFact
    ? fixtureInput.parties.find(
        (party) => party.partyId === sourceFact.ownerPartyId && party.projectId === sourceFact.projectId,
      )
    : null;
  if (
    !resolved ||
    !sourceFact ||
    sourceFact.scope !== "organization" ||
    sourceFact.projectId !== fixtureInput.projectId ||
    !ownerParty ||
    ownerParty.status !== "active" ||
    ownerParty.organizationStatus !== "active"
  ) {
    return { result: "forbidden", fact: sourceFact ? structuredClone(sourceFact) : null };
  }

  const original = structuredClone(sourceFact);
  const isOwner = resolved.party.partyId === sourceFact.ownerPartyId;
  const canConfirm = isOwner && resolved.capabilities.has("sovereign.confirm");
  const canRequestCorrection = resolved.capabilities.has("correction.request");
  const correctionIsOpen =
    sourceFact.correction?.state === "requested" &&
    sourceFact.correction.targetSourceVersion === testCase.targetSourceVersion &&
    sourceFact.confirmedShared.sourceVersion === testCase.targetSourceVersion;

  if (testCase.action === "request_correction") {
    if (!canRequestCorrection || sourceFact.confirmedShared.sourceVersion !== testCase.targetSourceVersion) {
      return { result: "forbidden", fact: original };
    }
    if (testCase.auditWrite === "failed") return { result: "rolled_back", fact: original };
    const fact = structuredClone(sourceFact);
    fact.correction = {
      state: "requested",
      targetSourceVersion: testCase.targetSourceVersion,
      requestedByPartyId: resolved.party.partyId,
      requestedAt: fixtureInput.asOf,
      reason: "fixture correction request",
    };
    return { result: "correction_requested", fact };
  }

  if (testCase.action === "reject_correction") {
    if (!canConfirm || !correctionIsOpen) {
      return { result: "forbidden", fact: original };
    }
    if (testCase.auditWrite === "failed") return { result: "rolled_back", fact: original };
    const fact = structuredClone(sourceFact);
    fact.correction = { ...fact.correction, state: "rejected", resolvedAt: fixtureInput.asOf };
    return { result: "correction_rejected", fact };
  }

  if (testCase.action === "confirm" || testCase.action === "resolve_correction") {
    const targetIsValid =
      testCase.action === "confirm"
        ? sourceFact.sourceVersion === testCase.targetSourceVersion
        : correctionIsOpen;
    if (!canConfirm || !targetIsValid) {
      return { result: "forbidden", fact: original };
    }
    const candidate = sourceFact.confirmationCandidate;
    const audienceIsValid =
      candidate.sourceVersion === sourceFact.sourceVersion &&
      candidate.audiencePartyIds.length > 0 &&
      candidate.audiencePartyIds.every((partyId) =>
        fixtureInput.parties.some(
          (party) =>
            party.partyId === partyId &&
            party.status === "active" &&
            party.organizationStatus === "active" &&
            !isExpired(party.partyExpiresAt, fixtureInput.asOf) &&
            !isExpired(party.organizationExpiresAt, fixtureInput.asOf),
        ),
      );
    if (!audienceIsValid) return { result: "forbidden", fact: original };
    assert.doesNotMatch(JSON.stringify(candidate), /OWNER-ONLY|PRIVATE-CANARY/);
    if (testCase.auditWrite === "failed") return { result: "rolled_back", fact: original };

    const fact = structuredClone(sourceFact);
    fact.confirmedShared = {
      ...structuredClone(candidate),
      publicationId: `${sourceFact.sourceId}-publication-${sourceFact.confirmedShared.revision + 1}`,
      revision: sourceFact.confirmedShared.revision + 1,
      approvedAt: fixtureInput.asOf,
    };
    fact.correction =
      testCase.action === "resolve_correction"
        ? { ...fact.correction, state: "resolved", resolvedAt: fixtureInput.asOf }
        : null;
    return {
      result: testCase.action === "resolve_correction" ? "correction_resolved" : "confirmed",
      fact,
    };
  }

  return { result: "forbidden", fact: original };
}

assert.equal(fixture.contractVersion, "three-party-project-view.v1");
assert.equal(
  fixture.fixtureKind,
  "synthetic_model_only_not_p21_current_truth",
  "fixture must never masquerade as p21 current truth",
);
assert.match(fixture.asOf, /^\d{4}-\d{2}-\d{2}T/, "fixture must have an explicit observation time");
assert.deepEqual(
  fixture.viewers.map((viewer) => viewer.lens).sort(),
  [...LENSES].sort(),
  "model fixture must contain exactly the three adopted canonical lenses",
);

const canonicalSharedLines = surfaceCatalog
  .split("\n")
  .filter((line) => line.includes('domain: "project_execution"') && line.includes('lens: "shared_project"') && line.includes('status: "canonical"'));
assert.equal(canonicalSharedLines.length, 1, "surface catalog must not add a fourth canonical shared-PJ execution surface");
assert.match(surfaceCatalog, /id: "weekly-control"[^\n]+status: "deprecated"/, "old weekly-control route must stay deprecated");

for (const viewer of fixture.viewers) {
  const actual = deriveLens(fixture, viewer);
  assert.equal(actual.result, "ok");
  assert.deepEqual(actual.actions, viewer.expectedActions, `${viewer.lens} action capability drift`);
  assert.deepEqual(actual.decisionFrame, viewer.expectedDecisionFrame, `${viewer.lens} five-second decision frame drift`);
  assert.deepEqual(
    actual.items.map(({ itemId, sourceVersion, mode, state, dueState }) => [
      itemId,
      sourceVersion,
      mode,
      state,
      dueState,
    ]),
    viewer.expectedItems,
    `${viewer.lens} visible facts drift`,
  );

  for (const item of actual.items) {
    assert.deepEqual(Object.keys(item).sort(), VIEW_ITEM_KEYS, `${viewer.lens}/${item.itemId} DTO allowlist drift`);
    if (item.publication) assert.deepEqual(Object.keys(item.publication).sort(), PUBLICATION_KEYS);
    if (item.correction) assert.deepEqual(Object.keys(item.correction).sort(), CORRECTION_KEYS);
  }
}

for (const testCase of fixture.deniedViewerCases) {
  const base = fixture.viewers.find((viewer) => viewer.viewerId === testCase.baseViewerId);
  const denied = mutateViewer(base, testCase.path, testCase.value);
  assert.equal(deriveLens(fixture, denied).result, "not_found", `${testCase.caseId} must fail closed`);
}
const institutionSpoof = structuredClone(
  fixture.viewers.find((viewer) => viewer.viewerId === "viewer-ehime-member"),
);
institutionSpoof.lens = "amd_cockpit";
institutionSpoof.routePattern = ROUTES.amd_cockpit;
institutionSpoof.routeContext.workspaceSlug = null;
assert.equal(
  deriveLens(fixture, institutionSpoof).result,
  "not_found",
  "an institution principal must not obtain AMD-private access by spoofing both lens and route",
);
const nonStudioApprover = structuredClone(
  fixture.viewers.find((viewer) => viewer.viewerId === "viewer-ehime-member"),
);
nonStudioApprover.auth.grant.capabilities.push("publication.approve");
assert.equal(
  deriveLens(fixture, nonStudioApprover).result,
  "not_found",
  "publication.approve must fail closed outside an AMD studio party",
);
const nonAmdStudioApproverFixture = structuredClone(fixture);
const nonAmdStudioApprover = nonAmdStudioApproverFixture.viewers.find(
  (viewer) => viewer.viewerId === "viewer-ehime-member",
);
nonAmdStudioApprover.auth.grant.capabilities.push("publication.approve");
nonAmdStudioApproverFixture.parties.find((party) => party.partyId === "party-ehime").partyRole = "studio";
assert.equal(
  deriveLens(nonAmdStudioApproverFixture, nonAmdStudioApprover).result,
  "not_found",
  "a non-AMD organization must not approve publications even if its party_role is studio",
);
const suspendedOrganizationFixture = structuredClone(fixture);
suspendedOrganizationFixture.parties.find((party) => party.partyId === "party-ehime").organizationStatus = "paused";
assert.equal(
  deriveLens(suspendedOrganizationFixture, suspendedOrganizationFixture.viewers.find((viewer) => viewer.viewerId === "viewer-ehime-member")).result,
  "not_found",
  "a paused organization must invalidate the viewer scope",
);

const derived = Object.fromEntries(
  fixture.viewers.map((viewer) => [viewer.lens, deriveLens(fixture, viewer)]),
);
for (const itemId of [
  "p21:action:sample-route",
  "p21:action:research-agreement",
  "p21:decision:sample-condition",
]) {
  const shared = LENSES.map((lens) => derived[lens].items.find((item) => item.itemId === itemId));
  assert.ok(shared.every(Boolean), `${itemId} must be visible through all three lenses`);
  for (const field of CANONICAL_SHARED_FIELDS) {
    assert.deepEqual(shared[1][field], shared[0][field], `${itemId}.${field} differs between PJ and AMD`);
    assert.deepEqual(shared[2][field], shared[0][field], `${itemId}.${field} differs between PJ and institution`);
  }
}

for (const lens of ["pj_workspace", "institution_project"]) {
  assert.equal(derived[lens].items.some((item) => item.mode === "internal_private"), false, `AMD-private fact leaked to ${lens}`);
  assert.doesNotMatch(JSON.stringify(derived[lens].items), /PRIVATE-CANARY|internalDraft|negotiationMemo|internalOnlyCanary/);
}
assert.doesNotMatch(JSON.stringify(derived.pj_workspace.items), /OWNER-ONLY-INSTITUTION-CURRENT/);
assert.doesNotMatch(JSON.stringify(derived.amd_cockpit.items), /OWNER-ONLY-INSTITUTION-CURRENT|OWNER-ONLY-STARTUP-CURRENT/);
assert.doesNotMatch(JSON.stringify(derived.institution_project.items), /OWNER-ONLY-STARTUP-CURRENT/);
for (const lens of LENSES) {
  assert.equal(derived[lens].items.some((item) => item.itemId.startsWith("p30:")), false, `cross-project fact leaked to ${lens}`);
  const unknown = derived[lens].items.find((item) => item.itemId === "p21:decision:sample-condition");
  assert.equal(unknown.dueOn, null, `${lens} must not invent a due date`);
  assert.equal(unknown.duePrecision, "unknown");
  assert.equal(unknown.dueState, "unknown", `${lens} must preserve unknown, not convert it to zero`);
}

const institutionCurrent = derived.institution_project.items.find((item) => item.itemId === "p21:institution:research-clearance");
const institutionForAmd = derived.amd_cockpit.items.find((item) => item.itemId === "p21:institution:research-clearance");
const startupCurrent = derived.pj_workspace.items.find((item) => item.itemId === "p21:startup:company-authorization");
const startupForInstitution = derived.institution_project.items.find((item) => item.itemId === "p21:startup:company-authorization");
assert.equal(institutionCurrent.mode, "organization_sovereign");
assert.equal(institutionCurrent.sourceVersion, 2);
assert.equal(institutionForAmd.mode, "sovereign_confirmed");
assert.equal(institutionForAmd.sourceVersion, 1);
assert.equal(institutionForAmd.label, "研究実施許可（共有版）");
assert.equal(startupCurrent.mode, "organization_sovereign");
assert.equal(startupCurrent.sourceVersion, 5);
assert.equal(startupForInstitution.mode, "sovereign_confirmed");
assert.equal(startupForInstitution.sourceVersion, 4);
assert.equal(startupForInstitution.label, "会社情報（共有版）");

const amdSummary = derived.amd_cockpit.items.find((item) => item.itemId === "p21:summary:next-gate");
const pjSummary = derived.pj_workspace.items.find((item) => item.itemId === "p21:summary:next-gate");
const institutionSummary = derived.institution_project.items.find((item) => item.itemId === "p21:summary:next-gate");
assert.equal(amdSummary.sourceVersion, 4, "AMD must be able to inspect the internal draft");
assert.equal(pjSummary.sourceVersion, 3, "PJ lens must stay on the approved revision");
assert.equal(institutionSummary.sourceVersion, 3, "institution lens must stay on the approved revision");
assert.equal(amdSummary.publication.sourceVersion, 3, "draft/approved divergence must be explicit");
assert.equal(institutionSummary.publication.revision, 12, "approved revision metadata must travel with the value");
assert.equal(pjSummary.label, "次の成立条件（共有版）", "approved label must come from the immutable revision");

for (const testCase of fixture.publicationCases) {
  assert.equal(readLatestPublication(testCase), testCase.expected, `${testCase.caseId} publication selection drift`);
}
for (const testCase of fixture.sovereignMutationCases) {
  const original = structuredClone(fixture.facts.find((fact) => fact.itemId === testCase.factItemId));
  const result = applySovereignMutation(fixture, testCase);
  assert.equal(result.result, testCase.expected, `${testCase.caseId} sovereign mutation drift`);
  if (testCase.expectedRevision !== undefined) {
    assert.equal(result.fact.confirmedShared.revision, testCase.expectedRevision);
    assert.equal(result.fact.confirmedShared.sourceVersion, testCase.expectedSourceVersion);
  }
  if (result.result === "rolled_back" || result.result === "forbidden") {
    assert.deepEqual(result.fact, original, `${testCase.caseId} must leave the source snapshot unchanged`);
  }
}
const resolveCase = fixture.sovereignMutationCases.find(
  (testCase) => testCase.caseId === "owner-resolves-correction-with-new-revision",
);
for (const correctionState of [null, "resolved", "rejected"]) {
  const invalidTransitionFixture = structuredClone(fixture);
  const fact = invalidTransitionFixture.facts.find(
    (candidate) => candidate.itemId === "p21:institution:research-clearance",
  );
  fact.correction =
    correctionState === null
      ? null
      : { ...fact.correction, state: correctionState };
  const before = structuredClone(fact);
  const result = applySovereignMutation(invalidTransitionFixture, resolveCase);
  assert.equal(result.result, "forbidden", `correction state=${correctionState} must not resolve`);
  assert.deepEqual(result.fact, before);
}
const crossProjectMutationFixture = structuredClone(fixture);
const crossProjectFact = {
  ...structuredClone(
    fixture.facts.find((candidate) => candidate.itemId === "p21:institution:research-clearance"),
  ),
  itemId: "p30:institution:research-clearance",
  projectId: "p30",
};
crossProjectMutationFixture.facts.push(crossProjectFact);
const correctionRequestCase = fixture.sovereignMutationCases.find(
  (testCase) => testCase.caseId === "counterparty-requests-correction",
);
const crossProjectMutation = applySovereignMutation(crossProjectMutationFixture, {
  ...correctionRequestCase,
  factItemId: crossProjectFact.itemId,
});
assert.equal(
  crossProjectMutation.result,
  "forbidden",
  "a p21 correction.request grant must not mutate a p30 sovereign fact",
);
assert.deepEqual(crossProjectMutation.fact, crossProjectFact);

const genericProbe = structuredClone(fixture);
genericProbe.projectId = "synthetic-project-b";
genericProbe.parties.forEach((party) => {
  party.projectId = "synthetic-project-b";
});
genericProbe.facts = [
  {
    ...fixture.facts.find((fact) => fact.itemId === "p21:action:research-agreement"),
    itemId: "synthetic-project-b:action:one",
    projectId: "synthetic-project-b",
    sourceId: "synthetic-action-one",
  },
];
const genericViewer = structuredClone(fixture.viewers.find((viewer) => viewer.viewerId === "viewer-sx-member"));
genericViewer.auth.projectParty.projectId = "synthetic-project-b";
genericViewer.auth.grant.projectId = "synthetic-project-b";
const genericResult = deriveLens(genericProbe, genericViewer);
assert.equal(genericResult.result, "ok");
assert.equal(genericResult.projectId, "synthetic-project-b", "model must not hardcode p21");
assert.equal(genericResult.items[0].itemId, "synthetic-project-b:action:one");

console.log("three-party project view synthetic model contract: ok (runtime integration not yet proven)");
