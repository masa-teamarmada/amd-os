import "server-only";

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { calculateSeedSpsScore, type SeedSpsAssessmentAxes, type SeedSpsScoreResult } from "@/lib/seed-sps";
import { computeErs, type ErsAxis, type ErsAssessment, type ErsCriterion } from "@/lib/ers";
import { projectStatusLifecycle } from "@/lib/institution-projects";

// Rich institution workspace bundle (slug-scoped). Unlike public-workspace-data.ts (top-page
// listing, no auth), the caller here has already resolved that the requesting principal is
// allowed to see this institution workspace at all — this function only enforces the DB-side
// "active" invariants (workspace/scope status) and the per-seed richLinkAllowed gate, it does
// not itself decide whether the caller may reach `slug`. Callers must not skip that upstream check.
//
// Field allowlist is intentionally narrow: summary/description/url/source/contact/evidence-shaped
// columns (institutions.description, seeds.summary/public_summary/*_url, seed_contact_log, any
// evidence_refs) must never be added here. SPS (seed_sps_assessments) and ECR
// (institution_assessments) select only the score-shaped columns below — axis_evidence /
// evaluator / frl (SPS) and note / evaluator / rubric / corresponds_xrl (ECR) must never be
// added. ECR and SPS stay on separate DTO properties and are never summed together.
export type InstitutionWorkspaceSeedSps = {
  evaluatedAt: string;
  status: string;
  confidence: string | null;
  missingAxes: string[];
  score: number | null;
  components: SeedSpsScoreResult["components"];
  axes: SeedSpsAssessmentAxes;
};

export type InstitutionWorkspaceEcr = {
  score: number | null;
  assessedCriteria: number;
  totalCriteria: number;
  evaluatedAt: string | null;
  axes: Array<{
    axisNo: number;
    name: string;
    score: number | null;
    assessedCount: number;
    totalCount: number;
  }>;
};

export type InstitutionWorkspaceData = {
  slug: string;
  name: string;
  institution: {
    id: string;
    name: string;
    type: string;
    region: string | null;
  };
  projects: Array<{
    projectId: string;
    sharedSurface: "summary" | "workspace";
    projectName: string;
    status: string;
    engagementScope: string | null;
    targetUnit: string | null;
    ecosystemGoal: string | null;
  }>;
  seeds: Array<{
    id: string;
    title: string;
    orgName: string;
    researcherName: string | null;
    status: string;
    projects: Array<{
      projectId: string;
      commercializationStage: string | null;
      ventureName: string | null;
      projectName: string;
      status: string;
      richLinkAllowed: boolean;
    }>;
    sps: InstitutionWorkspaceSeedSps | null;
  }>;
  ecr: InstitutionWorkspaceEcr;
};

type WorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  institutions: { institution_id: string; name: string; type: string; region: string | null } | null;
};

type ProjectScopeRow = { project_id: string; shared_surface: "summary" | "workspace" };
type ProjectRow = { project_id: string; project_name: string; status: string };
type InstitutionProjectRow = {
  project_id: string;
  engagement_scope: string | null;
  target_unit: string | null;
  ecosystem_goal: string | null;
};

type SeedScopeRow = { seed_id: string };
type SeedRow = {
  id: string;
  title: string;
  org_name: string;
  researcher_name: string | null;
  status: string;
};
type SeedProjectRow = {
  project_id: string;
  seed_id: string;
  commercialization_stage: string | null;
  venture_name: string | null;
};

type SeedSpsAssessmentRow = SeedSpsAssessmentAxes & {
  seed_id: string;
  evaluated_at: string;
  status: string;
  confidence: string | null;
  missing_axes: string[] | null;
};

type CapabilityAxisRow = {
  axis_id: string;
  axis_no: number;
  name: string;
  weight: number;
  sort_order: number;
};
type CapabilityCriterionRow = {
  criterion_id: string;
  axis_id: string;
  code: string;
  name: string;
  sort_order: number;
};
type InstitutionAssessmentRow = {
  criterion_id: string;
  level: number | null;
  na: boolean;
  evaluated_at: string;
  evaluation_version: string;
};

