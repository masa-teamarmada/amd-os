-- 082_related_members_amd_alias_canonical.sql
--
-- まさ指摘 (2026-05-22 #12):
-- 関連メンバーで AMD メンバーの code_name (= まさ) と本名 (= 山地正洋) が別人として残る。
--
-- 原因:
--  - migration 075 は AMD 本名重複の invalid 化対象を status='active' に限定していた。
--  - その後 migration 076 が university 行を tentative に戻したため、
--    「山地正洋」などの AMD 本名行が表示対象に復帰した。
--
-- 対応:
--  - members.member_name から alias (本名 / 空白除去本名 / 姓) を動的生成する。
--  - active/tentative の alias 行を code_name 行へ upsert してから、alias 側を invalid 化する。

WITH member_aliases AS (
  SELECT
    member_id,
    code_name,
    NULLIF(BTRIM(member_name), '') AS full_name
  FROM members
  WHERE status = 'active'
    AND NULLIF(BTRIM(code_name), '') IS NOT NULL
    AND code_name NOT IN ('つくよみ', 'info')
),
alias_rows AS (
  SELECT member_id, code_name, full_name AS alias
  FROM member_aliases
  WHERE full_name IS NOT NULL
  UNION
  SELECT member_id, code_name, regexp_replace(full_name, '\s+', '', 'g') AS alias
  FROM member_aliases
  WHERE full_name IS NOT NULL
  UNION
  SELECT member_id, code_name, split_part(full_name, ' ', 1) AS alias
  FROM member_aliases
  WHERE full_name IS NOT NULL AND split_part(full_name, ' ', 1) <> code_name
),
dupes AS (
  SELECT
    pfm.*,
    ar.code_name
  FROM project_founding_members pfm
  JOIN alias_rows ar
    ON pfm.person_name = ar.alias
   AND pfm.person_name <> ar.code_name
  WHERE pfm.status IN ('active', 'tentative')
),
upsert_canonical AS (
  INSERT INTO project_founding_members (
    project_id,
    person_name,
    affiliation,
    role,
    role_label_jp,
    category,
    responsibility,
    contribution,
    notes,
    status,
    extracted_by,
    source_documents,
    first_observed_at,
    last_observed_at,
    created_at,
    updated_at
  )
  SELECT
    d.project_id,
    d.code_name,
    'AMD',
    'amd_support',
    COALESCE(NULLIF(d.role_label_jp, ''), 'AMD サポート'),
    'amd',
    d.responsibility,
    d.contribution,
    COALESCE(d.notes, '') || ' / [2026-05-22 #12] AMD本名aliasからcode_nameへ集約',
    CASE WHEN d.status = 'active' THEN 'active' ELSE 'tentative' END,
    d.extracted_by,
    d.source_documents,
    d.first_observed_at,
    d.last_observed_at,
    COALESCE(d.created_at, now()),
    now()
  FROM dupes d
  ON CONFLICT (project_id, person_name) DO UPDATE
     SET affiliation = 'AMD',
         role = 'amd_support',
         role_label_jp = COALESCE(project_founding_members.role_label_jp, EXCLUDED.role_label_jp),
         category = 'amd',
         responsibility = COALESCE(project_founding_members.responsibility, EXCLUDED.responsibility),
         contribution = COALESCE(project_founding_members.contribution, EXCLUDED.contribution),
         notes = COALESCE(project_founding_members.notes, '') || ' / [2026-05-22 #12] AMD本名alias行をcode_name側へ集約',
         status = CASE
           WHEN project_founding_members.status = 'active' OR EXCLUDED.status = 'active' THEN 'active'
           ELSE 'tentative'
         END,
         source_documents = CASE
           WHEN jsonb_typeof(project_founding_members.source_documents) = 'array'
            AND jsonb_typeof(EXCLUDED.source_documents) = 'array'
           THEN project_founding_members.source_documents || EXCLUDED.source_documents
           ELSE COALESCE(project_founding_members.source_documents, EXCLUDED.source_documents, '[]'::jsonb)
         END,
         last_observed_at = COALESCE(project_founding_members.last_observed_at, EXCLUDED.last_observed_at),
         updated_at = now()
  RETURNING project_id, person_name
)
UPDATE project_founding_members pfm
   SET status = 'invalid',
       notes = COALESCE(pfm.notes, '') || ' / [2026-05-22 #12] AMD code_name と同一人物の本名/姓aliasのため invalid',
       updated_at = now()
  FROM dupes d
 WHERE pfm.id = d.id;
