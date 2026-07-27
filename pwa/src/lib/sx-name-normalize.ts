/**
 * Display-only normalizer that swaps internal AMD code names for real names on
 * the SX partner surface, which external partner members can see. Never
 * mutates DB values or API payloads — call only at render time.
 *
 * Canonical mapping (confirmed against knowledge/sx.md): まさ→山地,
 * かる→輕部, ちこ→遠藤.
 *
 * A naive replaceAll/regex-boundary approach is unsafe in Japanese: there is
 * no whitespace between words, so "the alias is not preceded/followed by a
 * letter" is not a real word boundary (まさのぶ, かるがる, かるがも, まさに
 * all contain an alias as a pure substring of an unrelated word). We instead
 * use Intl.Segmenter('ja', {granularity: 'word'}) to get the ICU dictionary's
 * word boundaries and only convert an alias occurrence when:
 *   - both its start and end line up with a real segment boundary (so it is
 *     never a mid-word substring like the ちこ inside たちこめる), and
 *   - its left context is either the start of the string, a non-word
 *     separator (punctuation/space/「/→/…), or a narrow raw-string safe
 *     context ending immediately before the alias: a person-role/reference
 *     word (担当/担当者/窓口/責任者/オーナー/代表/マネージャー/リーダー/
 *     側/DD/本人/etc. — matched as a suffix, so compounds like SX担当や
 *     大学側/技術DD need no separate entry) or honorific (先生/さん/氏), an
 *     uppercase ASCII role acronym (CEO/COO/PM/PL/etc.), each plus a
 *     connector particle (は/が/の/と/を/へ/から/まで). An arbitrary
 *     preceding particle alone is never accepted — that used to let ordinary
 *     phrases like "人をからかる" corrupt, because "から" alone looked like a
 *     safe boundary, and
 *   - its right context is either the end of the string, a non-word
 *     separator, an honorific (さん/様/君/くん/ちゃん/氏/先生/殿), or a
 *     trailing particle segment — with a second consecutive particle segment
 *     only accepted for a small whitelist of real compounds (への/との/
 *     からの), so that unrelated double-particle runs like かる+が+も
 *     (カルガモ) are rejected instead of misread as "かる" + "がも".
 *
 * Intl.Segmenter also does not merge every alias into a single dictionary
 * word (ちこ splits into the mora ち|こ), so matching is boundary-based
 * rather than "the whole alias must be exactly one segment".
 *
 * Environments without Intl.Segmenter (older Safari) fall back to a raw
 * character scan (normalizeWithFallback) that reuses the same safe
 * left-context rules and a conservative right-boundary walk: a trailing
 * particle is only accepted when what follows it is Kanji, a separator,
 * end-of-string, or a whitelisted second particle (への/との/からの) — a
 * bare particle with an ordinary hiragana/katakana continuation (の+ぶ in
 * まさのぶさん, が+る in かるがる運ぶ, が+も in かるがも) is rejected. This
 * under-converts a few of the natural-context cases the segmenter path
 * supports, but never corrupts ordinary words. sxNormalizePublicNameForTest
 * exposes a way to force this path in tests regardless of Intl.Segmenter
 * availability.
 */

const CODE_NAME_TO_REAL_NAME: ReadonlyArray<readonly [string, string]> = [
  ["まさ", "山地"],
  ["かる", "輕部"],
  ["ちこ", "遠藤"],
];

const REAL_NAME_BY_CODE_NAME: ReadonlyMap<string, string> = new Map(CODE_NAME_TO_REAL_NAME);
const ALIASES: readonly string[] = CODE_NAME_TO_REAL_NAME.map(([alias]) => alias);

// Particles that may stand between the alias and its surrounding context on
// either side. Intentionally excludes に — "まさに" ("exactly/precisely") is
// an ordinary word, not まさ+に, and Intl.Segmenter merges it into one
// segment anyway, so a bare に never lines up with a segment boundary here.
const JAPANESE_PARTICLES = new Set([
  "から", "まで", "なら", "へ", "が", "は", "を", "の", "と", "も", "で",
]);

const HONORIFICS = new Set(["さん", "様", "君", "くん", "ちゃん", "氏", "先生", "殿"]);

// Copulas that unambiguously close a person-reference ("担当はまさです" = "the
// person in charge is Masa"). Unlike a bare particle, だ/です never head an
// unrelated ordinary word, so accepting them as a right boundary carries none
// of the risk a blanket particle rule would.
const COPULAS = new Set(["です", "だ", "でした", "だった"]);

