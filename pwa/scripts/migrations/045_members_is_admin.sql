-- 045_members_is_admin.sql
--
-- members に is_admin BOOLEAN を追加し、まさだけを TRUE に初期化する。
-- 用途: 通知タブ + Admin タブ + 月次ルーティン操作の表示/権限制御。
-- 既存 members.role はほぼ NULL なので、boolean 列を別途持つ方が判定が明確。

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE members SET is_admin = TRUE WHERE code_name = 'まさ';

CREATE INDEX IF NOT EXISTS members_is_admin_idx ON members(is_admin) WHERE is_admin = TRUE;

COMMENT ON COLUMN members.is_admin IS
  'AMD OS の管理権限 (= 通知ベル、Admin タブ、月次ルーティン操作等の許可)。まさ (= 経営者) のみ TRUE。';
