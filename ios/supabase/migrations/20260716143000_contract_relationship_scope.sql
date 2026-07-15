-- 契約ファイルの集合と、AMDが当事者となる実務契約台帳を分離する。
-- 契約本文は保存せず、短い確認結果とPJへ反映する条件だけを保持する。

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS relationship_scope text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS is_current_for_project boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amd_entity_name text NOT NULL DEFAULT '株式会社チームアルマダ',
  ADD COLUMN IF NOT EXISTS amd_party_role text,
  ADD COLUMN IF NOT EXISTS party_confirmation_note text,
  ADD COLUMN IF NOT EXISTS party_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS party_confirmed_by text,
  ADD COLUMN IF NOT EXISTS operational_terms_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contracts_relationship_scope_check'
      AND conrelid = 'public.contracts'::regclass
  ) THEN
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_relationship_scope_check
      CHECK (relationship_scope IN ('amd_contract','needs_review','third_party','template'));
  END IF;
END $$;

COMMENT ON COLUMN public.contracts.relationship_scope IS
  'AMD当事者契約だけを主台帳へ出すための区分。needs_review/third_party/templateは主台帳に表示しない。';
COMMENT ON COLUMN public.contracts.is_current_for_project IS
  'この契約の条件をPJコックピットの現行契約条件として扱うか。複数の契約種別をcurrentにできる。';
COMMENT ON COLUMN public.contracts.amd_entity_name IS
  '契約当事者となるAMD側法人名。通常は株式会社チームアルマダ。';
COMMENT ON COLUMN public.contracts.amd_party_role IS
  '契約上のAMDの立場。受託者、委託者、開示当事者など。';
COMMENT ON COLUMN public.contracts.party_confirmation_note IS
  'AMDが契約当事者であることを確認した根拠の短いメモ。';
COMMENT ON COLUMN public.contracts.operational_terms_json IS
  '金額・支払・業務範囲・成果物・検収・費用・知財・秘密保持・制限・解除・責任等の短い確認結果。本文は保存しない。';

-- 雛形は、AMD表記があっても必ず主台帳から除外する。
UPDATE public.contracts c
SET relationship_scope = 'template'
WHERE coalesce(c.canonical_title, '') || ' ' || coalesce(c.contract_title, '') || ' ' || coalesce(c.source_summary, '')
        ~* '(雛形|ひな形|テンプレ|template|sample|サンプル|(^|[[:space:]])form of[[:space:]])'
   OR EXISTS (
     SELECT 1
     FROM public.contract_documents d
     WHERE d.contract_id = c.contract_id
       AND d.file_name ~* '(雛形|ひな形|テンプレ|template|sample|サンプル|(^|[[:space:]])form of[[:space:]])'
   );

-- Contract Apply済みの契約は、PJに反映された現行条件の根拠として扱う。
UPDATE public.contracts c
SET relationship_scope = 'amd_contract',
    is_current_for_project = true,
    registry_status = 'accepted',
    status = CASE
      WHEN c.source_summary ILIKE '%締結済み契約として確定%' THEN 'signed'
      WHEN c.status = 'cancelled' THEN 'under_review'
      ELSE c.status
    END,
    canonical_title = coalesce(c.canonical_title, t.contract_title),
    counterparty_name = coalesce(t.counterparty_name, c.counterparty_name),
    effective_date = coalesce(
      c.effective_date,
      CASE
        WHEN t.extracted_terms_json->>'period_start' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN (t.extracted_terms_json->>'period_start')::date
        WHEN t.period_start_ym ~ '^[0-9]{6}$'
          THEN to_date(t.period_start_ym || '01', 'YYYYMMDD')
        ELSE NULL
      END
    ),
    expiration_date = coalesce(
      c.expiration_date,
      CASE
        WHEN t.extracted_terms_json->>'period_end' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          THEN (t.extracted_terms_json->>'period_end')::date
        WHEN t.period_end_ym ~ '^[0-9]{6}$'
          THEN (to_date(t.period_end_ym || '01', 'YYYYMMDD') + interval '1 month - 1 day')::date
        ELSE NULL
      END
    ),
    contract_value_yen = coalesce(c.contract_value_yen, t.amount_tax_excl),
    operational_terms_json = coalesce(p.contract_terms_json, '{}'::jsonb) - 'currentContracts',
    review_required = false,
    review_status = 'accepted',
    party_confirmation_note = 'Contract Applyで当事者・条件をレビュー済み',
    party_confirmed_at = coalesce(c.party_confirmed_at, now()),
    party_confirmed_by = coalesce(c.party_confirmed_by, c.updated_by, 'contract-apply')
FROM public.contract_terms t
JOIN public.projects p ON p.project_id = t.project_id
WHERE t.contract_id = c.contract_id
  AND (t.status = 'applied' OR t.review_status = 'applied');

-- 監査済みのCTB現行契約と変更覚書を1契約へ束ねる。
UPDATE public.contracts c
SET canonical_contract_id = '82b57da5-a2ab-508e-afbe-58ac9b8cb9cb',
    relationship_scope = 'amd_contract',
    registry_status = 'accepted',
    review_required = false,
    review_status = 'accepted',
    amd_party_role = coalesce(c.amd_party_role, '受託者'),
    party_confirmation_note = 'PJ契約監査でCTBとAMDの業務委託契約・変更覚書を確認済み',
    party_confirmed_at = coalesce(c.party_confirmed_at, now()),
    party_confirmed_by = coalesce(c.party_confirmed_by, 'contract-audit')
