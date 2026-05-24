-- 088_strategy_signal_tech_progress.sql
-- まさ #14-3rd (2026-05-24) で、`ip_regulatory` (= 知財/規制) には実は2つの全く違うシグナルが混ざっていた:
--   (1) 自社の特許出願完了 / 知財戦略決定 (= 技術開発側、cockpit に出す)
--   (2) 中国レアアース輸出規制強化 / G7 緊急課題化 (= 外部規制動向、外部環境扱い = Atlas へ)
-- これを `signal_type` レベルで分けるため、`tech_progress` を新規許可する。
--
-- 4 分類への mapping (= CockpitStrategySignals.CATEGORY_OF_TYPE):
--   tech_progress  → 🔬 技術開発 (sky)
--   ip_regulatory  → 🌐 外部環境 (amber, cockpit 表示せず Atlas へ誘導)

ALTER TABLE project_strategy_signals
  DROP CONSTRAINT IF EXISTS project_strategy_signals_signal_type_check;

ALTER TABLE project_strategy_signals
  ADD CONSTRAINT project_strategy_signals_signal_type_check
  CHECK (signal_type IN (
    'management_decision',
    'business_progress',
    'strategic_pivot',
    'commercial_progress',
    'partnership',
    'funding',
    'ip_regulatory',
    'risk',
    'next_move',
    'tech_progress'
  ));
