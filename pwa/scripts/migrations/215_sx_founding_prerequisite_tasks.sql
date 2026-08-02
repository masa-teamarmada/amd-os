-- SX weekly-control: required-task chains under the two founding-prerequisite
-- milestones (paid PoC oral agreement / investment oral agreement). These tasks
-- make the evidence-chain that must complete before the milestone can be
-- treated as achieved. No dates, owners, or performance values are asserted —
-- only the required step, its order, and what "done" looks like for that step.
-- Idempotent: re-running does nothing once a task with the same
-- milestone_id + title already exists. last_verified_at is left out of the
-- INSERT column list so it takes the table's own DEFAULT CURRENT_DATE instead
-- of a manually asserted value (the schema's last_verified_at is NOT NULL, so
-- a literal NULL is not possible here).

WITH target_milestones AS (
  SELECT id, slug
  FROM public.project_management_milestones
  WHERE project_id = 'p21'
    AND slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')
), seed(milestone_slug, title, description, completion_criteria, sort_order) AS (
  VALUES
    (
      'business-paid-poc-oral-agreement',
      '1社が対価を払う成果基準を定義する',
      '有償PoCの相手先候補1社と、対価を払う条件になる成果基準（何が達成されれば有償化するか）を定義する。相手先・数値は未確認。',
      '対象1社の名称と、対価を払う条件になる具体的な成果基準（数値条件を含む）が記録されている',
      1
    ),
    (
      'business-paid-poc-oral-agreement',
      'ラボで成果基準を再現性付きで達成する',
      '定義した成果基準を、ラボ内で再現性を示せる形で達成する。',
      'ラボ内で成果基準を複数回再現できたことを示す実験記録・データが記録されている',
      2
    ),
    (
      'business-paid-poc-oral-agreement',
      '実排液でのPoC用装置を完成させる',
      '実排液の処理、必要な連続運転、安全管理、測定ができるPoC用装置を完成させる。',
      '実排液の処理、必要な連続運転、安全管理、測定ができる状態でPoC用装置が完成し、稼働確認記録がある',
      3
    ),
    (
      'business-paid-poc-oral-agreement',
      '1社へ結果と装置を提示し導入検討条件を確認する',
      '対象の1社へ達成結果と装置を提示し、導入検討に進むための条件を確認する。',
      '対象1社へ提示した結果・装置の記録と、先方から確認できた導入検討の条件が記録されている',
      4
    ),
    (
      'business-paid-poc-oral-agreement',
      '費用負担での導入検討の口頭合意と証跡を記録する',
      '相手先が費用を負担して導入検討を進めることの口頭合意を取り、証跡（先方・合意内容・確認日・根拠）を記録する。この工程自体の完了条件と同じ4項目を満たすタスク。',
      '先方・合意内容・確認日・根拠を1行ずつ記録した口頭合意の証跡がある',
      5
    ),
    (
      'funding-investment-oral-agreement',
      '事業計画を完成させる',
      '出資判断の土台となる事業計画を完成させる。現時点は未完成。',
      '事業計画書が完成し、社内で確認済みの状態になっている',
      1
    ),
    (
      'funding-investment-oral-agreement',
      '資本政策・資金使途・必要調達額を整合させる',
      '資本政策、資金使途、必要調達額の間で矛盾がない状態に整える。',
      '資本政策・資金使途・必要調達額の3点に矛盾がないことが確認され、記録されている',
      2
    ),
    (
      'funding-investment-oral-agreement',
      '投資家向け資料とDD資料を整備する',
      '投資家への提示資料と、デューデリジェンス（DD）で求められる資料一式を整備する。',
      '投資家向け提示資料とDDで求められる資料一式が整備されている',
      3
    ),
    (
      'funding-investment-oral-agreement',
      '投資家からDD開始の合意を得る',
      '投資家からDDを開始することの合意を得る。現時点はDD未着手。',
      '投資家からDDを開始することの合意が記録されている',
      4
    ),
    (
      'funding-investment-oral-agreement',
      'DDの論点を解消する',
      'DDで挙がった論点・懸念を解消する。',
      'DDで挙がった論点・懸念点への回答・対応が記録され、未解消論点がない',
      5
    ),
    (
      'funding-investment-oral-agreement',
      '出資額・評価額・時期・主要条件を合意する',
      '出資額、評価額、実行時期、主要条件について投資家と合意する。金額・時期は未確認。',
      '出資額・評価額・実行時期・主要条件について投資家との合意内容が記録されている',
      6
    ),
    (
      'funding-investment-oral-agreement',
      '出資の口頭合意と証跡を記録する',
      '出資を進めることの口頭合意を取り、証跡（投資家・合意内容・確認日・根拠）を記録する。この工程自体の完了条件と同じ4項目を満たすタスク。',
      '投資家・合意内容・確認日・根拠を1行ずつ記録した口頭合意の証跡がある',
      7
    )
)
INSERT INTO public.project_management_tasks (
  project_id, milestone_id, parent_task_id, track, title, description, status,
  planned_start, planned_end, forecast_end, actual_end, progress_pct,
  date_certainty, owner_member_id, owner_label, completion_criteria,
  forecast_change_reason, sort_order, confidence,
  source_kind, source_ref, created_by, updated_by
)
SELECT
  'p21', target_milestones.id, NULL, NULL, seed.title, seed.description,
  'unassessed', NULL, NULL, NULL, NULL, 0, 'provisional', NULL, '担当未確認',
  seed.completion_criteria,
  NULL, seed.sort_order, 'unknown', 'manual',
  '2026-08-02 週次管制 設立前提レーン要件', 'manual', 'manual'
