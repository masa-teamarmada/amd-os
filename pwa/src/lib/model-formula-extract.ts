/**
 * 正本 md から「数式グループ」を切り出す純粋関数群。
 *
 * `/model/formulas`（現行モデルの式）は、式そのものを TS / JSON へ書き写さない。
 * 書き写すと `model/LOCK.json` で凍結した正本と画面が別々に動きうるからで、
 * それは model/README.md (e) が禁じている「正本の二重管理」そのものになる。
 * 代わりに、正本 md の見出しと数式の並び順だけを指し、TeX と説明文は毎回 md から読む。
 *
 * 数式グループの定義:
 *   直前に地の文がある `$$ ... $$` を 1 グループの先頭とし、
 *   地の文を挟まずに続く `$$ ... $$` は同じグループへ足す。
 *   正本が「次で表す。」の後に 2 本並べて書いている式 (τ_T と τ_F、V* と π*) を
 *   1 つの定義として扱うため。
 */

export interface CanonMathGroup {
  /** グループに含まれる TeX (正本の改行を保つ)。 */
  tex: string[];
  /** 直前の地の文 (式を導入する文)。 */
  lead: string;
  /** 直後の地の文 (記号の定義と注意)。次の式か次の見出しまで。 */
  tail: string;
}

export interface CanonSection {
  /** `##` / `###` の見出しテキスト (`#` と前後の空白を除いたもの)。 */
  heading: string;
  /** 見出しの行番号 (1 始まり)。正本へのリンクに添える。 */
  line: number;
  groups: CanonMathGroup[];
}

type Chunk = { type: "text" | "math"; value: string };

const MATH_FENCE = "$$";

/** 節の本文を、地の文と数式の交互列へ分解する。 */
function toChunks(body: string[]): Chunk[] {
  const chunks: Chunk[] = [];
  let inMath = false;
  let buffer: string[] = [];

  const flushText = () => {
    const value = buffer.join("\n").trim();
    if (value) chunks.push({ type: "text", value });
    buffer = [];
  };

  for (const line of body) {
    if (line.trim() === MATH_FENCE) {
      if (!inMath) {
        flushText();
        inMath = true;
      } else {
        chunks.push({ type: "math", value: buffer.join("\n").trim() });
        buffer = [];
        inMath = false;
      }
      continue;
    }
    buffer.push(line);
  }
  // 閉じられていない `$$` は数式として採らない (壊れた md で誤抽出しないため)。
  if (!inMath) flushText();
  return chunks;
}

function toGroups(chunks: Chunk[]): CanonMathGroup[] {
  const groups: CanonMathGroup[] = [];
  chunks.forEach((chunk, i) => {
    if (chunk.type !== "math") return;
    const prev = chunks[i - 1];
    const next = chunks[i + 1];
    const lead = prev?.type === "text" ? prev.value : "";
    const tail = next?.type === "text" ? next.value : "";
    const last = groups[groups.length - 1];
    if (!lead && last) {
      last.tex.push(chunk.value);
      last.tail = tail;
      return;
    }
    groups.push({ tex: [chunk.value], lead, tail });
  });
  return groups;
}

/** md 全文を `##` / `###` の節へ割り、各節の数式グループまで解決する。 */
export function parseCanonSections(markdown: string): CanonSection[] {
  const lines = markdown.split("\n");
  const sections: { heading: string; line: number; body: string[] }[] = [];
  let current: { heading: string; line: number; body: string[] } | null = null;

  lines.forEach((line, index) => {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      current = { heading: match[2].trim(), line: index + 1, body: [] };
      sections.push(current);
      return;
    }
    current?.body.push(line);
  });

  return sections.map((section) => ({
    heading: section.heading,
    line: section.line,
    groups: toGroups(toChunks(section.body)),
  }));
}

/** 段落 (空行区切り) 単位で前から / 後ろから n 個だけ残す。 */
export function takeParagraphs(text: string, count: number, from: "head" | "tail"): string {
  if (count <= 0 || !text) return "";
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const picked = from === "head" ? paragraphs.slice(0, count) : paragraphs.slice(-count);
  return picked.join("\n\n");
}
