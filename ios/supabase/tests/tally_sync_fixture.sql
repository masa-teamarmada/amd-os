-- Only for a disposable local test database. The Python runner creates one.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE TABLE public.projects (project_id text PRIMARY KEY);
CREATE TABLE public.members (member_id text PRIMARY KEY);
INSERT INTO public.projects VALUES ('test-a'), ('test-b');
INSERT INTO public.members VALUES ('ID001'), ('ID002');
\ir ../../../pwa/scripts/migrations/307_tally_effort_sync.sql
\ir ../../../pwa/scripts/migrations/501_tally_differential_sync.sql

-- Record EVERY row mutation, even identical UPDATEs. This is stricter than the
-- production audit's meaningful-change guard and proves no hidden row churn.
CREATE TABLE public.tally_test_mutations (
  table_name text, operation text, before_row jsonb, after_row jsonb
);
CREATE FUNCTION public.tally_test_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.tally_test_mutations VALUES (
    TG_TABLE_NAME, TG_OP,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END
  );
  RETURN NULL;
END $$;
CREATE TRIGGER tally_test_audit AFTER INSERT OR UPDATE OR DELETE ON public.tally_weekly_effort_entries
  FOR EACH ROW EXECUTE FUNCTION public.tally_test_record_mutation();
CREATE TRIGGER tally_test_audit AFTER INSERT OR UPDATE OR DELETE ON public.tally_project_syncs
  FOR EACH ROW EXECUTE FUNCTION public.tally_test_record_mutation();
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.projects, public.members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tally_project_syncs, public.tally_weekly_effort_entries TO service_role;
GRANT INSERT ON public.tally_test_mutations TO service_role;

INSERT INTO public.tally_weekly_effort_entries (project_id, member_id, week_start, development_hours, meeting_hours, synced_at) VALUES
  ('test-a', 'ID001', '2026-09-28', 1, 1, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID001', '2026-10-05', 10, 2, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID001', '2026-10-12', 20, 3, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID001', '2026-10-19', 30, 4, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID001', '2026-10-26', 40, 5, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID001', '2026-11-02', 2, 2, '2026-10-01T00:00:00Z'),
  ('test-a', 'ID002', '2026-10-05', 3, 3, '2026-10-01T00:00:00Z'),
  ('test-b', 'ID001', '2026-10-05', 4, 4, '2026-10-01T00:00:00Z');
TRUNCATE public.tally_test_mutations;
