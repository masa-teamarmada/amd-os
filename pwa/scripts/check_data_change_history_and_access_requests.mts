import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { workspaceAccessRequestTarget } from "../src/lib/workspace-access-request-core.ts";
import { groupHistoryRows, summaryForRow } from "../src/lib/change-history-presentation.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pwaRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(pwaRoot, "..");

const [migration, emailStart, slackInteractive, historyApi, historyUi, accessUi] = await Promise.all([
  readFile(path.join(repoRoot, "ios/supabase/migrations/20260916223000_os_data_change_history_and_workspace_access_requests.sql"), "utf8"),
  readFile(path.join(pwaRoot, "src/app/api/auth/email-start/route.ts"), "utf8"),
  readFile(path.join(pwaRoot, "src/app/api/slack/interactive/route.ts"), "utf8"),
  readFile(path.join(pwaRoot, "src/app/api/admin/change-history/route.ts"), "utf8"),
  readFile(path.join(pwaRoot, "src/components/admin/AdminChangeHistoryClient.tsx"), "utf8"),
  readFile(path.join(pwaRoot, "src/components/admin/WorkspaceAccessAdminPanel.tsx"), "utf8"),
]);

assert.deepEqual(workspaceAccessRequestTarget("/workspace/ehime"), {
  targetKind: "institution",
  workspaceSlug: "ehime",
  projectId: null,
  requestedPath: "/workspace/ehime",
});
assert.deepEqual(workspaceAccessRequestTarget("/workspace/ehime/project/p30?tab=work"), {
  targetKind: "project",
  workspaceSlug: "ehime",
  projectId: "p30",
  requestedPath: "/workspace/ehime/project/p30?tab=work",
});
assert.deepEqual(workspaceAccessRequestTarget("/project/p21/workspace"), {
  targetKind: "project",
  workspaceSlug: null,
  projectId: "p21",
  requestedPath: "/project/p21/workspace",
});
assert.equal(workspaceAccessRequestTarget("/workspaces").targetKind, "unspecified");

const presentationRow = (id: string, transaction_id: number, record_pk: Record<string, unknown> = { task_id: id }) => ({
  id, occurred_at: "2026-09-17T00:00:00.000Z", table_name: "project_management_tasks", operation: "update" as const,
  record_pk, actor_id: "member-1", actor_label: "まさ", actor_source: "user", changed_fields: ["status"],
  before_values: { project_id: "p19", status: "tentative" }, after_values: { project_id: "p19", status: "confirmed" },
  undo_supported: true, undo_block_reason: null, undo_of_history_id: null, undone_by_history_id: null, undone_at: null, transaction_id,
});
assert.match(summaryForRow(presentationRow("task-1", 10)), /p19.*状態: 仮 → 確定/, "履歴要約を人が読める値へ変換する");
const batch = groupHistoryRows([presentationRow("task-1", 10), { ...presentationRow("task-2", 10), after_values: { project_id: "p20", status: "confirmed" }, before_values: { project_id: "p20", status: "tentative" } }]);
assert.equal(batch.length, 2, "異なるPJ対象は同一transactionでも混ぜない");
const sameProjectBatch = groupHistoryRows([presentationRow("task-1", 10), presentationRow("task-2", 10)]);
assert.equal(sameProjectBatch.length, 1, "同一PJ・transactionの本体行はbatch表示にまとめる");
assert.match(sameProjectBatch[0].summary, /2件変更/, "batch件数を要約へ出す");
assert.equal(groupHistoryRows([presentationRow("task-1", 10), presentationRow("task-1b", 11)]).length, 2, "異なるtransactionは混ぜない");
assert.equal(groupHistoryRows([presentationRow("task-1", 10), { ...presentationRow("task-2", 10), operation: "insert" }]).length, 2, "異なる操作は混ぜない");
const automaticBatch = groupHistoryRows([
  { ...presentationRow("auto-1", 21), actor_label: "OS自動処理", actor_source: "service_role", occurred_at: "2026-09-17T00:00:01.100Z" },
  { ...presentationRow("auto-2", 22), actor_label: "OS自動処理", actor_source: "service_role", occurred_at: "2026-09-17T00:00:00.600Z", operation: "insert" as const },
]);
assert.equal(automaticBatch.length, 1, "連続するOS自動処理はtransactionをまたいでも1操作へ集約する");
assert.match(automaticBatch[0].summary, /一括処理（追加1・変更1）/, "自動batchの追加・変更内訳を出す");
assert.equal(groupHistoryRows([
  { ...presentationRow("auto-1", 21), actor_label: "OS自動処理", actor_source: "service_role", occurred_at: "2026-09-17T00:00:03.000Z" },
  { ...presentationRow("auto-2", 22), actor_label: "OS自動処理", actor_source: "service_role", occurred_at: "2026-09-17T00:00:00.000Z" },
]).length, 2, "時間が離れた自動処理は混ぜない");
assert.match(summaryForRow({ ...presentationRow("task-1", 12), operation: "insert", after_values: { project_id: "p19", title: "新しいタスク" } }), /PJタスク「新しいタスク」を追加/, "追加対象の識別名を要約する");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.amd_os_data_change_history/, "全体変更履歴tableを作る");
assert.match(migration, /AFTER INSERT OR UPDATE OR DELETE/, "insert update deleteをDB triggerで記録する");
assert.match(migration, /v_before_raw -> key\) IS DISTINCT FROM \(v_after_raw -> key/, "updateは実差分だけを記録する");
assert.match(migration, /amd_os_sanitize_history_values/, "秘密値と大きい値を監査前に整形する");
assert.match(migration, /undo_supported BOOLEAN/, "戻し可否を履歴へ保存する");
assert.match(migration, /CASE WHEN v_undo_supported THEN v_undo_before ELSE NULL END/, "安全な逆操作payloadだけ保存する");
assert.match(migration, /RETURN OLD;[\s\S]*RETURN NEW;/, "triggerのinsert/update/delete returnを明示する");
assert.match(migration, /AND NOT c\.relispartition/, "partition childへ重複triggerを張らない");
for (const secretTable of [
  "freee_oauth_tokens",
  "member_google_oauth_tokens",
  "member_microsoft_oauth_tokens",
  "microsoft_oauth_states",
]) {
  assert.ok(migration.includes(`'${secretTable}'`), `${secretTable}を全体監査の値複製から除外する`);
}
assert.match(migration, /amd_os_data_change_history is append-only/, "変更履歴のupdate deleteを拒否する");
assert.match(migration, /USING \(public\.is_admin\(\)\)/, "変更履歴と要求台帳はadminだけが読む");
assert.match(migration, /amd_os_undo_data_change/, "履歴から逆操作するtransactional RPCを作る");
assert.match(migration, /現在値が履歴の変更後と一致しない/, "optimistic conflict時は戻さない");
assert.match(migration, /amd_os\.undo_of_history_id/, "戻し操作を元履歴へリンクする");
assert.match(migration, /自動採番IDを安全に復元できないため戻せない/, "identity always行の削除は安全側で戻さない");
assert.match(historyApi, /export async function POST/, "変更履歴APIから戻し操作を受ける");
assert.match(historyApi, /action !== "undo"/, "戻し操作を明示actionに限定する");
assert.match(historyApi, /neq\("table_name", "project_management_field_audit"\)/, "二重監査行で本体履歴のページを埋めない");
assert.match(historyApi, /PAGE_SIZE = 1000/, "同じ自動処理を狭いraw pageで分断しない");
assert.match(historyApi, /from\("projects"\)/, "PJの表示名を台帳へ解決する");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.workspace_access_requests/, "アクセス要求tableを作る");
assert.match(migration, /workspace_claim_access_request_notification/, "Slack通知をatomic claimする");
assert.match(migration, /INTERVAL '30 minutes'/, "同じ要求の通知を30分抑止する");
assert.match(migration, /v_recent_count >= 20/, "Slack通知を1時間20件で抑止する");
assert.match(migration, /workspace_decide_access_request/, "承認拒否をDB transactionで決定する");
assert.match(migration, /role,[\s\S]*status[\s\S]*'readonly',[\s\S]*'invited'/, "承認は閲覧のみ・招待中の最小権限にする");
assert.match(migration, /v_account\.status = 'suspended'/, "停止accountを自動復活しない");
assert.match(migration, /v_membership\.status IN \('suspended', 'revoked'\)/, "停止grantを自動復活しない");

