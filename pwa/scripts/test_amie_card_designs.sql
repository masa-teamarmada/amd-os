begin;
do $$
declare p jsonb; r jsonb; d uuid; v uuid; approved uuid; count_before int; conflict_seen boolean:=false; test_key text:=gen_random_uuid()::text;
begin
 if has_table_privilege('anon','public.project_card_designs','select') then raise exception 'anon can read cards'; end if;
 if has_table_privilege('authenticated','public.project_card_designs','insert') then raise exception 'direct user writes allowed'; end if;
 if has_function_privilege('authenticated','public.amie_save_card_version(jsonb)','execute') then raise exception 'RPC bypass allowed'; end if;
 p:=jsonb_build_object('owner_project_id',(select project_id from projects where project_name='AMD' limit 1),'holder_label','transaction test','holder_key',test_key,'variant_key',test_key,'brand_label','transaction test','revision_label','draft 1','status','review','expected_version',0,'request_key',gen_random_uuid(),'actor','transaction-test','assets',jsonb_build_array(jsonb_build_object('role','preview','project_id',(select project_id from projects where project_name='AMD' limit 1),'drive_file_id','test_preview_0001','drive_folder_id','test','file_name','preview.pdf','mime_type','application/pdf'),jsonb_build_object('role','front_print','project_id',(select project_id from projects where project_name='AMD' limit 1),'drive_file_id','test_front_0001','drive_folder_id','test','file_name','front.pdf','mime_type','application/pdf'),jsonb_build_object('role','back_print','project_id',(select project_id from projects where project_name='AMD' limit 1),'drive_file_id','test_back_0001','drive_folder_id','test','file_name','back.pdf','mime_type','application/pdf')));
 r:=amie_save_card_version(p);d:=(r->>'design_id')::uuid;v:=(r->>'version_id')::uuid;
 if not (amie_save_card_version(p)->>'replayed')::boolean then raise exception 'replay not idempotent'; end if;
 perform amie_approve_card_version(d,v,1,'transaction-test');
 p:=p||jsonb_build_object('request_key',gen_random_uuid(),'expected_version',2,'revision_label','draft 2');
 perform amie_save_card_version(p);
 select latest_approved_version_id into approved from project_card_designs where design_id=d;
 if approved<>v or (select count(*) from project_card_design_versions where design_id=d)<>2 then raise exception 'new draft replaced approved version'; end if;
 count_before:=(select count(*) from project_card_design_versions where design_id=d);
 begin
  perform amie_save_card_version(p||jsonb_build_object('request_key',gen_random_uuid(),'expected_version',1));
 exception when serialization_failure then conflict_seen:=true;
 end;
 if not conflict_seen or count_before<>(select count(*) from project_card_design_versions where design_id=d) then raise exception 'conflict was not atomic'; end if;
 raise notice 'idempotency, immutable prior version, approval pointer, atomic conflict, grants passed';
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","email":"amie-card-outsider@example.invalid","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.project_card_designs)<>0 then raise exception 'outsider can read cards';end if;
 if (select count(*) from public.project_card_design_assets)<>0 then raise exception 'outsider can read assets';end if;
end $$;
reset role;
rollback;
select 'card transaction and outsider RLS checks passed; fixtures rolled back' as result;
