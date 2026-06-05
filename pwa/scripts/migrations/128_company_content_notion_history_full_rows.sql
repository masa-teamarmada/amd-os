-- 128_company_content_notion_history_full_rows.sql
--
-- Non-destructive completion pass for Team ARMADA / AMD Notion history rows.
-- This migration stores the Notion history database's structured title/date
-- fields only. It intentionally stores no raw Notion page body and no Notion
-- file/photo URLs.

with notion_history(notion_source_id, occurred_on, title, source_confidence) as (
  values
    ('9ff536ce-ec78-4eef-9ee7-f4dbeb025e1f', date '2012-11-02', '京都府京都市にてティエムファクトリ株式会社設立', 0.95),
    ('827e25bc-2bc8-4e07-b1ec-75d31ff3e91f', date '2013-11-01', '堀内史郎 取締役CBO就任', 0.95),
    ('caa372ca-c330-4780-9702-37521b61c06c', date '2014-10-01', '中小企業庁ものづくり助成金採択', 0.95),
    ('5add5b4b-0667-43cf-8c9c-655f45f583c5', date '2014-11-01', 'NEDO SUI（スタートアップイノベーター）採択、7,000万円獲得', 0.95),
    ('aca451ac-6973-4a66-9090-9092008cffec', date '2015-07-01', '會澤守 取締役CTO就任', 0.95),
    ('f5f68d2e-3fa7-4699-adf6-8559a0270b87', date '2015-09-01', 'JST ALCA採択、700万円獲得', 0.95),
    ('b84080d6-37c2-4e91-a9bf-65305ce8dfa2', date '2015-11-01', 'YKK APと製造委託契約締結、2,000万円獲得', 0.95),
    ('2db73190-686b-4692-abef-f419570bb667', date '2016-07-01', 'NEDO戦略的省エネ 採択', 0.95),
    ('93b9c429-6bf1-4b52-a375-a43e99d62c12', date '2016-10-01', '30m角SUFA製作成功', 0.95),
    ('8dfa6cad-ed9b-436c-85e3-51a01fe8e9b1', date '2016-11-01', 'NECAPからシリーズAの一部（50m）調達', 0.95),
    ('9d5497bc-6f44-424e-bcbd-e5d10b1250b9', date '2016-11-01', '田口雄一、清水真 取締役就任', 0.95),
    ('00821881-46c2-46a4-a37b-38943a9cfb96', date '2016-12-01', '堀内史郎 取締役を退任し執行役員に', 0.95),
    ('b7043d9e-5ebb-4db2-a228-7c75a56238d8', date '2017-01-01', '中西和樹 准教授 取締役就任、加藤晴洋様 社外取締役就任', 0.95),
    ('1ffdd33e-b1b2-47a0-90bd-19056e9b3bc8', date '2017-02-01', 'iCAP, TAVからシリーズAの残り（100m）調達', 0.95),
    ('5f97ff0d-20fd-4354-8bc4-ef513d35090e', date '2017-03-01', 'YKK APとJDA締結（10m獲得）', 0.95),
    ('7f759557-4522-4783-83c4-37e6a1f4af1c', date '2017-06-01', 'クリエイションコア京都御車 入居審査通過、御車ラボ（生産拠点）設置', 0.95),
    ('3b2ec1fe-2349-4b29-9138-499b0652e497', date '2017-07-01', 'MGC/HCとJDA締結（2m獲得）', 0.95),
    ('64ff634f-dde3-404b-989b-e8f922e4f6af', date '2017-07-01', 'NECAP, iCAPからシリーズBの一部（100m）をCBとして調達', 0.95),
    ('99f7958a-b470-452b-9e59-f8c2eade36a0', date '2017-09-01', '企業グループものづくり助成金採択（30m獲得）', 0.95),
    ('4a3412d1-c5eb-494b-a2d2-33dd82bdeaa4', date '2017-11-01', 'シリーズBの一部（100m）調達', 0.95),
    ('5f9dcb2f-391b-4294-89d2-774de3531e08', date '2018-01-31', 'シリーズBの残り（400m）調達', 0.95),
    ('9ebaccd9-548e-44d1-a005-b62abeedab7b', date '2018-03-01', 'YKK AP中央研究所と製品開発のためのJDA締結（100m獲得）', 0.95),
    ('6dd72482-18ba-490c-b0c1-0799a81b2374', date '2018-08-01', 'A-step採択（300m獲得）', 0.95),
    ('285d5bc6-ec33-484c-80c9-c8800982ec0e', date '2022-02-05', 'アルマダデザイン設立', 0.95),
    ('0b84b9fe-9554-4412-943a-daed2c9cd5c3', date '2022-07-05', '株式会社ひたちのくにトロピカルファーム設立', 0.95),
    ('3b788c85-607d-4f7d-a848-170e6a43e955', date '2022-10-01', '山地 COO就任', 0.95),
    ('16597749-c608-8037-ba68-c12dbcb86d64', date '2022-12-22', 'RTF/SIFから1.6億調達', 0.95),
    ('79437a64-57aa-4b17-a53e-82b6088fbba3', date '2023-01-01', '株式会社チームアルマダに商号変更、代表を山地に変更、本店を茨城県つくば市に変更', 0.95),
    ('fbc9cb0a-614c-496b-8541-bf59dc6ebca9', date '2023-03-01', 'r3kt契約獲得, CSO就任', 0.95),
    ('a17d18e1-7393-4364-863c-00b0f4da3aad', date '2023-03-14', 'Tamir初顔合わせ', 0.95),
    ('b30efe56-7db4-400c-8b9c-a4c393089054', date '2023-03-22', 'LST星野さん初顔合わせ', 0.95),
    ('75bfffad-889d-432d-b02a-d20cdc440117', date '2023-03-30', 'CTB契約獲得', 0.95),
    ('043d7a67-00a9-4357-9d6d-89ed43752bf1', date '2023-03-31', 'シードラウンドとしてSkyland VenturesとEast Venturesからそれぞれ1,500万円ずつ調達（J-KISS2.0）', 0.95),
    ('b948f065-a045-4882-9996-d6f1e91674f5', date '2023-04-12', 'OPT契約終了', 0.95),
    ('a9cb5f57-c484-40d1-9171-93ff3271a831', date '2023-04-17', 'COOに山地就任', 0.95),
    ('4643d9ae-fac1-4e67-af18-c08f514f350b', date '2023-04-27', 'MC契約獲得', 0.95),
    ('eb1fb63e-1935-471a-a9da-5f4685920817', date '2023-04-28', 'MC初訪問', 0.95),
    ('453015c1-3b46-4211-9949-808f4290f488', date '2023-06-08', '弘前りんご農家＋全農訪問', 0.95),
    ('13297749-c608-80d1-b51a-c463a28cab6e', date '2023-07-06', '初の契約締結、会社設立', 0.95),
    ('93c4d2e2-2b48-4305-97b9-9b1d5f7eb350', date '2023-07-12', '弘前りんご農家訪問', 0.95),
    ('5dd9b753-5b63-46f6-826b-ce10a7b0e59c', date '2023-07-17', '一ノ瀬先生と初顔合わせ', 0.95),
    ('c1a5038c-490c-447f-8dc9-f941371a396d', date '2023-08-25', 'SE契約開始', 0.95),
    ('481fdf10-11eb-4c6d-bc0d-b503dbf07a5c', date '2023-10-31', 'KT 契約終了', 0.95),
    ('2f842e0e-c69b-4629-b7a0-b6e6262046e5', date '2023-11-10', 'まり初顔合わせ', 0.95),
    ('b03d277e-40ad-4c0e-a94b-700915ed05c9', date '2023-12-13', '石垣島初訪問', 0.95),
    ('16597749-c608-803d-b004-fde40239e9c3', date '2023-12-22', 'UMIから1.5億円調達', 0.95),
    ('fca75d5b-609f-4407-88da-6f30cded6bdc', date '2024-02-15', 'NIMS装置選定業務落札', 0.95),
    ('15797749-c608-800f-8021-ed9152cf07b6', date '2024-03-01', 'SIPサブ課題A1との契約締結', 0.95),
    ('12397749-c608-8089-86be-c8049a598155', date '2024-03-05', 'まりJOIN', 0.95),
    ('33dcd754-32db-4688-8142-e1d1dd5b78b2', date '2024-04-30', 'MC契約終了', 0.95),
    ('83682896-8c35-4518-b5dc-84c275cab87e', date '2024-05-31', 'r3kt 契約一旦停止', 0.95),
    ('12397749-c608-8056-a790-e96c4245183e', date '2024-06-24', 'なほJOIN', 0.95),
    ('33544320-0f7f-4521-9b4e-4cb4cbd64964', date '2024-07-22', '協和機電初訪問', 0.95),
    ('a0dc9f20-cdc3-4e59-a14c-73a58c18a526', date '2024-07-31', 'CTB COO退任', 0.95),
    ('3b63608a-a387-4b81-b463-e2649aa037f6', date '2024-08-08', 'SIPサブ課題A1落札', 0.95),
    ('cf9807bd-10c1-4a93-8462-634de1b63d19', date '2024-08-16', 'SIPサブ課題B1落札', 0.95),
    ('40f2847f-238a-4592-b6be-d384582dcbf9', date '2024-09-06', '柏の葉ラボオープン', 0.95),
    ('1bc97749-c608-80e0-ad0a-dbf622a6c77d', date '2024-09-07', 'うめJOIN', 0.95),
    ('37c4bfc8-26fb-4ef6-a376-6f98606744bc', date '2024-09-25', 'Warisとリスキリング事業開始', 0.95),
    ('10697749-c608-8047-9c9a-c697160b8d9c', date '2024-09-26', 'しゅんJOIN', 0.95),
    ('12397749-c608-8063-b98f-dab3ff6ed146', date '2024-10-03', 'まどかJOIN', 0.95),
    ('1bc97749-c608-80be-98a8-e7c628cdd5bf', date '2024-10-13', 'らんJOIN', 0.95),
    ('12397749-c608-8063-95fe-f9ad7476f576', date '2024-10-17', 'りり＆けいJOIN', 0.95),
    ('13297749-c608-800e-a9ef-c40fd294a4e8', date '2024-11-01', 'autoklipと契約締結', 0.95),
    ('1bc97749-c608-8010-af69-f061ebd99e2b', date '2024-12-31', 'autoklip契約終了', 0.95),
    ('1bc97749-c608-809f-88b6-fa746ce41c9b', date '2025-01-01', 'ORLIBと契約締結', 0.95),
    ('1bc97749-c608-8010-b350-cfcf30b82e02', date '2025-03-17', 'みほJOIN', 0.95),
    ('1be97749-c608-8017-824e-d03876000885', date '2025-03-21', 'ちこJOIN', 0.95),
    ('1be97749-c608-808b-9d8c-c60f69455eea', date '2025-03-22', 'まゆJOIN', 0.95),
    ('1bc97749-c608-80d7-b97c-dbc5a33a13e9', date '2025-04-01', 'あびJOIN', 0.95),
    ('20b97749-c608-8003-a920-c71204225c09', date '2025-06-06', 'かる＆こうJOIN', 0.95),
    ('28797749-c608-80e5-8446-c8b6d3b257e2', date '2025-06-24', 'はるJOIN', 0.95),
    ('29697749-c608-809a-b352-cf25bd4ca4c7', date '2025-07-31', 'LST 契約終了', 0.90),
    ('29797749-c608-8036-acc3-f28b6e4695b2', date '2025-10-06', 'りょーJOIN', 0.95)
),
classified_history as (
  select
    notion_source_id,
    occurred_on,
    title,
    case
      when title like '%調達%' then 'funding'
      when title like '%採択%' or title like '%落札%' then 'award'
      when title like '%JOIN%' or title like '%就任%' or title like '%退任%' then 'people'
      when title like '%契約%' or title like '%JDA%' then 'project'
      when title like '%商号%' or title like '%設立%' or title like '%ラボ%' then 'company'
      else 'other'
    end as event_type,
    case
      when title like '%調達%' or title like '%採択%' or title like '%落札%' or title like '%商号%' then 'milestone'
      when title like '%契約%' or title like '%JDA%' or title like '%設立%' then 'high'
      else 'medium'
    end as importance,
    source_confidence
  from notion_history
)
insert into public.company_history_events (
  occurred_on,
  title,
  summary,
  event_type,
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
select
  occurred_on,
  title,
  null,
  event_type,
  importance,
  'internal',
  'approved_internal',
  source_confidence,
  array['notion_history', 'notion_history_full', 'verified_2026_06_05', 'event_type:' || event_type],
  'notion',
  'notion:team-armada-history',
  notion_source_id,
  timestamptz '2026-06-05 17:45:00+09',
  'codex_notion_company_history_full_rows',
  timestamptz '2026-06-05 17:45:00+09',
  'codex_notion_company_history_full_rows'
from classified_history
on conflict (notion_source_id) do update set
  occurred_on = excluded.occurred_on,
  title = excluded.title,
  summary = excluded.summary,
  event_type = excluded.event_type,
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

with lab_photo_indexes(photo_index) as (
  select generate_series(1, 15)
),
lab_event as (
  select event_id
  from public.company_history_events
  where notion_source_id = '40f2847f-238a-4592-b6be-d384582dcbf9'
)
insert into public.media_assets (
  title,
  asset_kind,
  event_id,
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
  'Event photo review: 柏の葉ラボオープン #' || lpad(photo_index::text, 2, '0'),
  'photo',
  lab_event.event_id,
  array[
    'notion_history_photo',
    'notion_history_full',
    'needs_storage_import',
    'verified_2026_06_05',
    'photo_index:' || photo_index::text
  ],
  'admin_only',
  'needs_review',
  0.90,
  'unknown',
  'unknown',
  'notion',
  'notion:team-armada-history:photo-present',
  '40f2847f-238a-4592-b6be-d384582dcbf9:photo:' || lpad(photo_index::text, 2, '0'),
  timestamptz '2026-06-05 17:45:00+09',
  'codex_notion_company_history_full_rows'
from lab_photo_indexes
cross join lab_event
on conflict (notion_source_id) do update set
  title = excluded.title,
  event_id = excluded.event_id,
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
