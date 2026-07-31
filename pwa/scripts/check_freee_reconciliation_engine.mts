import assert from "node:assert/strict";
import {
  computeRunPhase,
  weekWindowForRunDate,
  ymFromIsoDate,
  isRunStale,
  detectBalanceDeltas,
  detectSyncIssues,
  detectUnprocessedEntries,
  detectAnomalousJournals,
  buildAuditSourceUnavailableFinding,
  detectOfficerCompensationFindings,
  detectInternalTransferCandidates,
  buildOfficerRecurringMappings,
  isActionTypeSafelyExecutable,
  decideExecutorAction,
  decideSheetReferenceSkip,
  summarizeSheetRangeValues,
  findingKeysToResolve,
  type WalletableForAudit,
  type WalletTxnForAudit,
  type ManualJournalForAudit,
  type OfficerForMatching,
  type RecurringItemForMatching,
} from "../src/lib/finance/freee-reconciliation-engine.ts";

// --- computeRunPhase (4-run review gate) ------------------------------------

assert.deepEqual(computeRunPhase(0), { runSequence: 1, phase: "review_only" });
assert.deepEqual(computeRunPhase(3), { runSequence: 4, phase: "review_only" });
assert.deepEqual(computeRunPhase(4), { runSequence: 5, phase: "auto_apply_allowlist" });
assert.deepEqual(computeRunPhase(10), { runSequence: 11, phase: "auto_apply_allowlist" });
assert.deepEqual(computeRunPhase(-5), { runSequence: 1, phase: "review_only" });

// --- weekWindowForRunDate / ymFromIsoDate -----------------------------------

assert.deepEqual(weekWindowForRunDate("2026-07-30"), { weekStartDate: "2026-07-24", weekEndDate: "2026-07-30" });
assert.throws(() => weekWindowForRunDate("not-a-date"));
assert.equal(ymFromIsoDate("2026-07-30"), "202607");
assert.equal(ymFromIsoDate("2026-01-05"), "202601");
assert.throws(() => ymFromIsoDate("bogus"));

assert.deepEqual(
  findingKeysToResolve(["still-open", "gone", "gone"], ["still-open", "new"]),
  ["gone"],
  "only prior keys absent from the current evaluated run are resolved"
);

// --- isRunStale (P1-7 stale-running recovery) --------------------------------

const NOW = "2026-07-30T10:00:00Z";
assert.equal(isRunStale("2026-07-30T09:45:00Z", NOW, 30), false, "15 minutes old, under threshold");
assert.equal(isRunStale("2026-07-30T09:29:00Z", NOW, 30), true, "31 minutes old, over threshold");
assert.equal(isRunStale("2026-07-30T09:59:00Z", NOW, 30), false, "1 minute old");
assert.equal(isRunStale("invalid-date", NOW, 30), false, "unparseable dates never falsely report stale");

// --- balance delta: field semantics fixed (last_balance=synced, walletable_balance=registered)

const walletables: WalletableForAudit[] = [
  { id: 1, type: "bank_account", name: "普通預金A", syncedBalance: 90_000, registeredBalance: 100_000, syncStatus: "success", lastSyncedAt: new Date().toISOString() },
  { id: 2, type: "bank_account", name: "普通預金B", syncedBalance: 50_000, registeredBalance: 50_000, syncStatus: "success", lastSyncedAt: new Date().toISOString() },
];
const deltaFindings = detectBalanceDeltas(walletables);
assert.equal(deltaFindings.length, 1);
assert.equal(deltaFindings[0].deltaYen, 10_000, "delta = registeredBalance(walletable_balance) - syncedBalance(last_balance)");
assert.match(deltaFindings[0].summaryJa, /登録残高\(walletable_balance\)/);
assert.match(deltaFindings[0].summaryJa, /銀行同期残高\(last_balance\)/);
assert.equal(deltaFindings[0].eligibleForAutoApply, false, "balance_delta must never be auto-appliable");
assert.equal(deltaFindings[0].severity, "blocker");

