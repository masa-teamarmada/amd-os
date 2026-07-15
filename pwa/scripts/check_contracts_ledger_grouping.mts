#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  contractFamilyTitle,
  groupContractLedgerRows,
  type ContractLedgerSourceRow,
} from "../src/lib/contracts-ledger.ts";

function row(input: Partial<ContractLedgerSourceRow> & Pick<ContractLedgerSourceRow, "contract_id" | "contract_title">): ContractLedgerSourceRow {
  return {
    project_id: "p00",
    canonical_title: null,
    counterparty_name: null,
    contract_type: "nda",
    status: "planned",
    registry_status: "candidate",
    expected_signing_date: null,
    effective_date: null,
    expiration_date: null,
    renewal_notice_date: null,
    signed_at: null,
    last_activity_at: null,
    planned_at: "2026-07-15T00:00:00.000Z",
    review_required: true,
    ...input,
  };
}

assert.equal(contractFamilyTitle(row({
  contract_id: "kenq-send-to",
  contract_title: "NDA: KENQ NDA DocuSign送付先確認",
})), "NDA: KENQ NDA");
assert.equal(contractFamilyTitle(row({
  contract_id: "kenq-revision",
  contract_title: "NDA: KENQ NDA微修正承諾・DocuSign送付依頼",
})), "NDA: KENQ NDA");
assert.equal(contractFamilyTitle(row({
  contract_id: "confirmation-document",
  contract_title: "共同研究契約確認書",
})), "共同研究契約確認書");

const grouped = groupContractLedgerRows([
  row({
    contract_id: "kenq-send-to",
    contract_title: "NDA: KENQ NDA DocuSign送付先確認",
    status: "planned",
    last_activity_at: "2026-07-14T10:00:00.000Z",
  }),
  row({
    contract_id: "kenq-revision",
    contract_title: "NDA: KENQ NDA微修正承諾・DocuSign送付依頼",
    status: "under_review",
    last_activity_at: "2026-07-15T09:00:00.000Z",
  }),
  row({
    contract_id: "kenq-confirm",
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

assert.equal(grouped.length, 2);
const kenq = grouped.find((contract) => contract.ledger_family_title === "NDA: KENQ NDA" && contract.counterparty_name === null);
assert.ok(kenq);
assert.deepEqual(kenq.ledger_contract_ids.sort(), ["kenq-confirm", "kenq-revision", "kenq-send-to"].sort());
assert.equal(kenq.ledger_row_count, 3);
assert.equal(kenq.status, "awaiting_signature");
assert.equal(kenq.contract_title, "NDA: KENQ NDA");

console.log(JSON.stringify({
  ok: true,
  groupedContracts: grouped.length,
  kenqSourceRows: kenq.ledger_row_count,
}, null, 2));
