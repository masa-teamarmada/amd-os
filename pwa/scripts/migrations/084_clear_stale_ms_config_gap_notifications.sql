-- 084_clear_stale_ms_config_gap_notifications.sql
-- MSがない対象月は月次ノートへ保存する運用に変えたため、
-- 旧ロジックが作った「MS設定して」通知を消す。

BEGIN;

DELETE FROM l2_notifications
WHERE l2_kind = 'project_config_gap'
  AND (
    metadata_json->>'gap_kind' IN ('missing_ms_plan', 'missing_ms_items')
    OR scope_key LIKE '%:config:missing_ms_plan'
    OR scope_key LIKE '%:config:missing_ms_items'
  );

COMMIT;
