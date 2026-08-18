-- 289_seed_company_names_sx_cx.sql
-- /seeds の会社名正本を、まさ確定の名称へ訂正する。
-- p20/p21 は未設立のまま。法人化状態は commercialization_stage が保持する。

BEGIN;

UPDATE public.seed_projects
SET venture_name = CASE project_id
  WHEN 'p20' THEN 'CryoX'
  WHEN 'p21' THEN 'SolvioraX'
  ELSE venture_name
END,
updated_at = now()
WHERE project_id IN ('p20', 'p21')
  AND venture_name IS DISTINCT FROM CASE project_id
    WHEN 'p20' THEN 'CryoX'
    WHEN 'p21' THEN 'SolvioraX'
  END;

DO $$
BEGIN
  IF (SELECT venture_name FROM public.seed_projects WHERE project_id = 'p20') IS DISTINCT FROM 'CryoX' THEN
    RAISE EXCEPTION 'p20 CryoX の会社名訂正に失敗';
  END IF;
  IF (SELECT venture_name FROM public.seed_projects WHERE project_id = 'p21') IS DISTINCT FROM 'SolvioraX' THEN
    RAISE EXCEPTION 'p21 SolvioraX の会社名訂正に失敗';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.seed_projects
    WHERE project_id IN ('p20', 'p21')
      AND commercialization_stage IS DISTINCT FROM 'pre_incorporation'
  ) THEN
    RAISE EXCEPTION 'p20/p21 の未設立状態を変更してはいけない';
  END IF;
END $$;

COMMIT;
