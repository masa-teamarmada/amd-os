-- 142_billing_cycles_extra_revenue.sql
-- 別財布（別契約）売上を billing_cycles に構造化して持たせる。
--
-- 背景: 1 つの PJ が「定額/変動の本契約」とは別に、単発の受託（別契約 = 別財布）を
-- 受けることがある。実例: ZMP (p19) は定額 ¥30万/月の業務委託とは別に、OkuDoor
-- システム開発を ¥2,000,000 (税抜, INV-0000000305, 2026-03-31 一括請求) で受託している。
--
-- これまで収支シミュレータは本契約売上 (projects.fee_amount / billing_cycles.budget) しか
-- 売上に乗せておらず、別財布の原価 (cap_extra プールの uncapped 報酬) だけが costMember に
-- 乗って粗利を食い潰していた。別財布売上をこの列に積み、live builder が
-- MonthlyPlProjectRevenue.extraRevenue として注入することで、売上・粗利・消費税・CF・残高に
-- 正しく反映する。原価は cap_extra 側で計上済みのため rateMember/rateCloser は通さない。
--
-- 形式 (jsonb 配列、各要素 1 別財布売上行):
--   [
--     {
--       "label": "OkuDoorシステム開発",
--       "amount_tax_excl": 2000000,
--       "freee_invoice_number": "INV-0000000305",
--       "billing_date": "2026-03-31",
--       "memo": "葛飾ロード株式会社 / システム開発費 一括"
--     }
--   ]
-- 計上月 = その billing_cycles 行の ym。請求日ベースでキャッシュは同月計上 (入金遅延は持たせない)。
-- null / 空配列 = 別財布なし (= 従来挙動)。非破壊追加。

ALTER TABLE billing_cycles
  ADD COLUMN IF NOT EXISTS extra_revenue_json jsonb;

COMMENT ON COLUMN billing_cycles.extra_revenue_json IS
  '別財布（別契約）売上の配列 [{label, amount_tax_excl, freee_invoice_number, billing_date, memo}]。本契約売上とは別枠で収支シミュレータの revenue に加算。原価は cap_extra 側で計上済みのため自動原価率は通さない。請求日ベース同月キャッシュ。';
