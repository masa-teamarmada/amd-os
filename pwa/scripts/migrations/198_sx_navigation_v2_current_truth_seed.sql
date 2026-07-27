-- 成立条件ナビゲーション v2 再設計にあわせた current-truth 追加seed。
-- 既存 project_management_* テーブルへの additive insert のみ。DDL変更なし。
-- 全INSERTはON CONFLICT/NOT EXISTSで二重適用安全。
--
-- 含むもの:
--   1. マニホールド型除外の履歴イベント (reactor-configuration issueへのevidence, kind='observation')
--      根拠: /Users/masa/projects/knowledge/sx.md 「2026-06 リアクター現状更新 (まさ確認 2026-06-24)」
--   2. Dy(ジスプロシウム)回収の論点・仮説・根拠・検証・技術試験4段階
--      根拠: /Users/masa/projects/AMD/SX/SX_製品形状と重金属回収仮説_20260710.md
--            /Users/masa/projects/AMD/SX/SX_Dy工程別濃度と事業性試算_20260710.md
--      事実境界: 確認できているのは「吸着できる可能性が見えた」段階のみ。
--      実排液共存系・酸脱離・1/3/5サイクルは計画(planned)として登録し、実施済みや合格として捏造しない。

-- ---------------------------------------------------------------------------
-- 1. マニホールド型除外の履歴イベント
-- ---------------------------------------------------------------------------
INSERT INTO public.project_management_evidence (
  project_id, issue_id, hypothesis_id, evidence_kind, summary, observed_on, source_label, confidence, last_verified_at, created_by
)
SELECT 'p21', i.id, NULL, 'observation',
  '6/24確認: マニホールド型（村上氏考案・180kg）を現行ラインから除外',
  DATE '2026-06-24', 'SX現状 2026-06-24 まさ確認', 'high', DATE '2026-06-24', 'current_truth'
FROM public.project_management_issues i
WHERE i.project_id = 'p21' AND i.slug = 'reactor-configuration'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_evidence existing
    WHERE existing.project_id = 'p21' AND existing.issue_id = i.id AND existing.evidence_kind = 'observation'
      AND existing.summary = '6/24確認: マニホールド型（村上氏考案・180kg）を現行ラインから除外'
  );

-- ---------------------------------------------------------------------------
-- 2. Dy回収の論点
-- ---------------------------------------------------------------------------
INSERT INTO public.project_management_issues (
  project_id, milestone_id, outcome_id, slug, track, title, knowledge_type, status,
  owner_label, due_date, last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'p21', m.id, m.outcome_id, 'dy-recovery-potential', 'technology_development',
  'ジスプロシウム(Dy)を含む工程液の回収は事業化候補になりうるか', 'hypothesis', 'open',
  '研究側担当未確認', NULL, DATE '2026-07-10', 'low', 'current_truth',
  'SX_Dy工程別濃度と事業性試算_20260710', 35
FROM public.project_management_milestones m
WHERE m.project_id = 'p21' AND m.slug = 'tech-reactor-recheck'
ON CONFLICT (project_id, slug) DO NOTHING;

-- 既存の一般seedと同じ「milestone_id IS NOT NULL の issue を全部リンクする」パターンを再実行し、
-- 新規追加した dy-recovery-potential も milestone_issue_links へ additive に反映する。
INSERT INTO public.project_management_milestone_issue_links (project_id, milestone_id, issue_id)
SELECT i.project_id, i.milestone_id, i.id
FROM public.project_management_issues i
WHERE i.project_id = 'p21' AND i.milestone_id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH dy_statement(slug, statement) AS (VALUES
  ('dy-recovery-potential', '磁石スクラップ・研削くずの酸浸出液など、Dyが数百ppm以上に濃縮された工程液を狙えば、回収カートリッジ事業として成立しうる')
)
INSERT INTO public.project_management_hypotheses (
  project_id, issue_id, statement, status, owner_label, due_date, confidence, last_verified_at, source_kind, source_ref
)
SELECT 'p21', i.id, dy_statement.statement, 'open', i.owner_label, i.due_date, i.confidence, i.last_verified_at, i.source_kind, i.source_ref
FROM dy_statement
JOIN public.project_management_issues i ON i.project_id = 'p21' AND i.slug = dy_statement.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_hypotheses existing
  WHERE existing.project_id = 'p21' AND existing.issue_id = i.id AND existing.statement = dy_statement.statement
);

WITH dy_evidence(kind, summary) AS (VALUES
  ('supporting', '初期速報でDyを吸着できる可能性が見えた（単一金属溶液での速報段階）'),
  ('missing', '実排液での共存イオン耐性、酸脱離による回収率、1/3/5サイクル後の残存性能は未評価')
)
INSERT INTO public.project_management_evidence (
  project_id, issue_id, hypothesis_id, evidence_kind, summary, observed_on, source_label, confidence, last_verified_at, created_by
)
SELECT 'p21', i.id, h.id, dy_evidence.kind, dy_evidence.summary, DATE '2026-07-10',
  'SX_Dy工程別濃度と事業性試算_20260710', i.confidence, DATE '2026-07-10', 'current_truth'
