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
  /** `##` / `###` の見出しテキスト (`#`、前後の空白、末尾の `{#id}` を除いたもの)。 */
  heading: string;
  /** 見出しが `{#id}` を持つ場合の id。台帳はこれで変数へ直リンクできるようにしている。 */
  explicitId: string | null;
  /** 見出しの行番号 (1 始まり)。正本へのリンクに添える。 */
  line: number;
  groups: CanonMathGroup[];
  /** 節の本文をそのまま (正本の一文を引くために使う)。 */
  rawBody: string[];
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
  type Raw = { heading: string; explicitId: string | null; line: number; body: string[] };
  const sections: Raw[] = [];
  let current: Raw | null = null;

  lines.forEach((line, index) => {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const withId = /^(.*?)\s*\{#([\w-]+)\}$/.exec(match[2].trim());
      current = {
        heading: (withId ? withId[1] : match[2]).trim(),
        explicitId: withId ? withId[2] : null,
        line: index + 1,
        body: [],
      };
      sections.push(current);
      return;
    }
    current?.body.push(line);
  });

  return sections.map((section) => ({
    heading: section.heading,
    explicitId: section.explicitId,
    line: section.line,
    groups: toGroups(toChunks(section.body)),
    rawBody: section.body,
  }));
}

/**
 * 指定した節の中から、`match` を含む一文をそのまま取り出す。
 *
 * 画面がモデルについて述べる文は、画面側で書かずに正本から引く。見つからなければ
 * null を返し、呼び出し側は欠落として表示し、検査を落とす（黙って無言にしない）。
 */
export function findCanonSentence(
  sections: CanonSection[],
  sectionHeading: string,
  match: string,
): { text: string; line: number } | null {
  const section = sections.find((s) => s.heading === sectionHeading);
  if (!section) return null;
  for (const line of section.rawBody) {
    if (!line.includes(match)) continue;
    // 箇条書きの `- ` と強調記号を外し、句点で区切って該当の一文だけにする。
    const cleaned = line.replace(/^\s*[-*]\s+/, "").trim();
    const sentence = cleaned
      .split("。")
      .map((s) => s.trim())
      .find((s) => s.includes(match));
    if (!sentence) continue;
    return { text: `${sentence}。`, line: section.line };
  }
  return null;
}

export interface CanonSymbol {
  /** 記号 (TeX のまま。`$T_C$` のように $ を含む)。 */
  symbol: string;
  /** 正本が書いている意味。 */
  meaning: string;
  /** 記号表が置かれている節の見出し。 */
  section: string;
  /** 表の先頭行の行番号。 */
  line: number;
}

// 記号表の見出し行。1列目が記号・状態・変数で、どこかの列が「意味」のもの。
// 正本は `| 記号 | 意味 |` と `| 状態 | 意味 | 例 |` の2形を使う。
const SYMBOL_TABLE_HEAD = /^\|\s*(記号|状態|変数)\s*\|/;

/**
 * md 中の記号表をすべて拾う。
 *
 * 記号の説明を画面側で書き起こさないために使う。モデルの記号が何を意味するかは
 * 正本が決めることで、画面が言い換えると正本と別の定義が生まれる。
 */
export function extractSymbolTables(markdown: string): CanonSymbol[] {
  const lines = markdown.split("\n");
  const out: CanonSymbol[] = [];
  let section = "";
  let i = 0;

  while (i < lines.length) {
    const heading = /^#{2,3}\s+(.*)$/.exec(lines[i]);
    if (heading) {
      section = heading[1].replace(/\s*\{#[\w-]+\}\s*$/, "").trim();
      i += 1;
      continue;
    }

    const line = lines[i];
    if (SYMBOL_TABLE_HEAD.test(line) && line.includes("意味")) {
      const header = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const meaningAt = Math.max(0, header.indexOf("意味"));
      const startLine = i + 1;
      let j = i + 2; // 見出し行 + 区切り行 を飛ばす
      while (j < lines.length && lines[j].startsWith("|")) {
        const cells = lines[j].replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (cells[0] && cells.length > meaningAt && cells[meaningAt]) {
          out.push({ symbol: cells[0], meaning: cells[meaningAt], section, line: startLine });
        }
        j += 1;
      }
      i = j;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * 記号を突き合わせるための正規化キー。
 * `$T_C$` と `T_C`、`\mathbf s_t` と `\mathbf{s}_t` を同じ記号として扱う。
 */
export function symbolKey(symbol: string): string {
  return symbol
    .replace(/\$/g, "")
    .replace(/\\(mathrm|mathbf|boldsymbol|widehat|mathcal|mathbb|left|right|,|;|!)/g, "")
    .replace(/[{}\s\\]/g, "")
    .toLowerCase();
}

/** 段落 (空行区切り) 単位で前から / 後ろから n 個だけ残す。 */
export function takeParagraphs(text: string, count: number, from: "head" | "tail"): string {
  if (count <= 0 || !text) return "";
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const picked = from === "head" ? paragraphs.slice(0, count) : paragraphs.slice(-count);
  return picked.join("\n\n");
}
