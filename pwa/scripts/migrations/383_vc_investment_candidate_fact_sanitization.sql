-- 383_vc_investment_candidate_fact_sanitization.sql
-- 初回候補のうち、根拠本文に日付・金額が無いものを未確認へ戻す。
-- 出資参加そのものは公式ポートフォリオで確認できるため candidate を維持する。

UPDATE public.startup_funding_rounds
SET announced_on = NULL,
    completed_on = NULL,
    total_amount_low = NULL,
    total_amount_high = NULL,
    total_amount_disclosure = 'not_found',
    updated_at = NOW()
WHERE verification_status = 'candidate'
  AND source_url LIKE 'https://www.umi.co.jp/portfolio/%';

UPDATE public.vc_investments
SET invested_at = NULL,
    updated_at = NOW()
WHERE verification_status = 'candidate'
  AND source_url LIKE 'https://www.umi.co.jp/portfolio/%';

UPDATE public.startup_funding_rounds
SET total_amount_low = NULL,
    total_amount_high = NULL,
    total_amount_disclosure = 'not_found',
    updated_at = NOW()
WHERE verification_status = 'candidate'
  AND source_url = 'https://prtimes.jp/main/html/rd/p/000000406.000076057.html';
