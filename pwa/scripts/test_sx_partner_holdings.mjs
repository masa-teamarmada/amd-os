import assert from "node:assert/strict";
import {
  sxAllHoldingsForPartnerAudit,
  sxComputeControlBandCounts,
  sxGroupPartnersByPrimaryClassification,
  sxHoldingsForPartner,
  sxIsHoldingDueSoon,
  sxIsHoldingDueUnset,
  sxIsHoldingMonthPrecision,
  sxIsHoldingOverdue,
  sxIsPartnerEnded,
  sxPartnerDisplaySortKey,
  sxPartnerHasBlockedHolding,
  sxPartnerPrioritySortKey,
  sxPrimaryRoleKindCounts,
  sxRoleDisplayLabel,
  sxSortHoldingsByPriority,
  sxSourceKindLabel,
  sxSourceRefDisplayLabel,
  sxWorkItemKindLabel,
} from "../src/lib/sx-partner-holdings.ts";

function workItem(overrides = {}) {
  return {
    id: "wi-1", partnerId: "p-1", side: "sx", itemKind: "task", title: "テスト項目",
    detail: null, ownerLabel: "担当A", status: "open", dueDate: null, dueDatePrecision: "unknown",
    completionCriteria: null, completedOn: null, completionEvidence: null, acceptedBy: null, acceptedOn: null,
    handoffTo: null, relatedMilestoneId: null,
    lastVerifiedAt: "2026-07-24", confidence: "medium", sourceKind: "manual", sourceRef: null, sortOrder: 0,
    ...overrides,
  };
}

function commitment(overrides = {}) {
  return {
    id: "c-1", partnerId: "p-1", title: "テスト約束", commitmentText: "詳細",
    commitmentKind: "sx_followup", status: "open", promisedOn: null, dueDate: null, completedOn: null,
    ownerLabel: "担当A", counterpartyOwner: null, sxOwner: "担当A", evidence: null, nextReviewOn: null,
    lastVerifiedAt: "2026-07-24", confidence: "medium", sourceKind: "manual", sourceRef: null,
    ...overrides,
  };
}

function role(overrides = {}) {
  return { id: "r-1", partnerId: "p-1", roleKind: "unclassified", relationshipState: "unconfirmed", roleLabel: null, isPrimary: true, sortOrder: 0, ...overrides };
}

function partner(overrides = {}) {
  return { id: "p-1", deferredLowPriority: false, workItems: [], commitments: [], roles: [], dueDate: null, ...overrides };
}

// sxHoldingsForPartner: open work items pass through, closed ones are excluded.
{
  const p = partner({
    workItems: [
      workItem({ id: "open", status: "open" }),
      workItem({ id: "completed", status: "completed" }),
      workItem({ id: "cancelled", status: "cancelled" }),
      workItem({ id: "waiting", status: "waiting" }),
    ],
  });
  const holdings = sxHoldingsForPartner(p);
  assert.deepEqual(holdings.map((h) => h.id).sort(), ["open", "waiting"], "only open/in_progress/waiting/blocked/on_hold work items should surface as current holdings");
}

// sxHoldingsForPartner: commitments merge in on the correct side by commitment_kind, active ones only.
{
  const p = partner({
    commitments: [
      commitment({ id: "promise-open", commitmentKind: "counterparty_promise", status: "open", counterpartyOwner: "相手担当" }),
      commitment({ id: "followup-open", commitmentKind: "sx_followup", status: "in_progress" }),
      commitment({ id: "promise-completed", commitmentKind: "counterparty_promise", status: "completed" }),
      commitment({ id: "followup-cancelled", commitmentKind: "sx_followup", status: "cancelled" }),
    ],
  });
  const holdings = sxHoldingsForPartner(p);
  const byId = new Map(holdings.map((h) => [h.id, h]));
  assert.equal(holdings.length, 2, "only active commitments should surface");
  assert.equal(byId.get("promise-open").side, "partner", "counterparty_promise must land on the partner side");
  assert.equal(byId.get("followup-open").side, "sx", "sx_followup must land on the sx side");
}

