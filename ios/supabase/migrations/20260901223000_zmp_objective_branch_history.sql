-- ZMP objective structure: connect approach tasks to their counterparties and seed the
-- user-confirmed supplier-search branches. The same canonical task and partner ledgers remain
-- the source of truth; this adds only the missing task -> partner edge used by the objective tree.

BEGIN;

ALTER TABLE public.project_management_tasks
  ADD COLUMN IF NOT EXISTS partner_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_management_tasks_partner_fk'
      AND conrelid = 'public.project_management_tasks'::regclass
  ) THEN
    ALTER TABLE public.project_management_tasks
      ADD CONSTRAINT project_management_tasks_partner_fk
      FOREIGN KEY (partner_id)
      REFERENCES public.project_management_partners(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_management_tasks_partner_idx
  ON public.project_management_tasks(project_id, partner_id)
  WHERE partner_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.project_management_tasks.partner_id IS
  'このタスクが特定の関係先へのアプローチを表す場合の関係先。目的構造ではタスク配下に同じ関係先の接点履歴を表示する。';

-- Keep the existing task hierarchy guard and add a same-project/live-partner check.
CREATE OR REPLACE FUNCTION public.project_management_task_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  milestone_project text;
  parent_project text;
  parent_milestone uuid;
  parent_track text;
  parent_deleted timestamptz;
  partner_project text;
  creates_cycle boolean;
BEGIN
  IF NEW.milestone_id IS NOT NULL THEN
    SELECT project_id INTO milestone_project
    FROM public.project_management_milestones
    WHERE id = NEW.milestone_id AND deleted_at IS NULL;
    IF milestone_project IS NULL OR milestone_project <> NEW.project_id THEN
      RAISE EXCEPTION 'task milestone must stay inside the project' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.partner_id IS NOT NULL THEN
    SELECT project_id INTO partner_project
    FROM public.project_management_partners
    WHERE id = NEW.partner_id AND deleted_at IS NULL;
    IF partner_project IS NULL OR partner_project <> NEW.project_id THEN
      RAISE EXCEPTION 'task partner must be active and inside the project' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT project_id, milestone_id, track, deleted_at
      INTO parent_project, parent_milestone, parent_track, parent_deleted
    FROM public.project_management_tasks
    WHERE id = NEW.parent_task_id;
    IF parent_project IS NULL OR parent_deleted IS NOT NULL
       OR parent_project <> NEW.project_id
       OR parent_milestone IS DISTINCT FROM NEW.milestone_id
       OR (NEW.milestone_id IS NULL AND parent_track IS DISTINCT FROM NEW.track) THEN
      RAISE EXCEPTION 'parent task must be active and in the same project, milestone and theme' USING ERRCODE = '23514';
    END IF;
    IF NEW.parent_task_id = NEW.id THEN
      RAISE EXCEPTION 'task cannot be its own parent' USING ERRCODE = '23514';
    END IF;
    WITH RECURSIVE ancestors(id, parent_task_id) AS (
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      WHERE t.id = NEW.parent_task_id
      UNION ALL
      SELECT t.id, t.parent_task_id
      FROM public.project_management_tasks t
      JOIN ancestors a ON t.id = a.parent_task_id
      WHERE t.project_id = NEW.project_id
    )
    SELECT EXISTS (SELECT 1 FROM ancestors WHERE id = NEW.id) INTO creates_cycle;
    IF creates_cycle THEN
      RAISE EXCEPTION 'task hierarchy would create a cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_management_tasks_guard ON public.project_management_tasks;
CREATE TRIGGER project_management_tasks_guard
BEFORE INSERT OR UPDATE OF project_id, milestone_id, parent_task_id, partner_id, track
ON public.project_management_tasks
FOR EACH ROW EXECUTE FUNCTION public.project_management_task_guard();

-- シーズリスト作成から、相手別アプローチと継続探索へ3分岐する。
INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, parent_task_id, partner_id, track, title, description,
   status, progress_pct, date_certainty, owner_label, goal, next_deliverable, blocker,
   completion_criteria, sort_order, last_verified_at, confidence, source_kind, source_ref)
