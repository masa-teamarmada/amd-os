import type { Seed, SeedOrgType } from "@/types/seeds";

export interface SeedInstitutionOption {
  institution_id: string;
  name: string;
  type: string;
  region: string | null;
}

export type SeedInstitutionDraft = Pick<
  Partial<Seed>,
  "institution_id" | "org_name" | "org_type" | "org_region"
>;

/** institutions.type と seeds.org_type の語彙差を、シーズ側の正本語彙へ寄せる。 */
export function seedOrgTypeFromInstitutionType(type: string | null | undefined): SeedOrgType {
  switch ((type ?? "").trim().toLowerCase()) {
    case "university":
      return "university";
    case "kosen":
    case "college_of_technology":
      return "kosen";
    case "national_lab":
    case "research_institute":
    case "public_research_institute":
      return "national_lab";
    case "private_lab":
    case "company":
      return "private_lab";
    default:
      return "other";
  }
}

/** カタログ選択時に、FKと表示用スナップショットを同じ操作で更新する。 */
export function applySeedInstitutionSelection(
  draft: SeedInstitutionDraft,
  institutions: SeedInstitutionOption[],
  institutionId: string | null,
): SeedInstitutionDraft {
  if (!institutionId) {
    // 紐付けを外しても、入力中の機関名は自由入力の初期値として残す。
    return { ...draft, institution_id: null };
  }

  const institution = institutions.find((item) => item.institution_id === institutionId);
  if (!institution) return draft;

  return {
    ...draft,
    institution_id: institution.institution_id,
    org_name: institution.name,
    org_type: seedOrgTypeFromInstitutionType(institution.type),
    org_region: institution.region,
  };
}
