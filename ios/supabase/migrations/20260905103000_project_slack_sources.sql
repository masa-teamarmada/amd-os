-- PJが取り込むSlackチャンネルを、複数チャンネル・複数ワークスペースで持てるようにする。
--
-- 背景: SXは team ARMADA の #p21_sx に加えて、SolvioraX の別ワークスペースからも
-- 会話を吸い上げる。従来の projects.slack_channel_id は1PJ1チャンネルしか持てず、
-- トークンも SLACK_BOT_TOKEN 1本 (= team ARMADA) 固定だった。
--
-- projects.slack_channel_id は「そのPJの主チャンネル (通知の宛先)」として今後も使う。
-- 取り込み対象は本テーブルを正とし、行が無いPJは従来どおり
-- projects.slack_channel_id を armada の1件として扱う。

create table if not exists public.project_slack_sources (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(project_id) on delete cascade,
  workspace_key text not null default 'armada',
  channel_id text not null,
  channel_name text,
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_slack_sources_uniq unique (project_id, workspace_key, channel_id)
);

comment on table public.project_slack_sources is
  'PJごとの取り込み対象Slackチャンネル。1PJが複数チャンネル・複数ワークスペースを持てる';
comment on column public.project_slack_sources.workspace_key is
  'トークン切替キー。armada は既定の SLACK_BOT_TOKEN、それ以外は SLACK_BOT_TOKEN_<大文字> を使う';

create index if not exists project_slack_sources_project_enabled_idx
  on public.project_slack_sources (project_id) where enabled;

alter table public.project_slack_sources enable row level security;

-- 既存の主チャンネルを armada として取り込み対象へ移す (冪等)
insert into public.project_slack_sources (project_id, workspace_key, channel_id, note)
select p.project_id, 'armada', trim(p.slack_channel_id), 'projects.slack_channel_id からの初期投入'
from public.projects p
where p.slack_channel_id is not null
  and length(trim(p.slack_channel_id)) > 0
on conflict (project_id, workspace_key, channel_id) do nothing;
