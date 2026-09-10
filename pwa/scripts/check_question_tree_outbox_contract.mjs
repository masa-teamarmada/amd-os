import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertProposalLimit,
  buildQuestionTreeClientToken,
  dedupeRowsByClientToken,
  isUuid,
  proposalCount,
} from "./question_tree_outbox_contract.mjs";

const base = {
  projectId: "p21",
  sourceRef: "project_meeting_summaries:meeting-1",
  kind: "question",
  content: "この市場は成立するか",
};
const token = buildQuestionTreeClientToken(base);
assert.ok(isUuid(token));
assert.equal(buildQuestionTreeClientToken(base), token, "同じ根拠と意味なら同じ token");
assert.notEqual(
  buildQuestionTreeClientToken({ ...base, content: "別の市場は成立するか" }),
  token,
  "違う候補は違う token",
);

assert.equal(proposalCount({ questions: [{}, {}], actions: [{}] }), 3);
assert.equal(assertProposalLimit({ questions: Array.from({ length: 5 }, () => ({})) }), 5);
assert.throws(
  () => assertProposalLimit({ questions: Array.from({ length: 6 }, () => ({})) }),
  /最大 5 件/,
);

const second = buildQuestionTreeClientToken({ ...base, kind: "action" });
const deduped = dedupeRowsByClientToken(
  [{ client_token: token }, { client_token: token }, { client_token: second }],
  new Set([token]),
);
assert.deepEqual(deduped.rows, [{ client_token: second }]);
assert.equal(deduped.duplicateCount, 2, "DB既存と同一JSON内の重複を両方除く");

const applier = fs.readFileSync(new URL("./apply_question_tree_outbox.mjs", import.meta.url), "utf8");
assert.ok(applier.includes("select=id,client_token,review_state,deleted_at"));
assert.ok(applier.includes("dedupeRowsByClientToken"));
assert.ok(!applier.includes("on_conflict=project_id,client_token"));
assert.ok(!applier.includes("resolution=ignore-duplicates"));

const tokenizer = fs.readFileSync(new URL("./question_tree_outbox_tokenize.mjs", import.meta.url), "utf8");
assert.ok(tokenizer.includes('proposalCount(payload) === 0'));
assert.ok(tokenizer.includes("proposalReason が無い"));
assert.ok(tokenizer.includes("親候補が UUID ではない"));
assert.ok(tokenizer.includes("originRef が無い"));

console.log("question tree outbox contract: OK");
