-- 456_sol_dd_initial_selection.sql
--
-- SOL（p21）の DD パッケージ（migration 455 で未公開のまま作成）に、掲載項目の初期選択を下書きとして入れる。
--   - DD初版（Drive p21_sol/260930_DD資料パッケージ）の構成を参考に、現在の SOL のコックピット・ワークスペースの元データから選ぶ。
--     初版の本文・数字は使わない（元データの現在値から公開版を作る）。
--   - どの項目も published_publication_id = NULL（未公開）。投資家には何も見えない。公開はまさが下書きを確認してから管理画面で行う。
--   - 閲覧権限は作らない。パッケージの状態（draft）も変えない。
--   - 資本政策は、長期の仮説で今回未精査の Series B / C / IPO を載せず、シリーズA（金額再精査）までにする（管理画面で変えられる）。
-- 元データが見つからない・すでに項目があるときは、何も書かずに止まる。

BEGIN;

SELECT set_config('app.workspace_migration', '456', true);

DO $$
DECLARE
  v_pkg UUID;
BEGIN
  SELECT id INTO v_pkg FROM public.dd_packages WHERE slug = 'sol' AND project_id = 'p21' AND status = 'draft';
  IF v_pkg IS NULL THEN RAISE EXCEPTION 'SOL DD package (draft) is missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.dd_package_items WHERE package_id = v_pkg) THEN
    RAISE EXCEPTION 'SOL DD package already has items; initial selection is applied only once';
  END IF;

  IF (SELECT count(*) FROM public.project_tech_topics
      WHERE project_id = 'p21' AND status <> 'archived'
        AND tech_topic_id IN ('ptt_sol_bm_overview', 'ptt_sx_record', 'ptt_sx_compare', 'ptt_sx_compare_methods', 'ptt_sol_bm_market')) <> 5 THEN
    RAISE EXCEPTION 'expected 5 SOL tech topics';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_documents WHERE document_id = '1253bf2c-33d7-4c93-94f6-5deecb52371b'
                 AND project_id = 'p21' AND upload_status = 'active' AND entry_kind = 'file') THEN
    RAISE EXCEPTION 'SOL business overview deck (v1.7) is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_documents WHERE document_id = '4a87b890-77ff-4b44-a49b-004bad3dfa49'
                 AND project_id = 'p21' AND upload_status = 'active' AND entry_kind = 'link') THEN
    RAISE EXCEPTION 'SOL PoC deck link is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_capital_plans WHERE id = '9a6fb7cd-8f57-4456-92a5-8df486a55ae3'
                 AND project_id = 'p21' AND status = 'active'
                 AND document_json -> 'events' @> '[{"id": "sx-series-a-event"}]'::jsonb) THEN
    RAISE EXCEPTION 'SOL capital plan or its Series A event is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_cost_models WHERE cost_model_id = 'cm_p21_260820'
                 AND project_id = 'p21' AND status = 'active' AND case_kind <> 'biodiesel') THEN
    RAISE EXCEPTION 'SOL cost model is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_monthly_cashflow WHERE project_id = 'p21' AND planning_details_json IS NOT NULL) THEN
    RAISE EXCEPTION 'SOL funding plan is missing';
  END IF;

  INSERT INTO public.dd_package_items (package_id, project_id, section_key, item_kind, source_key, source_options, title, summary, sort_order)
  VALUES
    (v_pkg, 'p21', 'business', 'tech_topic', 'project_tech_topic:ptt_sol_bm_overview', '{}'::jsonb,
      'ビジネスモデル（お金とモノの流れ）', '菌体の供給・装置・処理の定期利用料で収益を得る事業全体の流れ', 10),
    (v_pkg, 'p21', 'business', 'document', 'workspace_document:1253bf2c-33d7-4c93-94f6-5deecb52371b', '{}'::jsonb,
      '事業概要資料（v1.7）', NULL, 20),
    (v_pkg, 'p21', 'technology', 'tech_topic', 'project_tech_topic:ptt_sx_record', '{}'::jsonb,
      '装置と実験の到達実績', NULL, 10),
    (v_pkg, 'p21', 'market', 'tech_topic', 'project_tech_topic:ptt_sx_compare', '{}'::jsonb,
      '競合の会社との比較', NULL, 10),
    (v_pkg, 'p21', 'market', 'tech_topic', 'project_tech_topic:ptt_sx_compare_methods', '{}'::jsonb,
      '既存の処理方式との比較', NULL, 20),
    (v_pkg, 'p21', 'market', 'tech_topic', 'project_tech_topic:ptt_sol_bm_market', '{}'::jsonb,
      '対象になる廃液と量', NULL, 30),
    (v_pkg, 'p21', 'economics', 'cost_model', 'project_cost_model:cm_p21_260820', '{}'::jsonb,
      '単位採算（コスト試算）', '方式ごとの処理1m³あたりの総コストと内訳', 10),
    (v_pkg, 'p21', 'economics', 'funding_plan', 'project_funding_plan:p21', '{}'::jsonb,
      'シードからシリーズAまでの資金計画', '2027年4月〜2028年6月の月次の入出金と残高（4ケース）', 20),
    (v_pkg, 'p21', 'capital', 'capital_policy', 'project_capital_plan:9a6fb7cd-8f57-4456-92a5-8df486a55ae3',
      '{"lastEventId": "sx-series-a-event"}'::jsonb,
      '資本政策（シードJ-KISS・シリーズA）', '設立からシリーズAまでのラウンドと持株比率', 10),
    (v_pkg, 'p21', 'evidence', 'document', 'workspace_document:4a87b890-77ff-4b44-a49b-004bad3dfa49', '{}'::jsonb,
      'PoC向け説明資料', NULL, 10);

  IF EXISTS (SELECT 1 FROM public.dd_package_items WHERE package_id = v_pkg AND published_publication_id IS NOT NULL) THEN
    RAISE EXCEPTION 'initial selection must stay unpublished';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dd_package_grants WHERE package_id = v_pkg) THEN
    RAISE EXCEPTION 'initial selection must not create grants';
  END IF;
END;
$$;

COMMIT;
