-- Phase 5: atlas_signals + atlas_themes から macro_index_log をバックフィル
-- 5レーン × 月次で集計。
-- 実データは 2025-12 〜 現在まで（Atlas 収集開始以降の期間のみ）。

-- =====================================================================
-- レーン → テーマ名 マッピング（仮、Phase 5 一次切り）
-- =====================================================================

WITH lane_theme_map AS (
  -- gx_energy: GX エネルギー生成・効率化
  SELECT t.id AS theme_id, 'gx_energy'::text AS lane
  FROM atlas_themes t
  WHERE t.name IN (
    '再生可能エネルギー普及と系統統合',
    '水素・アンモニア',
    '全固体電池・次世代EV',
    '原子力・SMR・核融合',
    'AIインフラ・データセンター',
    '中東地政学とエネルギー安全保障'
  )

  UNION ALL

  -- gx_circular: GX サーキュラー・変換
  SELECT t.id, 'gx_circular'
  FROM atlas_themes t
  WHERE t.name IN (
    '日本循環経済・グリーン調達',
    'EU包装・プラスチック規制',
    'ESG・GHG報告規制',
    '水産・食品サプライチェーン規制',
    '海洋・水資源・淡水化',
    '深海・海洋資源開発'
  )

  UNION ALL

  -- materials: 素材・ナノマテリアル
  SELECT t.id, 'materials'
  FROM atlas_themes t
  WHERE t.name IN (
    'レアアース・戦略素材供給リスク',
    '半導体製造プロセス・先端パッケージング',
    '半導体輸出管理・対中規制',
    '医薬品サプライチェーン・国産化',
    '日本経済安全保障・資源外交'
  )

  UNION ALL

  -- life: ライフサイエンス・医療
  SELECT t.id, 'life'
  FROM atlas_themes t
  WHERE t.name IN (
    'AI創薬・医薬品開発',
    'メンタルヘルス・精神疾患治療',
    '再生医療・遺伝子治療',
    '医療データ利活用・デジタルヘルス',
    '医療人材需給・看護教育',
    '介護・福祉人材と制度改革'
  )

  UNION ALL

  -- robo: ロボ・農・モビリティ
  SELECT t.id, 'robo'
  FROM atlas_themes t
  WHERE t.name IN (
    'ドローン・空の物流',
    '建設業省人化・DX',
    '公共・行政デジタル基盤',
    'インフラ老朽化・改修投資',
    '宇宙・衛星ビジネス',
    '大学発スタートアップ・産学連携'
  )
),

signal_lane AS (
  SELECT s.id AS signal_id,
         s.submitted_at,
         s.source_type,
         ltm.lane
  FROM atlas_signals s
  JOIN atlas_story_themes ast ON ast.story_id = s.story_id
  JOIN lane_theme_map ltm ON ltm.theme_id = ast.theme_id
  WHERE s.submitted_at IS NOT NULL
),

monthly AS (
  SELECT lane,
         DATE_TRUNC('month', submitted_at)::date AS observed_at,
         COUNT(DISTINCT signal_id) AS raw_signal_count,
         COUNT(DISTINCT signal_id) FILTER (WHERE source_type = 'policy') AS policy_count,
         COUNT(DISTINCT signal_id) FILTER (WHERE source_type <> 'policy' OR source_type IS NULL) AS other_count
  FROM signal_lane
  GROUP BY lane, DATE_TRUNC('month', submitted_at)
)

INSERT INTO macro_index_log (
  lane, observed_at,
  index_value, policy_density, budget_amount, investment_amount,
  policy_mention_count, raw_signal_count
)
SELECT
  lane,
  observed_at,
  -- 一次近似: 全シグナル / 50 を 0-1 に正規化（マクロ指数の仮値）
  LEAST(1.0, raw_signal_count::numeric / 50.0) AS index_value,
  -- 政策密度: policy signals / 30 を 0-1 に正規化
  LEAST(1.0, policy_count::numeric / 30.0) AS policy_density,
  NULL AS budget_amount,           -- Phase 6 で公募DBから別途
  NULL AS investment_amount,       -- Phase 6 で投資DBから別途
  -- 言及数（policyではない signals = ニュース/業界言及の代理指標）
  other_count::numeric,
  raw_signal_count::int
FROM monthly
ON CONFLICT (lane, observed_at) DO UPDATE SET
  index_value = EXCLUDED.index_value,
  policy_density = EXCLUDED.policy_density,
  policy_mention_count = EXCLUDED.policy_mention_count,
  raw_signal_count = EXCLUDED.raw_signal_count,
  computed_at = NOW();

-- 確認
SELECT lane, observed_at, raw_signal_count, policy_density, index_value
FROM macro_index_log
ORDER BY lane, observed_at;