VALUES
  (
    '19000000-2026-4000-8000-000000001407', 'p19',
    '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001401',
    '19000000-2026-4000-8000-000000001501', 'katsushika_hydrogen',
    '東京理科大学・堂脇先生へのアプローチ',
    'コンタクト後にMTGを実施し、やりとりを継続したが、先方からレスがなく一旦停止。',
    'blocked', 75, 'provisional', '担当未確認',
    '水素技術・研究連携の可能性を確認する',
    '再開条件が生じた場合に再評価する',
    '先方からレスがなく、現時点では進展なし。',
    '再開条件または終了判断が確認できる', 1, '2026-09-01', 'high', 'manual',
    'まさ確認 2026-09-01。日付が確認できた出来事だけ関係先履歴に置く。'
  ),
  (
    '19000000-2026-4000-8000-000000001408', 'p19',
    '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001401',
    '19000000-2026-4000-8000-000000001502', 'katsushika_hydrogen',
    'pHydrogenへのアプローチ',
    '水素のつくり手候補として供給・実証への参加を相談し、具体化を継続する。',
    'attention', 60, 'provisional', '担当未確認',
    '水素供給条件とH2購入型PoCの成立条件を揃える',
    '供給量・時期・単価・稼働枠とPoC成功条件を確認する',
    'AMD側に次の確認アクションがある。',
    '供給条件とPoC成功条件が根拠付きで揃う', 2, '2026-09-01', 'high', 'manual',
    'まさ確認 2026-09-01。期限・担当者は未確認。'
  ),
  (
    '19000000-2026-4000-8000-000000001409', 'p19',
    '19000000-2026-4000-8000-000000001201', '19000000-2026-4000-8000-000000001401',
    NULL, 'katsushika_hydrogen',
    'その他の供給候補を探索',
    '堂脇先生・pHydrogen以外の水素供給候補を継続して探索する。',
    'not_started', 0, 'provisional', '担当未確認',
    '比較できる供給候補を増やす',
    '新しい供給候補を追加し、アプローチ可否を判断する',
    NULL,
    '候補の名称・供給可能性・次のアプローチが確認できる', 3, '2026-09-01', 'medium', 'manual',
    'まさ確認 2026-09-01。具体候補は未確認。'
  )
ON CONFLICT (id) DO NOTHING;

-- 堂脇先生アプローチの表示順を、コンタクト→MTG→継続→一旦停止として明示する。
INSERT INTO public.project_management_partner_interactions
  (id, project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision,
   summary, outcome_summary, ball_side_after, ball_owner_after, actor_side, actor_label,
   confidence, source_kind, source_ref, detail_md)
VALUES (
  '19000000-2026-4000-8000-000000001600', 'p19',
  '19000000-2026-4000-8000-000000001501', 'email', NULL, 'unknown',
  'コンタクト', '東京理科大学の産学連携部門を通じて堂脇先生への接続を開始した。',
  'partner', NULL, 'sx', NULL, 'high', 'manual', 'まさ確認 2026-09-01',
  'コンタクトの実施日は未確認。'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.project_management_partner_interactions
SET summary = 'MTG実施',
    outcome_summary = '東京理科大学の産学連携部門とMTGを実施し、堂脇先生・他の水素/GX研究者への接続を依頼した。',
    confidence = 'high', source_kind = 'manual', source_ref = 'まさ確認 2026-09-01'
WHERE id = '19000000-2026-4000-8000-000000001601';

UPDATE public.project_management_partner_interactions
SET summary = 'やりとり継続・返答待ち',
    outcome_summary = '再連絡する方針でやりとりを継続したが、先方からの回答は得られていない。',
    confidence = 'high', source_kind = 'manual', source_ref = 'まさ確認 2026-09-01'
WHERE id = '19000000-2026-4000-8000-000000001602';

UPDATE public.project_management_partner_interactions
SET summary = '先方からレスなし・一旦停止',
    outcome_summary = '進展がなく研究協力も未成立のため、堂脇先生へのアプローチを一旦停止した。',
    confidence = 'high', source_kind = 'manual', source_ref = 'まさ確認 2026-09-01'
WHERE id = '19000000-2026-4000-8000-000000001603';

DO $$
DECLARE
  branch_count integer;
  linked_count integer;
  dowaki_event_count integer;
BEGIN
  SELECT count(*) INTO branch_count
  FROM public.project_management_tasks
  WHERE project_id = 'p19'
    AND parent_task_id = '19000000-2026-4000-8000-000000001401'
    AND deleted_at IS NULL;
  IF branch_count <> 3 THEN
    RAISE EXCEPTION 'ZMP supplier approach branches incomplete: expected 3, got %', branch_count;
  END IF;

  SELECT count(*) INTO linked_count
  FROM public.project_management_tasks
  WHERE project_id = 'p19'
    AND id IN (
      '19000000-2026-4000-8000-000000001407',
      '19000000-2026-4000-8000-000000001408'
    )
    AND partner_id IS NOT NULL
    AND deleted_at IS NULL;
  IF linked_count <> 2 THEN
    RAISE EXCEPTION 'ZMP approach task partner links incomplete: expected 2, got %', linked_count;
  END IF;

  SELECT count(*) INTO dowaki_event_count
  FROM public.project_management_partner_interactions
  WHERE project_id = 'p19'
    AND partner_id = '19000000-2026-4000-8000-000000001501'
    AND deleted_at IS NULL;
  IF dowaki_event_count <> 4 THEN
    RAISE EXCEPTION 'ZMP Dowaki history incomplete: expected 4, got %', dowaki_event_count;
  END IF;
END $$;

COMMIT;
