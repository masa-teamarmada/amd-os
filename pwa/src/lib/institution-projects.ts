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

const CURRENT_PROJECT_STATUSES = new Set(["active", "sales", "draft"]);

export function isCurrentProjectStatus(status: string | null | undefined): boolean {
  return CURRENT_PROJECT_STATUSES.has(String(status || "").toLowerCase());
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

/** 現行契約を優先し、終了済みしかなければ最新の履歴を返す。 */
export function selectPrimaryInstitutionProject(
  links: InstitutionProjectLink[] | null | undefined,
): InstitutionProjectLink | null {
  if (!links?.length) return null;
  return [...links].sort((a, b) => {
    const currentDiff = Number(isCurrentProjectStatus(b.projectStatus)) - Number(isCurrentProjectStatus(a.projectStatus));
    return currentDiff || b.projectId.localeCompare(a.projectId, "ja");
  })[0];
}
