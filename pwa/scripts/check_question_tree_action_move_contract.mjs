#!/usr/bin/env node
/**
 * TODOの論点間移動が、見た目だけ / 保存だけ / 多対多を黙って切るだけ、のどれにも
 * 戻らないための契約検査。質問の親子移動とは保存モデルが異なる。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function expectIncludes(rel, needles) {
  const text = read(rel);
  const missing = needles.filter((needle) => !text.includes(needle));
  if (missing.length > 0) throw new Error(`${rel} に必要な実装が無い: ${missing.join(" / ")}`);
}

// 画面: 最上位TODOのつまみ、問いへのドロップ、多対多の明示選択。
expectIncludes("src/components/question-tree/QuestionTreeView.tsx", [
  'kind: "action"',
  'aria-label={`${action.title} を掴んで論点へ移す`}',
  'resource: "action_move"',
  "beginActionMove",
  "移し替える",
  "両方に残す",
  "action.questionIds.length > 1",
  'dragKind === "action" ? "action"',
]);

expectIncludes("src/components/question-tree/question-tree.module.css", [
  '.row[data-drop="action"]',
  ".moveDialog {",
]);

// API: 専用の書込経路だけを通し、質問の parent_id を流用しない。
expectIncludes("src/app/api/project/[projectId]/question-tree/route.ts", [
  'body.resource === "action_move"',
  'db.rpc("move_project_action_question_link"',
  "p_target_question_id: targetQuestionId",
  "p_mode: mode",
]);

// DB: PJ境界、開いている承認済み論点、子TODO、提案TODOの境界をDB側でも止める。
expectIncludes("../ios/supabase/migrations/20260916070000_move_goal_tree_actions.sql", [
  "move_project_action_question_link",
  "v_action_parent_id IS NOT NULL",
  "v_question_status <> 'open'",
  "v_question_review_state <> 'accepted'",
  "v_action_review_state = 'proposed'",
  "DELETE FROM public.project_question_actions",
  "INSERT INTO public.project_question_actions",
]);

console.log("question tree action move contract ok");
