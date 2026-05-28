-- 107_members_invoice_registration_number.sql
-- 支払通知書PDFに表示するメンバー側のインボイス登録番号。

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS invoice_registration_number TEXT;

COMMENT ON COLUMN public.members.invoice_registration_number IS
  '支払通知書PDFに表示するインボイス登録番号。admin/members で編集し、未登録の場合はPDF上で未登録と表示する。';

CREATE INDEX IF NOT EXISTS idx_members_invoice_registration_number
  ON public.members(invoice_registration_number)
  WHERE invoice_registration_number IS NOT NULL;

COMMIT;
