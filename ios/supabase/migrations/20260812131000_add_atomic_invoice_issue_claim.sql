-- freee請求書の並行二重発行をDBで防ぐ原子的claim。
-- claim後に外部APIの成否が不明になった場合は自動解放せず、freee照合後の手動復旧を必須にする。

ALTER TABLE public.billing_cycles
  ADD COLUMN IF NOT EXISTS invoice_issue_claim_id uuid,
  ADD COLUMN IF NOT EXISTS invoice_issue_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_issue_claimed_by text;

CREATE OR REPLACE FUNCTION public.claim_invoice_issue(
  p_project_id text,
  p_ym text,
  p_claim_id uuid,
  p_claimed_by text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle public.billing_cycles%ROWTYPE;
  v_report_required boolean := false;
  v_pending_count integer := 0;
BEGIN
  SELECT bc.*
    INTO v_cycle
    FROM public.billing_cycles bc
    WHERE bc.project_id = p_project_id
      AND bc.ym = p_ym
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cycle_missing', 'message', '請求対象月の月次台帳がない');
  END IF;

  IF v_cycle.invoice_issued_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_issued', 'message', 'この月はすでに発行済み');
  END IF;

  IF v_cycle.invoice_issue_claim_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'issue_in_progress', 'message', 'この月は別の発行処理が進行中。freeeを照合してね');
  END IF;

  SELECT coalesce(p.monthly_report_required, false)
    INTO v_report_required
    FROM public.projects p
    WHERE p.project_id = p_project_id;

  IF v_report_required AND v_cycle.report_fixed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_unfixed', 'message', '契約上必要な月報が未確定');
  END IF;

  SELECT count(*)::integer
    INTO v_pending_count
    FROM public.reimbursements r
    WHERE r.project_id = p_project_id
      AND r.status IN ('submitted', 'pmApproved', 'pmapproved')
      AND (
        (r.billed_ym ~ '^\d{6}$' AND r.billed_ym = p_ym)
        OR
        ((r.billed_ym IS NULL OR r.billed_ym !~ '^\d{6}$') AND to_char(r.date::date, 'YYYYMM') = p_ym)
      );

  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'reimbursement_pending',
      'message', format('未承認の立替が%s件ある', v_pending_count),
      'pending_count', v_pending_count
    );
  END IF;

  UPDATE public.billing_cycles
    SET invoice_issue_claim_id = p_claim_id,
        invoice_issue_claimed_at = now(),
        invoice_issue_claimed_by = lower(p_claimed_by)
    WHERE project_id = p_project_id
      AND ym = p_ym
      AND invoice_issued_at IS NULL
      AND invoice_issue_claim_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'claim_conflict', 'message', '発行状態が先に変わった。再読み込みしてね');
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'claimed', 'claim_id', p_claim_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_invoice_issue(text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_invoice_issue(text, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.claim_invoice_issue(text, text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invoice_issue(text, text, uuid, text) TO service_role;

COMMENT ON FUNCTION public.claim_invoice_issue(text, text, uuid, text) IS
  'Atomically validates invoice blockers and claims one billing cycle before calling freee.';
