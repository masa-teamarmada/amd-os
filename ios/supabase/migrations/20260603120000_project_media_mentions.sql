-- project_media_mentions: 各案件のメディア掲載歴
create table if not exists project_media_mentions (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references projects(project_id) on delete cascade,
  occurred_on date not null,
  title text not null,
  media_name text not null,       -- 掲載媒体名 (例: 日経バイオテクONLINE, PR TIMES, 自社HP)
  kind text not null default 'coverage',
    -- coverage: 外部メディア掲載
    -- press_release: プレスリリース (PR TIMES 等)
    -- award: 受賞
    -- funding: 資金調達発表
    -- pitch: ピッチ登壇
    -- own_news: 自社 HP ニュース
  source_url text,
  summary text,
  ingested_by text not null default 'manual',
  verified boolean not null default true,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_media_mentions_project_id_idx on project_media_mentions(project_id);
create index if not exists project_media_mentions_occurred_on_idx on project_media_mentions(occurred_on desc);

alter table project_media_mentions enable row level security;

create policy "authenticated can read project_media_mentions"
  on project_media_mentions for select
  to authenticated using (true);

create policy "service_role can all on project_media_mentions"
  on project_media_mentions for all
  to service_role using (true);
