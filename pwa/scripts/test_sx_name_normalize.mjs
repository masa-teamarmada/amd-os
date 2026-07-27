import assert from "node:assert/strict";
import { sxNormalizePublicName, sxNormalizePublicNameForTest } from "../src/lib/sx-name-normalize.ts";

const cases = [
  ["まさへ引き継ぐ", "山地へ引き継ぐ"],
  ["まさが窓口", "山地が窓口"],
  ["石原先生 → まさ", "石原先生 → 山地"],
  ["まさ", "山地"],
  ["まさ・かる", "山地・輕部"],
  ["かるが担当", "輕部が担当"],
  ["ちこへ確認", "遠藤へ確認"],
  ["まさの確認待ち", "山地の確認待ち"],
  ["まさから連絡", "山地から連絡"],
  ["まさ、かる、ちこ", "山地、輕部、遠藤"],
  // P1-1: natural Japanese left contexts (preceding particle establishes boundary)
  ["担当はまさ", "担当は山地"],
  ["窓口担当はまさへ確認", "窓口担当は山地へ確認"],
  ["石原先生からまさへ引き継ぐ", "石原先生から山地へ引き継ぐ"],
  // P1-1: honorifics / separators establishing right boundary
  ["まささん", "山地さん"],
  ["まさ：確認待ち", "山地：確認待ち"],
  ["「まさ」", "「山地」"],
  // P1-1: compound trailing particles (whitelisted)
  ["まさへの引継ぎ", "山地への引継ぎ"],
  ["まさとの合意", "山地との合意"],
  ["まさからの連絡", "山地からの連絡"],
  // P1-2: explicit person-role/introduction prefixes glued to an alias so
  // Intl.Segmenter reads "は"+alias as a single dictionary word (e.g. はかる
  // as the verb 測る/計る), hiding the alias from the normal boundary scan.
];

const ROLE_PREFIXES = ["担当は", "窓口は", "窓口担当は", "担当者は"];
const ALIAS_REAL_NAMES = [
  ["まさ", "山地"],
  ["かる", "輕部"],
  ["ちこ", "遠藤"],
];
const SUFFIXES = [
  { suffix: "", label: "bare" },
  { suffix: "さん", label: "honorific" },
  { suffix: "へ確認", label: "trailing particle + word" },
];

for (const prefix of ROLE_PREFIXES) {
  for (const [alias, realName] of ALIAS_REAL_NAMES) {
    for (const { suffix } of SUFFIXES) {
      const input = `${prefix}${alias}${suffix}`;
      const expected = `${prefix}${realName}${suffix}`;
      cases.push([input, expected]);
    }
  }
}

// Mid-sentence role context (prefix not at string start).
cases.push(
  ["石原先生に窓口担当はかるへ確認をお願いした", "石原先生に窓口担当は輕部へ確認をお願いした"],
  ["来週から担当はちこさんに変わります", "来週から担当は遠藤さんに変わります"],
  ["新しい担当者はまさです", "新しい担当者は山地です"],
);

// P1-3: role-noun + connector left-context, exhaustive across は/が/の/と for
// all three aliases (ICU may merge the connector into the alias itself, so
// this must work regardless of Intl.Segmenter's word boundaries).
const ROLE_CONNECTORS = ["は", "が", "の", "と"];
for (const connector of ROLE_CONNECTORS) {
  for (const [alias, realName] of ALIAS_REAL_NAMES) {
    cases.push([`担当${connector}${alias}`, `担当${connector}${realName}`]);
  }
}

// P1-3: explicit examples from the corruption report.
cases.push(
  ["担当がかる", "担当が輕部"],
  ["担当がちこ", "担当が遠藤"],
  ["担当のちこ", "担当の遠藤"],
  ["担当とかる", "担当と輕部"],
);

