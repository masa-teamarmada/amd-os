-- 119_management_score_company_vital_initial_backfill.sql
--
-- Initial reviewed backfill for Management Score company vital scope.
-- This is intentionally small and idempotent: only high-confidence company-level
-- sales/contract/pipeline signals identified during the 2026-06-01 dry-run are
-- promoted. Project-only technical/setup facts remain excluded.
--
-- Rollback pattern:
-- UPDATE project_strategy_signals
-- SET signal_scope = NULL, applies_to_company_score = NULL, pipeline_status = NULL,
--     pipeline_probability = NULL, expected_amount_yen = NULL, expected_contract_ym = NULL,
--     company_score_axis = NULL, scope_reason = NULL
-- WHERE signal_id IN (...same ids...);

UPDATE project_strategy_signals
SET
  signal_scope = 'company',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.82,
  expected_contract_ym = COALESCE(expected_contract_ym, ym),
  company_score_axis = 'pipeline',
  scope_reason = '契約前でもAMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = 'cc5e7d0d-ef61-4538-82d1-251396181824';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.95,
  expected_amount_yen = COALESCE(expected_amount_yen, 1000000),
  expected_contract_ym = COALESCE(expected_contract_ym, ym),
  company_score_axis = 'pipeline',
  scope_reason = '香川大の今年度予算100万円確保は、契約前でもAMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '72d7b5c0-e631-490b-b3f1-f7a280a34d62';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.94,
  expected_contract_ym = COALESCE(expected_contract_ym, '202606'),
  company_score_axis = 'pipeline',
  scope_reason = 'KUTE受託ミッションと承認導線は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '803df683-06d4-4d19-bca8-e5c7a14970d7';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.92,
  expected_contract_ym = COALESCE(expected_contract_ym, '202606'),
  company_score_axis = 'pipeline',
  scope_reason = 'KUTE受託3ミッションの合意は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '1bc24c98-c41d-4992-b70e-516d176384db';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.91,
  expected_contract_ym = COALESCE(expected_contract_ym, ym),
  company_score_axis = 'pipeline',
  scope_reason = 'SXのPoC/前売上方針は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '500e2ee8-30dd-4545-b429-c6bce37fe731';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.88,
  expected_contract_ym = COALESCE(expected_contract_ym, ym),
  company_score_axis = 'pipeline',
  scope_reason = 'NIMS見積了承と契約手続き継続は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '9b5e8f0c-30df-447c-937d-5544e63a86d8';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.87,
  expected_amount_yen = COALESCE(expected_amount_yen, 1000000),
  expected_contract_ym = COALESCE(expected_contract_ym, ym),
  company_score_axis = 'pipeline',
  scope_reason = 'NIMSの税込100万円未満の正式見積依頼は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = 'aad6dc9e-240c-42ec-9f63-27bcea20a91d';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  pipeline_status = 'high_confidence',
  pipeline_probability = 0.82,
  expected_amount_yen = COALESCE(expected_amount_yen, 1000000),
  expected_contract_ym = COALESCE(expected_contract_ym, '202606'),
  company_score_axis = 'pipeline',
  scope_reason = 'NIMS新規契約締結と現場訪問開始は、AMD会社全体の営業・契約pipelineに効く高確度案件',
  updated_at = now()
WHERE signal_id = '9b080419-4df5-4cd8-8578-cd78b8099c34';

UPDATE project_strategy_signals
SET
  signal_scope = 'cross_project',
  applies_to_company_score = TRUE,
  company_score_axis = 'capacity',
  scope_reason = 'CX/NIMSの調達・コンソーシアム戦略はAMD会社全体の資源配分と資金調達に効く',
  updated_at = now()
WHERE signal_id = 'c80306a5-b71a-4089-9430-892127f5fff1';
