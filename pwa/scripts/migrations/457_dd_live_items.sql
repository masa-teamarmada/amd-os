-- 457_dd_live_items.sql
--
-- 目的:
--   DDパッケージを「公開した時点で固定した版」から「ワークスペースの最新の内容をそのまま見せる」へ切り替える（第1段）。
--   2026-09-30 まさ「これは正式な提出版ではなく、あくまでワークスペースの最新版を見てもらいたいだけなので、
--   中身を変えたらちゃんと変わるようにしてほしい」「コックピット、ワークスペース、DDパッケのどこから見ても同じ内容」
--   「とある時点のバージョンを正式版として提出しなきゃいけないので、PDFとして出力できる機能」。
--   設計: pwa/spec/5-17-dd-package-current-spec.md。
--
-- 2段に分ける理由:
--   いま動いている画面は published_publication_id を読む。この段では足すだけにして、新しい画面を反映したあとに
--   458 で固定版の仕組み（published_publication_id と dd_publish_item）を外す。
--
-- この段の変更:
--   - dd_package_items に公開の切り替え（is_published / published_at / published_by_member_id）を足す。
--     公開中の項目は、閲覧のたびに元データの最新をワークスペースと同じ部品で表示する。
--   - 固定版を指していた項目（公開中）を is_published へ移す。
--   - 正式版の PDF 出力の記録は workspace_access_audit_logs（event_type = 'dd_package_exported'）に残す（表は足さない）。
--
-- 不変条件（455 から引き継ぐ）:
--   - DDへ入れる根拠は dd_package_grants の行だけ。ワークスペースの所属とは独立。
--   - 新しい項目は非公開（is_published = FALSE）で作る。外した項目（archived）は公開できない。
--   - 物理削除はしない。行変更は同じ transaction で監査に残す（455 の trigger をそのまま使う）。
--
-- 冪等性: ADD COLUMN IF NOT EXISTS、制約は DROP IF EXISTS + ADD、移行は published_publication_id が残っているときだけ行う。

BEGIN;

SELECT set_config('app.workspace_migration', '457', true);

ALTER TABLE public.dd_package_items
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by_member_id TEXT REFERENCES public.members(member_id) ON DELETE RESTRICT;

-- 固定版を指していた項目（公開中）を、公開中の切り替えへ移す。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dd_package_items' AND column_name = 'published_publication_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.dd_package_items i
      SET is_published = TRUE,
          published_at = p.published_at,
          published_by_member_id = p.published_by_member_id
      FROM public.dd_item_publications p
      WHERE i.published_publication_id = p.id
        AND NOT i.is_published
    $sql$;
  END IF;
END;
$$;

ALTER TABLE public.dd_package_items DROP CONSTRAINT IF EXISTS dd_package_items_archived_not_published;
ALTER TABLE public.dd_package_items
  ADD CONSTRAINT dd_package_items_archived_not_published CHECK (status = 'active' OR NOT is_published);
ALTER TABLE public.dd_package_items DROP CONSTRAINT IF EXISTS dd_package_items_published_stamp;
ALTER TABLE public.dd_package_items
  ADD CONSTRAINT dd_package_items_published_stamp CHECK (NOT is_published OR published_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS dd_package_items_published_idx
  ON public.dd_package_items(package_id, section_key, sort_order)
  WHERE is_published AND status = 'active';

COMMENT ON COLUMN public.dd_package_items.is_published IS
  '外部（DDの閲覧者）に見せるか。見せる項目は、固定した版ではなく元データの最新をワークスペースと同じ部品で表示する。新しい項目は FALSE（非公開）で作る。';

-- SOL のパッケージには、まだ誰にも閲覧権限を付けていないことを確かめる（投資家への付与は今回しない）。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.dd_package_grants g
    JOIN public.dd_packages p ON p.id = g.package_id
    WHERE p.slug = 'sol'
  ) THEN
    RAISE EXCEPTION 'sol の DD パッケージに閲覧権限がある（このmigrationの前提と違う）';
  END IF;
END;
$$;

SELECT public.amd_os_refresh_data_change_history_triggers();

COMMIT;
