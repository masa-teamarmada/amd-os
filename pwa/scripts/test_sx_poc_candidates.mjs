import assert from "node:assert/strict";
import {
  deriveSxPocBoard,
  sxIsPocCandidate,
  sxIsUntouchedPocCandidate,
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
const agreed = { ...base, id: "3", name: "合意C", roleLabel: "PoC接触先（排液提供）", relationshipStage: "condition_alignment" };
const secured = { ...base, id: "4", name: "調達D", roleLabel: "PoC接触先（排液提供）", relationshipStage: "executing" };
const other = { ...base, id: "5", name: "愛媛大学", roleLabel: "研究実証・大学側接続", relationshipStage: "validation_preparation" };
// EWIR候補機関Aは stage=candidate だがPoC候補ではない。役割ラベルで判定すること。
const ewirCandidate = { ...base, id: "6", name: "EWIR候補機関A", roleLabel: "地域連携・候補企業訪問", relationshipStage: "candidate" };

// 判定はroleLabelの接頭辞。stageだけで判定すると他の候補まで巻き込む。
assert.equal(sxIsPocCandidate(untouched), true);
assert.equal(sxIsPocCandidate(talking), true);
assert.equal(sxIsPocCandidate(other), false);
assert.equal(sxIsPocCandidate(ewirCandidate), false);

// 台帳から外すのは「未接触の候補」だけ。接触が始まったら関係として台帳へ戻る。
assert.equal(sxIsUntouchedPocCandidate(untouched), true);
assert.equal(sxIsUntouchedPocCandidate(talking), false);
assert.equal(sxIsUntouchedPocCandidate(ewirCandidate), false);

const board = deriveSxPocBoard([untouched, talking, agreed, secured, other, ewirCandidate]);
assert.equal(board.total, 4);
assert.equal(board.securedCount, 1);
assert.equal(board.contactedCount, 3);
// ゴール（調達済）に近い順で並ぶ
assert.deepEqual(board.groups.map((group) => group.key), ["secured", "agreed", "talking", "untouched"]);
assert.deepEqual(board.groups.map((group) => group.partners.length), [1, 1, 1, 1]);
// 0件の段階は表示しない（空の見出しを並べない）
const onlyUntouched = deriveSxPocBoard([untouched, other]);
assert.deepEqual(onlyUntouched.groups.map((group) => group.key), ["untouched"]);
assert.equal(onlyUntouched.contactedCount, 0);
// PoC候補が1件も無ければ空
assert.equal(deriveSxPocBoard([other, ewirCandidate]).total, 0);

console.log("sx-poc-candidates tests passed");
