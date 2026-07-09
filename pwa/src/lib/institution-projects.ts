export type InstitutionProjectLink = {
  institutionId: string;
  projectId: string;
  projectLabel: string;
  relationLabel: string;
  cockpitTitle: string;
  cockpitSummary: string;
};

const INSTITUTION_PROJECT_LINKS: Record<string, InstitutionProjectLink> = {
  inst_kute: {
    institutionId: "inst_kute",
    projectId: "p25",
    projectLabel: "KUTE",
    relationLabel: "研究機関エコシステム構築PJ",
    cockpitTitle: "KUTE 研究機関コックピット",
    cockpitSummary:
      "KUTEの箱は研究機関ERSとして残し、進捗・月次・MTG履歴は既存のKUTE PJコックピットを関連PJとして扱う。",
  },
  inst_nims: {
    institutionId: "inst_nims",
    projectId: "p28",
    projectLabel: "NIMS",
    relationLabel: "NIMS OS導入PJ",
    cockpitTitle: "NIMS 研究機関コックピット",
    cockpitSummary:
      "NIMSの箱は研究機関ERSとして残し、進捗・月次・MTG履歴は正式なNIMS OS導入PJコックピットを関連PJとして扱う。CXは初期ユースケースとして分けて見る。",
  },
};

const INSTITUTION_DASHBOARD_PROJECT_IDS = new Set(["p25", "p28"]);

export function getInstitutionProjectLink(institutionId: string): InstitutionProjectLink | null {
  return INSTITUTION_PROJECT_LINKS[institutionId] ?? null;
}

export function isInstitutionDashboardProject(project: {
  projectId?: string | null;
  projectName?: string | null;
  displayName?: string | null;
  shortLabel?: string | null;
  projectCategory?: string | null;
}) {
  const category = (project.projectCategory || "dtsu").toLowerCase();
  if (category === "ecosystem") return true;
  const id = String(project.projectId || "");
  if (INSTITUTION_DASHBOARD_PROJECT_IDS.has(id)) return true;
  const label = `${project.projectName || ""} ${project.displayName || ""} ${project.shortLabel || ""}`.toLowerCase();
  return label.includes("kute") || label.includes("nims");
}
