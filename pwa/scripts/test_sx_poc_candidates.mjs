import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sxIsPocPartner,
  sxIsUncontactedPocPartner,
} from "../src/lib/sx-poc-candidates.ts";
import {
  SX_PARTNER_STAGE_ORDER,
  sxCompactBallSideLabel,
  sxCompactPartnerRowText,
  sxComparePartnersForPoc,
  sxPartnerAttention,
  sxPartnerHasDataGap,
  sxPartnerHasContactRecord,
  sxPartnerHasDueSoon,
  sxPartnerHasOverdue,
  sxPartnerIsOnHold,
  sxPartnerNeedsRefresh,
  sxPartnerStageIndex,
} from "../src/lib/sx-partner-progress.ts";

const base = {
  agreedScope: "",
  nextCommitment: "",
  ownerLabel: "輕部",
  currentBallSide: "unknown",
  currentBallOwner: null,
  dueDate: null,
  dueDatePrecision: "unknown",
  lastContactDate: null,
  roles: [],
  workItems: [],
  commitments: [],
  deferredLowPriority: false,
  lastVerifiedAt: "2026-07-29",
  confidence: "high",
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

// 未接触はPoC比較レンズの接触状況集計にだけ使い、進捗段階やgroupを捏造しない。
assert.equal(sxIsUncontactedPocPartner(untouched), true);
assert.equal(sxIsUncontactedPocPartner(talking), false);
assert.equal(sxIsUncontactedPocPartner(secured), false);
assert.equal(sxIsUncontactedPocPartner(ewirCandidate), false);

// このmoduleにPoC専用のstage/group/orderを再導入しない。
const source = readFileSync(new URL("../src/lib/sx-poc-candidates.ts", import.meta.url), "utf8");
for (const forbidden of ["deriveSxPocList", "sxPocStageOf", "SX_POC_STAGE_ORDER", "sxPocStageLabel"]) {
  assert.equal(source.includes(forbidden), false, `${forbidden} must not return`);
}

// PoC比較はrole分類の有無に左右されず、全社共通の固定7段階で比較する。
assert.deepEqual(SX_PARTNER_STAGE_ORDER, [
  "candidate",
  "information_exchange",
  "condition_alignment",
  "meeting_coordination",
  "validation_preparation",
  "agreement_confirmation",
  "executing",
]);
assert.equal(sxPartnerStageIndex("candidate"), 1);
assert.equal(sxPartnerStageIndex("executing"), 7);
assert.equal(sxPartnerStageIndex("on_hold"), null);
assert.ok(sxComparePartnersForPoc(secured, talking, "2026-07-30", "progress") < 0);

// 進捗と要対応は別軸。期限超過は深い段階より先に並ぶが、浅い段階だけでは「遅れ」にしない。
const overdue = { ...talking, id: "7", name: "期限超過先", dueDate: "2026-07-20", dueDatePrecision: "day" };
const sxBall = { ...secured, id: "8", name: "当方対応先", currentBallSide: "sx", currentBallOwner: "石原先生", dueDate: "2026-08-20", dueDatePrecision: "day" };
const dueSoonSxBall = { ...sxBall, dueDate: "2026-08-03" };
const unknownBall = { ...secured, id: "9", name: "担当未確認先", currentBallSide: "unknown", dueDate: "2026-08-20", dueDatePrecision: "day" };
const dueUnset = { ...talking, id: "10", name: "期限未設定先", currentBallSide: "none" };
assert.equal(sxPartnerAttention(overdue, "2026-07-30").key, "overdue");
assert.equal(sxPartnerAttention(sxBall, "2026-07-30").key, "clear");
assert.equal(sxPartnerAttention(dueSoonSxBall, "2026-07-30").key, "due_soon");
assert.equal(sxPartnerAttention(unknownBall, "2026-07-30").key, "unknown");
assert.equal(sxPartnerAttention(dueUnset, "2026-07-30").key, "due_unset");
assert.ok(sxComparePartnersForPoc(overdue, sxBall, "2026-07-30", "attention") < 0);
assert.ok(sxComparePartnersForPoc(dueUnset, sxBall, "2026-07-30", "attention") < 0);
const heldOverdue = { ...overdue, id: "11", deferredLowPriority: true };
assert.equal(sxPartnerIsOnHold(heldOverdue), true);
assert.equal(sxPartnerAttention(heldOverdue, "2026-07-30").key, "overdue");
const heldWithoutDue = { ...dueUnset, id: "12", relationshipStage: "on_hold", deferredLowPriority: true };
assert.equal(sxPartnerAttention(heldWithoutDue, "2026-07-30").key, "on_hold");
const stale = { ...sxBall, id: "13", lastVerifiedAt: "2026-07-01" };
const unknownConfidence = { ...sxBall, id: "14", confidence: "unknown" };
assert.equal(sxPartnerNeedsRefresh(stale, "2026-07-30"), true);
assert.equal(sxPartnerAttention(stale, "2026-07-30").key, "stale");
assert.equal(sxPartnerNeedsRefresh(unknownConfidence, "2026-07-30"), true);
const overlappingSignals = { ...overdue, id: "15", confidence: "unknown", currentBallSide: "unknown", currentBallOwner: null };
assert.equal(sxPartnerHasOverdue(overlappingSignals, "2026-07-30"), true);
assert.equal(sxPartnerNeedsRefresh(overlappingSignals, "2026-07-30"), true);
assert.equal(sxPartnerHasDataGap(overlappingSignals), true);
assert.equal(sxPartnerHasDueSoon(dueSoonSxBall, "2026-07-30"), true);

// 接点記録は表示ラベルではなく、実際の接点日またはinteractionから判定する。
assert.equal(sxPartnerHasContactRecord({ interactions: [], lastContactDate: null }), false);
assert.equal(sxPartnerHasContactRecord({ interactions: [], lastContactDate: "2026-07-29" }), true);
assert.equal(sxPartnerHasContactRecord({ interactions: [{ id: "mail-1" }], lastContactDate: null }), true);

// 一覧では現在行の会社名だけを「先方」へ短縮し、第三者名・保存値・詳細履歴は変えない。
assert.equal(
  sxCompactPartnerRowText("ユナイテッドシルク（担当者）からマルトモへ相談", "ユナイテッドシルク"),
  "先方担当からマルトモへ相談",
);
assert.equal(sxCompactPartnerRowText("ユナイテッドシルクから返答待ち", "ユナイテッドシルク"), "先方から返答待ち");
assert.equal(sxCompactPartnerRowText("ユナイテッドシルク研究所から返答待ち", "ユナイテッドシルク"), "ユナイテッドシルク研究所から返答待ち");
assert.equal(sxCompactBallSideLabel("partner"), "先方");
assert.equal(sxCompactBallSideLabel("sx"), "当方");

console.log("sx-poc comparison lens tests passed");