// Conservative left-context safe list: a person-role/reference noun or a
// small honorific set, immediately followed by a connector particle, checked
// against the *raw* string (not segment boundaries). This is deliberately
// narrower than "any particle" — accepting an arbitrary preceding particle
// alone previously let ordinary verb phrases like "人をからかる" corrupt
// (から alone is not a safe left context; 担当から / 先生から is). Matching
// on the raw string rather than segment boundaries also survives
// Intl.Segmenter merging the connector into the alias as one dictionary word
// (e.g. "はかる" reads as the verb 測る/計る), which used to hide role
// contexts like "担当はかる" from a purely segment-based check.
// P1-4: generalized beyond a fixed noun list — any left context ending in one
// of these role-marker words (担当/責任者/窓口/オーナー/代表/マネージャー/
// リーダー/側/DD etc.) plus a connector is treated as a safe person-reference
// boundary, regardless of what precedes the marker word itself (SX担当 /
// 窓口担当 / 大学側 / 技術DD all end in a marker word, so no separate entry
// is needed for each compound).
const LEFT_SAFE_ROLE_NOUNS = [
  "担当者", "引き継ぎ先", "引継先", "受領者", "確認者", "決定者",
  "責任者", "オーナー", "代表", "マネージャー", "リーダー", "担当", "窓口",
  "本人", "側", "DD",
] as const;
const LEFT_SAFE_HONORIFICS = ["先生", "さん", "氏"] as const;
const LEFT_CONTEXT_CONNECTORS = ["は", "が", "の", "と", "を", "へ", "から", "まで"] as const;

// P1-4: reasonable uppercase-acronym role pattern (CEO/COO/CTO/PM/PL/DD/…)
// directly before a connector. The negative lookbehind keeps this from
// matching the tail of a longer alnum run (so it only fires on a standalone
// acronym token, not an arbitrary ID-like string).
const LEFT_SAFE_ACRONYM_SOURCE = String.raw`(?<![A-Za-z0-9])[A-Z]{2,6}`;

const LEFT_SAFE_CONTEXT_PATTERN = new RegExp(
  `(?:(?:${[...LEFT_SAFE_ROLE_NOUNS, ...LEFT_SAFE_HONORIFICS].join("|")})|${LEFT_SAFE_ACRONYM_SOURCE})` +
    `(?:${LEFT_CONTEXT_CONNECTORS.join("|")})$`,
);

// The only particle-then-particle sequences that are real compounds
// (への/との/からの). Any other consecutive particle pair (e.g. が+も) is
// treated as a signal that the "alias" is actually the head of an unrelated
// word (かるがも) and the match is rejected.
const VALID_PARTICLE_PAIRS = new Set(["へ|の", "と|の", "から|の"]);

interface WordSegment {
  segment: string;
  index: number;
  isWordLike: boolean;
}

let segmenter: Intl.Segmenter | null | undefined;

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter !== undefined) return segmenter;
  try {
    segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("ja", { granularity: "word" })
      : null;
  } catch {
    segmenter = null;
  }
  return segmenter;
}

function segmentWords(value: string, seg: Intl.Segmenter): WordSegment[] {
  const segments: WordSegment[] = [];
  for (const part of seg.segment(value)) {
    segments.push({ segment: part.segment, index: part.index, isWordLike: Boolean(part.isWordLike) });
  }
  return segments;
}

function normalizeWithSegmenter(value: string, seg: Intl.Segmenter): string {
  const segments = segmentWords(value, seg);

  // Segment ending exactly at position p (for left-context lookups).
  const endIndexToSegment = new Map<number, WordSegment>();
  // Segment starting exactly at position p (for right-context lookups).
  const startIndexToSegment = new Map<number, WordSegment>();
  for (const s of segments) {
    endIndexToSegment.set(s.index + s.segment.length, s);
    startIndexToSegment.set(s.index, s);
  }

  function leftBoundaryOk(pos: number): boolean {
    if (pos === 0) return true;
    if (LEFT_SAFE_CONTEXT_PATTERN.test(value.slice(0, pos))) return true;
    const prev = endIndexToSegment.get(pos);
    if (!prev) return false; // not a real word boundary at all
    return !prev.isWordLike; // punctuation/space/separator
  }

  function rightBoundaryOk(pos: number): boolean {
    if (pos === value.length) return true;
    const next = startIndexToSegment.get(pos);
    if (!next) return false; // not a real word boundary at all
    if (!next.isWordLike) return true; // punctuation/space/separator
    if (HONORIFICS.has(next.segment)) return true;
    if (COPULAS.has(next.segment)) return true;
    if (JAPANESE_PARTICLES.has(next.segment)) {
      const afterNextPos = pos + next.segment.length;
      const afterNext = startIndexToSegment.get(afterNextPos);
      if (afterNext && afterNext.isWordLike && JAPANESE_PARTICLES.has(afterNext.segment)) {
        return VALID_PARTICLE_PAIRS.has(`${next.segment}|${afterNext.segment}`);
      }
      return true;
    }
    return false;
  }

  let result = "";
  let pos = 0;
  while (pos < value.length) {
    const alias = ALIASES.find((candidate) => value.startsWith(candidate, pos));
    if (alias && leftBoundaryOk(pos) && rightBoundaryOk(pos + alias.length)) {
      result += REAL_NAME_BY_CODE_NAME.get(alias) ?? alias;
      pos += alias.length;
      continue;
    }
    result += value[pos];
    pos += 1;
  }
  return result;
}

