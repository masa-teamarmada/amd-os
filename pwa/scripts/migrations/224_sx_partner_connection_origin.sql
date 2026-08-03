-- 224_sx_partner_connection_origin.sql
-- Keep the origin of each SX counterpart relationship separate from evidence
-- provenance and from the current interaction timeline.

BEGIN;

ALTER TABLE public.project_management_partners
  ADD COLUMN IF NOT EXISTS introducer_label text,
  ADD COLUMN IF NOT EXISTS connection_context text;

COMMENT ON COLUMN public.project_management_partners.introducer_label IS
  'Safe display name of the person or organization that introduced this counterpart. No address, phone number, email address, or URL.';
COMMENT ON COLUMN public.project_management_partners.connection_context IS
  'Short operational summary of why or through what event the relationship started. No raw message body, quote, or URL.';

-- Recreate the contact guards on re-apply so the URL rule can be tightened or
-- relaxed without leaving an older, conflicting CHECK in production.
ALTER TABLE public.project_management_partners
  DROP CONSTRAINT IF EXISTS pm_partners_introducer_contact_safe_224,
  DROP CONSTRAINT IF EXISTS pm_partners_connection_context_contact_safe_224;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partners_introducer_len_224'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT pm_partners_introducer_len_224
      CHECK (
        introducer_label IS NULL
        OR (length(trim(introducer_label)) BETWEEN 1 AND 120)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partners_connection_context_len_224'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT pm_partners_connection_context_len_224
      CHECK (
        connection_context IS NULL
        OR (length(trim(connection_context)) BETWEEN 1 AND 500)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partners_introducer_contact_safe_224'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT pm_partners_introducer_contact_safe_224
      CHECK (
        introducer_label IS NULL
        OR (
          position(E'\n' in introducer_label) = 0
          AND position(E'\r' in introducer_label) = 0
          AND introducer_label !~* '(https?://|www\.|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[[:alnum:]][[:alnum:]-]*(\.[[:alnum:]-]+)*\.[[:alpha:]]{2,}(:[0-9]{2,5})?(/[^[:space:]]*)?)'
          AND introducer_label !~ '(\+?81[-[:space:]()]*0?|0)[0-9]{1,4}[-[:space:]()]?[0-9]{1,4}[-[:space:]]?[0-9]{3,4}'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pm_partners_connection_context_contact_safe_224'
      AND conrelid = 'public.project_management_partners'::regclass
  ) THEN
    ALTER TABLE public.project_management_partners
      ADD CONSTRAINT pm_partners_connection_context_contact_safe_224
      CHECK (
        connection_context IS NULL
        OR (
          position(E'\n' in connection_context) = 0
          AND position(E'\r' in connection_context) = 0
          AND connection_context !~* '(https?://|www\.|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|[[:alnum:]][[:alnum:]-]*(\.[[:alnum:]-]+)*\.[[:alpha:]]{2,}(:[0-9]{2,5})?(/[^[:space:]]*)?)'
          AND connection_context !~ '(\+?81[-[:space:]()]*0?|0)[0-9]{1,4}[-[:space:]()]?[0-9]{1,4}[-[:space:]]?[0-9]{3,4}'
        )
      );
  END IF;
END
$$;

-- Only these three p21 origins are explicitly evidenced by migration 201.
-- Do not infer any other introducer from sender, owner, source_ref, or ball.
UPDATE public.project_management_partners
SET introducer_label = COALESCE(introducer_label, '伊予銀行'),
    connection_context = COALESCE(
      connection_context,
      CASE slug
        WHEN 'poc-contact-marutomo' THEN 'PoC相談の初回メール'
        WHEN 'poc-contact-okabe' THEN 'PoC相談と訪問日程の調整'
        WHEN 'poc-contact-yamaki' THEN 'PoC相談と訪問日程の調整'
      END
    ),
    agreed_scope = CASE
      WHEN slug = 'poc-contact-marutomo'
        AND agreed_scope = '伊予銀行紹介でPoC相談の初回メール送付を確認'
        THEN ''
      WHEN slug IN ('poc-contact-okabe', 'poc-contact-yamaki')
        AND agreed_scope = '伊予銀行紹介でPoC相談と訪問日程の調整を確認'
        THEN ''
      ELSE agreed_scope
    END
WHERE project_id = 'p21'
  AND slug IN (
    'poc-contact-marutomo',
    'poc-contact-okabe',
    'poc-contact-yamaki'
  )
  AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
