-- 159_funding_amd_contribution_amounts.sql
--
-- 目的:
--   Dashboard の「累計資金調達額 / 累計助成金額」を、登録済み総額ではなく
--   AMD の貢献として説明できる金額だけで集計できるようにする。
--
-- 背景:
--   会社の全ラウンド・全助成金が AMD の貢献によるものではない。
--   非貢献 / 未判定の行も台帳には残し、累計値には `amd_contributed_yen`
--   または full contribution として明示された分だけを入れる。
--
-- 適用:
--   cd pwa && python3 -X utf8 scripts/apply_ddl.py scripts/migrations/159_funding_amd_contribution_amounts.sql
--   適用後 python3 -X utf8 scripts/dump_schema.py で db_schema.md 再生成。

ALTER TABLE public.project_valuation_rounds
  ADD COLUMN IF NOT EXISTS amd_contribution_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS amd_contributed_yen bigint,
  ADD COLUMN IF NOT EXISTS amd_contribution_note text;

ALTER TABLE public.project_grants
  ADD COLUMN IF NOT EXISTS amd_contribution_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS amd_contributed_yen bigint,
  ADD COLUMN IF NOT EXISTS amd_contribution_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_valuation_rounds_amd_contribution_status_chk'
  ) THEN
    ALTER TABLE public.project_valuation_rounds
      ADD CONSTRAINT project_valuation_rounds_amd_contribution_status_chk
      CHECK (amd_contribution_status IN ('full', 'partial', 'none', 'unreviewed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_valuation_rounds_amd_contributed_yen_chk'
  ) THEN
    ALTER TABLE public.project_valuation_rounds
      ADD CONSTRAINT project_valuation_rounds_amd_contributed_yen_chk
      CHECK (amd_contributed_yen IS NULL OR amd_contributed_yen >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_amd_contribution_status_chk'
  ) THEN
    ALTER TABLE public.project_grants
      ADD CONSTRAINT project_grants_amd_contribution_status_chk
      CHECK (amd_contribution_status IN ('full', 'partial', 'none', 'unreviewed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_amd_contributed_yen_chk'
  ) THEN
    ALTER TABLE public.project_grants
      ADD CONSTRAINT project_grants_amd_contributed_yen_chk
      CHECK (amd_contributed_yen IS NULL OR amd_contributed_yen >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_valuation_rounds_amd_contribution_idx
  ON public.project_valuation_rounds(project_id, amd_contribution_status);

CREATE INDEX IF NOT EXISTS project_grants_amd_contribution_idx
  ON public.project_grants(project_id, amd_contribution_status, status);

COMMENT ON COLUMN public.project_valuation_rounds.amd_contribution_status IS
  'AMD contribution status for dashboard totals: full / partial / none / unreviewed. Only full and partial contribute to AMD cumulative funding totals.';
COMMENT ON COLUMN public.project_valuation_rounds.amd_contributed_yen IS
  'Amount attributable to AMD contribution. Used when status is partial; optional for full, where raised_yen is used if this is null.';
COMMENT ON COLUMN public.project_valuation_rounds.amd_contribution_note IS
  'Short internal note explaining why the row is full, partial, none, or unreviewed for AMD contribution totals.';

COMMENT ON COLUMN public.project_grants.amd_contribution_status IS
  'AMD contribution status for dashboard totals: full / partial / none / unreviewed. Only secured full and partial rows contribute to AMD cumulative grant totals.';
COMMENT ON COLUMN public.project_grants.amd_contributed_yen IS
  'Amount attributable to AMD contribution. Used when status is partial; optional for full, where amount_yen is used if this is null.';
COMMENT ON COLUMN public.project_grants.amd_contribution_note IS
  'Short internal note explaining why the grant is full, partial, none, or unreviewed for AMD contribution totals.';
