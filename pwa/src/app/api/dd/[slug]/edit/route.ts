import {createAdminClient} from '@/lib/supabase/admin';
import {recordWorkspaceAuditEvent} from '@/lib/workspace-access-audit';
import {NextResponse} from 'next/server';
import {resolveDdPackageAccess} from '@/lib/dd-access';
import {hasDdCapability} from '@/lib/dd-package-core';
import {loadDdAdminState,loadDdItem} from '@/lib/dd-package-server';
import {listDdSourceCandidates} from '@/lib/dd-sources';
import {runDdContentAction} from '@/lib/dd-admin-actions';
import {isSameOriginWorkspaceMutation} from '@/lib/workspace-mutation-origin';
const denied=()=>NextResponse.json({error:'Not found'},{status:404});
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;const access=await resolveDdPackageAccess(slug);
 if(!access||!hasDdCapability(access,'dd.edit')) return denied();
 const [state,candidates]=await Promise.all([loadDdAdminState(access.projectId),listDdSourceCandidates(access.projectId)]);
 if(!state||state.package.id!==access.packageId) return denied();
 return NextResponse.json({ok:true,state:{...state,grants:[],events:[],exports:[]},candidates},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params;const access=await resolveDdPackageAccess(slug);
 if(!access||!hasDdCapability(access,'dd.edit')) return denied();
 if(!isSameOriginWorkspaceMutation(request)) return NextResponse.json({error:'same_origin_required'},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||!['add_item','update_item','publish_item','withdraw_item','archive_item','restore_item'].includes(body.action)) return NextResponse.json({error:'content_action_required'},{status:403});
 if(body.action==='add_item') {if(body.packageId!==access.packageId) return denied();}
 else {if(typeof body.itemId!=='string') return denied();const item=await loadDdItem(body.itemId);if(!item||item.package_id!==access.packageId) return denied();}
 const response=await runDdContentAction(body,access.principal==='workspace_account'?null:access.memberId);
 if(response.ok) await recordWorkspaceAuditEvent(createAdminClient(),{eventType:'admin_dd_mutation',projectId:access.projectId,userAccountId:access.principal==='workspace_account'?access.accountId:null,email:access.email,detail:{action:'delegated_content_edit',content_action:body.action,package_id:access.packageId,item_id:body.itemId??null}});
 return response;
}
