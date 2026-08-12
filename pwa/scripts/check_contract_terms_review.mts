import assert from "node:assert/strict";
import {
  buildVerifiedOriginalExpenseCandidate,
  contractTermReviewPatch,
} from "../src/lib/contract-terms-review.ts";

const input = {
  projectId: "p04",
  sourceId: "drive-file-id",
  sourceUrl: "https://drive.google.com/file/d/drive-file-id/view",
  sourceTitle: "締結済み契約.pdf",
  contractTitle: "業務委託契約",
  counterpartyName: "取引先",
  expenseReimbursementAllowed: true,
  expenseReimbursementNote: "事前承認を得た諸経費はクライアント負担。",
  executionEvidence: "押印済み原本を目視確認",
} as const;

const first = buildVerifiedOriginalExpenseCandidate(input, "admin@example.com");
const second = buildVerifiedOriginalExpenseCandidate(input, "another@example.com");
assert.equal(first.source_term_hash, second.source_term_hash, "actor must not affect source hash");
assert.equal(first.status, "candidate");
assert.equal(first.review_status, "pending");
assert.equal(first.review_required, true);
assert.deepEqual(first.extracted_terms_json, {
  expense_reimbursement_allowed: true,
  expense_reimbursement_note: "事前承認を得た諸経費はクライアント負担。",
});

assert.throws(() => buildVerifiedOriginalExpenseCandidate({
  ...input,
  sourceUrl: "https://drive.google.com/file/d/different-id/view",
}, "admin@example.com"), /sourceId must match/);
assert.throws(() => buildVerifiedOriginalExpenseCandidate({
  ...input,
  expenseReimbursementAllowed: null as unknown as boolean,
}, "admin@example.com"), /must be boolean/);

assert.deepEqual(contractTermReviewPatch("approved", "admin@example.com", "2026-08-13T00:00:00.000Z"), {
  status: "applied",
  review_status: "applied",
  review_required: false,
  updated_by: "admin@example.com",
  updated_at: "2026-08-13T00:00:00.000Z",
});

console.log("contract terms review checks passed");
