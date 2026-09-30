-- DDパッケージ（migration 455〜458）の DB 側の約束を、本番 DB 上で確かめる検査。
-- 最後に必ず ROLLBACK するので、行・監査記録・変更履歴は何も残らない（Storage には触れない）。
-- 実行: python3 -X utf8 scripts/apply_ddl.py scripts/dd_package_db_readback.sql
-- 失敗すると RAISE EXCEPTION で止まり、応答が FAIL になる。

BEGIN;

DO $$
DECLARE
  v_pkg UUID;
  v_item UUID;
  v_account UUID;
  v_old_pub UUID;
  v_failed BOOLEAN;
BEGIN
  SELECT id INTO v_pkg FROM public.dd_packages WHERE slug = 'sol' AND project_id = 'p21';
  IF v_pkg IS NULL THEN RAISE EXCEPTION 'SOL package is missing'; END IF;

  -- 1. 固定した版の仕組み（公開版を指す列・公開版を作る関数）は無い
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dd_package_items' AND column_name = 'published_publication_id'
  ) THEN
    RAISE EXCEPTION 'published_publication_id must be dropped (458)';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'dd_publish_item') THEN
    RAISE EXCEPTION 'dd_publish_item must be dropped (458)';
  END IF;

  -- 2. 項目は非公開（is_published = false）で作られる
  INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, title)
  VALUES (v_pkg, 'p21', 'capital', 'capital_policy', 'project_capital_plan:readback-test', '検査用')
  RETURNING id INTO v_item;
  IF (SELECT is_published FROM public.dd_package_items WHERE id = v_item) THEN
    RAISE EXCEPTION 'new item must start unpublished';
  END IF;

  -- 3. パッケージとPJの組が合わない項目は作れない
  v_failed := FALSE;
  BEGIN
    INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, title)
    VALUES (v_pkg, 'p00', 'capital', 'capital_policy', 'project_capital_plan:mismatch', 'x');
  EXCEPTION WHEN foreign_key_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'item with mismatched project must fail'; END IF;

  -- 4. 公開には公開した日時が要る
  v_failed := FALSE;
  BEGIN
    UPDATE public.dd_package_items SET is_published = TRUE, published_at = NULL WHERE id = v_item;
  EXCEPTION WHEN check_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'publishing without published_at must fail'; END IF;

  -- 5. 公開する・公開をやめるの切り替え
  UPDATE public.dd_package_items SET is_published = TRUE, published_at = NOW() WHERE id = v_item;
  IF NOT (SELECT is_published FROM public.dd_package_items WHERE id = v_item) THEN RAISE EXCEPTION 'publish toggle failed'; END IF;

  -- 6. 公開中のまま外す（archived）ことはできない
  v_failed := FALSE;
  BEGIN
    UPDATE public.dd_package_items SET status = 'archived' WHERE id = v_item;
  EXCEPTION WHEN check_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'archiving a published item must fail'; END IF;

  -- 7. 公開をやめてから外すことはできる
  UPDATE public.dd_package_items SET is_published = FALSE WHERE id = v_item;
  UPDATE public.dd_package_items SET status = 'archived' WHERE id = v_item;

  -- 8. 項目は物理削除できない
  v_failed := FALSE;
  BEGIN
    DELETE FROM public.dd_package_items WHERE id = v_item;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'item delete must fail'; END IF;

  -- 9. これまでの公開版の記録（dd_item_publications）は書き換えも削除もできない
  SELECT id INTO v_old_pub FROM public.dd_item_publications ORDER BY published_at LIMIT 1;
  IF v_old_pub IS NOT NULL THEN
    v_failed := FALSE;
    BEGIN
      UPDATE public.dd_item_publications SET title = '改ざん' WHERE id = v_old_pub;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'publication record update must fail'; END IF;
    v_failed := FALSE;
    BEGIN
      DELETE FROM public.dd_item_publications WHERE id = v_old_pub;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'publication record delete must fail'; END IF;
  END IF;

  -- 10. 付与: dd.view は必須、未知の操作は入れられない
  INSERT INTO public.workspace_user_accounts (email, status) VALUES ('dd-readback@example.invalid', 'invited')
  RETURNING id INTO v_account;
  v_failed := FALSE;
  BEGIN
    INSERT INTO public.dd_package_grants (package_id, project_id, user_account_id, capabilities)
    VALUES (v_pkg, 'p21', v_account, ARRAY['dd.download']);
  EXCEPTION WHEN check_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'grant without dd.view must fail'; END IF;
  v_failed := FALSE;
  BEGIN
    INSERT INTO public.dd_package_grants (package_id, project_id, user_account_id, capabilities)
    VALUES (v_pkg, 'p21', v_account, ARRAY['dd.view', 'workspace.view']);
  EXCEPTION WHEN check_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'grant with unknown capability must fail'; END IF;

  -- 11. 付与は既定で invited。同じ人への2つ目の付与は作れない（停止・失効の復活を作成で起こさない）
  INSERT INTO public.dd_package_grants (package_id, project_id, user_account_id)
  VALUES (v_pkg, 'p21', v_account);
  IF (SELECT status FROM public.dd_package_grants WHERE user_account_id = v_account) <> 'invited' THEN
    RAISE EXCEPTION 'grant must default to invited';
  END IF;
  v_failed := FALSE;
  BEGIN
    INSERT INTO public.dd_package_grants (package_id, project_id, user_account_id, status)
    VALUES (v_pkg, 'p21', v_account, 'active');
  EXCEPTION WHEN unique_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'duplicate grant must fail'; END IF;

  -- 12. DD の付与はワークスペースの所属を作らない
  IF EXISTS (SELECT 1 FROM public.project_access_memberships WHERE user_account_id = v_account)
     OR EXISTS (SELECT 1 FROM public.institution_workspace_memberships WHERE user_account_id = v_account) THEN
    RAISE EXCEPTION 'dd grant must not create workspace memberships';
  END IF;

  -- 13. 行の変更は同じ transaction で監査記録に入る
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_access_audit_logs
    WHERE event_type = 'security_row_mutation' AND detail ->> 'table' = 'dd_package_grants'
      AND user_account_id = v_account
  ) THEN
    RAISE EXCEPTION 'grant mutation must be audited in the same transaction';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_access_audit_logs
    WHERE event_type = 'security_row_mutation' AND detail ->> 'table' = 'dd_package_items'
      AND detail ->> 'row_id' = v_item::TEXT
  ) AND NOT EXISTS (
    SELECT 1 FROM public.workspace_access_audit_logs
    WHERE event_type = 'security_row_mutation' AND detail ->> 'table' = 'dd_package_items'
      AND created_at >= transaction_timestamp()
  ) THEN
    RAISE EXCEPTION 'item mutation must be audited in the same transaction';
  END IF;

  RAISE NOTICE 'dd package db readback: ok';
END;
$$;

ROLLBACK;
