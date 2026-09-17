import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptsDir, "..", "..");
const migration = readFileSync(
  path.join(repoDir, "ios/supabase/migrations/20260917093000_zmp_legacy_task_ledger_read_only.sql"),
  "utf8",
);

assert.match(migration, /guard_zmp_legacy_task_ledger/, "ZMP旧タスク台帳の書き込みguardを置く");
assert.match(
  migration,
  /v_old_project_id = 'p19' OR v_new_project_id = 'p19'/,
  "p19への出入りを含む全mutationを止める",
);
assert.match(
  migration,
  /project_actions; project_management_tasks is read-only history/,
  "エラーは現行正本を明示する",
);
assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE/, "追加・更新・物理削除を同じ境界で止める");
assert.doesNotMatch(migration, /project_id\s*<>\s*'p19'/, "p19以外を誤って拒否する条件を持たない");

console.log("ZMP legacy task guard contract OK");
