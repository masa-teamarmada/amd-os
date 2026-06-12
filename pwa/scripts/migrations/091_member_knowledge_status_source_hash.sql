-- migration 091 (= 2026-05-25 まさ #71 後段、L5 routine schema gap 解消)
--
-- L5 D-4 メンバーナレッジ抽出 routine (= amd-os-l5-member-knowledge-extract) が
-- 候補採否設計 (= candidate 状態で upsert → 通知 → まさが「はい」で active) と
-- source_hash 差分検知 (= 同入力なら LLM call スキップ) を回せるよう、
-- member_knowledge テーブルに不足列を追加。
--
-- 既存 row は D-1D-3D-5M-2D-6 と整合させるため status='active' で backfill (= 既存採用済として扱う)。
-- 今後 routine が新規抽出する row は status='candidate' で INSERT → 通知 → 採否。
--
-- 関連設計議論: pwa/design/member_knowledge.md / pwa/design/l2_extract_claude_routine.md
-- 関連 SKILL.md: ~/.claude/scheduled-tasks/amd-os-l5-member-knowledge-extract/SKILL.md

-- ============================================================
-- 1) member_knowledge に列追加
-- ============================================================

ALTER TABLE member_knowledge
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('candidate', 'active', 'rejected', 'archived')),
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN member_knowledge.status IS 'まさ #71 2026-05-25: candidate (= L5 routine 新規抽出、通知中) / active (= まさ「はい」で確定) / rejected (= まさ「いいえ」) / archived (= 古いカテゴリ、表示しない)。既存 row は backfill で active';
COMMENT ON COLUMN member_knowledge.source_hash IS 'まさ #71: L5 routine の差分検知用。member_activities + project_meeting_summaries + milestone_responsibility の hash。同 hash なら LLM call スキップ';
COMMENT ON COLUMN member_knowledge.last_processed_at IS 'まさ #71: L5 routine が最後に処理した時刻。NULL 優先で古い順に処理';

-- ============================================================
-- 2) 既存 row を status='active' で backfill (= 既存採用済として扱う)
-- ============================================================
-- DEFAULT 'active' で NOT NULL なので新規挿入時は自動で active になる。
-- 既存 row も DEFAULT 適用で active のはず。念のため明示 UPDATE しておく。

UPDATE member_knowledge SET status = 'active' WHERE status IS NULL;

-- ============================================================
-- 3) status + source_hash の index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_member_knowledge_status
  ON member_knowledge(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_knowledge_source_hash
  ON member_knowledge(code_name, source_hash);
