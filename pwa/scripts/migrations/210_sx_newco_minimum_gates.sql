-- SX weekly-control: explicit minimum gates before the NewCo founding decision.
-- These are intentionally unassessed and undated. The user supplied the gate
-- definitions, but no agreement fact, owner, target date, or evidence was asserted.

WITH objective AS (
  SELECT id
  FROM public.project_management_objectives
  WHERE project_id = 'p21' AND slug = 'sx-2027-founding'
), outcomes AS (
  SELECT id, slug
  FROM public.project_management_outcomes
  WHERE project_id = 'p21' AND slug IN ('business-outcome', 'funding-outcome')
)
INSERT INTO public.project_management_milestones (
  project_id, objective_id, outcome_id, slug, track, title, gate, status,
  planned_start, planned_end, forecast_end, actual_end, progress_pct, date_certainty,
  owner_label, next_deliverable, max_issue, completion_criteria, completion_evidence,
  criticality, baseline_plan_version, forecast_change_reason, status_source,
  status_reason, last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT
  'p21', objective.id, outcomes.id, seed.slug, seed.track, seed.title, seed.gate,
  'unassessed', NULL, NULL, NULL, NULL, 0, 'provisional', '担当未確認',
  seed.next_deliverable, seed.max_issue, seed.completion_criteria, NULL,
  'critical', '2026-08-01-manual-gate', NULL, 'manual',
  '必須条件は登録済み。達成事実・担当・期限・証跡は未確認', DATE '2026-08-01',
  'unknown', 'manual', '2026-08-01 週次管制要件', seed.sort_order
FROM objective
JOIN (VALUES
  ('business-paid-poc-oral-agreement', 'business_development', '有償PoCの口頭合意を確認する', '有償PoCの口頭合意', '相手先・合意内容・確認日・根拠を記録する', '相手先・合意内容・確認日・根拠が未確認', '有償PoCの相手先・合意内容・確認日・根拠が記録されている', 'business-outcome', 10),
  ('funding-investment-oral-agreement', 'funding', '出資の口頭合意を確認する', '出資の口頭合意', '投資家・合意内容・確認日・根拠を記録する', '投資家・合意内容・確認日・根拠が未確認', '出資者・合意内容・確認日・根拠が記録されている', 'funding-outcome', 11)
) AS seed(slug, track, title, gate, next_deliverable, max_issue, completion_criteria, outcome_slug, sort_order)
  ON true
JOIN outcomes ON outcomes.slug = seed.outcome_slug
ON CONFLICT (project_id, slug) DO NOTHING;

INSERT INTO public.project_management_milestone_dependencies (
  project_id, predecessor_milestone_id, successor_milestone_id,
  dependency_type, required, lag_days, note, created_by
)
SELECT
  'p21', predecessor.id, successor.id, 'finish_to_start', true, 0,
  CASE predecessor.slug
    WHEN 'business-paid-poc-oral-agreement' THEN '有償PoCの口頭合意を確認してからNewCo設立判断へ進む'
    ELSE '出資の口頭合意を確認してからNewCo設立判断へ進む'
  END,
  'manual'
FROM public.project_management_milestones predecessor
JOIN public.project_management_milestones successor
  ON successor.project_id = 'p21' AND successor.slug = 'org-founding-gate'
WHERE predecessor.project_id = 'p21'
  AND predecessor.slug IN ('business-paid-poc-oral-agreement', 'funding-investment-oral-agreement')
ON CONFLICT (project_id, predecessor_milestone_id, successor_milestone_id, dependency_type) DO NOTHING;
