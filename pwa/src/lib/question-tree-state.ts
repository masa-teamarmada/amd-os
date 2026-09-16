import type { ActionNode, QuestionNode, QuestionState } from "./question-tree-types";

/** 子の導出が済んでから呼ぶ。子の有無だけでは停滞も進捗も推定しない。 */
export function resolveQuestionState(node: QuestionNode): QuestionState {
  if (node.status === "answered") return "answered";
  if (node.status === "dropped") return "dropped";

  const children = node.children.filter((child) => !child.isProposed);
  const anyOf = node.childrenLogic === "any";
  if (children.length > 0) {
    const failed = anyOf
      ? children.every((child) => child.status === "dropped")
      : children.some((child) => child.status === "dropped");
    if (failed) return "dead_branch";
  }

  const actions: ActionNode[] = [];
  const collect = (items: ActionNode[]) => {
    for (const action of items) {
      if (action.isProposed) continue;
      actions.push(action);
      collect(action.children);
    }
  };
  collect(node.actions);

  const childrenSettled = anyOf
    ? children.length === 0 || children.some((child) => child.status === "answered")
    : children.every((child) => child.status === "answered");
  const pendingChildren = childrenSettled ? [] : children.filter((child) => child.status === "open");
  // any は他の選択肢を進められる限り、1枝の対応待ちを親全体へ波及させない。
  const childrenBlocked = pendingChildren.length > 0 && (anyOf
    ? pendingChildren.every((child) => child.state === "blocked" || child.state === "dead_branch")
    : pendingChildren.some((child) => child.state === "blocked" || child.state === "dead_branch"));
  if (actions.some((action) => action.status === "blocked") || childrenBlocked) return "blocked";

  const actionsSettled = actions.every((action) => action.status === "done" || action.status === "dropped");
  const hasCompletedInput = children.some((child) => child.status === "answered") || actions.some((action) => action.status === "done");
  // 空集合や中止TODOだけで「判断待ち」にしない。作業TODO・子TODOも未完了なら待つ。
  if (childrenSettled && actionsSettled && hasCompletedInput) return "decidable";
  if (actions.some((action) => action.status === "running") || pendingChildren.some((child) => child.state === "in_progress")) {
    return "in_progress";
  }
  return "under_review";
}