// --- sync issues -------------------------------------------------------------

const staleWalletables: WalletableForAudit[] = [
  { id: 3, type: "bank_account", name: "古い同期口座", syncedBalance: 1000, registeredBalance: 1000, syncStatus: "success", lastSyncedAt: "2026-07-20T00:00:00Z" },
  { id: 4, type: "bank_account", name: "エラー口座", syncedBalance: 1000, registeredBalance: 1000, syncStatus: "token_refresh_error", lastSyncedAt: "2026-07-29T00:00:00Z" },
  { id: 5, type: "bank_account", name: "正常口座", syncedBalance: 1000, registeredBalance: 1000, syncStatus: "success", lastSyncedAt: "2026-07-29T12:00:00Z" },
  { id: 6, type: "credit_card", name: "同期未設定", syncedBalance: null, registeredBalance: 1000, syncStatus: "disabled", lastSyncedAt: null },
  { id: 7, type: "wallet", name: "同期非対応", syncedBalance: null, registeredBalance: 1000, syncStatus: "unsupported", lastSyncedAt: null },
];
const syncFindings = detectSyncIssues(staleWalletables, NOW, 3);
assert.equal(syncFindings.length, 3);
assert.ok(syncFindings.every((f) => f.eligibleForAutoApply === false));
assert.ok(syncFindings.some((f) => f.walletableId === "4" && f.severity === "blocker"));
assert.ok(syncFindings.some((f) => f.walletableId === "6" && f.severity === "info"));
assert.ok(!syncFindings.some((f) => f.walletableId === "7"), "sync unsupported wallet is outside sync-staleness checks");

// --- unprocessed entries -----------------------------------------------------

const unprocessedTxns: WalletTxnForAudit[] = [
  { id: 10, date: "2026-07-20", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 5000, direction: "expense", dealId: null, transferId: null, description: "謎の出金" },
  { id: 11, date: "2026-07-29", walletableType: "bank_account", walletableId: 1, walletableName: "A", amountYen: 5000, direction: "expense", dealId: 99, transferId: null, description: "deal紐付け済み" },
];
const unprocessed = detectUnprocessedEntries(unprocessedTxns, NOW, 3);
assert.equal(unprocessed.length, 1);
assert.equal(unprocessed[0].freeeEntityId, "10");

const statusAwareTxns: WalletTxnForAudit[] = [
  { ...unprocessedTxns[0], id: 13, processingStatus: 1, dealId: 999 },
  { ...unprocessedTxns[0], id: 14, processingStatus: 2, dealId: null },
];
const statusAwareUnprocessed = detectUnprocessedEntries(statusAwareTxns, NOW, 3);
assert.equal(statusAwareUnprocessed.length, 1, "freee status is authoritative over absent/non-standard deal_id fields");
assert.equal(statusAwareUnprocessed[0].freeeEntityId, "13");

// --- anomalous journals -------------------------------------------------------

const journals: ManualJournalForAudit[] = [
  { id: 1, issueDate: "2026-07-25", txnNumber: "J-1", details: [{ entrySide: "debit", accountItemId: 1, amountYen: 1000 }, { entrySide: "credit", accountItemId: 2, amountYen: 900 }] },
  { id: 2, issueDate: "2026-07-26", txnNumber: "J-2", details: [{ entrySide: "debit", accountItemId: 1, amountYen: 1000 }, { entrySide: "credit", accountItemId: 2, amountYen: 1000 }] },
];
const anomalies = detectAnomalousJournals(journals);
assert.equal(anomalies.length, 1);
assert.equal(anomalies[0].freeeEntityId, "1");
assert.equal(anomalies[0].severity, "blocker");

