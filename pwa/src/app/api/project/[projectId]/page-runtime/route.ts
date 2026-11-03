import {admitProjectPage} from '@/lib/project-page-admission';
import {readProjectPage} from '@/lib/project-page-server';
import type {ProjectSurface} from '@/lib/project-surface-permissions';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
 const {projectId}=await params,q=new URL(request.url).searchParams,surface=q.get('surface') as ProjectSurface;
 if(!['cockpit','workspace','dd'].includes(surface))return Response.json({error:'Not found'},{status:404});
 const admission=await admitProjectPage(projectId,surface,q.get('pageId')??'',q.get('slug')??undefined);
 if(!admission)return Response.json({error:'Not found'},{status:404});
 try{return Response.json({runtime:await readProjectPage(projectId,admission.pageId,admission.actor,admission.source,q.get('records')==='1')},{headers:{'Cache-Control':'private, no-store'}});}
 catch{return Response.json({error:'ページを読み込めませんでした。再読込してください。'},{status:503});}
}
