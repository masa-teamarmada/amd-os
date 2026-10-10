-- シーズ×ニーズ: 記入例と実際の蓄積を分離。既存 seeds は更新しない。
begin;

create table public.market_needs (
  id uuid primary key default gen_random_uuid(),
  dataset text not null default 'working' check (dataset in ('working','example')),
  title text not null check (length(btrim(title)) between 1 and 200),
  target_user text not null default '',
  problem text not null default '',
  current_solution text not null default '',
  desired_outcome text not null default '',
  evidence_status text not null default 'hypothesis' check (evidence_status in ('hypothesis','signal','confirmed')),
  evidence_note text not null default '',
  source_url text not null default '' check (source_url = '' or source_url ~ '^https?://'),
  observed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (id,dataset),
  check (dataset <> 'example' or evidence_status = 'hypothesis'),
  check (evidence_status <> 'confirmed' or length(btrim(evidence_note)) > 0)
);

create table public.company_needs (
  id uuid primary key default gen_random_uuid(),
  dataset text not null default 'working' check (dataset in ('working','example')),
  market_need_id uuid,
  title text not null check (length(btrim(title)) between 1 and 200),
  company_name text not null default '',
  business_area text not null default '',
  strengths text not null default '',
  strategic_intent text not null default '',
  missing_capability text not null default '',
  constraints text not null default '',
  evidence_status text not null default 'hypothesis' check (evidence_status in ('hypothesis','signal','confirmed')),
  evidence_note text not null default '',
  source_url text not null default '' check (source_url = '' or source_url ~ '^https?://'),
  observed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (id,dataset),
  foreign key (market_need_id,dataset) references public.market_needs(id,dataset) on delete restrict,
  check (dataset <> 'example' or evidence_status = 'hypothesis'),
  check (evidence_status <> 'confirmed' or length(btrim(evidence_note)) > 0)
);

create table public.seed_need_matches (
  id uuid primary key default gen_random_uuid(),
  dataset text not null default 'working' check (dataset in ('working','example')),
  company_need_id uuid not null,
  seed_id uuid not null references public.seeds(id) on delete restrict,
  rationale text not null default '',
  research_question text not null default '',
  experiment text not null default '',
  success_criteria text not null default '',
  funding_note text not null default '',
  next_action text not null default '',
  owner_name text not null default '',
  due_on date,
  status text not null default 'hypothesis' check (status in ('hypothesis','hearing','research','poc','hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  foreign key (company_need_id,dataset) references public.company_needs(id,dataset) on delete restrict,
  unique (company_need_id,seed_id),
  check (dataset <> 'example' or status = 'hypothesis')
);
create index company_needs_market_idx on public.company_needs(market_need_id);
create index seed_need_matches_seed_idx on public.seed_need_matches(seed_id);

create function public.touch_seed_need_record() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

do $$ declare t text; begin
  foreach t in array array['market_needs','company_needs','seed_need_matches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create policy member_access on public.%I for all to authenticated using (public.amd_os_is_member()) with check (public.amd_os_is_member())', t);
    execute format('create trigger touch_record before update on public.%I for each row execute function public.touch_seed_need_record()', t);
  end loop;
end $$;

comment on table public.market_needs is '市場の課題・代替手段・望まれる変化。example は議論用の仮説。';
comment on table public.company_needs is '市場ニーズを企業の事業領域・強み・方針で解釈した個別のニーズ。';
comment on table public.seed_need_matches is '企業ニーズと既存シーズの多対多の組み合わせ。研究・PoCの検証事項。';

commit;
