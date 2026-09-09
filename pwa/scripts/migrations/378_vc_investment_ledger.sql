-- 378_vc_investment_ledger.sql
--
-- VC 一覧から独立した「投資履歴」投影を作るため、
-- SU マスタ / 資金調達ラウンド / 参加 VC の三層へ正規化する。
-- 既存 vc_investments は参加 VC 層として残し、旧データを破壊せず候補状態を追加する。

CREATE TABLE IF NOT EXISTS public.startup_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  name_en TEXT,
  normalized_name TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  website TEXT,
  our_project_id TEXT REFERENCES public.projects(project_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.startup_companies IS
  '外部 SU を含む会社名マスタ。表記揺れは aliases、照合は normalized_name、AMD PJ の SU は our_project_id で任意接続する。';

CREATE TABLE IF NOT EXISTS public.startup_funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES public.startup_companies(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL UNIQUE,
  round_label TEXT,
  announced_on DATE,
  completed_on DATE,
  deal_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (deal_status IN ('planned', 'announced', 'completed', 'cancelled', 'unknown')),
  total_amount_low NUMERIC,
  total_amount_high NUMERIC,
  total_amount_currency TEXT NOT NULL DEFAULT 'JPY',
  total_amount_disclosure TEXT NOT NULL DEFAULT 'not_found'
    CHECK (total_amount_disclosure IN ('exact', 'range', 'undisclosed', 'not_found')),
  source_url TEXT,
  source_title TEXT,
  evidence_note TEXT,
  verification_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (verification_status IN ('candidate', 'confirmed', 'dismissed', 'legacy_unreviewed')),
  collected_by_model TEXT,
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.startup_funding_rounds IS
  'SU 単位の資金調達ラウンド。ラウンド総額と、vc_investments の VC 個別額を混同しない。';

ALTER TABLE public.vc_investments
  ADD COLUMN IF NOT EXISTS startup_id UUID REFERENCES public.startup_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funding_round_id UUID REFERENCES public.startup_funding_rounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS investor_amount_low NUMERIC,
  ADD COLUMN IF NOT EXISTS investor_amount_high NUMERIC,
  ADD COLUMN IF NOT EXISTS investor_amount_currency TEXT NOT NULL DEFAULT 'JPY',
  ADD COLUMN IF NOT EXISTS amount_disclosure TEXT NOT NULL DEFAULT 'legacy_unclassified'
    CHECK (amount_disclosure IN ('exact', 'range', 'undisclosed', 'not_found', 'legacy_unclassified')),
  ADD COLUMN IF NOT EXISTS investor_role TEXT NOT NULL DEFAULT 'participant'
    CHECK (investor_role IN ('lead', 'co_lead', 'participant', 'unknown')),
  ADD COLUMN IF NOT EXISTS deal_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (deal_status IN ('planned', 'announced', 'completed', 'cancelled', 'unknown')),
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'legacy_unreviewed'
    CHECK (verification_status IN ('candidate', 'confirmed', 'dismissed', 'legacy_unreviewed')),
  ADD COLUMN IF NOT EXISTS collected_by_model TEXT,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

ALTER TABLE public.vcs
  ADD COLUMN IF NOT EXISTS investment_history_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS investment_history_model TEXT,
  ADD COLUMN IF NOT EXISTS investment_history_candidate_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_startup_funding_rounds_startup
  ON public.startup_funding_rounds(startup_id, announced_on DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_startup_funding_rounds_review
  ON public.startup_funding_rounds(verification_status, announced_on DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_vc_investments_startup
  ON public.vc_investments(startup_id);
CREATE INDEX IF NOT EXISTS idx_vc_investments_round
  ON public.vc_investments(funding_round_id);
CREATE INDEX IF NOT EXISTS idx_vc_investments_review
  ON public.vc_investments(verification_status, collected_at DESC NULLS LAST);

-- 既存の文字列投資先を、破壊しない範囲で SU マスタへ寄せる。
WITH normalized AS (
  SELECT
    target_company,
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(target_company, '(株式会社|有限会社|合同会社)', '', 'g'),
        '[[:space:]・･\.．,，()（）]+', '', 'g'
      )
    ) AS normalized_name
  FROM public.vc_investments
  WHERE NULLIF(BTRIM(target_company), '') IS NOT NULL
), grouped AS (
  SELECT
    normalized_name,
    MIN(target_company) AS canonical_name,
    ARRAY_AGG(DISTINCT target_company ORDER BY target_company) AS aliases
  FROM normalized
  WHERE normalized_name <> ''
  GROUP BY normalized_name
)
INSERT INTO public.startup_companies (canonical_name, normalized_name, aliases)
SELECT canonical_name, normalized_name, aliases
FROM grouped
ON CONFLICT (normalized_name) DO UPDATE
SET aliases = (
  SELECT ARRAY_AGG(DISTINCT alias ORDER BY alias)
  FROM UNNEST(public.startup_companies.aliases || EXCLUDED.aliases) AS alias
), updated_at = NOW();

UPDATE public.vc_investments AS investment
SET startup_id = startup.id,
    investor_role = CASE WHEN investment.is_lead THEN 'lead' ELSE 'participant' END,
    deal_status = CASE
      WHEN COALESCE(investment.notes, '') LIKE '%予定段階%' THEN 'planned'
      ELSE investment.deal_status
    END
FROM public.startup_companies AS startup
WHERE investment.startup_id IS NULL
  AND startup.normalized_name = LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(investment.target_company, '(株式会社|有限会社|合同会社)', '', 'g'),
      '[[:space:]・･\.．,，()（）]+', '', 'g'
    )
  );

