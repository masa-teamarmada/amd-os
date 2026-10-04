-- 472_tech_ledger_revenue_model_wording.sql
--
-- 技術タブ（技術台帳）の文章で、事業の収益の仕組みを「稼ぎ方」「稼ぐ」と書いていたところを言い換える。
-- まさ確定 2026-10-04「稼ぎ方っていう言い方は下品なので、報酬形態、みたいな言い方に変えて」→ SXの競合比較表の「稼ぎ方」を「収益モデル」に言い換える案に「1で」。
--
-- 1. SOL（p21）「ガルデリアとの違い」: 比較表の行の名前と、本文の「稼ぎ方が違います」 → 収益モデル
-- 2. SOL（p21）「よく聞かれる問いと答え方」: 本文の「稼ぎ方（吸着剤を売るか、処理で対価をいただくか）」 → 収益モデル
-- 3. LiSTie（p07）「LiSTieのビジネスモデル」: 「膜の定期交換でも稼ぐ事業」 → 「膜の定期交換でも収益を得る事業」（同じ言い方の残り）
-- 中身（何を売るか）は変えない。変更前の文は amd_os_data_change_history（トリガー）に残る。destructive DDL は行わない。

BEGIN;

UPDATE public.project_tech_topics
   SET body_md = replace(replace(body_md,
         '| 稼ぎ方 |', '| 収益モデル |'),
         '、稼ぎ方が違います。', '、収益モデルが違います。'),
       updated_by = 'migration-472',
       updated_at = now()
 WHERE tech_topic_id = 'ptt_sx_comp_galdieria'
   AND project_id = 'p21'
   AND body_md LIKE '%稼ぎ方%';

UPDATE public.project_tech_topics
   SET body_md = replace(body_md,
         '稼ぎ方（吸着剤を売るか、処理で対価をいただくか）', '収益モデル（吸着剤を売るか、処理で対価をいただくか）'),
       updated_by = 'migration-472',
       updated_at = now()
 WHERE tech_topic_id = 'ptt_sx_comp_qa'
   AND project_id = 'p21'
   AND body_md LIKE '%稼ぎ方%';

UPDATE public.project_tech_topics
   SET body_md = replace(body_md, '膜の定期交換でも稼ぐ事業', '膜の定期交換でも収益を得る事業'),
       updated_by = 'migration-472',
       updated_at = now()
 WHERE tech_topic_id = 'ptt_lst_bm_overview'
   AND project_id = 'p07'
   AND body_md LIKE '%膜の定期交換でも稼ぐ事業%';

DO $v$
DECLARE
  remaining text;
BEGIN
  SELECT string_agg(tech_topic_id, ', ') INTO remaining
    FROM public.project_tech_topics
   WHERE coalesce(body_md, '') || coalesce(summary, '') || coalesce(title, '') ~ '稼ぎ方|稼ぐ';
  IF remaining IS NOT NULL THEN
    RAISE EXCEPTION 'old wording remains in tech topics: %', remaining;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.project_tech_topics WHERE tech_topic_id = 'ptt_sx_comp_galdieria' AND body_md LIKE '%| 収益モデル |%') THEN
    RAISE EXCEPTION 'SX comparison table row was not renamed';
  END IF;
END $v$;

COMMIT;
