import { headingAnchorId } from "@/lib/heading-anchor";
import { getModelMarkdownSource } from "./model-data";

/**
 * 現行モデル（BZM 3.0）の式を、正本（model/MODEL_VERSION_LEDGER.md）から抜き出す。
 *
 * まさ 2026-08-25「正本の式が一番下に置かれていて読みにくいので、これを一番上にもってきてほしい」
 * → 「旧モデルみたいな感じで、簡単な説明も添えて全体が見渡せるようにしておいてほしい。
 *    情報密度を上げることは、何度も何度も言ってると思うので、常に気をつけてほしい」。
 *
 * ページ下部の「すべての式」は `formula-canon.ts` が `bzm/` から抽出している**旧 BZM 2.2 系列**で、
 * 2026-08-24 の BZM 3.0 採用で退役した（画面に札あり）。現行の式は台帳 §5・§6 にあるので、ここで抜き出す。
 *
 * **説明も正本から取る。画面側で書き起こさない。**
 *  - `label` … 式の直前の段落（「**ステージゲートの前進**:」のような導入文）
 *  - `meaning` … 式の直後の記号表の「意味」列。無ければ直前段落の残り
 * 正本に式が増えれば、ここは何もしなくても追随する。
 */

export interface CurrentFormula {
  index: number;
  /** TeX 本体（`$$` の中身） */
  tex: string;
  /** その式が置かれている節の見出し（`{#id}` は除く） */
  section: string;
  /** 一覧の「節」列に置く短い形。長い見出しは折り返して行が高くなるので詰める */
  sectionShort: string;
  /** 節へのアンカー id */
  anchor: string;
  /** 何の式か（式の直前の導入文から。無ければ空） */
  label: string;
  /** 主な記号の意味（式の直後の記号表から。「$x$ … 意味」の並び） */
  symbols: { symbol: string; meaning: string }[];
}

const HEADING_ID_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/;
const EVIDENCE_RE = /\s*\[根拠\]\(#evidence(?:\s+"[^"]*")?\)/g;
const CITE_RE = /\s*\[\d+\]\(#ref-\d+(?:\s+"[^"]*")?\)/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;

/**
 * 正本の地の文から、画面の一覧に置いても読める短い文を作る。中身は変えない。
 *
 * 切り詰めは `$…$` の途中で切らない。途中で切ると `$` の数が奇数になり、
 * インライン数式の解釈がその先の文まで巻き込んで壊れる。
 */
function tidy(text: string, max: number): string {
  const cleaned = text
    .replace(EVIDENCE_RE, "")
    .replace(CITE_RE, "")
    .replace(LINK_RE, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .replace(/——$/, "")
    .trim();
  if (cleaned.length <= max) return cleaned;

  let cut = max;
  const dollarsBefore = (upto: number) => {
    let n = 0;
    for (let i = 0; i < upto; i += 1) if (cleaned[i] === "$") n += 1;
    return n;
  };
  if (dollarsBefore(cut) % 2 === 1) {
    // 数式の内側で切れている。直前の `$` の手前まで戻す。
    const back = cleaned.lastIndexOf("$", cut - 1);
    cut = back > 0 ? back : cut;
  }
  return `${cleaned.slice(0, cut).trim()}…`;
}

function headingParts(raw: string): { text: string; anchor: string } {
  const m = HEADING_ID_RE.exec(raw);
  if (m) return { text: raw.replace(HEADING_ID_RE, "").trim(), anchor: m[1] };
  const text = raw.trim();
  return { text, anchor: headingAnchorId(text) };
}

/** 直前へ遡って、式の導入になっている段落を1つ拾う。見出しや表に当たったら諦める。 */
function leadParagraph(lines: string[], formulaStart: number): string {
  for (let i = formulaStart - 1; i >= 0 && i >= formulaStart - 4; i -= 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("|") || line === "$$" || line.startsWith("---")) return "";
    return tidy(line, 48);
  }
  return "";
}

/** 直後の記号表（`| $x$ | 意味 |`）を拾う。 */
function symbolTable(lines: string[], formulaEnd: number): { symbol: string; meaning: string }[] {
  const out: { symbol: string; meaning: string }[] = [];
  let i = formulaEnd + 1;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i >= lines.length || !lines[i].trim().startsWith("|")) return out;

  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|");
    if (cells.length < 2) continue;
    const symbol = cells[0].trim();
    if (!symbol || /^-+$/.test(symbol) || symbol === "記号") continue;
    out.push({ symbol, meaning: tidy(cells[1], 30) });
  }
  return out;
}

export function loadCurrentFormulas(): CurrentFormula[] {
  const source = getModelMarkdownSource("MODEL_VERSION_LEDGER");
  if (!source) return [];

  const lines = source.split("\n");
  const out: CurrentFormula[] = [];
  let h2: { text: string; anchor: string } | null = null;
  let h3: { text: string; anchor: string } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      h2 = headingParts(line.slice(3));
      h3 = null;
      continue;
    }
    if (line.startsWith("### ")) {
      h3 = headingParts(line.slice(4));
      continue;
    }
    if (line.trim() !== "$$") continue;

    const start = i;
    const buf: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "$$") {
      buf.push(lines[j]);
      j += 1;
    }
    i = j;

    const tex = buf.join("\n").trim();
    if (!tex) continue;
    const head = h3 ?? h2;
    if (!head) continue;

    out.push({
      index: out.length + 1,
      tex,
      section: head.text,
      sectionShort: tidy(head.text.split(/\s*—\s*/)[0], 20),
      anchor: head.anchor,
      label: leadParagraph(lines, start),
      symbols: symbolTable(lines, j),
    });
  }

  return out;
}
