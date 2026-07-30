/**
 * PoC候補先（排液提供先）の識別と段階整理。
 * PoC候補も関係先の一種として同じ台帳へ表示し、このmoduleを候補判定と段階順の単一ロジックにする。
 * 判定は `roleLabel` の接頭辞だけで行う（stage は接触が進むと変わるため識別子に使えない）。
 */

export const SX_POC_ROLE_PREFIX = "PoC候補先";
export const SX_POC_CONTACTED_ROLE_PREFIX = "PoC接触先";

export type SxPocPartnerLike = {
  id: string;
  name: string;
  roleLabel: string;
  relationshipStage: string;
  agreedScope: string;
  nextCommitment: string;
  ownerLabel: string;
  currentBallSide: string;
  currentBallOwner: string | null;
  lastContactDate?: string | null;
};

export type SxPocStageKey = "untouched" | "talking" | "agreed" | "secured";

export type SxPocStageGroup<T extends SxPocPartnerLike = SxPocPartnerLike> = {
  key: SxPocStageKey;
  label: string;
  /** 5秒で読む用の短い説明。段階名だけでは何が起きたのか伝わらないため必ず添える。 */
  hint: string;
  partners: T[];
};

/** PoC候補先・接触先か。関係先台帳の除外条件と、このボードの抽出条件は必ず同じ関数を使う。 */
export function sxIsPocCandidate(partner: { roleLabel: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) || partner.roleLabel.startsWith(SX_POC_CONTACTED_ROLE_PREFIX);
}

/** 接触が一度も無い候補。実行中の緊急・ボール集計からは除くが、関係先の母数と一覧には含める。 */
export function sxIsUntouchedPocCandidate(partner: { roleLabel: string; relationshipStage: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) && partner.relationshipStage === "candidate";
}

export function sxPocStageOf(partner: SxPocPartnerLike): SxPocStageKey {
  if (partner.relationshipStage === "executing") return "secured";
  if (partner.relationshipStage === "condition_alignment" || partner.relationshipStage === "agreement_confirmation") return "agreed";
  if (partner.relationshipStage === "candidate") return "untouched";
  return "talking";
}

export const SX_POC_STAGE_ORDER: Array<{ key: SxPocStageKey; label: string; hint: string }> = [
  { key: "secured", label: "排液 調達済", hint: "実際に排液を受け取り、検証へ回せる" },
  { key: "agreed", label: "合意済・排液取得前", hint: "提供の合意はあるが、まだ受け取っていない" },
  { key: "talking", label: "相談中", hint: "接触済みで、提供可否はこれから" },
  { key: "untouched", label: "未接触の候補", hint: "多量排出事業者の公表データから抽出しただけ" },
];

export function sxPocStageLabel(partner: SxPocPartnerLike): string {
  const key = sxPocStageOf(partner);
  return SX_POC_STAGE_ORDER.find((stage) => stage.key === key)?.label || "段階未確認";
}

/**
 * 候補先を接触段階の降順（ゴールに近い順）で並べる。件数は実データだけを数え、
 * 母集団や目標値を推測で埋めない。
 */
export function deriveSxPocList<T extends SxPocPartnerLike>(partners: T[]): {
  groups: SxPocStageGroup<T>[];
  total: number;
  securedCount: number;
  contactedCount: number;
} {
  const scoped = partners.filter(sxIsPocCandidate);
  const groups = SX_POC_STAGE_ORDER.map((stage) => ({
    ...stage,
    partners: scoped
      .filter((partner) => sxPocStageOf(partner) === stage.key)
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
  })).filter((group) => group.partners.length > 0);

  const securedCount = scoped.filter((partner) => sxPocStageOf(partner) === "secured").length;
  const contactedCount = scoped.filter((partner) => sxPocStageOf(partner) !== "untouched").length;
  return { groups, total: scoped.length, securedCount, contactedCount };
}
