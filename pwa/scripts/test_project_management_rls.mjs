import fs from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const env = loadEnv(".env.local");
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "";
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const ref = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1];
if (!accessToken || !ref) throw new Error("SUPABASE_ACCESS_TOKEN / NEXT_PUBLIC_SUPABASE_URL が必要だよ");

const managementApi = `https://api.supabase.com/v1/projects/${ref}/database/query`;
async function query(sql) {
  const response = await fetch(managementApi, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "amd-os-project-management-rls-test/1.0",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Management API ${response.status}: ${body}`);
  return body ? JSON.parse(body) : [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const softDeleteTables = [
  "project_management_objectives",
  "project_management_outcomes",
  "project_management_milestones",
  "project_management_kpis",
  "project_management_milestone_dependencies",
  "project_management_issues",
  "project_management_hypotheses",
  "project_management_evidence",
  "project_management_validation_runs",
  "project_management_decisions",
  "project_management_action_items",
  "project_management_update_history",
  "project_management_partners",
  "project_management_partner_tracks",
  "project_management_partner_commitments",
  "project_management_raci",
  "project_management_capacity",
  "project_management_technical_tests",
  "project_management_funding_snapshots",
  "project_management_organization_roles",
  "project_management_partner_interactions",
  "project_management_partner_roles",
  "project_management_partner_work_items",
  "project_management_tasks",
];

const policyRows = await query(`
  SELECT tablename, policyname, qual::text AS qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename LIKE 'project_management_%'
    AND policyname LIKE '%_member_select'
`);
const policyMap = new Map(policyRows.map((row) => [row.tablename, row]));
for (const table of softDeleteTables) {
  const policy = policyMap.get(table);
  assert(policy, `${table} のmember_selectがないよ`);
  assert(/deleted_at\s+IS\s+NULL/i.test(policy.qual || ""), `${table} のmember_selectにdeleted_at IS NULLがないよ`);
}

const triggers = await query(`
  SELECT tgname
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgname IN (
      'project_management_dependency_guard',
      'project_management_milestone_dependencies_block_delete',
      'project_management_partner_interactions_block_delete',
      'project_management_partner_interactions_parent_project_guard',
      'project_management_partner_interactions_field_audit',
      'project_management_partner_interactions_touch_updated_at',
      'project_management_partner_roles_block_delete',
      'project_management_partner_roles_parent_project_guard',
      'project_management_partner_roles_field_audit',
      'project_management_partner_roles_touch_updated_at',
      'project_management_partner_work_items_block_delete',
      'project_management_partner_work_items_parent_project_guard',
      'project_management_partner_work_items_field_audit',
      'project_management_partner_work_items_touch_updated_at',
      'project_management_tasks_guard',
      'project_management_tasks_block_delete',
      'project_management_tasks_field_audit',
      'project_management_tasks_touch_updated_at'
    )
`);
const triggerNames = new Set(triggers.map((row) => row.tgname));
assert(triggerNames.has("project_management_dependency_guard"), "依存DAGのDBトリガーがないよ");
assert(triggerNames.has("project_management_milestone_dependencies_block_delete"), "依存表の認証済みDELETE防止トリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_block_delete"), "やり取り履歴表の認証済みDELETE防止トリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_parent_project_guard"), "やり取り履歴表の親PJ guardトリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_field_audit"), "やり取り履歴表のfield auditトリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_touch_updated_at"), "やり取り履歴表のtouch updated_atトリガーがないよ");
for (const table of ["project_management_partner_roles", "project_management_partner_work_items"]) {
  assert(triggerNames.has(`${table}_block_delete`), `${table}の認証済みDELETE防止トリガーがないよ`);
  assert(triggerNames.has(`${table}_parent_project_guard`), `${table}の親PJ guardトリガーがないよ`);
  assert(triggerNames.has(`${table}_field_audit`), `${table}のfield auditトリガーがないよ`);
  assert(triggerNames.has(`${table}_touch_updated_at`), `${table}のtouch updated_atトリガーがないよ`);
}
assert(triggerNames.has("project_management_tasks_guard"), "タスク表の同一PJ・親子循環guardトリガーがないよ");
assert(triggerNames.has("project_management_tasks_block_delete"), "タスク表の認証済みDELETE防止トリガーがないよ");
assert(triggerNames.has("project_management_tasks_field_audit"), "タスク表のfield auditトリガーがないよ");
assert(triggerNames.has("project_management_tasks_touch_updated_at"), "タスク表のtouch updated_atトリガーがないよ");

const contractRows = await query(`
  SELECT conname, pg_get_constraintdef(oid)::text AS definition
  FROM pg_constraint
  WHERE conname IN (
    'project_management_issues_knowledge_type_check_184',
    'project_management_partner_commitments_kind_check_184',
    'project_management_partner_commitments_promise_requirements_184',
    'project_management_decisions_decided_requirements_185',
    'project_management_partner_commitments_sx_followup_requirements',
    'project_management_partners_ball_side_check_191',
    'project_management_partners_due_precision_check_191',
    'project_management_partners_due_date_consistency_191',
    'project_management_partner_interactions_date_consistency_191',
    'project_management_partner_interactions_actor_side_check_192',
    'project_management_partner_work_items_due_date_consistency_192',
    'project_management_partner_roles_source_kind_check_192',
    'pm_partner_work_items_completion_check_192',
    'pm_partner_work_items_acceptance_check_192'
  )
`);
const contractNames = new Set(contractRows.map((row) => row.conname));
assert(contractNames.has("project_management_issues_knowledge_type_check_184"), "意思決定待ち分類のDB CHECKがないよ");
assert(contractNames.has("project_management_partner_commitments_kind_check_184"), "約束種類のDB CHECKがないよ");
assert(contractNames.has("project_management_partner_commitments_promise_requirements_184"), "相手の約束必須条件のDB CHECKがないよ");
assert(contractNames.has("project_management_decisions_decided_requirements_185"), "決定済みの必須条件DB CHECKがないよ");
assert(contractNames.has("project_management_partner_commitments_sx_followup_requirements"), "SX側の次アクション必須条件DB CHECKがないよ");
assert(contractNames.has("project_management_partners_ball_side_check_191"), "現在ボール側のDB CHECKがないよ");
assert(contractNames.has("project_management_partners_due_precision_check_191"), "期限精度のDB CHECKがないよ");
assert(contractNames.has("project_management_partners_due_date_consistency_191"), "期限精度と期限日の整合DB CHECKがないよ");
assert(contractNames.has("project_management_partner_interactions_date_consistency_191"), "発生日精度と発生日の整合DB CHECKがないよ");
assert(contractNames.has("project_management_partner_interactions_actor_side_check_192"), "行為主体側のDB CHECKがないよ");
assert(contractNames.has("project_management_partner_work_items_due_date_consistency_192"), "保有事項の期限精度整合DB CHECKがないよ");
const ballSideGuard = contractRows.find((row) => row.conname === "project_management_partners_ball_side_check_191")?.definition || "";
const duePrecisionGuard = contractRows.find((row) => row.conname === "project_management_partners_due_precision_check_191")?.definition || "";
assert(/'sx'/.test(ballSideGuard) && /'partner'/.test(ballSideGuard) && /'shared'/.test(ballSideGuard) && /'none'/.test(ballSideGuard) && /'unknown'/.test(ballSideGuard), "現在ボール側CHECKの許容値が不足しているよ");
assert(/'day'/.test(duePrecisionGuard) && /'month'/.test(duePrecisionGuard) && /'unknown'/.test(duePrecisionGuard), "期限精度CHECKの許容値が不足しているよ");
const dueDateConsistencyGuard = contractRows.find((row) => row.conname === "project_management_partners_due_date_consistency_191")?.definition || "";
const occurredOnConsistencyGuard = contractRows.find((row) => row.conname === "project_management_partner_interactions_date_consistency_191")?.definition || "";
assert(/due_date_precision/.test(dueDateConsistencyGuard) && /due_date/.test(dueDateConsistencyGuard) && /IS NULL/.test(dueDateConsistencyGuard) && /IS NOT NULL/.test(dueDateConsistencyGuard), "期限精度と期限日の整合CHECKの条件が不足しているよ");
assert(/occurred_on_precision/.test(occurredOnConsistencyGuard) && /occurred_on/.test(occurredOnConsistencyGuard) && /IS NULL/.test(occurredOnConsistencyGuard) && /IS NOT NULL/.test(occurredOnConsistencyGuard), "発生日精度と発生日の整合CHECKの条件が不足しているよ");
const actorSideGuard = contractRows.find((row) => row.conname === "project_management_partner_interactions_actor_side_check_192")?.definition || "";
assert(/'sx'/.test(actorSideGuard) && /'partner'/.test(actorSideGuard) && /'shared'/.test(actorSideGuard) && /'unknown'/.test(actorSideGuard), "行為主体側CHECKの許容値が不足しているよ");
const workItemDueGuard = contractRows.find((row) => row.conname === "project_management_partner_work_items_due_date_consistency_192")?.definition || "";
assert(/due_date_precision/.test(workItemDueGuard) && /due_date/.test(workItemDueGuard) && /IS NULL/.test(workItemDueGuard) && /IS NOT NULL/.test(workItemDueGuard), "保有事項の期限精度整合CHECKの条件が不足しているよ");
assert(contractNames.has("project_management_partner_roles_source_kind_check_192"), "分類のsource_kind DB CHECKがないよ");
const roleSourceKindGuard = contractRows.find((row) => row.conname === "project_management_partner_roles_source_kind_check_192")?.definition || "";
assert(/'current_truth'/.test(roleSourceKindGuard) && /'manual'/.test(roleSourceKindGuard) && /'imported'/.test(roleSourceKindGuard), "分類のsource_kind CHECKの許容値が不足しているよ");
assert(contractNames.has("pm_partner_work_items_completion_check_192"), "保有事項の完了必須条件DB CHECKがないよ");
const workItemCompletionGuard = contractRows.find((row) => row.conname === "pm_partner_work_items_completion_check_192")?.definition || "";
assert(/completion_criteria/.test(workItemCompletionGuard) && /completion_evidence/.test(workItemCompletionGuard) && /completed_on/.test(workItemCompletionGuard), "保有事項の完了必須条件CHECKの項目が不足しているよ");
assert(contractNames.has("pm_partner_work_items_acceptance_check_192"), "成果物の受入必須条件DB CHECKがないよ");
const deliverableAcceptanceGuard = contractRows.find((row) => row.conname === "pm_partner_work_items_acceptance_check_192")?.definition || "";
assert(/accepted_by/.test(deliverableAcceptanceGuard) && /accepted_on/.test(deliverableAcceptanceGuard) && /deliverable/.test(deliverableAcceptanceGuard), "成果物の受入必須条件CHECKの項目が不足しているよ");

const primaryRoleIndex = await query(`
  SELECT indexdef FROM pg_indexes
  WHERE schemaname = 'public' AND indexname = 'project_management_partner_roles_one_primary_192'
`);
assert(primaryRoleIndex.length === 1, "1partnerにprimary roleが最大1つとなるDB guard(unique partial index)がないよ");
assert(/UNIQUE/i.test(primaryRoleIndex[0].indexdef) && /is_primary/.test(primaryRoleIndex[0].indexdef) && /WHERE/i.test(primaryRoleIndex[0].indexdef), "primary role guardがunique partial indexの形になっていないよ");

const roleColumns = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_management_partner_roles'
`);
const roleColumnNames = new Set(roleColumns.map((row) => row.column_name));
for (const column of ["project_id", "partner_id", "role_kind", "relationship_state", "role_label", "is_primary", "sort_order", "source_kind", "source_ref", "deleted_at", "deleted_by", "version"]) {
  assert(roleColumnNames.has(column), `project_management_partner_roles に ${column} 列がないよ`);
}

const workItemColumns = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_management_partner_work_items'
`);
const workItemColumnNames = new Set(workItemColumns.map((row) => row.column_name));
for (const column of ["project_id", "partner_id", "side", "item_kind", "title", "detail", "owner_label", "status", "due_date", "due_date_precision", "completion_criteria", "completed_on", "completion_evidence", "accepted_by", "accepted_on", "handoff_to", "related_milestone_id", "last_verified_at", "deleted_at", "deleted_by", "version"]) {
  assert(workItemColumnNames.has(column), `project_management_partner_work_items に ${column} 列がないよ`);
}

const interactionActorColumns = await query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_management_partner_interactions' AND column_name IN ('actor_side', 'actor_label')
`);
assert(interactionActorColumns.length === 2, "project_management_partner_interactions に actor_side/actor_label 列がないよ");