// sxHoldingsForPartner: a commitment's evidence (一次根拠, present regardless of status) must surface
// as sourceEvidence, never as completionEvidence — a still-open commitment has no completion evidence
// at all (2026-07-24 P1 fix: this used to be mis-mapped onto completionEvidence, mislabeling an
// open promise's primary backing as "proof it's done").
{
  const p = partner({
    commitments: [
      commitment({ id: "promise-open", commitmentKind: "counterparty_promise", status: "open", counterpartyOwner: "相手担当", evidence: "先方からの合意メール" }),
    ],
  });
  const [holding] = sxHoldingsForPartner(p);
  assert.equal(holding.sourceEvidence, "先方からの合意メール", "commitment.evidence must surface as sourceEvidence");
  assert.equal(holding.completionEvidence, null, "an open commitment must never carry a completionEvidence value");
}

// workItemToHoldingItem (via sxHoldingsForPartner): a work item has no source-evidence field of its
// own, so sourceEvidence must always be null there — only completionEvidence (gated by the DB
// completion CHECK) ever carries a value for work items.
{
  const p = partner({ workItems: [workItem({ id: "w1", status: "open" })] });
  const [holding] = sxHoldingsForPartner(p);
  assert.equal(holding.sourceEvidence, null, "work items must never populate sourceEvidence");
}

// sxHoldingsForPartner: provenance (出典/最終確認/確度) normalizes onto both origins. Both a work item
// and a commitment carry their own source_ref column, and both must be transcribed onto the holding
// item verbatim (2026-07-24).
{
  const p = partner({
    workItems: [workItem({ id: "w1", status: "open", sourceKind: "current_truth", sourceRef: "user:2026-07-24#partner-work-items", lastVerifiedAt: "2026-07-20", confidence: "high" })],
    commitments: [commitment({ id: "c1", status: "open", sourceKind: "manual", sourceRef: "user:2026-07-23#partner-progress", lastVerifiedAt: "2026-07-21", confidence: "low" })],
  });
  const holdings = sxHoldingsForPartner(p);
  const byId = new Map(holdings.map((h) => [h.id, h]));
  assert.equal(byId.get("w1").sourceKind, "current_truth");
  assert.equal(byId.get("w1").sourceRef, "user:2026-07-24#partner-work-items");
  assert.equal(byId.get("w1").lastVerifiedAt, "2026-07-20");
  assert.equal(byId.get("w1").confidence, "high");
  assert.equal(byId.get("c1").sourceKind, "manual");
  assert.equal(byId.get("c1").sourceRef, "user:2026-07-23#partner-progress", "a commitment's source_ref must be transcribed onto its holding item, never dropped to null");
  assert.equal(byId.get("c1").lastVerifiedAt, "2026-07-21");
  assert.equal(byId.get("c1").confidence, "low");
}

// commitmentToHoldingItem (via sxHoldingsForPartner): a commitment with no source_ref recorded must
// still surface as null, not an empty string or fabricated placeholder.
{
  const p = partner({ commitments: [commitment({ id: "c2", status: "open", sourceRef: null })] });
  const [holding] = sxHoldingsForPartner(p);
  assert.equal(holding.sourceRef, null, "a commitment with no recorded source_ref must surface as null");
}

// sxSourceRefDisplayLabel: a commitment's raw sourceRef must go through the same safe-label masking
// as a work item's — never rendered verbatim, whether it's a URL or an internal tracking-key shape.
{
  assert.equal(sxSourceRefDisplayLabel("user:2026-07-23#partner-progress"), "手動記録 2026-07-23", "a commitment sourceRef in the internal tracking-key shape must be reformatted, not shown verbatim");
  assert.equal(sxSourceRefDisplayLabel("https://partner.example.com/agreement?token=abc"), "外部リンク（詳細は編集画面で確認）", "a commitment sourceRef that is a raw URL must never render verbatim");
}

// sxSourceKindLabel: never renders blank for an unrecognized value.
{
  assert.equal(sxSourceKindLabel("current_truth"), "現在の基準情報");
  assert.equal(sxSourceKindLabel("manual"), "手動確認");
  assert.equal(sxSourceKindLabel("imported"), "取込データ");
}

