begin;
do $$ declare cid uuid:=gen_random_uuid(); did uuid:=gen_random_uuid(); rid uuid; w workflow_requests; blocked boolean; begin
 insert into contracts(contract_id,project_id,contract_title,counterparty_name,relationship_scope,registry_status,amd_entity_name,status) values(cid,'p00','WORKFLOW TRANSACTIONAL TEST','TEST','amd_contract','accepted','株式会社チームアルマダ','under_review');
 insert into contract_documents(document_id,contract_id,project_id,drive_file_id,web_view_link,file_name,mime_type,is_latest) values(did,cid,'p00','workflow_test_pdf','https://drive.google.com/file/d/workflow_test_pdf/view','test.pdf','application/pdf',true);
 rid:=workflow_submit('ID001',cid,did,'権限境界の検証',null,repeat('a',64),'workflow_test_snapshot',repeat('a',64),workflow_contract_snapshot(cid));
 blocked:=false;begin perform workflow_transition('ID001',rid,'approve',null);exception when others then blocked:=sqlerrm='approver_required';end;if not blocked then raise exception 'FAIL masa self approval';end if;
 blocked:=false;begin perform workflow_transition('ID001',rid,'release',null);exception when others then blocked:=sqlerrm='invalid_transition';end;if not blocked then raise exception 'FAIL premature release';end if;
 blocked:=false;begin perform workflow_submit('ID001',cid,did,'重複申請',null,repeat('a',64),'workflow_test_snapshot',repeat('a',64),workflow_contract_snapshot(cid));exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'FAIL duplicate request';end if;
 perform workflow_transition('ID002',rid,'approve','確認済み');perform workflow_transition('ID001',rid,'release',null);
 blocked:=false;begin perform workflow_transition('ID002',rid,'complete',null);exception when others then blocked:=sqlerrm='invalid_transition';end;if not blocked then raise exception 'FAIL no executed artifact';end if;
 update contracts set counterparty_name='変更された相手先' where contract_id=cid;
 select * into w from workflow_requests where request_id=rid;if w.status<>'superseded' then raise exception 'FAIL changed terms';end if;
 rid:=workflow_submit('ID001',cid,did,'再申請',null,repeat('a',64),'workflow_test_snapshot',repeat('a',64),workflow_contract_snapshot(cid));
 perform workflow_transition('ID002',rid,'approve',null);
 update contract_documents set is_latest=false where document_id=did;
 insert into contract_documents(contract_id,project_id,drive_file_id,web_view_link,file_name,mime_type,is_latest) values(cid,'p00','workflow_test_revision','https://drive.google.com/file/d/workflow_test_revision/view','test2.pdf','application/pdf',true);
 select * into w from workflow_requests where request_id=rid;if w.status<>'superseded' then raise exception 'FAIL changed document';end if;
 if (select count(*) from workflow_alert_deliveries where event_key in (select 'event:'||event_id from workflow_events where request_id=rid))<4 then raise exception 'FAIL atomic recipients';end if;
 blocked:=false;begin update contracts set status='signed' where contract_id=cid;exception when others then blocked:=sqlerrm='seal_approval_required';end;if not blocked then raise exception 'FAIL manual signed status';end if;
 -- Recording an external signed artifact must remain possible; it is not an approval.
 update contracts set status='signed',signed_document_id=did where contract_id=cid;
 if exists(select 1 from workflow_requests where contract_id=cid and status='completed') then raise exception 'FAIL evidence became approval';end if;
end $$;
do $$ declare cid uuid:=gen_random_uuid();begin
 insert into contracts(contract_id,project_id,contract_title,counterparty_name,relationship_scope,registry_status,status) values(cid,'p00','OTHER PARTY TRANSACTIONAL TEST','TEST','third_party','accepted','under_review');
 update contracts set status='signed' where contract_id=cid;
 if not exists(select 1 from contracts where contract_id=cid and status='signed') then raise exception 'FAIL other party ledger';end if;
