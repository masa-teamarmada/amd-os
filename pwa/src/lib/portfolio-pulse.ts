/**
 * portfolio-pulse — 研究機関・シーズ・PJを横断した優先順位モデル。
 *
 * 旧 /portfolio-preview の buildPreviewModel を /dashboard ホームの正式IAとして移設したもの
 * (2026-08-02 まさ確定「研究ポートフォリオ中心IAを現行 /dashboard に正式採用」)。
 * 研究機関・シーズは契約有無に依存しない母集団として PJ化済み→PJ化検討中→評価済み→その他の
 * 優先順位を維持し、PJは両者から契約成立後に生まれる運用レイヤーとして扱う。
 * ECR (研究機関環境) と SPS (個別シーズ) は別集計のまま合算しない。
 */
import { computeErs } from "@/lib/ers";
import type { ErsBundle } from "@/lib/ers-data";
import {
  institutionProjectLifecycle,
  projectLifecyclePriority,
  projectStatusLifecycle,
  selectPrimaryInstitutionProject,
  type InstitutionProjectLink,
  type ProjectLifecycle,
} from "@/lib/institution-projects";
import { seedListPriority, seedProjectLifecycle } from "@/lib/kute-seeds-scoring";
import type { DashProject } from "@/lib/supabase-data";
import type { SeedPublicView } from "@/types/seeds";

export type PortfolioPulseData = {
  institutionBundle: ErsBundle;
  seeds: SeedPublicView[];
  projects: DashProject[];
};

export type InstitutionRow = {
  institutionId: string;
  name: string;
  shortName: string | null;
  type: string;
  region: string | null;
  lifecycle: ProjectLifecycle;
  projectLink: InstitutionProjectLink | null;
  seedCount: number;
  ecr: number | null;
  assessedCriteria: number;
  totalCriteria: number;
};

export type ProjectOrigin = {
  kind: "institution" | "seed";
  id: string;
  label: string;
  parentLabel?: string;
  href: string;
};

export type ProjectRow = {
  project: DashProject;
  origins: ProjectOrigin[];
  lifecycle: ProjectLifecycle;
  needsClassification: boolean;
};

export type PortfolioPulseModel = {
  institutionRows: InstitutionRow[];
  seedRows: SeedPublicView[];
  projectRows: ProjectRow[];
  counts: {
    institutions: number;
    institutionRealized: number;
    institutionConsidering: number;
    institutionEcrReady: number;
    seeds: number;
    seedRealized: number;
    seedConsidering: number;
    seedScoredWithoutProject: number;
    seedSpsReady: number;
    projects: number;
    activeProjects: number;
    consideringProjects: number;
    unclassifiedProjects: number;
  };
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: "稼働中",
  sales: "PJ化検討中",
  draft: "PJ化検討中",
  ended: "終了",
  frozen: "停止中",
  advisor: "アドバイザー",
};

export const LIFECYCLE_LABEL: Record<ProjectLifecycle, string> = {
  realized: "PJ化済み",
  considering: "PJ化検討中",
  none: "PJなし",
};

function projectStatusPriority(status: string) {
  if (status === "active") return 0;
  if (status === "sales" || status === "draft") return 1;
  if (status === "frozen") return 2;
  if (status === "ended") return 3;
  return 4;
}

