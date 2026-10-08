-- 原本第12条で準用する細則の適用版も確認対象であることを追補。
-- 条件の確定・外部照会・金額変更は行わない。migration492の適用後に一度だけ実行。
BEGIN;
DO $$
DECLARE checks jsonb; target_id uuid := 'a887fa6f-055c-441b-8f5e-40625c19195e';
BEGIN
 SELECT operational_terms_json->'operationalChecks' INTO checks FROM contracts
 WHERE contract_id=target_id AND project_id='p21' AND md5((operational_terms_json->'operationalChecks')::text)='c9aada2d6300c2af299b77f4af93cf6c' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Check record changed or already applied'; END IF;
 PERFORM 1 FROM projects WHERE project_id='p21' AND contract_terms_json->'currentContracts'->0->>'contractId'=target_id::text
 AND contract_terms_json->'currentContracts'->0->'terms'->'operationalChecks'=checks FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project mirror changed'; END IF;
 checks := jsonb_set(checks,'{0,actions,1,text}',to_jsonb('大学との別NDA、添付仕様書、共同研究・知財契約、第12条で準用する契約事務取扱細則の適用版を確認し、情報に適用される開示条件を確かめる。'::text));
 checks := jsonb_set(checks,'{0,unresolved,0}',to_jsonb('大学との別NDA・添付仕様書・第12条で準用する細則の適用版は今回未確認。'::text));
 checks := jsonb_set(checks,'{0,sourceClause}',to_jsonb('全14条を確認／第11条（個人情報）、第12条（細則の準用）、第14条（未定事項の双方協議）'::text));
 UPDATE contracts SET operational_terms_json=jsonb_set(operational_terms_json,'{operationalChecks}',checks) WHERE contract_id=target_id;
 UPDATE projects SET contract_terms_json=jsonb_set(contract_terms_json,'{currentContracts,0,terms,operationalChecks}',checks) WHERE project_id='p21';
END $$;
COMMIT;