// --- Conservative fallback for environments without Intl.Segmenter --------
//
// No Intl.Segmenter means no dictionary word boundaries at all, so this path
// cannot lean on "is this a real word" the way normalizeWithSegmenter does.
// It instead scans raw characters and only accepts a match when the boundary
// signal is unambiguous:
//   - left: string start, a safe role/honorific context (same
//     LEFT_SAFE_CONTEXT_PATTERN as the segmenter path), or a non-letter/digit
//     separator character immediately before the alias;
//   - right: string end, an explicit separator, a known honorific, or a
//     single trailing particle whose own continuation carries a strong
//     boundary/action signal — end of string, a separator, a Kanji character
//     (a real continuation like 引き継ぐ/窓口/担当 always opens with one), or
//     a second particle that forms a whitelisted compound (への/との/からの).
// A bare particle with no such follow-up (の+ぶ in まさのぶさん, が+る in
// かるがる, が+も in かるがも) is rejected — that under-converts a few
// naturally-supported segmenter-path cases, but never corrupts an unrelated
// word. This is intentionally conservative, not a naive replaceAll/regex
// global substitution.

const TRAILING_PARTICLES = ["から", "まで", "なら", "へ", "が", "は", "を", "の", "と", "も", "で"] as const;
const SEPARATOR_CHAR_PATTERN = /[・、。,，／/\s→「」『』：:()（）]/u;
const KANJI_PATTERN = /[一-鿿]/;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function isSeparatorChar(char: string | undefined): boolean {
  return char !== undefined && SEPARATOR_CHAR_PATTERN.test(char);
}

function matchAt<T extends string>(value: string, pos: number, candidates: readonly T[]): T | null {
  return candidates.find((candidate) => value.startsWith(candidate, pos)) ?? null;
}

function fallbackLeftBoundaryOk(value: string, pos: number): boolean {
  if (pos === 0) return true;
  const before = value.slice(0, pos);
  if (LEFT_SAFE_CONTEXT_PATTERN.test(before)) return true;
  return isSeparatorChar(value[pos - 1]);
}

function fallbackRightBoundaryOk(value: string, pos: number): boolean {
  if (pos >= value.length) return true;
  const char = value[pos];
  if (isSeparatorChar(char)) return true;
  if (matchAt(value, pos, [...HONORIFICS])) return true;
  if (matchAt(value, pos, [...COPULAS])) return true;

  const particle = matchAt(value, pos, TRAILING_PARTICLES);
  if (!particle) return !LETTER_OR_DIGIT.test(char);

  const afterParticlePos = pos + particle.length;
  if (afterParticlePos >= value.length) return true;
  const afterChar = value[afterParticlePos];
  if (isSeparatorChar(afterChar)) return true;
  if (KANJI_PATTERN.test(afterChar)) return true;

  const particle2 = matchAt(value, afterParticlePos, TRAILING_PARTICLES);
  if (particle2) return VALID_PARTICLE_PAIRS.has(`${particle}|${particle2}`);
  return false;
}

function normalizeWithFallback(value: string): string {
  let result = "";
  let pos = 0;
  while (pos < value.length) {
    const alias = ALIASES.find((candidate) => value.startsWith(candidate, pos));
    if (
      alias &&
      fallbackLeftBoundaryOk(value, pos) &&
      fallbackRightBoundaryOk(value, pos + alias.length)
    ) {
      result += REAL_NAME_BY_CODE_NAME.get(alias) ?? alias;
      pos += alias.length;
      continue;
    }
    result += value[pos];
    pos += 1;
  }
  return result;
}

/**
 * Replaces internal code names with real names wherever they appear as
 * standalone person tokens in free text. Leaves everything else — including
 * code-name substrings embedded in ordinary words — untouched.
 */
export function sxNormalizePublicName(value: string | null | undefined): string {
  if (!value) return value ?? "";

  const seg = getSegmenter();
  return seg ? normalizeWithSegmenter(value, seg) : normalizeWithFallback(value);
}

/**
 * Test-only entry point that lets tests force the no-Intl.Segmenter fallback
 * path even in environments where Intl.Segmenter is available, so both code
 * paths can be exercised against the same corpus. Not for production use.
 */
export function sxNormalizePublicNameForTest(
  value: string | null | undefined,
  options: { forceFallback?: boolean } = {},
): string {
  if (!value) return value ?? "";
  if (options.forceFallback) return normalizeWithFallback(value);

  const seg = getSegmenter();
  return seg ? normalizeWithSegmenter(value, seg) : normalizeWithFallback(value);
}
