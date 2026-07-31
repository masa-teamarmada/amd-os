/**
 * ECR データ取得 (Supabase client 経由)。設計正本: pwa/design/institution_readiness.md
 */
import { createClient } from "@/lib/supabase/client";
import type {
  ErsInstitution,
  ErsAxis,
  ErsCriterion,
  ErsAssessment,
} from "@/lib/ers";
import {
  buildInstitutionProjectLink,
  type InstitutionProjectLink,
  type InstitutionProjectRow,
} from "@/lib/institution-projects";

export interface ErsBundle {
  institutions: ErsInstitution[];
  axes: ErsAxis[];
  criteria: ErsCriterion[];
  /** institution_id -> 各サブ軸の最新評価 (evaluated_at 最新を 1 つ) */
  assessmentsByInstitution: Record<string, ErsAssessment[]>;
  /** institution_id -> 全評価履歴。土壌×シーズの観測断面を再構成する正本。 */
  assessmentHistoryByInstitution: Record<string, ErsAssessment[]>;
  /** institution_id -> AMDとの機関PJ。カタログ所属そのものとは別レイヤー。 */
  institutionProjectsByInstitution: Record<string, InstitutionProjectLink[]>;
  /** institution_id -> 所属シーズ件数。SPSとは別の単純件数。 */
  seedCountByInstitution: Record<string, number>;
  /** ダッシュボードの事業化PJ一覧から機関PJを分けるための正本ID集合。 */
  institutionProjectIds: string[];
}

export async function fetchErsBundle(): Promise<ErsBundle> {
  const supabase = createClient();
  const [instRes, axesRes, critRes, assessRes, institutionProjectRes, seedInstitutionRes] = await Promise.all([
    supabase.from("institutions").select("*").order("sort_order", { ascending: true }),
    supabase.from("institution_capability_axes").select("*").order("sort_order", { ascending: true }),
    supabase.from("institution_capability_criteria").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("institution_assessments")
      .select("institution_id,criterion_id,level,na,note,evaluated_at,evaluation_version")
      .order("evaluated_at", { ascending: false }),
    supabase
      .from("institution_projects")
      .select("institution_id,project_id,engagement_scope,target_unit,ecosystem_goal,projects(project_name,status)"),
    supabase.from("seeds").select("institution_id").not("institution_id", "is", null),
  ]);

  const firstError = [instRes, axesRes, critRes, assessRes, institutionProjectRes, seedInstitutionRes]
    .find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const institutions: ErsInstitution[] = (instRes.data ?? []).map((r) => ({
    institutionId: r.institution_id,
    name: r.name,
    shortName: r.short_name ?? null,
    type: r.type ?? "other",
    description: r.description ?? null,
    region: r.region ?? null,
    contractStatus: r.contract_status ?? "unengaged",
    identityStatus: r.identity_status === "candidate" ? "candidate" : "verified",
    sortOrder: r.sort_order ?? 100,
  }));

  const institutionNameById = new Map(institutions.map((institution) => [institution.institutionId, institution.name]));
  const institutionProjectsByInstitution: Record<string, InstitutionProjectLink[]> = {};
  for (const row of (institutionProjectRes.data ?? []) as unknown as InstitutionProjectRow[]) {
    const link = buildInstitutionProjectLink(
      row,
      institutionNameById.get(row.institution_id) || row.institution_id,
    );
    (institutionProjectsByInstitution[row.institution_id] ||= []).push(link);
  }

  const seedCountByInstitution: Record<string, number> = {};
  for (const row of seedInstitutionRes.data ?? []) {
    const institutionId = row.institution_id as string | null;
    if (!institutionId) continue;
    seedCountByInstitution[institutionId] = (seedCountByInstitution[institutionId] ?? 0) + 1;
  }

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

  const assessmentHistoryByInstitution: Record<string, ErsAssessment[]> = {};
  for (const row of assessRes.data ?? []) {
    (assessmentHistoryByInstitution[row.institution_id] ||= []).push({
      criterionId: row.criterion_id,
      level: row.level ?? null,
      na: Boolean(row.na),
      note: row.note ?? null,
      evaluatedAt: row.evaluated_at,
      evaluationVersion: row.evaluation_version || "v1",
    });
  }

  // (institution, criterion) ごとに evaluated_at 最新の 1 行だけ採用
  const assessmentsByInstitution: Record<string, ErsAssessment[]> = {};
  const seen = new Set<string>();
  for (const [institutionId, history] of Object.entries(assessmentHistoryByInstitution)) {
    for (const assessment of history) {
      const key = `${institutionId}::${assessment.criterionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (assessmentsByInstitution[institutionId] ||= []).push(assessment);
    }
  }

  return {
    institutions,
    axes,
    criteria,
    assessmentsByInstitution,
    assessmentHistoryByInstitution,
    institutionProjectsByInstitution,
    seedCountByInstitution,
    institutionProjectIds: (institutionProjectRes.data ?? []).map((row) => String(row.project_id)),
  };
}
