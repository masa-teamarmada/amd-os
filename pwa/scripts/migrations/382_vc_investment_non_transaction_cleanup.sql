-- 382_vc_investment_non_transaction_cleanup.sql
-- 「共同創業・会社設立」の発表だけで、ATACによる出資事実を確認できない1件を候補から除外する。

WITH dismissed_investment AS (
  UPDATE public.vc_investments
  SET verification_status = 'dismissed',
      updated_at = NOW()
  WHERE collected_by_model = 'gemini-3.5-flash-lite'
    AND verification_status = 'candidate'
    AND source_url = 'https://prtimes.jp/main/html/rd/p/000000021.000101617.html'
  RETURNING vc_id, funding_round_id
)
UPDATE public.startup_funding_rounds AS funding_round
SET verification_status = 'dismissed',
    updated_at = NOW()
WHERE funding_round.id IN (
  SELECT funding_round_id
  FROM dismissed_investment
  WHERE funding_round_id IS NOT NULL
);

UPDATE public.vcs AS vc
SET investment_history_candidate_count = candidate_counts.candidate_count,
    updated_at = NOW()
FROM (
  SELECT
    vc.id,
    COUNT(investment.id) FILTER (WHERE investment.verification_status = 'candidate')::INTEGER AS candidate_count
  FROM public.vcs AS vc
  LEFT JOIN public.vc_investments AS investment ON investment.vc_id = vc.id
  WHERE vc.investment_history_model = 'gemini-3.5-flash-lite'
  GROUP BY vc.id
) AS candidate_counts
WHERE vc.id = candidate_counts.id;
