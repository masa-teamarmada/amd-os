-- 2026-10-15 まさ指定: PoCリストを技術から独立し、3領域の共通メニューへ。
-- 既存7ページを保持して1ページ追加。入場権限・NDA・Storage公開設定は変更しない。
BEGIN;
ALTER TABLE public.dd_package_items DROP CONSTRAINT dd_package_items_project_page_source_check;
ALTER TABLE public.dd_package_items ADD CONSTRAINT dd_package_items_project_page_source_check
  CHECK (item_kind <> 'project_page' OR source_key IN (
    'project_page:gantt','project_page:partners','project_page:business-plan','project_page:ip',
    'project_page:company','project_page:capital-policy','project_page:activity','project_page:poc-list'
  ));
COMMIT;