WHERE c.contract_id IN (
  '82b57da5-a2ab-508e-afbe-58ac9b8cb9cb',
  'e65234f0-7534-5060-9e77-26f474c34a19',
  '44987f18-3305-498e-aa0e-a9699e952638',
  'ef518049-4bee-4e06-baae-e17852598d0d'
);

UPDATE public.contracts c
SET is_current_for_project = true,
    canonical_title = 'CTB 業務委託契約（変更覚書反映）',
    counterparty_name = 'CrestecBio株式会社',
    effective_date = '2025-09-01',
    expiration_date = '2027-02-13',
    operational_terms_json = coalesce(p.contract_terms_json, '{}'::jsonb) - 'currentContracts'
FROM public.projects p
WHERE c.contract_id = '82b57da5-a2ab-508e-afbe-58ac9b8cb9cb'
  AND p.project_id = 'p06';

-- KENQは最終NDA本文の当事者欄と条文を確認済み。署名完了だけは未確認で残す。
INSERT INTO public.contracts (
  contract_id,
  project_id,
  contract_title,
  canonical_title,
  counterparty_name,
  contract_type,
  status,
  registry_status,
  relationship_scope,
  is_current_for_project,
  amd_entity_name,
  amd_party_role,
  party_confirmation_note,
  party_confirmed_at,
  party_confirmed_by,
  operational_terms_json,
  confidentiality_coverage,
  confidentiality_survival_note,
  confidentiality_note,
  review_required,
  review_status,
  source_summary,
  source_refs_json,
  planned_at,
  last_activity_at,
  created_by,
  updated_by
)
SELECT
  '812e2145-2763-43f2-8ce2-644e2da4dae9',
  'p29',
  'KENQ 秘密保持契約',
  'KENQ 秘密保持契約',
  '株式会社ＫＥＮＱ',
  'nda',
  'awaiting_signature',
  'accepted',
  'amd_contract',
  true,
  '株式会社チームアルマダ',
  '甲・相互の開示者／受領者',
  '最終NDA本文の当事者欄でAMDとKENQを確認済み',
  now(),
  'contract-audit',
  jsonb_build_object(
    'scopeSummary', '事業化支援、評価スコアリングモデル活用、耐熱複合材分野の事業化を通じた協業可能性の検討',
    'usageRights', '秘密情報は協業可能性の検討目的にのみ使用。目的外使用と無断の第三者開示は禁止',
    'ipOwnership', '開示による知財の譲渡・実施許諾は生じない。秘密情報に基づく新規知財の取扱いは甲乙協議',
    'confidentialitySummary', '相互NDA。秘密表示のある書面・記録と、開示後14日以内に書面化した口頭情報が対象',
    'confidentialitySurvival', '契約終了後3年間',
    'subcontractingTerms', '必要範囲の役員・従業員・業務従事者・守秘義務を負う専門家へ開示可。所属当事者が監督責任を負う',
    'terminationTerms', '反社会的勢力への該当・不当要求等がある場合は無催告解除可',
    'liabilityTerms', '契約違反による損害賠償。開示者には損害発生・拡大を避ける合理的努力義務あり',
    'governingLawJurisdiction', '日本法。被告の主たる事業所を管轄する地方裁判所',
    'specialTerms', '秘密情報の返却・廃棄は要求から14日以内。契約期間1年、終了通知がなければ1年自動更新',
    'sourceTitle', 'ARMADA_KENQ_NDA_20260617_FINAL',
    'verifiedAt', now(),
    'verifiedBy', 'contract-audit'
  ),
  'in_contract',
  '契約終了後3年間',
  '相互NDA本文で確認済み',
  false,
  'accepted',
  'AMDとKENQの相互NDA最終本文。DocuSign送付済み、署名完了は未確認。',
  '[]'::jsonb,
  '2026-06-17T00:00:00+09:00'::timestamptz,
  now(),
  'contract-audit',
  'contract-audit'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contracts WHERE contract_id = '812e2145-2763-43f2-8ce2-644e2da4dae9'
);

-- currentContracts を契約ID単位で作り、コックピットで複数契約の条件を混ぜない。
WITH current_rows AS (
  SELECT
    p.id AS project_row_id,
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'contractId', c.contract_id,
        'title', coalesce(c.canonical_title, c.contract_title),
        'contractType', c.contract_type,
        'status', c.status,
        'signatureStatus', CASE WHEN c.status = 'signed' THEN '押印済み記録' ELSE '署名完了は未確認' END,
        'counterpartyName', c.counterparty_name,
        'effectiveDate', c.effective_date,
        'expirationDate', c.expiration_date,
        'renewalType', c.renewal_type,
        'renewalNoticeDate', c.renewal_notice_date,
        'terms', c.operational_terms_json
      ))
      ORDER BY c.contract_type, c.contract_id
    ) AS contracts_json
  FROM public.projects p
  JOIN public.contracts c ON c.project_id = p.project_id
  WHERE c.relationship_scope = 'amd_contract'
    AND c.is_current_for_project = true
    AND c.status <> 'cancelled'
  GROUP BY p.id
)
UPDATE public.projects p
SET contract_terms_json = jsonb_set(
  coalesce(p.contract_terms_json, '{}'::jsonb),
  '{currentContracts}',
  current_rows.contracts_json,
  true
)
FROM current_rows
WHERE p.id = current_rows.project_row_id;

SET CONSTRAINTS ALL IMMEDIATE;

CREATE INDEX IF NOT EXISTS idx_contracts_relationship_scope
  ON public.contracts(relationship_scope, status, project_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_project_current
  ON public.contracts(project_id, is_current_for_project, relationship_scope)
  WHERE is_current_for_project = true;
