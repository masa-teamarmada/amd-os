-- 099_milestone_monthly_contribution_allocations.sql
-- MS設計時の予定担当比率とは別に、当月の活動ログから自動算出した実績配分を保持する。
-- 報酬計算は confirmed / pm_override / auto_applied の actual_share を優先し、
-- needs_review / rejected / 行なしの場合は milestone_responsibility.share に fallback する。

CREATE TABLE IF NOT EXISTS public.milestone_monthly_contribution_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  milestone_id text NOT NULL,
  ym text NOT NULL,
  member_id text NOT NULL,
  planned_share numeric NOT NULL DEFAULT 0 CHECK (planned_share >= 0 AND planned_share <= 1),
  actual_share numeric NOT NULL DEFAULT 0 CHECK (actual_share >= 0 AND actual_share <= 1),
  confidence numeric NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL DEFAULT 'member_activities',
  status text NOT NULL DEFAULT 'auto_applied' CHECK (status = ANY (ARRAY[
    'auto_applied'::text,
    'needs_review'::text,
    'confirmed'::text,
    'pm_override'::text,
    'rejected'::text
  ])),
  reason text,
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  auto_generated_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (milestone_id, ym, member_id)
);

CREATE INDEX IF NOT EXISTS idx_mmca_project_ym
  ON public.milestone_monthly_contribution_allocations (project_id, ym);

CREATE INDEX IF NOT EXISTS idx_mmca_milestone_ym
  ON public.milestone_monthly_contribution_allocations (milestone_id, ym);

CREATE INDEX IF NOT EXISTS idx_mmca_status
  ON public.milestone_monthly_contribution_allocations (status);

COMMENT ON TABLE public.milestone_monthly_contribution_allocations IS
  'MSごとの予定担当比率と別に、月次活動ログから算出・確認した実績配分を保持する。reward_summary_json は confirmed / pm_override / auto_applied を優先し、それ以外は milestone_responsibility.share にfallbackする。';

COMMENT ON COLUMN public.milestone_monthly_contribution_allocations.planned_share IS
  'MS設計時の予定担当比率。milestone_responsibility.share からコピーする。';

COMMENT ON COLUMN public.milestone_monthly_contribution_allocations.actual_share IS
  '当月実績配分。member_activities 由来の自動算出またはPM/admin確認値。';

COMMENT ON COLUMN public.milestone_monthly_contribution_allocations.status IS
  'auto_applied=報酬計算へ自動適用、needs_review=根拠が薄いため予定配分にfallback、confirmed/pm_override=人間確認済、rejected=不採用。';
