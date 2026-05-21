-- 060_l2_registry_and_xrl_evidence.sql
--
-- L2 ⑦ OS台帳差分 / L2 ⑧ XRL根拠。
--
-- まさ判断 (2026-05-15):
--   - 5生データと OS 構造データの差分を、新しい L2 として通知・採否・DB反映できるようにする。
--   - project_founding_members は候補ではなく L2 ⑧ XRL根拠の一部。
--   - XRL根拠は founding members だけでなく TRL / BRL / GRL / SRL / HRL の算定根拠を束ねる。

-- 通知に小さな候補 patch / evidence refs を持たせる余地を追加。
-- 本文全文は入れない。全文は source refs / connector / 元サービスで辿る。
ALTER TABLE l2_notifications
  ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN l2_notifications.metadata_json IS
  '通知に紐づく軽量 metadata。候補 patch / evidence refs / confidence など。メール全文・議事録全文は保存しない。';

-- ============================================================
-- L2 ⑦ OS台帳差分
-- ============================================================

CREATE TABLE IF NOT EXISTS project_registry_diffs (
  diff_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  ym                    TEXT,
  scope_key             TEXT GENERATED ALWAYS AS (COALESCE(ym, 'global')) STORED,
  diff_kind             TEXT NOT NULL,
  target_table          TEXT NOT NULL,
  target_key            TEXT,
  target_key_norm       TEXT GENERATED ALWAYS AS (COALESCE(target_key, '')) STORED,
  current_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_patch_hash   TEXT NOT NULL,
  evidence_refs_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence            NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status                TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'applied', 'archived')),
  review_comment        TEXT,
  created_by            TEXT NOT NULL DEFAULT 'automation',
  reviewed_by           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at           TIMESTAMPTZ,
  applied_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prd_unique
  ON project_registry_diffs(project_id, scope_key, diff_kind, target_table, target_key_norm, proposed_patch_hash);

CREATE INDEX IF NOT EXISTS idx_prd_project_status
  ON project_registry_diffs(project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prd_kind_status
  ON project_registry_diffs(diff_kind, status, created_at DESC);

ALTER TABLE project_registry_diffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prd_select_anon ON project_registry_diffs;
CREATE POLICY prd_select_anon ON project_registry_diffs FOR SELECT USING (true);

DROP POLICY IF EXISTS prd_insert_authenticated ON project_registry_diffs;
CREATE POLICY prd_insert_authenticated ON project_registry_diffs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS prd_update_authenticated ON project_registry_diffs;
CREATE POLICY prd_update_authenticated ON project_registry_diffs FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS prd_service_role_all ON project_registry_diffs;
CREATE POLICY prd_service_role_all ON project_registry_diffs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON project_registry_diffs TO anon, authenticated;
GRANT INSERT, UPDATE ON project_registry_diffs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_registry_diffs TO service_role;

COMMENT ON TABLE project_registry_diffs IS
  'L2 ⑦ OS台帳差分。5生データとOS構造データの差分候補を pending diff として保存し、通知から採否・DB反映する。';
COMMENT ON COLUMN project_registry_diffs.proposed_patch_json IS
  '採用時に適用する候補 patch。自動反映は API 側の allowlist で制限する。';
COMMENT ON COLUMN project_registry_diffs.evidence_refs_json IS
  '根拠参照。source id / date / sender / snippet / hash のみ。メール全文・議事録全文は保存しない。';

-- ============================================================
-- L2 ⑧ XRL根拠
-- ============================================================

CREATE TABLE IF NOT EXISTS project_xrl_evidence (
  evidence_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  ym                    TEXT,
  scope_key             TEXT GENERATED ALWAYS AS (COALESCE(ym, 'global')) STORED,
  axis                  TEXT NOT NULL CHECK (axis IN ('trl', 'brl', 'grl', 'srl', 'hrl')),
  evidence_kind         TEXT NOT NULL,
  summary               TEXT NOT NULL,
  structured_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_refs_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_hash           TEXT NOT NULL,
  confidence            NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status                TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'confirmed', 'rejected', 'archived')),
  created_by            TEXT NOT NULL DEFAULT 'automation',
  confirmed_by          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pxe_unique
  ON project_xrl_evidence(project_id, scope_key, axis, evidence_kind, source_hash);

CREATE INDEX IF NOT EXISTS idx_pxe_project_status
  ON project_xrl_evidence(project_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pxe_axis_status
  ON project_xrl_evidence(axis, status, created_at DESC);

ALTER TABLE project_xrl_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pxe_select_anon ON project_xrl_evidence;
CREATE POLICY pxe_select_anon ON project_xrl_evidence FOR SELECT USING (true);

DROP POLICY IF EXISTS pxe_insert_authenticated ON project_xrl_evidence;
CREATE POLICY pxe_insert_authenticated ON project_xrl_evidence FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS pxe_update_authenticated ON project_xrl_evidence;
CREATE POLICY pxe_update_authenticated ON project_xrl_evidence FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS pxe_service_role_all ON project_xrl_evidence;
CREATE POLICY pxe_service_role_all ON project_xrl_evidence
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON project_xrl_evidence TO anon, authenticated;
GRANT INSERT, UPDATE ON project_xrl_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON project_xrl_evidence TO service_role;

COMMENT ON TABLE project_xrl_evidence IS
  'L2 ⑧ XRL根拠。TRL/BRL/GRL/SRL/HRL の算定根拠を保存する。project_founding_members は HRL 根拠の既存テーブルとして併用。';
COMMENT ON COLUMN project_xrl_evidence.source_refs_json IS
  '根拠参照。source id / date / snippet / hash のみ。メール全文・議事録全文は保存しない。';
