-- ventures_xrl_log 初期値
-- 9社の TRL/BRL/HRL 時系列（AMD OS デモ用、推定値を含む）
-- bottleneck = 最も低い値を示すレイヤ（投入判断の根拠）

-- =====================================================================
-- ティエムファクトリ (materials, 2012-2022, burnout)
-- 透明断熱素材。TRL3で立上 → シリーズBでオフサイトPoC成功も
-- オンサイト未達のまま資金切れ。HRL（市場形成）が致命的に低かった。
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('tiem', '2012-11-01', 3, 1, 2, NULL, NULL, 'BRL', '設立 — TRL3(理論実証)で立上'),
  ('tiem', '2015-04-01', 4, 2, 2, NULL, NULL, 'BRL', 'ラボ試作成功 / 特許出願'),
  ('tiem', '2017-09-01', 4, 3, 2, NULL, NULL, 'HRL', 'シリーズB調達 / 産業パートナー探索'),
  ('tiem', '2019-06-01', 5, 3, 2, NULL, NULL, 'HRL', 'オフサイトPoC成功 — 断熱性能実証'),
  ('tiem', '2021-01-01', 5, 3, 2, NULL, NULL, 'HRL', 'オンサイトPoC交渉 → 大手建材メーカー要求スペック未達'),
  ('tiem', '2022-03-01', 5, 3, 2, NULL, NULL, 'HRL', '資金切れ → 退任・終了 (HRL2のまま燃え尽き)')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- BWE / Blue Water Energy (gx_energy, 2019-active, lifted)
-- 濃度差発電。スタジオモデル第1号 / 長崎西部下水で大型PoC実施
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('bwe', '2019-04-01', 4, 2, 3, NULL, NULL, 'BRL', '設立 — TRL4(小スケール実証済み)'),
  ('bwe', '2020-10-01', 5, 3, 3, NULL, NULL, 'BRL', 'PoC準備 / 長崎市協議'),
  ('bwe', '2022-06-01', 6, 4, 4, NULL, NULL, NULL, '長崎西部下水 大型PoC開始'),
  ('bwe', '2024-03-01', 7, 5, 5, NULL, NULL, NULL, 'PoC実証完了 / 事業化協議中'),
  ('bwe', '2025-09-01', 7, 5, 6, NULL, NULL, NULL, '事業パートナー確定 / 展開検討中')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- JC / JOYCLE (gx_circular, 2023-2026, deep_pivot)
-- IRSプリミティブ熱分解で立上 → 群大野田先生の流動層熱分解で後付けdeep化
-- deep化後TRL再起動。最終的に終了（終了理由は記録なし）
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('jc', '2023-07-01', 3, 2, 2, NULL, NULL, 'TRL', '設立 — IRS熱分解プロセス (TRL3)'),
  ('jc', '2024-01-01', 4, 2, 3, NULL, NULL, 'BRL', '群大野田先生合流 / 流動層熱分解でdeep化開始'),
  ('jc', '2024-07-01', 5, 3, 3, NULL, NULL, 'BRL', '流動層プロセス 実証実験成功'),
  ('jc', '2025-03-01', 6, 3, 4, NULL, NULL, 'BRL', 'パイロット装置設計 / 産廃処理ビジネスモデル確立'),
  ('jc', '2026-03-01', 6, 3, 4, NULL, NULL, 'BRL', '終了 (2026-03) — AMD関与終結')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- CTB / CrestecBio (life, 2023-active, rocket)
-- 虚血性脳卒中薬 CTB211 / 大動物試験OK / AMED採択
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('ctb', '2023-04-01', 4, 3, 4, NULL, NULL, NULL, '設立 — AMED採択確定 / 化合物TRL4'),
  ('ctb', '2024-02-01', 5, 4, 5, NULL, NULL, NULL, '大動物試験OK / 治験準備開始'),
  ('ctb', '2025-01-01', 6, 5, 6, NULL, NULL, NULL, 'Phase 1 治験申請'),
  ('ctb', '2026-01-01', 7, 5, 6, NULL, NULL, NULL, 'Phase 1 進行中 / シリーズA調達')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- LST / LisTie (gx_circular, 2023-active, rocket)
-- リチウム回収 / TRL4で立上 / オンサイトPoC開始中
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('lst', '2023-04-01', 4, 2, 3, NULL, NULL, 'BRL', '設立 — QST発電池廃液からLiイオン回収 TRL4'),
  ('lst', '2024-03-01', 5, 3, 4, NULL, NULL, 'BRL', 'ラボスケール精製プロセス実証'),
  ('lst', '2025-01-01', 6, 4, 4, NULL, NULL, 'HRL', 'オンサイトPoC開始 — 自動車メーカー廃液供給'),
  ('lst', '2026-01-01', 6, 5, 5, NULL, NULL, NULL, 'PoC継続 / 量産プロセス設計中')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- KT / 輝翠TECH (robo, 2022-active, lifted)
-- 農業ロボ / オンサイトPoC完了
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('kt', '2022-04-01', 4, 3, 3, NULL, NULL, 'HRL', '設立 — 東北大発 農薬散布ロボ TRL4'),
  ('kt', '2023-06-01', 5, 4, 4, NULL, NULL, NULL, 'オフサイトPoC完了 (試験圃場)'),
  ('kt', '2024-04-01', 6, 5, 4, NULL, NULL, 'HRL', 'オンサイトPoC完了 / 農協との連携開始'),
  ('kt', '2025-04-01', 7, 5, 5, NULL, NULL, NULL, '商用展開 / 累計3農協採用')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- CX / CryoX 仮称 (gx_energy, 2026-pre_founding, rocket)
-- NIMS発磁気冷凍 → CO2フリーDC冷却 + 量子QC冷却
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('cx', '2026-04-01', 3, 2, 3, NULL, NULL, 'TRL', '設立前 — 磁気冷凍素子 TRL3 / Build VC 7月出資想定')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- SX / SolvioraX (gx_circular, 2025-pre_founding, rocket)
-- シアノバクテリア排水処理 / PSI Step2 / 2027-04設立目標
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('sx', '2025-07-01', 4, 2, 3, NULL, NULL, 'BRL', '事業化検討開始 — 愛媛大PSI Step2'),
  ('sx', '2026-04-01', 4, 3, 3, NULL, NULL, 'BRL', '排水処理契約候補あり / 設立準備中')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- YD / Yellow Duck (gx_energy, 2019-terminated, ue_fail)
-- 波力発電 / オンサイトPoC達成もUE不成立
-- =====================================================================
INSERT INTO ventures_xrl_log (venture_id, observed_at, trl, brl, hrl, grl, srl, bottleneck, milestone_label)
VALUES
  ('yd', '2019-01-01', 4, 2, 3, NULL, NULL, 'BRL', '設立 — 波力発電デバイス TRL4'),
  ('yd', '2020-06-01', 5, 2, 2, NULL, NULL, 'BRL', 'PoC準備 / 電力会社との協議難航'),
  ('yd', '2022-03-01', 6, 2, 2, NULL, NULL, 'BRL', 'オンサイトPoC成功 — 発電実証達成'),
  ('yd', '2023-06-01', 6, 2, 2, NULL, NULL, 'BRL', 'UE不成立 → 資金調達失敗 / 終了 (BRL2のまま)')
ON CONFLICT DO NOTHING;
