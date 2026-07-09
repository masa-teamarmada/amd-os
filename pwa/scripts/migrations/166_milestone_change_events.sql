-- 166_milestone_change_events.sql
--
-- /admin/ms-overview でMS設計を保存した事実を、メンバー向け cockpit でも確認できる
-- 監査ログとして残す。契約書上の記録責任に使うため、契約本文や raw は置かず、
-- MS設計・担当share・報酬差額サマリだけを構造化して保持する。

CREATE TABLE IF NOT EXISTS public.milestone_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  plan_cycle_id text NOT NULL REFERENCES public.value_plan_cycles(plan_cycle_id) ON DELETE CASCADE,
  revision_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'admin_ms_overview',
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by_email text NULL,
  reward_preview_status text NOT NULL DEFAULT 'not_checked',
  changed_milestone_count int4 NOT NULL DEFAULT 0 CHECK (changed_milestone_count >= 0),
  added_milestone_count int4 NOT NULL DEFAULT 0 CHECK (added_milestone_count >= 0),
  removed_milestone_count int4 NOT NULL DEFAULT 0 CHECK (removed_milestone_count >= 0),
  updated_milestone_count int4 NOT NULL DEFAULT 0 CHECK (updated_milestone_count >= 0),
  protected_cycle_count int4 NOT NULL DEFAULT 0 CHECK (protected_cycle_count >= 0),
  offset_count int4 NOT NULL DEFAULT 0 CHECK (offset_count >= 0),
  positive_offset_yen int4 NOT NULL DEFAULT 0 CHECK (positive_offset_yen >= 0),
  negative_offset_yen int4 NOT NULL DEFAULT 0 CHECK (negative_offset_yen <= 0),
  before_milestones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  after_milestones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  reward_preview_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT milestone_change_events_source_check
    CHECK (source IN ('admin_ms_overview','migration','manual')),
  CONSTRAINT milestone_change_events_reward_status_check
    CHECK (reward_preview_status IN ('safe','warning','blocked','not_checked'))
);

COMMENT ON TABLE public.milestone_change_events IS
  'MS設計保存時の変更履歴。cockpit の折りたたみ履歴に出すため、MS差分と報酬差額サマリだけを保持する。';
COMMENT ON COLUMN public.milestone_change_events.revision_id IS
  'reward_member_liability_offsets が発生する場合は同じ revision_id を使い、MS差分と報酬差額を対応づける。';
COMMENT ON COLUMN public.milestone_change_events.change_items_json IS
  '追加・無効化・更新されたMSの差分。契約本文や raw は含めない。';
COMMENT ON COLUMN public.milestone_change_events.reward_preview_json IS
  '保存前支払検算の公開サマリ。offsetRows は含めない。';

CREATE INDEX IF NOT EXISTS idx_milestone_change_events_project_changed
  ON public.milestone_change_events(project_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_change_events_plan_changed
  ON public.milestone_change_events(plan_cycle_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_milestone_change_events_revision
  ON public.milestone_change_events(revision_id, changed_at DESC);

ALTER TABLE public.milestone_change_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.milestone_change_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.milestone_change_events TO service_role;

DROP POLICY IF EXISTS milestone_change_events_public_select ON public.milestone_change_events;
CREATE POLICY milestone_change_events_public_select
  ON public.milestone_change_events
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS milestone_change_events_service_role_all ON public.milestone_change_events;
CREATE POLICY milestone_change_events_service_role_all
  ON public.milestone_change_events
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
