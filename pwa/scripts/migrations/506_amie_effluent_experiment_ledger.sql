BEGIN;
-- 廃液の種類・入手元・処理前後・実験状態を既存の技術台帳へ保持する。
-- 権限はproject_tech_entriesの既存RLSを維持。旧クライアントには任意の追加JSON列。
ALTER TABLE public.project_tech_entries ADD COLUMN IF NOT EXISTS experiment jsonb;
ALTER TABLE public.project_tech_entries ADD CONSTRAINT amie_effluent_experiment_valid CHECK (
  experiment IS NULL OR coalesce(
    jsonb_typeof(experiment) = 'object'
    AND experiment->>'version' = '1'
    AND jsonb_typeof(experiment->'type_key') = 'string'
    AND length(btrim(experiment->>'type_key')) BETWEEN 1 AND 160
    AND experiment->>'kind' IN ('actual','simulated','reference','unknown')
    AND experiment->>'status' IN ('not_received','received','running','completed','unknown')
    AND jsonb_typeof(experiment->'identity_confirmed') = 'boolean'
    AND jsonb_typeof(experiment->'provider') = 'string'
    AND jsonb_typeof(experiment->'components') = 'string'
    AND jsonb_typeof(experiment->'before') = 'string'
    AND jsonb_typeof(experiment->'after') = 'string'
    AND (experiment->>'status' <> 'completed' OR (
      length(btrim(experiment->>'after')) > 0
      AND length(btrim(coalesce(source_ref,''))) > 0
    )), false)
);
COMMENT ON COLUMN public.project_tech_entries.experiment IS '廃液実験version=1。種類キー、実廃液/模擬/参考試料、入手元・成分・処理前後・状態・種類照合・出典参照を保持。完了は試験結果の取得を示し処理成功・再現性保証を意味しない。';
COMMIT;
