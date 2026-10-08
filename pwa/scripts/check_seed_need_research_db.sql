-- RPC・関連FK・RLS・競合・原子性。データは全てrollback。
begin;
do $$ begin
  if has_table_privilege('anon','public.seed_need_research','select') or has_function_privilege('anon','public.save_seed_need_research(jsonb,uuid[],uuid[],uuid[],timestamptz)','execute') then raise exception 'anon leak'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000001','email','external@example.invalid','role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare denied boolean := false; begin
  if exists(select 1 from public.seed_need_research) or exists(select 1 from public.seed_need_research_markets) or exists(select 1 from public.seed_need_research_companies) or exists(select 1 from public.seed_need_research_seeds) then raise exception 'external read leak'; end if;
  begin
    perform public.save_seed_need_research('{"dataset":"working","title":"invalid","kind":"new_seed"}',array[]::uuid[],array[]::uuid[],array[]::uuid[]);
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'external RPC write accepted'; end if;
end $$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000001','email',(select email from public.members where status='active' and (is_admin=true or os_access_scope='portfolio') order by member_id limit 1),'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare m uuid; c uuid; s uuid[]; r jsonb; updated jsonb; denied boolean; n int; begin
  insert into public.market_needs(title) values('rollback research market') returning id into m;
  insert into public.company_needs(title,market_need_id) values('rollback research company',m) returning id into c;
  select array_agg(id) into s from (select id from public.seeds order by id limit 2) x;
  r := public.save_seed_need_research('{"dataset":"working","title":"multiple seeds","kind":"combination"}',array[m],array[c],s);
  if (select count(*) from public.seed_need_research_seeds where research_id=(r->>'id')::uuid) <> 2 then raise exception 'multiple seeds missing'; end if;
  updated := public.save_seed_need_research(r || '{"title":"new seed zero","kind":"new_seed"}'::jsonb,array[m],array[c],array[]::uuid[],(r->>'updated_at')::timestamptz);
  if exists(select 1 from public.seed_need_research_seeds where research_id=(r->>'id')::uuid) then raise exception 'stale seed relation'; end if;
  denied := false;
  begin perform public.save_seed_need_research(r,array[m],array[c],s,(r->>'updated_at')::timestamptz); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'stale write accepted'; end if;
  -- 本文更新の後に関連FKが失敗しても、本文/リンクの全てをrollback。
  begin
    perform public.save_seed_need_research(updated || '{"title":"should rollback"}'::jsonb,array[(select id from public.market_needs where dataset='example' limit 1)],array[c],array[]::uuid[],(updated->>'updated_at')::timestamptz);
    raise exception 'cross dataset accepted';
  exception when foreign_key_violation then null; end;
  if (select title from public.seed_need_research where id=(r->>'id')::uuid) <> 'new seed zero' then raise exception 'partial write'; end if;
  if (select count(*) from public.seed_need_research_markets where research_id=(r->>'id')::uuid and market_need_id=m) <> 1 then raise exception 'partial relation loss'; end if;
  denied := false;
  begin perform public.save_seed_need_research('{"dataset":"working","title":"no need","kind":"new_seed"}',array[]::uuid[],array[]::uuid[],array[]::uuid[]); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'no needs accepted'; end if;
  denied := false;
  begin perform public.save_seed_need_research('{"dataset":"working","title":"one seed twice","kind":"combination"}',array[m],array[c],array[s[1],s[1]]); exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'duplicate seeds count as two'; end if;
  begin
    perform public.save_seed_need_research(updated,array[m],array[c],array['00000000-0000-4000-8000-000000000099']::uuid[],(updated->>'updated_at')::timestamptz);
    raise exception 'nonexistent seed accepted';
  exception when foreign_key_violation then null; end;
  select count(*) into n from public.seed_need_research;
  if n < 1 then raise exception 'member readback missing'; end if;
end $$;
reset role;
rollback;
select 'PASS: RLS and RPC authorization, multi-seed/zero-seed, dataset FK, atomic rollback, stale edit rejection; no test rows persisted' as result;
