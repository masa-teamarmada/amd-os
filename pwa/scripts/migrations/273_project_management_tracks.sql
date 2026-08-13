-- 273_project_management_tracks.sql
--
-- 経営管理ワークスペースの「柱」(track) をPJ属性へ一般化する。
-- まさ確定 2026-08-13:「SXワークスペースと同じコンテンツを石原先生用に作る方がよくない?」
-- 石原先生の産連業務は6領域 (YURUGAS運営 / 企業連携 / 教育 / 研究・論文 / 資金・申請 / 組織インフラ) で
-- 動いており、SXの4本柱 (事業開発 / 技術開発 / 資金調達 / 体制構築) 固定では同じ面へ載らない。
--
-- 変更:
--   1. project_management_tracks を新設 (PJごとの柱の定義。表示名・短縮名・色・並び順)
--   2. p21 へ既存4本柱をそのままseed (表示は1文字も変えない)
--   3. p30 (EHM = 愛媛大エコシステム構築PJ) へ石原先生の6領域をseed
--   4. 経営管理8テーブルの track 4値CHECK制約をDROPし、(project_id, track) の複合FKへ置き換える
--      → 「そのPJで定義された柱しか使えない」という、CHECK制約より強い防波堤になる
--
-- 触らないもの:
--   - project_management_milestones.display_lane_keys のCHECK (表示レーンは別軸)
--   - 既存p21の全データ (track値は4本柱のまま)
--   - **project_weekly_effort_entries.management_track**: 同じ4値を持つが概念が別。
--     こちらは「メンバーの仕事分類」で p00/p07/p10/p19/p20/p25 等の全PJ横断で使われており、
--     PJ固有の経営の柱ではない。4値CHECKのまま据え置く (FK対象外)。
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / ON CONFLICT DO UPDATE / 制約は存在チェック付き。

-- =====================================================================
-- 1. 柱マスタ
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.project_management_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  track_key text NOT NULL,
  label text NOT NULL,
  short_label text NOT NULL,
  accent text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, track_key)
);

COMMENT ON TABLE public.project_management_tracks IS
  'PJごとの経営管理の柱(track)定義。統合タイムラインのレーン、判定バー、論点・関係先の分類軸になる。p21は事業開発/技術開発/資金調達/体制構築、p30は石原先生の産連6領域。';

