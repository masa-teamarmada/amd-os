import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sxIsPocPartner,
  sxIsUncontactedPocPartner,
} from "../src/lib/sx-poc-candidates.ts";

const base = {
  agreedScope: "",
  nextCommitment: "",
  ownerLabel: "輕部",
  currentBallSide: "unknown",
  currentBallOwner: null,
};
const untouched = { ...base, id: "1", name: "候補A", roleLabel: "PoC候補先（排液提供）", relationshipStage: "candidate" };
const talking = { ...base, id: "2", name: "接触B", roleLabel: "PoC接触先（排液提供）", relationshipStage: "information_exchange" };
const secured = { ...base, id: "4", name: "調達D", roleLabel: "PoC接触先（排液提供）", relationshipStage: "executing" };
const other = { ...base, id: "5", name: "愛媛大学", roleLabel: "研究実証・大学側接続", relationshipStage: "validation_preparation" };
// EWIR候補機関Aは stage=candidate だがPoC候補ではない。役割ラベルで判定すること。
const ewirCandidate = { ...base, id: "6", name: "EWIR候補機関A", roleLabel: "地域連携・候補企業訪問", relationshipStage: "candidate" };

// 判定はroleLabelの接頭辞。stageだけで判定すると他の候補まで巻き込む。
assert.equal(sxIsPocPartner(untouched), true);
assert.equal(sxIsPocPartner(talking), true);
// 調達済みも「候補」ではないが、PoCという横断属性の対象には残る。
assert.equal(sxIsPocPartner(secured), true);
assert.equal(sxIsPocPartner(other), false);
assert.equal(sxIsPocPartner(ewirCandidate), false);

// 未接触判定は実行中管制件数の除外にだけ使い、表示group/orderには使わない。
assert.equal(sxIsUncontactedPocPartner(untouched), true);
assert.equal(sxIsUncontactedPocPartner(talking), false);
assert.equal(sxIsUncontactedPocPartner(secured), false);
assert.equal(sxIsUncontactedPocPartner(ewirCandidate), false);

// このmoduleにPoC専用のstage/group/orderを再導入しない。
const source = readFileSync(new URL("../src/lib/sx-poc-candidates.ts", import.meta.url), "utf8");
for (const forbidden of ["deriveSxPocList", "sxPocStageOf", "SX_POC_STAGE_ORDER", "sxPocStageLabel"]) {
  assert.equal(source.includes(forbidden), false, `${forbidden} must not return`);
}

console.log("sx-poc-partner attribute tests passed");
