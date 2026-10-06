/**
 * 書斎の原稿前処理（純関数）。設計正本 `pwa/design/bzm_reader.md` §4。
 *
 * 原稿の md は書き換えず、描画の直前に Markdown 文字列だけを整える。
 * 検査（node --experimental-strip-types）から読むので、`@/` と Node 組み込みを使わず、
 * 拡張子付きの相対 import だけにする。
 */
import { headingAnchorId } from "../heading-anchor.ts";
import { replaceMath } from "./protect-math.ts";
import { readerAssetHref, readerChapterHref } from "./types.ts";
import type { ReaderHeading } from "./types.ts";

// ---------------------------------------------------------------------------
// 共通の下ごしらえ
// ---------------------------------------------------------------------------

/** コードフェンスの開始・終了行。インデントは 3 文字まで（4 文字以上はインデントコード） */
const FENCE_OPEN_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

interface FenceState {
  char: string;
  length: number;
}

/**
 * 1 行ぶんのフェンス状態を進める。フェンス行そのものと、フェンスの内側は isCode=true。
 * コードブロックの中は一切触らないための共通の判定。
 */
function stepFence(line: string, fence: FenceState | null): { fence: FenceState | null; isCode: boolean } {
  if (fence) {
    const closeRe = new RegExp(`^\\s{0,3}${fence.char === "`" ? "`" : "~"}{${fence.length},}\\s*$`);
    if (closeRe.test(line)) return { fence: null, isCode: true };
    return { fence, isCode: true };
  }
  const match = FENCE_OPEN_RE.exec(line);
  // バッククォートのフェンスは、情報文字列にバッククォートを含まないものだけ（含むなら行内のコード）
  if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
    return { fence: { char: match[1][0], length: match[1].length }, isCode: true };
  }
  return { fence: null, isCode: false };
}

