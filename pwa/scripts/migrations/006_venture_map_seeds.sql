-- Venture Map 初期シード値
-- 9社 + 領域別重み + 4件の予兆シーズ
-- ※ macro_index_log / papers_log は Phase 4/5 で実データソースから投入（ここでは投入しない）

-- =====================================================================
-- ventures (9社)
-- =====================================================================

INSERT INTO ventures (id, display_name, short_label, lane, founded_at, status, outcome_pattern, origin_org, origin_pi, amd_role, short_description, is_public)
VALUES
  ('tiem', 'ティエムファクトリ', 'ティエム', 'materials',   '2012-11-01', 'terminated',    'burnout',    '京都大学',         '山地正洋',  'founder_studio', '透明断熱素材。TRL3で立ててシリーズBでオフサイトPoC、オンサイト未達。資金切れで2022退任', true),
  ('bwe',  'Blue Water Energy', 'BWE',     'gx_energy',   '2019-04-01', 'active',        'lifted',     'BWE',              '山地正洋',  'studio',         'スタジオモデル第1号 / 濃度差発電 / 長崎西部下水で大型PoC実施', true),
  ('jc',   'JOYCLE',            'JC',      'gx_circular', '2023-07-01', 'terminated',    'deep_pivot', '群馬大学',         '小柳裕太郎','support',        'IRSプリミティブ熱分解で立上 → 群大野田先生の流動層熱分解で後付けdeep化', true),
  ('ctb',  'CrestecBio',        'CTB',     'life',        '2023-04-01', 'active',        'rocket',     '筑波大学',         '丸島',      'studio',         '虚血性脳卒中薬 CTB211 / 大動物試験OK / AMED採択', true),
  ('lst',  'LiSTie',            'LST',     'gx_circular', '2023-04-01', 'active',        'rocket',     'QST',              NULL,        'studio',         'リチウム回収 / TRL4で立上 / オンサイトPoC開始中', true),
  ('kt',   '輝翠TECH',          'KT',      'robo',        '2022-04-01', 'active',        'lifted',     '東北大学',         NULL,        'studio',         '農業ロボ / オンサイトPoC完了', true),
  ('cx',   'CryoX (仮称)',      'CX',      'gx_energy',   '2026-04-01', 'pre_founding',  'rocket',     'NIMS',             '神谷宏治',  'founder_studio', 'NIMS発磁気冷凍 → CO2フリーDC冷却 + 量子QC冷却 / Build VC 7月出資想定', true),
  ('sx',   'SolvioraX',         'SX',      'gx_circular', '2025-07-01', 'pre_founding',  'rocket',     '愛媛大学',         '杉浦美羽',  'founder_studio', 'シアノバクテリア排水処理 / PSI Step2 / 2027-04設立目標', true),
  ('yd',   'Yellow Duck',       'YD',      'gx_energy',   '2019-01-01', 'terminated',    'ue_fail',    NULL,               NULL,        'studio',         '波力発電 / オンサイトPoC到達もUE不成立で資金調達失敗', true)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  short_label = EXCLUDED.short_label,
  lane = EXCLUDED.lane,
  founded_at = EXCLUDED.founded_at,
  status = EXCLUDED.status,
  outcome_pattern = EXCLUDED.outcome_pattern,
  origin_org = EXCLUDED.origin_org,
  origin_pi = EXCLUDED.origin_pi,
  amd_role = EXCLUDED.amd_role,
  short_description = EXCLUDED.short_description,
  is_public = EXCLUDED.is_public;

-- =====================================================================
-- macro_lane_weights (5レーン × 初期値1行)
-- =====================================================================

INSERT INTO macro_lane_weights (lane, alpha, beta, gamma, delta, lambda, eta, computed_by, source_data_window_days)
VALUES
  ('gx_energy',   0.45, 0.20, 0.15, 0.20, 0.18, 1.20, 'manual-initial', 720),
  ('gx_circular', 0.50, 0.25, 0.10, 0.15, 0.15, 1.40, 'manual-initial', 720),
  ('materials',   0.30, 0.20, 0.30, 0.20, 0.22, 0.90, 'manual-initial', 720),
  ('life',        0.25, 0.40, 0.15, 0.20, 0.10, 1.10, 'manual-initial', 720),
  ('robo',        0.30, 0.25, 0.25, 0.20, 0.20, 1.30, 'manual-initial', 720);

-- =====================================================================
-- seeds (予兆候補4件、初期は全て is_public=true で公開)
-- =====================================================================

INSERT INTO seeds (title, description, origin_org, origin_pi, lane, trl, brl, hrl, status, is_public)
VALUES
  ('工学院大エコシステム',  '学内シーズ群、AMD OS導入想定先', '工学院大学', NULL,        'materials',   2, 1, 2, 'reviewing', true),
  ('香川大 下川先生',       '新規参入候補シーズ',             '香川大学',   '下川先生',  'gx_circular', 3, 1, 2, 'candidate', true),
  ('CX→量子QC冷却',         'DC冷却の次フェーズ',             'NIMS',       '神谷宏治',  'gx_energy',   2, 2, 3, 'reviewing', true),
  ('SX→Cクレジット',        'シアノ事業のアップサイド',       '愛媛大学',   '杉浦美羽',  'gx_circular', 4, 3, 4, 'reviewing', true);
