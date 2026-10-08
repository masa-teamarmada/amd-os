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
-- Direct authenticated and anonymous writes/RPC calls are denied independently of UI.
set local role authenticated;
do $$ declare blocked boolean:=false;begin
 begin insert into workflow_alert_deliveries(event_key,recipient_member_id) values('test','ID001');exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL direct write';end if;
 blocked:=false;begin perform workflow_transition('ID002',gen_random_uuid(),'approve',null);exception when insufficient_privilege then blocked:=true;end;
 if not blocked then raise exception 'FAIL exposed service RPC';end if;
end $$;
reset role;
rollback;
