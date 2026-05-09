-- 031_l2_notifications.sql
-- L2 ③⑤④② Phase 4 抽出結果を Swift APNs ローカル通知に流すためのテーブル。
-- 既存 meeting_notifications (migration 028, ⑥ MTGサマリ専用) の姉妹テーブル。
--
-- 設計方針:
--   - FK は持たない (= 4 L2 + 将来追加分を l2_kind discriminator で統一)
--   - UNIQUE(l2_kind, target_id, scope_key) で同抽出を 1 行に集約
--   - saved_count / title / summary が変わったら trigger で notified_at = NULL に戻す = 再通知
--   - 同じ saved_count なら notified_at は保持される = 重複通知しない
--
-- 仕様正本: ios/HANDOFF_l2_notifications.md

CREATE TABLE IF NOT EXISTS l2_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  l2_kind         TEXT NOT NULL,        -- 'member_knowledge' | 'project_knowledge' | 'protocols' | 'ms_progress'
  target_id       TEXT NOT NULL,        -- code_name (member系) or project_id (PJ系)
  scope_key       TEXT NOT NULL,        -- ym (PJ系) or 'global' (member系)
  title           TEXT NOT NULL,        -- 通知タイトル "📥 [PJ名] AMDプロトコル candidate 2 件"
  summary         TEXT,                 -- 通知本文 (200 字程度)
  saved_count     INT  NOT NULL DEFAULT 0,
  total_count     INT  NOT NULL DEFAULT 0,
  importance      INT  NOT NULL DEFAULT 1,   -- 1=info, 2=normal, 3=urgent
  notified_at     TIMESTAMPTZ,          -- ★ Swift が APNs 送信したら now() で UPDATE
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT l2n_unique UNIQUE (l2_kind, target_id, scope_key)
);

-- 未通知の高速取得用 partial index
CREATE INDEX IF NOT EXISTS idx_l2_notifications_unsent
  ON l2_notifications (created_at DESC)
  WHERE notified_at IS NULL;

-- l2_kind ごとの集計用 index
CREATE INDEX IF NOT EXISTS idx_l2_notifications_kind
  ON l2_notifications (l2_kind, created_at DESC);

-- update トリガ: title / summary / saved_count が変わったら notified_at を NULL に戻す
-- = 議事録パターンと同じ「内容が変わったら再通知」
CREATE OR REPLACE FUNCTION l2n_reset_notified_at_on_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.saved_count IS DISTINCT FROM OLD.saved_count THEN
    NEW.notified_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_l2n_reset_notified_at ON l2_notifications;
CREATE TRIGGER trg_l2n_reset_notified_at
  BEFORE UPDATE ON l2_notifications
  FOR EACH ROW EXECUTE FUNCTION l2n_reset_notified_at_on_change();

-- RLS
GRANT SELECT, UPDATE ON l2_notifications TO authenticated;
GRANT SELECT ON l2_notifications TO anon;
GRANT INSERT, UPDATE ON l2_notifications TO service_role;

ALTER TABLE l2_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l2n_select_anon ON l2_notifications;
CREATE POLICY l2n_select_anon ON l2_notifications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS l2n_update_authenticated ON l2_notifications;
CREATE POLICY l2n_update_authenticated ON l2_notifications
  FOR UPDATE TO authenticated USING (true);
