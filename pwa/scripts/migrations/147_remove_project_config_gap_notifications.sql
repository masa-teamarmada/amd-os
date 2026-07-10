-- 抽出設定の不足は採否通知ではない。dashboard の「抽出状況」で確認・修正する。
BEGIN;

DELETE FROM l2_notifications
WHERE l2_kind = 'project_config_gap';

COMMIT;
