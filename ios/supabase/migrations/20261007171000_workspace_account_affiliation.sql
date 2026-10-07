-- Account identity fields are independent from project grants and login status.
-- Existing accounts keep an unknown affiliation until an administrator supplies it.
BEGIN;
ALTER TABLE public.workspace_user_accounts
  ADD COLUMN IF NOT EXISTS affiliation text
  CHECK (affiliation IS NULL OR char_length(affiliation) <= 160);
COMMENT ON COLUMN public.workspace_user_accounts.affiliation IS
  'Administrator-provided affiliation. Independent of display_name and email; never an access grant.';
COMMIT;
