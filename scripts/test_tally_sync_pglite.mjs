#!/usr/bin/env node
// Reuse an already-installed PGlite package. No install, network, credentials,
// external database, or persisted database is used by this runner.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a value`);
  return args[index + 1];
}
const engineDir = option("--engine-dir") ?? process.env.TALLY_TEST_PGLITE_DIR;
if (!engineDir) throw new Error("Provide --engine-dir for an existing @electric-sql/pglite package; this runner never installs one.");
const require = createRequire(import.meta.url);
const { PGlite } = require(resolve(engineDir));
const packageVersion = JSON.parse(readFileSync(resolve(engineDir, "package.json"), "utf8")).version;
const reportPath = option("--report");
const results = [];
const limitations = [
  "PGlite is a single PostgreSQL session; multiple independent instances are separate databases, not concurrent sessions.",
  "Advisory lock contention, lock-wait ordering, deadlock/timeout and overlapping multi-session snapshots are not tested here.",
  "PostgreSQL 18.3/WASM differs from production PostgreSQL 17; this is not production-version certification.",
  "No PostgREST/HTTP/Edge deployment, schema cache, complete application dependency schema, production writes or WAL measurement.",
  "The audit table and functions are extracted from the repository migration; auth.role is a synthetic JWT-role fixture.",
];
function sqlFile(path, skip = new Set()) {
  const absolute = resolve(path);
  if (!absolute.startsWith(root + sep)) throw new Error("Fixture include outside the repository");
  if (skip.has(absolute)) return "";
  return readFileSync(absolute, "utf8").split("\n").map((line) => {
    const include = line.match(/^\\ir\s+(.+)$/);
    if (include) return sqlFile(resolve(dirname(absolute), include[1]), skip);
    if (/^\\(?:set ON_ERROR_STOP on|echo )/.test(line)) return "";
    if (line.startsWith("\\")) throw new Error(`Unsupported fixture meta-command: ${line}`);
    return line;
  }).join("\n");
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function check(name, run) {
  await run();
  results.push({ name, status: "PASS" });
}
async function asRole(role, run) {
  // All role names here are fixed synthetic fixture roles, never request input.
  await db.exec(`SET ROLE ${role}`);
  try { return await run(); } finally { await db.exec("RESET ROLE"); }
}
async function rejects(run, expectedCode) {
  try { await run(); } catch (error) {
    assert(error.code === expectedCode, `Expected ${expectedCode}, received ${error.code}: ${error.message}`);
    return;
  }
  throw new Error(`Expected rejection ${expectedCode}`);
}
function project(weeks, id = "test-a", displayName = "Test", terms = []) {
  return { projectID: id, displayName, meetingSearchTerms: terms, weeklyEffort: weeks.map(([weekStart, developmentHours, meetingHours]) => ({ weekStart, developmentHours, meetingHours })) };
}
async function sync(projects, member = "ID001", start = "2026-10-05", end = "2026-10-26") {
  return await db.query("SELECT public.amie_sync_tally_effort($1::text, $2::date, $3::date, $4::jsonb) AS result", [member, start, end, JSON.stringify(projects)]);
}
async function state() {
  const rows = await db.query(`SELECT jsonb_build_object(
    'weeks', (SELECT jsonb_agg(to_jsonb(t) || jsonb_build_object('physical_row', ctid::text) ORDER BY project_id,member_id,week_start) FROM public.tally_weekly_effort_entries t),
    'settings', (SELECT jsonb_agg(to_jsonb(t) ORDER BY project_id,member_id) FROM public.tally_project_syncs t),
    'mutations', (SELECT jsonb_agg(to_jsonb(t)) FROM public.tally_test_mutations t),
    'history', (SELECT jsonb_agg(to_jsonb(t) ORDER BY occurred_at,id) FROM public.amd_os_data_change_history t)
  ) AS state`);
  return rows.rows[0].state;
}
async function clearLogs() {
  // These are synthetic tables in this in-memory database only.
  await db.exec("TRUNCATE public.tally_test_mutations, public.amd_os_data_change_history");
}
function auditFixture() {
  const source = readFileSync(resolve(root, "ios/supabase/migrations/20260916223000_os_data_change_history_and_workspace_access_requests.sql"), "utf8");
  const table = source.match(/CREATE TABLE IF NOT EXISTS public\.amd_os_data_change_history \([\s\S]*?\n\);/)?.[0];
  const names = ["amd_os_block_change_history_mutation", "amd_os_sanitize_history_values", "amd_os_record_data_change"];
  const functions = names.map((name) => source.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0]);
  assert(table && functions.every(Boolean), "Cannot extract exact repository audit fixture DDL/functions");
  return `CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
    $$;
    ${table}
    ${functions.join("\n")}
    ALTER TABLE public.amd_os_data_change_history ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.amd_os_data_change_history FROM PUBLIC, anon, authenticated;
    CREATE TRIGGER amd_os_data_change_history_append_only BEFORE UPDATE OR DELETE ON public.amd_os_data_change_history
      FOR EACH ROW EXECUTE FUNCTION public.amd_os_block_change_history_mutation();
    CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tally_weekly_effort_entries
      FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id,member_id,week_start');
    CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tally_project_syncs
      FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id,member_id');
    SET request.jwt.claims = '{"role":"service_role"}';`;
}
const db = new PGlite();
let engine;
try {
  engine = (await db.query("SELECT version() AS version")).rows[0].version;
  const regressionFile = resolve(root, "ios/supabase/tests/tally_sync.sql");
  await db.exec(sqlFile(regressionFile));
  const assertionNames = readFileSync(regressionFile, "utf8").split("\n")
    .filter((line) => line.startsWith("SELECT pg_temp.assert_true("))
    .map((line) => line.match(/, '([^']+)'\);$/)?.[1]);
  assert(assertionNames.every(Boolean), "Cannot identify SQL regression assertion labels");
  for (const name of assertionNames) results.push({ name, status: "PASS" });
  const remaining = await db.query("SELECT to_regclass('public.tally_weekly_effort_entries') AS relation");
  assert(remaining.rows[0].relation === null, "SQL fixture transaction did not roll back its schema");
  results.push({ name: "regression fixture schema is rolled back", status: "PASS" });

  const migration = resolve(root, "pwa/scripts/migrations/501_tally_differential_sync.sql");
  const fixture = resolve(root, "ios/supabase/tests/tally_sync_fixture.sql");
  await db.exec(sqlFile(fixture, new Set([migration])));
  await check("Edge RPC before migration fails without acknowledging or changing data", async () => {
    await rejects(() => asRole("service_role", () => sync([project([])])), "42883");
    assert((await db.query("SELECT count(*) AS n FROM public.tally_test_mutations")).rows[0].n === 0, "RPC before migration changed data");
  });
  const tableSecurity = async () => (await db.query(`SELECT relname,relrowsecurity,relforcerowsecurity,relacl::text
    FROM pg_class WHERE oid IN ('public.tally_project_syncs'::regclass,'public.tally_weekly_effort_entries'::regclass) ORDER BY relname`)).rows;
  const originalSecurity = await tableSecurity();
  await db.exec(sqlFile(migration));
  await check("migration preserves table ACL, enabled RLS, and existing strict audit triggers", async () => {
    assert(JSON.stringify(await tableSecurity()) === JSON.stringify(originalSecurity), "Migration changed table security");
    assert(originalSecurity.every((row) => row.relrowsecurity), "Fixture RLS is not enabled");
    const triggers = (await db.query("SELECT count(*) AS n FROM pg_trigger WHERE tgname='tally_test_audit' AND NOT tgisinternal")).rows[0].n;
    assert(triggers === 2, "Migration removed an audit trigger");
  });
  await db.exec("GRANT EXECUTE ON FUNCTION public.amie_sync_tally_effort(text,date,date,jsonb) TO PUBLIC, anon, authenticated");
  await db.exec(sqlFile(migration));
  await check("reapplying migration revokes PUBLIC/anon/authenticated and retains explicit service execution", async () => {
    const acl = (await db.query(`SELECT prosecdef,proconfig,proacl::text,
      has_function_privilege('anon',oid,'execute') AS anon,
      has_function_privilege('authenticated',oid,'execute') AS authenticated,
      has_function_privilege('service_role',oid,'execute') AS service
      FROM pg_proc WHERE oid='public.amie_sync_tally_effort(text,date,date,jsonb)'::regprocedure`)).rows[0];
    assert(!acl.prosecdef && !acl.anon && !acl.authenticated && acl.service, "Invalid invoker/execute ACL");
    assert(acl.proacl.includes("service_role=X/"), "No explicit service execute grant");
    assert(acl.proconfig.includes('search_path=""'), "RPC search path is not empty");
    assert(JSON.stringify(await tableSecurity()) === JSON.stringify(originalSecurity), "Reapply changed table grants/RLS");
  });
  for (const role of ["anon", "authenticated"]) {
    await check(`${role} actual RPC invocation is denied`, () => rejects(() => asRole(role, () => sync([project([])])), "42501"));
  }
  await check("invoker continues to enforce RLS even if a client receives execute/table grants in the fixture", async () => {
    await db.exec(`GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT ON public.projects,public.members TO authenticated;
      GRANT SELECT,INSERT,UPDATE,DELETE ON public.tally_project_syncs,public.tally_weekly_effort_entries TO authenticated;
      GRANT EXECUTE ON FUNCTION public.amie_sync_tally_effort(text,date,date,jsonb) TO authenticated`);
    await rejects(() => asRole("authenticated", () => sync([project([])])), "42501");
    assert((await db.query("SELECT count(*) AS n FROM public.tally_project_syncs")).rows[0].n === 0, "Invoker bypassed RLS");
    await db.exec(`REVOKE SELECT,INSERT,UPDATE,DELETE ON public.tally_project_syncs,public.tally_weekly_effort_entries FROM authenticated;
      REVOKE SELECT ON public.projects,public.members FROM authenticated`);
    await db.exec(sqlFile(migration));
  });
  await db.exec(auditFixture());
  const initial = [["2026-10-05",10,2],["2026-10-12",20,3],["2026-10-19",30,4],["2026-10-26",40,5]];
  const changed = [["2026-10-05",10,2],["2026-10-12",21,3],["2026-10-20",6,1],["2026-10-26",40,5]];
  const weeksBefore = (await state()).weeks;
  const untouchedBefore = weeksBefore.filter((row) => row.project_id !== "test-a" || row.member_id !== "ID001" || row.week_start < "2026-10-05" || row.week_start > "2026-10-26");
  await check("service role is neither table owner nor superuser and can invoke through existing bypass-RLS path", async () => {
    const role = (await db.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname='service_role'")).rows[0];
    assert(!role.rolsuper && role.rolbypassrls, "Service fixture role differs from expected authorization path");
    const owns = (await db.query("SELECT count(*) AS n FROM pg_class c JOIN pg_roles r ON c.relowner=r.oid WHERE r.rolname='service_role' AND c.relname LIKE 'tally_%'")).rows[0].n;
    assert(owns === 0, "Service role owns fixture tables");
    const response = (await asRole("service_role", () => sync([project(initial)]))).rows[0].result;
    assert(response.ok && response.projectCount === 1 && response.weekCount === 4, "Unexpected service RPC response");
  });
  await check("unchanged weeks produce zero actual audit histories and retain their physical rows and timestamps", async () => {
    const current = await state();
    assert(current.history.filter((row) => row.table_name === "tally_weekly_effort_entries").length === 0, "Unchanged weekly audit created");
    assert(current.mutations.filter((row) => row.table_name === "tally_weekly_effort_entries").length === 0, "Unchanged weekly mutation created");
    assert(JSON.stringify(current.weeks) === JSON.stringify(weeksBefore), "Unchanged physical row, timestamp or business value changed");
  });
  await clearLogs();
  await asRole("service_role", () => sync([project([...initial].reverse())]));
  await check("reordered unchanged resync creates only settings freshness audit", async () => {
    const current = await state();
    assert(current.history.length === 1 && current.history[0].table_name === "tally_project_syncs", "Unexpected resync history count");
    assert(JSON.stringify(current.history[0].changed_fields) === JSON.stringify(["last_synced_at"]), "Unexpected settings business change");
    assert(current.mutations.length === 1 && current.mutations[0].table_name === "tally_project_syncs", "Unexpected resync row mutation");
  });
  await clearLogs();
  await asRole("service_role", () => sync([project(changed)]));
  await check("genuine changes create one actual history per insert/update/delete with correct primary key and hours", async () => {
    const history = (await state()).history.filter((row) => row.table_name === "tally_weekly_effort_entries");
    assert(history.length === 3, "Expected three actual weekly histories");
    assert(JSON.stringify(history.map((row) => row.operation).sort()) === JSON.stringify(["delete","insert","update"]), "Wrong audit operations");
    const update = history.find((row) => row.operation === "update");
    assert(update.record_pk.project_id === "test-a" && update.record_pk.member_id === "ID001" && update.record_pk.week_start === "2026-10-12", "Wrong audit owner/week");
    assert(update.before_values.development_hours === 20 && update.after_values.development_hours === 21, "Wrong audited business values");
    assert(update.undo_supported, "Genuine change lost audit undo eligibility");
  });
  await clearLogs();
  await asRole("service_role", () => sync([project(changed,"test-a","Renamed",["new term"])]));
  await check("real settings changes stay audited without rewriting unchanged weeks", async () => {
    const current = await state();
    assert(current.mutations.length === 1 && current.mutations[0].table_name === "tally_project_syncs", "Settings-only change rewrote weeks");
    assert(current.history.length === 1 && current.history[0].changed_fields.includes("display_name") && current.history[0].changed_fields.includes("meeting_search_terms"), "Settings change not audited");
  });
  await clearLogs();
  await asRole("service_role", () => sync([project([])]));
  await check("explicit empty window audits only four owned deletions and preserves omitted users/projects/windows", async () => {
    const current = await state();
    const weekly = current.history.filter((row) => row.table_name === "tally_weekly_effort_entries");
    assert(weekly.length === 4 && weekly.every((row) => row.operation === "delete"), "Empty scope audit differs from expected deletion");
    assert(JSON.stringify(current.weeks) === JSON.stringify(untouchedBefore), "Empty scope touched unrelated physical rows");
  });
  await clearLogs();
  const emptyState = JSON.stringify(await state());
  await asRole("service_role", () => sync([]));
  await check("empty project scope performs no actual settings/week/history write", async () => {
    assert(JSON.stringify(await state()) === emptyState, "Omitted project scope changed state");
  });
  const invalidCases = [
    { name: "omitted weeklyEffort", payload: [{projectID:"test-a",displayName:"Test",meetingSearchTerms:[]}] },
    { name: "null weeklyEffort", payload: [{...project([]),weeklyEffort:null}] },
    { name: "null project array", payload: null },
    { name: "duplicate projects", payload: [project([]),project([])] },
    { name: "duplicate weeks", payload: [project([initial[0],initial[0]])] },
    { name: "unknown project", payload: [project([],"missing")] },
    { name: "invalid term", payload: [{...project([]),meetingSearchTerms:[null]}] },
    { name: "outside window", payload: [project([["2026-10-27",1,0]])] },
    { name: "negative hours", payload: [project([["2026-10-05",-1,0]])] },
    { name: "nonnumeric hours", payload: [{...project([]),weeklyEffort:[{weekStart:"2026-10-05",developmentHours:"1",meetingHours:0}]}] },
    { name: "wrong owner", payload: [], member:"ID002" },
    { name: "missing window", payload: [], start:null },
    { name: "reversed window", payload: [], start:"2026-10-27" },
    { name: "impossible calendar date", payload: [project([["2026-02-30",1,0]])], code:"22008" },
  ];
  for (const input of invalidCases) {
    await check(`actual-audit state unchanged after rejecting ${input.name}`, async () => {
      await rejects(() => asRole("service_role", () => sync(input.payload,input.member ?? "ID001",Object.hasOwn(input,"start") ? input.start : "2026-10-05")), input.code ?? "22023");
      assert(JSON.stringify(await state()) === emptyState, "Rejected input persisted a row or history");
    });
  }
  await db.exec(`CREATE FUNCTION public.tally_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture write failure' USING ERRCODE='P0002'; END $$;
    CREATE TRIGGER tally_test_failure BEFORE INSERT ON public.tally_weekly_effort_entries
      FOR EACH ROW WHEN (NEW.project_id='test-b') EXECUTE FUNCTION public.tally_test_fail_insert()`);
  await check("second-project failure rolls back all projects, settings freshness, strict mutation records and actual audit histories", async () => {
    await rejects(() => asRole("service_role", () => sync([project([initial[0]],"test-a","Failed rename"),project([["2026-10-12",6,1]],"test-b")])), "P0002");
    assert(JSON.stringify(await state()) === emptyState, "Failure left partial business data or audit history");
  });
  await db.exec("DROP TRIGGER tally_test_failure ON public.tally_weekly_effort_entries");
  await check("advisory transaction lock is held until transaction end in the single session", async () => {
    await db.exec("BEGIN");
    try {
      await sync([project(initial)]);
      const held = (await db.query("SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted")).rows[0].n;
      assert(held === 1, "Expected single owner advisory lock held");
      await db.exec("COMMIT");
    } catch (error) { await db.exec("ROLLBACK"); throw error; }
    assert((await db.query("SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid()")).rows[0].n === 0, "Transaction advisory lock was retained after commit");
  });
  await check("queued single-session empty/populated snapshots finish with the last snapshot and no mixed weeks", async () => {
    await Promise.all([sync([project([])]),sync([project([["2026-10-12",7,1],["2026-10-26",8,2]])])]);
    const rows = (await db.query("SELECT week_start::text,development_hours,meeting_hours FROM public.tally_weekly_effort_entries WHERE project_id='test-a' AND member_id='ID001' AND week_start BETWEEN '2026-10-05' AND '2026-10-26' ORDER BY week_start")).rows;
    assert(JSON.stringify(rows) === JSON.stringify([{week_start:"2026-10-12",development_hours:"7.00",meeting_hours:"1.00"},{week_start:"2026-10-26",development_hours:"8.00",meeting_hours:"2.00"}]), "Queued snapshot final state is mixed");
  });
  console.log(JSON.stringify({ status: "PASS", engine, packageVersion, total: results.length }));
} catch (error) {
  process.exitCode = 1;
  results.push({ name: "PGlite SQL validation", status: "FAIL", error: { message: error.message, code: error.code } });
  console.error(JSON.stringify({ status: "FAIL", message: error.message, code: error.code, detail: error.detail, where: error.where }));
} finally {
  await db.close();
  if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify({
    status: process.exitCode ? "FAIL" : "PASS", engine, packageVersion, total: results.length, results, limitations,
  }, null, 2) + "\n");
}