// Seed identity checks (migration 192): each role/work-item seed row carries
// a fixed, explicit UUID (see migrations/192 sections 4/5), and "the seed is
// applied" means that id exists — full stop, regardless of its current
// deleted_at/source_ref/title. Checking by id (not by counting rows that
// still match source_ref) is what makes this survive a user editing or
// soft-deleting a seeded row through the API.
const ROLE_SEED_IDS = [
  "110ca817-4f7c-4491-b103-6b137aa6d0a2",
  "09c7a5e1-a8be-4407-93bc-27901fe625ed",
  "38510cf1-7575-400d-8b8e-800cf2661b5a",
  "f8a0d5ae-3136-4860-a682-fe2daa935d85",
  "0a343ddb-b57b-4b4a-bc46-24cab352cc08",
  "badd7dfd-8ddd-42c8-a090-b74aa94ca60d",
];
const WORK_ITEM_SEED_IDS = [
  "8bfb7054-df7e-468d-bea5-f1aa03a7fd96",
  "5d87b67f-ec62-466c-b82d-ac9d71fe7ea1",
  "dafc6821-0db6-4a0e-91be-68998da76d70",
  "003b1c64-512d-4592-8f68-6d036108e5e4",
];

const roleSeedFound = await query(`
  SELECT id::text AS id FROM public.project_management_partner_roles
  WHERE id IN (${ROLE_SEED_IDS.map(sqlLiteral).join(", ")})
`);
assert(roleSeedFound.length === ROLE_SEED_IDS.length, `p21の協力機関に主分類roleのseed idが${ROLE_SEED_IDS.length}件揃っていないよ (見つかった: ${roleSeedFound.length}件)`);

