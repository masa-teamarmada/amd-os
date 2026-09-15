-- SOL（p21）: JMTCキャピタルを単なる案件接続役ではなく、
-- 四国化成CVCの運営会社（GP）として正確に表す。
-- 個別案件のDD開始は未確認。投資委員会の構成・最終決裁手続も未確認。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('sol_jmtc_gp_role_correction'));

UPDATE public.project_management_partners
SET
  role_label = '四国化成CVC「SHIKOKUイノベーションファンド」のGP・運営会社',
  connection_context = 'JMTC（日本材料技研）の100%子会社JMTCキャピタルは、四国化成CVC「SHIKOKUイノベーションファンド」の運営会社（GP）。案件発掘、DD、投資判断・投資実行を担う運営主体であり、単なる紹介・仲介役ではない。四国化成との投資委員会の構成や最終決裁手続は未確認。JMTCキャピタルは三菱マテリアルCVCも運営している',
  target_state = 'JMTCキャピタルによるDD・投資判断へ進むかが決まり、次の面談や追加資料の要否が分かる',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'jmtc' AND deleted_at IS NULL;

UPDATE public.project_management_partner_roles
SET
  role_label = '四国化成CVCのGP・運営会社',
  updated_at = now()
WHERE id = '47f6a170-344c-4abc-b5e3-28aedd863369'
  AND deleted_at IS NULL;

UPDATE public.project_management_partner_interactions
SET
  detail_md = 'JMTCキャピタルは四国化成CVCの運営会社（GP）で、案件発掘、DD、投資判断・投資実行を担う側。単なる紹介・仲介役ではない。ただし、この案件で正式なDD・投資検討が始まったこと、出資判断、条件合意はいずれも未確認。四国化成との投資委員会の構成や最終決裁手続も未確認。主な確認事項は、色素分解・金属取り込みの仕組み、高温排水での違い、規模、コスト、金属の選択性。',
  updated_at = now()
WHERE id = '016e1ca9-1a32-4851-93ce-9e375c579577'
  AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_management_partners
    WHERE project_id='p21' AND slug='jmtc' AND deleted_at IS NULL
      AND role_label LIKE '%GP・運営会社%'
      AND connection_context LIKE '%単なる紹介・仲介役ではない%'
  ) THEN
    RAISE EXCEPTION '440: JMTC GP role correction was not applied';
  END IF;
END $$;
COMMIT;
