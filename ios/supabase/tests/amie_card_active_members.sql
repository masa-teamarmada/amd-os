-- Read-only JWT fixtures. No member rows are inserted or changed.
begin;
do $$ declare e text; begin
 select email into e from public.members where status='active' and is_admin=true limit 1;
 if e is null then raise exception 'active admin fixture unavailable'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub','d6615ceb-2c2a-4cd9-8314-540ccf71db5b','email',e)::text,true);
end $$;
set local role authenticated;
do $$ begin if (select count(*) from public.project_card_designs)=0 then raise exception 'active admin denied'; end if; end $$;
reset role;
do $$ declare e text; begin
 select email into e from public.members where status='inactive' limit 1;
 if e is null then raise exception 'inactive fixture unavailable'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub','d6615ceb-2c2a-4cd9-8314-540ccf71db5b','email',e)::text,true);
end $$;
set local role authenticated;
do $$ begin if (select count(*) from public.project_card_designs)<>0 or (select count(*) from public.project_card_design_assets)<>0 then raise exception 'inactive member allowed'; end if; end $$;
rollback;
select 'active authenticated admin sees cards; inactive authenticated member sees zero; no data writes' as result;
