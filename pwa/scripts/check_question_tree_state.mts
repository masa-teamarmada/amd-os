import assert from "node:assert/strict";
import { resolveQuestionState } from "../src/lib/question-tree-state.ts";
import { QUESTION_STATE_LABEL, type ActionNode, type QuestionNode } from "../src/lib/question-tree-types.ts";

const action = (status: ActionNode["status"], props: Partial<ActionNode> = {}): ActionNode =>
  ({ status, actionKind: "work", isProposed: false, children: [], ...props } as ActionNode);
const question = (props: Partial<QuestionNode> = {}): QuestionNode => {
  const node = { status: "open", questionKind: "open", childrenLogic: "all", children: [], actions: [], isProposed: false, ...props } as QuestionNode;
  node.state = resolveQuestionState(node);
  return node;
};
let checks = 0;
function expect(props: Partial<QuestionNode>, expected: QuestionNode["state"], reason: string) {
  assert.equal(question(props).state, expected, reason);
  checks++;
}

for (const questionKind of ["goal", "milestone", "open", "hypothesis"] as const) {
  expect({ questionKind }, "under_review", `${questionKind}: 子なしは検討中`);
}
expect({ children: [question()] }, "under_review", "子を追加しただけでは進行中にしない");
expect({ actions: [action("unassessed")] }, "under_review", "未登録の進捗を推定しない");
expect({ actions: [action("not_started")] }, "under_review", "未着手の作業を判断待ちにしない");
expect({ actions: [action("running")] }, "in_progress", "作業TODOの実行状態を反映");
expect({ actions: [action("blocked")] }, "blocked", "阻害の登録で対応待ち");
expect({ actions: [action("done")] }, "decidable", "実作業の完了で判断待ち");
expect({ actions: [action("dropped")] }, "under_review", "中止だけで判断待ちにしない");
expect({ actions: [action("done", { children: [action("running")] })] }, "in_progress", "子TODOの未完了を反映");
expect({ actions: [action("done", { children: [action("blocked")] })] }, "blocked", "子TODOの阻害を反映");
for (const status of ["running", "blocked", "done"] as const) {
  expect({ actions: [action(status, { isProposed: true })] }, "under_review", "未承認TODOを除外");
  expect({ children: [question({ isProposed: true, actions: [action(status)] })] }, "under_review", "未承認の子を除外");
}
expect({ children: [question({ status: "answered" })] }, "decidable", "子の完了で判断待ち");
expect({ children: [question({ status: "answered" }), question()] }, "under_review", "allはすべて必要");
expect({ children: [question({ status: "dropped" }), question()] }, "dead_branch", "必須条件の中止は要見直し");
expect({ childrenLogic: "any", children: [question({ status: "dropped" }), question()] }, "under_review", "選択肢が残れば要見直しにしない");
expect({ childrenLogic: "any", children: [question({ status: "dropped" })] }, "dead_branch", "全選択肢の中止");
const blocked = question({ actions: [action("blocked")] });
const running = question({ actions: [action("running")] });
expect({ children: [blocked, running] }, "blocked", "allは必須の阻害を反映");
expect({ childrenLogic: "any", children: [blocked, running] }, "in_progress", "anyは進められる選択肢を優先");
expect({ childrenLogic: "any", children: [blocked] }, "blocked", "残る選択肢すべてに阻害");
expect({ childrenLogic: "any", children: [blocked, question({ status: "answered" })] }, "decidable", "成立済みのanyに別枝の阻害を波及しない");
expect({ children: [question({ status: "answered" })], actions: [action("not_started")] }, "under_review", "作業TODOが残れば判断待ちにしない");
expect({ status: "answered", actions: [action("blocked")] }, "answered", "本人が記録した完了を優先");
expect({ status: "dropped", children: [blocked] }, "dropped", "本人が記録した中止を優先");
assert.deepEqual(Object.values(QUESTION_STATE_LABEL).sort(), ["判断待ち", "検討中", "対応待ち", "要見直し", "進行中", "完了", "中止"].sort());
console.log(`question tree state: ${checks} scenarios passed`);
