-- 081_payment_due_rule_work_month_basis.sql
--
-- 支払条件を「請求書発行月基準」ではなく「稼働月基準」に統一する。
-- 例: 5月稼働分を6月に請求し、6月末に支払われる場合は next_month_eom (= 翌月末)。
-- 旧 issue_month_* は互換入力としてだけ残し、DBの正本値からは消す。

UPDATE projects
SET payment_due_rule = 'next_month_eom',
    updated_at = now()
WHERE payment_due_rule = 'issue_month_eom';

UPDATE projects
SET payment_due_rule = 'next_month_25',
    updated_at = now()
WHERE payment_due_rule IN ('issue_month_25', 'issue_month_25th');

COMMENT ON COLUMN projects.payment_due_rule IS
  'PJ支払条件。稼働月基準で current_month_eom/current_month_25/next_month_eom/next_month_25/second_month_eom/second_month_25 を保存する。旧 issue_month_* は互換入力のみ。';
