const RELATIONSHIP_ORIGIN_CONTACT_PATTERN =
  /(?:https?:\/\/|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d{2,5})?(?:\/[^\s]*)?|(?:\+?81[-\s()]*0?|0)\d{1,4}[-\s()]?\d{1,4}[-\s]?\d{3,4})/i;

export function assertSafeRelationshipOrigin(
  value: unknown,
  label: string,
): void {
  if (value == null) return;
  const candidate = String(value);
  if (/[\r\n]/.test(candidate)) {
    throw new Error(`${label}は1行の短い要約で入力してね`);
  }
  if (RELATIONSHIP_ORIGIN_CONTACT_PATTERN.test(candidate)) {
    throw new Error(
      `${label}にメールアドレス・電話番号・URLは保存できないよ`,
    );
  }
}
