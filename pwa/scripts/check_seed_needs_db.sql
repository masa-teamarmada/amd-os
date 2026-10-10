-- 本番のRLS/制約/更新をtransaction内で検証し、テスト行は全rollback。
begin;
do $$ begin
  if has_table_privilege('anon','public.market_needs','select') or has_table_privilege('anon','public.company_needs','select') or has_table_privilege('anon','public.seed_need_matches','select') then raise exception 'anon privilege leak'; end if;
  if (select count(*) from public.market_needs where dataset='example') <> 4
    or (select count(*) from public.company_needs where dataset='example') <> 6
    or (select count(*) from public.seed_need_matches where dataset='example') <> 5 then
    raise exception 'example count mismatch';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-000000000001','email','not-a-member@example.invalid','role','authenticated')::text, true);
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.market_needs) or exists(select 1 from public.company_needs) or exists(select 1 from public.seed_need_matches) then raise exception 'external member can read internal needs'; end if;
  begin
    insert into public.market_needs(title) values ('RLS negative test');
    raise exception 'external member can write';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-8000-000000000001','email',(select email from public.members where status='active' and (is_admin=true or os_access_scope='portfolio') order by member_id limit 1),'role','authenticated')::text, true);
end $$;
set local role authenticated;
do $$ declare m uuid; c uuid; x uuid; old_stamp timestamptz; n int; begin
  if not public.amd_os_is_member() then raise exception 'member test claims invalid'; end if;
  insert into public.market_needs(title) values ('rollback test market') returning id,updated_at into m,old_stamp;
  insert into public.company_needs(market_need_id,title) values(m,'rollback test need') returning id into c;
  insert into public.seed_need_matches(company_need_id,seed_id) values(c,(select seed_id from public.seed_need_matches limit 1)) returning id into x;
  update public.market_needs set problem='saved and read back' where id=m and updated_at=old_stamp;
  get diagnostics n = row_count;
  if n <> 1 or (select problem from public.market_needs where id=m) <> 'saved and read back' then raise exception 'write/readback failed'; end if;
  update public.market_needs set problem='stale overwrite' where id=m and updated_at=old_stamp;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'stale write accepted'; end if;
  begin
    insert into public.company_needs(title,market_need_id) values ('cross dataset',(select id from public.market_needs where dataset='example' limit 1));
    raise exception 'cross dataset accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.seed_need_matches(company_need_id,seed_id) select company_need_id,seed_id from public.seed_need_matches where id=x;
    raise exception 'duplicate accepted';
  exception when unique_violation then null; end;
  begin
    update public.market_needs set evidence_status='confirmed',evidence_note='test' where dataset='example';
    raise exception 'confirmed example accepted';
  exception when check_violation then null; end;
  begin
    update public.market_needs set evidence_status='confirmed' where id=m;
    raise exception 'confirmed without evidence accepted';
  exception when check_violation then null; end;
  begin
    update public.seed_need_matches set seed_id='00000000-0000-4000-8000-000000000099' where id=x;
    raise exception 'nonexistent seed accepted';
  exception when foreign_key_violation then null; end;
end $$;
reset role;
rollback;
select 'PASS: member read/write, external denial, cross-dataset FK, example/confirmed constraints, seed FK, duplicate guard, optimistic concurrency; test writes rolled back' as result;