const workItemSeedFound = await query(`
  SELECT id::text AS id FROM public.project_management_partner_work_items
  WHERE id IN (${WORK_ITEM_SEED_IDS.map(sqlLiteral).join(", ")})
`);
assert(workItemSeedFound.length === WORK_ITEM_SEED_IDS.length, `p21のダイキアクシス/SMBC保有事項seed idが${WORK_ITEM_SEED_IDS.length}件揃っていないよ (見つかった: ${workItemSeedFound.length}件)`);

// Provenance invariant (route.ts contract, 2026-07-24 P0 reversal), exercised at the DB layer: an
// ordinary edit always stamps manual provenance (source_kind='manual', source_ref='PWA共有管理画面')
// so the field-audit trail shows a human edited the row through this screen — mirrored below by the
// second UPDATE also setting source_kind/source_ref, matching what route.ts's PATCH handler now writes
// on every non-delete/non-restore PATCH (the hasSourceRef branch). soft-delete and restore are
// visibility toggles, not edits, and must leave source_kind/source_ref exactly as the ordinary edit
// left them — mirrored by the third/fourth UPDATEs never touching those columns, so the final read
// still shows the edit's stamp intact. Seed identity is the fixed id (never source_ref — see
// migrations/192 section 4 comment), so this reassignment can never cause a revival bug.
// The seed row's live source_kind/source_ref at test time is never asserted against — a prior manual
// edit through the real admin UI (or a previous provenance probe) could legitimately have already left
// it at manual/PWA共有管理画面, and asserting a specific "before" shape would then fail even though
// nothing is actually broken (false failure). Instead the first UPDATE inside this same transaction
// forces a known starting state (current_truth/rls-test-fixture) before exercising the ordinary-edit
// transition, so the probe controls its own precondition rather than depending on whatever the seed
// currently happens to be. Runs inside a transaction that always ROLLBACKs; nothing persists either way.
const provenanceProbeRoleId = ROLE_SEED_IDS[0];
const [afterRole] = await query(`
  BEGIN;
  UPDATE public.project_management_partner_roles
  SET source_kind = 'current_truth', source_ref = 'rls-test-fixture'
  WHERE id = ${sqlLiteral(provenanceProbeRoleId)};
  UPDATE public.project_management_partner_roles
  SET relationship_state = 'in_progress', role_label = 'rls-test-provenance-probe', source_kind = 'manual', source_ref = 'PWA共有管理画面'
  WHERE id = ${sqlLiteral(provenanceProbeRoleId)};
  UPDATE public.project_management_partner_roles
  SET deleted_at = now(), deleted_by = 'rls-test'
  WHERE id = ${sqlLiteral(provenanceProbeRoleId)};
  UPDATE public.project_management_partner_roles
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = ${sqlLiteral(provenanceProbeRoleId)};
  SELECT source_kind, source_ref FROM public.project_management_partner_roles WHERE id = ${sqlLiteral(provenanceProbeRoleId)};
  ROLLBACK;
`);
assert(afterRole, "provenance変化プローブの行が見つからないよ");
assert(
  afterRole.source_kind === "manual" && afterRole.source_ref === "PWA共有管理画面",
  `通常編集はsource_kind='manual'/source_ref='PWA共有管理画面'に更新し、その後のsoft-delete/復元でも変わらないはずだよ: after=${JSON.stringify(afterRole)}`,
);

