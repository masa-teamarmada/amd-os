import assert from "node:assert/strict";
import {
  computeRunPhase,
  weekWindowForRunDate,
  detectBalanceDeltas,
  detectSyncIssues,
  detectUnprocessedEntries,
  detectAnomalousJournals,
  detectOfficerCompensationFindings,
  detectInternalTransferCandidates,
  isActionTypeSafelyExecutable,
  decideExecutorAction,
  type WalletableForAudit,
  type WalletTxnForAudit,
  type ManualJournalForAudit,
  type OfficerExpectedCompensation,
} from "../src/lib/finance/freee-reconciliation-engine.ts";

// --- computeRunPhase (4-run review gate) ------------------------------------

assert.deepEqual(computeRunPhase(0), { runSequence: 1, phase: "review_only" });
assert.deepEqual(computeRunPhase(3), { runSequence: 4, phase: "review_only" });
assert.deepEqual(computeRunPhase(4), { runSequence: 5, phase: "auto_apply_allowlist" });
assert.deepEqual(computeRunPhase(10), { runSequence: 11, phase: "auto_apply_allowlist" });
assert.deepEqual(computeRunPhase(-5), { runSequence: 1, phase: "review_only" });

// --- weekWindowForRunDate ----------------------------------------------------

assert.deepEqual(weekWindowForRunDate("2026-07-30"), { weekStartDate: "2026-07-24", weekEndDate: "2026-07-30" });
assert.throws(() => weekWindowForRunDate("not-a-date"));

// --- balance delta: never auto-appliable, direct correction forbidden ------

const walletables: WalletableForAudit[] = [
  { id: 1, type: "bank_account", name: "普通預金A", lastBalance: 100_000, walletableBalance: 90_000, syncStatus: "success", lastSyncedAt: new Date().toISOString() },
  { id: 2, type: "bank_account", name: "普通預金B", lastBalance: 50_000, walletableBalance: 50_000, syncStatus: "success", lastSyncedAt: new Date().toISOString() },
];
const deltaFindings = detectBalanceDeltas(walletables);
assert.equal(deltaFindings.length, 1);
assert.equal(deltaFindings[0].deltaYen, 10_000);
assert.equal(deltaFindings[0].eligibleForAutoApply, false, "balance_delta must never be auto-appliable");
assert.equal(deltaFindings[0].severity, "blocker");

// --- sync issues -------------------------------------------------------------

const now = new Date("2026-07-30T01:00:00Z").toISOString();
const staleWalletables: WalletableForAudit[] = [
  { id: 3, type: "bank_account", name: "古い同期口座", lastBalance: 1000, walletableBalance: 1000, syncStatus: "success", lastSyncedAt: "2026-07-20T00:00:00Z" },
  { id: 4, type: "bank_account", name: "エラー口座", lastBalance: 1000, walletableBalance: 1000, syncStatus: "error", lastSyncedAt: "2026-07-29T00:00:00Z" },
  { id: 5, type: "bank_account", name: "正常口座", lastBalance: 1000, walletableBalance: 1000, syncStatus: "success", lastSyncedAt: "2026-07-29T12:00:00Z" },
];
const syncFindings = detectSyncIssues(staleWalletables, now, 3);
assert.equal(syncFindings.length, 2);
assert.ok(syncFindings.every((f) => f.eligibleForAutoApply === false));
assert.ok(syncFindings.some((f) => f.walletableId === "4" && f.severity === "blocker"));

// --- unprocessed entries -----------------------------------------------------

const unprocessedTxns: WalletTxnForAudit[] = [
  { id: 10, date: "2026-07-20", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 5000, direction: "expense", dealId: null, transferId: null, description: "謎の出金" },
  { id: 11, date: "2026-07-29", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 5000, direction: "expense", dealId: 99, transferId: null, description: "deal紐付け済み" },
];
const unprocessed = detectUnprocessedEntries(unprocessedTxns, now, 3);
assert.equal(unprocessed.length, 1);
assert.equal(unprocessed[0].freeeEntityId, "10");

