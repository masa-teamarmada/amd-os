-- 272_ehm_workspace_branding.sql
--
-- EHM OS ブランド表示 (EHM_OS_DESIGN_DRAFT_20260813.md 論点9-A、まさ承認 2026-08-13)。
-- 契約書に載る商品名「EHM OS」と画面の名乗りを一致させるため、
-- ehime ワークスペースの表示名を変更する。URL slug・認可・中身は変更しない。
--
-- 注意: migration 212 §10 を再実行すると name は '愛媛大学' に戻る (ON CONFLICT で name を更新するため)。
-- 212 を再実行した場合はこの migration を再適用する。

UPDATE institution_workspaces
SET name = 'EHM OS（愛媛大学）', updated_at = now()
WHERE slug = 'ehime'
  AND name IS DISTINCT FROM 'EHM OS（愛媛大学）';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM institution_workspaces WHERE slug = 'ehime' AND name = 'EHM OS（愛媛大学）'
  ) THEN
    RAISE EXCEPTION 'ehime ワークスペースの表示名変更が反映されていない';
  END IF;
END $$;
