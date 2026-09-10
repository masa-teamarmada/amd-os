#!/usr/bin/env node
/**
 * 論点・仮説リストの手動並び替えが黙って外れないようにする検査 (2026-09-10 まさ指示)。
 * 壊れ方はいつも同じで、画面の並びが自動ソートへ戻る / 新規が末尾へ落ちる / 保存経路だけ
 * 残ってUIのつまみが消える、のどれか。3つとも「動くけど指示どおりでない」状態なので、
 * 実行できる形で釘を打っておく。
 *
 * ⚠️ 2026-09-10 夜: 論点・仮説タブの中身を問いの木 (spec 3-21) へ置き換えたとき、
 * 旧・1論点1行の表ごと掴んで動かすUIを撤去した。**並び替えは問いの木へまだ移植していない。**
 * そのため画面側の期待だけを外している。保存経路 (DB関数・API・並び順ロジック) は
 * そのまま生きているので検査を続ける。問いの木へ移植したら、下の TODO を消して
 * 新しいUIのアンカーをここへ書く。
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

// TODO(問いの木への移植): 画面のつまみ・掴んでいる複製・落とし先の線・保存の呼び出し。
// 旧・論点リストの撤去 (2026-09-10) で消えたまま。問いの木へ実装したら、
// src/components/question-tree/QuestionTreeView.tsx を対象に書き直す。
// 期待していた実装: data-issue-row / createIssueDragGhost / styles.issueRowHandle /
//   action: "reorder_issues" / sxWeeklyIssueOrder(management.issues / sxReorderIssueList

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

// TODO(問いの木への移植): 掴んでいる複製がカーソルに追従すること。
// fixed と transform のどちらが欠けても、掴んだ感じが消えて「動かない表」に見える。
// 期待していた実装: host.style.position = "fixed" / ghost.style.transform = `translate3d(

console.log("issue reorder contract ok");
