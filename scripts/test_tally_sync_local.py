#!/usr/bin/env python3
"""Run real SQL and concurrent-sync regressions in a disposable loopback DB.

Requires local PostgreSQL's psql and a role allowed to create test databases.
Never reads application env files or accepts a remote database URL.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "ios/supabase/tests"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", choices=("127.0.0.1", "localhost", "::1"), default="127.0.0.1")
    parser.add_argument("--port", type=int, default=54322)
    parser.add_argument("--user", default="postgres")
    parser.add_argument("--psql", type=Path, help="Path to an existing psql binary; does not install or change PATH")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    psql = str(args.psql.resolve()) if args.psql else shutil.which("psql")
    if not psql:
        raise SystemExit("BLOCKED: psql/local PostgreSQL is unavailable; SQL and concurrency tests were not run.")
    database = "tally_sync_test_" + uuid.uuid4().hex
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env["PGCONNECT_TIMEOUT"] = "5"
    # Explicit connection args and no service/rc selection keep this local.
    env.pop("PGSERVICE", None)
    env.pop("PGSERVICEFILE", None)
    command = [psql, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-h", args.host, "-p", str(args.port), "-U", args.user]
    results = []
    engine = None
    cleanup = {"database_removed": False, "new_fixture_roles_removed": False}

    def passed(name):
        results.append({"name": name, "status": "PASS"})
        print("PASS: " + name, flush=True)

    def run(sql, db=database, app="tally-test-observer"):
        result = subprocess.run(command + ["-d", db], input=sql, text=True, capture_output=True,
                                env=dict(env, PGAPPNAME=app), timeout=30)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        return result.stdout.strip()

    def project(weeks, project_id="test-a"):
        return {"projectID": project_id, "displayName": "Test", "meetingSearchTerms": [],
                               "weeklyEffort": [{"weekStart": day, "developmentHours": work, "meetingHours": meeting}
                                                for day, work, meeting in weeks]}

    def snapshot(weeks, projects=None):
        payload = json.dumps(projects if projects is not None else [project(weeks)])
        return ("SET ROLE service_role;\nSET request.jwt.claims = '{\"role\":\"service_role\"}';\n"
                "SELECT public.amie_sync_tally_effort('ID001', '2026-10-05', '2026-10-26', '" + payload + "'::jsonb);\nRESET ROLE;\n")

    def state():
        return json.loads(run("""SELECT jsonb_build_object(
          'weeks',(SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('physical_row',ctid::text) ORDER BY project_id,member_id,week_start) FROM public.tally_weekly_effort_entries t),
          'settings',(SELECT jsonb_agg(to_jsonb(t) ORDER BY project_id,member_id) FROM public.tally_project_syncs t),
          'mutations',(SELECT jsonb_agg(to_jsonb(t)) FROM public.tally_test_mutations t),
          'history',(SELECT jsonb_agg(to_jsonb(t) ORDER BY occurred_at,id) FROM public.amd_os_data_change_history t));"""))

    def audit_fixture():
        source = (ROOT / "ios/supabase/migrations/20260916223000_os_data_change_history_and_workspace_access_requests.sql").read_text()
        table = re.search(r"CREATE TABLE IF NOT EXISTS public\.amd_os_data_change_history \([\s\S]*?\n\);", source)
        functions = [re.search(r"CREATE OR REPLACE FUNCTION public\." + name + r"\([\s\S]*?\n\$\$;", source)
                     for name in ("amd_os_block_change_history_mutation", "amd_os_sanitize_history_values", "amd_os_record_data_change")]
        assert table and all(functions), "Cannot extract exact repository audit fixture"
        return ("CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.role',true),'') $$;\n"
                + table.group(0) + "\n" + "\n".join(f.group(0) for f in functions) + "\n"
                "ALTER TABLE public.amd_os_data_change_history ENABLE ROW LEVEL SECURITY;\n"
                "REVOKE ALL ON public.amd_os_data_change_history FROM PUBLIC,anon,authenticated;\n"
                "CREATE TRIGGER amd_os_data_change_history_append_only BEFORE UPDATE OR DELETE ON public.amd_os_data_change_history FOR EACH ROW EXECUTE FUNCTION public.amd_os_block_change_history_mutation();\n"
                "CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tally_weekly_effort_entries FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id,member_id,week_start');\n"
                "CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.tally_project_syncs FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id,member_id');\n")

    def wait_lock(app, granted):
        query = ("SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING (pid) "
                 "WHERE l.locktype='advisory' AND a.application_name='" + app + "' AND l.granted=" + str(granted).lower() + ";")
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if run(query) == "1":
                return
            time.sleep(0.05)
        raise AssertionError(f"Expected advisory lock state was not observed for {app}")

    def concurrent(first, second, expected_mutations, first_end="COMMIT"):
        assert first_end in ("COMMIT", "ROLLBACK")
        run("TRUNCATE public.tally_test_mutations,public.amd_os_data_change_history;")
        unrelated = [row for row in state()["weeks"] if row["project_id"] != "test-a" or row["member_id"] != "ID001" or not "2026-10-05" <= row["week_start"] <= "2026-10-26"]
        a = subprocess.Popen(command + ["-d", database], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                             stderr=subprocess.PIPE, text=True, env=dict(env, PGAPPNAME="tally-test-a"))
        b = None
        try:
            a.stdin.write("BEGIN;\n" + snapshot(first))
            a.stdin.flush()
            wait_lock("tally-test-a", True)
            b = subprocess.Popen(command + ["-d", database], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE, text=True, env=dict(env, PGAPPNAME="tally-test-b"))
            b.stdin.write(snapshot(second))
            b.stdin.flush()
            wait_lock("tally-test-b", False)
            assert b.poll() is None, "second snapshot committed while first transaction held the lock"
            a.stdin.write(first_end + ";\n\\q\n")
            a.stdin.close()
            a.wait(timeout=10)
            assert a.returncode == 0, a.stderr.read()
            b.stdin.close()
            b.stdin = None
            _, errors = b.communicate(timeout=10)
            assert b.returncode == 0, errors
            actual = run("SELECT jsonb_agg(jsonb_build_array(week_start::text,development_hours,meeting_hours) ORDER BY week_start) FROM public.tally_weekly_effort_entries "
                         "WHERE project_id='test-a' AND member_id='ID001' AND week_start BETWEEN '2026-10-05' AND '2026-10-26';")
            assert json.loads(actual) == [list(week) for week in second], (actual, second)
            mutations = run("SELECT count(*) FROM public.tally_test_mutations WHERE table_name='tally_weekly_effort_entries';")
            assert int(mutations) == expected_mutations, (mutations, expected_mutations)
            history = run("SELECT count(*) FROM public.amd_os_data_change_history WHERE table_name='tally_weekly_effort_entries';")
            assert int(history) == expected_mutations, (history, expected_mutations)
            current_unrelated = [row for row in state()["weeks"] if row["project_id"] != "test-a" or row["member_id"] != "ID001" or not "2026-10-05" <= row["week_start"] <= "2026-10-26"]
            assert current_unrelated == unrelated, "Concurrent snapshots changed unrelated physical rows"
        finally:
            for process in (a, b):
                if process is not None and process.poll() is None:
                    process.terminate()
                    process.wait(timeout=10)

    def timeout_test(weeks):
        run("TRUNCATE public.tally_test_mutations,public.amd_os_data_change_history;")
        before = state()
        a = subprocess.Popen(command + ["-d", database], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                             stderr=subprocess.PIPE, text=True, env=dict(env, PGAPPNAME="tally-test-a"))
        try:
            a.stdin.write("BEGIN;\n" + snapshot(weeks))
            a.stdin.flush()
            wait_lock("tally-test-a", True)
            try:
                run("SET lock_timeout='200ms';\n" + snapshot(weeks), app="tally-test-timeout")
                raise AssertionError("Waiting sync unexpectedly succeeded")
            except RuntimeError as error:
                assert "55P03" in str(error), str(error)
            assert state() == before, "Timed-out sync persisted business/settings/audit changes"
            a.stdin.write("ROLLBACK;\n\\q\n")
            a.stdin.close()
            a.wait(timeout=10)
            assert a.returncode == 0, a.stderr.read()
            assert state() == before, "Held sync rollback left partial changes"
            assert run("SELECT count(*) FROM pg_locks WHERE locktype='advisory';") == "0"
        finally:
            if a.poll() is None:
                a.terminate()
                a.wait(timeout=10)

    existing_roles = set()
    created = False
    try:
        engine = run("SELECT version();", "postgres")
        assert 170000 <= int(run("SHOW server_version_num;", "postgres")) < 180000, "Requires native PostgreSQL 17"
        existing_roles = set(run("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');", "postgres").splitlines())
        run(f"CREATE DATABASE {database};", "postgres")
        created = True
        result = run(f"\\i {TESTS / 'tally_sync.sql'}\n")
        assert "PASS: Tally SQL regression assertions" in result
        names = re.findall(r"^SELECT pg_temp.assert_true\(.*?, '([^']+)'\);$", (TESTS / "tally_sync.sql").read_text(), re.MULTILINE)
        assert len(names) == 24, "SQL assertion labels changed"
        for name in names:
            passed(name)
        assert run("SELECT to_regclass('public.tally_weekly_effort_entries') IS NULL;") == "t"
        passed("SQL fixture transaction rolls back its schema")
        run(f"BEGIN;\n\\i {TESTS / 'tally_sync_fixture.sql'}\nCOMMIT;\n")
        run(audit_fixture())
        changed = [("2026-10-05", 10, 2), ("2026-10-12", 21, 3), ("2026-10-20", 6, 1), ("2026-10-26", 40, 5)]
        concurrent(changed, changed, 3)
        passed("independent-session identical resync waits and adds zero weekly mutations or actual histories")
        populated = [("2026-10-12", 7, 1), ("2026-10-26", 8, 2)]
        concurrent([], populated, 6)
        passed("independent-session empty/populated snapshots serialize with exact last values and scoped audit")
        concurrent(changed, populated, 0, first_end="ROLLBACK")
        passed("waiting snapshot after first-session rollback retains physical rows and zero failed-session audit")
        timeout_test(changed)
        passed("advisory lock timeout and held-session rollback leave no business/settings/audit change or retained lock")
        run("TRUNCATE public.tally_test_mutations,public.amd_os_data_change_history;")
        before = state()
        run("""CREATE FUNCTION public.tally_test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'fixture write failure' USING ERRCODE='P0002'; END $$;
          CREATE TRIGGER tally_test_failure BEFORE INSERT ON public.tally_weekly_effort_entries
          FOR EACH ROW WHEN (NEW.project_id='test-b') EXECUTE FUNCTION public.tally_test_fail_insert();""")
        try:
            run(snapshot([], projects=[project(changed), project([("2026-10-12",6,1)], "test-b")]))
            raise AssertionError("Injected second-project write failure did not occur")
        except RuntimeError as error:
            assert "P0002" in str(error), str(error)
        assert state() == before, "Actual audit/settings/business state survived failed transaction"
        passed("native second-project write failure rolls back all settings, business values and actual histories")
    except Exception as error:
        results.append({"name": "native PostgreSQL 17 validation", "status": "FAIL", "error": str(error)})
        raise
    finally:
        if created:
            run(f"DROP DATABASE {database} WITH (FORCE);", "postgres")
            cleanup["database_removed"] = run(f"SELECT NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='{database}');", "postgres") == "t"
            for role in ("anon", "authenticated", "service_role"):
                if role not in existing_roles:
                    run(f"DROP ROLE IF EXISTS {role};", "postgres")
            cleanup["new_fixture_roles_removed"] = set(run("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');", "postgres").splitlines()) == existing_roles
        if args.report:
            args.report.write_text(json.dumps({"status": "FAIL" if any(r["status"] == "FAIL" for r in results) else "PASS",
                "engine": engine, "total": len(results), "results": results, "cleanup": cleanup,
                "boundaries": ["Native independent PostgreSQL 17 sessions on loopback with synthetic fixture data only",
                    "Existing audit functions are real repository SQL; auth.role/JWT claims and dependency schema are fixtures",
                    "No PostgREST, deployed Edge, complete application schema or deadlock between unrelated writers is tested"]}, indent=2) + "\n")


if __name__ == "__main__":
    main()
