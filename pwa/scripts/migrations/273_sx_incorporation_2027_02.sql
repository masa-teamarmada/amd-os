-- SX(p21)の会社設立予定を2027年2月へ訂正する。
-- 設立前PJ活動の開始月やSeed計上月とは分離し、法人の存在開始だけを更新する。

UPDATE project_ventures
SET founded_at = DATE '2027-02-01',
    short_description = replace(replace(short_description, '2027-04', '2027-02'), '2027年4月', '2027年2月'),
    long_description = replace(replace(long_description, '2027-04', '2027-02'), '2027年4月', '2027年2月'),
    narrative_text = replace(replace(narrative_text, '2027-04', '2027-02'), '2027年4月', '2027年2月'),
    updated_at = now()
WHERE project_id = 'p21'
  AND founded_at IS DISTINCT FROM DATE '2027-02-01';

WITH target AS (
  SELECT
    plans.id,
    plans.revision,
    event_position.ordinality - 1 AS event_index
  FROM project_capital_plans AS plans
  CROSS JOIN LATERAL jsonb_array_elements(plans.document_json -> 'events')
    WITH ORDINALITY AS event_position(event_json, ordinality)
  WHERE plans.project_id = 'p21'
    AND plans.status = 'active'
    AND event_position.event_json ->> 'id' = 'sx-incorporation'
    AND event_position.event_json ->> 'date' IS DISTINCT FROM '2027-02-01'
)
UPDATE project_capital_plans AS plans
SET document_json = jsonb_set(
      plans.document_json,
      ARRAY['events', target.event_index::text, 'date'],
      to_jsonb('2027-02-01'::text),
      false
    ),
    revision = plans.revision + 1,
    updated_at = now()
FROM target
WHERE plans.id = target.id
  AND plans.revision = target.revision;
