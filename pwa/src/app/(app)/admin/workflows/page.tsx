import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {WorkflowWorkspace} from '@/components/workflows/WorkflowWorkspace';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:{absolute:'業務フロー - AMD OS'}};
export default async function WorkflowsPage({searchParams}:{searchParams:Promise<{contractId?:string;requestId?:string}>}){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user?.email)notFound();
 const {data:member}=await db.from('members').select('is_admin,status').eq('email',user.email.toLowerCase()).single();if(!member?.is_admin||member.status!=='active')notFound();
 const params=await searchParams;return <WorkflowWorkspace initialContractId={params.contractId} initialRequestId={params.requestId}/>;
}
