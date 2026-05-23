-- 083_budget_confirmed_status_unification.sql
-- 配賦確定という旧ステータス名を使わず、予算確定へ統一する。

BEGIN;

UPDATE billing_cycles
SET
  status = 'budget_confirmed',
  updated_at = now()
WHERE status = 'allocation_confirmed';

COMMIT;
