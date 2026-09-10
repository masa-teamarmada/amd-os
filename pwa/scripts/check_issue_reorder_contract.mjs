#!/usr/bin/env node
/**
 * 論点・仮説リストの手動並び替えが黙って外れないようにする検査 (2026-09-10 まさ指示)。
 * 壊れ方はいつも同じで、画面の並びが自動ソートへ戻る / 新規が末尾へ落ちる / 保存経路だけ
 * 残ってUIのつまみが消える、のどれか。3つとも「動くけど指示どおりでない」状態なので、
 * 実行できる形で釘を打っておく。
 *
 * 2026-09-10 夜: 論点・仮説タブの中身を問いの木 (spec 3-21) へ置き換え、並び替えも
 * そちらへ移した。掴んで兄弟の間へ落とせば並びが変わり、行の真ん中へ落とせばその子になる
 * (まさ「親を変える場合は別の親のところにドラッグアンドドロップ」「ボタンが無駄に増えると
 * UXがどんどん悪くなる」)。旧・1論点1行の表の期待は撤去し、問いの木の期待へ差し替えた。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function expectIncludes(rel, needles) {
  const text = read(rel);
  const missing = needles.filter((needle) => !text.includes(needle));
  if (missing.length > 0)
    throw new Error(`${rel} に必要な実装が無い: ${missing.join(" / ")}`);
}

// 画面: つまむ場所、掴んでいる行の目印、落とし先の判定、保存の呼び出し。
expectIncludes("src/components/question-tree/QuestionTreeView.tsx", [
  "data-question-row={node.id}",
  "createDragGhost",
  "styles.grip",
  'resource: "question_move"',
  "resolveDrop",
  "applyMove",
]);

// 落とし先の見せ方: 兄弟として挿すときは線、子にするときは枠。どちらが欠けても
// 「どこへ入るのか分からないまま落とす」ことになる。
expectIncludes("src/components/question-tree/question-tree.module.css", [
  '.row[data-drop="before"]',
  '.row[data-drop="after"]',
  '.row[data-drop="inside"]',
  ".grip {",
]);

// 保存経路: 並び替えと親の付け替えを1回のDB関数で確定する。
expectIncludes("src/app/api/project/[projectId]/question-tree/route.ts", [
  'body.resource === "question_move"',
  'db.rpc("reorder_project_questions"',
  "p_ordered_ids: orderedIds",
]);

// 並び順そのもの: 第一キーが手動の sort_order であること。
expectIncludes("src/lib/sx-weekly-control.ts", [
  "export function sxWeeklyIssueOrder",
  "left.sortOrder - right.sortOrder ||",
  "export function sxReorderIssueList",
]);

// 型と読み出し: sort_order を bundle まで運ぶ。
expectIncludes("src/lib/sx-management.ts", [
  "sortOrder: number;",
  'sortOrder: numberValue(row, "sort_order")',
]);

// API: 一括保存のRPCと、新規論点を先頭へ入れる採番。
expectIncludes("src/app/api/project-workspace/[projectId]/management/route.ts", [
  'body.action === "reorder_issues"',
  "reorder_project_management_issues",
  'if (resource === "issue") {',
  "payload.sort_order = topIssue",
]);

// 掴んでいる複製はカーソルに追従する。fixed と transform のどちらが欠けても、
// 掴んだ感じが消えて「動かない一覧」に見える。
const view = read("src/components/question-tree/QuestionTreeView.tsx");
for (const needle of ['host.style.position = "fixed"', "style.transform = `translate3d("])
  if (!view.includes(needle))
    throw new Error(`掴んでいる複製がカーソルへ追従しない: ${needle}`);

console.log("issue reorder contract ok");