// Soft-delete then migration-reapply-equivalent safety: soft-delete a seeded role, then run the
// exact same "INSERT ... WHERE NOT EXISTS (id = seed_id)" shape migrations/192 uses, and confirm
// it does not insert a duplicate or revive the row. Runs inside a transaction that always
// ROLLBACKs; the real migration file is never applied by this script.
const reapplyProbeRoleId = ROLE_SEED_IDS[1];
const reapplyRows = await query(`
  BEGIN;
  UPDATE public.project_management_partner_roles
  SET deleted_at = now(), deleted_by = 'rls-test'
  WHERE id = ${sqlLiteral(reapplyProbeRoleId)};
  INSERT INTO public.project_management_partner_roles (
    id, project_id, partner_id, role_kind, relationship_state, is_primary, source_kind, source_ref
  )
  SELECT ${sqlLiteral(reapplyProbeRoleId)}, role.project_id, role.partner_id, role.role_kind, role.relationship_state, false, 'current_truth', 'user:2026-07-24#partner-role-normalization'
  FROM public.project_management_partner_roles role
  WHERE role.id = ${sqlLiteral(reapplyProbeRoleId)}
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_partner_roles existing WHERE existing.id = ${sqlLiteral(reapplyProbeRoleId)}
  );
  SELECT count(*)::int AS observed, bool_and(deleted_at IS NOT NULL) AS still_deleted
  FROM public.project_management_partner_roles WHERE id = ${sqlLiteral(reapplyProbeRoleId)};
  ROLLBACK;
`);
assert(Number(reapplyRows[0]?.observed) === 1, `soft-delete後にmigration再適用相当のINSERTがid重複を作ってしまったよ: ${reapplyRows[0]?.observed}件`);
assert(reapplyRows[0]?.still_deleted === true, "soft-delete後にmigration再適用相当のINSERTが行を復活させてしまったよ");

