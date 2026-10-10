-- 出典・推計のネストした値も型を検査。既存本文・評価は変更しない。
begin;
create or replace function public.valid_need_sources(value jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare item jsonb; ids text[] := '{}'; source_id text;
begin
  if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>50 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from unnest(array['id','kind','title','publisher','date','url','note']) k where jsonb_typeof(item->k) is distinct from 'string') then return false; end if;
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

create or replace function public.valid_need_market_sizes(value jsonb, sources jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare item jsonb; keys text[] := '{}'; item_key text;
begin
  if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value)>40 then return false; end if;
  for item in select * from jsonb_array_elements(value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or exists(select 1 from unnest(array['scope','definition','basis','source_id']) k where jsonb_typeof(item->k) is distinct from 'string')
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

commit;
