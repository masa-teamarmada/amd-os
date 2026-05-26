-- 092: amd_management_score_snapshots.summary
-- 経営状況の月次総括 (1-3 行の自然文)。calculate.ts が rule-based で生成し、
-- /management-score ヘッダ帯に「今月の結論」として表示する。
-- 設計: pwa/design/management_score.md L341 (snapshot に summary を持つ案を実装に反映)
ALTER TABLE amd_management_score_snapshots
  ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE amd_management_score_snapshots
  ADD COLUMN IF NOT EXISTS finance_cap_applied TEXT;