end $$;
-- Preparation starts without a PDF, preserves one case through submission, and cannot release early.
do $$ declare start_id uuid:=gen_random_uuid(); w workflow_requests; again workflow_requests; did uuid:=gen_random_uuid(); blocked boolean;
 begin
 w:=workflow_start('ID001',start_id,null,'p00','PREPARATION TRANSACTIONAL TEST','TEST COUNTERPARTY','nda','準備からの一連の検証',null);
 if w.status<>'preparing' or w.document_id is not null or w.snapshot_file_id is not null then raise exception 'FAIL preparation document boundary'; end if;
 if not exists(select 1 from contracts where contract_id=w.contract_id and registry_status='accepted' and counterparty_name='TEST COUNTERPARTY' and contract_type='nda') then raise exception 'FAIL start contract metadata'; end if;
 again:=workflow_start('ID001',start_id,null,'p00','PREPARATION TRANSACTIONAL TEST','TEST COUNTERPARTY','nda','準備からの一連の検証',null);
 if again.contract_id<>w.contract_id or (select count(*) from workflow_events where request_id=start_id)<>1 then raise exception 'FAIL start retry duplicate'; end if;
 if exists(select 1 from workflow_alert_deliveries where event_key in (select 'event:'||event_id from workflow_events where request_id=start_id)) then raise exception 'FAIL preparation approval alert'; end if;
 blocked:=false;begin perform workflow_start('ID002',gen_random_uuid(),null,'p00','SELF START','TEST','nda','自己申請',null);exception when others then blocked:=sqlerrm='self_approval_forbidden';end;if not blocked then raise exception 'FAIL Kiyo self start';end if;
 blocked:=false;begin perform workflow_start('ID001',gen_random_uuid(),w.contract_id,null,null,null,null,'二重開始',null);exception when unique_violation then blocked:=true;end;if not blocked then raise exception 'FAIL double preparing';end if;
 blocked:=false;begin perform workflow_transition('ID002',start_id,'approve',null);exception when others then blocked:=sqlerrm in ('invalid_transition','request_superseded');end;if not blocked then raise exception 'FAIL preparation approved';end if;
 blocked:=false;begin perform workflow_transition('ID001',start_id,'release',null);exception when others then blocked:=sqlerrm in ('invalid_transition','request_superseded');end;if not blocked then raise exception 'FAIL preparation released';end if;
 update contracts set counterparty_name='CORRECTED COUNTERPARTY' where contract_id=w.contract_id;
 did:=workflow_register_pdf('ID001',start_id,'workflow_preparation_test_pdf','final.pdf',100,false);
 if (select status from workflow_requests where request_id=start_id)<>'preparing' then raise exception 'FAIL preparing invalidated by document'; end if;
 if workflow_submit('ID001',w.contract_id,did,'提出目的',null,repeat('a',64),'workflow_preparation_snapshot',repeat('a',64),workflow_contract_snapshot(w.contract_id))<>start_id then raise exception 'FAIL case id lost on submit'; end if;
 if (select submitted_at from workflow_requests where request_id=start_id) is null then raise exception 'FAIL submission time'; end if;
 if (select count(*) from workflow_alert_deliveries where event_key in (select 'event:'||event_id from workflow_events where request_id=start_id))<>2 then raise exception 'FAIL submitted alert pair'; end if;
 blocked:=false;begin perform workflow_register_pdf('ID001',start_id,'workflow_premature_signed_pdf','signed.pdf',100,true);exception when others then blocked:=sqlerrm='invalid_transition';end;if not blocked then raise exception 'FAIL premature signed registration';end if;
 perform workflow_transition('ID002',start_id,'approve',null);perform workflow_transition('ID001',start_id,'release',null);
 did:=workflow_register_pdf('ID001',start_id,'workflow_preparation_signed_pdf','signed.pdf',100,true);
 if (select status from workflow_requests where request_id=start_id)<>'released' then raise exception 'FAIL artifact auto completes'; end if;
 perform workflow_transition('ID002',start_id,'complete',null);
 if (select status from workflow_requests where request_id=start_id)<>'completed' then raise exception 'FAIL preparation lifecycle completion'; end if;
 w:=workflow_start('ID001',gen_random_uuid(),null,'p00','CANCEL PREPARATION TEST','TEST','nda','取り下げの検証',null);
 perform workflow_transition('ID001',w.request_id,'cancel',null);
 if (select status from workflow_requests where request_id=w.request_id)<>'cancelled' then raise exception 'FAIL preparing cancel'; end if;
 end $$;
-- Direct authenticated and anonymous writes/RPC calls are denied independently of UI.
set local role authenticated;
do $$ declare blocked boolean:=false;begin
 begin insert into workflow_alert_deliveries(event_key,recipient_member_id) values('test','ID001');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL direct write';end if;
 blocked:=false;begin perform workflow_transition('ID002',gen_random_uuid(),'approve',null);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL exposed service RPC';end if;
 blocked:=false;begin perform workflow_start('ID001',gen_random_uuid(),null,'p00','TEST','TEST','nda','TEST',null);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL exposed workflow start';end if;
end $$;
reset role;
rollback;
