-- PJ台帳・契約監査で存在が確認されているが、contracts の主台帳行が無い契約を復元する。
-- 契約本文やraw本文は保存せず、短い確認結果と参照元だけを保持する。

WITH seed_rows AS (
  SELECT *
  FROM (VALUES
    (
      'p01',
      'OPT 契約条件確認枠',
      NULL::text,
      'contract',
      'under_review',
      false,
      NULL::date,
      NULL::date,
      NULL::bigint,
      jsonb_build_object(
        'scopeSummary', 'OPTの終了済PJ枠。契約書・相手先・金額は未登録のため確認が必要',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '未確認',
        'sourceTitle', 'projects p01 / admin contracts backfill',
        'verifiedAt', '2026-07-16',
        'verifiedBy', 'contract-ledger-backfill'
      ),
      'PJ台帳に存在する終了済PJの契約確認枠として復元。契約書ファイル・相手先・押印証跡は未登録。',
      'PJ台帳に存在する終了済PJの契約確認枠。AMD当事者性・相手先確認が必要。'
    ),
    (
      'p09',
      'JC サービス料金表・契約条件確認枠',
      '株式会社JOYCLE',
      'contract',
      'under_review',
      false,
      '2023-12-01'::date,
      '2026-03-31'::date,
      NULL::bigint,
      jsonb_build_object(
        'scopeSummary', 'サービス料金表のみ確認。実契約PDFは未登録',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '契約書未登録のため未確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p09 JC監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      'サービス料金表のみ確認。終了済PJで、実契約PDF・押印証跡・秘密保持条項は未確認。',
      '終了済PJ。サービス料金表由来の候補として復元。'
    ),
    (
      'p10',
      'SE 業務委託契約',
      '株式会社翔エンジニアリング',
      'mandate',
      'under_review',
      true,
      '2023-11-01'::date,
      NULL::date,
      100000::bigint,
      jsonb_build_object(
        'monthlyFeeYen', 100000,
        'paymentTerms', '税抜月額100,000円。請求イベントで確認',
        'scopeSummary', '業務委託・顧問業務。契約本文未登録のため詳細条件は確認が必要',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '契約書未登録のため未確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p10 SE監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      '請求イベントとSlack記録で月額100,000円は確認済み。満了月は未定として確定済み。契約書ファイル・押印証跡は未登録。',
      'AMD管理契約としてPJ台帳の確定値から復元。契約書ファイルと押印証跡は要確認。'
    ),
    (
      'p11',
      'BWE 業務委託契約（NIMS / 当事者確認要）',
      '国立研究開発法人物質・材料研究機構',
      'outsourcing',
      'under_review',
      false,
      '2025-07-16'::date,
      '2025-10-31'::date,
      NULL::bigint,
      jsonb_build_object(
        'scopeSummary', '業務委託契約書_AMD_250716 由来。ただし契約当事者がBlue Water Energy側の可能性があり確認が必要',
        'billingDistribution', 'per_quote_variable',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '未確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p11 BWE監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      'Drive契約書はBWEグループ関連契約として確認済みだが、AMD当事者性と契約期間の最終確認が必要。',
      'グループ関連契約として主台帳へ復元。AMD当事者性の確認が必要。'
    ),
    (
      'p16',
      'ORB 契約条件確認枠',
      NULL::text,
      'contract',
      'under_review',
      false,
      '2024-11-01'::date,
      '2024-12-31'::date,
      NULL::bigint,
      jsonb_build_object(
        'scopeSummary', 'ORBの終了済PJ枠。契約書・相手先・金額は未登録のため確認が必要',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '未確認',
        'sourceTitle', 'projects p16 / admin contracts backfill',
        'verifiedAt', '2026-07-16',
        'verifiedBy', 'contract-ledger-backfill'
      ),
      'PJ台帳に存在する終了済PJの契約確認枠として復元。契約書ファイル・相手先・押印証跡は未登録。',
      'PJ台帳に存在する終了済PJの契約確認枠。AMD当事者性・相手先確認が必要。'
    ),
    (
      'p19',
      'ZMP 月額アドバイザリー契約',
      '葛飾ロード株式会社',
      'mandate',
      'under_review',
      true,
      '2025-06-01'::date,
      NULL::date,
      300000::bigint,
      jsonb_build_object(
        'monthlyFeeYen', 300000,
        'paymentTerms', '税抜月額300,000円。PJ台帳 fee_amount と契約監査で確認',
        'scopeSummary', '葛飾ロードの新規事業創出・ZMP/ZeMA伴走',
        'expenseReimbursementAllowed', true,
        'expenseReimbursementNote', 'PJ契約条件で立替可として記録済み。上限・事前承認条件は契約書で確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p19 ZMP監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      'ZMP本契約。月額300,000円はDB反映済み、満了月は未確認のため無期限扱いで確定済み。契約書ファイル・押印証跡は未登録。',
      'AMD管理契約としてPJ台帳の確定値から復元。契約書ファイルと押印証跡は要確認。'
    ),
    (
      'p19',
      'ZMP OkuDoor システム開発契約',
      '葛飾ロード株式会社',
      'outsourcing',
      'under_review',
      true,
      '2026-05-01'::date,
      '2026-10-31'::date,
      2000000::bigint,
      jsonb_build_object(
        'amountTaxExclTotal', 2000000,
        'paymentTerms', '税抜2,000,000円。請求書 INV-0000000305 / 開発期間202605〜202610を按分',
        'scopeSummary', 'OkuDoorシステム開発。ZMP月額本契約とは別財布として管理',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '本契約側とは別契約のため確認が必要',
        'sourceTitle', 'billing_cycles.extra_revenue_json / pwa/spec/5-6-contracts-management-current-spec.md',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      'ZMPの別財布契約。税抜2,000,000円、開発期間202605〜202610。契約書ファイル・押印証跡は未登録。',
      'ZMP月額本契約とは別契約として復元。契約書ファイルと押印証跡は要確認。'
    ),
    (
      'p22',
      'OQC / OptQC 契約条件確認枠',
      'OptQC',
      'contract',
      'under_review',
      false,
      '2025-09-01'::date,
      '2025-12-31'::date,
      NULL::bigint,
      jsonb_build_object(
        'scopeSummary', 'OptQCの終了済PJ枠。契約書は未登録',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '契約書未登録のため未確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p22 OQC監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      '契約書未登録・請求ゼロとして監査済み。終了済PJの確認枠として復元。',
      '終了済PJ。契約書なし候補として主台帳へ復元。'
    ),
    (
      'p23',
      'UST 名目業務委託契約',
      '国立大学法人東京科学大学',
      'outsourcing',
      'under_review',
      false,
      '2025-11-01'::date,
      '2026-01-31'::date,
      1::bigint,
      jsonb_build_object(
        'amountTaxExclTotal', 1,
        'paymentTerms', '税抜1円の名目額として請求イベントで確認',
        'scopeSummary', '東京科学大学関連の名目業務委託。契約書は未登録',
        'expenseReimbursementAllowed', NULL,
        'expenseReimbursementNote', '契約書未登録のため未確認',
        'sourceTitle', 'pwa/spec/5-6-contracts-management-current-spec.md p23 UST監査',
        'verifiedAt', '2026-06-18',
        'verifiedBy', 'contract-audit'
      ),
      '契約書未登録。税抜1円の名目契約として監査済み。押印証跡・秘密保持条項は未確認。',
      '終了済PJ。名目契約の確認枠として復元。'
    )
  ) AS rows(
    project_id,
    contract_title,
    counterparty_name,
    contract_type,
    status,
    is_current_for_project,
    effective_date,
    expiration_date,
    contract_value_yen,
    operational_terms_json,
    source_summary,
    party_confirmation_note
  )
)
INSERT INTO public.contracts (
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
  effective_date,
  expiration_date,
  contract_value_yen,
  confidentiality_coverage,
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
  seed.project_id,
  seed.contract_title,
  seed.contract_title,
  seed.counterparty_name,
  seed.contract_type,
  seed.status,
  'candidate',
  'amd_contract',
  seed.is_current_for_project,
  '株式会社チームアルマダ',
  CASE
    WHEN seed.contract_type IN ('mandate','outsourcing') THEN '受託者'
    ELSE NULL
  END,
  seed.party_confirmation_note,
  NULL,
  NULL,
  seed.operational_terms_json,
  seed.effective_date,
  seed.expiration_date,
  seed.contract_value_yen,
  'unknown',
  true,
  'pending',
  seed.source_summary,
  jsonb_build_array(jsonb_build_object(
    'kind', 'spec',
    'path', 'pwa/spec/5-6-contracts-management-current-spec.md',
    'note', 'contract ledger project backfill'
  )),
  now(),
  now(),
  'contract-ledger-backfill',
  'contract-ledger-backfill'
FROM seed_rows seed
JOIN public.projects p ON p.project_id = seed.project_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.contracts existing
  WHERE existing.project_id = seed.project_id
    AND coalesce(existing.canonical_title, existing.contract_title) = seed.contract_title
);
