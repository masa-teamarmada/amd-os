-- 100_greenpulse_project.sql
--
-- 香川大学 下川房男教授の MEMS 型維管束センサ PJ を AMD OS に新規登録。
-- 仮称: GreenPulse (= p22)。Before 0 PJ、明日 2026-05-28 香川訪問前の初期評価込み。
-- 名前は後で確定する前提 (= まさが「あとから考えればいい」と明示 2026-05-27)。
--
-- 投入内容:
--   1. projects に p22 を追加
--   2. project_ventures に p22 を追加 (lane=agritech / lanes JSONB は sensing 0.6 + biotech 0.4)
--   3. amd_score_inputs に 2026-05-27 評価点を追加 (mu/XRL/FRL + 根拠 notes)

-- =====================================================================
-- 1. projects
-- =====================================================================

INSERT INTO projects (
  project_id, project_name, status, start_ym,
  project_type, project_category, invoice_send_manual
)
VALUES (
  'p22', 'GreenPulse', 'active', '202605',
  'standard', 'dtsu', true
)
ON CONFLICT (project_id) DO UPDATE SET
  project_name       = EXCLUDED.project_name,
  status             = EXCLUDED.status,
  start_ym           = COALESCE(projects.start_ym, EXCLUDED.start_ym),
  project_category   = EXCLUDED.project_category,
  updated_at         = NOW();

-- =====================================================================
-- 2. project_ventures
-- =====================================================================
-- lane (legacy TEXT) は 'agritech' を新規導入。
-- lanes (JSONB ASPI 8 domains) は sensing_timing_navigation 0.6 + biotechnology 0.4。
-- outcome_pattern は Before 0 PJ なので 'planning' (= 設立前段階、CHECK 制約なし)。

INSERT INTO project_ventures (
  project_id, display_name, short_label,
  lane, lanes,
  founded_at, outcome_pattern,
  origin_org, origin_pi, amd_role,
  short_description, is_public,
  amd_support_started_at
)
VALUES (
  'p22',
  'GreenPulse (仮称)',
  'GP',
  'agritech',
  '[{"domain": "sensing_timing_navigation", "weight": 0.6}, {"domain": "biotechnology", "weight": 0.4}]'::jsonb,
  NULL,
  'planning',
  '香川大学',
  '下川房男',
  'founder_studio',
  'MEMS 型維管束センサ (5mm シリコンチップ) / 茎径 1〜5mm 対応 / 導管 + 師管両計測 / 細径茎は世界唯一',
  true,
  '2026-05-27'
)
ON CONFLICT (project_id) DO UPDATE SET
  display_name      = EXCLUDED.display_name,
  short_label       = COALESCE(project_ventures.short_label, EXCLUDED.short_label),
  lane              = EXCLUDED.lane,
  lanes             = EXCLUDED.lanes,
  outcome_pattern   = EXCLUDED.outcome_pattern,
  origin_org        = EXCLUDED.origin_org,
  origin_pi         = EXCLUDED.origin_pi,
  amd_role          = EXCLUDED.amd_role,
  short_description = EXCLUDED.short_description,
  amd_support_started_at = COALESCE(project_ventures.amd_support_started_at, EXCLUDED.amd_support_started_at),
  is_public         = EXCLUDED.is_public,
  updated_at        = NOW();

-- =====================================================================
-- 3. amd_score_inputs (初回評価 2026-05-27)
-- =====================================================================
-- 入力値は AMD/kagawa/kagawa-plant-sensing.md + 既存 AMD OS スコア体系から導出。
-- まさ × えいみ 2026-05-27 セッションで合意。

INSERT INTO amd_score_inputs (
  project_id, evaluated_at,
  mu_a, mu_i, mu_g,
  trl, brl, grl, srl, hrl,
  frl,
  shallow_tech_mode,
  evaluator, notes,
  mu_notes, xrl_notes, frl_notes
)
VALUES (
  'p22',
  '2026-05-27T12:00:00+09:00'::timestamptz,
  6.0, 5.0, 7.0,
  4.0, 1.5, 1.0, 1.5, 2.5,
  5.0,
  false,
  'amie_session_2026-05-27',
  'GreenPulse 初回評価。明日 2026-05-28 香川大訪問前。AMD/kagawa/kagawa-plant-sensing.md を基礎資料に、3軸 A1×B1×C1+C2 想定、Before 0 PJ。',
  jsonb_build_object(
    'a', '下川先生 NTT 27年→香川大、IEEE Sensors 2016/Transducers 2017 ファイナリスト、特許6件、KAKEN 15H03545 ¥1,703万。植物センシング分野の論文密度はそこそこ',
    'i', 'FloraPulse / Dynamax / ICT International が活動中、ただし VC 投資控えめ (FloraPulse 調達 $1.7M total、ほぼ全額グラント)。樹液流センサー市場 CAGR 8%、精密農業 IoT CAGR 12.2%',
    'g', '2026年度「農業構造転換集中対策」494億円 (前年 2 倍超)、スマート農業技術活用促進 182億円、みどりの食料システム戦略 (化学肥料 30% 減・農薬 50% 減) = 政策追い風強い'
  ),
  jsonb_build_object(
    'trl', 'ラボでトマト計測成功 (昼夜差実測)、特許 6 件、IEEE/Transducers ファイナリスト。耐久性検証・量産設計・圃場長期試験は未着手 = TRL 4 (ラボ環境での小規模試作)',
    'brl', '既存 md に市場分析・3 モデル仮説 (Model A SaaS / B OEM / C Marketplace)・Phase 1-3 戦略あり。顧客検証ゼロ、売上ゼロ = BRL 1.5 (仮説段階)',
    'grl', '農業規制・自動制御規制・認証未着手 = GRL 1 (規制リスク特定段階)',
    'srl', '学会発表のみ、一般認知なし = SRL 1.5',
    'hrl', '下川先生 (PI) + 高尾英邦・寺尾京平 (共同研究者) + AMD まさ伴走候補。CEO 未定 = HRL 2.5 (創業期 1-3 名段階)'
  ),
  'CEO 未定。下川先生は事業興味あるが起業家タイプではない (=自走しない、フルコミット協力可)。まさ伴走前提で暫定 5.0 (CX/SX のまさ伴走値と整合)。明日の訪問で CEO 候補・経営チーム組成可能性を探る = 律速 HRL の改善が最大インパクト'
)
ON CONFLICT (project_id, evaluated_at) DO UPDATE SET
  mu_a       = EXCLUDED.mu_a,
  mu_i       = EXCLUDED.mu_i,
  mu_g       = EXCLUDED.mu_g,
  trl        = EXCLUDED.trl,
  brl        = EXCLUDED.brl,
  grl        = EXCLUDED.grl,
  srl        = EXCLUDED.srl,
  hrl        = EXCLUDED.hrl,
  frl        = EXCLUDED.frl,
  evaluator  = EXCLUDED.evaluator,
  notes      = EXCLUDED.notes,
  mu_notes   = EXCLUDED.mu_notes,
  xrl_notes  = EXCLUDED.xrl_notes,
  frl_notes  = EXCLUDED.frl_notes,
  updated_at = NOW();
