-- 127_company_content_notion_full_member_rows.sql
--
-- Non-destructive completion pass for the Notion member list rows that were
-- previously omitted because they could not be resolved to public.members.
-- This stores structured profile fields only. It intentionally stores no raw
-- Notion page body and no Notion file/photo URLs.

alter table public.member_profiles
  alter column member_id drop not null;

alter table public.member_profiles
  add column if not exists full_name text,
  add column if not exists effort numeric,
  add column if not exists mbti_tags text[] not null default '{}'::text[],
  add column if not exists origin_label text,
  add column if not exists residence_label text,
  add column if not exists join_context text,
  add column if not exists off_time_note text,
  add column if not exists favorite_food text,
  add column if not exists bucket_list text;

with notion_members(
  member_id,
  display_name,
  full_name,
  public_title,
  internal_title,
  notion_status,
  joined_on,
  effort,
  bio_short,
  mbti_tags,
  origin_label,
  residence_label,
  join_context,
  off_time_note,
  favorite_food,
  bucket_list,
  source_confidence,
  notion_source_id,
  has_photo
) as (
  values
    ('ID001', 'まさ', null, 'パートナー', 'パートナー', '活動中', date '2023-01-01', null, '土浦一高、慶応大、NIMS、産総研、ニューガラスフォーラム、京都大、ティエムファクトリを経てチームアルマダ。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-8042-8641-f32cccf79a4e', true),
    ('ID002', 'きよ', null, 'マネージャー', 'マネージャー', '活動中', date '2018-01-30', null, 'ティエムファクトリを経て、チームアルマダのバックオフィスとマネジメントを支える。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-80f2-a076-d3e8e18544a3', true),
    ('ID003', 'かる', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2025-06-05', null, '東京大、トヨタ自動車、A.T.カーニー、カナリーを経て、ディープテック支援に参画。', array[]::text[], null, null, null, null, null, null, 0.95, '20b97749-c608-80b5-9a0d-ca1e7b794127', true),
    ('ID004', 'こう', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2025-06-06', null, '東京大、トヨタ自動車、LabBaseを経て、事業開発と研究者支援に参画。', array[]::text[], null, null, null, null, null, null, 0.95, '20b97749-c608-8034-9ccb-f327b84ce065', true),
    ('ID005', 'りょー', null, 'クルー', 'クルー', '活動中', date '2025-10-01', null, '慶應義塾大学SFC、野村総合研究所、博報堂、TBWA HAKUHODOを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '29797749-c608-805a-b863-fb09f1dc289f', true),
    ('ID006', 'りり', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2024-06-25', null, '鹿児島県立武岡台高校、モンタナ大学、日立製作所、NIMSを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-8065-9330-ebddb57f2b3f', true),
    ('ID007', 'ちこ', null, 'クルー', 'クルー', '活動中', date '2025-03-21', null, 'お茶大、大学院、臨床開発、咲き編みアーティストを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '1c197749-c608-80ec-b271-e6d7b3b1aa29', true),
    ('ID008', 'うめ', null, 'クルー', 'クルー', '活動中', date '2024-09-07', null, '簿記専門学校、ドラッグストア、飲食業、人事を経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-80df-84ab-fdd23b212921', true),
    ('ID009', 'あび', null, 'クルー', 'クルー', '活動中', date '2025-04-01', null, '広告、DXコンサル、飲食、人材系ベンチャーを経て、フリーランスとして活動しながら参画。', array[]::text[], null, null, null, null, null, null, 0.95, '1af97749-c608-801e-90f9-c9ddbd5f6a38', true),
    ('ID010', 'らん', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2024-10-13', null, '慶応、東大新領域、産総研、CAST、フリーランスを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-8015-b1d5-f701f043612b', true),
    ('ID014', 'ももち', null, 'クルー', 'クルー', '活動中', date '2025-04-21', 0.10, '三井住友銀行、リクルート、allfuz、サーキュレーション、個人事業主を経て参画。', array['ENTJ(指揮官)'], '福島県、新潟県、静岡県、埼玉県、ドイツ', '東京都品川区', null, '家族で過ごす、カフェ、お酒を飲む', 'スイーツ、おすし', null, 0.95, '1d697749-c608-8076-85f2-c1e0c7d44305', true),
    ('ID015', 'はる', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2025-06-24', null, '筑波大学、しびっくぱわー、Gattoを経て、バックオフィス支援と受託事業マネジメントに参画。', array[]::text[], null, null, null, null, null, null, 0.95, '2a297749-c608-807b-8035-c30caf5dfc91', true),
    ('ID018', 'まゆ', null, 'クルー', 'クルー', '活動中', null, 0.15, null, array[]::text[], null, '長野県佐久市', 'Warisイベント', null, null, null, 0.90, '20697749-c608-807b-acae-c6d6c08a87b5', true),
    ('ID019', 'なめ', null, 'クルー', 'クルー', '活動中', date '2025-05-12', 0.15, '群馬県立桐生高校、東北大学、DIC、BWEを経て参画。', array['ESFJ(番人:領事)'], '群馬県太田市', '千葉県習志野市', 'UMI木場さんの紹介でまささんと対面。', 'コスパ良いご飯探し、ゴルフ', 'コンビニスイーツ、餃子、日本酒', 'ニューカレドニア、屋久島、阿智村', 0.95, '1db97749-c608-80f6-a775-d6d50a24b9cd', true),
    ('ID020', 'あかね', '吉野 茜', 'クルー', 'クルー', '活動中', date '2023-01-01', 0.01, 'SE、パチンコ店、巫女、Tiemfactoryを経てARMADAに参画。', array['ISFP-T(冒険家)'], '宮崎県日向市', '神奈川県横浜市', 'まささんとゲームで知り合い、Tiem/ARMADAへ参画。', '子供と遊ぶ、ゲーム', 'ミニトマト', 'やりたいなと思ったことを全部やりたい', 0.95, '13497749-c608-80ed-a0a4-df86f8c98490', true),
    ('ID021', 'いく', null, 'クルー', 'クルー', '活動中', date '2025-04-14', null, '大阪外国語大学、アパレル企画営業、輸入、AI開発会社ビジネスサポートを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '1c197749-c608-8015-90ae-f24844e0fc65', true),
    ('ID022', 'かな', '夏目 奏', 'クルー', 'クルー', '活動中', date '2024-11-18', 0.15, '北海道大学大学院、ANA、環境・廃棄物関連会社、SaaSスタートアップ、極地研究所を経て参画。', array['ENFJ-T(外交官:主人公)'], '北海道札幌市西区', '北海道札幌市中央区', 'ディープテックと「日本を強くしたい」という言葉への共感から参画。', '子供たちと北海道ならではの場所へ出かける', '郷土料理、フランス料理、パッタイ、柑橘系のスイーツ', '得意分野を活かす、全国旅行、酒造巡り、平屋に住む', 0.95, '13497749-c608-80f8-8e64-e71b5c5d2dd5', true),
    ('ID023', 'まり', null, 'シニアアソシエイト', 'シニアアソシエイト', '活動中', date '2024-03-05', null, '長崎北陽台、徳島大学工学博士を経て、技術経営支援に参画。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-803b-83f2-cbae997fe58d', true),
    ('ID025', 'まどか', null, 'クルー', 'クルー', '休止中', date '2024-10-03', null, '共立印刷、ティエムファクトリ、パーソルキャリアコンサルティングを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '13497749-c608-8084-b3ce-eec99d1e1da7', true),
    ('ID027', 'しろ', null, '休憩中', '休憩中', '休止中', date '2025-03-24', null, '建築設計事務所二ヶ所、tiem、ALMOWを経て参画。', array[]::text[], null, null, null, null, null, null, 0.95, '1c197749-c608-8067-82d9-d7909e2731ae', true),
    ('ID029', 'あき', null, null, null, '活動中', null, null, null, array[]::text[], null, null, null, null, null, null, 0.80, '34f97749-c608-80f1-919d-cbbda05aadf0', false),
    (null, 'けんと', '小室 絢人', '休憩中', '休憩中', '休止中', null, 0, '三菱UFJ銀行、オーナーカンパニー、コンサルを経て参画。', array['ENTP(分析家:討論者)'], '埼玉県鴻巣市', '東京都中央区', '案件でまささんと協働したことをきっかけに参画。', '旅行、サッカー', '蕎麦', '家庭をもって田舎で生活すること', 0.95, '13497749-c608-8035-93b3-d64af6d3ccbf', true),
    (null, 'しゅん', '道家 俊輔', '休憩中', '休憩中', '休止中', date '2024-09-26', 0, '化学メーカー、リクルート、消費財メーカー、リテール系シンクタンク、起業を経て参画。', array['ESTJ(番人:幹部)'], '滋賀県湖南市', '東京都杉並区', 'JOYCLEの仕事で偶然一緒になったことをきっかけに参画。', '子育て100%', 'ウイスキー、焼き肉、粉もの、ラーメン', '子供を不自由なく成人、会社伸ばして売却、海外で仕事、複数拠点生活', 0.95, '13497749-c608-805f-88d9-e58d0567b909', true),
    (null, 'けい', '市村 桂子', '休憩中', '休憩中', '休止中', date '2024-10-17', 0, 'ロンドンの大学、旅行会社、信託銀行、総合商社CVC部隊、NIMSを経て参画。', array['ESFJ(番人:領事)'], '大阪生まれ', '茨城県つくば市', '支援者としての経験を積むため参画。', '子供の予定、家族で外出、友人家族と集まる', 'フレッシュフルーツ', '高級リゾートで至れり尽くせりの生活', 0.95, '13497749-c608-8069-9117-ff8e2e40a880', true),
    (null, 'かずちょん', '博多屋 和子', 'クルー', 'クルー', '活動中', date '2025-05-07', 0.15, '証券会社でリテール営業、営業アシスタントを経て参画。', array['ENFP(外交官:運動家)'], '神奈川県海老名市', '神奈川県海老名市', 'Warisさんの研修をきっかけに参画。', 'フラメンコ、テニス、スキー、旅行、トレッキング', '小川軒のレーズンサンド、雲丹', '世界一周クルーズ、80歳までフラメンコを続ける', 0.95, '1db97749-c608-80f2-a3cf-cf9dde7d2b93', true),
    (null, 'なほ', '高畠 菜穂', '休憩中', '休憩中', '休止中', date '2024-06-25', 0, 'IT営業、人事、個人事業主、UMI人事を経て参画。', array['ENFJ(外交官:主人公)'], '神奈川県川崎市', '東京都目黒区', 'UMIの投資先LSTでまささんと出会い参画。', 'インドア、美容、旅行、温泉', 'ラーメン', 'フロリダのディズニー、ロンドン再訪', 0.95, '13497749-c608-80c1-a7b0-f711ca76ad28', true),
    (null, 'ひろ', null, 'クルー', 'クルー', '活動中', date '2024-12-07', 0.05, '外資コンサルでDD、事業再生周りのプロジェクトを経て参画。', array['ESTJ(番人:幹部)'], '神奈川県大和市', '東京都目黒区', '小室絢人さんからまささんを紹介されたことをきっかけに参画。', 'サウナ、サッカー、カタン', '焼肉、鮨、蕎麦', '行ったことない街や自然や食に触れる、一人PEファンド', 0.95, '15697749-c608-8022-96ce-f6b42023b605', true),
    (null, 'いけかよ', '池田佳世子', '休憩中', '休憩中', '休止中', date '2025-04-07', 0, 'DTP、グラフィックデザイン、Web、編集、ディレクション、ブランディングなどを経て参画。', array['ENFP(外交官:運動家)'], '岡山県新見市', '兵庫県川西市', 'Waris経由で参画。', '掃除、洗濯、運動、勉強、昼飲み、昼寝、スポーツ観戦', 'たこ焼き、焼き鳥、刺身、麻婆豆腐、小籠包、ジビエ肉', '英語コラム、翻訳、海外でも仕事、多拠点生活、免許再取得', 0.95, '1d697749-c608-8025-8db6-c37aca55767d', true),
    (null, 'みほ', null, '休憩中', '休憩中', '休止中', date '2025-03-17', 0, 'LIXIL営業、patagonia、PR会社、フリーランスでブランディング・広報PRを経て参画。', array['ENFP(外交官:運動家)'], '千葉県市川市', '東京都杉並区', null, null, '鮮魚、キャベツ', null, 0.95, '1ba97749-c608-80d3-84ce-e6759b437ec7', true)
),
valid_member_rows as (
  select nm.*
  from notion_members nm
  where nm.member_id is null
     or exists (select 1 from public.members m where m.member_id = nm.member_id)
)
insert into public.member_profiles (
  member_id,
  display_name,
  full_name,
  public_title,
  internal_title,
  notion_status,
  joined_on,
  effort,
  bio_short,
  mbti_tags,
  origin_label,
  residence_label,
  join_context,
  off_time_note,
  favorite_food,
  bucket_list,
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
  full_name,
  public_title,
  internal_title,
  notion_status,
  joined_on,
  effort,
  bio_short,
  mbti_tags,
  origin_label,
  residence_label,
  join_context,
  off_time_note,
  favorite_food,
  bucket_list,
  'internal',
  'approved_internal',
  source_confidence,
  'notion',
  case when member_id is null
    then 'notion:team-armada-member-list:unresolved-member'
    else 'notion:team-armada-member-list'
  end,
  array_remove(array[
    'notion_member_list',
    'verified_2026_06_05',
    case when member_id is null then 'member_id_unresolved' end,
    case when notion_status is not null then 'notion_status:' || notion_status end,
    case when has_photo then 'photo_present' end
  ], null),
  notion_source_id,
  timestamptz '2026-06-05 16:45:00+09',
  'codex_notion_company_full_member_rows',
  timestamptz '2026-06-05 16:45:00+09',
  'codex_notion_company_full_member_rows'
from valid_member_rows
on conflict (notion_source_id) do update set
  member_id = excluded.member_id,
  display_name = excluded.display_name,
  full_name = excluded.full_name,
  public_title = excluded.public_title,
  internal_title = excluded.internal_title,
  notion_status = excluded.notion_status,
  joined_on = excluded.joined_on,
  effort = excluded.effort,
  bio_short = excluded.bio_short,
  mbti_tags = excluded.mbti_tags,
  origin_label = excluded.origin_label,
  residence_label = excluded.residence_label,
  join_context = excluded.join_context,
  off_time_note = excluded.off_time_note,
  favorite_food = excluded.favorite_food,
  bucket_list = excluded.bucket_list,
  visibility = excluded.visibility,
  status = excluded.status,
  source_confidence = excluded.source_confidence,
  source_kind = excluded.source_kind,
  source_ref = excluded.source_ref,
  tags = excluded.tags,
  notion_last_synced_at = excluded.notion_last_synced_at,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at,
  updated_by = excluded.updated_by,
  updated_at = now();

with photo_members as (
  select *
  from (
    values
      ('ID001', 'まさ', '13497749-c608-8042-8641-f32cccf79a4e', 1, 0.90),
      ('ID002', 'きよ', '13497749-c608-80f2-a076-d3e8e18544a3', 1, 0.90),
      ('ID003', 'かる', '20b97749-c608-80b5-9a0d-ca1e7b794127', 1, 0.90),
      ('ID004', 'こう', '20b97749-c608-8034-9ccb-f327b84ce065', 1, 0.90),
      ('ID005', 'りょー', '29797749-c608-805a-b863-fb09f1dc289f', 1, 0.90),
      ('ID006', 'りり', '13497749-c608-8065-9330-ebddb57f2b3f', 1, 0.90),
      ('ID007', 'ちこ', '1c197749-c608-80ec-b271-e6d7b3b1aa29', 1, 0.90),
      ('ID008', 'うめ', '13497749-c608-80df-84ab-fdd23b212921', 1, 0.90),
      ('ID009', 'あび', '1af97749-c608-801e-90f9-c9ddbd5f6a38', 1, 0.90),
      ('ID010', 'らん', '13497749-c608-8015-b1d5-f701f043612b', 1, 0.90),
      ('ID014', 'ももち', '1d697749-c608-8076-85f2-c1e0c7d44305', 1, 0.90),
      ('ID015', 'はる', '2a297749-c608-807b-8035-c30caf5dfc91', 1, 0.90),
      ('ID018', 'まゆ', '20697749-c608-807b-acae-c6d6c08a87b5', 1, 0.90),
      ('ID019', 'なめ', '1db97749-c608-80f6-a775-d6d50a24b9cd', 1, 0.90),
      ('ID020', 'あかね', '13497749-c608-80ed-a0a4-df86f8c98490', 1, 0.90),
      ('ID021', 'いく', '1c197749-c608-8015-90ae-f24844e0fc65', 1, 0.90),
      ('ID022', 'かな', '13497749-c608-80f8-8e64-e71b5c5d2dd5', 1, 0.90),
      ('ID023', 'まり', '13497749-c608-803b-83f2-cbae997fe58d', 1, 0.90),
      ('ID025', 'まどか', '13497749-c608-8084-b3ce-eec99d1e1da7', 1, 0.90),
      ('ID027', 'しろ', '1c197749-c608-8067-82d9-d7909e2731ae', 1, 0.90),
      (null, 'けんと', '13497749-c608-8035-93b3-d64af6d3ccbf', 1, 0.90),
      (null, 'けんと', '13497749-c608-8035-93b3-d64af6d3ccbf', 2, 0.90),
      (null, 'しゅん', '13497749-c608-805f-88d9-e58d0567b909', 1, 0.90),
      (null, 'けい', '13497749-c608-8069-9117-ff8e2e40a880', 1, 0.90),
      (null, 'かずちょん', '1db97749-c608-80f2-a3cf-cf9dde7d2b93', 1, 0.90),
      (null, 'なほ', '13497749-c608-80c1-a7b0-f711ca76ad28', 1, 0.90),
      (null, 'ひろ', '15697749-c608-8022-96ce-f6b42023b605', 1, 0.90),
      (null, 'いけかよ', '1d697749-c608-8025-8db6-c37aca55767d', 1, 0.90),
      (null, 'みほ', '1ba97749-c608-80d3-84ce-e6759b437ec7', 1, 0.90)
  ) as v(member_id, display_name, notion_source_id, photo_index, source_confidence)
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
  'Member photo review: ' || display_name || case when photo_index > 1 then ' #' || photo_index::text else '' end,
  'photo',
  case when member_id is null then array[]::text[] else array[member_id] end,
  array_remove(array[
    'notion_member_photo',
    'needs_storage_import',
    'verified_2026_06_05',
    'photo_index:' || photo_index::text,
    case when member_id is null then 'member_id_unresolved' end
  ], null),
  'admin_only',
  'needs_review',
  source_confidence,
  'unknown',
  'unknown',
  'notion',
  'notion:team-armada-member-list:photo-present',
  notion_source_id || ':photo' || case when photo_index > 1 then ':' || lpad(photo_index::text, 2, '0') else '' end,
  timestamptz '2026-06-05 16:45:00+09',
  'codex_notion_company_full_member_rows'
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
  updated_by = 'codex_notion_company_full_member_rows',
  updated_at = now()
from public.media_assets ma
where ma.notion_source_id = mp.notion_source_id || ':photo';
