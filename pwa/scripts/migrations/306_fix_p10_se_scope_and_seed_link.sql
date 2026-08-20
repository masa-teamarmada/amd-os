-- 306: SE（p10）に誤って紐づいていたCryoX/NIMS由来データの再スコープと、
--      spun_off シーズ f18b5a65（マイクロ波WPT／翔エンジニアリング）のPJリンク補完。
--
-- 背景:
--   1. seeds.status='spun_off' なのに spun_off_project_id が null で、
--      seed_projects だけがp10とのリンクを持っていた。シーズ一覧からPJへ辿れない。
--   2. 2026-03-31〜04-01 の eimi-daily 抽出が、CryoX（磁気冷凍・NIMS神谷グループ・高砂協業）の
--      ナレッジ12件をp10（SE=翔エンジニアリング）へ書き込んでいた。
--   3. 同様に codex_automation が2026-05のCryoXシグナル5件をp10へ書き込んでいた（全て archived）。
--   正しい帰属先はp20（CX / CryoX）。DELETEせずproject_idの付け替えのみ行う。

-- 1) シーズ → PJ の逆リンク補完
update seeds
   set spun_off_project_id = 'p10',
       updated_at = now()
 where id = 'f18b5a65-9bed-ade4-7ed7-59d3d08ab86a'
   and status = 'spun_off'
   and spun_off_project_id is null;

-- 2) CryoX由来 project_knowledge 12件を p10 → p20
update project_knowledge
   set project_id = 'p20',
       updated_at = now()
 where project_id = 'p10'
   and id in (
     'd01c75d9-9257-4719-848e-14d2457492d7', -- funding NIMS高砂共同研究契約
     'd0b41ab6-d687-4861-b55f-eb06677b0c93', -- ip 高砂共同研究契約の制約
     '88f08113-4833-43ac-b80b-4ace48c64b14', -- org NIMS神谷グループ
     '9b8a22f2-f768-4e57-95cc-8a5269b3befb', -- org NIMS藤崎（スタートアップ支援室）
     'b276b9c0-cd59-4829-94ce-0a453a73dc55', -- org 高砂（協業候補）
     'b13c0b95-e7de-4914-ab40-e1b15bfb4659', -- org 高砂（大企業）
     '15075144-6454-4d10-9a32-86c14dbf8a0d', -- people 神谷宏治
     'acc754f6-cb74-4fd7-98d5-e411dedf03c8', -- people 藤崎百合恵
     'a6841774-ca9c-439c-9c40-d6efd4fd7149', -- strategy 高砂協業戦略（masa判断）
     '8e1eec10-69b3-4ec6-a787-d37edc382abe', -- strategy 高砂協業方針（2026-04-01 masa決定）
     '79db035d-f799-4eb7-a549-2697f58e9814', -- tech プランB（CryoXコア技術）
     'b426eaf9-35cd-4e47-8dec-d19235be9027'  -- tech 磁気冷凍プランB
   );

-- 3) CryoX由来 project_strategy_signals 5件を p10 → p20
update project_strategy_signals
   set project_id = 'p20',
       updated_at = now()
 where project_id = 'p10'
   and signal_id in (
     '1c9c8e38-66e4-42ac-897b-82563d27cede', -- CryoX/NIMS連携が現地活動フェーズへ移行
     '8d38f19f-9695-41f6-8499-10e3007d487c', -- CryoXの市場戦略・ADR試算資料
     '1d04e9d4-6dde-41be-b0c7-38a70d273bba', -- CryoXが富士フイルムMRI開発担当との技術相談準備へ
     '0f7bb7e6-58ec-4f4c-a014-528b840cb9fb', -- 富士フイルム相談を一旦HOLD
     '902c73f0-35cd-43ec-b2f7-2162b6a181ab'  -- VC関係者と経営者候補のNIMS訪問が5/31に確定
   );
