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
    AND tgname IN ('project_management_dependency_guard', 'project_management_milestone_dependencies_block_delete')
`);
const triggerNames = new Set(triggers.map((row) => row.tgname));
assert(triggerNames.has("project_management_dependency_guard"), "依存DAGのDBトリガーがないよ");
assert(triggerNames.has("project_management_milestone_dependencies_block_delete"), "依存表の認証済みDELETE防止トリガーがないよ");

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

console.log(`RLS tests passed: ${softDeleteTables.length} soft-delete policies, authenticated member boundary, deleted-row hiding, foreign-project denial`);