assert.match(emailStart, /workspace_register_access_request/, "未許可アクセスを要求台帳へ登録する");
assert.match(emailStart, /after\(\(\) => notifyWorkspaceAccessRequest/, "応答後にSlack DMを送る");
const unknownAudit = emailStart.match(/if \(!account\) \{[\s\S]*?recordWorkspaceAuditEvent[\s\S]*?\n\s*\}\);/i)?.[0] ?? "";
assert.doesNotMatch(unknownAudit, /email:\s*(rawEmail|normalizedEmail)/, "未登録emailを一般アクセス監査へ入れない");
assert.match(slackInteractive, /workspace_access_approve/, "Slack許可ボタンを処理する");
assert.match(slackInteractive, /workspace_access_reject/, "Slack拒否ボタンを処理する");
assert.match(slackInteractive, /actor\?\.memberId !== "ID001"/, "Slack決定を通知先のまさ本人に限定する");

assert.match(historyApi, /requireAdmin\(\)/, "変更履歴APIをadmin認証する");
assert.match(historyApi, /amd_os_data_change_history/, "変更履歴APIは全体監査正本を読む");
assert.match(historyUi, /元の差分/, "画面で履歴の意味を明示する");
assert.match(historyUi, /groupHistoryRows/, "履歴を安全な単位へ集約する");
assert.match(historyUi, /詳細を展開/, "生IDと全差分を詳細へ折りたたむ");
assert.match(historyUi, /aria-expanded/, "詳細の開閉状態をアクセシブルに管理する");
assert.match(historyUi, /このページ.*操作.*対象/, "件数を人向けの文言で表示する");
assert.match(historyUi, /row\.before_values\[field\]/, "変更前を表示する");
assert.match(historyUi, /row\.after_values\[field\]/, "変更後を表示する");
assert.match(historyUi, /この変更を戻す/, "履歴行から戻し操作を実行できる");
assert.match(historyUi, /現在値が履歴の変更後と一致する場合だけ/, "戻し操作の確認で安全条件を明示する");
assert.match(historyUi, /戻し済み/, "戻し済み履歴を表示する");
assert.match(historyApi, /undo_of_history_id/, "元履歴に戻し済みリンクを付ける");
assert.match(historyApi, /undone_by_history_id/, "一覧で元履歴の戻し済み状態を判定する");
assert.match(accessUi, /承認待ちのアクセス要求/, "外部アクセス画面に承認待ちを出す");
assert.match(accessUi, /閲覧を許可/, "admin画面から最小権限で許可できる");

console.log("data change history and workspace access requests: ok");
