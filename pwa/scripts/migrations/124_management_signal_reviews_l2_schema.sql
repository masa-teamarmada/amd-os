-- 124: Management monthly signal reviews L2 schema
--
-- L2⑯ Management Monthly Signal Evaluation の正式schema候補。
-- 122_management_signal_reviews.sql の初期形を、修正版 /management-score UI に合わせて
-- 状態ラベル/アイコン、自然文評価、sections[]、source confidence、履歴管理へ拡張する。
-- company_budget_variance_notes は短文差分メモ専用なので、月末評価全文の正本にはしない。

ALTER TABLE company_management_signal_reviews
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status_label TEXT NOT NULL DEFAULT '評価候補/中立'
    CHECK (status_label IN ('概ね良好', '注意して進める', '要介入', '評価候補/中立')),
  ADD COLUMN IF NOT EXISTS status_tone TEXT NOT NULL DEFAULT 'neutral'
    CHECK (status_tone IN ('good', 'watch', 'danger', 'neutral')),
  ADD COLUMN IF NOT EXISTS status_icon TEXT NOT NULL DEFAULT 'neutral'
    CHECK (status_icon IN ('good', 'watch', 'danger', 'neutral')),
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS sections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500
    CHECK (source_confidence >= 0 AND source_confidence <= 1),
  ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS automation_id TEXT,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

UPDATE company_management_signal_reviews
SET
  headline = COALESCE(headline, summary),
  automation_id = COALESCE(automation_id, codex_automation_id)
WHERE headline IS NULL OR automation_id IS NULL;

ALTER TABLE company_management_signal_reviews
  ALTER COLUMN headline SET NOT NULL;

ALTER TABLE company_management_signal_reviews
  DROP CONSTRAINT IF EXISTS company_management_signal_reviews_ym_status_key;

CREATE UNIQUE INDEX IF NOT EXISTS cmsr_ym_version_key
  ON company_management_signal_reviews(ym, version);

CREATE UNIQUE INDEX IF NOT EXISTS cmsr_current_ym_key
  ON company_management_signal_reviews(ym)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS cmsr_generated_at_idx
  ON company_management_signal_reviews(generated_at DESC);

COMMENT ON TABLE company_management_signal_reviews IS
  'L2⑯ Management Monthly Signal Evaluation。月末時点のManagement Score、予実、入金、支払通知、billing/payout/freee PLを、状態ラベル/アイコン・自然文評価・判断コメントへ変換して保存する。';

COMMENT ON COLUMN company_management_signal_reviews.status_label IS
  '概ね良好 / 注意して進める / 要介入 / 評価候補/中立。';

COMMENT ON COLUMN company_management_signal_reviews.sections_json IS
  'sections[]: title/body/items[]/tone。標準sectionは先3か月の温度感、費用の見方、次の営業判断、乖離の読み方、今すぐ見ること。';

COMMENT ON COLUMN company_management_signal_reviews.source_confidence IS
  '0-1。Management Score snapshot、予実、freee、billing/payout、L2 refs の揃い具合から評価する根拠信頼度。';
