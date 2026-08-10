-- 244: 関係先の排液カラムへ「実験結果」を追加
--
-- 背景 (2026-08-08 まさ指示 #12):
--   排液の成分は自由文をやめて定型成分のプルダウン選択+バッジ表示にし、
--   自由文で書きたい分析・実験の内容は専用の「実験結果」欄に分ける。
--   成分の定型語彙はUI側 (SX_EFFLUENT_COMPONENT_CHOICES) が正本で、
--   effluent_components 列にカンマ区切りで保存する (列の型は変えない)。

alter table project_management_partners
  add column if not exists effluent_test_result text;