// P1-3: suffix end / さん / へ確認 combined with the role-connector left
// context, exhaustively across all three aliases.
for (const connector of ROLE_CONNECTORS) {
  for (const [alias, realName] of ALIAS_REAL_NAMES) {
    for (const { suffix } of SUFFIXES) {
      const input = `担当${connector}${alias}${suffix}`;
      const expected = `担当${connector}${realName}${suffix}`;
      cases.push([input, expected]);
    }
  }
}

// P1-3: honorific (先生) + connector left-context, exhaustive across all
// three aliases.
for (const [alias, realName] of ALIAS_REAL_NAMES) {
  cases.push([`石原先生から${alias}`, `石原先生から${realName}`]);
  cases.push([`石原先生から${alias}へ引き継ぐ`, `石原先生から${realName}へ引き継ぐ`]);
}

// P1-4: generalized role/side markers (uppercase acronyms + Japanese
// compounds ending in a role-marker word), from the follow-up review.
cases.push(
  ["CEOはまさ", "CEOは山地"],
  ["COOはまさ", "COOは山地"],
  ["PMはかる", "PMは輕部"],
  ["PLはかる", "PLは輕部"],
  ["技術DDはちこ", "技術DDは遠藤"],
  ["SX側はまさ", "SX側は山地"],
  ["大学側からまさへ引継ぎ", "大学側から山地へ引継ぎ"],
);

for (const [input, expected] of cases) {
  const actualSegmenter = sxNormalizePublicNameForTest(input, { forceFallback: false });
  assert.equal(actualSegmenter, expected, `[segmenter] expected "${input}" -> "${expected}", got "${actualSegmenter}"`);

  const actualDefault = sxNormalizePublicName(input);
  assert.equal(actualDefault, expected, `[default] expected "${input}" -> "${expected}", got "${actualDefault}"`);
}

const unchanged = [
  "かるた大会",
  "たちこめる霧",
  "まさに確認する",
  "特に変化なし",
  "",
  // P1-1: ordinary words/names corrupted by the old regex approach
  "まさのぶさん",
  "かるがる運ぶ",
  "かるがも",
  "分かる",
  "かるがる",
  // P1-2: ordinary verb phrases using を (not a role-introduction prefix)
  // must never be corrupted by the new override.
  "効果をはかる",
  "成果をはかる",
  "距離をはかる",
  "解決をはかる",
  "実現をはかる",
  // P1-3: the leftBoundaryOk corruption this task fixes — an arbitrary
  // preceding particle (から) alone must never be treated as a safe person
  // boundary, only a role-noun/honorific plus connector is.
  "人をからかる",
  "効果をはかる",
  "成果をはかる",
  "距離をはかる",
  "軽さをはかる",
];

for (const input of unchanged) {
  const actualSegmenter = sxNormalizePublicNameForTest(input, { forceFallback: false });
  assert.equal(actualSegmenter, input, `[segmenter] expected unchanged for "${input}", got "${actualSegmenter}"`);

  const actualDefault = sxNormalizePublicName(input);
  assert.equal(actualDefault, input, `[default] expected unchanged for "${input}", got "${actualDefault}"`);
}

// P1-4/B: force the no-Intl.Segmenter fallback path across the full corpus.
// Every positive and negative case must behave identically on both paths;
// exceptions here would let an external-view code-name regression hide.
for (const [input, expected] of cases) {
  const actualFallback = sxNormalizePublicNameForTest(input, { forceFallback: true });
  assert.equal(actualFallback, expected, `[fallback] expected "${input}" -> "${expected}", got "${actualFallback}"`);
}

for (const input of unchanged) {
  const actualFallback = sxNormalizePublicNameForTest(input, { forceFallback: true });
  assert.equal(actualFallback, input, `[fallback] expected unchanged for "${input}", got "${actualFallback}"`);
}

assert.equal(sxNormalizePublicName(null), "");
assert.equal(sxNormalizePublicName(undefined), "");

console.log(`sx-name-normalize: ${cases.length * 2 + unchanged.length * 2 + 2} assertions passed`);