function seedLifecyclePriority(seed: InstitutionWorkspaceData["seeds"][number]): number {
  const hasSpsScore = seed.sps?.score != null;
  const priorities = seed.projects.map((project) => {
    const lifecycle = projectStatusLifecycle(project.status);
    if (lifecycle === "realized") return 0;
    if (lifecycle === "considering") return 1;
    return hasSpsScore ? 2 : 3;
  });
  if (priorities.length > 0) return Math.min(...priorities);
  return hasSpsScore ? 2 : 3;
}

function sortInstitutionWorkspaceSeeds(
  seeds: InstitutionWorkspaceData["seeds"],
): InstitutionWorkspaceData["seeds"] {
  return [...seeds].sort((a, b) => {
    const priorityDiff = seedLifecyclePriority(a) - seedLifecyclePriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.title.localeCompare(b.title, "ja");
  });
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase service role env vars are required");
  return createServiceClient(url, serviceKey);
}

export async function getInstitutionWorkspaceData(
  slug: string,
  authorizedProjectIds: string[],
): Promise<InstitutionWorkspaceData | null> {
  const service = getServiceClient();

  const { data: workspace, error: workspaceError } = await service
    .from("institution_workspaces")
    .select("id,slug,name,institutions(institution_id,name,type,region)")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle<WorkspaceRow>();

  if (workspaceError) throw new Error(`institution workspace lookup: ${workspaceError.message}`);
  if (!workspace || !workspace.institutions) return null;

  const [{ data: projectScopeRows, error: projectScopeError }, { data: seedScopeRows, error: seedScopeError }] = await Promise.all([
    service
      .from("institution_workspace_project_scopes")
      .select("project_id,shared_surface")
      .eq("workspace_id", workspace.id)
      .eq("status", "active")
      .returns<ProjectScopeRow[]>(),
    service
      .from("institution_workspace_seed_scopes")
      .select("seed_id")
      .eq("workspace_id", workspace.id)
      .eq("status", "active")
      .returns<SeedScopeRow[]>(),
  ]);

  if (projectScopeError) throw new Error(`institution workspace project scopes: ${projectScopeError.message}`);
  if (seedScopeError) throw new Error(`institution workspace seed scopes: ${seedScopeError.message}`);

  const scopedProjectIds = Array.from(new Set((projectScopeRows ?? []).map((row) => row.project_id)));
  const scopedSeedIds = Array.from(new Set((seedScopeRows ?? []).map((row) => row.seed_id)));

  let projectRows: ProjectRow[] = [];
  let institutionProjectRows: InstitutionProjectRow[] = [];
  if (scopedProjectIds.length > 0) {
    const [{ data: projects, error: projectsError }, { data: institutionProjects, error: institutionProjectsError }] = await Promise.all([
      service.from("projects").select("project_id,project_name,status").in("project_id", scopedProjectIds).returns<ProjectRow[]>(),
      service.from("institution_projects").select("project_id,engagement_scope,target_unit,ecosystem_goal").in("project_id", scopedProjectIds).returns<InstitutionProjectRow[]>(),
    ]);
    if (projectsError) throw new Error(`institution workspace projects: ${projectsError.message}`);
    if (institutionProjectsError) throw new Error(`institution workspace institution_projects: ${institutionProjectsError.message}`);
    projectRows = projects ?? [];
    institutionProjectRows = institutionProjects ?? [];
  }

  let seedRows: SeedRow[] = [];
  let seedProjectRows: SeedProjectRow[] = [];
  let seedProjectProjectRows: ProjectRow[] = [];
  let seedSpsRows: SeedSpsAssessmentRow[] = [];
  if (scopedSeedIds.length > 0) {
    const [{ data: seeds, error: seedsError }, { data: seedProjects, error: seedProjectsError }, { data: seedSpsAssessments, error: seedSpsError }] = await Promise.all([
      service.from("seeds").select("id,title,org_name,researcher_name,status").in("id", scopedSeedIds).returns<SeedRow[]>(),
      service.from("seed_projects").select("project_id,seed_id,commercialization_stage,venture_name").in("seed_id", scopedSeedIds).returns<SeedProjectRow[]>(),
      service
        .from("seed_sps_assessments")
        .select(
          "seed_id,evaluated_at,mu_a,mu_i,mu_g,potential,trl,brl,grl,srl,hrl,f_character,f_cap,r_net,shallow_tech_mode,status,confidence,missing_axes",
        )
        .in("seed_id", scopedSeedIds)
        .order("evaluated_at", { ascending: false })
        .returns<SeedSpsAssessmentRow[]>(),
    ]);
    if (seedsError) throw new Error(`institution workspace seeds: ${seedsError.message}`);
    if (seedProjectsError) throw new Error(`institution workspace seed_projects: ${seedProjectsError.message}`);
    if (seedSpsError) throw new Error(`institution workspace seed_sps_assessments: ${seedSpsError.message}`);
    seedRows = seeds ?? [];
    seedProjectRows = seedProjects ?? [];
    seedSpsRows = seedSpsAssessments ?? [];

    const seedProjectIds = Array.from(new Set(seedProjectRows.map((row) => row.project_id)));
    if (seedProjectIds.length > 0) {
      const { data: seedProjectProjects, error: seedProjectProjectsError } = await service
        .from("projects")
        .select("project_id,project_name,status")
        .in("project_id", seedProjectIds)
        .returns<ProjectRow[]>();
      if (seedProjectProjectsError) throw new Error(`institution workspace seed_projects.projects: ${seedProjectProjectsError.message}`);
      seedProjectProjectRows = seedProjectProjects ?? [];
    }
  }

  const { data: capabilityAxisRows, error: capabilityAxisError } = await service
    .from("institution_capability_axes")
    .select("axis_id,axis_no,name,weight,sort_order")
    .order("sort_order", { ascending: true })
    .returns<CapabilityAxisRow[]>();
  if (capabilityAxisError) throw new Error(`institution workspace capability axes: ${capabilityAxisError.message}`);

  const { data: capabilityCriterionRows, error: capabilityCriterionError } = await service
    .from("institution_capability_criteria")
    .select("criterion_id,axis_id,code,name,sort_order")
    .order("sort_order", { ascending: true })
    .returns<CapabilityCriterionRow[]>();
  if (capabilityCriterionError) throw new Error(`institution workspace capability criteria: ${capabilityCriterionError.message}`);

  const { data: institutionAssessmentRows, error: institutionAssessmentError } = await service
    .from("institution_assessments")
    .select("criterion_id,level,na,evaluated_at,evaluation_version")
    .eq("institution_id", workspace.institutions.institution_id)
    .order("evaluated_at", { ascending: false })
    .returns<InstitutionAssessmentRow[]>();
  if (institutionAssessmentError) throw new Error(`institution workspace institution_assessments: ${institutionAssessmentError.message}`);

  const projectById = new Map(projectRows.map((row) => [row.project_id, row]));
  const institutionProjectById = new Map(institutionProjectRows.map((row) => [row.project_id, row]));
  const seedProjectsBySeedId = new Map<string, SeedProjectRow[]>();
  for (const row of seedProjectRows) {
    const list = seedProjectsBySeedId.get(row.seed_id);
    if (list) list.push(row);
    else seedProjectsBySeedId.set(row.seed_id, [row]);
  }
  const seedProjectProjectById = new Map(seedProjectProjectRows.map((row) => [row.project_id, row]));
  const authorizedProjectIdSet = new Set(authorizedProjectIds);

  const latestSeedSpsBySeedId = new Map<string, SeedSpsAssessmentRow>();
  for (const row of seedSpsRows) {
    if (!latestSeedSpsBySeedId.has(row.seed_id)) latestSeedSpsBySeedId.set(row.seed_id, row);
  }

  const ersAxes: ErsAxis[] = (capabilityAxisRows ?? []).map((row) => ({
    axisId: row.axis_id,
    axisNo: row.axis_no,
    name: row.name,
    correspondsXrl: null,
    weight: Number(row.weight ?? 0),
    sortOrder: row.sort_order,
  }));

  const ersCriteria: ErsCriterion[] = (capabilityCriterionRows ?? []).map((row) => ({
    criterionId: row.criterion_id,
    axisId: row.axis_id,
    code: row.code,
    name: row.name,
    rubric: {},
    sortOrder: row.sort_order,
  }));

  const seenCriterionIds = new Set<string>();
  const ersAssessments: ErsAssessment[] = [];
  for (const row of institutionAssessmentRows ?? []) {
    if (seenCriterionIds.has(row.criterion_id)) continue;
    seenCriterionIds.add(row.criterion_id);
    ersAssessments.push({
      criterionId: row.criterion_id,
      level: row.level,
      na: Boolean(row.na),
      note: null,
      evaluatedAt: row.evaluated_at,
      evaluationVersion: row.evaluation_version || "v1",
    });
  }

  const ersResult = computeErs(ersAxes, ersCriteria, ersAssessments);
  const ecr: InstitutionWorkspaceEcr = {
    score: ersResult.ers,
    assessedCriteria: ersResult.assessedCriteria,
    totalCriteria: ersResult.totalCriteria,
    evaluatedAt: institutionAssessmentRows?.[0]?.evaluated_at ?? null,
    axes: ersResult.axisScores.map((axis) => ({
      axisNo: axis.axisNo,
      name: axis.name,
      score: axis.score,
      assessedCount: axis.assessedCount,
      totalCount: axis.totalCount,
    })),
  };

  const projects = (projectScopeRows ?? [])
    .map((scope) => {
      const project = projectById.get(scope.project_id);
      if (!project) return null;
      const institutionProject = institutionProjectById.get(scope.project_id) ?? null;
      return {
        projectId: scope.project_id,
        sharedSurface: scope.shared_surface,
        projectName: project.project_name,
        status: project.status,
        engagementScope: institutionProject?.engagement_scope ?? null,
        targetUnit: institutionProject?.target_unit ?? null,
        ecosystemGoal: institutionProject?.ecosystem_goal ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const seeds = sortInstitutionWorkspaceSeeds(
    (seedRows ?? []).map((seed) => {
      const seedProjects = (seedProjectsBySeedId.get(seed.id) ?? [])
        .map((seedProject) => {
          const seedProjectProject = seedProjectProjectById.get(seedProject.project_id);
          if (!seedProjectProject) return null;
          return {
            projectId: seedProject.project_id,
            commercializationStage: seedProject.commercialization_stage,
            ventureName: seedProject.venture_name,
            projectName: seedProjectProject.project_name,
            status: seedProjectProject.status,
            richLinkAllowed: authorizedProjectIdSet.has(seedProject.project_id),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const latestSps = latestSeedSpsBySeedId.get(seed.id);
      const sps: InstitutionWorkspaceSeedSps | null = latestSps
        ? (() => {
            const axes: SeedSpsAssessmentAxes = {
              mu_a: latestSps.mu_a,
              mu_i: latestSps.mu_i,
              mu_g: latestSps.mu_g,
              potential: latestSps.potential,
              trl: latestSps.trl,
              brl: latestSps.brl,
              grl: latestSps.grl,
              srl: latestSps.srl,
              hrl: latestSps.hrl,
              f_character: latestSps.f_character,
              f_cap: latestSps.f_cap,
              r_net: latestSps.r_net,
              shallow_tech_mode: latestSps.shallow_tech_mode,
            };
            const scored = calculateSeedSpsScore(axes);
            return {
              evaluatedAt: latestSps.evaluated_at,
              status: latestSps.status,
              confidence: latestSps.confidence,
              missingAxes: scored.missingAxes,
              score: scored.score,
              components: scored.components,
              axes,
            };
          })()
        : null;

      return {
        id: seed.id,
        title: seed.title,
        orgName: seed.org_name,
        researcherName: seed.researcher_name,
        status: seed.status,
        projects: seedProjects,
        sps,
      };
    }),
  );

  return {
    slug: workspace.slug,
    name: workspace.name,
    institution: {
      id: workspace.institutions.institution_id,
      name: workspace.institutions.name,
      type: workspace.institutions.type,
      region: workspace.institutions.region,
    },
    projects,
    seeds,
    ecr,
  };
}