export function buildPortfolioPulseModel(data: PortfolioPulseData): PortfolioPulseModel {
  const { institutionBundle, seeds, projects } = data;
  const institutionRows = institutionBundle.institutions
    .map((institution): InstitutionRow => {
      const projectLink = selectPrimaryInstitutionProject(
        institutionBundle.institutionProjectsByInstitution[institution.institutionId],
      );
      const result = computeErs(
        institutionBundle.axes,
        institutionBundle.criteria,
        institutionBundle.assessmentsByInstitution[institution.institutionId] ?? [],
      );

      return {
        institutionId: institution.institutionId,
        name: institution.name,
        shortName: institution.shortName,
        type: institution.type,
        region: institution.region,
        lifecycle: institutionProjectLifecycle(projectLink, institution.contractStatus),
        projectLink,
        seedCount: institutionBundle.seedCountByInstitution[institution.institutionId] ?? 0,
        ecr: result.ers,
        assessedCriteria: result.assessedCriteria,
        totalCriteria: result.totalCriteria,
      };
    })
    .sort((a, b) => {
      const priority = projectLifecyclePriority(a.lifecycle) - projectLifecyclePriority(b.lifecycle);
      return priority || a.name.localeCompare(b.name, "ja");
    });

  const seedRows = [...seeds].sort((a, b) => {
    const priority = seedListPriority(a) - seedListPriority(b);
    if (priority) return priority;
    const aScore = a.latest_sps?.status === "ready" ? a.latest_sps.score : null;
    const bScore = b.latest_sps?.status === "ready" ? b.latest_sps.score : null;
    if (aScore == null && bScore != null) return 1;
    if (aScore != null && bScore == null) return -1;
    if (aScore != null && bScore != null && aScore !== bScore) return bScore - aScore;
    return a.title.localeCompare(b.title, "ja");
  });

  const originByProject = new Map<string, ProjectOrigin[]>();
  const addOrigin = (projectId: string, origin: ProjectOrigin) => {
    const current = originByProject.get(projectId);
    if (current) current.push(origin);
    else originByProject.set(projectId, [origin]);
  };

  for (const institution of institutionBundle.institutions) {
    for (const link of institutionBundle.institutionProjectsByInstitution[institution.institutionId] ?? []) {
      addOrigin(link.projectId, {
        kind: "institution",
        id: institution.institutionId,
        label: institution.name,
        href: `/institutions/${encodeURIComponent(institution.institutionId)}/cockpit`,
      });
    }
  }

  for (const seed of seeds) {
    for (const link of seed.project_links ?? []) {
      addOrigin(link.project_id, {
        kind: "seed",
        id: seed.id,
        label: seed.title,
        parentLabel: seed.org_name,
        href: `/seeds/${encodeURIComponent(seed.id)}`,
      });
    }
  }

  const projectRows = projects
    .filter((project) => project.projectId !== "p00")
    .map((project): ProjectRow => {
      const origins = originByProject.get(project.projectId) ?? [];
      return {
        project,
        origins,
        lifecycle: projectStatusLifecycle(project.status),
        needsClassification: origins.length === 0,
      };
    })
    .sort((a, b) => {
      const priority = projectStatusPriority(a.project.status) - projectStatusPriority(b.project.status);
      return priority || a.project.projectName.localeCompare(b.project.projectName, "ja");
    });

  const seedRealized = seedRows.filter((seed) => seedProjectLifecycle(seed) === "realized").length;
  const seedConsidering = seedRows.filter((seed) => seedProjectLifecycle(seed) === "considering").length;

  return {
    institutionRows,
    seedRows,
    projectRows,
    counts: {
      institutions: institutionRows.length,
      institutionRealized: institutionRows.filter((row) => row.lifecycle === "realized").length,
      institutionConsidering: institutionRows.filter((row) => row.lifecycle === "considering").length,
      institutionEcrReady: institutionRows.filter((row) => row.ecr != null).length,
      seeds: seedRows.length,
      seedRealized,
      seedConsidering,
      seedScoredWithoutProject: seedRows.filter((seed) => seedListPriority(seed) === 2).length,
      seedSpsReady: seedRows.filter((seed) => seed.latest_sps?.status === "ready").length,
      projects: projectRows.length,
      activeProjects: projectRows.filter((row) => row.project.status === "active").length,
      consideringProjects: projectRows.filter((row) => ["sales", "draft"].includes(row.project.status)).length,
      unclassifiedProjects: projectRows.filter((row) => row.needsClassification).length,
    },
  };
}
