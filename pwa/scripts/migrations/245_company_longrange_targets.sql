-- 245_company_longrange_targets.sql (旧 162。2026-08-08 に復旧・番号衝突回避のため改番)
--
-- 本体は 2026-07-02 に本番 Supabase へ適用済み。CREATE TABLE IF NOT EXISTS + ON CONFLICT DO UPDATE で冪等。
--
-- 長期戦略試算表 (FY2026–FY2035) の年次目標。
-- /management-score の運用試算表 (company_budget_inputs, 18ヶ月・積み上げ・freee実績連動) とは別物で、
-- こちらは中期経営計画の KPI 目標 (トップダウン) をアンカーにした長期の月次試算表を駆動する。
-- 運用試算表には一切影響しない (source が違う独立テーブル)。
--
-- アンカーは2つ: revenue_yen (売上目標) と fcf_yen (年次フリーCF目標)。
-- 原価・固定費はこの2アンカーに整合するようモデル側 (longrange-projection.ts) で導出する。
-- fund_aum_yen はファンド運用額 (管理報酬 2% の原資)。os/partner/papers は KPI 併記用。

CREATE TABLE IF NOT EXISTS public.company_longrange_targets (
  fy int PRIMARY KEY CHECK (fy BETWEEN 2020 AND 2100),
  revenue_yen bigint NOT NULL DEFAULT 0,
  fcf_yen bigint NOT NULL DEFAULT 0,
  fund_aum_yen bigint NOT NULL DEFAULT 0,
  os_institutions int NOT NULL DEFAULT 0,
  partner_institutions int NOT NULL DEFAULT 0,
  papers_cumulative int NOT NULL DEFAULT 0,
  note text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_longrange_targets ENABLE ROW LEVEL SECURITY;

-- サーバ側 (page server component) からは service_role で読む。RLS は既定 deny のまま。

COMMENT ON TABLE public.company_longrange_targets IS
  '長期戦略試算表 (FY2026-2035) の年次アンカー目標。中期経営計画 KPI 由来。運用試算表(company_budget_inputs)とは独立。';

-- 中期経営計画 (midterm_plan.md §5/§6) + amd_strategy.md 準拠のシード。
-- revenue: 60→370百万 / 年次FCF: 2→50百万 (amd_strategy の FY26 +200万→FY35 +5,000万 に一致)。
-- fund_aum: 中期計画のファンド運用額中点 (億→円)。
INSERT INTO public.company_longrange_targets
  (fy, revenue_yen, fcf_yen, fund_aum_yen, os_institutions, partner_institutions, papers_cumulative, note)
VALUES
  (2026,  60000000,  2000000,           0,  0,  4,  1, '研ぐ&診断: 業務委託+受託ベース、土壌診断を立ち上げ'),
  (2027,  75000000,  5000000,   200000000,  1,  6,  4, 'OS導入1件目(NIMS)、ファンド組成準備'),
  (2028,  95000000,  8000000,   500000000,  3,  9,  7, '刻印: 評価基準ライセンス開始・投資アプリ点灯・ファンド組成'),
  (2029, 120000000, 15000000,  1000000000,  6, 13, 10, 'ファンド10億規模へ、認定研修開始'),
  (2030, 150000000, 25000000,  1100000000, 10, 18, 13, 'OS導入10機関、政策パッケージ化'),
  (2031, 180000000, 30000000,  1500000000, 15, 24, 16, '標準化の入口、指数ライセンス検討'),
  (2032, 220000000, 35000000,  2000000000, 22, 30, 19, '認定・標準化の使用料が立ち上がる'),
  (2033, 260000000, 40000000,  2500000000, 32, 38, 22, '創業株の初期EXITが届き始める'),
  (2034, 310000000, 45000000,  3000000000, 45, 48, 26, 'ツルハシが標準に'),
  (2035, 370000000, 50000000,  3200000000, 60, 60, 30, 'OS導入60+機関、ファンド運用30億超')
ON CONFLICT (fy) DO UPDATE SET
  revenue_yen = EXCLUDED.revenue_yen,
  fcf_yen = EXCLUDED.fcf_yen,
  fund_aum_yen = EXCLUDED.fund_aum_yen,
  os_institutions = EXCLUDED.os_institutions,
  partner_institutions = EXCLUDED.partner_institutions,
  papers_cumulative = EXCLUDED.papers_cumulative,
  note = EXCLUDED.note,
  updated_at = now();
