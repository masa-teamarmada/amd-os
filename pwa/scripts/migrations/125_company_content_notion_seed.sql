-- 125_company_content_notion_seed.sql
--
-- Seed reviewed internal company content from the Notion member list/history
-- sources verified on 2026-06-04. This file intentionally stores no raw Notion
-- body and no Notion file/photo URLs. Members that do not exist in
-- public.members are intentionally skipped.

with notion_members(member_id, display_name, public_title, internal_title, notion_status, joined_on, bio_short, source_confidence, notion_source_id, has_photo) as (
  values
    ('ID001', 'まさ', 'パートナー', 'パートナー', '活動中', date '2023-01-01', '土浦一高、慶応大、NIMS、産総研、ニューガラスフォーラム、京都大、ティエムファクトリを経てチームアルマダ。', 0.95, '13497749-c608-8042-8641-f32cccf79a4e', true),
    ('ID002', 'きよ', 'マネージャー', 'マネージャー', '活動中', date '2018-01-30', 'ティエムファクトリを経て、チームアルマダのバックオフィスとマネジメントを支える。', 0.95, '13497749-c608-80f2-a076-d3e8e18544a3', true),
    ('ID003', 'かる', 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2025-06-05', '東京大、トヨタ自動車、A.T.カーニー、カナリーを経て、ディープテック支援に参画。', 0.95, '20b97749-c608-80b5-9a0d-ca1e7b794127', true),
    ('ID004', 'こう', 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2025-06-06', '東京大、トヨタ自動車、LabBaseを経て、事業開発と研究者支援に参画。', 0.95, '20b97749-c608-8034-9ccb-f327b84ce065', true),
    ('ID005', 'りょー', null, null, null, date '2025-10-01', null, 0.75, '29797749-c608-805a-b863-fb09f1dc289f', false),
    ('ID006', 'りり', null, null, null, date '2024-06-25', null, 0.75, '13497749-c608-8065-9330-ebddb57f2b3f', false),
    ('ID007', 'ちこ', null, null, null, null, null, 0.70, '1c197749-c608-80ec-b271-e6d7b3b1aa29', false),
    ('ID008', 'うめ', null, null, null, null, null, 0.70, '13497749-c608-80df-84ab-fdd23b212921', false),
    ('ID009', 'あび', 'クルー', 'クルー', '活動中', date '2025-04-01', '広告、DXコンサル、飲食、人材系ベンチャーを経て、フリーランスとして活動しながら参画。', 0.95, '1af97749-c608-801e-90f9-c9ddbd5f6a38', true),
    ('ID010', 'らん', null, null, null, date '2024-10-13', null, 0.75, '13497749-c608-8015-b1d5-f701f043612b', false),
    ('ID014', 'ももち', null, null, null, null, null, 0.70, '1d697749-c608-8076-85f2-c1e0c7d44305', false),
    ('ID015', 'はる', null, null, null, date '2025-06-24', null, 0.75, '2a297749-c608-807b-8035-c30caf5dfc91', false),
    ('ID018', 'まゆ', null, null, null, null, null, 0.70, '20697749-c608-807b-acae-c6d6c08a87b5', true),
    ('ID019', 'なめ', null, null, null, null, null, 0.70, '1db97749-c608-80f6-a775-d6d50a24b9cd', false),
    ('ID020', 'あかね', null, null, null, date '2023-01-01', null, 0.75, '13497749-c608-80ed-a0a4-df86f8c98490', false),
    ('ID021', 'いく', null, null, null, date '2025-04-14', null, 0.75, '1c197749-c608-8015-90ae-f24844e0fc65', false),
    ('ID022', 'かな', null, null, null, null, null, 0.70, '13497749-c608-80f8-8e64-e71b5c5d2dd5', false),
    ('ID023', 'まり', null, null, null, date '2024-03-05', null, 0.75, '13497749-c608-803b-83f2-cbae997fe58d', false),
    ('ID025', 'まどか', null, null, null, date '2024-10-03', null, 0.75, '13497749-c608-8084-b3ce-eec99d1e1da7', false),
    ('ID027', 'しろー', null, null, null, date '2025-03-24', '建築設計事務所、tiem、ALMOWを経て参画。', 0.75, '1c197749-c608-8067-82d9-d7909e2731ae', false),
    ('ID029', 'あき', null, null, '活動中', null, null, 0.75, '34f97749-c608-80f1-919d-cbbda05aadf0', false)
),
existing_notion_members as (
  select nm.*
  from notion_members nm
  join public.members m on m.member_id = nm.member_id
)
insert into public.member_profiles (
  member_id,
  display_name,
  public_title,
  internal_title,
  notion_status,
  joined_on,
  bio_short,
  visibility,
  status,
  source_confidence,
  source_kind,
  source_ref,
  tags,
  notion_source_id,
  notion_last_synced_at,
  reviewed_by,
  reviewed_at,
  updated_by
)
select
  member_id,
  display_name,
  public_title,
  internal_title,
  notion_status,
  joined_on,
  bio_short,
  'internal',
  'approved_internal',
  source_confidence,
  'notion',
  'notion:team-armada-member-list',
  array_remove(array['notion_member_list', case when notion_status is not null then 'notion_status:' || notion_status end], null),
  notion_source_id,
  timestamptz '2026-06-04 00:00:00+09',
  'codex_notion_company_seed',
  timestamptz '2026-06-04 00:00:00+09',
  'codex_notion_company_seed'
from existing_notion_members
on conflict (member_id) do update set
  display_name = excluded.display_name,
  public_title = excluded.public_title,
  internal_title = excluded.internal_title,
  notion_status = excluded.notion_status,
  joined_on = excluded.joined_on,
  bio_short = excluded.bio_short,
  visibility = excluded.visibility,
  status = excluded.status,
  source_confidence = excluded.source_confidence,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  tags = excluded.tags,
  notion_source_id = excluded.notion_source_id,
  notion_last_synced_at = excluded.notion_last_synced_at,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_by = excluded.updated_by,
  updated_at = now();

with photo_members as (
  select *
  from (
    values
      ('ID001', 'まさ', '13497749-c608-8042-8641-f32cccf79a4e'),
      ('ID002', 'きよ', '13497749-c608-80f2-a076-d3e8e18544a3'),
      ('ID003', 'かる', '20b97749-c608-80b5-9a0d-ca1e7b794127'),
      ('ID004', 'こう', '20b97749-c608-8034-9ccb-f327b84ce065'),
      ('ID009', 'あび', '1af97749-c608-801e-90f9-c9ddbd5f6a38'),
      ('ID018', 'まゆ', '20697749-c608-807b-acae-c6d6c08a87b5')
  ) as v(member_id, display_name, notion_source_id)
  where exists (select 1 from public.members m where m.member_id = v.member_id)
)
insert into public.media_assets (
  title,
  asset_kind,
  member_ids,
  tags,
  visibility,
  status,
  source_confidence,
  usage_permission,
  consent_status,
  source_kind,
  source_ref,
  notion_source_id,
  notion_last_synced_at,
  updated_by
)
select
  'Member photo review: ' || display_name,
  'photo',
  array[member_id],
  array['notion_member_photo', 'needs_storage_import'],
  'admin_only',
  'needs_review',
  0.80,
  'unknown',
  'unknown',
  'notion',
  'notion:team-armada-member-list:photo-present',
  notion_source_id || ':photo',
  timestamptz '2026-06-04 00:00:00+09',
  'codex_notion_company_seed'
from photo_members
on conflict (notion_source_id) do update set
  title = excluded.title,
  member_ids = excluded.member_ids,
  tags = excluded.tags,
  visibility = excluded.visibility,
  status = excluded.status,
  source_confidence = excluded.source_confidence,
  usage_permission = excluded.usage_permission,
  consent_status = excluded.consent_status,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  notion_last_synced_at = excluded.notion_last_synced_at,
  updated_by = excluded.updated_by,
  updated_at = now();

update public.member_profiles mp
set
  photo_asset_id = ma.asset_id,
  updated_by = 'codex_notion_company_seed',
  updated_at = now()
from public.media_assets ma
where ma.notion_source_id = mp.notion_source_id || ':photo'
  and mp.member_id = any(ma.member_ids);

insert into public.company_history_events (
  occurred_on,
  title,
  summary,
  event_type,
  project_id,
  importance,
  visibility,
  status,
  source_confidence,
  tags,
  source_kind,
  source_ref,
  notion_source_id,
  notion_last_synced_at,
  reviewed_by,
  reviewed_at,
  updated_by
)
values
  (date '2022-02-05', 'アルマダデザイン設立', null, 'company', null, 'milestone', 'internal', 'approved_internal', 0.95, array['notion_history', 'AMD'], 'notion', 'notion:team-armada-history', '285d5bc6-ec33-484c-80c9-c8800982ec0e', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed'),
  (date '2023-01-01', '株式会社チームアルマダに商号変更、代表を山地に変更、本店を茨城県つくば市に変更', null, 'legal', null, 'milestone', 'internal', 'approved_internal', 0.95, array['notion_history', 'AMD'], 'notion', 'notion:team-armada-history', '79437a64-57aa-4b17-a53e-82b6088fbba3', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed'),
  (date '2024-08-08', 'SIPサブ課題A1落札', null, 'award', null, 'high', 'internal', 'approved_internal', 0.95, array['notion_history', 'AMD'], 'notion', 'notion:team-armada-history', '3b63608a-a387-4b81-b463-e2649aa037f6', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed', timestamptz '2026-06-04 00:00:00+09', 'codex_notion_company_seed')
on conflict (notion_source_id) do update set
  occurred_on = excluded.occurred_on,
  title = excluded.title,
  summary = excluded.summary,
  event_type = excluded.event_type,
  project_id = excluded.project_id,
  importance = excluded.importance,
  visibility = excluded.visibility,
  status = excluded.status,
  source_confidence = excluded.source_confidence,
  tags = excluded.tags,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  notion_last_synced_at = excluded.notion_last_synced_at,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_by = excluded.updated_by,
  updated_at = now();
