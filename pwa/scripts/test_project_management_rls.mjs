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
      'project_management_partner_interactions_touch_updated_at'
    )
`);
const triggerNames = new Set(triggers.map((row) => row.tgname));
assert(triggerNames.has("project_management_dependency_guard"), "依存DAGのDBトリガーがないよ");
assert(triggerNames.has("project_management_milestone_dependencies_block_delete"), "依存表の認証済みDELETE防止トリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_block_delete"), "やり取り履歴表の認証済みDELETE防止トリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_parent_project_guard"), "やり取り履歴表の親PJ guardトリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_field_audit"), "やり取り履歴表のfield auditトリガーがないよ");
assert(triggerNames.has("project_management_partner_interactions_touch_updated_at"), "やり取り履歴表のtouch updated_atトリガーがないよ");

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
    'project_management_partner_interactions_date_consistency_191'
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
const ballSideGuard = contractRows.find((row) => row.conname === "project_management_partners_ball_side_check_191")?.definition || "";
const duePrecisionGuard = contractRows.find((row) => row.conname === "project_management_partners_due_precision_check_191")?.definition || "";
assert(/'sx'/.test(ballSideGuard) && /'partner'/.test(ballSideGuard) && /'shared'/.test(ballSideGuard) && /'none'/.test(ballSideGuard) && /'unknown'/.test(ballSideGuard), "現在ボール側CHECKの許容値が不足しているよ");
assert(/'day'/.test(duePrecisionGuard) && /'month'/.test(duePrecisionGuard) && /'unknown'/.test(duePrecisionGuard), "期限精度CHECKの許容値が不足しているよ");
const dueDateConsistencyGuard = contractRows.find((row) => row.conname === "project_management_partners_due_date_consistency_191")?.definition || "";
const occurredOnConsistencyGuard = contractRows.find((row) => row.conname === "project_management_partner_interactions_date_consistency_191")?.definition || "";
assert(/due_date_precision/.test(dueDateConsistencyGuard) && /due_date/.test(dueDateConsistencyGuard) && /IS NULL/.test(dueDateConsistencyGuard) && /IS NOT NULL/.test(dueDateConsistencyGuard), "期限精度と期限日の整合CHECKの条件が不足しているよ");
assert(/occurred_on_precision/.test(occurredOnConsistencyGuard) && /occurred_on/.test(occurredOnConsistencyGuard) && /IS NULL/.test(occurredOnConsistencyGuard) && /IS NOT NULL/.test(occurredOnConsistencyGuard), "発生日精度と発生日の整合CHECKの条件が不足しているよ");

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

const crossProjectPartner = await query(`
  SELECT project_id FROM public.projects WHERE project_id <> 'p21' LIMIT 1
`);
if (crossProjectPartner[0]?.project_id) {
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

console.log(`RLS tests passed: ${softDeleteTables.length} soft-delete policies, authenticated member boundary, deleted-row hiding, foreign-project denial, partner interaction table contract, parent-project guard`);
