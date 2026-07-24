const ACTION_SUFFIX_MAP: ReadonlyArray<readonly [string, string]> = [
  ["を締結する", "締結"],
  ["を確認する", "確認"],
  ["を確定する", "確定"],
  ["を検証する", "検証"],
  ["を整理する", "整理"],
  ["を作成する", "作成"],
  ["を提出する", "提出"],
  ["を実施する", "実施"],
  ["を完了する", "完了"],
  ["を開始する", "開始"],
  ["を決定する", "決定"],
  ["を取得する", "取得"],
  ["を引き継ぐ", "引継ぎ"],
  ["を固める", "確定"],
  ["を並べる", "整理"],
  ["を揃える", "整備"],
  ["へ引き継ぐ", "への引継ぎ"],
];

// Additional suffixes only relevant to next-action clause nominalization
// (e.g. "〜し、" conjunctive clauses and "作る" as a plain verb).
const NEXT_ACTION_EXTRA_SUFFIX_MAP: ReadonlyArray<readonly [string, string]> = [
  ["を作る", "作成"],
  ["を納品し", "納品"],
  ["を案内し", "案内"],
];

const GENERIC_SURU_SUFFIX = "する" as const;

const SENTENCE_PUNCTUATION = /[。、！？!?.,;:]/;
const CLAUSE_PUNCTUATION = /[。！？!?.,;:]/;
const JAPANESE_COMMA = "、";

function applySuffixMap(
  trimmed: string,
  map: ReadonlyArray<readonly [string, string]>,
): string | null {
  for (const [suffix, noun] of map) {
    if (trimmed.endsWith(suffix)) {
      return trimmed.slice(0, trimmed.length - suffix.length) + noun;
    }
  }

  if (trimmed.endsWith(GENERIC_SURU_SUFFIX) && trimmed.length > GENERIC_SURU_SUFFIX.length) {
    return trimmed.slice(0, trimmed.length - GENERIC_SURU_SUFFIX.length);
  }

  return null;
}

/**
 * Nominalizes short, single-clause action/commitment titles (holding title,
 * commitment title). Any punctuation (including 、) causes the value to be
 * returned unchanged, since punctuation-bearing strings are treated as prose.
 */
export function nominalizeSxActionLabel(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length > 80) return value;
  if (trimmed.includes("\n")) return value;
  if (SENTENCE_PUNCTUATION.test(trimmed)) return value;

  const applied = applySuffixMap(trimmed, ACTION_SUFFIX_MAP);
  return applied ?? value;
}

/**
 * Nominalizes next-action strings (次の一手 / nextCommitment), which are
 * allowed to contain a single 、 joining two clauses. Each clause is
 * nominalized independently and rejoined with ・. Any other punctuation, or
 * more than one 、, is left as unmodified prose.
 */
export function nominalizeSxNextActionLabel(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length > 80) return value;
  if (trimmed.includes("\n")) return value;

  const commaCount = trimmed.split(JAPANESE_COMMA).length - 1;
  if (commaCount > 1) return value;

  const combinedMap = [...ACTION_SUFFIX_MAP, ...NEXT_ACTION_EXTRA_SUFFIX_MAP];

  if (commaCount === 0) {
    if (CLAUSE_PUNCTUATION.test(trimmed)) return value;
    const applied = applySuffixMap(trimmed, combinedMap);
    return applied ?? value;
  }

  const [clause1Raw, clause2Raw] = trimmed.split(JAPANESE_COMMA);
  const clause1 = clause1Raw.trim();
  const clause2 = clause2Raw.trim();

  if (!clause1 || !clause2) return value;
  if (CLAUSE_PUNCTUATION.test(clause1) || CLAUSE_PUNCTUATION.test(clause2)) return value;

  const nominalized1 = applySuffixMap(clause1, combinedMap);
  const nominalized2 = applySuffixMap(clause2, combinedMap);

  if (nominalized1 === null || nominalized2 === null) return value;

  const joined = `${nominalized1}・${nominalized2}`;
  return joined.length > 80 ? value : joined;
}
