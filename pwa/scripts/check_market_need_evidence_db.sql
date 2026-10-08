-- 保存、情報の根拠、国内/世界、競合、参照、RLSを実DBで確認。全検証行はrollback。
begin;
do $$ begin
  if has_table_privilege('anon','public.market_need_seed_links','select') then raise exception 'anonymous link leak'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000001','email','external@example.invalid','role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ begin
  if exists(select 1 from public.market_need_seed_links) or exists(select 1 from public.market_needs) then raise exception 'external read leak'; end if;
  begin insert into public.market_needs(title,sources) values('should deny','[]'); raise exception 'external write accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  perform set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-000000000001','email',(select email from public.members where status='active' and (is_admin=true or os_access_scope='portfolio') order by member_id limit 1),'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare m uuid; c uuid; link uuid; seed uuid; stamp timestamptz; n int; src jsonb; sizing jsonb; example_id uuid;
begin
  src := '[{"id":"00000000-0000-4000-8000-000000000010","kind":"interview","title":"試験用ヒアリング","publisher":"試験","date":"2026-10-08","url":"","note":"試験用の根拠"}]';
  sizing := '[{"scope":"japan","year":2026,"min_oku":100,"max_oku":200,"definition":"対象製品","basis":"試験のみ","source_id":"00000000-0000-4000-8000-000000000010"},{"scope":"global","year":2026,"min_oku":900,"max_oku":1200,"definition":"対象製品","basis":"試験のみ","source_id":"00000000-0000-4000-8000-000000000010"}]';
  insert into public.market_needs(title,sources,market_sizes,confidence_rank,confidence_note) values('rollback market ranking',src,sizing,'a','一次情報を確認（試験）') returning id,updated_at into m,stamp;
  if (select market_sizes->1->>'scope' from public.market_needs where id=m)<>'global' then raise exception 'global estimate readback lost'; end if;
  insert into public.company_needs(title,market_need_id,sources) values('rollback source company',m,src) returning id into c;
  if (select sources->0->>'title' from public.company_needs where id=c)<>'試験用ヒアリング' then raise exception 'company sources lost'; end if;
  select id into seed from public.seeds order by id limit 1;
  insert into public.market_need_seed_links(market_need_id,seed_id,rationale,gap) values(m,seed,'検証用の関連','性能未確認') returning id into link;
  if (select count(*) from public.market_need_seed_links where id=link)<>1 then raise exception 'direct link readback'; end if;
  begin update public.market_needs set sources='[]' where id=m; raise exception 'source deletion with estimate accepted'; exception when check_violation then null; end;
  begin update public.market_needs set market_sizes='[]',sources='[]',confidence_rank='a' where id=m; raise exception 'unsupported confidence accepted'; exception when check_violation then null; end;
  begin update public.market_needs set sources=jsonb_set(src,'{0,title}','{}') where id=m; raise exception 'invalid nested source type accepted'; exception when check_violation then null; end;
  begin update public.market_needs set market_sizes=jsonb_set(sizing,'{0,source_id}','"missing"') where id=m; raise exception 'unknown source accepted'; exception when check_violation then null; end;
  begin update public.market_needs set market_sizes=sizing || jsonb_build_array(sizing->0) where id=m; raise exception 'duplicate geography/year accepted'; exception when check_violation then null; end;
  begin update public.market_needs set market_sizes=jsonb_set(sizing,'{0,min_oku}','300') where id=m; raise exception 'inverse range accepted'; exception when check_violation then null; end;
  begin update public.market_needs set market_sizes=jsonb_set(sizing,'{0,min_oku}','null') where id=m; raise exception 'null treated as zero'; exception when check_violation then null; end;
  if (select sources from public.market_needs where id=m)<>src or (select market_sizes from public.market_needs where id=m)<>sizing then raise exception 'partial evidence overwrite'; end if;
  update public.market_needs set title='updated' where id=m and updated_at=stamp;
  update public.market_needs set title='stale' where id=m and updated_at=stamp;
  get diagnostics n=row_count; if n<>0 then raise exception 'stale overwrite'; end if;
  begin insert into public.market_need_seed_links(market_need_id,seed_id,rationale) values(m,seed,'duplicate'); raise exception 'duplicate link accepted'; exception when unique_violation then null; end;
  begin insert into public.market_need_seed_links(market_need_id,seed_id,rationale,dataset) values(m,(select id from public.seeds where id<>seed order by id limit 1),'wrong dataset','example'); raise exception 'cross dataset accepted'; exception when foreign_key_violation then null; end;
  begin insert into public.market_need_seed_links(market_need_id,seed_id,rationale) values(m,'00000000-0000-4000-8000-000000000099','missing'); raise exception 'invalid seed accepted'; exception when foreign_key_violation then null; end;
  begin insert into public.market_needs(title,dataset,confidence_rank,confidence_note,sources) values('example','example','a','unsupported',src); raise exception 'example promoted'; exception when check_violation then null; end;
end $$;
reset role;
rollback;
select 'PASS: member save/readback, source-linked domestic/global estimates, JSON validation, confidence evidence, stale-write rejection, direct seed FK/dataset/uniqueness, external/anon denial; all test data rolled back' as result;
