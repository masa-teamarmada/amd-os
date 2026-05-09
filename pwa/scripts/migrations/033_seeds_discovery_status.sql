-- 033_seeds_discovery_status.sql
--
-- Seeds の自動収集 cron (/api/cron/seeds-ingest) 導入に伴い、
-- seeds に discovery_status 列を追加して受信箱 (/seeds/inbox) を成立させる。
--
-- discovery_status:
--   'reviewed'   = 人が確認済み (デフォルト、既存 142 件は全部これ)
--   'discovered' = cron が新規発見、未確認 → /seeds/inbox に表示
--   'dismissed'  = ノイズと判断、リストから除外

ALTER TABLE seeds ADD COLUMN IF NOT EXISTS discovery_status TEXT NOT NULL DEFAULT 'reviewed';

-- 既存 142 件は default で 'reviewed' になる (NOT NULL DEFAULT)。明示 update は不要。

CREATE INDEX IF NOT EXISTS idx_seeds_discovery_status ON seeds(discovery_status)
  WHERE discovery_status = 'discovered';

COMMENT ON COLUMN seeds.discovery_status IS 'reviewed=人が確認済 / discovered=cron が新規発見、未確認 / dismissed=ノイズ扱い';
