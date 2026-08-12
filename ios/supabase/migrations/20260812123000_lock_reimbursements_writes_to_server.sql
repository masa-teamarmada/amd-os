-- reimbursements の承認書込みは認証済み server routes / Edge Functions に限定する。
-- 旧 authenticated_all はブラウザから任意の status / approval metadata を更新できたため廃止。
-- 既存iOS互換として、本人による submitted の申請・編集・削除だけはRLSで許可する。

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all" ON public.reimbursements;
DROP POLICY IF EXISTS "authenticated_read" ON public.reimbursements;
DROP POLICY IF EXISTS "authenticated_insert_own_submitted" ON public.reimbursements;
DROP POLICY IF EXISTS "authenticated_update_own_submitted" ON public.reimbursements;
DROP POLICY IF EXISTS "authenticated_delete_own_submitted" ON public.reimbursements;

CREATE POLICY "authenticated_read" ON public.reimbursements
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_own_submitted" ON public.reimbursements
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(created_by) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'submitted'
    AND pm_approved_by IS NULL
    AND pm_approved_at IS NULL
    AND admin_approved_by IS NULL
    AND admin_approved_at IS NULL
  );

CREATE POLICY "authenticated_update_own_submitted" ON public.reimbursements
  FOR UPDATE TO authenticated
  USING (
    lower(created_by) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'submitted'
  )
  WITH CHECK (
    lower(created_by) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'submitted'
    AND pm_approved_by IS NULL
    AND pm_approved_at IS NULL
    AND admin_approved_by IS NULL
    AND admin_approved_at IS NULL
  );

CREATE POLICY "authenticated_delete_own_submitted" ON public.reimbursements
  FOR DELETE TO authenticated
  USING (
    lower(created_by) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'submitted'
  );

COMMENT ON TABLE public.reimbursements IS
  'Authenticated clients may read and may mutate only their own submitted application. Approval transitions go through authenticated server routes or service-role Edge Functions.';