// Same contract for work items too (spec P1: roleだけでなくwork-item固定id soft-delete→
// reapply-equivalentもRLS test): soft-delete a seeded work item, then run the same
// "INSERT ... WHERE NOT EXISTS (id = seed_id)" shape migrations/192 section 5 uses, and confirm no
// duplicate/revival AND that completion/related-milestone fields survive unchanged — a reapply must
// never clobber real audit data on a pre-existing id, even if it's a no-op by design. Runs inside a
// transaction that always ROLLBACKs; the real migration file is never applied by this script.
const reapplyProbeWorkItemId = WORK_ITEM_SEED_IDS[0];
const [beforeWorkItem] = await query(`
  SELECT status, due_date::text AS due_date, due_date_precision, completion_criteria, completed_on::text AS completed_on,
    completion_evidence, accepted_by, accepted_on::text AS accepted_on, handoff_to, related_milestone_id::text AS related_milestone_id
  FROM public.project_management_partner_work_items WHERE id = ${sqlLiteral(reapplyProbeWorkItemId)}
`);
const workItemReapplyRows = await query(`
  BEGIN;
  UPDATE public.project_management_partner_work_items
  SET deleted_at = now(), deleted_by = 'rls-test'
  WHERE id = ${sqlLiteral(reapplyProbeWorkItemId)};
  INSERT INTO public.project_management_partner_work_items (
    id, project_id, partner_id, side, item_kind, title, status, due_date, due_date_precision,
    completion_criteria, completed_on, completion_evidence, accepted_by, accepted_on, handoff_to,
    related_milestone_id, last_verified_at, source_kind, source_ref
  )
  SELECT ${sqlLiteral(reapplyProbeWorkItemId)}, wi.project_id, wi.partner_id, wi.side, wi.item_kind, wi.title, wi.status, wi.due_date, wi.due_date_precision,
    wi.completion_criteria, wi.completed_on, wi.completion_evidence, wi.accepted_by, wi.accepted_on, wi.handoff_to,
    wi.related_milestone_id, wi.last_verified_at, 'current_truth', 'user:2026-07-24#partner-work-items'
  FROM public.project_management_partner_work_items wi
  WHERE wi.id = ${sqlLiteral(reapplyProbeWorkItemId)}
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_partner_work_items existing WHERE existing.id = ${sqlLiteral(reapplyProbeWorkItemId)}
  );
  SELECT count(*)::int AS observed, bool_and(deleted_at IS NOT NULL) AS still_deleted,
    max(status) AS status, max(due_date::text) AS due_date, max(due_date_precision) AS due_date_precision,
    max(completion_criteria) AS completion_criteria, max(completed_on::text) AS completed_on,
    max(completion_evidence) AS completion_evidence, max(accepted_by) AS accepted_by, max(accepted_on::text) AS accepted_on,
    max(handoff_to) AS handoff_to, max(related_milestone_id::text) AS related_milestone_id
  FROM public.project_management_partner_work_items WHERE id = ${sqlLiteral(reapplyProbeWorkItemId)};
  ROLLBACK;
`);
assert(Number(workItemReapplyRows[0]?.observed) === 1, `soft-delete後にmigration再適用相当のINSERTが保有事項のid重複を作ってしまったよ: ${workItemReapplyRows[0]?.observed}件`);
assert(workItemReapplyRows[0]?.still_deleted === true, "soft-delete後にmigration再適用相当のINSERTが保有事項行を復活させてしまったよ");
const afterWorkItem = workItemReapplyRows[0];
assert(
  beforeWorkItem.status === afterWorkItem.status &&
  beforeWorkItem.due_date === afterWorkItem.due_date &&
  beforeWorkItem.due_date_precision === afterWorkItem.due_date_precision &&
  beforeWorkItem.completion_criteria === afterWorkItem.completion_criteria &&
  beforeWorkItem.completed_on === afterWorkItem.completed_on &&
  beforeWorkItem.completion_evidence === afterWorkItem.completion_evidence &&
  beforeWorkItem.accepted_by === afterWorkItem.accepted_by &&
  beforeWorkItem.accepted_on === afterWorkItem.accepted_on &&
  beforeWorkItem.handoff_to === afterWorkItem.handoff_to &&
  beforeWorkItem.related_milestone_id === afterWorkItem.related_milestone_id,
  `soft-delete/再適用相当のINSERTで完了・関連ゲート情報が変わってしまったよ: before=${JSON.stringify(beforeWorkItem)} after=${JSON.stringify(afterWorkItem)}`,
);

// Mirrors migrations/192's own verification query exactly (section "3. actor_side backfill"): this
// must NOT be a fixed count(>=4) — a user is free to edit a backfilled row's summary/actor_side
// (taking it out of the "known summary, still unknown" set) or soft-delete it between test runs, and
// neither of those is a failure. The only real failure mode is a row that is still LIVE, still
// carries the known source_ref + one of the known original summaries, and STILL has
// actor_side='unknown' — meaning the migration's backfill UPDATE never actually ran against it.
const actorSideStillUnknown = await query(`
  SELECT count(*)::int AS count
  FROM public.project_management_partner_interactions i
  JOIN public.project_management_partners p ON p.id = i.partner_id
  WHERE p.project_id = 'p21'
    AND i.deleted_at IS NULL
    AND i.source_ref = 'user:2026-07-23#partner-progress'
    AND i.summary IN ('NDAを締結した', '初回面談を実施した', '試作リアクターの製作が完了した', '窓口移管方針を確認した')
    AND i.actor_side = 'unknown'
`);
assert(Number(actorSideStillUnknown[0]?.count || 0) === 0, "p21の既存やり取り履歴に行為主体backfillが効いていない行が残っているよ（live かつ既知summaryなのにactor_side=unknown）");

const augustDeliveryActor = await query(`
  SELECT actor_side
  FROM public.project_management_partner_interactions i
  JOIN public.project_management_partners p ON p.id = i.partner_id
  WHERE p.project_id = 'p21'
    AND i.source_ref = 'user:2026-07-23#partner-progress'
    AND i.summary = '2026年8月の納品予定を確認した'
  LIMIT 1
`);
if (augustDeliveryActor[0]) {
  assert(augustDeliveryActor[0].actor_side === "unknown", "2026年8月納品予定確認の行為主体はball_side_afterから推測せずunknownのままにするべきだよ");
}