// sxSourceRefDisplayLabel: never leaks a raw URL or an internal tracking-key shape verbatim.
{
  assert.equal(sxSourceRefDisplayLabel(null), null);
  assert.equal(sxSourceRefDisplayLabel("https://example.com/secret-token?key=abc"), "外部リンク（詳細は編集画面で確認）", "a raw URL must never render verbatim");
  assert.equal(sxSourceRefDisplayLabel("user:2026-07-23#partner-progress"), "手動記録 2026-07-23", "an internal tracking-key shape must be reformatted, not shown verbatim");
  assert.equal(sxSourceRefDisplayLabel("PWA共有管理画面"), "PWA共有管理画面", "a short, already-human label passes through unchanged");
}

// sxIsHoldingOverdue / sxIsHoldingDueSoon: day precision only, month precision must never read as overdue.
{
  const today = "2026-07-24";
  assert.equal(sxIsHoldingOverdue({ dueDate: "2026-07-01", dueDatePrecision: "day" }, today), true);
  assert.equal(sxIsHoldingOverdue({ dueDate: "2026-06-01", dueDatePrecision: "month" }, today), false, "month precision must never count as overdue even if the month is in the past");
  assert.equal(sxIsHoldingOverdue({ dueDate: "2099-01-01", dueDatePrecision: "month" }, today), false, "a future month-precision date must never be flagged red");
  assert.equal(sxIsHoldingDueSoon({ dueDate: "2026-07-28", dueDatePrecision: "day" }, today), true);
  assert.equal(sxIsHoldingDueSoon({ dueDate: "2026-07-28", dueDatePrecision: "month" }, today), false, "due-soon must also be day-precision only");
}

// sxIsHoldingMonthPrecision / sxIsHoldingDueUnset: month precision and unset are distinct buckets.
{
  assert.equal(sxIsHoldingMonthPrecision({ dueDate: "2026-08-01", dueDatePrecision: "month" }), true);
  assert.equal(sxIsHoldingMonthPrecision({ dueDate: null, dueDatePrecision: "unknown" }), false);
  assert.equal(sxIsHoldingDueUnset({ dueDate: null, dueDatePrecision: "unknown" }), true);
  assert.equal(sxIsHoldingDueUnset({ dueDate: "2026-08-01", dueDatePrecision: "month" }), false, "month precision must not also count as due-unset");
}

// sxComputeControlBandCounts: partner-quality metrics (total/deferred/active/unclassified) include
// deferred partners; holdings/urgency metrics exclude them.
{
  const active = partner({ id: "active", workItems: [workItem({ id: "a1", side: "sx", status: "open" })], roles: [role({ roleKind: "financial_institution", relationshipState: "in_progress" })] });
  const deferred = partner({ id: "deferred", deferredLowPriority: true, workItems: [workItem({ id: "d1", side: "partner", status: "open" })], roles: [role({ roleKind: "customer", relationshipState: "on_hold" })] });
  const counts = sxComputeControlBandCounts([active, deferred], "2026-07-24");
  assert.equal(counts.totalPartners, 2, "全関係先 must include the deferred partner");
  assert.equal(counts.deferredPartners, 1, "保留 must count the deferred partner");
  assert.equal(counts.activePartners, 1, "対応中 must exclude the deferred partner");
  assert.equal(counts.unclassifiedPartners, 0, "unclassified partner-quality count must still include deferred partners in its scan (neither role here is unclassified)");
  assert.equal(counts.totalHoldings, 1, "deferred partner holdings must be excluded from holdings-unit totals");
  assert.equal(counts.sxHeld, 1);
  assert.equal(counts.partnerHeld, 0, "deferred partner's partner-side holding must not count");
}

