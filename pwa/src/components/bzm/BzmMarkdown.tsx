"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { headingAnchorId } from "@/lib/heading-anchor";

/**
 * BzmMarkdown — 教科書専用の Markdown レンダラー。
 *
 * 既存の MarkdownView は数式 ($...$ / $$...$$) を解釈しない。教科書は
 * 数式が本質なので、`remark-math` / `rehype-katex` を入れずに (= 依存追加なし)、
 * 自前で数式ブロックを切り出して katex でレンダリングする。
 *
 *  - `$$ ... $$` / `\[ ... \]` → ディスプレイ数式ブロック
 *  - 段落内の `$ ... $` / `\( ... \)` → インライン数式
 *  - それ以外は react-markdown + remark-gfm (= MarkdownView と同じ見た目方針)
 *
 * KaTeX は `before-zero/theory/*.md` の TeX 記法 (\prod, \alpha, \sigma, \mu,
 * \frac, \arg\max, \mathbb, \boldsymbol, 行列環境 等) をそのまま扱える。
 */

interface Props {
  source: string;
  compact?: boolean;
}

function renderKatex(tex: string, display: boolean) {
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "html",
    strict: "ignore",
  });
}

// 段落テキスト中の $...$ / \(...\) をインライン数式として切り出す。
function renderInlineMath(text: string): ReactNode {
  if (!text.includes("$") && !text.includes("\\(")) return text;
  const parts: ReactNode[] = [];
  const regex = /\$([^$]+)\$|\\\(([\s\S]+?)\\\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={`t-${key}`}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(
      <span
        key={`m-${key}`}
        // KaTeX HTML は信頼できる (= ローカル md の TeX をビルド時に変換)
        dangerouslySetInnerHTML={{ __html: renderKatex(match[1] ?? match[2], false) }}
      />,
    );
    lastIndex = regex.lastIndex;
    key += 1;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={`t-${key}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

// children を再帰的に走査して、文字列ノードの $...$ をインライン数式に変換する。
function withInlineMath(children: ReactNode): ReactNode {
  if (typeof children === "string") return renderInlineMath(children);
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? <Fragment key={i}>{renderInlineMath(child)}</Fragment> : child,
    );
  }
  return children;
}

// source をディスプレイ数式とそれ以外のテキストブロックに分割する。
type Segment = { type: "md"; content: string } | { type: "math"; content: string };

function normalizeInlineMathDelimiters(source: string) {
  return source.replace(/\\\(([\s\S]+?)\\\)/g, (_match, tex: string) => `$${tex}$`);
}

function splitDisplayMath(source: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "md", content: normalizeInlineMathDelimiters(source.slice(lastIndex, match.index)) });
    }
    segments.push({ type: "math", content: (match[1] ?? match[2]).trim() });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < source.length) {
    segments.push({ type: "md", content: normalizeInlineMathDelimiters(source.slice(lastIndex)) });
  }
  return segments;
}

/** Markdownを解釈しない短文用。タイトル・要約でもLaTeXだけは数式表示する。 */
export function BzmMathText({ source }: Props) {
  const segments = splitDisplayMath(source);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "math" ? (
          <span
            key={index}
            className="my-1 block max-w-full overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: renderKatex(segment.content, true) }}
          />
        ) : (
          <Fragment key={index}>{renderInlineMath(segment.content)}</Fragment>
        ),
      )}
    </>
  );
}

// 見出し末尾の `{#some-id}` を抽出し、id 属性へ回して表示テキストからは除去する。
// 台帳 (model/MODEL_VERSION_LEDGER.md) が変数説明の見出しにこの記法を使い、
// 他ページからその変数へ直接リンクできるようにするため (2026-08-22)。
const HEADING_ID_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/;

// `{#id}` 記法が無い見出しにも、見出しテキストから決まる id を必ず振る。
// id の作り方は @/lib/heading-anchor と共有する (/model/formulas のリンク生成側と
// 同じ関数を使わないと、id が静かにずれてリンクが死ぬ)。
function plainText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  return "";
}

function extractHeadingId(children: ReactNode): { id: string | undefined; children: ReactNode } {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.length === 0) return { id: undefined, children };
  const lastIndex = arr.length - 1;
  const last = arr[lastIndex];
  if (typeof last === "string") {
    const match = last.match(HEADING_ID_RE);
    if (match) {
      const id = match[1];
      const stripped = last.slice(0, match.index);
      const newArr = [...arr];
      if (stripped.length > 0) {
        newArr[lastIndex] = stripped;
      } else {
        newArr.splice(lastIndex, 1);
      }
      return { id, children: newArr.length === 1 ? newArr[0] : newArr };
    }
  }
  const text = plainText(children).trim();
  return { id: text ? headingAnchorId(text) : undefined, children };
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => {
    const { id, children: cleaned } = extractHeadingId(children);
    return (
      <h1 id={id} className="text-[#1d1d1f] text-[24px] font-bold mt-6 mb-3 pb-2 border-b-2 border-[#1d1d1f] scroll-mt-24">
        {withInlineMath(cleaned)}
      </h1>
    );
  },
  h2: ({ children }) => {
    const { id, children: cleaned } = extractHeadingId(children);
    return (
      <h2 id={id} className="text-[#1d1d1f] text-[18px] font-bold mt-7 mb-2.5 pb-1 border-b border-[#d2d2d7] scroll-mt-24">
        {withInlineMath(cleaned)}
      </h2>
    );
  },
  h3: ({ children }) => {
    const { id, children: cleaned } = extractHeadingId(children);
    return (
      <h3 id={id} className="text-[#1d1d1f] text-[15px] font-bold mt-5 mb-1.5 pl-2 border-l-[3px] border-blue-400 scroll-mt-24">
        {withInlineMath(cleaned)}
      </h3>
    );
  },
  h4: ({ children }) => <h4 className="text-[#1d1d1f] text-[13px] font-bold mt-3 mb-1">{withInlineMath(children)}</h4>,
  p: ({ children }) => <p className="my-2.5 leading-[1.85] break-words">{withInlineMath(children)}</p>,
  ul: ({ children, className }) => {
    const isTask = (className || "").includes("contains-task-list");
    return <ul className={isTask ? "my-2 pl-1 space-y-1.5" : "my-2.5 pl-5 space-y-1.5 list-disc"}>{children}</ul>;
  },
  ol: ({ children }) => <ol className="my-2.5 pl-5 space-y-1.5 list-decimal">{children}</ol>,
  li: ({ children, className }) => {
    const isTask = (className || "").includes("task-list-item");
    return (
      <li className={isTask ? "leading-snug flex items-start gap-2 list-none" : "leading-[1.75]"}>{withInlineMath(children)}</li>
    );
  },
  strong: ({ children }) => <strong className="font-bold text-[#0a0a0c]">{withInlineMath(children)}</strong>,
  em: ({ children }) => <em className="italic text-[#1d1d1f]">{withInlineMath(children)}</em>,
  a: ({ href, children }) => {
    const isExternal = href ? /^https?:\/\//.test(href) : false;
    return (
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="text-[#007aff] underline hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  code: ({ children }) => (
    <code className="rounded bg-[#f5f5f7] px-1 py-0.5 text-[11.5px] font-mono text-[#1d1d1f]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded p-3 text-[11px] font-mono bg-[#f5f5f7] text-[#1d1d1f] leading-relaxed">{children}</pre>
  ),
  blockquote: ({ children }) => (
    // 教科書ナラティブミックス: 冒頭ストーリーや meta info を四方枠 + 薄背景の囲み box で本論と区別する。
    <blockquote className="my-4 rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-[#1d1d1f] shadow-sm">{children}</blockquote>
  ),
  hr: () => <hr className="my-5 border-t-2 border-[#d2d2d7]" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-md ring-1 ring-[#d2d2d7]/50">
      <table className="min-w-full border-collapse text-[12px] border border-[#d2d2d7]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gradient-to-b from-[#eef1f6] to-[#e5e7ec] text-[#1d1d1f]">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-[#f7f8fb]">{children}</tr>,
  th: ({ children }) => <th className="border border-[#d2d2d7] px-2.5 py-1.5 text-left font-bold align-top">{withInlineMath(children)}</th>,
  td: ({ children }) => (
    <td className="border border-[#d2d2d7] px-2.5 py-1.5 align-top [&:first-child]:font-semibold">{withInlineMath(children)}</td>
  ),
  img: ({ src, alt }) => (
    <img src={typeof src === "string" ? src : undefined} alt={alt || ""} className="my-3 max-w-full rounded border border-[#e5e5e7]" loading="lazy" />
  ),
};

export function BzmMarkdown({ source, compact = false }: Props) {
  const segments = splitDisplayMath(source);
  return (
    <div className={compact ? "text-[12px] leading-[1.55] text-[#1d1d1f] [&_p]:!my-1 [&_ul]:!my-1 [&_ol]:!my-1 [&_li]:!leading-[1.5] [&_h1]:!my-2 [&_h2]:!my-2 [&_h3]:!my-1.5" : "text-[13.5px] text-[#1d1d1f] leading-relaxed"}>
      {segments.map((seg, i) =>
        seg.type === "math" ? (
          <div
            key={i}
            className="my-4 overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: renderKatex(seg.content, true) }}
          />
        ) : (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={mdComponents}>
            {seg.content}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}
