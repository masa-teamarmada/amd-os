-- 20260826150000_project_management_track_value_milestones.sql
--
-- project_management_tracks と value_milestones を結ぶ汎用 bridge table。
-- PJの管理柱(track)と価値マイルストーンの所属関係を記録。
--
-- 要件:
--   - bridge: UNIQUE (project_id, milestone_id) で、同一PJの1MSを1テーマに限定
--   - (project_id, track_key) → project_management_tracks FK
--   - milestone_id → value_milestones FK
--   - DB制約: project_id と MS が所属する plan_cycle.project_id の一致を強制（trigger）
--   - RLS: current workspace security contract（AMD member read、write=admin/service_role）
--   - updated_at trigger
--   - p19へ3テーマを冪等 seed: OkuDoor(okudoor), 葛飾水素(katsushika_hydrogen), KR経営改革(kr_management_reform)
--   - p19 active plan cycle の9 value_milestones をタイトル完全一致で冪等 seed（3/2/4配置）
--   - assert: 3テーマ、9接続、3/2/4分割
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / ON CONFLICT DO UPDATE。

BEGIN;

-- =====================================================================
-- 1. Bridge テーブル
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.project_management_track_value_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  milestone_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, track_key, milestone_id),
  UNIQUE (project_id, milestone_id),
  FOREIGN KEY (project_id, track_key)
    REFERENCES public.project_management_tracks (project_id, track_key)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (milestone_id)
    REFERENCES public.value_milestones (milestone_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.project_management_track_value_milestones IS
  'project_management_tracks と value_milestones の関連。1 value_milestone は同一 project 内の 1 track にのみ属する。PJの管理柱と価値マイルストーンを紐づける。';

COMMENT ON COLUMN public.project_management_track_value_milestones.project_id IS
  'プロジェクトID。track_key と組み合わせてproject_management_tracks へのFK。';

COMMENT ON COLUMN public.project_management_track_value_milestones.track_key IS
  'テーマキー(track_key)。project_id と組み合わせてproject_management_tracks へのFK。';

COMMENT ON COLUMN public.project_management_track_value_milestones.milestone_id IS
  'value_milestones.milestone_id。';

COMMENT ON COLUMN public.project_management_track_value_milestones.sort_order IS
  'テーマ内での表示順序。';

-- =====================================================================
-- 2. project_id と value_milestones.plan_cycle.project_id の一致を強制する trigger
-- =====================================================================

CREATE OR REPLACE FUNCTION public.check_project_management_track_value_milestones_project_match()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ms_project_id text;
BEGIN
  -- value_milestones から plan_cycle_id を経由してそのプロジェクトを取得
  SELECT vpc.project_id INTO ms_project_id
  FROM public.value_milestones vm
  JOIN public.value_plan_cycles vpc ON vpc.plan_cycle_id = vm.plan_cycle_id
  WHERE vm.milestone_id = NEW.milestone_id;

  IF ms_project_id IS NULL THEN
    RAISE EXCEPTION 'milestone % not found in value_milestones', NEW.milestone_id
      USING ERRCODE = '23503';
  END IF;

  IF ms_project_id <> NEW.project_id THEN
    RAISE EXCEPTION 'project_id % does not match milestone % project %',
      NEW.project_id, NEW.milestone_id, ms_project_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS check_project_match ON public.project_management_track_value_milestones;
CREATE TRIGGER check_project_match BEFORE INSERT OR UPDATE ON public.project_management_track_value_milestones
  FOR EACH ROW EXECUTE FUNCTION public.check_project_management_track_value_milestones_project_match();

-- =====================================================================
-- 3. updated_at trigger
-- =====================================================================

CREATE OR REPLACE FUNCTION public.touch_project_management_track_value_milestones_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.project_management_track_value_milestones;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.project_management_track_value_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_management_track_value_milestones_updated_at();

-- =====================================================================
-- 4. RLS: migration 213 の current workspace security contract と同等
-- =====================================================================

ALTER TABLE public.project_management_track_value_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_track_value_milestones_read ON public.project_management_track_value_milestones;
CREATE POLICY project_management_track_value_milestones_read ON public.project_management_track_value_milestones
  FOR SELECT TO authenticated USING (public.amd_os_is_member());

DROP POLICY IF EXISTS project_management_track_value_milestones_admin_write ON public.project_management_track_value_milestones;
CREATE POLICY project_management_track_value_milestones_admin_write ON public.project_management_track_value_milestones
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS project_management_track_value_milestones_service_role ON public.project_management_track_value_milestones;
CREATE POLICY project_management_track_value_milestones_service_role ON public.project_management_track_value_milestones
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- 5. p19 の3テーマを project_management_tracks へ追加（273で既に存在の可能性）
--    色: AMD青系 #315f7d / 水素シアン #2f6f86 / 琥珀系 #bf7b2c
-- =====================================================================

INSERT INTO public.project_management_tracks (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p19', 'okudoor', 'OkuDoor', 'OkuDoor', '#315f7d', 1),
  ('p19', 'katsushika_hydrogen', '葛飾水素循環', '水素', '#2f6f86', 2),
  ('p19', 'kr_management_reform', 'KR経営改革', 'KR', '#bf7b2c', 3)
ON CONFLICT (project_id, track_key) DO UPDATE SET
  label = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  accent = EXCLUDED.accent,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =====================================================================
-- 6. p19 の9 value_milestones をタイトル完全一致で冪等 seed
--
--    OkuDoor [3件] / 葛飾水素循環 [2件] / KR経営改革 [4件]
-- =====================================================================

DO $$
DECLARE
  v_plan_cycle_id text;
  v_okudoor_count int;
  v_hydrogen_count int;
  v_kr_count int;
BEGIN
  -- p19 のアクティブ plan cycle を取得
  SELECT plan_cycle_id INTO v_plan_cycle_id
  FROM public.value_plan_cycles
  WHERE project_id = 'p19' AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_plan_cycle_id IS NULL THEN
    RAISE EXCEPTION 'p19 active plan cycle not found';
  END IF;

  -- OkuDoor テーマ（3つのMS）
  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'okudoor', vm.milestone_id, 1, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = 'OkuDoor運営巻き取り戦略・契約スキーム設計'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'okudoor', vm.milestone_id, 2, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = 'OkuDoorシステム開発'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'okudoor', vm.milestone_id, 3, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = 'OkuDoor現地運用・オープン検証'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  -- 水素テーマ（2つのMS）
  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'katsushika_hydrogen', vm.milestone_id, 1, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = '水素 助成金・補助金申請'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'katsushika_hydrogen', vm.milestone_id, 2, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = '水素 産学連携・フェーズ2事業開発'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  -- KR経営改革テーマ（4つのMS）
  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'kr_management_reform', vm.milestone_id, 1, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = '定例運営'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'kr_management_reform', vm.milestone_id, 2, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = '事務手続き（請求・経費精算）'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'kr_management_reform', vm.milestone_id, 3, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = 'SEAMS変更登記準備（法人化中止につき終了）'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  INSERT INTO public.project_management_track_value_milestones
    (project_id, track_key, milestone_id, sort_order, created_at, updated_at)
  SELECT 'p19', 'kr_management_reform', vm.milestone_id, 4, now(), now()
  FROM public.value_milestones vm
  WHERE vm.plan_cycle_id = v_plan_cycle_id
    AND vm.title = '採用支援'
    AND vm.is_active = true
  ON CONFLICT (project_id, milestone_id) DO UPDATE SET
    track_key = EXCLUDED.track_key,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  -- Assert: p19 の3テーマ、9接続、3/2/4分割
  SELECT count(*) INTO v_okudoor_count
  FROM public.project_management_track_value_milestones
  WHERE project_id = 'p19' AND track_key = 'okudoor';

  SELECT count(*) INTO v_hydrogen_count
  FROM public.project_management_track_value_milestones
  WHERE project_id = 'p19' AND track_key = 'katsushika_hydrogen';

  SELECT count(*) INTO v_kr_count
  FROM public.project_management_track_value_milestones
  WHERE project_id = 'p19' AND track_key = 'kr_management_reform';

  IF v_okudoor_count <> 3 THEN
    RAISE EXCEPTION 'OkuDoor milestone count is %, expected 3', v_okudoor_count;
  END IF;
  IF v_hydrogen_count <> 2 THEN
    RAISE EXCEPTION '水素 milestone count is %, expected 2', v_hydrogen_count;
  END IF;
  IF v_kr_count <> 4 THEN
    RAISE EXCEPTION 'KR経営改革 milestone count is %, expected 4', v_kr_count;
  END IF;

END $$;

-- =====================================================================
-- 7. 事後 assert: 3テーマ、9接続、3/2/4分割
-- =====================================================================

DO $$
BEGIN
  -- OkuDoor テーマに3つのMS
  IF (SELECT count(*) FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'okudoor') <> 3 THEN
    RAISE EXCEPTION 'OkuDoor theme does not have exactly 3 milestones';
  END IF;

  -- 葛飾水素テーマに2つのMS
  IF (SELECT count(*) FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'katsushika_hydrogen') <> 2 THEN
    RAISE EXCEPTION '葛飾水素 theme does not have exactly 2 milestones';
  END IF;

  -- KR経営改革テーマに4つのMS
  IF (SELECT count(*) FROM public.project_management_track_value_milestones WHERE project_id = 'p19' AND track_key = 'kr_management_reform') <> 4 THEN
    RAISE EXCEPTION 'KR経営改革 theme does not have exactly 4 milestones';
  END IF;

END $$;

COMMIT;
