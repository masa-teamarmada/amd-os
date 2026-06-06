-- 131_company_history_non_notion_events.sql
--
-- Append-only company history events from AMD/Team ARMADA canonical knowledge
-- docs that are not present in the Notion history import. This migration stores
-- only short structured summaries and source file refs; it does not touch
-- member_profiles or media_assets.

with proposed_events(
  event_id,
  occurred_on,
  title,
  summary,
  event_type,
  project_id,
  member_ids,
  importance,
  tags,
  source_kind,
  source_confidence,
  source_ref
) as (
  values
    (
      'c4c117a8-c8e8-4d22-8b7d-89d43a5e9f20'::uuid,
      date '2026-05-20',
      'スタパイベント「イノベーションの最前線 #25」開催',
      'つくばスタートアップパークで開催された「イノベーションの最前線 #25」向けに、Venture Mapのデモ設計を確定した。',
      'media',
      null,
      array[]::text[],
      'high',
      array['knowledge_history', 'stapa', 'venture_map', 'event_held', 'verified_2026_06_06'],
      'manual',
      0.90,
      'pwa/design/venture_map_demo.md#2026-05-20'
    ),
    (
      '12b50985-c1c7-4e13-b0e8-42d68ef8e0e3'::uuid,
      date '2026-05-01',
      'KUTEエコシステム構築PJ稼働開始',
      '工学院大学の大学発SUエコシステム構築PJとして、5月から規程策定、シーズ掘り起こし、自治体ファンド形成検討が稼働した。',
      'project',
      'p25',
      array[]::text[],
      'high',
      array['knowledge_history', 'partner_institutions', 'KUTE', 'institution_ecosystem', 'verified_2026_06_06'],
      'manual',
      0.90,
      '/Users/masa/projects/knowledge/partner_institutions.md#kute-2026-05'
    ),
    (
      'e31620cc-e6cb-4f81-b44b-25cf6a307d4c'::uuid,
      date '2026-04-01',
      'あきJOIN',
      'あき（ID029）がTeam ARMADAへJOINした。',
      'people',
      null,
      array['ID029']::text[],
      'medium',
      array['notion_member_list', 'member_join', 'verified_2026_06_06'],
      'manual',
      0.90,
      'user:2026-06-06#aki-join-date; pwa/scripts/migrations/127_company_content_notion_full_member_rows.sql#ID029'
    )
)
insert into public.company_history_events (
  event_id,
  occurred_on,
  title,
  summary,
  event_type,
  project_id,
  member_ids,
  importance,
  visibility,
  status,
  source_confidence,
  tags,
  source_kind,
  source_ref,
  reviewed_by,
  reviewed_at,
  updated_by
)
select
  event_id,
  occurred_on,
  title,
  summary,
  event_type,
  project_id,
  member_ids,
  importance,
  'internal',
  'approved_internal',
  source_confidence,
  tags,
  source_kind,
  source_ref,
  'codex_company_history_non_notion_events',
  timestamptz '2026-06-06 00:00:00+09',
  'codex_company_history_non_notion_events'
from proposed_events p
where not exists (
  select 1
  from public.company_history_events existing
  where existing.event_id <> p.event_id
    and existing.occurred_on is not distinct from p.occurred_on
    and existing.title = p.title
)
on conflict (event_id) do update set
  occurred_on = excluded.occurred_on,
  title = excluded.title,
  summary = excluded.summary,
  event_type = excluded.event_type,
  project_id = excluded.project_id,
  member_ids = excluded.member_ids,
  importance = excluded.importance,
  visibility = excluded.visibility,
  status = excluded.status,
  source_confidence = excluded.source_confidence,
  tags = excluded.tags,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_by = excluded.updated_by,
  updated_at = now();