// --- anomalous journals -------------------------------------------------------

const journals: ManualJournalForAudit[] = [
  {
    id: 1,
    issueDate: "2026-07-25",
    txnNumber: "J-1",
    details: [
      { entrySide: "debit", accountItemId: 1, amountYen: 1000 },
      { entrySide: "credit", accountItemId: 2, amountYen: 900 },
    ],
  },
  {
    id: 2,
    issueDate: "2026-07-26",
    txnNumber: "J-2",
    details: [
      { entrySide: "debit", accountItemId: 1, amountYen: 1000 },
      { entrySide: "credit", accountItemId: 2, amountYen: 1000 },
    ],
  },
];
const anomalies = detectAnomalousJournals(journals);
assert.equal(anomalies.length, 1);
assert.equal(anomalies[0].freeeEntityId, "1");
assert.equal(anomalies[0].severity, "blocker");

// --- officer compensation: exact single match is eligible -------------------

const officers: OfficerExpectedCompensation[] = [
  { memberId: "ID001", memberName: "まさ", projectId: "p01", projectName: "PJ1", sourceYm: "202607", amountYen: 300_000 },
  { memberId: "ID002", memberName: "きよ", projectId: "p01", projectName: "PJ1", sourceYm: "202607", amountYen: 250_000 },
];
const officerTxns: WalletTxnForAudit[] = [
  { id: 20, date: "2026-07-25", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "報酬振込" },
];
const officerFindings = detectOfficerCompensationFindings(officers, officerTxns);
assert.equal(officerFindings.length, 2);
const masaFinding = officerFindings.find((f) => f.memberId === "ID001")!;
assert.equal(masaFinding.matchConfidence, "exact");
assert.equal(masaFinding.eligibleForAutoApply, true);
const kiyoFinding = officerFindings.find((f) => f.memberId === "ID002")!;
assert.equal(kiyoFinding.eligibleForAutoApply, false, "no matching candidate must stay ambiguous, not eligible");

// --- officer compensation: duplicate exact amount candidates must halt ------

const dupOfficers: OfficerExpectedCompensation[] = [
  { memberId: "ID001", memberName: "まさ", projectId: "p01", projectName: "PJ1", sourceYm: "202607", amountYen: 300_000 },
  { memberId: "ID003", memberName: "別役員", projectId: "p02", projectName: "PJ2", sourceYm: "202607", amountYen: 300_000 },
];
const dupFindings = detectOfficerCompensationFindings(dupOfficers, officerTxns);
assert.ok(dupFindings.every((f) => f.eligibleForAutoApply === false), "same-amount collision across officers must never auto-apply");
assert.ok(dupFindings.every((f) => f.matchConfidence === "ambiguous"));

// two identical-amount txns for one officer -> ambiguous, not eligible
const multiCandidateTxns: WalletTxnForAudit[] = [
  { id: 21, date: "2026-07-25", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "1" },
  { id: 22, date: "2026-07-26", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "2" },
];
const singleOfficer: OfficerExpectedCompensation[] = [{ memberId: "ID001", memberName: "まさ", projectId: "p01", projectName: "PJ1", sourceYm: "202607", amountYen: 300_000 }];
const multiCandidateFindings = detectOfficerCompensationFindings(singleOfficer, multiCandidateTxns);
assert.equal(multiCandidateFindings.length, 1);
assert.equal(multiCandidateFindings[0].eligibleForAutoApply, false);
assert.equal(multiCandidateFindings[0].matchConfidence, "ambiguous");

// split/fee-mixed amounts never equal exactly -> naturally ambiguous
const feeMixedTxns: WalletTxnForAudit[] = [
  { id: 23, date: "2026-07-25", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 299_780, direction: "expense", dealId: null, transferId: null, description: "振込手数料差引後" },
];
const feeMixedFindings = detectOfficerCompensationFindings(singleOfficer, feeMixedTxns);
assert.equal(feeMixedFindings[0].eligibleForAutoApply, false);
assert.equal(feeMixedFindings[0].matchConfidence, "ambiguous");