function normalizeNewlines(source: string): string {
  return source.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/**
 * pandoc の見出し属性 `{-}` `{.unnumbered}` `{#id}` を末尾から外して読む。
 * 属性として読めない `{…}`（数式の波括弧など）は本文として残す。
 */
function parseHeadingAttrs(text: string): { text: string; id: string | null; hadAttr: boolean } {
  const match = /\s*\{([^{}]*)\}\s*$/.exec(text);
  if (!match) return { text, id: null, hadAttr: false };
  const tokens = match[1].trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { text, id: null, hadAttr: false };
  const isAttr = tokens.every((token) => /^(?:-|\.[\w-]+|#[^\s}]+|[\w-]+=\S*)$/.test(token));
  if (!isAttr) return { text, id: null, hadAttr: false };
  const idToken = tokens.find((token) => token.startsWith("#"));
  return { text: text.slice(0, match.index), id: idToken ? idToken.slice(1) : null, hadAttr: true };
}

/** 見出しの平文。強調記号とインラインコードの記号を除き、`$…$` の数式はそのまま残す */
function headingPlainText(raw: string): string {
  return raw
    .replace(/\s+#+\s*$/, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// 1. YAML の先頭
// ---------------------------------------------------------------------------

function stripFrontMatter(source: string): { body: string; title: string | null } {
  if (!/^---[ \t]*\n/.test(source)) return { body: source, title: null };
  const lines = source.split("\n");
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (/^(?:---|\.\.\.)[ \t]*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end < 0) return { body: source, title: null };

  let title: string | null = null;
  for (const line of lines.slice(1, end)) {
    const match = /^title:\s*(.*?)\s*$/.exec(line);
    if (match) {
      title = match[1].replace(/^(["'])(.*)\1$/, "$2").trim() || null;
      break;
    }
  }
  return { body: lines.slice(end + 1).join("\n").replace(/^\n+/, ""), title };
}

// ---------------------------------------------------------------------------
// 2. HTML コメント（複数行にまたがる）。コードブロックの中は触らない
// ---------------------------------------------------------------------------

function countBackticks(text: string): number {
  let count = 0;
  for (const ch of text) if (ch === "`") count += 1;
  return count;
}

function stripHtmlComments(source: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  const out: string[] = [];
  let fence: FenceState | null = null;
  let inComment = false;
  let noteBuf: string[] = [];

  const flushNote = () => {
    const note = noteBuf
      .map((l) => l.trimEnd())
      .join("\n")
      .trim();
    if (note) notes.push(note);
    noteBuf = [];
  };

  for (const line of source.split("\n")) {
    if (!inComment) {
      const step = stepFence(line, fence);
      fence = step.fence;
      if (step.isCode) {
        out.push(line);
        continue;
      }
    }

    let rest = line;
    let kept = "";
    let touched = false;
    for (;;) {
      if (inComment) {
        const close = rest.indexOf("-->");
        if (close < 0) {
          noteBuf.push(rest);
          rest = "";
          break;
        }
        noteBuf.push(rest.slice(0, close));
        rest = rest.slice(close + 3);
        inComment = false;
        flushNote();
        continue;
      }
      let open = rest.indexOf("<!--");
      // インラインコードの中の `<!--` は説明用の文字列なので外さない
      while (open >= 0 && countBackticks(kept + rest.slice(0, open)) % 2 === 1) {
        open = rest.indexOf("<!--", open + 4);
      }
      if (open < 0) {
        kept += rest;
        break;
      }
      kept += rest.slice(0, open);
      rest = rest.slice(open + 4);
      inComment = true;
      touched = true;
      noteBuf = [];
    }

    if (touched) {
      kept = kept.trimEnd();
      if (kept.trim() === "") continue;
    }
    out.push(kept);
  }
  if (inComment) flushNote();
  return { text: out.join("\n"), notes };
}

// ---------------------------------------------------------------------------
// 3〜8. 行ごとの書き換え
// ---------------------------------------------------------------------------

const CALLOUT_LABELS: Record<string, string> = {
  NOTE: "メモ",
  TIP: "ヒント",
  IMPORTANT: "重要",
  WARNING: "注意",
  CAUTION: "注意",
};

const REFERENCES_HEADING_RE = /^(?:[\d.]+\s+)?(?:references|参考文献)$/i;

/** `<sup>[1,2]</sup>` `<sup>[3–5]</sup>` `<sup>[3-5]</sup>` `<sup>[1, 2]</sup>` */
const SUP_CITATION_RE = /<sup>\s*\[\s*(\d+(?:\s*(?:[,，、]|[–—-])\s*\d+)*)\s*\]\s*<\/sup>/g;

const IMAGE_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)((?:\s+"[^"]*")?)\s*\)/g;

/** `](./slug)` `](./slug.md)` `](./slug#hash)`。拡張子付きの別ファイル（./fig.png など）は対象外 */
const CHAPTER_LINK_RE = /\]\(\.\/([A-Za-z0-9_-]+)(?:\.md)?(#[^)\s]*)?\)/g;

/** md のあるフォルダからの相対パスを `bzm/` からの相対パスに解く。解けない（絶対・外部・bzm の外）なら null */
function resolveRelativeAsset(file: string, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/") || src.startsWith("#")) return null;
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // 不正なエスケープはそのまま扱う
  }
  const dirParts = file.split("/").slice(0, -1);
  const stack: string[] = [...dirParts];
  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.length > 0 ? stack.join("/") : null;
}

function rewriteInlineLine(line: string, opts: PreprocessOptions): string {
  let next = line;

  // 4. 論文の引用番号
  if (next.includes("<sup>")) {
    next = next.replace(SUP_CITATION_RE, (_all, inner: string) => {
      const first = /\d+/.exec(inner)?.[0] ?? "";
      return `[${inner.trim()}](#ref-${first})`;
    });
  }

  // 6. 図のパス（章間リンクより先に書き換え、`./fig.png` を章リンクと取り違えない）
  if (next.includes("![")) {
    next = next.replace(IMAGE_RE, (all, alt: string, src: string, title: string) => {
      const rel = resolveRelativeAsset(opts.file, src);
      if (!rel) return all;
      return `![${alt}](${readerAssetHref(rel)}${title})`;
    });
  }

  // 7. 章間リンク
  if (next.includes("](./")) {
    const chapterSlugs = new Set(opts.bookChapterSlugs);
    next = next.replace(CHAPTER_LINK_RE, (_all, slug: string, hash: string | undefined) => {
      const suffix = hash ?? "";
      const href = chapterSlugs.has(slug) ? readerChapterHref(opts.bookId, slug) : `/bzm/${slug}`;
      return `](${href}${suffix})`;
    });
  }

  return next;
}

function rewriteLines(text: string, opts: PreprocessOptions): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let fence: FenceState | null = null;
  let refsLevel = 0; // 0 = 文献一覧の中ではない
  // 同じ平文の見出しの出現回数（h1〜h4。描画側が id を振る範囲）。2 件目以降に連番つきの明示 id を付ける
  const headingSeen = new Map<string, number>();

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    const step = stepFence(line, fence);
    fence = step.fence;
    if (step.isCode) {
      out.push(line);
      continue;
    }

    // 3. 見出し属性。`{#id}` は描画側が id にするので残す
    const heading = /^(\s{0,3})(#{1,6})(\s+)(.*)$/.exec(line);
    if (heading) {
      const level = heading[2].length;
      const attrs = parseHeadingAttrs(heading[4]);
      const title = attrs.hadAttr ? attrs.text.trimEnd() : heading[4];
      let idSuffix = attrs.id ? ` {#${attrs.id}}` : "";
      let headText = title;
      if (!attrs.id && level <= 4) {
        const plain = headingPlainText(title);
        if (plain) {
          // 目次の id（extractReaderHeadings）も描画の id も `{#id}` を優先するので、連番を明示すれば一致する
          const base = headingAnchorId(plain);
          const n = (headingSeen.get(base) ?? 0) + 1;
          headingSeen.set(base, n);
          if (n >= 2) {
            idSuffix = ` {#${base}-${n}}`;
            // 閉じの `#` 列があると `{#id}` が見出しの文字になるので、先に外す
            headText = title.replace(/\s+#+\s*$/, "");
          }
        }
      }
      line = `${heading[1]}${heading[2]}${heading[3]}${headText}${idSuffix}`;

      if (refsLevel > 0 && level <= refsLevel) refsLevel = 0;
      if (REFERENCES_HEADING_RE.test(headingPlainText(title))) refsLevel = level;
      out.push(rewriteInlineLine(line, opts));
      continue;
    }

    // 5. 文献一覧: 行頭 `N. ` を `[N](#refdef-N) ` で始まる段落にする
    if (refsLevel > 0) {
      const ref = /^(\d+)\.\s+(\S.*)$/.exec(line);
      if (ref) {
        if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
        out.push(rewriteInlineLine(`[${ref[1]}](#refdef-${ref[1]}) ${ref[2]}`, opts));
        continue;
      }
    }

    // 8. callout。ラベルだけの段落にして、本文と同じ段落に溶けないようにする
    const callout = /^(\s*>[> ]*?)\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i.exec(line);
    if (callout) {
      const prefix = callout[1].trimEnd();
      const label = `**${CALLOUT_LABELS[callout[2].toUpperCase()]}**`;
      const trailing = callout[3].trim();
      out.push(`${prefix} ${label}`);
      const next = lines[i + 1] ?? "";
      if (trailing) {
        out.push(prefix);
        out.push(rewriteInlineLine(`${prefix} ${trailing}`, opts));
      } else if (!/^\s*>[> ]*$/.test(next)) {
        out.push(prefix);
      }
      continue;
    }

    out.push(rewriteInlineLine(line, opts));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

export interface PreprocessOptions {
  /** `bzm/` からの相対パス（図の相対パスを解く基準） */
  file: string;
  bookId: string;
  /** 同じ本の章の slug（章間リンクを書斎の URL にするか `/bzm/<slug>` に残すかの判定） */
  bookChapterSlugs: string[];
}

export function preprocessReaderMarkdown(
  source: string,
  opts: PreprocessOptions,
): { markdown: string; notes: string[]; frontMatterTitle: string | null } {
  const { body, title } = stripFrontMatter(normalizeNewlines(source));
  const { text, notes } = stripHtmlComments(body);
  const markdown = rewriteLines(text, opts).trim();
  return { markdown, notes, frontMatterTitle: title };
}

/** 見出しの文字から作る slug。英数字とハイフンの小文字。日本語だけなら空文字 */
function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** コードブロックの外の `# ` 見出しで章に割る。最初の見出しより前の文は最初の章の頭に付ける */
export function splitByH1(markdown: string): { title: string; slug: string; markdown: string }[] {
  const lines = normalizeNewlines(markdown).split("\n");
  const starts: number[] = [];
  let fence: FenceState | null = null;
  lines.forEach((line, index) => {
    const step = stepFence(line, fence);
    fence = step.fence;
    if (!step.isCode && /^#\s+\S/.test(line)) starts.push(index);
  });

  if (starts.length === 0) {
    return [{ title: "", slug: "section-1", markdown: markdown.trim() }];
  }

  const used = new Set<string>();
  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length;
    // 前置き（著者行など）は最初の章の頭に入れる
    const from = i === 0 ? 0 : start;
    const title = headingPlainText(parseHeadingAttrs(lines[start].replace(/^#\s+/, "")).text);

    let slug = slugFromTitle(title) || `section-${i + 1}`;
    if (used.has(slug)) {
      let n = 2;
      while (used.has(`${slug}-${n}`)) n += 1;
      slug = `${slug}-${n}`;
    }
    used.add(slug);

    return { title, slug, markdown: lines.slice(from, end).join("\n").trim() };
  });
}

/**
 * `# ` 見出しが無く `## ` で始まる原稿（補足資料）の先頭見出しを `# ` に上げる。
 * 章の題が本文の先頭に出ない、目次の第2階層に章名が重複する、の二つを避けるため。
 */
export function ensureLeadingH1(markdown: string): string {
  const lines = markdown.split("\n");
  let fence: FenceState | null = null;
  let firstContent = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const step = stepFence(lines[i], fence);
    fence = step.fence;
    if (step.isCode) {
      if (firstContent < 0) firstContent = i;
      continue;
    }
    if (/^#\s+\S/.test(lines[i])) return markdown;
    if (firstContent < 0 && lines[i].trim() !== "") firstContent = i;
  }
  if (firstContent >= 0 && /^##\s+\S/.test(lines[firstContent])) {
    lines[firstContent] = lines[firstContent].replace(/^##\s+/, "# ");
    return lines.join("\n");
  }
  return markdown;
}

/**
 * 目次の第2階層に載る見出しの行（`## ` と `### `）を読む。載らない行（h2・h3 以外、平文が空の見出し）は null。
 * extractReaderHeadings と chapterHasIntro が同じ判定を使い、目次に載る見出しと「導入」の境目を食い違わせない。
 */
function readTocHeadingLine(line: string): { level: 2 | 3; id: string | null; text: string } | null {
  const match = /^\s{0,3}(#{2,3})\s+(\S.*)$/.exec(line);
  if (!match) return null;
  const attrs = parseHeadingAttrs(match[2]);
  const text = headingPlainText(attrs.hadAttr ? attrs.text : match[2]);
  if (!text) return null;
  return { level: match[1].length === 2 ? 2 : 3, id: attrs.id, text };
}

/**
 * 目次の第2階層（`## ` と `### `）。コードブロックの外だけを見る。
 * id は `{#id}` があればそれ、無ければ見出しの平文から anchorId で作る（描画側と同じ規則）。
 */
export function extractReaderHeadings(markdown: string, anchorId: (text: string) => string): ReaderHeading[] {
  const headings: ReaderHeading[] = [];
  let fence: FenceState | null = null;
  for (const line of normalizeNewlines(markdown).split("\n")) {
    const step = stepFence(line, fence);
    fence = step.fence;
    if (step.isCode) continue;
    const toc = readTocHeadingLine(line);
    if (!toc) continue;
    headings.push({ id: toc.id ?? anchorId(toc.text), text: toc.text, level: toc.level });
  }
  return headings;
}

/**
 * 章の最初の文章（導入）があるか。目次で「導入」の項目を置くかどうかを決める。設計正本 §6.4。
 *
 * 前処理後の本文で、最初の h1（章の題）から、目次に載る最初の見出し（h2。h2 より先に h3 が来る原稿は、その h3）までの
 * あいだに、空白以外の本文があれば true。本文は、空行以外のすべて（段落、リスト、表、図、引用、コードブロック、h4 以下の見出し）。
 * - h1 のすぐ後に節が来る（間が空行だけ）なら false。
 * - 節が 1 つも無い章は、h1 より後のすべてが導入になる。
 * - h1 が無い原稿は false。導入は章の題の直後から数える。
 * - コードブロックの中の `#` は見出しとして読まない（コードブロックそのものは本文として数える）。
 * 補足資料のように h1 の後が h3 から始まる原稿は、最初の h3 を最初の節として扱う（h2 だけを境にすると、h2 の無い原稿は全章が導入ありになる）。
 */
export function chapterHasIntro(markdown: string): boolean {
  let fence: FenceState | null = null;
  let afterH1 = false;
  for (const line of normalizeNewlines(markdown).split("\n")) {
    const step = stepFence(line, fence);
    fence = step.fence;
    if (step.isCode) {
      if (afterH1) return true;
      continue;
    }
    if (!afterH1) {
      if (/^\s{0,3}#\s+\S/.test(line)) afterH1 = true;
      continue;
    }
    if (readTocHeadingLine(line) !== null) return false;
    if (line.trim() !== "") return true;
  }
  return false;
}

// 括弧の中身は、引用符つきの title（書誌に `(2020)` のような括弧が入る）を 1 つの塊として読む
const LINK_TARGET = String.raw`\((?:[^)\s]*(?:\s+"(?:[^"\\]|\\.)*")?\s*|[^)]*)\)`;
const IMAGE_ANY_RE = new RegExp(String.raw`!\[[^\]]*\]${LINK_TARGET}`, "g");
const LINK_ANY_RE = new RegExp(String.raw`\[([^\]]*)\]${LINK_TARGET}`, "g");

/**
 * 前処理後の Markdown の文字数（目安）。画面に見える字数に近づけるため、次のように数える。
 * - 数えない: 空白と改行、見出しの `#` と `{#id}`、表の区切り行、コードブロックの囲み記号。
 * - リンクは表示文字だけ（URL は数えない）。図は 1 字。数式（`$…$` `$$…$$` `\(…\)` `\[…\]`）は 1 件を 1 字。
 * - 数える: コードブロックの中身、表の縦線、強調の記号。
 */
export function countReaderChars(markdown: string): number {
  // 数式は 1 字へ（コードブロックとインラインコードの外だけ。TeX の原文は数えない）
  const flat = replaceMath(normalizeNewlines(markdown), () => "∑");
  let fence: FenceState | null = null;
  let total = 0;
  for (const line of flat.split("\n")) {
    const step = stepFence(line, fence);
    const wasInside = fence !== null;
    fence = step.fence;
    if (step.isCode) {
      // フェンス行（開始と終了）は数えず、中身の行だけ数える
      const isMarker = !wasInside || fence === null;
      if (!isMarker) total += [...line.replace(/\s+/g, "")].length;
      continue;
    }
    if (/^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(line)) continue;
    const head = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    const visible = (head ? head[1].replace(/\s*\{#[^}\s]+\}\s*$/, "") : line)
      .replace(IMAGE_ANY_RE, "図")
      .replace(LINK_ANY_RE, "$1");
    total += [...visible.replace(/\s+/g, "")].length;
  }
  return total;
}

/** コードブロックの外の最初の見出し（`# ` 〜 `###### `）の平文。`{-}` `{#id}` と強調記号は除く。無ければ null */
export function firstHeadingText(markdown: string, onlyLevel?: number): string | null {
  let fence: FenceState | null = null;
  for (const line of normalizeNewlines(markdown).split("\n")) {
    const step = stepFence(line, fence);
    fence = step.fence;
    if (step.isCode) continue;
    const match = /^\s{0,3}(#{1,6})\s+(\S.*)$/.exec(line);
    if (!match) continue;
    if (onlyLevel !== undefined && match[1].length !== onlyLevel) continue;
    const attrs = parseHeadingAttrs(match[2]);
    const text = headingPlainText(attrs.hadAttr ? attrs.text : match[2]);
    if (text) return text;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 論文の引用番号 → 文献一覧の章への飛び先（論文を章に割った本で load.ts が使う）
// ---------------------------------------------------------------------------

/** 文献一覧の章の題か（`References`、`参考文献`、`7. References` など） */
export function isReferencesTitle(title: string): boolean {
  return REFERENCES_HEADING_RE.test(headingPlainText(title));
}

/** 書誌の平文。リンクは表示文字、強調とコードの記号は除き、バックスラッシュの逃がしを戻す */
function plainReferenceText(raw: string): string {
  return raw
    .replace(IMAGE_ANY_RE, "")
    .replace(LINK_ANY_RE, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/(?<!\\)[*`]/g, "")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 文献一覧の章（`[N](#refdef-N) 書誌` で始まる段落）から、番号 → 書誌の平文を作る。
 * 次の行が字下げの続きなら同じ書誌として連結し、空行か次の項目で閉じる。
 */
export function extractReferenceTexts(markdown: string): Map<number, string> {
  const refs = new Map<number, string>();
  let fence: FenceState | null = null;
  let current: { n: number; parts: string[] } | null = null;
  const close = () => {
    if (current) {
      const text = plainReferenceText(current.parts.join(" "));
      if (text && !refs.has(current.n)) refs.set(current.n, text);
    }
    current = null;
  };
  for (const line of normalizeNewlines(markdown).split("\n")) {
    const step = stepFence(line, fence);
    fence = step.fence;
    if (step.isCode) {
      close();
      continue;
    }
    const start = /^\[(\d+)\]\(#refdef-\d+\) (.*)$/.exec(line);
    if (start) {
      close();
      current = { n: Number(start[1]), parts: [start[2]] };
      continue;
    }
    if (line.trim() === "" || /^\s{0,3}#{1,6}\s/.test(line)) {
      close();
      continue;
    }
    if (current) current.parts.push(line.trim());
  }
  close();
  return refs;
}

const CITE_LINK_RE = /\[([^\]]*)\]\(#ref-\d+\)/g;

function escapeLinkTitle(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * 章内だけを指す引用 `[1,2](#ref-1)` を、文献一覧の章へ飛ぶ番号ごとのリンクに書き換える。
 * `[1](/bzm/read/<book>/<章>#ref-1 "書誌")`。範囲 `3–5` は両端の番号を、列挙 `1,2` は各番号をリンクにし、区切りは残す。
 * コードブロックの中は触らない。文献一覧の章そのものには使わない（そこには目印があるので章内リンクで足りる）。
 */
export function rewriteReferenceCitations(
  markdown: string,
  opts: { bookId: string; referencesSlug: string; texts: Map<number, string> },
): string {
  const base = readerChapterHref(opts.bookId, opts.referencesSlug);
  const linkOf = (n: number) => {
    const text = opts.texts.get(n);
    return `[${n}](${base}#ref-${n}${text ? ` "${escapeLinkTitle(text)}"` : ""})`;
  };
  let fence: FenceState | null = null;
  return markdown
    .split("\n")
    .map((line) => {
      const step = stepFence(line, fence);
      fence = step.fence;
      if (step.isCode || !line.includes("](#ref-")) return line;
      return line.replace(CITE_LINK_RE, (all, inner: string) => {
        const parts = inner.split(/\s*([,，、]|[–—-])\s*/);
        // 偶数番目が番号、奇数番目が区切り
        if (parts.length % 2 === 0 || parts.some((part, index) => index % 2 === 0 && !/^\d+$/.test(part))) return all;
        return parts
          .map((part, index) => {
            if (index % 2 === 0) return linkOf(Number(part));
            return /[,，、]/.test(part) ? "," : part;
          })
          .join("");
      });
    })
    .join("\n");
}
