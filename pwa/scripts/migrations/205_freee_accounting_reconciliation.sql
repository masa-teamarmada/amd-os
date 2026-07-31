-- 205_freee_accounting_reconciliation.sql
--
-- 週次freee会計照合（会計照合レール）の正本テーブル。
-- AMD OSがSOT、freeeは実行先兼一次証跡、きよの収支スプシはread-only参考（正本を上書きしない）。
-- 最初の4回成功run（cronトリガのみカウント）は完全review-only。5回目以降は
-- 「全役員の役員報酬消込」と「同額・同日/許容日差・双方口座特定済みの内部振替」の
-- 完全一致allowlist判定まで行うが、安全な公式endpointが未検証の間はfreee書込みを常にblockedにする。

CREATE TABLE IF NOT EXISTS public.freee_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key TEXT NOT NULL UNIQUE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'cron'
    CHECK (triggered_by IN ('cron', 'admin_manual')),
  dry_run BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  phase TEXT NOT NULL DEFAULT 'review_only'
    CHECK (phase IN ('review_only', 'auto_apply_allowlist')),
  run_sequence INTEGER,
  finding_count INTEGER NOT NULL DEFAULT 0,
  auto_applied_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS freee_reconciliation_runs_week_idx
  ON public.freee_reconciliation_runs(week_start_date DESC);
CREATE INDEX IF NOT EXISTS freee_reconciliation_runs_sequence_idx
  ON public.freee_reconciliation_runs(triggered_by, status, started_at)
  WHERE triggered_by = 'cron' AND status = 'completed';

CREATE TABLE IF NOT EXISTS public.freee_reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.freee_reconciliation_runs(id) ON DELETE CASCADE,
  -- finding_keyは検出対象entityの安定ハッシュ（run非依存）。週次runごとに新しいoccurrence行を
  -- insertするため単体UNIQUEにはしない（run_id, finding_key）で一意にし、週次監査証跡を残す。
  -- action側のidempotencyはこのfinding_key(+action_type)を安定キーとして使い続ける。
  finding_key TEXT NOT NULL,
  finding_type TEXT NOT NULL
    CHECK (finding_type IN (
      'balance_delta',
      'sync_stale',
      'unprocessed_entry',
      'anomalous_journal',
      'officer_compensation_unreconciled',
      'internal_transfer_candidate'
    )),
  severity TEXT NOT NULL DEFAULT 'warn'
    CHECK (severity IN ('info', 'warn', 'blocker')),
  walletable_type TEXT,
  walletable_id TEXT,
  walletable_name TEXT,
  freee_entity_type TEXT,
  freee_entity_id TEXT,
  member_id TEXT REFERENCES public.members(member_id) ON DELETE SET NULL,
  amount_yen BIGINT,
  delta_yen BIGINT,
  occurred_on DATE,
  title TEXT NOT NULL,
  summary_ja TEXT NOT NULL,
  decision_reason_ja TEXT NOT NULL,
  match_confidence TEXT NOT NULL DEFAULT 'ambiguous'
    CHECK (match_confidence IN ('exact', 'high', 'ambiguous')),
  eligible_for_auto_apply BOOLEAN NOT NULL DEFAULT false,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'auto_applied', 'blocked')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 初期版を先に適用していても、finding_key単体UNIQUEを確実に外して週次occurrenceを保持する。
ALTER TABLE public.freee_reconciliation_findings
  DROP CONSTRAINT IF EXISTS freee_reconciliation_findings_finding_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS freee_reconciliation_findings_run_key_uniq
  ON public.freee_reconciliation_findings(run_id, finding_key);

CREATE INDEX IF NOT EXISTS freee_reconciliation_findings_run_idx
  ON public.freee_reconciliation_findings(run_id);
CREATE INDEX IF NOT EXISTS freee_reconciliation_findings_review_idx
  ON public.freee_reconciliation_findings(review_status, severity, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS freee_reconciliation_findings_type_idx
  ON public.freee_reconciliation_findings(finding_type, review_status);
CREATE INDEX IF NOT EXISTS freee_reconciliation_findings_key_created_idx
  ON public.freee_reconciliation_findings(finding_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.freee_reconciliation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.freee_reconciliation_findings(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.freee_reconciliation_runs(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL
    CHECK (action_type IN ('officer_compensation_reconcile', 'internal_transfer_reconcile')),
  idempotency_key TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'dry_run'
    CHECK (mode IN ('dry_run', 'executed', 'blocked')),
  freee_write_status TEXT NOT NULL DEFAULT 'not_attempted'
    CHECK (freee_write_status IN ('not_attempted', 'pending', 'succeeded', 'failed')),
  freee_wallet_txn_id TEXT,
  freee_account_item_id TEXT,
  before_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state_json JSONB,
  blocked_reason TEXT,
  error_message TEXT,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS freee_reconciliation_actions_finding_idx
  ON public.freee_reconciliation_actions(finding_id);
CREATE INDEX IF NOT EXISTS freee_reconciliation_actions_run_idx
  ON public.freee_reconciliation_actions(run_id);

ALTER TABLE public.freee_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freee_reconciliation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freee_reconciliation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS freee_reconciliation_runs_admin_all ON public.freee_reconciliation_runs;
CREATE POLICY freee_reconciliation_runs_admin_all
  ON public.freee_reconciliation_runs
  FOR ALL TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS freee_reconciliation_runs_service_all ON public.freee_reconciliation_runs;
CREATE POLICY freee_reconciliation_runs_service_all
  ON public.freee_reconciliation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS freee_reconciliation_findings_admin_all ON public.freee_reconciliation_findings;
CREATE POLICY freee_reconciliation_findings_admin_all
  ON public.freee_reconciliation_findings
  FOR ALL TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS freee_reconciliation_findings_service_all ON public.freee_reconciliation_findings;
CREATE POLICY freee_reconciliation_findings_service_all
  ON public.freee_reconciliation_findings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS freee_reconciliation_actions_admin_all ON public.freee_reconciliation_actions;
CREATE POLICY freee_reconciliation_actions_admin_all
  ON public.freee_reconciliation_actions
  FOR ALL TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());
DROP POLICY IF EXISTS freee_reconciliation_actions_service_all ON public.freee_reconciliation_actions;
CREATE POLICY freee_reconciliation_actions_service_all
  ON public.freee_reconciliation_actions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
