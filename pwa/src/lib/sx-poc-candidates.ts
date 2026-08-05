/**
 * PoC対象先（排液提供先）の識別だけを担う。
 *
 * PoCは関係先の進捗段階ではなく横断属性。表示順・group・現在地は他の関係先と同じ
 * primary role_kind x relationship_state と共通のpriority sortへ委ね、このmoduleでは
 * PoC専用のstage/group/orderを作らない。
 */

export const SX_POC_ROLE_PREFIX = "PoC候補先";
export const SX_POC_CONTACTED_ROLE_PREFIX = "PoC接触先";

/** PoC候補先・接触先・調達済みを含む、PoC対象先か。保存済みの候補区分が最優先で、無ければroleLabel prefixで後方互換判定する。 */
export function sxIsPocPartner(partner: { roleLabel: string; pocCategory?: string | null }): boolean {
  if (partner.pocCategory) return true;
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) || partner.roleLabel.startsWith(SX_POC_CONTACTED_ROLE_PREFIX);
}

/** 接触が一度も無いPoC対象先。実行中の管制件数からだけ除き、母数と一覧には含める。 */
export function sxIsUncontactedPocPartner(partner: { roleLabel: string; relationshipStage: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) && partner.relationshipStage === "candidate";
}
