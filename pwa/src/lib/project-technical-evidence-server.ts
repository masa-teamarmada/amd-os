import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProductDescription } from "./project-product-description";
import { redactProjectPartnerNames } from "./project-partner-disclosure";

export const TECHNICAL_EVIDENCE_CONFIG_KEY = "technical_evidence_report";

/** 認可後に当該PJの明示登録済み報告書を取得する。社内ノートを補完しない。 */
export async function loadProjectTechnicalEvidence(db: SupabaseClient, projectId: string) {
  const [config, partners] = await Promise.all([
    db.from("project_config").select("value").eq("project_id", projectId).eq("key", TECHNICAL_EVIDENCE_CONFIG_KEY).maybeSingle(),
    db.from("project_management_partners").select("id,name,slug,name_disclosure_prohibited").eq("project_id", projectId).is("deleted_at", null).eq("name_disclosure_prohibited", true),
  ]);
  if (config.error || partners.error) throw new Error((config.error || partners.error)!.message);
  const report = parseProductDescription(config.data?.value, "技術実証報告書");
  return redactProjectPartnerNames(report, (partners.data ?? []).map(p => ({ id: p.id, name: p.name, slug: p.slug, nameDisclosureProhibited: p.name_disclosure_prohibited })));
}
