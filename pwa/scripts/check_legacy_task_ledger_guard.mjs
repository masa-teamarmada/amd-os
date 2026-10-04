import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 旧タスク台帳（project_management_tasks）を読み取り専用にするかは、PJの設定
// projects.legacy_task_ledger_read_only で決める（全PJ共通。migration 475）。
// 以前は ZMP（p19）を関数の中に名指ししていた。PJ番号を DB の規則へ戻さない
// （2026-10-04 まさ「特定のPJだけの特例を入れたらシステムにならない」）。
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
  path.join(scriptsDir, "migrations/475_project_rules_without_pj_special_cases.sql"),
  "utf8",
);

const guardBody = migration.match(/CREATE OR REPLACE FUNCTION public\.guard_read_only_legacy_task_ledger\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
assert.ok(guardBody, "共通の書き込み guard を置く");
assert.match(guardBody, /legacy_task_ledger_read_only/, "PJの設定で決める");
assert.match(guardBody, /project_id IN \(v_old_project_id, v_new_project_id\)/, "読み取り専用のPJへの出入りを含む全mutationを止める");
assert.doesNotMatch(guardBody, /'p\d{2}'/, "PJ番号を関数に書かない");
assert.match(guardBody, /project_actions/, "エラーは現行正本を明示する");
assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE\s+ON public\.project_management_tasks/, "追加・更新・物理削除を同じ境界で止める");
assert.match(migration, /DROP FUNCTION IF EXISTS public\.guard_zmp_legacy_task_ledger\(\)/, "PJ専用の旧 guard を消す");
assert.match(migration, /UPDATE public\.projects SET legacy_task_ledger_read_only = true WHERE project_id = 'p19'/, "ZMP は設定で読み取り専用にする");

console.log("legacy task ledger guard contract OK");
