-- SX weekly-control: the two NewCo prerequisite MS records used to repeat the 12-row illustrative
-- checklist in their copy. Keep the MS records, but replace that seed copy with the agreed
-- high-level conditions. The full legacy-copy match prevents overwriting a later human edit.

UPDATE public.project_management_milestones
SET
  next_deliverable = CASE slug
    WHEN 'business-paid-poc-oral-agreement' THEN '1社の有償PoC口頭合意を確認する'
    WHEN 'funding-investment-oral-agreement' THEN '出資の口頭合意を確認する'
  END,
  max_issue = CASE slug
    WHEN 'business-paid-poc-oral-agreement' THEN '実排液で有償導入検討を進めたいと判断される成果と装置が未整備。相手先・合意内容・確認日・根拠が未確認'
    WHEN 'funding-investment-oral-agreement' THEN '事業計画未完成・DD未着手。出資者・合意内容・確認日・根拠が未確認'
  END,
  completion_criteria = CASE slug
    WHEN 'business-paid-poc-oral-agreement' THEN '1社が費用を負担して導入検討を進めると口頭で合意し、相手先・合意内容・確認日・根拠が記録されている'
    WHEN 'funding-investment-oral-agreement' THEN '出資者が出資に口頭で合意し、出資者・合意内容・確認日・根拠が記録されている'
  END
WHERE project_id = 'p21'
  AND deleted_at IS NULL
  AND (
    (
      slug = 'business-paid-poc-oral-agreement'
      AND next_deliverable LIKE 'NewCo設立の最低条件は1社の有償PoC口頭合意。A.%'
      AND max_issue LIKE '%配下の必須タスク5件は未着手%'
      AND completion_criteria LIKE '配下の必須タスク5件がすべて完了し%'
    )
    OR (
      slug = 'funding-investment-oral-agreement'
      AND next_deliverable LIKE '現時点は事業計画が未完成でDDは未着手。A.%'
      AND max_issue LIKE '%配下の必須タスク7件は未着手%'
      AND completion_criteria LIKE '配下の必須タスク7件がすべて完了し%'
    )
  );
