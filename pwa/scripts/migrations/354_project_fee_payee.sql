-- PJの月額報酬の「受け取り先」を持たせる。
--
-- 【なぜ要るか】2026-08-30 まさ確定。
-- CLG (p24) と LST (p07) は月10万円が **まさ個人へ直接** 振り込まれるアドバイザー契約で、
-- 会社の請求ではない。そのため billing_cycles も value_plan_cycles も1行も無く、
-- projects.fee_amount も空だった。PJ別 利益構造ダッシュボードはこの2件を
-- 「収入ゼロでまさが時間だけ投じているPJ」と表示してしまう。
-- 金額を画面のコードへ直書きせず、OS側の正本に入れてから読む。
--
-- fee_payee:
--   'company'        = AMDがクライアントへ請求する (既定。既存の全PJはこちら)
--   'masa_personal'  = まさ個人へ直接支払われる。会社の売上・原資には入らない
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fee_payee TEXT NOT NULL DEFAULT 'company';

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_fee_payee_check;
ALTER TABLE projects
  ADD CONSTRAINT projects_fee_payee_check
  CHECK (fee_payee IN ('company', 'masa_personal'));

COMMENT ON COLUMN projects.fee_payee IS
  '月額報酬の受け取り先。company=AMDの請求 / masa_personal=まさ個人への直接支払 (会社の売上ではない)';

-- LST (p07) / CLG (p24): 月10万円がまさ個人へ。
-- 支払期間は projects.start_ym を起点として扱う (LST=202304〜, CLG=202604〜)。
-- まさ未確認の推定なので、画面側は必ず対象期間を実月数で表示する。
UPDATE projects
   SET fee_type   = 'monthly_fixed',
       fee_amount = 100000,
       fee_payee  = 'masa_personal'
 WHERE project_id IN ('p07', 'p24');