FROM seed
JOIN target_milestones ON target_milestones.slug = seed.milestone_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_tasks existing
  WHERE existing.milestone_id = target_milestones.id
    AND existing.title = seed.title
    AND existing.deleted_at IS NULL
);

-- Sharpen the two milestones' descriptive text to state the actual current-state constraints
-- (NewCo設立の最低条件は1社の有償PoC口頭合意; investment path currently has no completed
-- business plan and no DD in progress) without inventing dates/owners/amounts, and without
-- implying a second counterparty is prohibited. Guarded on the milestone still holding its
-- 210-migration seed text, so a manually edited current value is never overwritten (manual
-- edits from the weekly-control screen stay authoritative).
UPDATE public.project_management_milestones AS m
SET
  next_deliverable = seed.next_deliverable,
  max_issue = seed.max_issue,
  completion_criteria = seed.completion_criteria
FROM (VALUES
  (
    'business-paid-poc-oral-agreement',
    '相手先・合意内容・確認日・根拠を記録する',
    'NewCo設立の最低条件は1社の有償PoC口頭合意。A.成果基準の定義→B.ラボでの再現性ある達成→C.実排液PoC用装置の完成→D.相手先への提示・導入検討条件の確認→E.口頭合意と証跡記録、の順で進める。相手先候補・具体的な性能値・日付は未確認',
    '有償PoCの相手先・合意内容・確認日・根拠が未確認。配下の必須タスク5件は未着手',
    '配下の必須タスク5件がすべて完了し、有償PoCの相手先・合意内容・確認日・根拠が記録されている'
  ),
  (
    'funding-investment-oral-agreement',
    '投資家・合意内容・確認日・根拠を記録する',
    '現時点は事業計画が未完成でDDは未着手。A.事業計画完成→B.資本政策・資金使途・必要調達額の整合→C.投資家向け資料とDD資料の整備→D.投資家からDD開始合意→E.DD論点解消→F.出資額・評価額・時期・主要条件の合意→G.口頭合意と証跡記録、の順で進める。投資家候補・金額・時期は未確認',
    '事業計画未完成・DD未着手。出資者・合意内容・確認日・根拠が未確認。配下の必須タスク7件は未着手',
    '配下の必須タスク7件がすべて完了し、出資者・合意内容・確認日・根拠が記録されている'
  )
) AS seed(slug, expected_next_deliverable, next_deliverable, max_issue, completion_criteria)
WHERE m.project_id = 'p21'
  AND m.slug = seed.slug
  AND m.next_deliverable = seed.expected_next_deliverable;
