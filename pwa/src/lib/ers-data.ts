/**
 * ERS データ取得 (Supabase client 経由)。設計正本: pwa/design/institution_readiness.md
 */
import { createClient } from "@/lib/supabase/client";
import type {
  ErsInstitution,
  ErsAxis,
  ErsCriterion,
  ErsAssessment,
} from "@/lib/ers";

export interface ErsBundle {
  institutions: ErsInstitution[];
  axes: ErsAxis[];
  criteria: ErsCriterion[];
  /** institution_id -> 各サブ軸の最新評価 (evaluated_at 最新を 1 つ) */
  assessmentsByInstitution: Record<string, ErsAssessment[]>;
}

export async function fetchErsBundle(): Promise<ErsBundle> {
  const supabase = createClient();
  const [instRes, axesRes, critRes, assessRes] = await Promise.all([
    supabase.from("institutions").select("*").order("sort_order", { ascending: true }),
    supabase.from("institution_capability_axes").select("*").order("sort_order", { ascending: true }),
    supabase.from("institution_capability_criteria").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("institution_assessments")
      .select("institution_id,criterion_id,level,na,note,evaluated_at")
      .order("evaluated_at", { ascending: false }),
  ]);

  const institutions: ErsInstitution[] = (instRes.data ?? []).map((r) => ({
    institutionId: r.institution_id,
    name: r.name,
    shortName: r.short_name ?? null,
    type: r.type ?? "other",
    description: r.description ?? null,
    region: r.region ?? null,
    contractStatus: r.contract_status ?? "active",
    sortOrder: r.sort_order ?? 100,
  }));

  const axes: ErsAxis[] = (axesRes.data ?? []).map((r) => ({
    axisId: r.axis_id,
    axisNo: r.axis_no,
    name: r.name,
    correspondsXrl: r.corresponds_xrl ?? null,
    weight: Number(r.weight ?? 0.125),
    sortOrder: r.sort_order ?? 0,
  }));

  const criteria: ErsCriterion[] = (critRes.data ?? []).map((r) => ({
    criterionId: r.criterion_id,
    axisId: r.axis_id,
    code: r.code,
    name: r.name,
    rubric: (r.rubric ?? {}) as Record<string, string>,
    sortOrder: r.sort_order ?? 0,
  }));

  // (institution, criterion) ごとに evaluated_at 最新の 1 行だけ採用
  const assessmentsByInstitution: Record<string, ErsAssessment[]> = {};
  const seen = new Set<string>();
  for (const row of assessRes.data ?? []) {
    const key = `${row.institution_id}::${row.criterion_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (assessmentsByInstitution[row.institution_id] ||= []).push({
      criterionId: row.criterion_id,
      level: row.level ?? null,
      na: Boolean(row.na),
      note: row.note ?? null,
      evaluatedAt: row.evaluated_at,
    });
  }

  return { institutions, axes, criteria, assessmentsByInstitution };
}
