-- 065_reimbursement_receipts.sql
-- PWA reimbursements: receipt attachment metadata + private storage bucket.

ALTER TABLE public.reimbursements
  ADD COLUMN IF NOT EXISTS receipt_storage_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS receipt_file_names jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.reimbursements.receipt_storage_paths IS
  'Private Supabase Storage object paths for reimbursement receipt attachments.';
COMMENT ON COLUMN public.reimbursements.receipt_file_names IS
  'Original display names for reimbursement receipt attachments.';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reimbursement-receipts',
  'reimbursement-receipts',
  false,
  10485760,
  ARRAY['image/png','image/jpeg','image/webp','application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS reimburse_receipts_auth_select ON storage.objects;
CREATE POLICY reimburse_receipts_auth_select
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'reimbursement-receipts');

DROP POLICY IF EXISTS reimburse_receipts_auth_insert_own_folder ON storage.objects;
CREATE POLICY reimburse_receipts_auth_insert_own_folder
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS reimburse_receipts_auth_update_own_folder ON storage.objects;
CREATE POLICY reimburse_receipts_auth_update_own_folder
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS reimburse_receipts_auth_delete_own_folder ON storage.objects;
CREATE POLICY reimburse_receipts_auth_delete_own_folder
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reimbursement-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
