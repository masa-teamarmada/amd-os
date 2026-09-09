-- 379_vc_investment_collector_gemini_flash_lite.sql
-- Anthropic key が無い現行環境で、まさ指定の軽量モデル収集を実行可能にする。
-- Google Search grounding 対応の Gemini Flash-Lite へ限定して切り替える。

UPDATE public.llm_prompts
SET model = 'gemini-3.5-flash-lite',
    max_tokens = 4096,
    notes = '2026-09-09 まさ承認。Google Search groundingを使う軽量モデル限定。収集結果はcandidateで保存し、人の確認前にconfirmedにしない。',
    updated_by = 'masa-approved-2026-09-09',
    updated_at = NOW()
WHERE prompt_key = 'vc.investment_history.collect.v1';
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
  body,
  'masa-approved-2026-09-09-model-switch',
  NOW()
FROM public.llm_prompts
WHERE prompt_key = 'vc.investment_history.collect.v1';
