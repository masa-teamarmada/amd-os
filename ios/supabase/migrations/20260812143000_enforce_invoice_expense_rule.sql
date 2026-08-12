-- 請求書へ立替を上乗せできるかを契約条件の正本で判定する。
-- SXはまさ確定条件として上乗せ不可。未抽出PJは立替がある月だけ発行を止める。

WITH sx_base AS (
  SELECT
    p.project_id,
    jsonb_set(
      jsonb_set(
        coalesce(p.contract_terms_json, '{}'::jsonb),
        '{expenseReimbursementAllowed}',
        'false'::jsonb,
        true
      ),
      '{expenseReimbursementNote}',
      to_jsonb('立替精算分はクライアント請求へ上乗せ不可'::text),
      true
    ) AS terms
  FROM public.projects p
  WHERE p.project_id = 'p21'
), sx_current AS (
  SELECT
    project_id,
    CASE
      WHEN jsonb_typeof(terms->'currentContracts') = 'array'
        AND jsonb_array_length(terms->'currentContracts') > 0
      THEN jsonb_set(
        terms,
        '{currentContracts,0,terms}',
        coalesce(terms #> '{currentContracts,0,terms}', '{}'::jsonb)
          || jsonb_build_object(
            'expenseReimbursementAllowed', false,
            'expenseReimbursementNote', '立替精算分はクライアント請求へ上乗せ不可'
          ),
        true
      )
      ELSE terms
    END AS terms
  FROM sx_base
)
UPDATE public.projects p
SET contract_terms_json = sx_current.terms
FROM sx_current
WHERE p.project_id = sx_current.project_id;

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
  v_expense_rule_text text;
  v_expense_allowed boolean := null;
  v_reimbursement_count integer := 0;
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

  SELECT
    coalesce(p.monthly_report_required, false),
    lower(coalesce(
      p.contract_terms_json #>> '{currentContracts,0,terms,expenseReimbursementAllowed}',
      p.contract_terms_json ->> 'expenseReimbursementAllowed',
      ''
    ))
    INTO v_report_required, v_expense_rule_text
    FROM public.projects p
    WHERE p.project_id = p_project_id;

  IF v_expense_rule_text IN ('true', 'あり', '可', 'yes') THEN
    v_expense_allowed := true;
  ELSIF v_expense_rule_text IN ('false', 'なし', '不可', 'no') THEN
    v_expense_allowed := false;
  END IF;

  IF v_report_required AND v_cycle.report_fixed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'report_unfixed', 'message', '契約上必要な月報が未確定');
  END IF;

  SELECT
    count(*) FILTER (WHERE r.status IN ('submitted', 'pmApproved', 'pmapproved', 'approved', 'paid'))::integer,
    count(*) FILTER (WHERE r.status IN ('submitted', 'pmApproved', 'pmapproved'))::integer
    INTO v_reimbursement_count, v_pending_count
    FROM public.reimbursements r
    WHERE r.project_id = p_project_id
      AND (
        (r.billed_ym ~ '^\d{6}$' AND r.billed_ym = p_ym)
        OR
        ((r.billed_ym IS NULL OR r.billed_ym !~ '^\d{6}$') AND to_char(r.date::date, 'YYYYMM') = p_ym)
      );

  IF v_reimbursement_count > 0 AND v_expense_allowed IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'reimbursement_rule_missing',
      'message', '立替を請求へ上乗せできるか契約条件から未抽出'
    );
  END IF;

  IF v_expense_allowed AND v_pending_count > 0 THEN
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
  'Atomically validates invoice blockers including the contractual reimbursement billing rule and claims one cycle.';
