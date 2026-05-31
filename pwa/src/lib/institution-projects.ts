export type InstitutionProjectLink = {
  institutionId: string;
  projectId: string;
  projectLabel: string;
  relationLabel: string;
  cockpitTitle: string;
  cockpitSummary: string;
};

const INSTITUTION_PROJECT_LINKS: Record<string, InstitutionProjectLink> = {
  inst_nims: {
    institutionId: "inst_nims",
    projectId: "p20",
    projectLabel: "CX / CryoX",
    relationLabel: "NIMS起点PJ",
    cockpitTitle: "NIMS PJコックピット",
    cockpitSummary:
      "NIMSの箱は研究機関ERSとして残し、進捗・月次・MTG履歴は既存のCXコックピットを関連PJとして扱う。",
  },
};

export function getInstitutionProjectLink(institutionId: string): InstitutionProjectLink | null {
  return INSTITUTION_PROJECT_LINKS[institutionId] ?? null;
}
