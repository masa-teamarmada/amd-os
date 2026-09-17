type OwnerLike = { memberId: string };

const MISSING_OWNER_LABELS = [
  "AMD担当確定待ち",
  "代理参加者未確定",
  "担当者未確認",
  "担当確定待ち",
  "担当未確認",
  "担当未設定",
  "担当未定",
  "未アサイン",
  "未割当",
];

/**
 * 外部関係者は members に存在しないため、project_action_owners だけでは担当の有無を
 * 判定できない。旧自由記述に実名・役割名が残る行も、画面に担当として表示している
 * 以上は「担当あり」として扱う。欠測語しか残らない場合だけ未設定とする。
 */
export function hasEffectiveActionOwner(owners: OwnerLike[], ownerLabel: string): boolean {
  if (owners.length > 0) return true;

  let meaningful = ownerLabel.trim();
  for (const placeholder of MISSING_OWNER_LABELS) {
    meaningful = meaningful.replaceAll(placeholder, "");
  }
  meaningful = meaningful.replace(/[\s・･/／+＋()（）［］\[\]_-]/g, "");
  return meaningful.length > 0;
}

export function isActionAssignmentMissing(
  owners: OwnerLike[],
  ownerLabel: string,
  plannedEnd: string | null,
): boolean {
  return !hasEffectiveActionOwner(owners, ownerLabel) || !plannedEnd;
}
