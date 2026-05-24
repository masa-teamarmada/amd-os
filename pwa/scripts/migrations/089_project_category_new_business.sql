-- 089 project_category に 'new_business' を追加
-- ZMP (p19) のような「レガシー企業の DX + 研究シーズ取り込みによる新規事業創出」モデル PJ を
-- DTSU (= 学術発スタートアップ伴走) と分けるためのカテゴリ。
-- ロジック扱いは当面 DTSU と同じ (AMD Score 対象 / MS 進捗対象 / 関連メンバー扱い)。
-- まさ判断 2026-05-25。

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_project_category_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_project_category_check
  CHECK (project_category IN ('dtsu', 'ecosystem', 'advisor', 'new_business'));

UPDATE public.projects
SET project_category = 'new_business'
WHERE project_id = 'p19';

COMMENT ON COLUMN public.projects.project_category IS
  'AMD OS project category: dtsu (学術発SU伴走), ecosystem (研究機関SUエコシステム構築), advisor (社外役員/顧問), new_business (レガシー企業DX + 研究シーズ取込で新規事業創出). Ecosystem projects are excluded from AMD Score.';
