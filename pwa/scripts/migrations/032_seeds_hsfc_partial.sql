-- 032_seeds_hsfc_partial.sql
--
-- HSFC GAPファンド 2024 STEP1 採択 (全25件中、検索で公開情報が拾えた 2 件のみ部分投入)。
-- HSFC 公式 PDF は CDN 制限で WebFetch / curl 取得不可、各大学プレスから個別収集が必要。
-- 残り 23 件は Phase 2 で各大学プレスを順次取り込み。
--
-- ※冪等性: 同タイトル+機関の重複は seeds 自体に UNIQUE 制約なしのため再 apply 注意。
-- 既に inline で投入済 (2026-05-09)、migration ファイルとして git に残す。

-- 投入済データ確認用 (再 apply 不要):
-- SELECT title, researcher_name FROM seeds WHERE source_detail LIKE 'HSFC GAPファンド 2024 STEP1 採択%';

-- 北大 矢口裕章 / 認知症・てんかん 免疫学的早期診断 (life)
-- 北大 鳥屋尾隆 / N2O 分解 固体触媒 (gx_circular)
-- いずれも HSFC GAPファンド 2024 STEP1 採択、上限500万円 プレ支援枠