// sxComputeControlBandCounts: unclassifiedPartners is a quality metric and must include deferred partners.
{
  const activeUnclassified = partner({ id: "a" });
  const deferredUnclassified = partner({ id: "d", deferredLowPriority: true });
  const counts = sxComputeControlBandCounts([activeUnclassified, deferredUnclassified], "2026-07-24");
  assert.equal(counts.unclassifiedPartners, 2, "未分類 must be counted across all partners, deferred included");
}

// sxComputeControlBandCounts: overdue / due-soon / month-precision / due-unset are distinct buckets.
{
  const today = "2026-07-24";
  const p = partner({
    workItems: [
      workItem({ id: "overdue", dueDate: "2026-07-01", dueDatePrecision: "day", status: "open" }),
      workItem({ id: "due-soon", dueDate: "2026-07-28", dueDatePrecision: "day", status: "open" }),
      workItem({ id: "due-far", dueDate: "2026-09-01", dueDatePrecision: "day", status: "open" }),
      workItem({ id: "month-precision", dueDate: "2026-08-01", dueDatePrecision: "month", status: "open" }),
      workItem({ id: "unset", dueDate: null, dueDatePrecision: "unknown", status: "open" }),
    ],
  });
  const counts = sxComputeControlBandCounts([p], today);
  assert.equal(counts.overdue, 1, "only the past-due day-precision item should count as overdue");
  assert.equal(counts.dueSoon, 1, "only the day-precision item due within 7 days should count as due-soon");
  assert.equal(counts.dueMonthPrecision, 1, "the month-precision item must land in its own bucket, not overdue/due-soon");
  assert.equal(counts.dueUnset, 1, "only the item with no due date should count as due-unset");
}

// sxComputeControlBandCounts: bothSidesHeldPartners counts partners holding on both lanes.
{
  const both = partner({ id: "both", workItems: [workItem({ id: "s1", side: "sx", status: "open" }), workItem({ id: "p1", side: "partner", status: "open" })] });
  const sxOnly = partner({ id: "sx-only", workItems: [workItem({ id: "s2", side: "sx", status: "open" })] });
  const counts = sxComputeControlBandCounts([both, sxOnly], "2026-07-24");
  assert.equal(counts.bothSidesHeldPartners, 1, "only the partner holding on both sides should count");
}

// sxComputeControlBandCounts: missing owner detection reuses the same "未確認/未設定/未登録" convention as the rest of SX.
{
  const p = partner({ workItems: [workItem({ id: "no-owner", ownerLabel: null }), workItem({ id: "unconfirmed-owner", ownerLabel: "担当未確認" }), workItem({ id: "named-owner", ownerLabel: "石原先生" })] });
  const counts = sxComputeControlBandCounts([p], "2026-07-24");
  assert.equal(counts.ownerUnconfirmed, 2, "null owner and an explicit 未確認 label must both count");
}

// sxPrimaryRoleKindCounts: unclassified default when no primary role row exists; deferred/ended
// partners are counted too (2026-07-24 P1 reversal) so a category nav chip is never permanently
// unreachable for a role kind whose only partners happen to be deferred/ended.
{
  const noRole = partner({ id: "no-role" });
  const classified = partner({ id: "classified", roles: [role({ roleKind: "university_research", relationshipState: "in_progress" })] });
  const deferred = partner({ id: "deferred", deferredLowPriority: true, roles: [role({ roleKind: "customer", relationshipState: "on_hold" })] });
  const ended = partner({ id: "ended", roles: [role({ roleKind: "customer", relationshipState: "ended" })] });
  const counts = sxPrimaryRoleKindCounts([noRole, classified, deferred, ended]);
  assert.equal(counts.unclassified, 1, "a partner with no primary role row counts as unclassified");
  assert.equal(counts.university_research, 1);
  assert.equal(counts.customer, 2, "deferred and ended partners must be counted so the category nav chip for their role stays reachable");
}