-- VC 台帳は AMD メンバー全員が閲覧・編集する既存方針を継承する。
ALTER TABLE public.startup_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_funding_rounds ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['startup_companies', 'startup_funding_rounds'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS anon_read ON public.%I', table_name);
    EXECUTE format('CREATE POLICY anon_read ON public.%I FOR SELECT USING (true)', table_name);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_all ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY authenticated_all ON public.%I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS service_role_bypass ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY service_role_bypass ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      table_name
    );
  END LOOP;
END $$;

-- プロンプト本文は DB 正本。コードには調査指示を埋め込まない。
INSERT INTO public.llm_prompts (
  prompt_key,
  description,
  body,
  model,
  max_tokens,
  is_active,
  notes,
  updated_by
)
VALUES (
  'vc.investment_history.collect.v1',
  'AMD PJ と接点がある VC の公開投資履歴を、ラウンド総額と VC 個別額を分けて候補収集する',
  $prompt$あなたは国内ディープテック投資の調査担当。
VC「{{VC_NAME}}」{{VC_NAME_EN}}の公開投資履歴を検索し、今回まだ登録されていない代表的な投資ラウンドを最大8件返してください。

VC公式サイト: {{VC_WEBSITE}}
既存の登録済み投資先・出典: {{EXISTING_INVESTMENTS}}

必須ルール:
- VCまたは投資先SUの公式発表を優先し、各件に根拠URLを1つ付ける。
- 発表日と払込完了日は別。確認できない日付は null。
- ラウンド総額と、このVC単独の出資額を絶対に混同しない。
- 「総額○億円を調達」しか分からない場合、round_total_*だけを埋め、investor_amount_*は null、investor_amount_disclosure は "not_found" または "undisclosed" にする。
- 金額が範囲なら low/high、単一額なら同額を low/high に入れる。
- 通貨は JPY / USD / EUR など3文字で返し、換算推定しない。
- 出資予定、発表済み、払込確認済みを分ける。推測で completed にしない。
- 号ファンドが根拠に明記されない場合は fund_no を null にする。
- 見つからない項目を推測で補わない。
- 同じラウンドを複数の記事から重複して返さない。

出力は必ず次のタグで囲んだJSONだけにする。
<vc_investment_json>{"rounds":[{"startup_name":"SU正式名","startup_name_en":null,"startup_website":null,"round_label":"seed|series_a|series_b|series_c|series_d|bridge|growth|unknown","announced_on":"YYYY-MM-DD|null","completed_on":"YYYY-MM-DD|null","deal_status":"planned|announced|completed|unknown","round_total_amount_low":null,"round_total_amount_high":null,"round_total_currency":"JPY","round_total_disclosure":"exact|range|undisclosed|not_found","investor_amount_low":null,"investor_amount_high":null,"investor_amount_currency":"JPY","investor_amount_disclosure":"exact|range|undisclosed|not_found","investor_role":"lead|co_lead|participant|unknown","fund_no":null,"source_url":"https://...","source_title":"根拠資料名","evidence_note":"確認できた事実だけを120字以内で要約"}]}</vc_investment_json>$prompt$,
  'claude-haiku-4-5-20251001',
  4096,
  TRUE,
  '2026-09-09 まさ承認。軽量モデル限定。収集結果は candidate で保存し、人の確認前に confirmed にしない。',
  'masa-approved-2026-09-09'
)
ON CONFLICT (prompt_key) DO NOTHING;
