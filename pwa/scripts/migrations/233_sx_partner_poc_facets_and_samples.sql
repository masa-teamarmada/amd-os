-- 233: SX関係先台帳のPoC営業ファセット (段階×活動状態×区分) と試料台帳
--
-- 背景 (2026-08-05 まさ確定):
--   PoC候補先スプレッドシート (26社 x 20列 + 履歴40件 + サンプル台帳21件) を
--   /project/p21/weekly-control の関係先リストへ統合する。
--   - 段階: relationship_stage を PoC営業の実段階へ拡張 (固定段階を避ける旧方針は
--     Codex 由来でまさの要望ではない、と 2026-08-05 に明示確認済み)
--   - 活動状態: 対応中/先方待ち/社内待ち/停滞/保留/見送り を独立 facet で持つ
--   - 候補区分: PoC候補先/技術協力先/試料提供元/試料提供ルート
--   - 試料台帳: 1関係先N試料の軽量台帳 (試料種/状態/受領日/保管場所/担当/要確認)

-- 1) relationship_stage の CHECK を PoC営業段階込みへ拡張
ALTER TABLE project_management_partners
  DROP CONSTRAINT IF EXISTS project_management_partners_relationship_stage_check;
ALTER TABLE project_management_partners
  ADD CONSTRAINT project_management_partners_relationship_stage_check
  CHECK (relationship_stage IN (
    'candidate',
    'first_contact',
    'information_exchange',
    'hearing',
    'meeting_coordination',
    'technical_review',
    'condition_alignment',
    'sample_acquisition',
    'validation_preparation',
    'agreement_confirmation',
    'executing',
    'on_hold',
    'declined'
  ));

-- 2) 活動状態 (段階と独立した運用状態)
ALTER TABLE project_management_partners
  ADD COLUMN IF NOT EXISTS activity_state text NOT NULL DEFAULT 'unknown';
ALTER TABLE project_management_partners
  DROP CONSTRAINT IF EXISTS pm_partners_activity_state_check_233;
ALTER TABLE project_management_partners
  ADD CONSTRAINT pm_partners_activity_state_check_233
  CHECK (activity_state IN (
    'active', 'waiting_partner', 'waiting_internal', 'stalled',
    'on_hold', 'dropped', 'unknown'
  ));

-- 3) 候補区分 (PoC系の関係先だけが持つ。null = PoC営業対象外の一般関係先)
ALTER TABLE project_management_partners
  ADD COLUMN IF NOT EXISTS poc_category text NULL;
ALTER TABLE project_management_partners
  DROP CONSTRAINT IF EXISTS pm_partners_poc_category_check_233;
ALTER TABLE project_management_partners
  ADD CONSTRAINT pm_partners_poc_category_check_233
  CHECK (poc_category IS NULL OR poc_category IN (
    'poc_candidate', 'tech_partner', 'sample_provider', 'sample_route'
  ));

-- 4) 試料台帳 (軽量版)。物理現物の受領・保管・分析の追跡は関係先関係と寿命が違うため独立テーブル。
CREATE TABLE IF NOT EXISTS project_management_partner_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  partner_id uuid NOT NULL REFERENCES project_management_partners(id),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('intent', 'negotiating', 'agreed_pending', 'scheduled', 'received', 'analyzed', 'unknown')),
  received_on date NULL,
  storage_location text NULL,
  owner_label text NULL,
  notes text NULL,
  confidence text NOT NULL DEFAULT 'unknown'
    CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
  source_kind text NOT NULL DEFAULT 'current_truth'
    CHECK (source_kind IN ('current_truth', 'manual', 'imported')),
  source_ref text NULL,
  sort_order int4 NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by text NULL,
  version int4 NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pm_partner_samples_project
  ON project_management_partner_samples(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_partner_samples_partner
  ON project_management_partner_samples(partner_id) WHERE deleted_at IS NULL;

ALTER TABLE project_management_partner_samples ENABLE ROW LEVEL SECURITY;
