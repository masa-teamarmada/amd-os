-- 122_management_monthly_signal_evaluations.sql
--
-- L2 ⑯ Management Monthly Signal Evaluation.
-- /management-score の月次試算表下に出す経営評価文を、数字再掲ではなく
-- 状態アイコン・1行評価・判断理由・次に見ることとして保存する。
--
-- 注意: このmigrationは未適用設計/実装ファイル。適用は司令塔判断後に行う。

CREATE TABLE IF NOT EXISTS public.amd_management_monthly_signal_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ym TEXT NOT NULL CHECK (ym ~ '^[0-9]{6}$'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  status TEXT NOT NULL CHECK (
    status IN ('healthy', 'mostly_good', 'watch', 'intervention_needed', 'critical')
  ),
  icon TEXT NOT NULL,
  label TEXT NOT NULL CHECK (label IN ('良好', '概ね良い', '注意', '要介入', '危険')),
  headline TEXT NOT NULL,
  reason_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_watch_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_refs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT true,
  superseded_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'management_monthly_signal_v1',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS amd_management_monthly_signal_evaluations_ym_version_uniq
  ON public.amd_management_monthly_signal_evaluations(ym, version);

CREATE UNIQUE INDEX IF NOT EXISTS amd_management_monthly_signal_evaluations_current_uniq
  ON public.amd_management_monthly_signal_evaluations(ym)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS amd_management_monthly_signal_evaluations_ym_idx
  ON public.amd_management_monthly_signal_evaluations(ym DESC, version DESC);

ALTER TABLE public.amd_management_monthly_signal_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amms_eval_select_admin ON public.amd_management_monthly_signal_evaluations;
CREATE POLICY amms_eval_select_admin
  ON public.amd_management_monthly_signal_evaluations
  FOR SELECT
  TO authenticated
  USING (public.amd_os_current_user_is_admin());

DROP POLICY IF EXISTS amms_eval_insert_admin ON public.amd_management_monthly_signal_evaluations;
CREATE POLICY amms_eval_insert_admin
  ON public.amd_management_monthly_signal_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.amd_os_current_user_is_admin());

DROP POLICY IF EXISTS amms_eval_update_admin ON public.amd_management_monthly_signal_evaluations;
CREATE POLICY amms_eval_update_admin
  ON public.amd_management_monthly_signal_evaluations
  FOR UPDATE
  TO authenticated
  USING (public.amd_os_current_user_is_admin())
  WITH CHECK (public.amd_os_current_user_is_admin());

DROP POLICY IF EXISTS amms_eval_service_role_all ON public.amd_management_monthly_signal_evaluations;
CREATE POLICY amms_eval_service_role_all
  ON public.amd_management_monthly_signal_evaluations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.amd_management_monthly_signal_evaluations FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.amd_management_monthly_signal_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amd_management_monthly_signal_evaluations TO service_role;

COMMENT ON TABLE public.amd_management_monthly_signal_evaluations IS
  'L2 ⑯ Management Monthly Signal Evaluation。月末時点の会社経営状態を、数字再掲ではなく評価文・状態アイコン・判断理由・次に見ることとして保存する。';
COMMENT ON COLUMN public.amd_management_monthly_signal_evaluations.headline IS
  '1行の経営評価。予実表の数字を再掲せず、良い/悪い/次に見ることが分かる文章にする。';
COMMENT ON COLUMN public.amd_management_monthly_signal_evaluations.reason_items_json IS
  '2〜3個の判断理由。axis / text / source_refs を持つ。raw本文は保存しない。';
COMMENT ON COLUMN public.amd_management_monthly_signal_evaluations.source_refs_json IS
  '参照したtable / row id / hash / short label。メール全文・議事録全文・Slack全文は保存しない。';
