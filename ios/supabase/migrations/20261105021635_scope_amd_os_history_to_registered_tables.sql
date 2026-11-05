-- 監査対象をAMD OS専用の明示登録へ固定する。新しいpublic tableは自動監査しない。
BEGIN;

CREATE SCHEMA IF NOT EXISTS amd_os_internal;
REVOKE ALL ON SCHEMA amd_os_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS amd_os_internal.history_table_scope (
  table_name text PRIMARY KEY,
  registered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE amd_os_internal.history_table_scope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON amd_os_internal.history_table_scope FROM PUBLIC, anon, authenticated;

-- 既にAMD OS監査が稼働していた表だけを初期登録する。
INSERT INTO amd_os_internal.history_table_scope(table_name)
SELECT c.relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND t.tgname = 'amd_os_data_change_history_trigger'
  AND NOT t.tgisinternal
  AND t.tgenabled <> 'D'
  AND NOT public.amd_os_history_is_l2m_table(c.relname)
ON CONFLICT (table_name) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM amd_os_internal.history_table_scope)
     OR EXISTS (
       SELECT 1 FROM amd_os_internal.history_table_scope s
       WHERE public.amd_os_history_is_l2m_table(s.table_name)
     ) THEN
    RAISE EXCEPTION 'Invalid AMD OS audit table scope';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.amd_os_refresh_data_change_history_triggers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table record;
  v_pk_columns text;
  v_count integer := 0;
BEGIN
  FOR v_table IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND c.relname <> 'amd_os_data_change_history'
    ORDER BY c.relname
  LOOP
    IF public.amd_os_history_is_l2m_table(v_table.relname)
       OR NOT EXISTS (
         SELECT 1 FROM amd_os_internal.history_table_scope s
         WHERE s.table_name = v_table.relname
       ) THEN
      IF EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = v_table.oid
          AND tgname = 'amd_os_data_change_history_trigger'
          AND tgenabled <> 'D'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER amd_os_data_change_history_trigger', v_table.relname);
      END IF;
      CONTINUE;
    END IF;

    SELECT string_agg(a.attname, ',' ORDER BY k.ordinality)
      INTO v_pk_columns
      FROM pg_index i
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
     WHERE i.indrelid = v_table.oid
       AND i.indisprimary;

    EXECUTE format('DROP TRIGGER IF EXISTS amd_os_data_change_history_trigger ON public.%I', v_table.relname);
    EXECUTE format(
      'CREATE TRIGGER amd_os_data_change_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change(%L)',
      v_table.relname,
      COALESCE(v_pk_columns, '')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

COMMIT;
