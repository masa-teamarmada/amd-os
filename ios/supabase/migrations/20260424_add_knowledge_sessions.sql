create table if not exists public.knowledge_sessions (
  base_ym text primary key,
  offline_enabled boolean not null default false,
  event_date date null,
  venue_name text null,
  venue_address text null,
  venue_link text null,
  participant_member_ids jsonb not null default '[]'::jsonb,
  message_to_pm text null,
  announcement_draft text null,
  announcement_channel_id text null,
  announcement_posted_at timestamptz null,
  announcement_posted_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_sessions_updated_at
  on public.knowledge_sessions(updated_at desc);

create index if not exists idx_knowledge_sessions_offline
  on public.knowledge_sessions(offline_enabled, base_ym);
