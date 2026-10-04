-- 2026-10-04 まさ指定: DDにガント・関係先・事業計画・知財・会社概要・資金調達履歴・沿革。
-- ページ単位の掲載を既存の公開/停止/失効経路に載せる。既存内容の公開状態・付与は変更しない。
BEGIN;
ALTER TABLE public.dd_package_items DROP CONSTRAINT dd_package_items_item_kind_check;
ALTER TABLE public.dd_package_items ADD CONSTRAINT dd_package_items_item_kind_check
  CHECK (item_kind IN ('document','tech_topic','funding_plan','capital_policy','cost_model','project_page'));
ALTER TABLE public.dd_package_items ADD CONSTRAINT dd_package_items_project_page_source_check
  CHECK (item_kind <> 'project_page' OR source_key IN (
    'project_page:gantt','project_page:partners','project_page:business-plan','project_page:ip',
    'project_page:company','project_page:capital-policy','project_page:activity'
  ));
COMMIT;
