import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { type ChangeHistoryRow, summaryForRow, groupHistoryRows, tableLabel, fieldLabel, displayFieldValue, targetLabel, actorLabel } from "../src/lib/change-history-presentation.ts";
import { enrichChangeHistory } from "../src/lib/change-history-context.ts";
import { checkMigration } from "./check_change_history_catalog.mjs";

const row = (patch: Partial<ChangeHistoryRow> = {}): ChangeHistoryRow => ({
  id: "history-1", occurred_at: "2026-11-05T01:15:24Z", table_name: "boss_notification_jobs", operation: "update",
  record_pk: { id: "00000000-0000-0000-0000-000000000001" }, actor_id: null, actor_label: "OS自動処理", actor_source: "service_role",
  changed_fields: ["completed_at", "status"], before_values: { completed_at: null, status: "pending" },
  after_values: { completed_at: "2026-11-05T01:15:24Z", status: "cancelled" }, transaction_id: 1,
  undo_supported: false, undo_block_reason: null, undo_of_history_id: null, undone_by_history_id: null, undone_at: null, ...patch,
});
const summary = summaryForRow(row());
assert.match(summary, /ボス出現の通知予約.*状態: 待機中 → 中止/);
assert.doesNotMatch(summary, /boss_|pending|completed_at|00000000/);
const batch = groupHistoryRows([row(), row({ id: "history-2", transaction_id: 2 })]);
assert.equal(batch.length, 1);
assert.match(batch[0].summary, /2件変更.*状態: 待機中 → 中止/);
const mixed = groupHistoryRows([row(), row({ id: "history-2", after_values: { status: "failed" }, changed_fields: ["status"] })]);
assert.match(mixed[0].summary, /中止.*失敗/);
assert.equal(groupHistoryRows([row({ actor_id: "a" }), row({ actor_id: "b" })]).length, 2, "表示名が同じ別実行者を混ぜない");
assert.equal(tableLabel("disclosure_erasure"), "情報削除の記録");
assert.equal(fieldLabel("published_publication_id"), "公開した版");
assert.doesNotMatch(tableLabel("unknown_table"), /unknown_table/);
assert.doesNotMatch(fieldLabel("unknown_column"), /unknown_column/);
assert.equal(displayFieldValue("progress_pct", 35), "35%");
assert.equal(displayFieldValue("title", "pending"), "pending", "名称や本文を状態値として翻訳しない");
assert.equal(displayFieldValue("next_spawn_at", "2026-11-04T13:46:00Z"), "2026/11/04 22:46:00");
assert.equal(actorLabel(row({ actor_label: "abc@accounts.l2m.invalid" })), "ボス管理の利用者（名前未取得）");
assert.match(targetLabel(row({ record_context: { after: { title: "変更時の対象" } } })), /変更時の対象/);
assert.throws(() => checkMigration("CREATE TABLE public.unregistered_history_test (id uuid);"), /表示名/);
assert.throws(() => checkMigration("ALTER TABLE public.projects ADD COLUMN unknown_history_test text;"), /項目名/);

// 実際のID参照関係を通し、画面へIDを返さず名称・日時を返せることを検証する。
const fixtures: Record<string, Array<Record<string, unknown>>> = {
  server_bosses: [{ id: "boss-setting", game_server_id: "server", boss_id: "boss", report_revision: 37 }],
  game_servers: [{ id: "server", display_name: "確認用サーバー" }],
  boss_catalog: [{ id: "boss", display_name: "確認用ボス" }],
  boss_schedules: [{ server_boss_id: "boss-setting", game_server_id: "server", accepted_report_id: "report-new", next_spawn_at: "2026-11-04T13:46:00Z" }],
  boss_reports: [{ id: "report-old", server_boss_id: "boss-setting", game_server_id: "server", killed_at: "2026-10-31T12:27:00Z" }, { id: "report-new", server_boss_id: "boss-setting", game_server_id: "server", killed_at: "2026-11-04T13:46:00Z" }],
  project_management_tasks: [{ id: "task", title: "現在の名称", project_id: "p00" }],
  projects: [{ project_id: "p00", project_name: "全社" }],
  l2m_boss_pin_accounts: [{ user_id: "00000000-0000-0000-0000-000000000002", username: "確認用利用者" }],
};
let calls = 0;
const db = { from(table: string) {
  calls++;
  let result = fixtures[table] ?? [];
  const query = {
    select() { return query; },
    in(field: string, values: unknown[]) { result = result.filter((v) => values.includes(v[field])); return query; },
    limit() { return Promise.resolve({ data: result, error: null }); },
    then(resolve: (v: { data: typeof result; error: null }) => unknown) { return Promise.resolve({ data: result, error: null }).then(resolve); },
  };
  return query;
} } as unknown as Parameters<typeof enrichChangeHistory>[0];
const result = await enrichChangeHistory(db, [
  row({ table_name: "server_bosses", record_pk: { id: "boss-setting" }, changed_fields: ["report_revision"], before_values: { report_revision: 36 }, after_values: { report_revision: 37 }, actor_id: "00000000-0000-0000-0000-000000000002" }),
  row({ id: "schedule", table_name: "boss_schedules", record_pk: { server_boss_id: "boss-setting" }, changed_fields: ["accepted_report_id", "next_spawn_at", "revision"], before_values: { accepted_report_id: "report-old", next_spawn_at: "2026-10-31T12:27:00Z", revision: 36 }, after_values: { accepted_report_id: "report-new", next_spawn_at: "2026-11-04T13:46:00Z", revision: 37 } }),
  row({ id: "task", table_name: "project_management_tasks", record_pk: { id: "task" }, changed_fields: ["status"], before_values: { status: "open" }, after_values: { status: "done" }, record_context: { before: { title: "保存された名称" }, after: { title: "保存された名称" } } }),
  row({ id: "deleted", table_name: "project_management_tasks", operation: "delete", record_pk: { id: "removed-task" }, before_values: { title: "削除した対象", status: "done" }, after_values: {} }),
]);
assert.match(result[0].entity_label ?? "", /確認用サーバー.*確認用ボス/);
assert.equal(result[0].actor_display_label, "確認用利用者");
assert.match(summaryForRow(result[0]), /討伐報告の更新回数: 36 → 37/);
assert.match(result[1].reference_labels?.["accepted_report_id:report-old"] ?? "", /2026\/10\/31 21:27:00/);
assert.match(result[1].reference_labels?.["accepted_report_id:report-new"] ?? "", /2026\/11\/04 22:46:00/);
assert.equal(result[2].entity_label, "保存された名称", "現在の名前で過去の対象名を上書きしない");
assert.equal(result[2].entity_label_source, "recorded");
assert.match(summaryForRow(result[3]), /削除した対象.*削除/);
assert.ok(calls < 20, "参照先をまとめて読み、履歴の行数分は問い合わせない");
const ui = readFileSync(new URL("../src/components/admin/AdminChangeHistoryClient.tsx", import.meta.url), "utf8");
assert.doesNotMatch(ui, /fields\.slice\(0,\s*8\)/, "9項目目以降も詳細で確認できる");
assert.match(ui, /記録情報/);
assert.match(ui, /変更項目[\s\S]*変更前[\s\S]*変更後/);
console.log("change history readability: screenshot cases, grouping, references, snapshots, unknown fields, and future DDL passed");