FROM dy_evidence
JOIN public.project_management_issues i ON i.project_id = 'p21' AND i.slug = 'dy-recovery-potential'
JOIN public.project_management_hypotheses h ON h.project_id = i.project_id AND h.issue_id = i.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_evidence existing
  WHERE existing.project_id = 'p21' AND existing.issue_id = i.id
    AND existing.evidence_kind = dy_evidence.kind AND existing.summary = dy_evidence.summary
);

INSERT INTO public.project_management_validation_runs (
  project_id, hypothesis_id, validation_kind, planned_on, due_date, status, owner_label,
  method, confidence, source_kind, source_ref
)
SELECT 'p21', h.id, '吸着スクリーニング（単一金属溶液）', NULL, NULL, 'running', i.owner_label,
  'Dy単一金属溶液での吸着量・速度を測定し、実排液系での検証へ進めるかを判断する',
  'low', 'current_truth', i.source_ref
FROM public.project_management_hypotheses h
JOIN public.project_management_issues i ON i.id = h.issue_id
WHERE i.project_id = 'p21' AND i.slug = 'dy-recovery-potential'
  AND NOT EXISTS (
    SELECT 1 FROM public.project_management_validation_runs existing
    WHERE existing.project_id = 'p21' AND existing.hypothesis_id = h.id
      AND existing.validation_kind = '吸着スクリーニング（単一金属溶液）'
  );

-- ---------------------------------------------------------------------------
-- 3. Dy回収の技術試験4段階 (既存「回収の確認」= tech-recovery-test の子として
--    test_slug 'tech-recovery-dy-*' 命名規約でUIから紐づける。DBに親子列は追加しない)
-- ---------------------------------------------------------------------------
INSERT INTO public.project_management_technical_tests (
  project_id, milestone_id, outcome_id, test_slug, test_name, test_condition, target, actual,
  unit, repetition, sample, trl_criterion, evidence, status, measured_on, owner_label,
  confidence, source_kind, source_ref
)
SELECT 'p21', m.id, m.outcome_id, x.test_slug, x.test_name, x.test_condition, x.target, x.actual,
  x.unit, x.repetition, NULL, x.trl_criterion, x.evidence, x.status, NULL, '研究側担当未確認',
  'low', 'current_truth', 'SX_Dy工程別濃度と事業性試算_20260710'
FROM public.project_management_milestones m
CROSS JOIN (VALUES
  ('tech-recovery-dy-adsorption-screening'::text, '吸着可能性の速報確認（Dy）'::text, '単一金属溶液でのDy吸着スクリーニング'::text, NULL::text, '初期速報で吸着の可能性を確認（本試験は未完了）'::text, '%'::text, NULL::int4, '希土類濃縮液としての回収カートリッジ化に進めるか判断する速報値'::text, '吸着できる可能性が見えた段階。実排液・酸脱離・繰り返し利用は未評価'::text, 'running'::text),
  ('tech-recovery-dy-real-effluent', '実排液共存系での選択性（Dy）', 'Fe/Al/Ca/Mg等の共存イオン下でのDy選択吸着', NULL, NULL, '%', NULL, '実排液でも共存金属に対しDyを選択的に取り込めるかを確認する', NULL, 'planned'),
  ('tech-recovery-dy-acid-desorption', '酸脱離による回収（Dy）', '飽和カートリッジの酸脱離・濃縮液化', NULL, NULL, '%', NULL, '脱離後の希土類濃縮液としての回収率・濃縮倍率を確認する', NULL, 'planned'),
  ('tech-recovery-dy-cycle-durability', '1/3/5サイクル耐久性（Dy）', '同一カートリッジでの1/3/5サイクル繰り返し吸着・脱離', NULL, NULL, '%', NULL, 'サイクルを重ねても吸着容量・原価が崩れないかを確認する', NULL, 'planned')
) AS x(test_slug, test_name, test_condition, target, actual, unit, repetition, trl_criterion, evidence, status)
WHERE m.project_id = 'p21' AND m.slug = 'tech-reactor-recheck'
ON CONFLICT (project_id, test_slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 検証: 再適用してもPASSする件数チェック
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  manifold_count int;
  dy_issue_count int;
  dy_test_count int;
BEGIN
  SELECT count(*) INTO manifold_count FROM public.project_management_evidence e
    JOIN public.project_management_issues i ON i.id = e.issue_id
    WHERE i.project_id = 'p21' AND i.slug = 'reactor-configuration' AND e.evidence_kind = 'observation';
  IF manifold_count < 1 THEN
    RAISE EXCEPTION 'migration 198 verification failed: manifold observation evidence missing';
  END IF;

  SELECT count(*) INTO dy_issue_count FROM public.project_management_issues
    WHERE project_id = 'p21' AND slug = 'dy-recovery-potential' AND deleted_at IS NULL;
  IF dy_issue_count <> 1 THEN
    RAISE EXCEPTION 'migration 198 verification failed: dy-recovery-potential issue missing';
  END IF;

  SELECT count(*) INTO dy_test_count FROM public.project_management_technical_tests
    WHERE project_id = 'p21' AND test_slug LIKE 'tech-recovery-dy-%' AND deleted_at IS NULL;
  IF dy_test_count <> 4 THEN
    RAISE EXCEPTION 'migration 198 verification failed: expected 4 dy technical_tests, found %', dy_test_count;
  END IF;
END $$;
