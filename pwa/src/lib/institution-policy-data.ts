import { createClient } from "@/lib/supabase/client";
import type {
  InstitutionPolicyAssessment,
  InstitutionPolicyBundle,
  InstitutionPolicyItem,
  InstitutionPolicyItemKind,
  InstitutionPolicySourceType,
  InstitutionPolicyStatus,
} from "@/lib/institution-policy";

export async function fetchInstitutionPolicyBundle(): Promise<InstitutionPolicyBundle> {
  const supabase = createClient();
  const [itemsRes, assessmentsRes] = await Promise.all([
    supabase
      .from("institution_policy_items")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("institution_policy_assessments")
      .select(
        "institution_id,policy_item_id,status,attribute_value,evidence_note,source_type,source_url,source_path,confirmed_at,evaluator",
      )
      .order("updated_at", { ascending: false }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (assessmentsRes.error) throw assessmentsRes.error;

  const items: InstitutionPolicyItem[] = (itemsRes.data ?? []).map((r) => ({
    policyItemId: r.policy_item_id,
    category: r.category,
    itemKind: (r.item_kind ?? "status") as InstitutionPolicyItemKind,
    key: r.key,
    label: r.label,
    description: r.description ?? null,
    valueType: r.value_type ?? "text",
    sortOrder: r.sort_order ?? 100,
  }));

  const assessmentsByInstitution: Record<string, InstitutionPolicyAssessment[]> = {};
  for (const r of assessmentsRes.data ?? []) {
    (assessmentsByInstitution[r.institution_id] ||= []).push({
      policyItemId: r.policy_item_id,
      status: (r.status ?? "unknown") as InstitutionPolicyStatus,
      attributeValue: r.attribute_value ?? null,
      evidenceNote: r.evidence_note ?? null,
      sourceType: (r.source_type ?? "unknown") as InstitutionPolicySourceType,
      sourceUrl: r.source_url ?? null,
      sourcePath: r.source_path ?? null,
      confirmedAt: r.confirmed_at ?? null,
      evaluator: r.evaluator ?? null,
    });
  }

  return { items, assessmentsByInstitution };
}
