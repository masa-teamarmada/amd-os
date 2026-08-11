import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("./migrations/258_workspace_security_and_otp_rate_limit.sql", import.meta.url),
  "utf8",
);
const audit = await readFile(new URL("../src/lib/workspace-access-audit.ts", import.meta.url), "utf8");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_email_otp_rate_limits/, "OTP limiter tableを作る");
assert.match(migration, /pg_advisory_xact_lock/, "同一accountのclaimをtransactionで直列化する");
assert.match(migration, /INTERVAL '60 seconds'/, "60秒cooldownを持つ");
assert.match(migration, /INTERVAL '15 minutes'/, "15分windowを持つ");
assert.match(migration, /v_limit\.send_count >= 5/, "15分5回の上限を持つ");
assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/, "claim RPCを外部roleへ公開しない");
assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*TO service_role/, "claim RPCはservice_roleだけが実行する");

assert.match(migration, /CREATE TRIGGER workspace_security_row_audit AFTER INSERT OR UPDATE OR DELETE/, "重要row変更へtransactional audit triggerを付ける");
for (const table of [
  "workspace_user_accounts",
  "institution_workspace_memberships",
  "project_access_memberships",
  "workspace_documents",
]) {
  assert.ok(migration.includes(`'${table}'`), `${table}をtransactional audit対象にする`);
}
assert.match(migration, /'table', TG_TABLE_NAME,[\s\S]*'operation', lower\(TG_OP\),[\s\S]*'row_id', v_row_id/, "監査detailはtable・operation・row idだけに絞る");
assert.doesNotMatch(migration, /v_row\s*->>\s*'email'/, "trigger監査にemailを保存しない");
assert.doesNotMatch(migration, /v_row\s*->>\s*'storage_path'/, "trigger監査にStorage pathを保存しない");
assert.doesNotMatch(migration, /COALESCE\([^)]*created_by_account_id[^)]*v_row\s*->>\s*'id'/, "内部member作成資料のdocument idを外部account idとして扱わない");

assert.match(migration, /workspace_documents_institution_workspace_id_fkey[\s\S]*ON DELETE RESTRICT/, "機関削除で資料metadataをcascade削除しない");
assert.match(migration, /workspace_documents_project_id_fkey[\s\S]*ON DELETE RESTRICT/, "PJ削除で資料metadataをcascade削除しない");
assert.match(migration, /workspace security audit trigger count is %[\s\S]*expected 4/, "migration内でaudit trigger 4本をreadbackする");
assert.match(migration, /workspace document RESTRICT foreign key count is %[\s\S]*expected 2/, "migration内でRESTRICT FK 2本をreadbackする");
assert.match(audit, /throw new Error\("workspace_audit_insert_failed"\)/, "semantic audit失敗を成功扱いしない");

console.log("workspace security migration contract: ok");
