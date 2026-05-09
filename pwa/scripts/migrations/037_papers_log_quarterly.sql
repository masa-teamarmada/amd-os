-- 037_papers_log_quarterly.sql
--
-- papers_log を quarter 単位 (YYYY-(01|04|07|10)-01) で再構築する。
--
-- 背景 (data_specification.md §N):
--   N (論文流出率) = lane × 期間の論文出版件数。観測頻度は **四半期** が base case。
--   既存の papers_log は year 単位 (YYYY-01-01) で 85 行入っているが、
--   観測モデル C 行列の loading で μ_A への強い loading (0.90) を計算するには
--   quarter 単位の trend が必要。
--
-- 変更:
--   1. 既存 year 単位 85 行を全削除
--   2. UNIQUE (lane, observed_at) を追加 → cron が upsert で重複防止
--   3. /api/cron/papers-quarterly-ingest が OpenAlex で 5 lane × 直近 12 Q を投入

-- 1. 既存データクリア
DELETE FROM papers_log;

-- 2. UNIQUE (lane, observed_at) 追加 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'papers_log_lane_observed_at_uq'
      AND conrelid = 'papers_log'::regclass
  ) THEN
    ALTER TABLE papers_log
      ADD CONSTRAINT papers_log_lane_observed_at_uq UNIQUE (lane, observed_at);
  END IF;
END $$;

COMMENT ON TABLE papers_log IS
  'Triple Helix 観測量 N (論文流出率) の lane × quarter 時系列。OpenAlex weekly cron で投入。observed_at は YYYY-(01|04|07|10)-01 で quarter 開始日。';
COMMENT ON COLUMN papers_log.observed_at IS
  '四半期開始日 (YYYY-01-01 = Q1 / 04-01 = Q2 / 07-01 = Q3 / 10-01 = Q4)';
COMMENT ON COLUMN papers_log.paper_count IS
  '当該 lane × quarter で出版された論文数 (OpenAlex 検索ヒット件数)';
