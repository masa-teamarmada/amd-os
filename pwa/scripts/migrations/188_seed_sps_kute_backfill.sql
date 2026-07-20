-- 188_seed_sps_kute_backfill.sql
-- 工学院大学 (KUTE) 現行 6 シーズの seed_sps_assessments を 2026-07-20 時点の
-- provisional 評価として investigate/insert する。187 が作った seed_sps_assessments
-- テーブルへの初回データ投入。187 自体は変更しない。
-- 設計: pwa/design/seeds.md, pwa/src/lib/seed-sps.ts
--
-- 対象特定: org_name='工学院大学' AND title の完全一致。
-- 6件すべて存在することを assert し、1件でも見つからなければ RAISE EXCEPTION で停止する
-- (想像で seed_id を書かない)。
--
-- HRL / F_character / F_cap / R_net は「観測した未形成/未着手」を意味する 0 として明示投入する
-- (個人の資質推測は禁止。CEO候補未定=f_character、経営中核の実行経験未形成=f_cap、
--  純キャッシュ貢献なし=r_net、経営/事業化チーム未形成=HRL、のいずれも組織的事実の観測であり個人評価ではない)。
-- axis_evidence は短い安全要約のみ (URL/raw/個人情報/secret は書かない)。

BEGIN;

DO $$
DECLARE
  found_count integer;
  expected_title text;
  expected_titles CONSTANT text[] := ARRAY[
    'フレキシブル熱電発電・センサー電源プラットフォーム',
    '医療機器設計向け力学特性データ基盤',
    'DCD歩行解析・療育現場支援ツール',
    '鳥類音響デバイス・音響体験シーズ',
    '常時微動による建物診断・防災点検シーズ',
    '音響メタマテリアル・吸遮音部材シーズ'
  ];
  eval_date CONSTANT DATE := '2026-07-20';
  evaluator_label CONSTANT TEXT := 'system:kute_seeds_sps_backfill_2026-07-20';
