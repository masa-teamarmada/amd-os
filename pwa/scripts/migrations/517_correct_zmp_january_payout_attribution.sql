-- 2026-10-27 まさ承認。2026年1月稼働分・2/27合算振込のPJ帰属だけを訂正する。
-- 原本: 収支「2026年_PayPay」82行・85行。
-- https://docs.google.com/spreadsheets/d/1Q8cEnutfJzgdEXKIRDb4wUGAe6ON1MMiiz3irCrj1YA
-- 振込総額、通知書、銀行出金、保護済み報酬計算cache、pt、stock/carryは変更しない。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('zmp-january-payout-attribution-20261027'));
DO $$
DECLARE item record; before_rows jsonb; before_total numeric; after_total numeric;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('ID004'::text,'p23'::text,141000::numeric,55000::numeric,86000::numeric,155100::numeric,85),
    ('ID008'::text,'p09'::text,59000::numeric,5000::numeric,54000::numeric,64900::numeric,82)
  ) AS v(member_id,other_project_id,original_yen,zmp_yen,other_yen,bank_gross_yen,sheet_row)
  LOOP
    PERFORM 1 FROM public.monthly_reward_payout
      WHERE ym='202601' AND member_id=item.member_id
        AND project_id IN ('p19',item.other_project_id) FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.monthly_reward_payout
      WHERE project_id='p19' AND ym='202601' AND member_id=item.member_id
        AND total_pay IN (item.original_yen,item.zmp_yen)) THEN
      RAISE EXCEPTION 'Unexpected ZMP source amount for %',item.member_id;
    END IF;
    IF EXISTS (SELECT 1 FROM public.monthly_reward_payout
      WHERE project_id=item.other_project_id AND ym='202601' AND member_id=item.member_id
        AND total_pay<>item.other_yen) THEN
      RAISE EXCEPTION 'Destination already has a different amount for %',item.member_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cash_ledger_entries
      WHERE entry_date='2026-02-27' AND source_row=item.sheet_row
        AND withdrawal=item.bank_gross_yen) THEN
      RAISE EXCEPTION 'Bank/source ledger evidence changed for %',item.member_id;
    END IF;
    SELECT jsonb_agg(to_jsonb(p)),sum(total_pay) INTO before_rows,before_total
      FROM public.monthly_reward_payout p WHERE ym='202601' AND member_id=item.member_id
      AND project_id IN ('p19',item.other_project_id);
    IF before_total<>item.original_yen OR round(before_total*1.1)<>item.bank_gross_yen THEN
      RAISE EXCEPTION 'Combined transfer is not conserved before repair for %',item.member_id;
    END IF;
    INSERT INTO public.legacy_reward_payout_amount_override_events
      (event_key,project_id,source_ym,member_id,action,amount_yen,reason,authorized_by,metadata_json)
    SELECT 'pj-attribution-20261027-'||item.member_id||'-'||p.project_id,
      p.project_id,'202601',item.member_id,'set',p.amount_yen,
      '2026年2月27日の合算振込を収支原本のPJ別内訳に訂正。振込総額と旧制度の合意額は維持する。',
      'masa',jsonb_build_object('operation','project_attribution_correction','before_rows',before_rows,
        'sheet_row',item.sheet_row,'paid_on','2026-02-27','combined_tax_exclusive_yen',item.original_yen,
        'bank_tax_inclusive_yen',item.bank_gross_yen,'source','収支/2026年_PayPay',
        'scope','payout_snapshot_only')
    FROM (VALUES ('p19',item.zmp_yen),(item.other_project_id,item.other_yen)) p(project_id,amount_yen)
    ON CONFLICT(event_key) DO NOTHING;
    UPDATE public.monthly_reward_payout SET total_pay=item.zmp_yen,base_pay=item.zmp_yen
      WHERE project_id='p19' AND ym='202601' AND member_id=item.member_id
        AND (total_pay<>item.zmp_yen OR base_pay<>item.zmp_yen);
    INSERT INTO public.monthly_reward_payout(project_id,ym,member_id,earned_pt,base_pay,bonus_pt,total_pay)
      VALUES(item.other_project_id,'202601',item.member_id,0,item.other_yen,0,item.other_yen)
      ON CONFLICT(project_id,ym,member_id) DO NOTHING;
    SELECT sum(total_pay) INTO after_total FROM public.monthly_reward_payout
      WHERE ym='202601' AND member_id=item.member_id AND project_id IN ('p19',item.other_project_id);
    IF after_total<>before_total THEN RAISE EXCEPTION 'Combined transfer changed for %',item.member_id; END IF;
    INSERT INTO public.billing_log(project_id,ym,action,actor,detail)
    SELECT 'p19','202601','payout_project_attribution_corrected','masa',
      jsonb_build_object('event_key','pj-attribution-20261027-'||item.member_id,
        'member_id',item.member_id,'before_rows',before_rows,'zmp_yen',item.zmp_yen,
        'destination_project_id',item.other_project_id,'destination_yen',item.other_yen,
        'combined_transfer_preserved',true,'sheet_row',item.sheet_row)
    WHERE NOT EXISTS (SELECT 1 FROM public.billing_log
      WHERE action='payout_project_attribution_corrected'
        AND detail->>'event_key'='pj-attribution-20261027-'||item.member_id);
  END LOOP;
END $$;
COMMIT;
