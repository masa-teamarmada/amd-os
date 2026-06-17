-- 143_valuation_round_captable_detail.sql
--
-- 目的: 資金調達ラウンドとキャップテーブルを「ラウンドごとに発行した証券(プロダクト)種別 +
--        投資家別の内訳 + 創業者シェアのラウンド断面推移」まで構造化できるように拡張する。
--        起点: LST(p07) 今回ラウンド確定 (DG Daiwa 100M / Adlib Tech 20M / ごうぎん 30M, J-KISS)。
--        既存 project_valuation_rounds は lead_investor 単一テキスト + raised_yen 総額しか持てず、
--        「どの証券をいくらで誰がいくら引き受けたか」「ラウンドごとの創業者シェア推移」を表現できなかった。
--        設計正本: pwa/design/governance_action_items.md (cap table 章を追補)
--
-- 拡張内容:
--   project_valuation_rounds:
--     + security_type text   : 発行した証券(プロダクト)種別。J-KISS / 普通株式 / A種優先株式 等
--     + investors_json jsonb  : 投資家別内訳 [{name, amount_yen, security_type, units, tranche, lead, note}]
--     + status text           : ラウンド状態 planned/committed/closed (default 'closed')
--   project_shareholders:
--     + round_id uuid         : この株主スナップショットがどのラウンド直後の断面か (シェア推移用, nullable)
--
-- RLS は 137 で設定済み (service_role ALL + is_admin ALL)。列追加のみ。
--
-- 適用: python -X utf8 scripts/apply_ddl.py scripts/migrations/143_valuation_round_captable_detail.sql
--       適用後 python3 -X utf8 scripts/dump_schema.py で db_schema.md 再生成。

ALTER TABLE public.project_valuation_rounds
  ADD COLUMN IF NOT EXISTS security_type  text,
  ADD COLUMN IF NOT EXISTS investors_json jsonb,
  ADD COLUMN IF NOT EXISTS status         text DEFAULT 'closed';

COMMENT ON COLUMN public.project_valuation_rounds.security_type IS '発行した証券(プロダクト)種別: J-KISS / 普通株式 / A種優先株式 等';
COMMENT ON COLUMN public.project_valuation_rounds.investors_json IS '投資家別内訳 [{name, amount_yen, security_type, units, tranche, lead, note}]';
COMMENT ON COLUMN public.project_valuation_rounds.status IS 'planned / committed / closed';

ALTER TABLE public.project_shareholders
  ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.project_valuation_rounds(id);

COMMENT ON COLUMN public.project_shareholders.round_id IS 'この cap table スナップショットがどのラウンド直後の断面か (創業者シェア推移用, nullable)';

CREATE INDEX IF NOT EXISTS project_shareholders_round_idx ON public.project_shareholders(round_id);