// Completion CHECK constraints: a status=completed row without completion_criteria/
// completion_evidence/completed_on must be rejected at the DB layer, not just the API.
const [anyPartner] = await query(`
  SELECT id FROM public.project_management_partners WHERE project_id = 'p21' LIMIT 1
`);
if (anyPartner?.id) {
  const incompleteCompletionRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, last_verified_at, source_kind, source_ref
    )
    VALUES ('p21', ${sqlLiteral(anyPartner.id)}, 'sx', 'task', 'completion CHECK probe', 'completed', 'unknown', CURRENT_DATE, 'manual', 'rls-test');
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(incompleteCompletionRows?.error && /pm_partner_work_items_completion_check_192/.test(incompleteCompletionRows.error), "完了に完了条件・完了証跡・完了日が必須というDB CHECKが効いていないよ");

  const incompleteDeliverableRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, completion_criteria, completion_evidence, completed_on, last_verified_at, source_kind, source_ref
    )
    VALUES ('p21', ${sqlLiteral(anyPartner.id)}, 'partner', 'deliverable', 'deliverable acceptance CHECK probe', 'completed', 'unknown', '確認済み', '確認済み', CURRENT_DATE, CURRENT_DATE, 'manual', 'rls-test');
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(incompleteDeliverableRows?.error && /pm_partner_work_items_acceptance_check_192/.test(incompleteDeliverableRows.error), "成果物の完了に受入担当・受入日が必須というDB CHECKが効いていないよ");

  // btrim(...) <> '' variants: the API's optionalTextValue()/optionalText() (route.ts) already
  // collapses "" and whitespace-only input to NULL before writing, so these probes only exist to
  // confirm the DB CHECK itself rejects a blank string directly (a write path that bypasses the
  // API must not be able to fabricate a "completed" row with an empty-looking criterion).
  const blankCompletionRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, completion_criteria, completion_evidence, completed_on, last_verified_at, source_kind, source_ref
    )
    VALUES ('p21', ${sqlLiteral(anyPartner.id)}, 'sx', 'task', 'completion CHECK blank probe', 'completed', 'unknown', '   ', '確認済み', CURRENT_DATE, CURRENT_DATE, 'manual', 'rls-test');
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(blankCompletionRows?.error && /pm_partner_work_items_completion_check_192/.test(blankCompletionRows.error), "完了条件が空白文字だけのときにDB CHECKが効いていないよ (btrim要件)");

  const blankAcceptedByRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, completion_criteria, completion_evidence, completed_on, accepted_by, accepted_on, last_verified_at, source_kind, source_ref
    )
    VALUES ('p21', ${sqlLiteral(anyPartner.id)}, 'partner', 'deliverable', 'deliverable acceptance CHECK blank probe', 'completed', 'unknown', '確認済み', '確認済み', CURRENT_DATE, '   ', CURRENT_DATE, CURRENT_DATE, 'manual', 'rls-test');
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(blankAcceptedByRows?.error && /pm_partner_work_items_acceptance_check_192/.test(blankAcceptedByRows.error), "受入担当が空白文字だけのときにDB CHECKが効いていないよ (btrim要件)");

  // Positive path: a genuinely complete deliverable (non-blank criteria/evidence/accepted_by,
  // all dates set) must still be accepted by both CHECKs — the btrim tightening above must not
  // reject legitimate completions.
  const validCompletionRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, completion_criteria, completion_evidence, completed_on, accepted_by, accepted_on, last_verified_at, source_kind, source_ref
    )
    VALUES ('p21', ${sqlLiteral(anyPartner.id)}, 'partner', 'deliverable', 'deliverable acceptance CHECK positive probe', 'completed', 'unknown', '確認済み', '確認済み', CURRENT_DATE, 'まさ', CURRENT_DATE, CURRENT_DATE, 'manual', 'rls-test')
    RETURNING id;
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(!validCompletionRows?.error, `正当な完了行がCHECKで拒否されてしまったよ: ${validCompletionRows?.error}`);
}

const interactionColumns = await query(`
  SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_management_partner_interactions'
`);
const interactionColumnNames = new Set(interactionColumns.map((row) => row.column_name));
for (const column of ["interaction_kind", "occurred_on", "occurred_on_precision", "summary", "outcome_summary", "ball_side_after", "ball_owner_after", "deleted_at", "deleted_by", "version"]) {
  assert(interactionColumnNames.has(column), `project_management_partner_interactions に ${column} 列がないよ`);
}
const decidedGuard = contractRows.find((row) => row.conname === "project_management_decisions_decided_requirements_185")?.definition || "";
const sxFollowupGuard = contractRows.find((row) => row.conname === "project_management_partner_commitments_sx_followup_requirements")?.definition || "";
assert(/decision_state/.test(decidedGuard) && /decision_text/.test(decidedGuard) && /decided_by/.test(decidedGuard) && /decided_on/.test(decidedGuard), "決定済みCHECKの必須項目が不足しているよ");
assert(/commitment_kind/.test(sxFollowupGuard) && /sx_owner/.test(sxFollowupGuard) && /due_date/.test(sxFollowupGuard) && /next_review_on/.test(sxFollowupGuard), "SX側の次アクションCHECKの必須項目が不足しているよ");

const correctedHistory = await query(`
  SELECT count(*)::int AS count
  FROM public.project_management_update_history h
  JOIN public.project_management_issues i ON i.id = h.entity_id
  WHERE h.project_id = 'p21'
    AND h.entity_type = 'issue'
    AND h.update_kind = 'corrective_classification'
    AND i.slug IN ('trl5-gate', 'newco-governance')
    AND h.from_status = 'decision'
    AND h.to_status = 'decision_needed'
`);
assert(Number(correctedHistory[0]?.count || 0) >= 2, "意思決定待ちへの補正履歴が旧値から記録されていないよ");

const [member] = await query(`
  SELECT email
  FROM public.members
  WHERE status = 'active' AND email IS NOT NULL
  ORDER BY is_admin DESC, member_id
  LIMIT 1
`);
const [milestone] = await query(`
  SELECT id
  FROM public.project_management_milestones
  WHERE project_id = 'p21' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
`);
assert(member?.email, "RLS境界テスト用のactive memberがないよ");
assert(milestone?.id, "RLS境界テスト用のp21 milestoneがないよ");

async function authenticatedCount({ email, sqlBody, beforeRoleSql = "" }) {
  const claims = JSON.stringify({ role: "authenticated", email });
  const rows = await query(`
    BEGIN;
    ${beforeRoleSql}
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claims', ${sqlLiteral(claims)}, true);
    SELECT set_config('request.jwt.claim.email', ${sqlLiteral(email)}, true);
    ${sqlBody}
    ROLLBACK;
  `);
  return Number(rows[0]?.observed ?? -1);
}

