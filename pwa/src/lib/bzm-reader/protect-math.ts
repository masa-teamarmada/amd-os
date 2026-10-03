/**
 * 書斎の数式の退避（純関数）。設計正本 `pwa/design/bzm_reader.md` §5。
 *
 * 数式は Markdown の解析に通すと `_` `*` が強調として壊れるため、解析の前に番号付きの目印へ退避する。
 * 文字数の数え方（countReaderChars）も同じ切り出し規則を使うので、描画部品から分けてある。
 * 検査（node --experimental-strip-types）から読むので、`@/` を使わず拡張子付きの相対 import だけにする。
 */

export interface MathItem {
  /** KaTeX に渡す TeX（区切り記号なし） */
  tex: string;
  /** 原稿に書かれていた形。見出し id の平文を目次側の抽出と揃えるために残す */
  source: string;
}

export const MARK_OPEN = "⟦bzr-math:";
export const MARK_CLOSE = "⟧";
export const MARK_RE = /⟦bzr-math:(\d+)⟧/g;
export const MARK_FULL_RE = /^⟦bzr-math:(\d+)⟧$/;

// 数式の候補。先頭の `\$` は文字としての $ なので、数式として拾わず飛ばす。
// インライン `$...$` の規則は既存の BzmMarkdown と同じ（`$` と `$` の間に `$` を含まない）。
// 改行は許し、空行（段落の切れ目）はまたがない。開きと閉じの直前直後の空白や数字は問わない
// （`$P=$3億8400万円` や表のセル `$1.6/2 = $` を数式として読むため）。金額の `$` は `\$` で書く。
const MATH_RE =
  /\\\$|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\$)((?:(?!\n[ \t]*\n)[^$])+?)\$/g;

// インラインコード（バッククォートの個数が同じもので閉じる。空行はまたがない）。中の $ は数式にしない。
const INLINE_CODE_RE = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;

/** 見つけた数式 1 件。`container` は表示数式の行頭にある引用（`> `）や字下げ */
export interface FoundMath {
  display: boolean;
  tex: string;
  source: string;
  container: string;
}

type MathReplacer = (found: FoundMath) => string;

function replaceInlineMath(text: string, replacer: MathReplacer): string {
  return text.replace(MATH_RE, (match: string, dd?: string, br?: string, paren?: string, inline?: string, offset?: number) => {
    if (match === "\\$") return match;
    const display = dd ?? br;
    if (display !== undefined) {
      const at = offset ?? 0;
      const lineStart = text.lastIndexOf("\n", at - 1) + 1;
      const before = text.slice(lineStart, at);
      // 引用（> ）や箇条書きの続き行（字下げ）の中に置かれた式は、その入れ物を保ったまま囲みにする
      const container = /^[ \t]*(?:>[ \t]*)*$/.test(before) ? before : "";
      let tex = display.trim();
      if (container.includes(">")) {
        tex = tex
          .split("\n")
          .map((line) => line.replace(/^[ \t]*>[ \t]?/, ""))
          .join("\n");
      }
      return replacer({ display: true, tex, source: match, container });
    }
    return replacer({ display: false, tex: (paren ?? inline ?? "").trim(), source: match, container: "" });
  });
}

function replaceTextChunk(text: string, replacer: MathReplacer): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(INLINE_CODE_RE)) {
    const at = m.index ?? 0;
    out += replaceInlineMath(text.slice(last, at), replacer);
    out += m[0];
    last = at + m[0].length;
  }
  out += replaceInlineMath(text.slice(last), replacer);
  return out;
}

/** コードブロックとインラインコードの外にある数式を、replacer の返す文字列へ置き換える */
export function replaceMath(source: string, replacer: MathReplacer): string {
  const pieces: string[] = [];
  let buffer: string[] = [];
  let fence: { char: string; len: number } | null = null;
  const flush = () => {
    if (buffer.length > 0) {
      pieces.push(replaceTextChunk(buffer.join("\n"), replacer));
      buffer = [];
    }
  };
  for (const line of source.split("\n")) {
    if (fence) {
      pieces.push(line);
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) fence = null;
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    // バッククォートのフェンスは、情報文字列にバッククォートを含まないものだけ（含むなら行内のコード）
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      flush();
      fence = { char: open[1][0], len: open[1].length };
      pieces.push(line);
      continue;
    }
    buffer.push(line);
  }
  flush();
  return pieces.join("\n");
}

/** コードブロックとインラインコードの外にある数式を目印へ置き換える */
export function protectMath(source: string): { text: string; maths: MathItem[] } {
  const maths: MathItem[] = [];
  const text = replaceMath(source, ({ display, tex, source: original, container }) => {
    const id = maths.push({ tex, source: original }) - 1;
    if (!display) return `\`${MARK_OPEN}${id}${MARK_CLOSE}\``;
    const blank = container.replace(/[ \t]+$/, "");
    return `\n${blank}\n${container}\`\`\`bzr-math\n${container}${id}\n${container}\`\`\`\n${blank}\n${container}`;
  });
  return { text, maths };
}
