export type InstitutionProjectLink = {
  institutionId: string;
  projectId: string;
  projectLabel: string;
  projectStatus: string;
  relationLabel: string;
  cockpitTitle: string;
  cockpitSummary: string;
  engagementScope: string | null;
  targetUnit: string | null;
  ecosystemGoal: string | null;
};

export type InstitutionProjectRow = {
  institution_id: string;
  project_id: string;
  engagement_scope: string | null;
  target_unit: string | null;
  ecosystem_goal: string | null;
  projects:
    | { project_name: string | null; status: string | null }
    | { project_name: string | null; status: string | null }[]
    | null;
};

export type ProjectLifecycle = "realized" | "considering" | "none";

const REALIZED_PROJECT_STATUSES = new Set(["active", "ended", "frozen"]);
const CONSIDERING_PROJECT_STATUSES = new Set(["sales", "draft"]);

export function isCurrentProjectStatus(status: string | null | undefined): boolean {
  return REALIZED_PROJECT_STATUSES.has(String(status || "").toLowerCase());
}

export function projectStatusLifecycle(status: string | null | undefined): ProjectLifecycle {
  const normalized = String(status || "").toLowerCase();
  if (REALIZED_PROJECT_STATUSES.has(normalized)) return "realized";
  if (CONSIDERING_PROJECT_STATUSES.has(normalized)) return "considering";
  return "none";
}

export function institutionProjectLifecycle(
  link: InstitutionProjectLink | null | undefined,
  contractStatus?: string | null,
): ProjectLifecycle {
  const linked = projectStatusLifecycle(link?.projectStatus);
  if (linked !== "none") return linked;
  const contract = String(contractStatus || "").toLowerCase();
  if (contract === "active" || contract === "past") return "realized";
  if (contract === "draft" || contract === "prospect") return "considering";
  return "none";
}

export function projectLifecyclePriority(lifecycle: ProjectLifecycle): 0 | 1 | 2 {
  if (lifecycle === "realized") return 0;
  if (lifecycle === "considering") return 1;
  return 2;
}

export function buildInstitutionProjectLink(
  row: InstitutionProjectRow,
  institutionName: string,
): InstitutionProjectLink {
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  const projectLabel = project?.project_name || row.project_id;
  const projectStatus = project?.status || "unknown";
  const scopeLabel = row.engagement_scope === "university_wide" ? "全学" : "機関";

  return {
    institutionId: row.institution_id,
    projectId: row.project_id,
    projectLabel,
    projectStatus,
    relationLabel: `${scopeLabel}エコシステム構築PJ`,
    cockpitTitle: `${institutionName} 研究機関コックピット`,
    cockpitSummary:
      "研究機関カタログとECRはこの画面に残し、契約・進捗・月次・MTG・タスクは関連PJの運用情報として重ねて表示する。",
    engagementScope: row.engagement_scope,
    targetUnit: row.target_unit,
    ecosystemGoal: row.ecosystem_goal,
  };
}

/** PJ化済み、PJ化検討中、その他の順で代表関係を返す。 */
export function selectPrimaryInstitutionProject(
  links: InstitutionProjectLink[] | null | undefined,
): InstitutionProjectLink | null {
  if (!links?.length) return null;
  return [...links].sort((a, b) => {
    const lifecycleDiff = projectLifecyclePriority(projectStatusLifecycle(a.projectStatus))
      - projectLifecyclePriority(projectStatusLifecycle(b.projectStatus));
    return lifecycleDiff || b.projectId.localeCompare(a.projectId, "ja");
  })[0];
}