const deletedVisible = await authenticatedCount({
  email: member.email,
  beforeRoleSql: `
    UPDATE public.project_management_milestones
    SET deleted_at = now(), deleted_by = 'rls-test'
    WHERE id = ${sqlLiteral(milestone.id)};
  `,
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_milestones
    WHERE id = ${sqlLiteral(milestone.id)} AND deleted_at IS NOT NULL;
  `,
});
assert(deletedVisible === 0, `soft-delete済み行がPJメンバーに見えているよ: ${deletedVisible}`);

const activeVisible = await authenticatedCount({
  email: member.email,
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_milestones
    WHERE project_id = 'p21' AND deleted_at IS NULL;
  `,
});
assert(activeVisible > 0, "PJメンバーがp21の有効行を読めないよ");

const foreignVisible = await authenticatedCount({
  email: "not-a-member@example.invalid",
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_milestones
    WHERE project_id = 'p21';
  `,
});
assert(foreignVisible === 0, `未所属ユーザーにp21が見えているよ: ${foreignVisible}`);

const [interaction] = await query(`
  SELECT id
  FROM public.project_management_partner_interactions
  WHERE project_id = 'p21' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
`);
assert(interaction?.id, "RLS境界テスト用のp21 partner interactionがないよ");

const interactionDeletedVisible = await authenticatedCount({
  email: member.email,
  beforeRoleSql: `
    UPDATE public.project_management_partner_interactions
    SET deleted_at = now(), deleted_by = 'rls-test'
    WHERE id = ${sqlLiteral(interaction.id)};
  `,
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_interactions
    WHERE id = ${sqlLiteral(interaction.id)} AND deleted_at IS NOT NULL;
  `,
});
assert(interactionDeletedVisible === 0, `soft-delete済みのやり取り履歴行がPJメンバーに見えているよ: ${interactionDeletedVisible}`);

const interactionForeignVisible = await authenticatedCount({
  email: "not-a-member@example.invalid",
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_interactions
    WHERE project_id = 'p21';
  `,
});
assert(interactionForeignVisible === 0, `未所属ユーザーにp21のやり取り履歴が見えているよ: ${interactionForeignVisible}`);

// Foreign-project fixture for the parent-guard probes below. Production always carries several
// projects, so this must never silently skip its guard probes just because no second project
// happened to exist at test time (2026-07-24 P1: silent skip masks a broken guard in exactly the
// multi-PJ production shape this repo actually runs). Assert its existence instead of an "if" that
// quietly no-ops the interaction/role/work-item/related_milestone_id guard probes below.
const crossProjectPartner = await query(`
  SELECT project_id FROM public.projects WHERE project_id <> 'p21' LIMIT 1
`);
assert(crossProjectPartner[0]?.project_id, "RLS境界テスト用のp21以外のPJ（parent guard probe用のforeign project）がないよ — production は複数PJ前提なのでguard probeをスキップできない");
{
  const guardRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_interactions (
      project_id, partner_id, interaction_kind, occurred_on_precision, summary, ball_side_after, confidence, source_kind, source_ref
    )
    SELECT ${sqlLiteral(crossProjectPartner[0].project_id)}, id, 'note', 'unknown', 'cross-project guard probe', 'unknown', 'unknown', 'manual', 'rls-test'
    FROM public.project_management_partners
    WHERE project_id = 'p21'
    LIMIT 1;
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(guardRows?.error && /management parent must stay inside one project/.test(guardRows.error), "やり取り履歴のparent guardが別PJのpartner_idを拒否していないよ");
}

const [role] = await query(`
  SELECT id
  FROM public.project_management_partner_roles
  WHERE project_id = 'p21' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
`);
assert(role?.id, "RLS境界テスト用のp21 partner roleがないよ");

const roleDeletedVisible = await authenticatedCount({
  email: member.email,
  beforeRoleSql: `
    UPDATE public.project_management_partner_roles
    SET deleted_at = now(), deleted_by = 'rls-test'
    WHERE id = ${sqlLiteral(role.id)};
  `,
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_roles
    WHERE id = ${sqlLiteral(role.id)} AND deleted_at IS NOT NULL;
  `,
});
assert(roleDeletedVisible === 0, `soft-delete済みの分類行がPJメンバーに見えているよ: ${roleDeletedVisible}`);

const roleForeignVisible = await authenticatedCount({
  email: "not-a-member@example.invalid",
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_roles
    WHERE project_id = 'p21';
  `,
});
assert(roleForeignVisible === 0, `未所属ユーザーにp21の分類が見えているよ: ${roleForeignVisible}`);

const [workItem] = await query(`
  SELECT id
  FROM public.project_management_partner_work_items
  WHERE project_id = 'p21' AND deleted_at IS NULL
  ORDER BY created_at
  LIMIT 1
`);
assert(workItem?.id, "RLS境界テスト用のp21 partner work itemがないよ");

const workItemDeletedVisible = await authenticatedCount({
  email: member.email,
  beforeRoleSql: `
    UPDATE public.project_management_partner_work_items
    SET deleted_at = now(), deleted_by = 'rls-test'
    WHERE id = ${sqlLiteral(workItem.id)};
  `,
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_work_items
    WHERE id = ${sqlLiteral(workItem.id)} AND deleted_at IS NOT NULL;
  `,
});
assert(workItemDeletedVisible === 0, `soft-delete済みの保有事項行がPJメンバーに見えているよ: ${workItemDeletedVisible}`);

