-- #13/#14 admin members login recency:
-- Keep the OS login timestamp on members so admin.members can show and sort
-- by recent actual app access.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_members_last_login_at
  ON public.members(last_login_at DESC NULLS LAST);

COMMENT ON COLUMN public.members.last_login_at IS
  'Last successful AMD OS login timestamp. Updated after required Google Calendar access is verified.';
