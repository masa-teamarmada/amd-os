export type InstitutionPolicyStatus = "unknown" | "not_started" | "drafting" | "established";
export type InstitutionPolicyItemKind = "status" | "attribute";
export type InstitutionPolicySourceType = "unknown" | "official" | "internal_doc" | "hearing" | "db" | "inferred";

export interface InstitutionPolicyItem {
  policyItemId: string;
  category: string;
  itemKind: InstitutionPolicyItemKind;
  key: string;
  label: string;
  description: string | null;
  valueType: string;
  sortOrder: number;
}

export interface InstitutionPolicyAssessment {
  policyItemId: string;
  status: InstitutionPolicyStatus;
  attributeValue: string | null;
  evidenceNote: string | null;
  sourceType: InstitutionPolicySourceType;
  sourceUrl: string | null;
  sourcePath: string | null;
  confirmedAt: string | null;
  evaluator: string | null;
}

export interface InstitutionPolicyBundle {
  items: InstitutionPolicyItem[];
  assessmentsByInstitution: Record<string, InstitutionPolicyAssessment[]>;
}

export const POLICY_STATUS_LABEL: Record<InstitutionPolicyStatus, string> = {
  unknown: "未確認",
  not_started: "未整備",
  drafting: "検討中",
  established: "整備済み",
};

export const POLICY_STATUS_TONE: Record<InstitutionPolicyStatus, string> = {
  unknown: "bg-zinc-100 text-zinc-600 border-zinc-300",
  not_started: "bg-rose-50 text-rose-700 border-rose-200",
  drafting: "bg-amber-50 text-amber-800 border-amber-200",
  established: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const POLICY_SOURCE_LABEL: Record<InstitutionPolicySourceType, string> = {
  unknown: "未設定",
  official: "公式",
  internal_doc: "内部資料",
  hearing: "ヒアリング",
  db: "OS/DB",
  inferred: "推定",
};

export const POLICY_STATUSES: InstitutionPolicyStatus[] = [
  "unknown",
  "not_started",
  "drafting",
  "established",
];

export const POLICY_SOURCE_TYPES: InstitutionPolicySourceType[] = [
  "unknown",
  "official",
  "internal_doc",
  "hearing",
  "db",
  "inferred",
];