// --- internal transfer candidates: exact same-day pairing is eligible -------

const transferTxns: WalletTxnForAudit[] = [
  { id: 30, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 500_000, direction: "expense", dealId: null, transferId: null, description: "振替出金" },
  { id: 31, date: "2026-07-28", walletableType: "bank_account", walletableId: 2, walletableName: "口座B", amountYen: 500_000, direction: "income", dealId: null, transferId: null, description: "振替入金" },
];
const transferFindings = detectInternalTransferCandidates(transferTxns);
assert.equal(transferFindings.length, 1);
assert.equal(transferFindings[0].matchConfidence, "exact");
assert.equal(transferFindings[0].eligibleForAutoApply, true);

// day-diff beyond tolerance -> not eligible
const laggedTransferTxns: WalletTxnForAudit[] = [
  { id: 32, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 500_000, direction: "expense", dealId: null, transferId: null, description: "振替出金" },
  { id: 33, date: "2026-08-02", walletableType: "bank_account", walletableId: 2, walletableName: "口座B", amountYen: 500_000, direction: "income", dealId: null, transferId: null, description: "振替入金(遅延)" },
];
const laggedFindings = detectInternalTransferCandidates(laggedTransferTxns, 1);
assert.equal(laggedFindings.length, 0, "day diff beyond tolerance produces no candidate at all");

// same walletable expense+income must not be treated as a transfer to itself
const sameWalletTxns: WalletTxnForAudit[] = [
  { id: 34, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 10_000, direction: "expense", dealId: null, transferId: null, description: "x" },
  { id: 35, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 10_000, direction: "income", dealId: null, transferId: null, description: "y" },
];
assert.equal(detectInternalTransferCandidates(sameWalletTxns).length, 0);

// --- action executor safety: internal transfer always blocked, no safe endpoint

assert.equal(isActionTypeSafelyExecutable("internal_transfer_reconcile"), false);
assert.equal(isActionTypeSafelyExecutable("officer_compensation_reconcile"), true);

const exactEligibleFinding = { findingType: "officer_compensation_unreconciled" as const, eligibleForAutoApply: true, matchConfidence: "exact" as const };
const ambiguousFinding = { findingType: "officer_compensation_unreconciled" as const, eligibleForAutoApply: false, matchConfidence: "ambiguous" as const };

// ambiguous findings never execute regardless of phase/flags
assert.deepEqual(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: ambiguousFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: true }).mode,
  "blocked"
);

// review-only phase (runs 1-4) never executes even if eligible
assert.deepEqual(
  decideExecutorAction({ phase: "review_only", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: true }).mode,
  "blocked"
);

// internal transfer is always blocked even when eligible + allowlist phase + writes enabled
const eligibleTransferFinding = { findingType: "internal_transfer_candidate" as const, eligibleForAutoApply: true, matchConfidence: "exact" as const };
const transferDecision = decideExecutorAction({ phase: "auto_apply_allowlist", finding: eligibleTransferFinding, actionType: "internal_transfer_reconcile", dryRun: false, writesEnabled: true });
assert.equal(transferDecision.mode, "blocked");
assert.match(transferDecision.blockedReason ?? "", /二重計上|公開エンドポイント/);

// allowlist phase + eligible + dryRun=true -> dry_run, never writes
assert.deepEqual(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: true, writesEnabled: true }).mode,
  "dry_run"
);

// allowlist phase + eligible + real run but env killswitch off -> blocked (idempotency-safe default)
assert.deepEqual(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: false }).mode,
  "blocked"
);

// allowlist phase + eligible + real run + env killswitch on -> would_execute
assert.deepEqual(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: true }).mode,
  "would_execute"
);

console.log("check_freee_reconciliation_engine: all assertions passed");
