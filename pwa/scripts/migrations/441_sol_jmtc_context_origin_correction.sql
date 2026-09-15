-- SOL（p21）: 四国化成との連携検討を起点としたJMTC問い合わせ経緯へ直す。
-- 個別案件の正式DD開始は未確認。投資委員会の構成・最終決裁手続も未確認。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('sol_jmtc_context_origin_correction'));

UPDATE public.project_management_partners
SET
  connection_context = '四国化成との事業連携を検討する中で、四国化成CVC「SHIKOKUイノベーションファンド」と、その運営会社（GP）が浦田さんを通じてよく知っているJMTC（日本材料技研）の100%子会社JMTCキャピタルであることが分かり、JMTCへ問い合わせた。JMTCキャピタルは案件発掘、DD、投資判断・投資実行を担う。四国化成との投資委員会の構成や最終決裁手続は未確認。JMTCキャピタルは三菱マテリアルCVCも運営している',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'jmtc' AND deleted_at IS NULL;

UPDATE public.project_management_partner_interactions
SET
  detail_md = '四国化成との事業連携を検討する中で、四国化成CVC「SHIKOKUイノベーションファンド」と、その運営会社（GP）が浦田さんを通じてよく知っているJMTCの100%子会社JMTCキャピタルであることが分かり、JMTCへ問い合わせて面談した。JMTCキャピタルは案件発掘、DD、投資判断・投資実行を担う。この案件で正式なDD・投資検討が始まったこと、出資判断、条件合意はいずれも未確認。四国化成との投資委員会の構成や最終決裁手続も未確認。主な確認事項は、色素分解・金属取り込みの仕組み、高温排水での違い、規模、コスト、金属の選択性。',
  updated_at = now()
WHERE id = '016e1ca9-1a32-4851-93ce-9e375c579577'
  AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_management_partners
    WHERE project_id='p21' AND slug='jmtc' AND deleted_at IS NULL
      AND connection_context LIKE '四国化成との事業連携を検討する中で%'
      AND connection_context LIKE '%浦田さんを通じてよく知っているJMTC%'
      AND connection_context LIKE '%案件発掘、DD、投資判断・投資実行を担う%'
  ) THEN
    RAISE EXCEPTION '441: JMTC inquiry origin correction was not applied';
  END IF;
END $$;
COMMIT;