// sxRoleDisplayLabel: compound labels for the common states, bare role name for on_hold/ended/unconfirmed.
// unclassified always compounds with the state (2026-07-24 P0 reversal) so unclassified/candidate and
// unclassified/established never collapse into the same bare "未分類" label.
{
  assert.equal(sxRoleDisplayLabel("joint_development", "candidate"), "共同開発候補先");
  assert.equal(sxRoleDisplayLabel("joint_development", "established"), "共同開発先");
  assert.equal(sxRoleDisplayLabel("joint_development", "in_progress"), "共同開発先");
  assert.equal(sxRoleDisplayLabel("financial_institution", "on_hold"), "金融機関", "on_hold must not fabricate a compound suffix");
  assert.equal(sxRoleDisplayLabel("unclassified", "candidate"), "未分類・候補", "unclassified must always compound with its state");
  assert.equal(sxRoleDisplayLabel("unclassified", "established"), "未分類・成立", "unclassified/established must read distinctly from unclassified/candidate");
  assert.notEqual(sxRoleDisplayLabel("unclassified", "candidate"), sxRoleDisplayLabel("unclassified", "established"), "unclassified/candidate and unclassified/established must never collapse into the same label");
}

// sxIsPartnerEnded: reads the primary role row only, independent of deferredLowPriority.
{
  const endedPrimary = partner({ roles: [role({ roleKind: "customer", relationshipState: "ended" })] });
  const onHoldPrimary = partner({ deferredLowPriority: true, roles: [role({ roleKind: "customer", relationshipState: "on_hold" })] });
  const activePrimary = partner({ roles: [role({ roleKind: "customer", relationshipState: "in_progress" })] });
  const noPrimary = partner({});
  assert.equal(sxIsPartnerEnded(endedPrimary), true);
  assert.equal(sxIsPartnerEnded(onHoldPrimary), false, "on_hold must never read as ended — they are separate units");
  assert.equal(sxIsPartnerEnded(activePrimary), false);
  assert.equal(sxIsPartnerEnded(noPrimary), false, "no primary role row must default to unconfirmed, not ended");
}

// sxSortHoldingsByPriority: blocked always leads regardless of its own due date, then day-precision
// overdue, then day-precision (soon or later), then month precision, then fully unset.
{
  const today = "2026-07-24";
  const items = [
    { id: "unset", status: "open", dueDate: null, dueDatePrecision: "unknown" },
    { id: "month", status: "open", dueDate: "2026-08-01", dueDatePrecision: "month" },
    { id: "far-day", status: "open", dueDate: "2026-09-01", dueDatePrecision: "day" },
    { id: "overdue", status: "open", dueDate: "2026-07-01", dueDatePrecision: "day" },
    { id: "blocked-no-date", status: "blocked", dueDate: null, dueDatePrecision: "unknown" },
    { id: "blocked-far-date", status: "blocked", dueDate: "2099-01-01", dueDatePrecision: "day" },
  ];
  const sorted = sxSortHoldingsByPriority(items, today).map((item) => item.id);
  assert.deepEqual(sorted.slice(0, 2).sort(), ["blocked-far-date", "blocked-no-date"], "blocked items must always occupy the top slots regardless of their own due date");
  assert.equal(sorted[2], "overdue", "day-precision overdue is the next tier after blocked");
  assert.equal(sorted[3], "far-day", "day-precision (not overdue) is the tier after overdue");
  assert.equal(sorted[4], "month", "month precision is the tier after day precision");
  assert.equal(sorted[5], "unset", "fully unset must sort last");
}

// sxAllHoldingsForPartnerAudit: every work item regardless of status, unlike sxHoldingsForPartner
// (open-only) — a completed item must stay readable as audit history.
{
  const p = partner({
    workItems: [
      workItem({ id: "open", status: "open" }),
      workItem({ id: "completed", status: "completed", completionCriteria: "受領確認", completionEvidence: "メール添付PDF", completedOn: "2026-07-20" }),
      workItem({ id: "cancelled", status: "cancelled" }),
    ],
  });
  const audit = sxAllHoldingsForPartnerAudit(p);
  assert.deepEqual(audit.map((item) => item.id).sort(), ["cancelled", "completed", "open"], "sxAllHoldingsForPartnerAudit must include every status, unlike the open-only lane view");
  const completed = audit.find((item) => item.id === "completed");
  assert.equal(completed.completionEvidence, "メール添付PDF", "completion detail fields must carry through onto the SxHoldingItem shape");
}