const unavailableSource = buildAuditSourceUnavailableFinding(
  "freee manual_journals",
  "freeeアプリに振替伝票一覧の参照権限がない"
);
assert.equal(unavailableSource.findingType, "audit_source_unavailable");
assert.equal(unavailableSource.severity, "blocker");
assert.equal(unavailableSource.eligibleForAutoApply, false);

// --- buildOfficerRecurringMappings: explicit / ambiguous / missing for all officers

const officers: OfficerForMatching[] = [
  { memberId: "ID001", memberName: "まさ", codeName: "まさ" },
  { memberId: "ID002", memberName: "きよ", codeName: "きよ" },
  { memberId: "ID003", memberName: "別役員", codeName: "べつ" },
  { memberId: "ID004", memberName: "曖昧役員", codeName: "あいまい" },
];
const items: RecurringItemForMatching[] = [
  { id: "item-explicit-masa", displayName: "役員報酬(まさ)", vendorName: null, amountYen: 300_000, frequency: "monthly", withdrawalAccount: "普通預金A", explicitMemberId: "ID001" },
  { id: "item-namematch-kiyo", displayName: "きよ", vendorName: null, amountYen: 250_000, frequency: "monthly", withdrawalAccount: null, explicitMemberId: null },
  { id: "item-ambiguous-1", displayName: "曖昧役員", vendorName: null, amountYen: 200_000, frequency: "monthly", withdrawalAccount: null, explicitMemberId: null },
  { id: "item-ambiguous-2", displayName: "あいまい", vendorName: null, amountYen: 210_000, frequency: "monthly", withdrawalAccount: null, explicitMemberId: null },
  // ID003 (別役員) has no recurring item at all → missing
];
const mappings = buildOfficerRecurringMappings(officers, items);
const byId = new Map(mappings.map((m) => [m.memberId, m]));

assert.equal(byId.get("ID001")?.mappingStatus, "explicit");
assert.equal(byId.get("ID001")?.recurringItemId, "item-explicit-masa");
assert.equal(byId.get("ID002")?.mappingStatus, "name_match_single");
assert.equal(byId.get("ID002")?.recurringItemId, "item-namematch-kiyo");
assert.equal(byId.get("ID003")?.mappingStatus, "missing");
assert.equal(byId.get("ID003")?.recurringItemId, null);
assert.equal(byId.get("ID004")?.mappingStatus, "name_match_ambiguous", "matches both displayName and codeName tokens across 2 items");
assert.equal(byId.get("ID004")?.candidateRecurringItemIds.length, 2);

// explicit_conflict: two recurring items both explicitly claim the same officer
const conflictItems: RecurringItemForMatching[] = [
  { id: "conflict-1", displayName: "A", vendorName: null, amountYen: 100_000, frequency: "monthly", withdrawalAccount: null, explicitMemberId: "ID001" },
  { id: "conflict-2", displayName: "B", vendorName: null, amountYen: 100_000, frequency: "monthly", withdrawalAccount: null, explicitMemberId: "ID001" },
];
const conflictMapping = buildOfficerRecurringMappings([officers[0]], conflictItems)[0];
assert.equal(conflictMapping.mappingStatus, "explicit_conflict");
assert.equal(conflictMapping.candidateRecurringItemIds.length, 2);

// --- officer compensation findings: mapping issues are always blocker, every officer appears

const targetYm = "202607";
const missingAmbiguousMappings = mappings.filter((m) => m.memberId === "ID003" || m.memberId === "ID004");
const missingAmbiguousFindings = detectOfficerCompensationFindings(missingAmbiguousMappings, [], targetYm);
assert.equal(missingAmbiguousFindings.length, 2, "every officer with an unresolved mapping produces exactly one finding");
assert.ok(missingAmbiguousFindings.every((f) => f.severity === "blocker"));
assert.ok(missingAmbiguousFindings.every((f) => f.eligibleForAutoApply === false));

// --- officer compensation: amount-only match must NOT be exact ---------------

