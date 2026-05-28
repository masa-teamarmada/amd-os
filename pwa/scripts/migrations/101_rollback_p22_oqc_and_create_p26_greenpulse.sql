-- 101_rollback_p22_oqc_and_create_p26_greenpulse.sql
--
-- 2026-05-27 事故リカバリ:
--   migration 100 で p22 を GreenPulse として INSERT したが、p22 は既存 OQC PJ
--   (monthly_reports 12 + billing_cycles 12 行が紐付き、すべて not_started のゾンビ状態)
--   だった。projects.project_name を OQC → GreenPulse に上書きしてしまった。
--
-- この migration で:
--   1. projects p22 の project_name を OQC に戻す
--   2. project_ventures から p22 (migration 100 で私が INSERT した行) を DELETE
--   3. amd_score_inputs から p22 の 2026-05-27 評価行を DELETE
--   4. GreenPulse を **p26** で再作成 (projects + project_ventures + amd_score_inputs)
--
-- p22 の元 status / project_category は不明だが、現状 (active / dtsu) のままにする
-- (billing_cycles が運用枠だけ作られていた事実から、ゾンビ active 系列だったと推測)。
-- OQC の正体は別途まさに確認する宿題。

-- =====================================================================
-- 1. projects.p22 を OQC に戻す
-- =====================================================================

UPDATE projects
SET project_name = 'OQC',
    updated_at   = NOW()
WHERE project_id = 'p22';

-- =====================================================================
-- 2. project_ventures p22 (migration 100 で INSERT した行) を DELETE
-- =====================================================================

DELETE FROM project_ventures WHERE project_id = 'p22';

-- =====================================================================
-- 3. amd_score_inputs p22 (migration 100 で INSERT した行) を DELETE
-- =====================================================================

DELETE FROM amd_score_inputs
WHERE project_id = 'p22'
  AND evaluator = 'amie_session_2026-05-27';

-- =====================================================================
-- 4. GreenPulse を p26 で再作成
-- =====================================================================
-- (注) p25 = KUTE が最後、p26 が次の空き番号。

INSERT INTO projects (
  project_id, project_name, status, start_ym,
  project_type, project_category, invoice_send_manual
)
VALUES (
  'p26', 'GP', 'active', '202605',
  'standard', 'dtsu', true
)
ON CONFLICT (project_id) DO UPDATE SET
  project_name       = EXCLUDED.project_name,
  status             = EXCLUDED.status,
  start_ym           = COALESCE(projects.start_ym, EXCLUDED.start_ym),
  project_category   = EXCLUDED.project_category,
  updated_at         = NOW();

INSERT INTO project_ventures (
  project_id, display_name, short_label,
  lane, lanes,
  founded_at, outcome_pattern,
  origin_org, origin_pi, amd_role,
  short_description, is_public,
  amd_support_started_at
)
VALUES (
  'p26',
  'GP (仮称)',
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
  'p26',
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
