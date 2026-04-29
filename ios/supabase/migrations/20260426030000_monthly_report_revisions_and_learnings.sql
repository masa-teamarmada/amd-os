-- ============================================================
-- (1) つくよみ ↔ PM: 月次レポート修正依頼フロー
-- (2) つくよみ汎用学習テーブル
-- 2026-04-26
-- ============================================================

-- (1) 月次レポートの修正依頼。LLMが修正版全文を提案し、PMがhunkごとに承認/却下するフロー
CREATE TABLE IF NOT EXISTS monthly_report_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL,
  ym              TEXT NOT NULL,
  -- 依頼内容
  instruction     TEXT NOT NULL,
  requested_by    TEXT,
  -- LLMが提案した修正後全文
  revised_content TEXT,
  -- 状態: pending=提案中, applied=適用済み, discarded=破棄
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'applied', 'discarded')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_revisions_pj_ym ON monthly_report_revisions (project_id, ym, created_at DESC);

-- (1b) つくよみ応答メッセージ（将来の対話拡張用）
CREATE TABLE IF NOT EXISTS monthly_report_revision_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id   UUID NOT NULL REFERENCES monthly_report_revisions(id) ON DELETE CASCADE,
  sender_kind   TEXT NOT NULL CHECK (sender_kind IN ('pm', 'tsukuyomi')),
  body          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_revision_msgs ON monthly_report_revision_messages (revision_id, created_at);

-- (2) つくよみ汎用学習テーブル
-- scope='monthlyReport' / 'msActivity' / 'meta' など
-- scope_key = project_id など（NULL = グローバル）
CREATE TABLE IF NOT EXISTS tsukuyomi_learnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL,
  scope_key       TEXT,
  content         TEXT NOT NULL,
  source          TEXT,          -- 'rejection_reason' / 'admin_unlearn' / 'auto'
  source_ref      TEXT,          -- 元の revision_id など
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'removed')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      TEXT,
  removed_at      TIMESTAMPTZ,
  removed_by      TEXT,
  removed_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tsukuyomi_learnings_scope ON tsukuyomi_learnings (scope, scope_key, status);

-- RLS (service_role は bypass、anon/authenticated は自分の学習のみ閲覧)
ALTER TABLE monthly_report_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_report_revision_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tsukuyomi_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role bypass revisions" ON monthly_report_revisions
  USING (auth.role() = 'service_role');
CREATE POLICY "authenticated read revisions" ON monthly_report_revisions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated write revisions" ON monthly_report_revisions
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_role bypass revision_messages" ON monthly_report_revision_messages
  USING (auth.role() = 'service_role');
CREATE POLICY "authenticated rw revision_messages" ON monthly_report_revision_messages
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "service_role bypass learnings" ON tsukuyomi_learnings
  USING (auth.role() = 'service_role');
CREATE POLICY "authenticated read learnings" ON tsukuyomi_learnings
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated write learnings" ON tsukuyomi_learnings
  FOR ALL USING (auth.role() = 'authenticated');

-- updated_at trigger for monthly_report_revisions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_now') THEN
    CREATE OR REPLACE FUNCTION set_updated_at_now()
    RETURNS TRIGGER AS $body$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_report_revisions_updated_at'
  ) THEN
    CREATE TRIGGER trg_report_revisions_updated_at
      BEFORE UPDATE ON monthly_report_revisions
      FOR EACH ROW EXECUTE FUNCTION set_updated_at_now();
  END IF;
END $$;