const explicitMapping = byId.get("ID001")!;
const amountOnlyTxns: WalletTxnForAudit[] = [
  { id: 20, date: "2026-07-25", walletableType: "bank_account", walletableId: 1, walletableName: "普通預金A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "謎の振込（名前トークンなし）" },
];
const amountOnlyFindings = detectOfficerCompensationFindings([explicitMapping], amountOnlyTxns, targetYm);
assert.equal(amountOnlyFindings.length, 1);
assert.equal(amountOnlyFindings[0].matchConfidence, "ambiguous", "amount-only match (no description token) must not be exact");
assert.equal(amountOnlyFindings[0].eligibleForAutoApply, false);

// full match (amount + description token + withdrawal_account + explicit mapping) IS exact
const fullMatchTxns: WalletTxnForAudit[] = [
  { id: 21, date: "2026-07-25", walletableType: "bank_account", walletableId: 1, walletableName: "普通預金A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "まさ 役員報酬 7月分" },
];
const fullMatchFindings = detectOfficerCompensationFindings([explicitMapping], fullMatchTxns, targetYm);
assert.equal(fullMatchFindings.length, 1);
assert.equal(fullMatchFindings[0].matchConfidence, "exact");
assert.equal(fullMatchFindings[0].eligibleForAutoApply, true);

// deal紐付け済みの単一明細は消込済みなのでfindingを出さない
const reconciledTxns: WalletTxnForAudit[] = [
  { ...fullMatchTxns[0], id: 24, processingStatus: 2 },
];
assert.equal(
  detectOfficerCompensationFindings([explicitMapping], reconciledTxns, targetYm).length,
  0,
  "a single deal-linked salary payment is already reconciled"
);

// 消込済みと未処理が重複する場合は二重支払いの可能性としてblocker
const duplicatedPaymentFindings = detectOfficerCompensationFindings(
  [explicitMapping],
  [reconciledTxns[0], { ...fullMatchTxns[0], id: 25 }],
  targetYm
);
assert.equal(duplicatedPaymentFindings.length, 1);
assert.equal(duplicatedPaymentFindings[0].severity, "blocker");
assert.equal(duplicatedPaymentFindings[0].eligibleForAutoApply, false);

// 役員報酬らしい明細が内部振替扱いなら誤分類の可能性としてblocker
const transferLinkedSalaryFindings = detectOfficerCompensationFindings(
  [explicitMapping],
  [{ ...fullMatchTxns[0], id: 26, transferId: 7001 }],
  targetYm
);
assert.equal(transferLinkedSalaryFindings.length, 1);
assert.equal(transferLinkedSalaryFindings[0].severity, "blocker");

// same criteria but mappingStatus=name_match_single (kiyo) must cap at "high", never exact
const kiyoMapping = byId.get("ID002")!;
const kiyoFullMatchTxns: WalletTxnForAudit[] = [
  { id: 22, date: "2026-07-25", walletableType: "bank_account", walletableId: 2, walletableName: "普通預金B", amountYen: 250_000, direction: "expense", dealId: null, transferId: null, description: "きよ 役員報酬" },
];
const kiyoFindings = detectOfficerCompensationFindings([kiyoMapping], kiyoFullMatchTxns, targetYm);
assert.equal(kiyoFindings[0].matchConfidence, "high", "name_match_single mapping must never reach exact even with full criteria");
assert.equal(kiyoFindings[0].eligibleForAutoApply, false, "name-match-only mapping is a review candidate, never auto eligible");

// month filter: txn outside targetYm is not a candidate
const wrongMonthTxns: WalletTxnForAudit[] = [
  { id: 23, date: "2026-06-25", walletableType: "bank_account", walletableId: 1, walletableName: "普通預金A", amountYen: 300_000, direction: "expense", dealId: null, transferId: null, description: "まさ 役員報酬" },
];
const wrongMonthFindings = detectOfficerCompensationFindings([explicitMapping], wrongMonthTxns, targetYm);
assert.equal(wrongMonthFindings[0].matchConfidence, "ambiguous");
assert.equal(wrongMonthFindings[0].eligibleForAutoApply, false);

// cross-officer amount collision blocks eligibility even with a perfect single match
const collidingOtherMapping = { ...byId.get("ID002")!, mappingStatus: "explicit" as const, amountYen: 300_000 };
const collisionFindings = detectOfficerCompensationFindings([explicitMapping, collidingOtherMapping], fullMatchTxns, targetYm);
const masaCollisionFinding = collisionFindings.find((f) => f.memberId === "ID001")!;
assert.equal(masaCollisionFinding.eligibleForAutoApply, false, "same-amount collision across officers must never auto-apply");

// --- internal transfer candidates: exact same-day pairing is eligible -------

const transferTxns: WalletTxnForAudit[] = [
  { id: 30, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 500_000, direction: "expense", processingStatus: 1, dealId: null, transferId: null, description: "振替出金" },
  { id: 31, date: "2026-07-28", walletableType: "bank_account", walletableId: 2, walletableName: "口座B", amountYen: 500_000, direction: "income", processingStatus: 1, dealId: null, transferId: null, description: "振替入金" },
];
const transferFindings = detectInternalTransferCandidates(transferTxns);
assert.equal(transferFindings.length, 1);
assert.equal(transferFindings[0].matchConfidence, "exact");
assert.equal(transferFindings[0].eligibleForAutoApply, true);

const laggedTransferTxns: WalletTxnForAudit[] = [
  { id: 32, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 500_000, direction: "expense", dealId: null, transferId: null, description: "振替出金" },
  { id: 33, date: "2026-08-02", walletableType: "bank_account", walletableId: 2, walletableName: "口座B", amountYen: 500_000, direction: "income", dealId: null, transferId: null, description: "振替入金(遅延)" },
];
assert.equal(detectInternalTransferCandidates(laggedTransferTxns, 1).length, 0, "day diff beyond tolerance produces no candidate at all");

const sameWalletTxns: WalletTxnForAudit[] = [
  { id: 34, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 10_000, direction: "expense", dealId: null, transferId: null, description: "x" },
  { id: 35, date: "2026-07-28", walletableType: "bank_account", walletableId: 1, walletableName: "口座A", amountYen: 10_000, direction: "income", dealId: null, transferId: null, description: "y" },
];
assert.equal(detectInternalTransferCandidates(sameWalletTxns).length, 0);

// 1つの入金候補を複数出金が奪い合う場合はorder依存でexactにせず、両方ambiguous
const contestedTransferTxns: WalletTxnForAudit[] = [
  { ...transferTxns[0], id: 36 },
  { ...transferTxns[0], id: 37 },
  { ...transferTxns[1], id: 38 },
];
const contestedTransferFindings = detectInternalTransferCandidates(contestedTransferTxns);
assert.equal(contestedTransferFindings.length, 2);
assert.ok(contestedTransferFindings.every((finding) => finding.matchConfidence === "ambiguous"));
assert.ok(contestedTransferFindings.every((finding) => finding.eligibleForAutoApply === false));

// --- per-run finding history: finding_key stability across repeated detection

const key1 = detectInternalTransferCandidates(transferTxns)[0].findingKey;
const key2 = detectInternalTransferCandidates(transferTxns)[0].findingKey;
assert.equal(key1, key2, "same underlying entity must always produce the same finding_key across repeated (weekly) detections");
const officerKey1 = detectOfficerCompensationFindings([explicitMapping], fullMatchTxns, targetYm)[0].findingKey;
const officerKey2 = detectOfficerCompensationFindings([explicitMapping], fullMatchTxns, targetYm)[0].findingKey;
assert.equal(officerKey1, officerKey2);
const officerKeyDifferentMonth = detectOfficerCompensationFindings([explicitMapping], fullMatchTxns, "202608")[0].findingKey;
assert.notEqual(officerKey1, officerKeyDifferentMonth, "different target month must produce a different finding_key");

// --- action executor safety: BOTH action types always blocked (P0-2) --------

assert.equal(isActionTypeSafelyExecutable("internal_transfer_reconcile"), false);
assert.equal(isActionTypeSafelyExecutable("officer_compensation_reconcile"), false, "no verified safe endpoint exists yet for officer compensation either");

const exactEligibleFinding = { findingType: "officer_compensation_unreconciled" as const, eligibleForAutoApply: true, matchConfidence: "exact" as const };
const ambiguousFinding = { findingType: "officer_compensation_unreconciled" as const, eligibleForAutoApply: false, matchConfidence: "ambiguous" as const };
const eligibleTransferFinding = { findingType: "internal_transfer_candidate" as const, eligibleForAutoApply: true, matchConfidence: "exact" as const };

// ambiguous findings never execute
assert.equal(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: ambiguousFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: true }).mode,
  "blocked"
);

