-- 市場ニーズを一覧の単位にする。出典・推計はニーズ本文と同時に保存する。
begin;

create function public.valid_need_sources(value jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare item jsonb; ids text[] := '{}'; source_id text;
begin
  if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>50 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'object' then return false; end if;
    source_id := item->>'id';
    if source_id is null or source_id !~ '^[0-9a-f-]{36}$' or source_id=any(ids) then return false; end if;
    ids := array_append(ids,source_id);
    if coalesce(length(btrim(item->>'title')),0) not between 1 and 300
      or coalesce(item->>'kind','') not in ('primary','report','interview','news','discussion','other')
      or coalesce(length(btrim(item->>'note')),0) not between 1 and 5000
      or length(coalesce(item->>'publisher',''))>500
      or length(coalesce(item->>'url',''))>2000
      or (coalesce(item->>'url','')<>'' and item->>'url' !~ '^https?://[^[:space:]]+$') then return false; end if;
    if coalesce(item->>'date','')<>'' then
      if item->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (item->>'date')::date;
    end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create function public.valid_need_market_sizes(value jsonb, sources jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare item jsonb; keys text[] := '{}'; item_key text;
begin
  if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>40 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or coalesce(item->>'scope','') not in ('japan','global')
      or jsonb_typeof(item->'year') is distinct from 'number'
      or (item->>'year') !~ '^\d{4}$' or (item->>'year')::int not between 2000 and 2100
      or jsonb_typeof(item->'min_oku') is distinct from 'number'
      or jsonb_typeof(item->'max_oku') is distinct from 'number'
      or (item->>'min_oku')::numeric<0 or (item->>'max_oku')::numeric<(item->>'min_oku')::numeric
      or (item->>'max_oku')::numeric>100000000
      or coalesce(length(btrim(item->>'definition')),0) not between 1 and 2000
      or coalesce(length(btrim(item->>'basis')),0) not between 1 and 5000
      or not exists(select 1 from jsonb_array_elements(sources) s where s->>'id'=item->>'source_id') then return false; end if;
    item_key := (item->>'scope')||':'||(item->>'year');
    if item_key=any(keys) then return false; end if;
    keys := array_append(keys,item_key);
  end loop;
  return true;
exception when others then return false;
end $$;

alter table public.market_needs
  add column sources jsonb not null default '[]'::jsonb check (public.valid_need_sources(sources)),
  add column market_sizes jsonb not null default '[]'::jsonb,
  add column confidence_rank text not null default 'unassessed' check (confidence_rank in ('a','b','c','unassessed')),
  add column confidence_note text not null default '',
  add constraint market_sizes_evidence_valid check (public.valid_need_market_sizes(market_sizes,sources)),
  add constraint market_confidence_evidence check (
    confidence_rank='unassessed' or (length(btrim(confidence_note))>0 and
      (confidence_rank='c' or jsonb_array_length(sources)>0))
  ),
  add constraint market_example_confidence check (dataset<>'example' or confidence_rank in ('c','unassessed'));

alter table public.company_needs
  add column sources jsonb not null default '[]'::jsonb check (public.valid_need_sources(sources));

create table public.market_need_seed_links (
  id uuid primary key default gen_random_uuid(),
  dataset text not null default 'working' check (dataset in ('working','example')),
  market_need_id uuid not null,
  seed_id uuid not null references public.seeds(id) on delete restrict,
  rationale text not null check (length(btrim(rationale)) between 1 and 5000),
  gap text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  foreign key (market_need_id,dataset) references public.market_needs(id,dataset) on delete restrict,
  unique (market_need_id,seed_id)
);
create index market_need_seed_links_seed_idx on public.market_need_seed_links(seed_id);
alter table public.market_need_seed_links enable row level security;
revoke all on public.market_need_seed_links from anon;
grant select,insert,update,delete on public.market_need_seed_links to authenticated;
grant all on public.market_need_seed_links to service_role;
create policy member_access on public.market_need_seed_links for all to authenticated
  using (public.amd_os_is_member()) with check (public.amd_os_is_member());
create trigger touch_record before update on public.market_need_seed_links
  for each row execute function public.touch_seed_need_record();

comment on column public.market_needs.sources is '出典の配列。id/kind/title/publisher/date/url/note。公開URLのないヒアリングも可。';
comment on column public.market_needs.market_sizes is '年間市場規模。scope japan/global、year、min_oku/max_oku（億円/年）、対象definition、算定basis、同じニーズ内の出典source_id。異なる地域・年を順位で混ぜない。';
comment on column public.market_needs.confidence_rank is 'ニーズ情報の確度。a=一次情報で裏付け、b=間接情報で裏付け、c=仮説中心、unassessed=未評価。手動評価で理由必須。市場規模自体の確定を意味しない。';
comment on table public.market_need_seed_links is '企業未特定でも市場ニーズにシーズ候補を直接接続。適合確認の自動判定なし。';
commit;
