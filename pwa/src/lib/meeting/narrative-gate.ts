/**
 * 開催済みMTG議事録 (`narrative_md`) の品質gate。
 *
 * 正本は `pwa/spec/3-3-meeting-flow-current-spec.md` と
 * `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` の Phase D-1。
 * 後から欠損を埋める経路でも同じ gate を通す。SKILL の D-1 にこう書いてある:
 * 「手動 backfill でもこの gate は同じ。過去議事録を入れる時も summary_short と
 * 配列だけで project_meeting_summaries に直書きしない。」
 */

export const NARRATIVE_HEADINGS = [
  "## 🎯背景",
  "## 📊経緯",
  "## ✅決まったこと",
  "## ▶️次の一手",
  "## ⚠️残課題",
] as const;

/** 段落で書く節。箇条書きが混ざっていたら落とす。 */
const PARAGRAPH_SECTIONS = new Set(["## 🎯背景", "## 📊経緯"]);

export const MIN_NARRATIVE_LENGTH = 500;

export type NarrativeGateResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function sectionBodies(narrative: string): Map<string, string[]> {
  const bodies = new Map<string, string[]>();
  let current: string | null = null;
  for (const raw of narrative.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = (NARRATIVE_HEADINGS as readonly string[]).find((h) => line === h);
    if (heading) {
      current = heading;
      bodies.set(heading, []);
      continue;
    }
    if (current && line) bodies.get(current)?.push(line);
  }
  return bodies;
}

/**
 * 保存してよい議事録本文かを判定する。
 * `source_kinds === "none"` のマーカー行はこの gate の対象外。
 */
export function checkNarrative(narrative: unknown): NarrativeGateResult {
  if (typeof narrative !== "string" || !narrative.trim()) {
    return { ok: false, code: "blocked_empty_narrative", message: "議事録本文が空です" };
  }
  const value = narrative.trim();
  if (value.length < MIN_NARRATIVE_LENGTH) {
    return {
      ok: false,
      code: "blocked_low_quality_narrative",
      message: `議事録本文が短すぎます (${value.length}字 / 最低${MIN_NARRATIVE_LENGTH}字)`,
    };
  }

  // 見出しが5つとも、決められた順で出てくること。表記ゆれは通さない。
  let cursor = 0;
  for (const heading of NARRATIVE_HEADINGS) {
    const index = value.indexOf(`\n${heading}`, cursor) >= 0
      ? value.indexOf(`\n${heading}`, cursor) + 1
      : (cursor === 0 && value.startsWith(heading) ? 0 : -1);
    if (index < 0) {
      return {
        ok: false,
        code: "blocked_wrong_narrative_headings",
        message: `見出し「${heading}」が無いか、順序が違います`,
      };
    }
    cursor = index + heading.length;
  }

  const bodies = sectionBodies(value);
  for (const heading of NARRATIVE_HEADINGS) {
    const lines = bodies.get(heading) ?? [];
    if (PARAGRAPH_SECTIONS.has(heading)) {
      if (lines.some((line) => /^(-|\*|・|•|\d+[.)])\s+/.test(line))) {
        return {
          ok: false,
          code: "blocked_wrong_narrative_headings",
          message: `「${heading}」は段落で書きます。箇条書きが入っています`,
        };
      }
      continue;
    }
    // 後半3節は事実があるなら `- ` で始める。番号付き・チェックボックスは通さない。
    for (const line of lines) {
      if (/^(\*|・|•|\d+[.)])\s+/.test(line) || /^- \[[ x]\]/.test(line)) {
        return {
          ok: false,
          code: "blocked_wrong_narrative_headings",
          message: `「${heading}」の項目は "- " で書きます`,
        };
      }
    }
  }

  return { ok: true };
}

/** 既存の厚い議事録を、薄いもので上書きしないための判定。 */
export function wouldDegradeExisting(existing: unknown, incoming: string): boolean {
  if (typeof existing !== "string") return false;
  const current = existing.trim();
  if (current.length < 300) return false;
  return incoming.trim().length <= current.length && checkNarrative(incoming).ok === false;
}