// review-only phase (runs 1-4) never executes even if eligible
assert.equal(
  decideExecutorAction({ phase: "review_only", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: true }).mode,
  "blocked"
);

// allowlist phase (run 5+) + eligible + exact + writesEnabled=true + dryRun=false (= what a real
// auto-apply attempt, or an admin's manual approval-with-write override, would look like):
// BOTH action types still resolve to blocked, because no safe endpoint is verified yet.
for (const [actionType, finding] of [
  ["officer_compensation_reconcile", exactEligibleFinding],
  ["internal_transfer_reconcile", eligibleTransferFinding],
] as const) {
  const decision = decideExecutorAction({ phase: "auto_apply_allowlist", finding, actionType, dryRun: false, writesEnabled: true });
  assert.equal(decision.mode, "blocked", `${actionType} must stay blocked even at full allowlist eligibility`);
  assert.ok(decision.blockedReason && decision.blockedReason.length > 0);
}

// writesEnabled=false / dryRun=true make no difference either — still always blocked
assert.equal(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: true, writesEnabled: false }).mode,
  "blocked"
);
assert.equal(
  decideExecutorAction({ phase: "auto_apply_allowlist", finding: exactEligibleFinding, actionType: "officer_compensation_reconcile", dryRun: false, writesEnabled: false }).mode,
  "blocked"
);