// sxWorkItemKindLabel: unknown kinds never render blank.
{
  assert.equal(sxWorkItemKindLabel("task"), "タスク");
  assert.equal(sxWorkItemKindLabel("not-a-real-kind"), "項目未確認");
}

// sxPartnerDisplaySortKey: nearest active holding due date wins over the partner-level due date.
{
  const withHoldingDue = partner({ dueDate: "2026-12-01", workItems: [workItem({ id: "w", dueDate: "2026-08-01", dueDatePrecision: "month", status: "open" })] });
  const withoutHoldingDue = partner({ dueDate: "2026-09-01", workItems: [] });
  const withNothing = partner({ dueDate: null, workItems: [] });
  assert.equal(sxPartnerDisplaySortKey(withHoldingDue), "2026-08-01", "an active holding's due date must win over the partner-level due date");
  assert.equal(sxPartnerDisplaySortKey(withoutHoldingDue), "2026-09-01", "falls back to the partner-level due date when no holding has one");
  assert.equal(sxPartnerDisplaySortKey(withNothing), "9999-12-31", "fully unset must sort last");
}

// sxGroupPartnersByPrimaryClassification: distinct roleKind x relationshipState groups, unclassified last,
// deferred/ended partners excluded from every group, and within-group sort matches the display sort key.
{
  const jointCandidate = partner({ id: "jc", roles: [role({ roleKind: "joint_development", relationshipState: "candidate" })], dueDate: "2026-08-01" });
  const jointEstablished = partner({ id: "je", roles: [role({ roleKind: "joint_development", relationshipState: "established" })], dueDate: "2026-07-25" });
  const jointEstablishedLater = partner({ id: "je2", roles: [role({ roleKind: "joint_development", relationshipState: "established" })], dueDate: "2026-09-01" });
  const unclassified = partner({ id: "u", dueDate: "2026-07-25" });
  const deferred = partner({ id: "d", deferredLowPriority: true, roles: [role({ roleKind: "customer", relationshipState: "on_hold" })] });
  const ended = partner({ id: "e", roles: [role({ roleKind: "customer", relationshipState: "ended" })] });
  const groups = sxGroupPartnersByPrimaryClassification([jointCandidate, jointEstablished, jointEstablishedLater, unclassified, deferred, ended]);
  const labels = groups.map((g) => g.label);
  assert.ok(labels.includes("共同開発候補先"), "候補 state must form its own group");
  assert.ok(labels.includes("共同開発先"), "established/in_progress state must form its own group, distinct from candidate");
  assert.notEqual(labels.indexOf("共同開発候補先"), labels.indexOf("共同開発先"), "共同開発先 and 共同開発候補先 must be separate groups, never merged");
  assert.equal(labels[labels.length - 1], "未分類・未確認", "unclassified must always sort last regardless of due date, and must still compound with its (unconfirmed) state");
  const establishedGroup = groups.find((g) => g.label === "共同開発先");
  assert.deepEqual(establishedGroup.partners.map((p) => p.id), ["je", "je2"], "within-group order must follow the shared display sort key (nearest due date first)");
  assert.ok(!groups.some((g) => g.partners.some((p) => p.id === "d")), "deferred partners must never appear in any primary-classification group");
  assert.ok(!groups.some((g) => g.partners.some((p) => p.id === "e")), "ended partners must never appear in any primary-classification group either — they get their own trailing section");
}

