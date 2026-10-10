-- 探索中の研究仮説。既存シーズと独立し、複数ニーズ・複数シーズを束ねる。
begin;
create table public.seed_need_research (
  id uuid primary key default gen_random_uuid(),
  dataset text not null check (dataset in ('working','example')),
  title text not null check (length(btrim(title)) between 1 and 200),
  kind text not null check (kind in ('application','combination','new_seed')),
  gap text not null default '',
  hypothesis text not null default '',
  experiment text not null default '',
  success_criteria text not null default '',
  next_action text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique(id,dataset)
);
create table public.seed_need_research_markets (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null,
  dataset text not null,
  market_need_id uuid not null,
  foreign key(research_id,dataset) references public.seed_need_research(id,dataset) on delete cascade,
  foreign key(market_need_id,dataset) references public.market_needs(id,dataset) on delete restrict,
  unique(research_id,market_need_id)
);
create table public.seed_need_research_companies (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null,
  dataset text not null,
  company_need_id uuid not null,
  foreign key(research_id,dataset) references public.seed_need_research(id,dataset) on delete cascade,
  foreign key(company_need_id,dataset) references public.company_needs(id,dataset) on delete restrict,
  unique(research_id,company_need_id)
);
create table public.seed_need_research_seeds (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null,
  dataset text not null,
  seed_id uuid not null references public.seeds(id) on delete restrict,
  foreign key(research_id,dataset) references public.seed_need_research(id,dataset) on delete cascade,
  unique(research_id,seed_id)
);
create index seed_need_research_markets_need_idx on public.seed_need_research_markets(market_need_id);
create index seed_need_research_companies_need_idx on public.seed_need_research_companies(company_need_id);
create index seed_need_research_seeds_seed_idx on public.seed_need_research_seeds(seed_id);
create trigger touch_record before update on public.seed_need_research for each row execute function public.touch_seed_need_record();
do $$ declare t text; begin
  foreach t in array array['seed_need_research','seed_need_research_markets','seed_need_research_companies','seed_need_research_seeds'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('create policy member_access on public.%I for all to authenticated using (public.amd_os_is_member()) with check (public.amd_os_is_member())',t);
  end loop;
end $$;

-- RLSを通し、仮説本文とすべての関連を一括保存。既存編集は楽観ロック。
create function public.save_seed_need_research(
  p_record jsonb, p_market_ids uuid[], p_company_ids uuid[], p_seed_ids uuid[],
  p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.seed_need_research; rid uuid; ds text;
begin
  if not public.amd_os_is_member() then raise exception '社内メンバーのみ編集可能'; end if;
  if cardinality(p_market_ids) is null or cardinality(p_company_ids) is null or cardinality(p_seed_ids) is null then raise exception '関連の配列が必要'; end if;
  if cardinality(p_market_ids) + cardinality(p_company_ids) = 0 then raise exception '市場または企業ニーズを選択'; end if;
  if p_record->>'kind' = 'application' and cardinality(p_seed_ids) < 1 then raise exception '既存技術の応用にはシーズを選択'; end if;
  if p_record->>'kind' = 'combination' and (select count(distinct x) from unnest(p_seed_ids) x) < 2 then raise exception '組み合わせには異なるシーズを2件以上選択'; end if;
  ds := p_record->>'dataset'; rid := coalesce((p_record->>'id')::uuid, gen_random_uuid());
  if p_expected_updated_at is null then
    insert into public.seed_need_research(id,dataset,title,kind,gap,hypothesis,experiment,success_criteria,next_action)
    values(rid,ds,btrim(p_record->>'title'),p_record->>'kind',coalesce(p_record->>'gap',''),coalesce(p_record->>'hypothesis',''),coalesce(p_record->>'experiment',''),coalesce(p_record->>'success_criteria',''),coalesce(p_record->>'next_action','')) returning * into r;
  else
    update public.seed_need_research set title=btrim(p_record->>'title'), kind=p_record->>'kind',
      gap=coalesce(p_record->>'gap',''),hypothesis=coalesce(p_record->>'hypothesis',''),experiment=coalesce(p_record->>'experiment',''),success_criteria=coalesce(p_record->>'success_criteria',''),next_action=coalesce(p_record->>'next_action','')
    where id=rid and dataset=ds and updated_at=p_expected_updated_at returning * into r;
    if not found then raise exception '先に別の編集が保存されたか、編集権限がない。更新して確認'; end if;
    delete from public.seed_need_research_markets where research_id=rid;
    delete from public.seed_need_research_companies where research_id=rid;
    delete from public.seed_need_research_seeds where research_id=rid;
  end if;
  insert into public.seed_need_research_markets(research_id,dataset,market_need_id) select rid,ds,x from (select distinct unnest(p_market_ids) x) s;
  insert into public.seed_need_research_companies(research_id,dataset,company_need_id) select rid,ds,x from (select distinct unnest(p_company_ids) x) s;
  insert into public.seed_need_research_seeds(research_id,dataset,seed_id) select rid,ds,x from (select distinct unnest(p_seed_ids) x) s;
  return to_jsonb(r) || jsonb_build_object('market_ids',p_market_ids,'company_ids',p_company_ids,'seed_ids',p_seed_ids);
end $$;
revoke all on function public.save_seed_need_research(jsonb,uuid[],uuid[],uuid[],timestamptz) from public,anon;
grant execute on function public.save_seed_need_research(jsonb,uuid[],uuid[],uuid[],timestamptz) to authenticated;
comment on table public.seed_need_research is '探索段階の研究仮説。複数ニーズとシーズを束ね、シーズゼロの新規研究構想も保持。性能適合や合意を表さず、seeds正本へ自動昇格しない。';
commit;