// --- sheet reference: skip reasons + sanitized summary (I/O mockable, tested here as pure fns)

assert.equal(
  decideSheetReferenceSkip({ spreadsheetId: null, ranges: [], hasGoogleAuth: false }),
  "AMD_FINANCE_REFERENCE_SHEET_ID not set"
);
assert.equal(
  decideSheetReferenceSkip({ spreadsheetId: "sheet-1", ranges: [], hasGoogleAuth: true }),
  "AMD_FINANCE_REFERENCE_SHEET_RANGES not set"
);
assert.equal(
  decideSheetReferenceSkip({ spreadsheetId: "sheet-1", ranges: ["A1:B2"], hasGoogleAuth: false }),
  "Google OAuth not configured (GOOGLE_OAUTH_* / GOOGLE_SERVICE_ACCOUNT_JSON missing)"
);
assert.equal(decideSheetReferenceSkip({ spreadsheetId: "sheet-1", ranges: ["A1:B2"], hasGoogleAuth: true }), null);

const rangeSummary = summarizeSheetRangeValues("Sheet1!A1:C3", [
  ["日付", "科目", "金額"],
  ["2026-07-01", "家賃", "100000"],
  ["", "", ""],
]);
assert.deepEqual(rangeSummary, { range: "Sheet1!A1:C3", rowCount: 3, nonEmptyCellCount: 6 });
assert.ok(
  !JSON.stringify(rangeSummary).includes("家賃") && !JSON.stringify(rangeSummary).includes("100000"),
  "sanitized summary must never leak actual cell values"
);

console.log("check_freee_reconciliation_engine: all assertions passed");
