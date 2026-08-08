/**
 * PoC対象先（排液提供先）の識別だけを担う。
 *
 * PoCは関係先の進捗段階ではなく横断属性。表示順・group・現在地は他の関係先と同じ
 * primary role_kind x relationship_state と共通のpriority sortへ委ね、このmoduleでは
 * PoC専用のstage/group/orderを作らない。
 */

export const SX_POC_ROLE_PREFIX = "PoC候補先";
export const SX_POC_CONTACTED_ROLE_PREFIX = "PoC接触先";

/** PoC候補先か。保存済みの分類 (複数可) が最優先で、次に旧単一区分、最後にroleLabel prefixで後方互換判定する。
 *  技術協力先・試料提供元などの他分類は 2026-08-08 から独立タブになったため、ここでは true にしない。 */
export function sxIsPocPartner(partner: { roleLabel: string; pocCategory?: string | null; classifications?: readonly string[] }): boolean {
  if (partner.classifications && partner.classifications.length > 0)
    return partner.classifications.includes("poc_candidate");
  if (partner.pocCategory) return partner.pocCategory === "poc_candidate";
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) || partner.roleLabel.startsWith(SX_POC_CONTACTED_ROLE_PREFIX);
}

/** 接触が一度も無いPoC対象先。実行中の管制件数からだけ除き、母数と一覧には含める。 */
export function sxIsUncontactedPocPartner(partner: { roleLabel: string; relationshipStage: string }): boolean {
  return partner.roleLabel.startsWith(SX_POC_ROLE_PREFIX) && partner.relationshipStage === "candidate";
}
