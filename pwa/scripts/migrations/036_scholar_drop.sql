-- 036_scholar_drop.sql
--
-- 035 で作った scholar (個別論文) テーブルを廃止。
--
-- 理由 (まさ判断 2026-05-10):
--   μ_A は Triple Helix の隠れ状態 (Academia momentum) で、
--   data_specification.md §N に従い「lane × quarter の論文出版件数 (本/年)」が観測量。
--   個別論文を蓄積しても μ_A の根拠にならない (= 世界中の論文を 1 件ずつ集めても
--   特定 PJ のマクロ学術トレンドにならない)。
--
--   既存 papers_log (lane × year × paper_count) を quarter 単位で再構築し、
--   OpenAlex weekly cron で更新する方式に切替。

DROP TABLE IF EXISTS scholar CASCADE;
