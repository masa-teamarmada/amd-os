-- 032_l2_feedbacks.sql
-- L2 抽出結果に対するまさからの修正依頼 (= つくよみへのフィードバック) を保存するテーブル。
-- 上流 (GAS 155 / PWA progress-estimator) が次回抽出時に、対象 L2 × target の
-- active feedback を LLM プロンプトに含めて再抽出することで「過去の指摘を反映」する。
--
-- 用途例:
--   - "BWE 総会の議事録に CX 神谷さんが出てきてる、PJ 紐付けが間違ってる"
--   - "メンバー かる の skills は 'VC 選定' でなく '財務モデル設計' が中心"
--
-- 仕様正本: pwa/design/notifications.md (新規予定)

CREATE TABLE IF NOT EXISTS l2_feedbacks (
  feedback_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 何に対するフィードバックか (= LLM が次回抽出で参照する key)
  l2_kind         TEXT NOT NULL,        -- 'member_knowledge'|'project_knowledge'|'protocols'|'ms_progress'|'meeting_summary'
  target_id       TEXT NOT NULL,        -- code_name (member系) / project_id (PJ系) / meeting_id (meeting系)
  scope_key       TEXT NOT NULL DEFAULT 'global',  -- ym (PJ系) / 'global' (member/meeting系)

  -- 関連する通知 (オプション、UI から作る場合は紐付ける)
  notification_id UUID,                 -- l2_notifications.notification_id (nullable, FK 制約は付けない)
  meeting_id      TEXT,                 -- meeting_notifications.meeting_id (nullable)

  -- フィードバック本文
  feedback_text   TEXT NOT NULL,        -- まさが書いた修正依頼文 (200-1000 字想定)
  status          TEXT NOT NULL DEFAULT 'active',  -- 'active' (LLM が参照) | 'archived' (古くて無視)

  -- 作成者
  created_by      TEXT,                 -- code_name (= まさ等)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- LLM 適用ログ (= 何回プロンプトに含められたか、最後に含めたのはいつか)
  applied_count   INT NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_l2f_kind_target_active
  ON l2_feedbacks (l2_kind, target_id, scope_key)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_l2f_created_at
  ON l2_feedbacks (created_at DESC);

GRANT SELECT ON l2_feedbacks TO anon, authenticated;
GRANT INSERT, UPDATE ON l2_feedbacks TO authenticated;
GRANT INSERT, UPDATE ON l2_feedbacks TO service_role;

ALTER TABLE l2_feedbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS l2f_select_anon ON l2_feedbacks;
CREATE POLICY l2f_select_anon ON l2_feedbacks FOR SELECT USING (true);

DROP POLICY IF EXISTS l2f_insert_authenticated ON l2_feedbacks;
CREATE POLICY l2f_insert_authenticated ON l2_feedbacks FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS l2f_update_authenticated ON l2_feedbacks;
CREATE POLICY l2f_update_authenticated ON l2_feedbacks FOR UPDATE TO authenticated USING (true);
