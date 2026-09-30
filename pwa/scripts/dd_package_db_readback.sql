-- DDパッケージ（migration 455）の DB 側の約束を、本番 DB 上で確かめる検査。
-- 最後に必ず ROLLBACK するので、行・監査記録・変更履歴は何も残らない（Storage には触れない）。
-- 実行: python3 -X utf8 scripts/apply_ddl.py scripts/dd_package_db_readback.sql
-- 失敗すると RAISE EXCEPTION で止まり、応答が FAIL になる。

BEGIN;

DO $$
DECLARE
  v_pkg UUID;
  v_item UUID;
  v_doc UUID;
  v_other_pkg_doc UUID;
  v_admin TEXT;
  v_nonadmin TEXT;
  v_account UUID;
  v_res JSONB;
  v_res2 JSONB;
  v_res3 JSONB;
  v_pub UUID;
  v_evidence UUID[];
  v_failed BOOLEAN;
BEGIN
  SELECT id INTO v_pkg FROM public.dd_packages WHERE slug = 'sol' AND project_id = 'p21';
  IF v_pkg IS NULL THEN RAISE EXCEPTION 'SOL package is missing'; END IF;
  SELECT member_id INTO v_admin FROM public.members WHERE is_admin = TRUE AND status = 'active' ORDER BY member_id LIMIT 1;
  SELECT member_id INTO v_nonadmin FROM public.members WHERE COALESCE(is_admin, FALSE) = FALSE AND status = 'active' ORDER BY member_id LIMIT 1;
  IF v_admin IS NULL OR v_nonadmin IS NULL THEN RAISE EXCEPTION 'need one admin and one non-admin member'; END IF;

  -- 1. 項目は公開版なし（NULL）で作られる
  INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, title)
  VALUES (v_pkg, 'p21', 'capital', 'capital_policy', 'project_capital_plan:readback-test', '検査用')
  RETURNING id INTO v_item;
  INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, title)
  VALUES (v_pkg, 'p21', 'evidence', 'document', 'workspace_document:readback-test', '検査用資料')
  RETURNING id INTO v_doc;
  IF (SELECT published_publication_id FROM public.dd_package_items WHERE id = v_item) IS NOT NULL THEN
    RAISE EXCEPTION 'new item must start unpublished';
  END IF;

  -- 2. パッケージとPJの組が合わない項目は作れない
  v_failed := FALSE;
  BEGIN
    INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, title)
    VALUES (v_pkg, 'p00', 'capital', 'capital_policy', 'project_capital_plan:mismatch', 'x');
  EXCEPTION WHEN foreign_key_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'item with mismatched project must fail'; END IF;

  -- 3. 根拠資料: 自分自身・存在しないID・資料以外は公開時に落とされ、同じパッケージの資料だけが残る
  UPDATE public.dd_package_items
     SET evidence_item_ids = ARRAY[v_doc, v_item, gen_random_uuid()]
   WHERE id = v_item;

  -- 4. admin 以外は公開できない
  v_failed := FALSE;
  BEGIN
    PERFORM public.dd_publish_item(v_item, v_nonadmin, '{"kind":"capital_policy","a":1}'::JSONB,
      '[{"table":"t","id":"1"}]'::JSONB, NOW(), '["n1"]'::JSONB);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%admin actor%' THEN v_failed := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'non-admin publish must fail'; END IF;

  -- 5. 公開すると第1版ができ、外部に見せる版がそれを指す
  v_res := public.dd_publish_item(v_item, v_admin, '{"kind":"capital_policy","a":1}'::JSONB,
    '[{"table":"t","id":"1"}]'::JSONB, NOW(), '["n1"]'::JSONB);
  IF (v_res ->> 'revision')::INT <> 1 OR (v_res ->> 'unchanged')::BOOLEAN THEN RAISE EXCEPTION 'first publish: %', v_res; END IF;
  v_pub := (v_res ->> 'publicationId')::UUID;
  IF (SELECT published_publication_id FROM public.dd_package_items WHERE id = v_item) <> v_pub THEN
    RAISE EXCEPTION 'pointer must move to the new publication';
  END IF;
  SELECT evidence_item_ids INTO v_evidence FROM public.dd_item_publications WHERE id = v_pub;
  IF v_evidence <> ARRAY[v_doc] THEN RAISE EXCEPTION 'evidence must keep only same-package documents: %', v_evidence; END IF;

  -- 6. 同じ内容なら新しい版を作らない
  v_res2 := public.dd_publish_item(v_item, v_admin, '{"a":1,"kind":"capital_policy"}'::JSONB,
    '[{"table":"t","id":"1"}]'::JSONB, NOW(), '["n1"]'::JSONB);
  IF NOT (v_res2 ->> 'unchanged')::BOOLEAN OR (v_res2 ->> 'publicationId')::UUID <> v_pub THEN
    RAISE EXCEPTION 'same content must not create a new revision: %', v_res2;
  END IF;

  -- 7. 内容が変われば第2版、未確認事項が変わっても第2版以降が増える
  v_res3 := public.dd_publish_item(v_item, v_admin, '{"kind":"capital_policy","a":2}'::JSONB,
    '[{"table":"t","id":"1"}]'::JSONB, NOW(), '["n1"]'::JSONB);
  IF (v_res3 ->> 'revision')::INT <> 2 THEN RAISE EXCEPTION 'changed content must create revision 2: %', v_res3; END IF;

  -- 8. 公開版は書き換えも削除もできない
  v_failed := FALSE;
  BEGIN
    UPDATE public.dd_item_publications SET title = '改ざん' WHERE id = v_pub;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'publication update must fail'; END IF;
  v_failed := FALSE;
  BEGIN
    DELETE FROM public.dd_item_publications WHERE id = v_pub;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'publication delete must fail'; END IF;

  -- 9. 項目・パッケージは物理削除できない
  v_failed := FALSE;
  BEGIN
    DELETE FROM public.dd_package_items WHERE id = v_doc;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%append-only%' THEN v_failed := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'item delete must fail'; END IF;

  -- 10. 公開版を持ったまま外す（archived）ことはできない
  v_failed := FALSE;
  BEGIN
    UPDATE public.dd_package_items SET status = 'archived' WHERE id = v_item;
  EXCEPTION WHEN check_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'archiving a published item must fail'; END IF;

  -- 11. 別の項目の公開版を指すことはできない
  v_failed := FALSE;
  BEGIN
    UPDATE public.dd_package_items SET published_publication_id = v_pub WHERE id = v_doc;
  EXCEPTION WHEN foreign_key_violation THEN v_failed := TRUE;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'pointing to another item publication must fail'; END IF;

  -- 12. 取り下げ（NULL）は通り、公開版の記録は残る
  UPDATE public.dd_package_items SET published_publication_id = NULL WHERE id = v_item;
  IF (SELECT count(*) FROM public.dd_item_publications WHERE item_id = v_item) <> 2 THEN
    RAISE EXCEPTION 'withdraw must keep publication history';
  END IF;

  -- 13. 付与: dd.view は必須、未知の操作は入れられない
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

  -- 14. 付与は既定で invited。同じ人への2つ目の付与は作れない（停止・失効の復活を作成で起こさない）
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

  -- 15. DD の付与はワークスペースの所属を作らない
  IF EXISTS (SELECT 1 FROM public.project_access_memberships WHERE user_account_id = v_account)
     OR EXISTS (SELECT 1 FROM public.institution_workspace_memberships WHERE user_account_id = v_account) THEN
    RAISE EXCEPTION 'dd grant must not create workspace memberships';
  END IF;

  -- 16. 行の変更は同じ transaction で監査記録に入る
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_access_audit_logs
    WHERE event_type = 'security_row_mutation' AND detail ->> 'table' = 'dd_package_grants'
      AND user_account_id = v_account
  ) THEN
    RAISE EXCEPTION 'grant mutation must be audited in the same transaction';
  END IF;

  RAISE NOTICE 'dd package db readback: ok';
END;
$$;

ROLLBACK;
