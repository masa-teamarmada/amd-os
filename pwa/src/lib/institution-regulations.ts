export type RegulationState =
  | "unconfirmed"
  | "not_established"
  | "drafting"
  | "review"
  | "approved"
  | "effective"
  | "not_applicable";
export type RegulationVersionState =
  "reference" | "draft" | "review" | "approved" | "effective" | "superseded";

export interface RegulationType {
  regulationTypeId: string;
  groupKey: "core" | "supporting";
  label: string;
  shortLabel: string;
  description: string | null;
  sortOrder: number;
}
export interface InstitutionRegulation {
  regulationId: string;
  institutionId: string;
  title: string;
  stage: number;
  lifecycleState: string;
  currentStateNote: string | null;
  nextGate: string | null;
  nextGateTiming: string | null;
  updatedAt: string;
}
export interface RegulationCell {
  institutionId: string;
  regulationTypeId: string;
  regulationId: string | null;
  state: RegulationState;
  confirmedAt: string | null;
}
export interface RegulationVersion {
  versionId: string;
  regulationId: string;
  label: string;
  fileName: string | null;
  versionState: RegulationVersionState;
  externalUrl: string | null;
  versionDate: string | null;
  isCurrent: boolean;
  createdAt: string;
}
export interface RegulationBundle {
  types: RegulationType[];
  regulations: InstitutionRegulation[];
  cells: RegulationCell[];
  versions: RegulationVersion[];
  canEdit: boolean;
}

export const REGULATION_STATE_LABEL: Record<RegulationState, string> = {
  unconfirmed: "未確認",
  not_established: "未整備",
  drafting: "作成中",
  review: "審議中",
  approved: "決裁済",
  effective: "◯",
  not_applicable: "対象外",
};
export const VERSION_STATE_LABEL: Record<RegulationVersionState, string> = {
  reference: "参考",
  draft: "作成中",
  review: "審議中",
  approved: "決裁済",
  effective: "施行中",
  superseded: "旧版",
};

export async function fetchInstitutionRegulations(
  institutionId?: string,
): Promise<RegulationBundle> {
  const query = institutionId
    ? `?institutionId=${encodeURIComponent(institutionId)}`
    : "";
  const response = await fetch(`/api/institution-regulations${query}`, {
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || "規程リストを読み込めなかった");
  return body;
}

export function currentVersion(
  versions: RegulationVersion[],
  regulationId: string,
) {
  return (
    versions
      .filter((version) => version.regulationId === regulationId)
      .sort(
        (a, b) =>
          Number(b.isCurrent) - Number(a.isCurrent) ||
          (b.versionDate || b.createdAt).localeCompare(
            a.versionDate || a.createdAt,
          ),
      )[0] ?? null
  );
}

export function regulationHref(
  institutionId: string,
  regulation: InstitutionRegulation,
  versions: RegulationVersion[],
) {
  return (
    currentVersion(versions, regulation.regulationId)?.externalUrl ||
    `/institutions/${institutionId}/regulations/${regulation.regulationId}`
  );
}