-- =====================================================================
-- 2. p21 = SolvioraX の既存4本柱 (表示値は現行UIのSX_TRACKSと同一)
-- =====================================================================
INSERT INTO public.project_management_tracks (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p21', 'business_development',   '事業開発', '事業', '#315f7d', 1),
  ('p21', 'technology_development', '技術開発', '技術', '#38745d', 2),
  ('p21', 'funding',                '資金調達', '資金', '#bf7b2c', 3),
  ('p21', 'organizational_building','体制構築', '体制', '#76637b', 4)
ON CONFLICT (project_id, track_key) DO UPDATE SET
  label = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  accent = EXCLUDED.accent,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =====================================================================
-- 3. p30 = EHM (愛媛大エコシステム構築 / 石原先生の産連業務) の6領域
--    出典: 石原_業務一覧_研究開発OS用_1.xlsx の「領域」列。番号6は元資料に存在しない。
-- =====================================================================
INSERT INTO public.project_management_tracks (project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('p30', 'yurugas_program',     'YURUGAS運営・基盤', 'YURUGAS', '#315f7d', 1),
  ('p30', 'corporate_alliance',  '企業連携・共創PJ',   '企業連携', '#38745d', 2),
  ('p30', 'education_program',   '教育プログラム',     '教育',    '#2f6f86', 3),
  ('p30', 'research_paper',      '研究・論文',         '研究',    '#76637b', 4),
  ('p30', 'funding_application', '資金・申請',         '資金',    '#bf7b2c', 5),
  ('p30', 'org_infrastructure',  '組織・運営インフラ', '組織',    '#6b6f76', 6)
ON CONFLICT (project_id, track_key) DO UPDATE SET
  label = EXCLUDED.label,
  short_label = EXCLUDED.short_label,
  accent = EXCLUDED.accent,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- =====================================================================
-- 4. updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_project_management_tracks_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.project_management_tracks;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.project_management_tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_management_tracks_updated_at();

-- =====================================================================
-- 5. RLS: 既存の project_management_* と同じ方針へ揃える
--    (読みは認証済みメンバー、書きはadmin/service_role。既存テーブルのポリシーを確認して合わせる)
-- =====================================================================
ALTER TABLE public.project_management_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_management_tracks_read ON public.project_management_tracks;
CREATE POLICY project_management_tracks_read ON public.project_management_tracks
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS project_management_tracks_admin_write ON public.project_management_tracks;
CREATE POLICY project_management_tracks_admin_write ON public.project_management_tracks
  FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS project_management_tracks_service_role ON public.project_management_tracks;
CREATE POLICY project_management_tracks_service_role ON public.project_management_tracks
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =====================================================================
-- 6. 事前assert: 既存の全track値が、この後張るFKを満たすこと
--    (満たさない行が1件でもあればFK作成が失敗するので、先に明示的に落とす)
-- =====================================================================
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM (
    SELECT project_id, track FROM public.project_management_capacity
    UNION ALL SELECT project_id, track FROM public.project_management_issues
    UNION ALL SELECT project_id, track FROM public.project_management_kpis
    UNION ALL SELECT project_id, track FROM public.project_management_milestones
    UNION ALL SELECT project_id, track FROM public.project_management_outcomes
    UNION ALL SELECT project_id, track FROM public.project_management_partner_tracks
    UNION ALL SELECT project_id, primary_track FROM public.project_management_partners
    UNION ALL SELECT project_id, track FROM public.project_management_tasks WHERE track IS NOT NULL
  ) AS used(project_id, track)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_management_tracks t
    WHERE t.project_id = used.project_id AND t.track_key = used.track
  );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION '既存データに、柱マスタへ登録されていない (project_id, track) が % 件ある。先に柱をseedすること', orphan_count;
  END IF;
END $$;

-- =====================================================================
-- 7. 4値CHECK制約をDROPし、複合FKへ置き換える
--    FKは「そのPJで定義された柱だけ」を強制するので、CHECKより強い。
-- =====================================================================
DO $$
DECLARE
  spec RECORD;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('project_management_capacity',      'track',         'project_management_capacity_track_check'),
      ('project_management_issues',        'track',         'project_management_issues_track_check'),
      ('project_management_kpis',          'track',         'project_management_kpis_track_check'),
      ('project_management_milestones',    'track',         'project_management_milestones_track_check'),
      ('project_management_outcomes',      'track',         'project_management_outcomes_track_check'),
      ('project_management_partner_tracks','track',         'project_management_partner_tracks_track_check'),
      ('project_management_partners',      'primary_track', 'project_management_partners_primary_track_check'),
      ('project_management_tasks',         'track',         'project_management_tasks_track_check')
    ) AS t(tbl, col, check_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', spec.tbl, spec.check_name);

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = spec.tbl || '_track_fk'
        AND conrelid = format('public.%I', spec.tbl)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (project_id, %I) REFERENCES public.project_management_tracks (project_id, track_key) ON UPDATE CASCADE ON DELETE RESTRICT',
        spec.tbl, spec.tbl || '_track_fk', spec.col
      );
    END IF;
  END LOOP;
END $$;

-- =====================================================================
-- 8. 事後assert
-- =====================================================================
DO $$
BEGIN
  IF (SELECT count(*) FROM public.project_management_tracks WHERE project_id = 'p21') <> 4 THEN
    RAISE EXCEPTION 'p21 の柱が4本になっていない';
  END IF;
  IF (SELECT count(*) FROM public.project_management_tracks WHERE project_id = 'p30') <> 6 THEN
    RAISE EXCEPTION 'p30 の柱が6本になっていない';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE conname LIKE '%_track_fk' AND contype = 'f') < 8 THEN
    RAISE EXCEPTION '柱の複合FKが8本揃っていない';
  END IF;
END $$;
