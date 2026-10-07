-- 2026-10-07 まさ依頼：長期計画v0.5に沿って生産量5セルを補完。
-- 菌体の年産重量は未確定。処理水量・売上から生産量を推定しない。
BEGIN;
DO $migration$
DECLARE
  mapping jsonb := $json${"psi": "ラボで培養・回収の再現性と菌体量の測定方法を確認", "seed": "実証用の小規模生産。2027年9月までに3ロットの合格と必要量を確認し、10月から顧客別の使用量を記録", "series-a": "需要から菌体必要量を算定（2029年6月）。小規模供給をつなぎ、2030年7〜12月に需要を満たす量産供給を検証", "series-b": "量産実証設備で需要に応じた供給を継続。2033年3月までに新設備の生産性・品質を確認", "series-c": "認定済み能力の範囲で主力供給。2033年4月〜2034年3月の12か月で生産性・受注・納期を評価"}$json$::jsonb;
  original jsonb; revised jsonb; phase jsonb; idx integer;
BEGIN
  IF (SELECT value FROM public.project_config WHERE project_id='p21' AND key='long_term_plan_document_id') IS DISTINCT FROM '9ff624dc-8abd-4cad-8073-4de4b6078bed' THEN
    RAISE EXCEPTION 'long-term source changed';
  END IF;
  SELECT phases_json INTO STRICT original FROM public.project_business_plans WHERE project_id='p21' FOR UPDATE;
  IF jsonb_array_length(original) <> 5 THEN RAISE EXCEPTION 'phase count changed'; END IF;
  revised := original;
  FOR phase,idx IN SELECT value,(ordinality-1)::integer FROM jsonb_array_elements(original) WITH ORDINALITY LOOP
    IF NOT mapping ? (phase->>'id') THEN RAISE EXCEPTION 'unknown phase'; END IF;
    IF phase->'comparisonTargets' IS NULL THEN RAISE EXCEPTION 'comparison data missing'; END IF;
    IF phase->'comparisonTargets'->>'productionVolume' IS NOT NULL AND phase->'comparisonTargets'->>'productionVolume' IS DISTINCT FROM mapping->>(phase->>'id') THEN RAISE EXCEPTION 'production target already changed'; END IF;
    revised := jsonb_set(revised,ARRAY[idx::text,'comparisonTargets','productionVolume'],mapping->(phase->>'id'),true);
  END LOOP;
  UPDATE public.project_business_plans SET phases_json=revised,updated_at=now() WHERE project_id='p21' AND phases_json IS DISTINCT FROM revised;
END;
$migration$;
COMMIT;