// sxComputeControlBandCounts: ended is a distinct unit from deferred (on_hold) — excluded from
// activePartners, included in totalPartners, never merged with deferredPartners.
{
  const active = partner({ id: "active", roles: [role({ roleKind: "customer", relationshipState: "in_progress" })] });
  const deferred = partner({ id: "deferred", deferredLowPriority: true, roles: [role({ roleKind: "customer", relationshipState: "on_hold" })] });
  const ended = partner({ id: "ended", roles: [role({ roleKind: "customer", relationshipState: "ended" })], workItems: [workItem({ id: "e1", side: "sx", status: "open" })] });
  const counts = sxComputeControlBandCounts([active, deferred, ended], "2026-07-24");
  assert.equal(counts.totalPartners, 3, "全関係先 must include the ended partner");
  assert.equal(counts.deferredPartners, 1, "endedは保留に混ぜない");
  assert.equal(counts.endedPartners, 1, "終了 must be its own count, distinct from 保留");
  assert.equal(counts.activePartners, 1, "対応中 must exclude both deferred and ended partners");
  assert.equal(counts.totalHoldings, 0, "an ended partner's holdings must be excluded from the holdings-unit totals, same as a deferred partner's");
}

// sxComputeControlBandCounts: an empty lane can never read as "confirmed zero" — unorganizedPartners
// counts active partners missing at least one side, organizedCoveragePct is the share with both sides.
{
  const bothSides = partner({ id: "both", workItems: [workItem({ id: "s1", side: "sx", status: "open" }), workItem({ id: "p1", side: "partner", status: "open" })] });
  const sxOnly = partner({ id: "sx-only", workItems: [workItem({ id: "s2", side: "sx", status: "open" })] });
  const noHoldings = partner({ id: "none" });
  const counts = sxComputeControlBandCounts([bothSides, sxOnly, noHoldings], "2026-07-24");
  assert.equal(counts.unorganizedPartners, 2, "sx-only and no-holdings partners both have at least one empty lane");
  assert.equal(counts.organizedCoveragePct, 33, "1 of 3 active partners has both lanes populated (rounded)");
}

// sxComputeControlBandCounts: blockedHoldings counts holdings by status regardless of side.
{
  const p = partner({
    workItems: [
      workItem({ id: "blocked-sx", side: "sx", status: "blocked" }),
      workItem({ id: "blocked-partner", side: "partner", status: "blocked" }),
      workItem({ id: "open", side: "sx", status: "open" }),
    ],
  });
  const counts = sxComputeControlBandCounts([p], "2026-07-24");
  assert.equal(counts.blockedHoldings, 2, "blocked holdings must be counted across both sides");
}

// sxPartnerHasBlockedHolding: true only when at least one open holding (work item or active
// commitment) is status=blocked, regardless of side.
{
  const blockedSx = partner({ workItems: [workItem({ id: "b1", side: "sx", status: "blocked" })] });
  const blockedCommitment = partner({ commitments: [commitment({ id: "bc1", status: "blocked" })] });
  const noneBlocked = partner({ workItems: [workItem({ id: "o1", status: "open" }), workItem({ id: "w1", status: "waiting" })] });
  const empty = partner({});
  assert.equal(sxPartnerHasBlockedHolding(blockedSx), true, "a blocked work item on either side must count");
  assert.equal(sxPartnerHasBlockedHolding(blockedCommitment), true, "a blocked active commitment must count too");
  assert.equal(sxPartnerHasBlockedHolding(noneBlocked), false, "open/waiting holdings with no blocked item must not count");
  assert.equal(sxPartnerHasBlockedHolding(empty), false, "a partner with no holdings must never read as blocked");
}

// sxPartnerPrioritySortKey: blocked-holding partners always sort into tier "0" ahead of everyone
// else, regardless of their own due date; within a tier the ordering matches sxPartnerDisplaySortKey.
{
  const blockedFarDue = partner({ id: "blocked-far", dueDate: "2099-01-01", workItems: [workItem({ id: "b1", status: "blocked" })] });
  const normalNearDue = partner({ id: "normal-near", dueDate: "2026-07-25" });
  assert.ok(
    sxPartnerPrioritySortKey(blockedFarDue).localeCompare(sxPartnerPrioritySortKey(normalNearDue)) < 0,
    "a blocked partner with a far-future due date must still sort ahead of a normal partner with a near due date",
  );
  const blockedA = partner({ id: "blocked-a", dueDate: "2026-09-01", workItems: [workItem({ id: "ba", status: "blocked" })] });
  const blockedB = partner({ id: "blocked-b", dueDate: "2026-08-01", workItems: [workItem({ id: "bb", status: "blocked" })] });
  assert.ok(
    sxPartnerPrioritySortKey(blockedB).localeCompare(sxPartnerPrioritySortKey(blockedA)) < 0,
    "within the blocked tier, ordering still follows nearest due date first",
  );
}

