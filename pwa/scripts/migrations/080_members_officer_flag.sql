-- 080_members_officer_flag.sql
-- AMD役員フラグ。ONのメンバーは admin.payouts の支払対象から除外し、
-- その分はAMD運営費へ回る余剰資金として扱う。

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_officer BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.is_officer IS
  'AMD役員フラグ。true のメンバーは admin.payouts の報酬支払対象から除外し、除外額はAMD運営費原資として扱う。';

UPDATE public.members
SET is_officer = CASE WHEN code_name IN ('まさ', 'きよ') THEN true ELSE false END,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_members_is_officer
  ON public.members(is_officer, status);