const workItemForeignVisible = await authenticatedCount({
  email: "not-a-member@example.invalid",
  sqlBody: `
    SELECT count(*) AS observed
    FROM public.project_management_partner_work_items
    WHERE project_id = 'p21';
  `,
});
assert(workItemForeignVisible === 0, `未所属ユーザーにp21の保有事項が見えているよ: ${workItemForeignVisible}`);

{
  const roleGuardRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_roles (
      project_id, partner_id, role_kind, relationship_state, is_primary, source_kind, source_ref
    )
    SELECT ${sqlLiteral(crossProjectPartner[0].project_id)}, id, 'unclassified', 'unconfirmed', false, 'manual', 'rls-test'
    FROM public.project_management_partners
    WHERE project_id = 'p21'
    LIMIT 1;
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(roleGuardRows?.error && /management parent must stay inside one project/.test(roleGuardRows.error), "分類のparent guardが別PJのpartner_idを拒否していないよ");

  const workItemGuardRows = await query(`
    BEGIN;
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, last_verified_at, source_kind, source_ref
    )
    SELECT ${sqlLiteral(crossProjectPartner[0].project_id)}, id, 'unknown', 'task', 'cross-project guard probe', 'open', 'unknown', CURRENT_DATE, 'manual', 'rls-test'
    FROM public.project_management_partners
    WHERE project_id = 'p21'
    LIMIT 1;
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(workItemGuardRows?.error && /management parent must stay inside one project/.test(workItemGuardRows.error), "保有事項のparent guardが別PJのpartner_idを拒否していないよ");

  // related_milestone_id specifically: partner_id stays inside p21 (valid), but the gate it connects
  // to belongs to a different project — the parent guard must catch this second field independently
  // of the first. Do NOT skip this probe when the foreign project happens to have no milestone yet:
  // build one as a fixture, inside the same BEGIN/ROLLBACK as the guard probe itself, so nothing
  // persists either way. All fixture rows use NOT NULL-only columns already documented in
  // migrations/183 (objective -> outcome -> milestone chain).
  const relatedMilestoneGuardRows = await query(`
    BEGIN;
    WITH target_project AS (
      SELECT ${sqlLiteral(crossProjectPartner[0].project_id)}::text AS project_id
    ),
    existing_milestone AS (
      SELECT m.id FROM public.project_management_milestones m, target_project tp
      WHERE m.project_id = tp.project_id AND m.deleted_at IS NULL
      LIMIT 1
    ),
    fixture_objective AS (
      INSERT INTO public.project_management_objectives (project_id, slug, title, definition_of_done, last_verified_at, source_kind, source_ref)
      SELECT tp.project_id, 'rls-test-fixture-objective', 'RLS test fixture objective', 'n/a', CURRENT_DATE, 'manual', 'rls-test'
      FROM target_project tp
      WHERE NOT EXISTS (SELECT 1 FROM existing_milestone)
      RETURNING id, project_id
    ),
    fixture_outcome AS (
      INSERT INTO public.project_management_outcomes (project_id, objective_id, slug, track, title, definition_of_done, owner_label, last_verified_at, source_kind, source_ref)
      SELECT fo.project_id, fo.id, 'rls-test-fixture-outcome', 'business_development', 'RLS test fixture outcome', 'n/a', 'rls-test', CURRENT_DATE, 'manual', 'rls-test'
      FROM fixture_objective fo
      RETURNING id, project_id, objective_id
    ),
    fixture_milestone AS (
      INSERT INTO public.project_management_milestones (project_id, objective_id, outcome_id, slug, track, title, gate, owner_label, next_deliverable, max_issue, completion_criteria, last_verified_at, source_kind, source_ref)
      SELECT fout.project_id, fout.objective_id, fout.id, 'rls-test-fixture-milestone', 'business_development', 'RLS test fixture milestone', 'n/a', 'rls-test', 'n/a', 'n/a', 'n/a', CURRENT_DATE, 'manual', 'rls-test'
      FROM fixture_outcome fout
      RETURNING id
    ),
    target_milestone AS (
      SELECT id FROM existing_milestone
      UNION ALL
      SELECT id FROM fixture_milestone
    ),
    target_partner AS (
      SELECT id FROM public.project_management_partners WHERE project_id = 'p21' LIMIT 1
    )
    INSERT INTO public.project_management_partner_work_items (
      project_id, partner_id, side, item_kind, title, status, due_date_precision, related_milestone_id, last_verified_at, source_kind, source_ref
    )
    SELECT 'p21', tpartner.id, 'unknown', 'task', 'cross-project related_milestone_id guard probe', 'open', 'unknown', tm.id, CURRENT_DATE, 'manual', 'rls-test'
    FROM target_partner tpartner, target_milestone tm;
    ROLLBACK;
  `).catch((error) => ({ error: String(error) }));
  assert(relatedMilestoneGuardRows?.error && /management parent must stay inside one project/.test(relatedMilestoneGuardRows.error), `保有事項のrelated_milestone_id parent guardが別PJのゲートを拒否していないよ: ${relatedMilestoneGuardRows?.error || "(no error raised)"}`);
}

console.log(`RLS tests passed: ${softDeleteTables.length} soft-delete policies, authenticated member boundary, deleted-row hiding, foreign-project denial, partner interaction/role/work-item/task table contract, parent-project guard (fixture-backed related_milestone_id probe), seed id existence, provenance edit-stamps-manual invariant, role+work-item soft-delete/reapply safety (completion/related-milestone preserved), completion CHECK btrim`);
