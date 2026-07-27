-- 196_sx_capital_policy_draft.sql
--
-- SX (p21) の事業計画タブで使う資本政策原案を、既存の編集可能な
-- project_capital_plans 台帳へ初期投入する。
-- 中島先生は株主に含めない。設立時持分は CEO 75% / 杉浦先生 20% /
-- まさ・AMD 5%。Seedはパートナーズファンドをリード候補とし、
-- いよぎんキャピタル、ダイキアクシスベンチャーパートナーズを含む1.5億円。
--
-- 既に同名プランがある環境では何も変更しない。既存編集を上書きしない。

INSERT INTO public.project_capital_plans (
  project_id,
  name,
  status,
  revision,
  document_json,
  created_by_email,
  updated_by_email
)
SELECT
  'p21',
  'SX 自社培養工場モデル 2026-07 原案',
  'active',
  1,
  $sxplan$
  {
    "holders": [
      {"id":"sx-ceo","name":"CEO","kind":"founder"},
      {"id":"sx-sugiura","name":"杉浦先生","kind":"founder"},
      {"id":"sx-amd","name":"まさ／AMD","kind":"founder"},
      {"id":"sx-esop","name":"SOプール","kind":"esop_pool"},
      {"id":"sx-partners-fund","name":"パートナーズファンド","kind":"investor"},
      {"id":"sx-iyogin","name":"いよぎんキャピタル","kind":"investor"},
      {"id":"sx-davp","name":"ダイキアクシスベンチャーパートナーズ","kind":"investor"},
      {"id":"sx-series-a","name":"Series A投資家","kind":"investor"},
      {"id":"sx-series-b","name":"Series B投資家","kind":"investor"},
      {"id":"sx-series-c","name":"Series C投資家","kind":"investor"},
      {"id":"sx-public","name":"公開市場","kind":"other"}
    ],
    "events": [
      {
        "id":"sx-incorporation","type":"incorporation","label":"設立","order":1,"date":"2027-04-01","status":"planned","calculationBasis":"manual",
        "allocations":[
          {"id":"sx-inc-ceo","holderId":"sx-ceo","shareClass":"common","shares":{"value":81000,"source":"input"}},
          {"id":"sx-inc-sugiura","holderId":"sx-sugiura","shareClass":"common","shares":{"value":21600,"source":"input"}},
          {"id":"sx-inc-amd","holderId":"sx-amd","shareClass":"common","shares":{"value":5400,"source":"input"}}
        ],
        "note":"中島先生は含めない。設立時持分の暫定原案。"
      },
      {
        "id":"sx-option-pool","type":"option_pool","label":"Seed前SOプール","order":2,"date":"2027-04-01","status":"planned","calculationBasis":"manual",
        "poolSize":{"value":12000,"source":"input"},
        "allocations":[{"id":"sx-so-allocation","holderId":"sx-esop","shareClass":"option","shares":{"value":12000,"source":"input"}}],
        "note":"Seed直前の完全希薄化後株式数に対して10%。"
      },
      {
        "id":"sx-seed","type":"equity_issue","label":"Seed","order":3,"date":"2027-04-01","status":"planned","calculationBasis":"valuation_and_investment",
        "preMoneyValuation":{"value":600000000,"source":"input"},
        "allocations":[
          {"id":"sx-seed-pf","holderId":"sx-partners-fund","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":75000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}},
          {"id":"sx-seed-iyogin","holderId":"sx-iyogin","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":40000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}},
          {"id":"sx-seed-davp","holderId":"sx-davp","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":35000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}}
        ],
        "note":"パートナーズファンドをリード候補とする暫定原案。"
      },
      {
        "id":"sx-series-a-event","type":"equity_issue","label":"Series A","order":4,"date":"2028-10-01","status":"planned","calculationBasis":"valuation_and_investment",
        "preMoneyValuation":{"value":2500000000,"source":"input"},
        "allocations":[{"id":"sx-a-allocation","holderId":"sx-series-a","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":600000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}}]
      },
      {
        "id":"sx-series-b-event","type":"equity_issue","label":"Series B","order":5,"date":"2031-04-01","status":"planned","calculationBasis":"valuation_and_investment",
        "preMoneyValuation":{"value":6000000000,"source":"input"},
        "allocations":[{"id":"sx-b-allocation","holderId":"sx-series-b","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":1500000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}}]
      },
      {
        "id":"sx-series-c-event","type":"equity_issue","label":"Series C","order":6,"date":"2033-04-01","status":"planned","calculationBasis":"valuation_and_investment",
        "preMoneyValuation":{"value":15000000000,"source":"input"},
        "allocations":[{"id":"sx-c-allocation","holderId":"sx-series-c","shareClass":"preferred","shares":{"value":0,"source":"calculated"},"amount":{"value":2000000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}}]
      },
      {
        "id":"sx-ipo-event","type":"ipo","label":"IPO","order":7,"date":"2035-04-01","status":"planned","calculationBasis":"valuation_and_investment",
        "preMoneyValuation":{"value":90000000000,"source":"input"},
        "allocations":[{"id":"sx-ipo-allocation","holderId":"sx-public","shareClass":"common","shares":{"value":0,"source":"calculated"},"amount":{"value":10000000000,"source":"input"},"pricePerShare":{"value":0,"source":"calculated"}}]
      }
    ]
  }
  $sxplan$::jsonb,
  'migration:196',
  'migration:196'
WHERE EXISTS (
  SELECT 1 FROM public.projects WHERE project_id = 'p21'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.project_capital_plans
  WHERE project_id = 'p21'
    AND name = 'SX 自社培養工場モデル 2026-07 原案'
);
