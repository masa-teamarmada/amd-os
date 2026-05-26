-- 093: project_ventures.amd_support_ended_at
--
-- AMD が PJ 支援を終了した時刻 (= 卒業確定タイムスタンプ)。
-- バイタルサイン v4 で「先手力評価対象 PJ の絞り込み」と
-- 「戦略接近度 graduation_score 加点条件」 に使う:
-- - amd_support_ended_at IS NULL → AMD まだ支援中 = 先手力評価対象
-- - amd_support_ended_at IS NOT NULL + outcome_pattern IN ('rocket','lifted','smb') → 成功卒業として加点
--
-- 設計: pwa/manual/29-management-score-and-finance-simulation-spec.md L132- (先手力 v4 卒業 PJ 除外)
--       pwa/manual/39-graduation-detection-spec.md (= 卒業フェーズ検出機能)
ALTER TABLE project_ventures
  ADD COLUMN IF NOT EXISTS amd_support_ended_at TIMESTAMPTZ;

COMMENT ON COLUMN project_ventures.amd_support_ended_at IS
  'AMD が PJ 支援を終了した時刻。NULL = まだ支援中。バイタルサイン v4 で先手力評価対象 PJ の絞り込みと graduation_score 加点に使う。';
