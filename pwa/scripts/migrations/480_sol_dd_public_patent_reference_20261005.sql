-- 480: 公開公報をSOL DDのドライブに掲載対象として選択する。
-- パッケージはdraft、外部付与0件のまま。社外への招待・送信・パッケージ公開は行わない。
-- 研究者説明資料は非公開の掲載候補を維持する。
BEGIN;
SELECT set_config('request.headers', '{"x-amd-os-actor":"amie-sol-dd-content-20261005"}', true);
SELECT set_config('app.workspace_migration', '480', true);
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.dd_packages WHERE id='b0540a9f-7bde-426c-81a7-8a56a59f5b15' AND project_id='p21' AND slug='sol' AND status='draft')
    OR EXISTS (SELECT 1 FROM public.dd_package_grants WHERE package_id='b0540a9f-7bde-426c-81a7-8a56a59f5b15')
    THEN RAISE EXCEPTION 'SOL DD disclosure state changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_documents WHERE document_id='e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b' AND project_id='p21' AND source_ref='sol-dd-content-20261005:patent; 公開公報表紙確認済み、掲載候補、未公開。' AND external_url='https://patentimages.storage.googleapis.com/58/c9/f7/87c0a55e9e7d17/WO2025028350A1.pdf')
    THEN RAISE EXCEPTION 'Public patent reference changed'; END IF;
  IF (SELECT count(*) FROM public.dd_package_items WHERE package_id='b0540a9f-7bde-426c-81a7-8a56a59f5b15' AND source_key='workspace_document:e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b' AND is_published=false)<>1
    THEN RAISE EXCEPTION 'Patent selection changed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_tech_topics WHERE tech_topic_id='ptt_sol_bm_dd_evidence' AND updated_by='amie-sol-dd-content-20261005' AND body_md LIKE '%研究者説明資料・公開公報を掲載候補へ追加%')
    THEN RAISE EXCEPTION 'DD evidence article changed'; END IF;
END $guard$;
UPDATE public.dd_package_items
SET is_published=true,published_at=now(),published_by_member_id='ID001',updated_by_member_id='ID001',
    summary='公開済みの国際出願公報。登録・現在の権利状態・会社への実施許諾は別途確認する。',updated_at=now()
WHERE package_id='b0540a9f-7bde-426c-81a7-8a56a59f5b15' AND source_key='workspace_document:e6cb49c0-30ec-5cde-9a9b-10e2179d6f9b';
UPDATE public.project_tech_topics
SET body_md=replace(body_md,'研究者説明資料・公開公報を掲載候補へ追加','公開公報をドライブの掲載対象に追加。研究者説明資料は掲載候補'),updated_at=now()
WHERE tech_topic_id='ptt_sol_bm_dd_evidence';
COMMIT;
