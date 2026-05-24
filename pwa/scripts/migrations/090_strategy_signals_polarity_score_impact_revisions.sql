-- migration 090 (= 2026-05-25 まさ #21 + #20-2 + #29 + #31 統合)
--
-- 1) project_strategy_signals に列追加:
--    - polarity (TEXT)               = 🎉 breakthrough / ✨ forward / 🔄 pivot / ⚠️ risk (まさ #29、🌐 中立は廃止)
--    - score_impact_summary (TEXT)   = 「📊 影響: TRL 4→5、X 軸 +40pt」のような短文 (まさ #31 案 A)
--    - score_impact_delta_json (JSONB) = { "TRL": {"before": 4, "after": 5}, "S": {"before": 3500, "after": 3900} }
--
-- 2) 新テーブル amd_score_revisions:
--    まさが AMD スコアグラフの未来予測 (破線) ドットを修正したときに保存。
--    つくよみ自動修正提案も同テーブルに source='tsukuyomi_proposal' で蓄積。
--    まさ #21 alpha フィードバックループの起点。
--
-- 3) 新テーブル amd_score_alpha_proposals:
--    週次 cron が直近 7 日の amd_score_revisions を集約 → Sonnet が「修正パターン」抽出
--    → alpha 重み推奨修正を pending status で提案。/admin/amd-score-alpha-review で approve/reject。
--
-- 関連設計議論: pwa/design/score_revision_feedback_loop.md / strategy_signals_redesign.md
-- 番号変更経緯: 元々 migration 089 想定だったが、別 codex セッションが 089 を new_business カテゴリ追加で
--             消費したため (= 2026-05-25 #36 commit 9127b57)、本 migration は 090 にずらして発行。

-- ============================================================
-- 1) project_strategy_signals に polarity / score_impact 列追加
-- ============================================================

ALTER TABLE project_strategy_signals
  ADD COLUMN IF NOT EXISTS polarity TEXT
    CHECK (polarity IS NULL OR polarity IN ('breakthrough','forward','pivot','risk')),
  ADD COLUMN IF NOT EXISTS score_impact_summary TEXT,
  ADD COLUMN IF NOT EXISTS score_impact_delta_json JSONB;

COMMENT ON COLUMN project_strategy_signals.polarity IS 'まさ #29 2026-05-24: 🎉 breakthrough / ✨ forward / 🔄 pivot / ⚠️ risk。cockpit のカード左端にアイコンで表示。🌐 中立は廃止 (= 外部環境シグナルも PJ にとってプラス or マイナスのいずれかに必ず分類する)';
COMMENT ON COLUMN project_strategy_signals.score_impact_summary IS 'まさ #31 2026-05-24 案A: 「📊 影響: TRL 4→5、X 軸 +40pt」のような短文。経営ハイライトカードの summary 下に 1 行表示';
COMMENT ON COLUMN project_strategy_signals.score_impact_delta_json IS 'まさ #31 2026-05-24 案A: { "TRL": {"before": 4, "after": 5}, "S": {"before": 3500, "after": 3900} } のような構造化 delta。後追い集計用';

-- ============================================================
-- 2) amd_score_revisions 新テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS amd_score_revisions (
  revision_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  score_input_id     UUID REFERENCES amd_score_inputs(id) ON DELETE SET NULL,
  axis               TEXT NOT NULL,
  old_value          NUMERIC,
  new_value          NUMERIC NOT NULL,
  evaluated_at       DATE NOT NULL,
  reason_md          TEXT NOT NULL,
  discussion_md      TEXT,
  revised_by         TEXT NOT NULL,
  revised_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_to_alpha   BOOL NOT NULL DEFAULT FALSE,
  alpha_proposal_id  UUID,
  source             TEXT NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual','tsukuyomi_proposal','admin')),
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','confirmed','rejected','archived')),
  confidence         NUMERIC,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_revisions_unapplied
  ON amd_score_revisions(project_id, axis)
  WHERE applied_to_alpha = FALSE;

CREATE INDEX IF NOT EXISTS idx_score_revisions_project_evaluated
  ON amd_score_revisions(project_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_score_revisions_source_status
  ON amd_score_revisions(source, status, created_at DESC);

COMMENT ON TABLE amd_score_revisions IS 'まさ #21 2026-05-24: AMD スコア未来予測 (破線) の修正履歴。まさ手動 + つくよみ自動提案両方を蓄積。週次 cron が集約して amd_score_alpha_proposals に変換';
COMMENT ON COLUMN amd_score_revisions.axis IS 'mu_A / mu_I / mu_G / trl / brl / grl / srl / hrl / frl_grit / frl_resilience';
COMMENT ON COLUMN amd_score_revisions.source IS 'manual = まさが破線クリックで手動修正 / tsukuyomi_proposal = 日次 cron による自動提案 / admin = admin 画面から修正';
COMMENT ON COLUMN amd_score_revisions.status IS 'active = 修正適用済 (= amd_score_inputs.update 反映済) / confirmed = まさが /notifications で「はい」 / rejected = まさが「いいえ」 / archived = alpha proposal 反映後';

-- ============================================================
-- 3) amd_score_alpha_proposals 新テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS amd_score_alpha_proposals (
  proposal_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_period_start  DATE NOT NULL,
  analysis_period_end    DATE NOT NULL,
  pattern_summary_md     TEXT NOT NULL,
  proposed_alpha_diff    JSONB NOT NULL,
  reasoning_md           TEXT NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','rejected','superseded')),
  applied_revisions_count INT NOT NULL DEFAULT 0,
  approved_by            TEXT,
  approved_at            TIMESTAMPTZ,
  rejected_reason        TEXT,
  applied_alpha_version_id UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alpha_proposals_status
  ON amd_score_alpha_proposals(status, created_at DESC);

COMMENT ON TABLE amd_score_alpha_proposals IS 'まさ #21 2026-05-24: 週次 cron が amd_score_revisions を集約して LLM (Sonnet) で抽出した alpha 重み修正提案。/admin/amd-score-alpha-review で approve/reject';
COMMENT ON COLUMN amd_score_alpha_proposals.proposed_alpha_diff IS 'JSONB: { "mu_A": {"old": 0.18, "new": 0.15}, "frl_resilience": {"old": 0.07, "new": 0.05} } のような構造';

-- ============================================================
-- 4) amd_score_revisions の alpha_proposal_id を amd_score_alpha_proposals(proposal_id) に FK 追加
--    (循環 FK 回避のため、後付け ALTER で追加)
-- ============================================================

ALTER TABLE amd_score_revisions
  ADD CONSTRAINT amd_score_revisions_alpha_proposal_fk
  FOREIGN KEY (alpha_proposal_id) REFERENCES amd_score_alpha_proposals(proposal_id) ON DELETE SET NULL;

-- ============================================================
-- 5) RLS (= service_role + admin members のみ操作可)
-- ============================================================

ALTER TABLE amd_score_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE amd_score_alpha_proposals ENABLE ROW LEVEL SECURITY;

-- service_role はすべて
CREATE POLICY amd_score_revisions_service_role_all ON amd_score_revisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY amd_score_alpha_proposals_service_role_all ON amd_score_alpha_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- authenticated は admin のみ select 可
CREATE POLICY amd_score_revisions_admin_select ON amd_score_revisions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM members m WHERE m.email = auth.email() AND m.is_admin = true));
CREATE POLICY amd_score_alpha_proposals_admin_select ON amd_score_alpha_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM members m WHERE m.email = auth.email() AND m.is_admin = true));
