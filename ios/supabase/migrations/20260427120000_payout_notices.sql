-- 支払通知書（メンバー単位）の送付ステータス
-- 1メンバー × 1ym = 1通の通知書という運用に変更したため、
-- billing_cycles.payout_notice_uploaded_at（PJ単位）とは別軸の per-member 状態が必要。

CREATE TABLE IF NOT EXISTS payout_notices (
  member_id  TEXT NOT NULL,
  ym         TEXT NOT NULL,
  sent_at    TIMESTAMPTZ,
  notice_no  TEXT,
  pdf_url    TEXT,
  total_yen  INTEGER,
  PRIMARY KEY (member_id, ym)
);

CREATE INDEX IF NOT EXISTS idx_payout_notices_ym ON payout_notices (ym);

ALTER TABLE payout_notices ENABLE ROW LEVEL SECURITY;

-- Admin（masa / kyoko）と当該メンバー本人のみアクセス可
DROP POLICY IF EXISTS "payout_notices_select" ON payout_notices;
CREATE POLICY "payout_notices_select"
  ON payout_notices FOR SELECT
  USING (
    member_id IN (
      SELECT member_id FROM members WHERE email = auth.jwt()->>'email'
    )
    OR
    (auth.jwt()->>'email') IN ('masa@team-armada.jp', 'kyoko@team-armada.jp')
  );

-- service_role は RLS をバイパスするので Edge Function からの書き込みは無制限
