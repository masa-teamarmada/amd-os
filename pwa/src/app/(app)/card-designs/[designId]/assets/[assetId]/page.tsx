import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { amieCardAccess,amieCardCanRead } from '@/lib/project-card-designs-server';
export const dynamic='force-dynamic';
export default async function LegacyCardPdfPage({params}:{params:Promise<{designId:string;assetId:string}>}){
 const member=await amieCardAccess();if(!member)notFound();
 const {designId,assetId}=await params;const db=createAdminClient();
 const {data:design}=await db.from('project_card_designs').select('owner_project_id').eq('design_id',designId).maybeSingle();
 if(!design||!amieCardCanRead(member,design.owner_project_id))notFound();
 const {data:asset}=await db.from('project_card_design_assets').select('project_id,version_id,mime_type').eq('asset_id',assetId).maybeSingle();
 if(!asset||asset.mime_type!=='application/pdf'||!amieCardCanRead(member,asset.project_id))notFound();
 const {data:version}=await db.from('project_card_design_versions').select('design_id').eq('version_id',asset.version_id).maybeSingle();
 if(version?.design_id!==designId)notFound();
 redirect(`/project/${encodeURIComponent(design.owner_project_id)}/card-designs/${designId}/assets/${assetId}`);
}
