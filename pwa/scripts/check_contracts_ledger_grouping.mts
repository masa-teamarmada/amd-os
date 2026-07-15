#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  consolidateContractRecords,
  contractIdentityTitle,
  resolveConfidentiality,
  resolveContractPeriod,
  resolveExpenseReimbursement,
  resolveSignatureProof,
  type ContractLedgerSourceRow,
} from "../src/lib/contracts-ledger.ts";

function row(input: Partial<ContractLedgerSourceRow> & Pick<ContractLedgerSourceRow, "contract_id" | "contract_title">): ContractLedgerSourceRow {
  return {
    project_id: "p00",
    canonical_title: null,
    canonical_contract_id: null,
    counterparty_name: null,
    contract_type: "nda",
    status: "planned",
    registry_status: "candidate",
    expected_signing_date: null,
    effective_date: null,
    expiration_date: null,
    renewal_notice_date: null,
    signed_at: null,
    signed_document_id: null,
    last_activity_at: null,
    planned_at: "2026-07-15T00:00:00.000Z",
    review_required: true,
    confidentiality_coverage: "unknown",
    confidentiality_survival_note: null,
    confidentiality_note: null,
    ...input,
  };
}

assert.equal(contractIdentityTitle(row({
  contract_id: "kenq-send-to",
  contract_title: "NDA: KENQ NDA DocuSign送付先確認",
})), "NDA: KENQ NDA");
assert.equal(contractIdentityTitle(row({
  contract_id: "kenq-revision",
  contract_title: "NDA: KENQ NDA微修正承諾・DocuSign送付依頼",
})), "NDA: KENQ NDA");
assert.equal(contractIdentityTitle(row({
  contract_id: "confirmation-document",
  contract_title: "共同研究契約確認書",
})), "共同研究契約確認書");

const consolidated = consolidateContractRecords([
  row({
    contract_id: "kenq-signed-old",
    contract_title: "NDA: KENQ NDA DocuSign送付先確認",
    status: "signed",
    signed_at: "2026-07-14T10:00:00.000Z",
    last_activity_at: "2026-07-14T10:00:00.000Z",
  }),
  row({
    contract_id: "kenq-revision",
    contract_title: "NDA: KENQ NDA微修正承諾・DocuSign送付依頼",
    status: "under_review",
    last_activity_at: "2026-07-15T09:00:00.000Z",
  }),
  row({
    contract_id: "kenq-current",
    contract_title: "NDA: KENQ NDA確認・業務委託者含む微修正",
    status: "awaiting_signature",
    last_activity_at: "2026-07-15T11:00:00.000Z",
  }),
  row({
    contract_id: "other-party",
    contract_title: "NDA: KENQ NDA DocuSign送付先確認",
    counterparty_name: "別会社",
  }),
]);

assert.equal(consolidated.length, 2);
const kenq = consolidated.find((contract) => contract.contract_title === "NDA: KENQ NDA" && contract.counterparty_name === null);
assert.ok(kenq);
assert.deepEqual(kenq.related_contract_ids.sort(), ["kenq-current", "kenq-revision", "kenq-signed-old"].sort());
assert.equal(kenq.related_record_count, 3);
assert.equal(kenq.status, "awaiting_signature", "古い押印済み記録で最新の押印待ちを隠さない");

assert.deepEqual(resolveSignatureProof(kenq, []), {
  state: "incomplete",
  label: "未完了",
  note: "押印版ファイルなし",
});
assert.deepEqual(resolveSignatureProof(kenq, [{ document_id: "signed-old", contract_id: "kenq-signed-old", document_kind: "signed" }]), {
  state: "needs_proof",
  label: "更新中",
  note: "旧押印版はあるが、現在の契約手続きは未完了",
});
const signedCurrent = { ...kenq, status: "signed" as const, current_signed_document_id: "signed-current" };
assert.equal(resolveSignatureProof(signedCurrent, [{ document_id: "signed-current", contract_id: "kenq-current", document_kind: "signed" }]).state, "complete");
assert.equal(resolveSignatureProof(signedCurrent, [{ document_id: "signed-old", contract_id: "kenq-signed-old", document_kind: "signed" }]).state, "needs_proof");
assert.equal(resolveConfidentiality(kenq).state, "included");

assert.deepEqual(resolveExpenseReimbursement({ expenseReimbursementAllowed: false, expenseReimbursementNote: "事前申請でも不可" }), {
  state: "not_allowed",
  note: "事前申請でも不可",
});
assert.equal(resolveExpenseReimbursement(null).state, "unknown");

assert.deepEqual(resolveContractPeriod(kenq, {
  start_ym: "2026-04",
  end_ym: null,
  contract_terms_json: { contractEndYm: "2027-03" },
}), {
  start: null,
  end: null,
  startSource: "unknown",
  endSource: "unknown",
  referenceStart: null,
  referenceEnd: "2027-03",
  referenceSource: "applied_project_terms",
});

console.log(JSON.stringify({
  ok: true,
  contracts: consolidated.length,
  relatedRecords: kenq.related_record_count,
  currentStatus: kenq.status,
}, null, 2));
