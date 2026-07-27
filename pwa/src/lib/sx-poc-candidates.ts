/**
 * PoC候補先（排液提供先）の絞り込み。関係先台帳と同じ `project_management_partners` を読むが、
 * 経営関係（大学・金融機関・試作先など）とは役割が違うので表示面を分ける。
 *
 * 2026-07-27 まさ指示「かるが作ったPoC候補先リストの数十社も関係先へ入れて、リスト自体も
 * ダッシュボードに置く」への対応。数十社を7列の関係先台帳へそのまま流し込むと、ボール・次の約束を
 * 5秒で読む台帳の役割が壊れるため、候補先は専用のボードで一覧し、台帳からは外す。
 *
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
};

export type SxPocStageKey = "untouched" | "talking" | "agreed" | "secured";

export type SxPocStageGroup = {
  key: SxPocStageKey;
  label: string;
  /** 5秒で読む用の短い説明。段階名だけでは何が起きたのか伝わらないため必ず添える。 */
  hint: string;
  partners: SxPocPartnerLike[];
};

/** PoC候補先・接触先か。関係先台帳の除外条件と、このボードの抽出条件は必ず同じ関数を使う。 */
export function sxIsPocCandidate(partner: { roleLabel: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) || partner.roleLabel.startsWith(SX_POC_CONTACTED_ROLE_PREFIX);
}

/** 接触が一度も無い候補（=台帳へ出さない層）。接触済みは関係として扱う。 */
export function sxIsUntouchedPocCandidate(partner: { roleLabel: string; relationshipStage: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) && partner.relationshipStage === "candidate";
}

function stageOf(partner: SxPocPartnerLike): SxPocStageKey {
  if (partner.relationshipStage === "executing") return "secured";
  if (partner.relationshipStage === "condition_alignment" || partner.relationshipStage === "agreement_confirmation") return "agreed";
  if (partner.relationshipStage === "candidate") return "untouched";
  return "talking";
}

const STAGE_ORDER: Array<{ key: SxPocStageKey; label: string; hint: string }> = [
  { key: "secured", label: "排液 調達済", hint: "実際に排液を受け取り、検証へ回せる" },
  { key: "agreed", label: "合意済・排液取得前", hint: "提供の合意はあるが、まだ受け取っていない" },
  { key: "talking", label: "相談中", hint: "接触済みで、提供可否はこれから" },
  { key: "untouched", label: "未接触の候補", hint: "多量排出事業者の公表データから抽出しただけ" },
];

/**
 * 候補先を接触段階の降順（ゴールに近い順）で並べる。件数は実データだけを数え、
 * 母集団や目標値を推測で埋めない。
 */
export function deriveSxPocBoard(partners: SxPocPartnerLike[]): {
  groups: SxPocStageGroup[];
  total: number;
  securedCount: number;
  contactedCount: number;
} {
  const scoped = partners.filter(sxIsPocCandidate);
  const groups = STAGE_ORDER.map((stage) => ({
    ...stage,
    partners: scoped
      .filter((partner) => stageOf(partner) === stage.key)
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
  })).filter((group) => group.partners.length > 0);

  const securedCount = scoped.filter((partner) => stageOf(partner) === "secured").length;
  const contactedCount = scoped.filter((partner) => stageOf(partner) !== "untouched").length;
  return { groups, total: scoped.length, securedCount, contactedCount };
}
