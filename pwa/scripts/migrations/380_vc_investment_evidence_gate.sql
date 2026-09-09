-- 380_vc_investment_evidence_gate.sql
-- 初回収集で、検索回答が投資と無関係な記事URLやVCトップページを返す事例を検知した。
-- 初回候補は削除せず dismissed へ隔離し、本文照合ゲートを通して再収集できる状態へ戻す。

INSERT INTO public.llm_prompt_revisions (
  prompt_key,
  body_before,
  body_after,
  updated_by,
  updated_at
)
SELECT
  prompt_key,
  body,
  body || $addition$

追加の根拠品質ルール:
- source_url は、その出資参加を確認できる個別記事または個別ポートフォリオページにする。サイトのトップページは不可。
- source_url 本文に投資先SU名と当該VC名が存在することを確認する。
- source_title は source_url の実際のページ題名と一致させる。
- completed は、払込・調達完了が根拠本文で明示され、completed_on も確認できる場合だけ使う。それ以外は announced。
- 金額の通貨と単位を根拠本文の表記どおりに確認し、円換算しない。
$addition$,
  'masa-approved-2026-09-09-evidence-gate',
  NOW()
FROM public.llm_prompts
WHERE prompt_key = 'vc.investment_history.collect.v1';

UPDATE public.llm_prompts
SET body = body || $addition$

追加の根拠品質ルール:
- source_url は、その出資参加を確認できる個別記事または個別ポートフォリオページにする。サイトのトップページは不可。
- source_url 本文に投資先SU名と当該VC名が存在することを確認する。
- source_title は source_url の実際のページ題名と一致させる。
- completed は、払込・調達完了が根拠本文で明示され、completed_on も確認できる場合だけ使う。それ以外は announced。
- 金額の通貨と単位を根拠本文の表記どおりに確認し、円換算しない。
$addition$,
    notes = '2026-09-09 まさ承認。軽量モデル限定。根拠URL本文をSU名・VC名で照合し、収集結果はcandidateで保存する。',
    updated_by = 'masa-approved-2026-09-09-evidence-gate',
    updated_at = NOW()
WHERE prompt_key = 'vc.investment_history.collect.v1';

UPDATE public.vc_investments
SET verification_status = 'dismissed',
    updated_at = NOW()
WHERE collected_by_model = 'gemini-3.5-flash-lite'
  AND verification_status = 'candidate';

UPDATE public.startup_funding_rounds
SET verification_status = 'dismissed',
    updated_at = NOW()
WHERE collected_by_model = 'gemini-3.5-flash-lite'
  AND verification_status = 'candidate';

UPDATE public.vcs
SET investment_history_collected_at = NULL,
    investment_history_model = NULL,
    investment_history_candidate_count = 0,
    updated_at = NOW()
WHERE investment_history_model = 'gemini-3.5-flash-lite';
