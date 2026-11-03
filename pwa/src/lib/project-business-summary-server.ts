import 'server-only';
import type {createAdminClient} from '@/lib/supabase/admin';
import type {BusinessSummary} from '@/lib/project-overview';
/** 正本の事業概要。認可は入口で解決し、同じ本人の資格で一度だけ読む。 */
export async function loadProjectBusinessSummary(db:ReturnType<typeof createAdminClient>,projectId:string):Promise<BusinessSummary|null>{
 const {data,error}=await db.from('project_business_summaries').select('summary,detail,updated_at,updated_by_email').eq('project_id',projectId).maybeSingle();
 if(error)throw new Error(error.message);
 return data?{summary:data.summary??null,detail:data.detail??null,updatedAt:data.updated_at??null,updatedBy:data.updated_by_email??null}:null;
}
