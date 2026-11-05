-- L2M専用データが誤って入ったAMD OS変更履歴を、対象表だけに限定して除去する。
-- 監査表の追記専用保護はこのtransactionの外では常に有効。
BEGIN;

CREATE OR REPLACE FUNCTION public.amd_os_block_change_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('amd_os.purge_l2m_history', true) = 'on'
     AND public.amd_os_history_is_l2m_table(OLD.table_name) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'amd_os_data_change_history is append-only';
END;
$$;

SET LOCAL amd_os.purge_l2m_history = 'on';

DO $$
DECLARE
  v_l2m_tables text[];
  v_removed bigint;
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_l2m_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND public.amd_os_history_is_l2m_table(c.relname);

  IF cardinality(v_l2m_tables) <> 20 THEN
    RAISE EXCEPTION 'L2M table inventory changed: %', cardinality(v_l2m_tables);
  END IF;

  DELETE FROM public.amd_os_data_change_history
  WHERE table_name = ANY(v_l2m_tables);
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RAISE NOTICE 'Removed % L2M rows from AMD OS history', v_removed;

  IF EXISTS (
    SELECT 1 FROM public.amd_os_data_change_history
    WHERE table_name = ANY(v_l2m_tables)
  ) THEN
    RAISE EXCEPTION 'L2M history rows remain';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.amd_os_block_change_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'amd_os_data_change_history is append-only';
END;
$$;

COMMIT;
