-- 056_progress_events_and_monthly_notes.sql
--
-- 2026-05-12 まさ指摘 3 件をまとめて解消する migration:
--
-- (1) 進捗イベントが少ない / 「不明」だらけ
--   - 旧 GAS (gas/054_RewardScoring_EventExtract.js) は LLM が initiativeOrigin を必須付与していたが、
--     2026-05-07 の commit 6d81541 で GAS bridge → Supabase 直読み置換時に概念ごと消失
--   - 復元: member_activities に initiative_origin / impact / depth 列を追加
--   - cron は monthly_reports に加えて project_meeting_summaries も入力に渡す (= events 数を増やす)
--   - LLM prompt は llm_prompts.member_activities.extract に外部化 (migration 057)
--
-- (2) plan_cycle (= MS 期) が無い PJ で events 抽出が完全停止していた
--   - cron が plan_cycle 必須で skip してた + member_activities.member_id NOT NULL で
--     誰も特定できないイベントが入らなかった
--   - 復元: member_id / milestone_id を NULL 許容に
--
-- (3) MS なしでも月次モーダルに進捗ノートを残せるようにしたい (まさ 2026-05-12 タスク 3)
--   - milestone_monthly_progress は (milestone_key, ym) UNIQUE で MS 紐付け必須なので別テーブル
--   - project_monthly_notes 新設 (project_id × ym 単位の自由記述メモ)

BEGIN;

-- =====================================================================
-- (1) member_activities に進捗イベント抽出用の列を追加
-- =====================================================================

ALTER TABLE member_activities
  ADD COLUMN IF NOT EXISTS initiative_origin TEXT,
  ADD COLUMN IF NOT EXISTS impact            SMALLINT,
  ADD COLUMN IF NOT EXISTS depth             SMALLINT,
  ADD COLUMN IF NOT EXISTS reject_reason     TEXT,
  ADD COLUMN IF NOT EXISTS origin_lost_reason TEXT;

-- initiative_origin 値域チェック (= 旧 GAS validOrigins と同じ 5 値 + unknown)
ALTER TABLE member_activities
  DROP CONSTRAINT IF EXISTS member_activities_initiative_origin_check;
ALTER TABLE member_activities
  ADD  CONSTRAINT member_activities_initiative_origin_check
  CHECK (initiative_origin IS NULL OR initiative_origin IN
         ('amd_proposed','co_decided','partner_proposed','external','unknown'));

-- impact 1-5 / depth 0-1 (= 旧 GAS の reward_extract_parseResponse_ と同じ)
ALTER TABLE member_activities
  DROP CONSTRAINT IF EXISTS member_activities_impact_check;
ALTER TABLE member_activities
  ADD  CONSTRAINT member_activities_impact_check
  CHECK (impact IS NULL OR (impact >= 1 AND impact <= 5));

ALTER TABLE member_activities
  DROP CONSTRAINT IF EXISTS member_activities_depth_check;
ALTER TABLE member_activities
  ADD  CONSTRAINT member_activities_depth_check
  CHECK (depth IS NULL OR (depth = 0 OR depth = 1));

COMMENT ON COLUMN member_activities.initiative_origin IS
  '進捗イベントの発生起点。amd_proposed=AMD提案 / co_decided=協議決定 / partner_proposed=先方提案 / external=外部発生 / unknown=分類不能。先手力スコア (CockpitMonthlyModal EventsSection) の入力。LLM が monthly_report + meeting_summaries から推定し、判断不能なら unknown。';
COMMENT ON COLUMN member_activities.impact IS '影響度 1-5 (旧 GAS reward_extract と同じスケール)';
COMMENT ON COLUMN member_activities.depth IS '深度 0-1 (0=表層 / 1=深い踏み込み)';

-- =====================================================================
-- (2) member_id / milestone_id を NULL 許容に (= MS なし PJ でも events を抽出する)
-- =====================================================================

ALTER TABLE member_activities
  ALTER COLUMN member_id DROP NOT NULL;

-- milestone_id は migration 020 で追加され既に nullable 想定だが念のため idempotent に
ALTER TABLE member_activities
  ALTER COLUMN milestone_id DROP NOT NULL;

-- UNIQUE (member_id, project_id, source, source_item_id) は member_id NULL を許容しても
-- PostgreSQL の UNIQUE は NULL 同士を区別しないため複数 NULL 行が入りうる。
-- cron 側は DELETE → INSERT 方式 (member-activities cron の再実行時) なので運用上問題なし。
-- 既存制約はそのまま維持 (= member_id 入りの行は引き続き UNIQUE 検証される)。

-- =====================================================================
-- (3) project_monthly_notes 新テーブル (= MS なしでも進捗ノートを残せる)
-- =====================================================================

CREATE TABLE IF NOT EXISTS project_monthly_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT NOT NULL,
  ym          TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  updated_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, ym)
);

ALTER TABLE project_monthly_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read ON project_monthly_notes;
CREATE POLICY anon_read ON project_monthly_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS service_role_bypass ON project_monthly_notes;
CREATE POLICY service_role_bypass ON project_monthly_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_write ON project_monthly_notes;
CREATE POLICY auth_write ON project_monthly_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS project_monthly_notes_project_ym_idx
  ON project_monthly_notes (project_id, ym);

COMMENT ON TABLE project_monthly_notes IS
  'PJ × ym 単位の自由記述進捗ノート。MS plan_cycle が未設定の PJ でも月次モーダルで進捗メモを残せるようにする (= 2026-05-12 まさタスク 3)。MS あり PJ でも MS に紐付かない月次の出来事を補足するのに使える。';

COMMIT;
