import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 当該PJの非開示指定だけを取得する。取得失敗時は実名へ戻さず閉じる。 */
export async function loadProjectPartnerDisclosure(db: SupabaseClient, projectId: string) {
  const result = await db.from("project_management_partners")
    .select("id,name,slug,name_disclosure_prohibited").eq("project_id", projectId)
    .is("deleted_at", null).eq("name_disclosure_prohibited", true);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []).map(p => ({ id: p.id, name: p.name, slug: p.slug, nameDisclosureProhibited: p.name_disclosure_prohibited }));
}
