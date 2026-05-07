-- 014_xrl_extend_to_5_axes.sql
--
-- project_xrl_log を 内閣府 SIP 5 XRL に拡張: GRL, SRL を追加。
-- 既存の trl/brl/hrl は維持。新規列は NULL 許容、既存 row は影響なし。
-- AmdScoreView の経時グラフは 5 axis 全部表示する。

ALTER TABLE project_xrl_log
  ADD COLUMN IF NOT EXISTS grl REAL,
  ADD COLUMN IF NOT EXISTS srl REAL;

COMMENT ON COLUMN project_xrl_log.grl IS 'Governance Readiness Level (内閣府 SIP 9 段階). NULL = 未観測';
COMMENT ON COLUMN project_xrl_log.srl IS 'Social Readiness Level (内閣府 SIP 9 段階). NULL = 未観測';
