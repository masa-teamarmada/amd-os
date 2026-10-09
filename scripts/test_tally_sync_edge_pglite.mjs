#!/usr/bin/env node
// In-process Request/Response -> actual Tally sources -> fixture SDK adapter ->
// real PostgreSQL SQL in PGlite. No listener, external request, or credentials.
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire, stripTypeScriptTypes } from "node:module";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a value`);
  return args[index + 1];
}
const engineDir = option("--engine-dir") ?? process.env.TALLY_TEST_PGLITE_DIR;
assert(engineDir, "Provide an existing PGlite package with --engine-dir; no package is installed by this runner.");
const { PGlite } = createRequire(import.meta.url)(resolve(engineDir));
const packageVersion = JSON.parse(readFileSync(resolve(engineDir, "package.json"), "utf8")).version;
const reportPath = option("--report");
const results = [];
const sourceHashes = {};
const boundaries = {
  real: ["Native Request/Response objects", "Current index.ts, handler.ts and payload.ts after type stripping and explicit fixture import replacement", "Migration 307/501 SQL, service-role permissions and enabled RLS in an in-memory PostgreSQL engine", "Strict row-mutation triggers and unchanged repository audit functions", "Business/settings/history transaction rollback"],
  mocked: ["Deno.env contains only synthetic fixture values; Deno.serve captures the callback without opening a listener", "Supabase createClient/rpc is replaced by a parameterized local PGlite query adapter", "auth.role/JWT claims are synthetic fixtures, not verified tokens", "Client creation/transport faults and trigger failures emitting P0002/23503 are injected fixtures"],
  notVerified: ["Real Supabase SDK, PostgREST, schema cache, JWT verification, TCP HTTP and deployed Edge runtime", "Production source equality or full application schema", "PostgreSQL 17 and independent-session concurrency/lock contention", "Production writes, WAL or IO reduction measurement"],
};
function sqlFile(path) {
  const absolute = resolve(path);
  assert(absolute.startsWith(root + sep), "Fixture include outside the repository");
  return readFileSync(absolute, "utf8").split("\n").map((line) => {
    const include = line.match(/^\\ir\s+(.+)$/);
    if (include) return sqlFile(resolve(dirname(absolute), include[1]));
    if (/^\\(?:set ON_ERROR_STOP on|echo )/.test(line)) return "";
    assert(!line.startsWith("\\"), `Unsupported fixture meta-command: ${line}`);
    return line;
  }).join("\n");
}
function auditFixture() {
  const path = "ios/supabase/migrations/20260916223000_os_data_change_history_and_workspace_access_requests.sql";
  const source = readFileSync(resolve(root, path), "utf8");
  sourceHashes[path] = createHash("sha256").update(source).digest("hex");
  const table = source.match(/CREATE TABLE IF NOT EXISTS public\.amd_os_data_change_history \([\s\S]*?\n\);/)?.[0];
  const functions = ["amd_os_block_change_history_mutation", "amd_os_sanitize_history_values", "amd_os_record_data_change"]
    .map((name) => source.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0]);
  assert(table && functions.every(Boolean), "Cannot extract exact repository audit table/functions");
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
let handler;
let calls = [];
let queryCount = 0;
let adapterRole = "service_role";
let fault = null;
const environment = { TALLY_SYNC_KEY: "fixture-only-sync-key", SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-only-service-key" };
function createClient(url, key, options) {
  calls.push({ kind: "client" });
  assert.equal(url, environment.SUPABASE_URL);
  assert.equal(key, environment.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(JSON.stringify(options), JSON.stringify({ auth: { persistSession: false } }));
  if (fault === "client") throw new Error("fixture client creation failure");
  return { async rpc(name, parameters) {
    calls.push({ kind: "rpc", name, parameters: JSON.parse(JSON.stringify(parameters)) });
    assert.equal(name, "amie_sync_tally_effort");
    assert.deepEqual(Object.keys(parameters).sort(), ["p_member_id", "p_projects", "p_window_end", "p_window_start"]);
    if (fault === "transport") throw new Error("fixture transport failure");
    assert(["service_role", "authenticated"].includes(adapterRole), "Unexpected fixture role");
    await db.exec(`SET ROLE ${adapterRole}`);
    try {
      queryCount++;
      // One SQL statement has the same atomic function-call boundary; this
      // adapter does not implement or emulate the PostgREST HTTP protocol.
      const response = await db.query("SELECT public.amie_sync_tally_effort($1::text,$2::date,$3::date,$4::jsonb) AS result", [
        parameters.p_member_id, parameters.p_window_start, parameters.p_window_end, JSON.stringify(parameters.p_projects),
      ]);
      calls.at(-1).result = response.rows[0].result;
      return { data: response.rows[0].result, error: null };
    } catch (error) {
      calls.at(-1).errorCode = error.code;
      return { data: null, error: { code: error.code, message: error.message } };
    } finally { await db.exec("RESET ROLE"); }
  } };
}
function loadHandler() {
  const imports = {
    "payload.ts": [],
    "handler.ts": ['import { parsePayload, type Project } from "./payload.ts";'],
    "index.ts": ['import { createClient } from "https://esm.sh/@supabase/supabase-js@2";', 'import { handleTallySync } from "./handler.ts";'],
  };
  const sources = Object.entries(imports).map(([file, expectedImports]) => {
    const path = `ios/supabase/functions/tally-sync/${file}`;
    let source = readFileSync(resolve(root, path), "utf8");
    sourceHashes[path] = createHash("sha256").update(source).digest("hex");
    for (const statement of expectedImports) {
      assert.equal(source.split(statement).length, 2, `Changed import contract in ${file}`);
      source = source.replace(statement, "");
    }
    source = stripTypeScriptTypes(source, { sourceUrl: path }).replace(/^export\s+(?=(?:async\s+)?function\s)/gm, "");
    assert(!/^\s*(?:import|export)\b/m.test(source), `Unsupported runtime module syntax in ${file}`);
    return source;
  });
  const context = vm.createContext({
    Request, Response, Headers,
    fetch() { throw new Error("Network is forbidden in this fixture harness"); },
    Deno: { env: { get: (name) => environment[name] }, serve: (callback) => { assert.equal(handler, undefined); handler = callback; } },
    createClient,
  }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(sources.join("\n"), context, { filename: "tally-sync-fixture-sources.js", timeout: 5000 });
  assert.equal(typeof handler, "function", "Actual entrypoint did not register its handler");
}
const initial = [["2026-10-05",10,2],["2026-10-12",20,3],["2026-10-19",30,4],["2026-10-26",40,5]];
const changed = [["2026-10-05",10,2],["2026-10-12",21,3],["2026-10-20",6,1],["2026-10-26",40,5]];
function project(weeks, id = "test-a", displayName = "Test A", terms = ["test"]) {
  return { projectID: id, displayName, meetingSearchTerms: terms, weeklyEffort: weeks.map(([weekStart, developmentHours, meetingHours]) => ({ weekStart, developmentHours, meetingHours })) };
}
function payload(projects = [project(initial)]) {
  return { memberID: "ID001", windowStart: "2026-10-05", windowEnd: "2026-10-26", projects };
}
async function state() {
  return (await db.query(`SELECT jsonb_build_object(
    'weeks', (SELECT jsonb_agg(to_jsonb(t) || jsonb_build_object('physical_row',ctid::text) ORDER BY project_id,member_id,week_start) FROM public.tally_weekly_effort_entries t),
    'settings', (SELECT jsonb_agg(to_jsonb(t) ORDER BY project_id,member_id) FROM public.tally_project_syncs t),
    'mutations', (SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.tally_test_mutations t),
    'history', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY occurred_at,id),'[]') FROM public.amd_os_data_change_history t)
  ) AS state`)).rows[0].state;
}
async function clearLogs() { await db.exec("TRUNCATE public.tally_test_mutations,public.amd_os_data_change_history"); }
async function send(body, { key = environment.TALLY_SYNC_KEY, method = "POST", raw = false } = {}) {
  calls = [];
  queryCount = 0;
  const headers = { "content-type": "application/json" };
  if (key != null) headers["x-tally-sync-key"] = key;
  const response = await handler(new Request("https://fixture.invalid/tally-sync", {
    method, headers, ...(method === "POST" ? { body: raw ? body : JSON.stringify(body) } : {}),
  }));
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  return { status: response.status, body: method === "OPTIONS" ? null : await response.json() };
}
async function check(name, run) {
  await run();
  results.push({ name, status: "PASS" });
}
async function rejectedBeforeDatabase(name, body, status = 400, options = {}) {
  await check(name, async () => {
    const before = await state();
    const response = await send(body, options);
    assert.equal(response.status, status);
    assert.equal(response.body.ok, false);
    assert.deepEqual(calls, []);
    assert.equal(queryCount, 0);
    assert.deepEqual(await state(), before);
  });
}
function assertRpc(response, projects, expectedStatus = 200, expectedCode = null) {
  assert.equal(response.status, expectedStatus);
  assert.equal(queryCount, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, "client");
  const rpc = calls[1];
  assert.equal(rpc.kind, "rpc");
  assert.deepEqual(rpc.parameters, { p_member_id: "ID001", p_window_start: "2026-10-05", p_window_end: "2026-10-26", p_projects: projects });
  if (expectedCode) {
    assert.equal(rpc.errorCode, expectedCode);
    assert.equal(response.body.ok, false);
    assert(!JSON.stringify(response.body).includes("fixture"), "Internal fixture SQL error leaked in response");
  } else {
    const expected = { ok: true, projectCount: projects.length, weekCount: projects.reduce((sum, p) => sum + p.weeklyEffort.length, 0) };
    assert.deepEqual(response.body, expected);
    assert.deepEqual(rpc.result, expected);
  }
}
try {
  engine = (await db.query("SELECT version() AS version")).rows[0].version;
  await db.exec(sqlFile(resolve(root, "ios/supabase/tests/tally_sync_fixture.sql")));
  await db.exec(auditFixture());
  loadHandler();
  await check("actual entrypoint preflight registers CORS and never creates a client", async () => {
    const before = await state();
    assert.deepEqual(await send(null, { method: "OPTIONS", key: null }), { status: 200, body: null });
    assert.deepEqual(calls, []);
    assert.deepEqual(await state(), before);
  });
  await rejectedBeforeDatabase("GET rejected before SDK/SQL", null, 405, { method: "GET" });
  await rejectedBeforeDatabase("missing sync key rejected before SDK/SQL", payload(), 401, { key: null });
  await rejectedBeforeDatabase("wrong sync key rejected before SDK/SQL", payload(), 401, { key: "wrong-fixture-key" });
  environment.TALLY_SYNC_KEY = undefined;
  await rejectedBeforeDatabase("unconfigured sync key rejected before SDK/SQL", payload(), 401, { key: "fixture-only-sync-key" });
  environment.TALLY_SYNC_KEY = "fixture-only-sync-key";
  await rejectedBeforeDatabase("malformed JSON rejected before SDK/SQL", "{", 400, { raw: true });
  const invalidInputs = [
    ["null JSON", null],
    ["wrong owner", { ...payload(), memberID: "ID002" }],
    ["omitted window", { ...payload(), windowStart: undefined }],
    ["reversed window", { ...payload(), windowStart: "2026-10-27" }],
    ["omitted project array", { ...payload(), projects: undefined }],
    ["omitted weekly scope", payload([{ ...project(initial), weeklyEffort: undefined }])],
    ["null weekly scope", payload([{ ...project(initial), weeklyEffort: null }])],
    ["duplicate projects", payload([project(initial),project(initial)])],
    ["duplicate weeks", payload([project([initial[0],initial[0]])])],
    ["impossible calendar day", { ...payload(), windowStart: "2026-02-30" }],
    ["outside window", payload([project([["2026-10-27",1,0]])])],
    ["negative hours", payload([project([["2026-10-05",-1,0]])])],
    ["nonnumeric hours", payload([project([["2026-10-05","1",0]])])],
    ["oversized project array", payload(Array.from({ length: 101 }, (_, i) => project([], `test-${i}`)))],
  ];
  for (const [name, input] of invalidInputs) await rejectedBeforeDatabase(`${name} rejected before SDK/SQL`, input);
  const initialWeeks = (await state()).weeks;
  const multi = [project(initial), project([["2026-10-05",4,4]], "test-b", "Test B")];
  await check("entrypoint normalizes input and commits two projects through one real SQL RPC", async () => {
    const input = structuredClone(payload(multi));
    input.memberID = " ID001 ";
    input.projects[0] = { ...project(initial), projectID: " test-a ", displayName: " Test A ", meetingSearchTerms: [" test "] };
    input.projects[0].weeklyEffort[0].developmentHours = 10.004;
    assertRpc(await send(input), multi);
    const current = await state();
    assert.deepEqual(current.weeks, initialWeeks);
    assert.equal(current.mutations.filter((row) => row.table_name === "tally_weekly_effort_entries").length, 0);
    assert.equal(current.history.filter((row) => row.table_name === "tally_weekly_effort_entries").length, 0);
    assert.equal(current.settings.length, 2);
    assert.equal(current.history.length, 2);
  });
  await clearLogs();
  await check("reordered unchanged HTTP resync retains physical rows and only audits settings freshness", async () => {
    const projects = [project([...initial].reverse()), multi[1]];
    assertRpc(await send(payload(projects)), projects);
    const current = await state();
    assert.deepEqual(current.weeks, initialWeeks);
    assert.equal(current.mutations.length, 2);
    assert(current.mutations.every((row) => row.table_name === "tally_project_syncs"));
    assert.equal(current.history.length, 2);
    assert(current.history.every((row) => JSON.stringify(row.changed_fields) === '["last_synced_at"]'));
  });
  await clearLogs();
  const changedMulti = [project(changed), project([["2026-10-05",5,4]], "test-b", "Test B")];
  await check("changed/new/removed weeks across two projects commit once with exact genuine audit mutations", async () => {
    assertRpc(await send(payload(changedMulti)), changedMulti);
    const current = await state();
    const weekly = current.history.filter((row) => row.table_name === "tally_weekly_effort_entries");
    assert.deepEqual(weekly.map((row) => row.operation).sort(), ["delete","insert","update","update"]);
    assert(weekly.every((row) => row.undo_supported));
    const update = weekly.find((row) => row.operation === "update" && row.record_pk.project_id === "test-a");
    assert.equal(update.before_values.development_hours, 20);
    assert.equal(update.after_values.development_hours, 21);
    const unrelated = (rows) => rows.filter((row) => row.member_id !== "ID001" || row.week_start < "2026-10-05" || row.week_start > "2026-10-26");
    assert.deepEqual(unrelated(current.weeks), unrelated(initialWeeks));
    assert.equal(current.mutations.filter((row) => row.table_name === "tally_weekly_effort_entries").length, 4);
  });
  await clearLogs();
  await check("settings-only HTTP change preserves all weekly physical rows", async () => {
    const before = (await state()).weeks;
    const projects = [project(changed, "test-a", "Renamed", ["renamed term"]), changedMulti[1]];
    assertRpc(await send(payload(projects)), projects);
    const current = await state();
    assert.deepEqual(current.weeks, before);
    assert.equal(current.mutations.length, 2);
    assert(current.history.find((row) => row.record_pk.project_id === "test-a").changed_fields.includes("display_name"));
  });
  await clearLogs();
  await check("empty project scope reaches RPC but writes no settings, weeks or histories", async () => {
    const before = await state();
    assertRpc(await send(payload([])), []);
    assert.deepEqual(await state(), before);
  });
  await check("omitted project stays physically unchanged while a submitted project syncs", async () => {
    const before = (await state()).weeks.filter((row) => row.project_id === "test-b");
    const projects = [project(changed)];
    assertRpc(await send(payload(projects)), projects);
    assert.deepEqual((await state()).weeks.filter((row) => row.project_id === "test-b"), before);
  });
  await clearLogs();
  await check("explicit empty weekly scope deletes only owned weeks in the inclusive submitted window", async () => {
    const before = (await state()).weeks.filter((row) => row.project_id !== "test-a" || row.member_id !== "ID001" || row.week_start < "2026-10-05" || row.week_start > "2026-10-26");
    assertRpc(await send(payload([project([])])), [project([])]);
    const current = await state();
    assert.deepEqual(current.weeks, before);
    const weekly = current.history.filter((row) => row.table_name === "tally_weekly_effort_entries");
    assert.equal(weekly.length, 4);
    assert(weekly.every((row) => row.operation === "delete"));
  });
  await clearLogs();
  await check("unchanged empty window resync performs zero weekly mutations", async () => {
    const before = (await state()).weeks;
    assertRpc(await send(payload([project([])])), [project([])]);
    const current = await state();
    assert.deepEqual(current.weeks, before);
    assert.equal(current.mutations.filter((row) => row.table_name === "tally_weekly_effort_entries").length, 0);
  });
  await clearLogs();
  await check("SQL validation of an unknown second project returns 400 and preserves complete state", async () => {
    const before = await state();
    const projects = [project(initial), project([], "missing-project")];
    assertRpc(await send(payload(projects)), projects, 400, "22023");
    assert.deepEqual(await state(), before);
  });
  await db.exec(`CREATE FUNCTION public.tally_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture second-project write failure' USING ERRCODE='P0002'; END $$;
    CREATE TRIGGER tally_test_failure BEFORE INSERT ON public.tally_weekly_effort_entries
      FOR EACH ROW WHEN (NEW.project_id='test-b') EXECUTE FUNCTION public.tally_test_fail_insert()`);
  await check("second-project SQL write failure returns 500 and rolls back first project, settings and every audit", async () => {
    const before = await state();
    const projects = [project(initial, "test-a", "Must roll back"), project([["2026-10-12",6,1]], "test-b")];
    assertRpc(await send(payload(projects)), projects, 500, "P0002");
    assert.deepEqual(await state(), before);
  });
  await db.exec("DROP TRIGGER tally_test_failure ON public.tally_weekly_effort_entries");
  await db.exec(`CREATE OR REPLACE FUNCTION public.tally_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'fixture foreign-key failure' USING ERRCODE='23503'; END $$;
    CREATE TRIGGER tally_test_failure BEFORE INSERT ON public.tally_weekly_effort_entries
      FOR EACH ROW EXECUTE FUNCTION public.tally_test_fail_insert()`);
  await check("fixture SQL trigger emitting foreign-key SQLSTATE maps to 400 and rolls back settings and histories", async () => {
    const before = await state();
    const projects = [project(initial)];
    assertRpc(await send(payload(projects)), projects, 400, "23503");
    assert.deepEqual(await state(), before);
  });
  await db.exec("DROP TRIGGER tally_test_failure ON public.tally_weekly_effort_entries");
  adapterRole = "authenticated";
  await check("real SQL execute denial returns 500 and leaves data unchanged", async () => {
    const before = await state();
    const projects = [project(initial)];
    assertRpc(await send(payload(projects)), projects, 500, "42501");
    assert.deepEqual(await state(), before);
  });
  adapterRole = "service_role";
  await db.exec("DROP FUNCTION public.amie_sync_tally_effort(text,date,date,jsonb)");
  await check("missing migration returns 500 rather than acknowledging synchronization", async () => {
    const before = await state();
    const projects = [project(initial)];
    assertRpc(await send(payload(projects)), projects, 500, "42883");
    assert.deepEqual(await state(), before);
  });
  await db.exec(sqlFile(resolve(root, "pwa/scripts/migrations/501_tally_differential_sync.sql")));
  for (const mode of ["client", "transport"]) {
    fault = mode;
    await check(`injected ${mode} failure returns 500 without executing SQL`, async () => {
      const before = await state();
      const response = await send(payload());
      assert.equal(response.status, 500);
      assert.equal(response.body.ok, false);
      assert.equal(queryCount, 0);
      assert.equal(calls.length, mode === "client" ? 1 : 2);
      assert.deepEqual(await state(), before);
    });
  }
  fault = null;
  await clearLogs();
  await check("valid retry after SQL/SDK failures commits all projects with restored service role", async () => {
    assertRpc(await send(payload(multi)), multi);
    const current = await state();
    assert.equal(current.weeks.filter((row) => row.project_id === "test-a" && row.member_id === "ID001" && row.week_start >= "2026-10-05" && row.week_start <= "2026-10-26").length, 4);
    assert.equal(current.weeks.find((row) => row.project_id === "test-b").development_hours, 4);
    assert.equal((await db.query("SELECT current_user AS role")).rows[0].role, "postgres");
  });
  console.log(JSON.stringify({ status: "PASS", engine, packageVersion, total: results.length }));
} catch (error) {
  process.exitCode = 1;
  results.push({ name: "Edge/PGlite fixture integration", status: "FAIL", error: { message: error.message, code: error.code } });
  console.error(error);
} finally {
  await db.close();
  if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify({
    status: process.exitCode ? "FAIL" : "PASS", engine, packageVersion, total: results.length, sourceHashes, results, boundaries,
  }, null, 2) + "\n");
}
