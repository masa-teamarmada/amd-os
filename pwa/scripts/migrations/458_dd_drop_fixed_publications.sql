-- 458_dd_drop_fixed_publications.sql
--
-- 目的:
--   DDパッケージの「公開した時点で固定した版」の仕組みを外す（第2段）。457 で公開の切り替え（is_published）へ移し、
--   新しい画面（最新の内容をワークスペースと同じ部品で表示する）を本番へ反映したあとに当てる。
--   設計: pwa/spec/5-17-dd-package-current-spec.md。
--
-- 変更:
--   - dd_package_items.published_publication_id（固定した版への参照）と、その制約を外す。
--   - dd_publish_item() を削除する。
--   - dd_item_publications はこれまでの記録として残す（行の追加・更新・削除はできない）。
--   - 使わなくなった表示の選択（source_options の lastEventId / includedParts）を外す。
--
-- 冪等性: DROP ... IF EXISTS、選択の除去は該当するキーがある行だけ。

BEGIN;

SELECT set_config('app.workspace_migration', '458', true);

-- 457 の移行から漏れた公開中の項目が無いことを確かめてから外す。
DO $$
DECLARE
  v_pending INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dd_package_items' AND column_name = 'published_publication_id'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.dd_package_items WHERE published_publication_id IS NOT NULL AND NOT is_published'
      INTO v_pending;
  END IF;
  IF v_pending > 0 THEN
    RAISE EXCEPTION '固定版を指したまま is_published へ移っていない項目がある（457 を先に当てる）';
  END IF;
END;
$$;

ALTER TABLE public.dd_package_items DROP CONSTRAINT IF EXISTS dd_package_items_archived_unpublished;
ALTER TABLE public.dd_package_items DROP CONSTRAINT IF EXISTS dd_package_items_published_publication_fkey;
ALTER TABLE public.dd_package_items DROP COLUMN IF EXISTS published_publication_id;

DROP FUNCTION IF EXISTS public.dd_publish_item(UUID, TEXT, JSONB, JSONB, TIMESTAMPTZ, JSONB, JSONB, TEXT);

-- 固定版の作り方の選択（資本政策のラウンドの区切り・載せる範囲）は使わなくなったので外す（中身はワークスペースと同じにする）。
UPDATE public.dd_package_items
SET source_options = source_options - 'lastEventId' - 'includedParts'
WHERE source_options ?| ARRAY['lastEventId', 'includedParts'];

COMMENT ON TABLE public.dd_package_items IS
  'DDに載せる項目（内部の選択）。is_published = TRUE の項目だけが外部（DDの閲覧者）に見え、閲覧のたびに元データの最新を表示する。新しい項目は FALSE（非公開）で作る。';
COMMENT ON COLUMN public.dd_package_items.source_options IS
  '表示の選択（例: 元データの要確認・未定を未確認事項へ自動で加えるか）。';
COMMENT ON TABLE public.dd_item_publications IS
  '（2026-09-30 廃止）公開した時点で固定した版の記録。DDは最新の内容を見せる方式へ変えたため、新しい行は作らない。これまでの記録として残す（更新・削除は trigger で拒否）。';

SELECT public.amd_os_refresh_data_change_history_triggers();

COMMIT;