// sxGroupPartnersByPrimaryClassification: blocked partner sorts first within its group even with a
// later due date than a non-blocked groupmate (spec P1: partner/group sortもblocked partner最優先、
// その後表示期限).
{
  const blockedLaterDue = partner({
    id: "blocked",
    roles: [role({ roleKind: "joint_development", relationshipState: "established" })],
    dueDate: "2026-12-01",
    workItems: [workItem({ id: "b1", status: "blocked" })],
  });
  const normalEarlierDue = partner({
    id: "normal",
    roles: [role({ roleKind: "joint_development", relationshipState: "established" })],
    dueDate: "2026-08-01",
  });
  const groups = sxGroupPartnersByPrimaryClassification([normalEarlierDue, blockedLaterDue]);
  const jointGroup = groups.find((g) => g.label === "共同開発先");
  assert.deepEqual(
    jointGroup.partners.map((p) => p.id),
    ["blocked", "normal"],
    "a blocked partner must sort first within its group even though its own due date is later",
  );
}

// sxGroupPartnersByPrimaryClassification: GROUP-level ordering must check blocked-holding status
// before the unclassified-last rule, not after (spec P1: group sortはblockedを最優先にし、
// unclassified lastより前に判定). A cross case: an unclassified group with a blocked partner must
// still outrank a classified, non-blocked group — the old logic unconditionally sent every
// unclassified group to the very end regardless of urgency, which could hide a blocked partner at
// the bottom of the screen just because their classification happened to be unconfirmed.
{
  const unclassifiedBlocked = partner({
    id: "unclassified-blocked",
    dueDate: "2026-12-01",
    workItems: [workItem({ id: "ub1", status: "blocked" })],
  });
  const classifiedNormal = partner({
    id: "classified-normal",
    roles: [role({ roleKind: "customer", relationshipState: "established" })],
    dueDate: "2026-08-01",
  });
  const groups = sxGroupPartnersByPrimaryClassification([classifiedNormal, unclassifiedBlocked]);
  assert.equal(
    groups[0].partners.some((p) => p.id === "unclassified-blocked"),
    true,
    "an unclassified group with a blocked partner must sort ahead of a classified non-blocked group, not fall to the unclassified-last tail",
  );
  assert.equal(groups[groups.length - 1].roleKind, "customer", "the non-blocked classified group must not be pushed behind the blocked-but-unclassified group");
}


// 当方（SX）ボールのtier: blocked(0) > sxボール(1) > その他(2)。当方ボールは期限が遠くても前へ出る。
{
  const base = { dueDate: null, roles: [], workItems: [], commitments: [], deferredLowPriority: false };
  const blocked = { ...base, dueDate: "2026-12-31", workItems: [{ id: "w1", partnerId: "p", side: "sx", title: "t", ownerLabel: null, status: "blocked", dueDate: null, relatedMilestoneId: null }] };
  const sxBall = { ...base, dueDate: "2026-12-31", currentBallSide: "sx" };
  const partnerBall = { ...base, dueDate: "2026-08-01", currentBallSide: "partner" };
  const keyBlocked = sxPartnerPrioritySortKey(blocked);
  const keySx = sxPartnerPrioritySortKey(sxBall);
  const keyPartner = sxPartnerPrioritySortKey(partnerBall);
  assert.ok(keyBlocked.startsWith("0-"));
  assert.ok(keySx.startsWith("1-"));
  assert.ok(keyPartner.startsWith("2-"));
  // 当方ボール(12/31)が、期限の近い相手側ボール(8/1)より前
  assert.ok(keySx < keyPartner);
  // currentBallSide未指定は従来どおりその他tier
  assert.ok(sxPartnerPrioritySortKey(base).startsWith("2-"));
}

console.log("sx-partner-holdings tests passed");
