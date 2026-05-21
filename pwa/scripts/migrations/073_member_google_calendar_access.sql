-- 073_member_google_calendar_access.sql
-- OS login requires Google Calendar access. Keep a non-secret status on members
-- for admin visibility, and store provider tokens separately for server-side use.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS google_calendar_status text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS google_calendar_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_calendar_error text;

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_google_calendar_status_check;

ALTER TABLE public.members
  ADD CONSTRAINT members_google_calendar_status_check
  CHECK (google_calendar_status IN ('missing', 'connected', 'error'));

CREATE INDEX IF NOT EXISTS idx_members_google_calendar_status
  ON public.members(google_calendar_status, status);

CREATE TABLE IF NOT EXISTS public.member_google_oauth_tokens (
  member_id text PRIMARY KEY REFERENCES public.members(member_id) ON DELETE CASCADE,
  email text NOT NULL,
  provider text NOT NULL DEFAULT 'google',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_google_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.member_google_oauth_tokens;
CREATE POLICY service_role_all ON public.member_google_oauth_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON COLUMN public.members.google_calendar_status IS
  'Calendar access status from Google OAuth login. connected is required for AMD OS app access.';

COMMENT ON TABLE public.member_google_oauth_tokens IS
  'Google OAuth provider tokens captured at login for server-side Gmail/Calendar ingestion. Service role only.';
