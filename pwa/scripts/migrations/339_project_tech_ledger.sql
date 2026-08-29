-- 339_project_tech_ledger.sql
-- PJコックピット「技術」タブの正本台帳。
--
-- なぜ作るか (まさ 2026-08-29):
--   SXなら「シアノがどの温度帯・pHで使えるか、どの元素を取り込めるか」、
--   CXなら「磁気冷凍と気体冷凍の違い、今どこまで冷やせるか、kiutraとの星取り表」。
--   こうした技術の事実は、いま project_knowledge に自由文の断片として貯まるだけで
--   PJの画面からは読めず、数値の比較にも使えない。ここを構造化して置き場所にする。
--
-- PJごとにフォーマットは違うが、形は4種類しかない (block_kind):
--   condition = 成立条件   … 使える範囲。項目 × 下限/上限/単位/条件
--   article   = 解説       … 原理・用語の説明文 (topics.body_md が本体、entries は持たない)
--   matrix    = 星取り表   … 比較軸 × 相手。◎○△× + 実数値 + 根拠
--   record    = 到達実績   … 「今どこまで行っているか」を日付つきで。同じ項目を並べると推移になる
-- PJごとに違うのは並べるトピックと項目名だけで、テーブルは共通。
-- PJ専用コンポーネントを作らないこと (p25専用の規程タブと同じ轍を踏まない)。

create table if not exists project_tech_topics (
  tech_topic_id text primary key,
  project_id text not null references projects(project_id) on delete cascade,
  block_kind text not null
    check (block_kind in ('condition', 'article', 'matrix', 'record')),
  title text not null,
  -- 一覧に出す1行説明。何が書いてあるトピックなのかを開く前に判らせる。
  summary text,
  -- 解説本文 (markdown)。article の本体だが、他の3種でも補足として使える。
  body_md text,
  -- 技術区分。トピックの束ね軸で、PJごとに自由な語彙を使う (培養/分離/冷凍機/検出器 など)。
  tech_domain text,
  sort_order integer not null default 100,
  status text not null default 'active'
    check (status in ('active', 'draft', 'archived')),
  -- 社外に出せるかどうか。SXは「株・培養条件・リアクター内部条件・光/CO2/pH/温度/滞留時間」を
  -- 初回面談では出さない方針 (2026-06-26 三浦工業MTG)。技術タブはこの区分を必ず持つ。
  confidentiality text not null default 'internal'
    check (confidentiality in ('public', 'internal', 'confidential')),
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'l2_extraction', 'meeting', 'literature', 'vendor_spec', 'measurement', 'estimate')),
  source_ref text,
  source_url text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- トピックの中身1行。condition / matrix / record を1テーブルで持つ。
--   condition: row_label=温度, value_min=25, value_max=35, unit=℃, condition_text=培養槽内
--   列挙(元素など): row_label=取り込める元素, value_text='Cd, Zn, Cu'
--   matrix:    row_label=到達温度, col_label=kiutra, rating='good', value_text='0.3K'
--   record:    row_label=到達温度, value_text='20mK', observed_on=2026-03-31
create table if not exists project_tech_entries (
  tech_entry_id text primary key,
  tech_topic_id text not null references project_tech_topics(tech_topic_id) on delete cascade,
  -- project_id は絞り込み用の非正規化 (知財台帳と同じ流儀)。
  project_id text not null references projects(project_id) on delete cascade,
  -- 行の名前。成立条件なら項目名、星取り表なら比較軸、到達実績なら測る対象。
  row_label text not null,
  -- 星取り表の列 (自社 / kiutra / Bluefors)。condition と record では null。
  col_label text,
  value_min numeric,
  value_max numeric,
  -- 数値にならない値 (元素の列挙、方式名、「未測定」など)。value_min/max と併用してよい。
  value_text text,
  unit text,
  -- 星取り表の評価。◎○△×に対応する。
  rating text
    check (rating in ('excellent', 'good', 'fair', 'poor', 'na', 'unknown')),
  -- 「この条件下で成り立つ」の条件。培養槽内 / 無風時 / 定格運転時 など。
  condition_text text,
  -- 到達実績の測定日。record 以外でも「いつ時点の値か」に使う。
  observed_on date,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low', 'unverified')),
  -- 出典は全行に持たせる。根拠のない数値は後から見た本人に消されるため (まさ 2026-08-27)。
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'l2_extraction', 'meeting', 'literature', 'vendor_spec', 'measurement', 'estimate')),
  source_ref text,
  source_url text,
  note text,
  sort_order integer not null default 100,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_project_tech_topics_project
  on project_tech_topics(project_id, status, sort_order, updated_at desc);
create index if not exists idx_project_tech_entries_topic
  on project_tech_entries(tech_topic_id, sort_order, row_label);
create index if not exists idx_project_tech_entries_project
  on project_tech_entries(project_id, row_label);

alter table project_tech_topics enable row level security;
alter table project_tech_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_tech_topics', 'project_tech_entries']
  loop
    execute format('drop policy if exists %I on %I', t || '_member_read', t);
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('drop policy if exists %I on %I', t || '_service_role', t);
    execute format('create policy %I on %I for select to authenticated using (amd_os_is_member())', t || '_member_read', t);
    execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    execute format('create policy %I on %I for all to service_role using (true) with check (true)', t || '_service_role', t);
  end loop;
end $$;

comment on table project_tech_topics is
  'PJの技術台帳。成立条件・解説・星取り表・到達実績の4形式で技術の事実を貯める。PJごとに違うのは並べるトピックだけで、テーブルとUIは共通。';
comment on column project_tech_topics.block_kind is
  '表示形式。condition=成立条件表 / article=解説文 / matrix=星取り表 / record=到達実績。PJ専用の実装を作らないための唯一の分岐。';
comment on column project_tech_topics.confidentiality is
  '社外開示の可否。confidential は培養条件・リアクター内部条件など、初回面談でも出さない情報。';
comment on table project_tech_entries is
  '技術トピックの中身1行。成立条件の1項目、星取り表の1マス、到達実績の1測定を同じ形で持つ。';
comment on column project_tech_entries.col_label is
  '星取り表の列 (比較相手)。成立条件・到達実績では null。';
comment on column project_tech_entries.source_kind is
  '出典の種類。literature=論文/文献、vendor_spec=他社公表値、measurement=自分たちの実測、meeting=議事録、estimate=根拠付きの暫定値。';
