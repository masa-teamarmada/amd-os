-- 178_retire_project_venture_display_name.sql
--
-- PJ 文脈で使っていた project_ventures.display_name を廃止する。
-- 併せて public schema 内の "LisTie" 表記を "LiSTie" に一括補正し、
-- project_knowledge の旧 "PJ 表示名" 事実を canonical な "PJ名" へ寄せる。
--
-- 実行:
--   cd pwa && python3 -X utf8 scripts/apply_ddl.py scripts/migrations/178_retire_project_venture_display_name.sql
--   適用後:
--   cd pwa && python3 -X utf8 scripts/dump_schema.py

-- ============================================================
-- 1. public の base table 全 text / varchar / char 列について
--    "LisTie" -> "LiSTie" を一括置換する。
-- ============================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'character')
      AND COALESCE(c.is_generated, 'NEVER') = 'NEVER'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      rec.table_schema,
      rec.table_name,
      rec.column_name,
      rec.column_name,
      'LisTie',
      'LiSTie',
      rec.column_name,
      '%LisTie%'
    );
  END LOOP;
END $$;

-- ============================================================
-- 2. 旧 "PJ 表示名" basic_fact を canonical な "PJ名" へ置換する。
--    fact_text は projects.project_name を正本にする。
-- ============================================================
UPDATE public.project_knowledge pk
SET entity_name = 'PJ名',
    fact_text = COALESCE(p.project_name, pk.project_id),
    updated_at = now()
FROM public.projects p
WHERE pk.project_id = p.project_id
  AND pk.entity_name = 'PJ 表示名';

-- ============================================================
-- 3. display_name 列を削除する。
-- ============================================================
ALTER TABLE public.project_ventures
  DROP COLUMN IF EXISTS display_name;
