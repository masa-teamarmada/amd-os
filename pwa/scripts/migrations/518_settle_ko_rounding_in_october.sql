-- 2026-10-28 まさ指示: 100円の別振込を作らず、未発行のこうの端数を10月に精算。
-- 9月稼働 12,400円+未払80円、10月稼働 100円(80円+切上20円) を
-- 9月稼働 12,500円(10月振込)、10月稼働 0円へ。年間総額は維持する。
-- 通知書・保存済み支払・銀行記録・他メンバー・ポイント・社内割当は変更しない。
-- 後続月のcap繰越は現行の読取再計算結果と照合済み。
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtext('ko-rounding-timing-20261028'));
DO $$
DECLARE
  row_item record; entry record; old_cache jsonb; next_cache jsonb; ko jsonb;
  before_others jsonb; after_others jsonb; before_total numeric; after_total numeric;
  before_internal numeric; after_internal numeric;
  event_key text := 'ko-rounding-timing-20261028';
BEGIN
  IF EXISTS(SELECT 1 FROM public.billing_log WHERE action='payout_rounding_timing_corrected' AND detail->>'event_key'=event_key) THEN RETURN; END IF;
  PERFORM 1 FROM public.billing_cycles WHERE project_id='p19' AND ym BETWEEN '202609' AND '202612' FOR UPDATE;
  IF (SELECT count(*) FROM public.billing_cycles WHERE project_id='p19' AND ym BETWEEN '202609' AND '202612')<>4 THEN RAISE EXCEPTION 'Missing source month'; END IF;
  IF EXISTS(SELECT 1 FROM public.billing_cycles WHERE project_id='p19' AND ym BETWEEN '202609' AND '202612' AND (reward_paid_at IS NOT NULL OR payment_confirmed_at IS NOT NULL OR payout_notice_uploaded_at IS NOT NULL)) THEN RAISE EXCEPTION 'Cycle payment evidence changed'; END IF;
  IF EXISTS(SELECT 1 FROM public.monthly_reward_payout WHERE project_id='p19' AND member_id='ID004' AND ym BETWEEN '202609' AND '202612') THEN RAISE EXCEPTION 'Ko already has saved payout'; END IF;
  IF EXISTS(SELECT 1 FROM public.payout_notices WHERE member_id='ID004' AND ym IN('202610','202611') AND (pdf_url IS NOT NULL OR sent_at IS NOT NULL OR (notice_no IS NOT NULL AND notice_no NOT LIKE 'PREVIEW-%'))) THEN RAISE EXCEPTION 'Ko already has formal notice'; END IF;
  SELECT jsonb_agg(jsonb_build_object('ym',c.ym,'member',m) ORDER BY c.ym,m->>'memberId'),sum((m->>'totalPay')::numeric),sum(coalesce((m->>'companyReserveYen')::numeric,0))
    INTO before_others,before_total,before_internal
    FROM public.billing_cycles c CROSS JOIN LATERAL jsonb_array_elements(c.reward_summary_json::jsonb->'members') m
    WHERE c.project_id='p19' AND c.ym BETWEEN '202609' AND '202612' AND m->>'memberId'<>'ID004';
  FOR row_item IN SELECT ym,reward_summary_json FROM public.billing_cycles WHERE project_id='p19' AND ym BETWEEN '202609' AND '202612' ORDER BY ym LOOP
    old_cache:=row_item.reward_summary_json::jsonb; next_cache:=old_cache;
    SELECT m INTO ko FROM jsonb_array_elements(old_cache->'members') m WHERE m->>'memberId'='ID004';
    IF row_item.ym='202609' THEN
      IF ko IS NULL OR (ko->>'totalPay')::numeric<>12400 OR (ko->>'stockYen')::numeric<>80 OR (ko->>'basePay')::numeric<>12480 THEN RAISE EXCEPTION 'September Ko amount changed'; END IF;
      SELECT jsonb_set(next_cache,'{members}',jsonb_agg(CASE WHEN m->>'memberId'='ID004' THEN m||'{"totalPay":12500,"regularPaidYen":12500,"stockYen":0,"regularStockYen":0,"deferredYen":0,"roundingTopUpYen":20,"regularRoundingTopUpYen":20,"extraRoundingTopUpYen":0}'::jsonb ELSE m END ORDER BY ord)) INTO next_cache FROM jsonb_array_elements(old_cache->'members') WITH ORDINALITY x(m,ord);
      FOR entry IN SELECT * FROM jsonb_each_text('{"totalPaySum":100,"externalPayoutCapYen":100,"externalRegularPayoutCapYen":100,"carryOverYen":-80,"regularCarryOverYen":-80,"roundingTopUpYen":20,"regularRoundingTopUpYen":20}'::jsonb) LOOP
        next_cache:=jsonb_set(next_cache,ARRAY[entry.key],to_jsonb(coalesce((next_cache->>entry.key)::numeric,0)+entry.value::numeric));
      END LOOP;
    ELSIF row_item.ym='202610' THEN
      IF ko IS NULL OR (ko->>'totalPay')::numeric<>100 OR (ko->>'carryInYen')::numeric<>80 OR (ko->>'basePay')::numeric<>0 THEN RAISE EXCEPTION 'October Ko amount changed'; END IF;
      SELECT jsonb_set(next_cache,'{members}',jsonb_agg(CASE WHEN m->>'memberId'='ID004' THEN m||'{"totalPay":0,"regularPaidYen":0,"carryInYen":0,"regularCarryInYen":0,"grossDueYen":0,"regularGrossDueYen":0,"roundingTopUpYen":0,"regularRoundingTopUpYen":0}'::jsonb ELSE m END ORDER BY ord)) INTO next_cache FROM jsonb_array_elements(old_cache->'members') WITH ORDINALITY x(m,ord);
      FOR entry IN SELECT * FROM jsonb_each('{"totalPaySum":[537200,537100],"totalGrossDueYen":[1501630,1501550],"carryInYen":[1083095,1083015],"regularUnusedCapCarryOutYen":[396240,396320],"externalPayoutCapYen":[537200,537100],"externalRegularPayoutCapYen":[137200,137100],"regularTotalGrossDueYen":[201630,201550],"roundingTopUpYen":[115,95],"regularRoundingTopUpYen":[115,95]}'::jsonb) LOOP
        IF old_cache->entry.key IS DISTINCT FROM entry.value->0 THEN RAISE EXCEPTION 'October field changed: %',entry.key; END IF;
        next_cache:=jsonb_set(next_cache,ARRAY[entry.key],entry.value->1);
      END LOOP;
    ELSE
      IF ko IS NOT NULL AND coalesce((ko->>'totalPay')::numeric,0)<>0 THEN RAISE EXCEPTION 'Later Ko payout changed'; END IF;
      FOR entry IN SELECT key,value FROM jsonb_each(CASE WHEN row_item.ym='202611' THEN '{"effectiveCapBudgetYen":[591240,591320],"effectiveRegularCapBudgetYen":[591240,591320],"regularCapCarryInYen":[396240,396320],"regularUnusedCapCarryOutYen":[389220,389300]}'::jsonb ELSE '{"effectiveCapBudgetYen":[584220,584300],"effectiveRegularCapBudgetYen":[584220,584300],"regularCapCarryInYen":[389220,389300],"regularUnusedCapCarryOutYen":[383175,383255]}'::jsonb END) LOOP
        IF old_cache->entry.key IS DISTINCT FROM entry.value->0 THEN RAISE EXCEPTION 'Later field changed: %:%',row_item.ym,entry.key; END IF;
        next_cache:=jsonb_set(next_cache,ARRAY[entry.key],entry.value->1);
      END LOOP;
    END IF;
    UPDATE public.billing_cycles SET reward_summary_json=next_cache,updated_at=now() WHERE project_id='p19' AND ym=row_item.ym;
    INSERT INTO public.billing_log(project_id,ym,action,actor,detail) VALUES('p19',row_item.ym,'payout_rounding_timing_corrected','masa',jsonb_build_object('event_key',event_key,'member_id','ID004','reason','旧切捨ての80円を10月通常振込に含め、11月100円の別振込を解消。年間支払総額・他メンバー・非現金割当は維持。','before_member',ko,'before_headers',old_cache-'members','after_headers',next_cache-'members'));
  END LOOP;
  SELECT jsonb_agg(jsonb_build_object('ym',c.ym,'member',m) ORDER BY c.ym,m->>'memberId'),sum((m->>'totalPay')::numeric),sum(coalesce((m->>'companyReserveYen')::numeric,0)) INTO after_others,after_total,after_internal FROM public.billing_cycles c CROSS JOIN LATERAL jsonb_array_elements(c.reward_summary_json::jsonb->'members') m WHERE c.project_id='p19' AND c.ym BETWEEN '202609' AND '202612' AND m->>'memberId'<>'ID004';
  IF after_others IS DISTINCT FROM before_others OR after_total<>before_total OR after_internal<>before_internal THEN RAISE EXCEPTION 'Other member allocation changed'; END IF;
  IF (SELECT sum((m->>'totalPay')::numeric) FROM public.billing_cycles c CROSS JOIN LATERAL jsonb_array_elements(c.reward_summary_json::jsonb->'members') m WHERE c.project_id='p19' AND c.ym BETWEEN '202609' AND '202612' AND m->>'memberId'='ID004')<>12500 THEN RAISE EXCEPTION 'Ko total not conserved'; END IF;
END $$;
COMMIT;
