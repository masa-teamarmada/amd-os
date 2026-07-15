-- KENQ NDAの期間起算日は署名完了待ちだが、更新ルール自体は本文確認済み。

UPDATE public.contracts
SET renewal_type = '契約締結日から1年。満了1か月前までに書面による終了意思表示がなければ1年更新',
    operational_terms_json = jsonb_set(
      coalesce(operational_terms_json, '{}'::jsonb),
      '{renewalType}',
      to_jsonb('契約締結日から1年。満了1か月前までに書面による終了意思表示がなければ1年更新'::text),
      true
    )
WHERE contract_id = '812e2145-2763-43f2-8ce2-644e2da4dae9';

WITH updated_contracts AS (
  SELECT
    p.id,
    jsonb_agg(
      CASE
        WHEN item.contract->>'contractId' = '812e2145-2763-43f2-8ce2-644e2da4dae9' THEN
          item.contract || jsonb_build_object(
            'renewalType', '契約締結日から1年。満了1か月前までに書面による終了意思表示がなければ1年更新',
            'terms', coalesce(item.contract->'terms', '{}'::jsonb) || jsonb_build_object(
              'renewalType', '契約締結日から1年。満了1か月前までに書面による終了意思表示がなければ1年更新'
            )
          )
        ELSE item.contract
      END
      ORDER BY item.ordinality
    ) AS contracts_json
  FROM public.projects p
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(p.contract_terms_json->'currentContracts', '[]'::jsonb))
    WITH ORDINALITY AS item(contract, ordinality)
  WHERE p.project_id = 'p29'
  GROUP BY p.id
)
UPDATE public.projects p
SET contract_terms_json = jsonb_set(
  p.contract_terms_json,
  '{currentContracts}',
  updated_contracts.contracts_json,
  true
)
FROM updated_contracts
WHERE p.id = updated_contracts.id;
