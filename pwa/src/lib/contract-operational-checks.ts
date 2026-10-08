import { textTerm, type ContractOperationalCheck } from "./project-contract-terms";

export function contractSourceUrl(value: unknown): string | null {
  const text = textTerm(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && ["drive.google.com", "docs.google.com"].includes(url.hostname) ? text : null;
  } catch { return null; }
}

/** 未確認・不正形状を開示許可へ変換しない。 */
export function contractOperationalChecks(value: unknown): ContractOperationalCheck[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ContractOperationalCheck[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const question = textTerm(row.question);
    const answer = textTerm(row.answer);
    if (!question || !answer) return [];
    const sourceUrl = contractSourceUrl(row.sourceUrl) ?? "";
    const sourceClause = textTerm(row.sourceClause) ?? "";
    const checkedAt = textTerm(row.checkedAt) ?? "";
    return [{
      id: textTerm(row.id) ?? question,
      question, answer,
      status: row.status === "confirmed" && sourceUrl && sourceClause && checkedAt ? "confirmed" : "needs_confirmation",
      actions: Array.isArray(row.actions) ? row.actions.flatMap(action => {
        if (!action || typeof action !== "object") return [];
        const text = textTerm(action.text);
        const kind = action.kind;
        return text && (kind === "contract_requirement" || kind === "recommended_check") ? [{ kind, text }] : [];
      }) : [],
      unresolved: Array.isArray(row.unresolved) ? row.unresolved.map(textTerm).filter((text): text is string => !!text) : [],
      sourceTitle: textTerm(row.sourceTitle) ?? "根拠文書未確認",
      sourceUrl, sourceClause, checkedAt,
    }];
  });
}