BEGIN
  SELECT count(*) INTO found_count
  FROM seeds
  WHERE org_name = '工学院大学'
    AND title = ANY(expected_titles);

  IF found_count <> 6 THEN
    RAISE EXCEPTION '工学院大学の対象シーズが 6 件見つかりません (見つかった件数: %)。title の完全一致条件を確認してください。', found_count;
  END IF;

  -- 合計6件だけでなく、各 title が重複なくちょうど1件ずつ存在することを検査する
  FOREACH expected_title IN ARRAY expected_titles LOOP
    SELECT count(*) INTO found_count
    FROM seeds
    WHERE org_name = '工学院大学' AND title = expected_title;

    IF found_count <> 1 THEN
      RAISE EXCEPTION '工学院大学のシーズ「%」が exactly 1 件ではありません (見つかった件数: %)。', expected_title, found_count;
    END IF;
  END LOOP;

  -- フレキシブル熱電発電・センサー電源プラットフォーム: mu 5/4/5, P6, R(TRL2/BRL1/GRL0/SRL3/HRL0), S(fchar0/fcap0/rnet0), low
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 5, 4, 5, 6,
    2, 1, 0, 3, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'low',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "フレキシブル熱電発電・センサー電源領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界における熱電発電・センサー電源への関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(センサー電源)での技術再現・実証段階の初期目安(社内評価、shallow_tech_modeではない)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化への把握/対応は未着手という観測(0=活動を確認できず)。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = 'フレキシブル熱電発電・センサー電源プラットフォーム'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();

  -- 医療機器設計向け力学特性データ基盤: mu 4/4/4, P6, R(TRL3/BRL2/GRL1/SRL2/HRL0), S(fchar0/fcap0/rnet0), medium
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 4, 4, 4, 6,
    3, 2, 1, 2, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'medium',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "医療機器設計向け力学特性データ領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界における医療機器向け力学特性データ活用への関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(医療機器設計)での技術再現・実証段階の初期目安(社内評価)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化(医療機器規制)への把握/対応の初期段階を示す目安。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = '医療機器設計向け力学特性データ基盤'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();

  -- DCD歩行解析・療育現場支援ツール: mu 4/2/4, P5, R(TRL3/BRL2/GRL1/SRL2/HRL0), S(fchar0/fcap0/rnet0), medium
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 4, 2, 4, 5,
    3, 2, 1, 2, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'medium',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "DCD歩行解析・療育現場支援領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界・療育現場におけるDCD歩行解析ツールへの関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(療育現場での歩行解析)での技術再現・実証段階の初期目安(社内評価)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化への把握/対応の初期段階を示す目安。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = 'DCD歩行解析・療育現場支援ツール'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();

  -- 鳥類音響デバイス・音響体験シーズ: mu 2/1/1, P2, R(TRL3/BRL1/GRL0/SRL1/HRL0), S(fchar0/fcap0/rnet0), medium
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 2, 1, 1, 2,
    3, 1, 0, 1, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'medium',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "鳥類音響デバイス・音響体験領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界における鳥類音響デバイス・音響体験への関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(音響体験)での技術再現・実証段階の初期目安(社内評価)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化への把握/対応は未着手という観測(0=活動を確認できず)。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = '鳥類音響デバイス・音響体験シーズ'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();

  -- 常時微動による建物診断・防災点検シーズ: mu 5/4/5, P6, R(TRL3/BRL1/GRL0/SRL3/HRL0), S(fchar0/fcap0/rnet0), low
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 5, 4, 5, 6,
    3, 1, 0, 3, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'low',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "常時微動による建物診断・防災点検領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界における常時微動計測を用いた建物診断・防災点検への関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面(防災施策)の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(建物診断・防災点検)での技術再現・実証段階の初期目安(社内評価)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化への把握/対応は未着手という観測(0=活動を確認できず)。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = '常時微動による建物診断・防災点検シーズ'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();

  -- 音響メタマテリアル・吸遮音部材シーズ: mu 5/4/3, P6, R(TRL3/BRL1/GRL0/SRL2/HRL0), S(fchar0/fcap0/rnet0), low
  INSERT INTO seed_sps_assessments (
    seed_id, evaluated_at, mu_a, mu_i, mu_g, potential,
    trl, brl, grl, srl, hrl, f_character, f_cap, frl, r_net,
    shallow_tech_mode, status, confidence, axis_evidence, missing_axes, evaluator
  )
  SELECT id, eval_date, 5, 4, 3, 6,
    3, 1, 0, 2, 0, 0, 0, 0, 0,
    FALSE, 'ready', 'low',
    '{
      "note": "2026-07-20時点のprovisional評価。HRL/F_character/F_cap/R_netは組織的な未着手/未形成の観測値(個人資質の推測ではない)。",
      "mu_a": "音響メタマテリアル・吸遮音部材領域の学術研究の厚み/進展の初期目安(社内スクリーニング評価)。",
      "mu_i": "産業界における音響メタマテリアル・吸遮音部材への関心/投資/導入動向の初期目安(社内スクリーニング評価)。",
      "mu_g": "政策/公的予算/制度面の追い風の初期目安(社内スクリーニング評価)。",
      "potential": "狙える経済的インパクトの天井に関する初期評価。",
      "trl": "狙う用途(吸遮音部材)での技術再現・実証段階の初期目安(社内評価)。",
      "brl": "顧客課題の把握・顧客確認・事業モデルの成熟は初期段階、専任体制は未整備。",
      "grl": "規制・ガバナンス・標準化への把握/対応は未着手という観測(0=活動を確認できず)。",
      "srl": "社会課題としての認知・社会受容の初期目安(社内評価)。",
      "hrl": "経営/事業化チームの形成は未着手という組織的事実の観測(0=個人資質評価ではない)。",
      "f_character": "CEO候補が未定という組織的事実の観測(0=個人評価ではない)。",
      "f_cap": "経営中核の実行経験は未形成という組織的事実の観測(0=個人評価ではない)。",
      "r_net": "純キャッシュ貢献の実績なしという観測(0=個人評価ではない)。"
    }'::jsonb,
    '{}', evaluator_label
  FROM seeds
  WHERE org_name = '工学院大学' AND title = '音響メタマテリアル・吸遮音部材シーズ'
  ON CONFLICT (seed_id, evaluated_at) DO UPDATE SET
    mu_a = EXCLUDED.mu_a, mu_i = EXCLUDED.mu_i, mu_g = EXCLUDED.mu_g, potential = EXCLUDED.potential,
    trl = EXCLUDED.trl, brl = EXCLUDED.brl, grl = EXCLUDED.grl, srl = EXCLUDED.srl, hrl = EXCLUDED.hrl,
    f_character = EXCLUDED.f_character, f_cap = EXCLUDED.f_cap, frl = EXCLUDED.frl, r_net = EXCLUDED.r_net,
    shallow_tech_mode = EXCLUDED.shallow_tech_mode, status = EXCLUDED.status, confidence = EXCLUDED.confidence,
    axis_evidence = EXCLUDED.axis_evidence, missing_axes = EXCLUDED.missing_axes, evaluator = EXCLUDED.evaluator,
    updated_at = NOW();
END $$;

COMMIT;
