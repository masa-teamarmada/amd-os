import katex from "katex";
import "katex/dist/katex.min.css";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Element as HastElement, Root as HastRoot } from "hast";
import { headingAnchorId } from "@/lib/heading-anchor";
import { splitChapterHeading, splitSectionNumber } from "@/lib/bzm-reader/heading-parts";
import { MARK_FULL_RE, MARK_RE, protectMath, type MathItem } from "@/lib/bzm-reader/protect-math";
import type { ReaderLang } from "@/lib/bzm-reader/types";
import "./reader.css";

/**
 * ReaderMarkdown — 書斎（/bzm/read）の本文描画。サーバ部品（"use client" を付けない）。
 *
 * 数式は Markdown の解析に通すと `_` `*` が強調として壊れるため、解析の前に
 * 番号付きの目印へ退避し（退避の規則は `@/lib/bzm-reader/protect-math`）、描画の `code` / `pre` で KaTeX に戻す。
 * 設計正本は pwa/design/bzm_reader.md §5。
 *
 * 見出し id の平文規則（前処理側の extractReaderHeadings と一致させる）:
 *   子要素の文字列を連結し、インライン数式は原稿に書かれた形（`$...$` / `\(...\)`）へ戻し、
 *   `*` と `\`` を除き、末尾の `{#id}` を除いて trim した文字列に headingAnchorId を当てる。`{#id}` があればそれが id。
 *
 * 章と節の区切り（設計正本 §5）: h1 が「序章」「第N章」「付録」（古い形の `BZM x.y教科書 ` と ` — ` も可）で始まるときは、
 * ラベル（`.bzr-door-label`）と題（`.bzr-door-title`）に分けた章の扉（`h1.bzr-door`）にする。h2・h3 が `1.1` `A.2` `0.1.1` のような
 * 番号で始まるときは、番号を `.bzr-sec-num` に分ける。分け方は `@/lib/bzm-reader/heading-parts` の純関数。
 * 見出しの id と、目次の見出しの文字（原稿の文字そのもの）は、分けても変わらない。
 */

function renderKatex(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "html",
    strict: "ignore",
  });
}

// 本文の直下の要素にだけ通し番号（data-bzr-block）を振る。読書位置の復元に使う。
// 描画の入れ子（リストの中の段落など）には振らない。ツリーの直下を数えるので、描画1回ごとに 0 から始まる。
function rehypeBlockIndex() {
  return (tree: HastRoot) => {
    let n = 0;
    for (const child of tree.children) {
      if (child.type !== "element") continue;
      child.properties = { ...child.properties, dataBzrBlock: n };
      n += 1;
    }
  };
}

function blockAttr(props: object): { "data-bzr-block"?: number | string } {
  const v = (props as Record<string, unknown>)["data-bzr-block"];
  return typeof v === "number" || typeof v === "string" ? { "data-bzr-block": v } : {};
}

function hastText(node: { children?: unknown[]; value?: unknown }): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map((c) => hastText(c as { children?: unknown[]; value?: unknown })).join("");
}

function plainText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  if (isValidElement(children)) return plainText((children as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}

/** 表の列の数。最初の行（見出し行）のセルを数える */
const WIDE_TABLE_COLUMNS = 5;

function tableColumnCount(node: HastElement | undefined): number {
  const firstRow = (n: { children?: unknown[] } | undefined): HastElement | null => {
    for (const child of (n?.children ?? []) as Array<{ type?: string; tagName?: string; children?: unknown[] }>) {
      if (child.type !== "element") continue;
      if (child.tagName === "tr") return child as HastElement;
      const found = firstRow(child);
      if (found) return found;
    }
    return null;
  };
  const row = firstRow(node);
  if (!row) return 0;
  return row.children.filter((c) => c.type === "element" && (c.tagName === "th" || c.tagName === "td")).length;
}

/**
 * 見出しの子要素の先頭が文字列のときだけ、その文字列を切り出して残りと分ける。
 * 先頭が強調や数式の要素のときは null（分けずにそのまま描く）。
 * gap は、先頭の文字列の末尾の空白。分けた題は trim されるが、あとに数式やコードが続くとき（`式 $x$`）は
 * その空白に意味があるので、題と残りの間に戻す。
 */
function leadingText(children: ReactNode): { text: string; gap: string; rest: ReactNode[] } | null {
  const arr = Array.isArray(children) ? children : [children];
  const first = arr[0];
  if (typeof first !== "string") return null;
  const rest = Children.toArray(arr.slice(1));
  return { text: first, gap: rest.length > 0 && /\s$/.test(first) ? " " : "", rest };
}

const HEADING_ID_RE = /\s*\{#([a-zA-Z0-9_-]+)\}\s*$/;
const CAPTION_RE = /^(?:Figure|Table)\s+\d+[a-z]?\b|^[図表]\s*\d+[.．:：　 ]/;

function createComponents(maths: MathItem[]): Components {
  const restoreSource = (s: string) => s.replace(MARK_RE, (_m, n: string) => maths[Number(n)]?.source ?? "");

  const mathInline = (n: number) => (
    <span
      className="bzr-math-inline"
      // KaTeX の出力は、原稿の TeX をサーバで変換した HTML
      dangerouslySetInnerHTML={{ __html: renderKatex(maths[n]?.tex ?? "", false) }}
    />
  );

  // 見出しの id と表示用の子要素を決める。`{#id}` は末尾の文字列から外して id にする。
  const headingParts = (children: ReactNode): { id: string | undefined; children: ReactNode } => {
    const arr = Array.isArray(children) ? children : [children];
    const lastIndex = arr.length - 1;
    const last = lastIndex >= 0 ? arr[lastIndex] : undefined;
    if (typeof last === "string") {
      const m = last.match(HEADING_ID_RE);
      if (m) {
        const stripped = last.slice(0, m.index);
        const next = [...arr];
        if (stripped.length > 0) next[lastIndex] = stripped;
        else next.splice(lastIndex, 1);
        return { id: m[1], children: next.length === 1 ? next[0] : next };
      }
    }
    // 目次側の抽出は原稿の行から `*` と `\`` を除くので、こちらも同じ文字を除いて揃える（`$V^*$` の `*` も含む）
    const text = restoreSource(plainText(children)).replace(/[*`]/g, "").trim();
    return { id: text ? headingAnchorId(text) : undefined, children };
  };

  const heading = (Tag: "h1" | "h2" | "h3" | "h4") => {
    const H: NonNullable<Components[typeof Tag]> = (props) => {
      const { children } = props;
      const { id, children: cleaned } = headingParts(children);
      const lead = Tag === "h1" || Tag === "h2" || Tag === "h3" ? leadingText(cleaned) : null;
      if (lead && Tag === "h1") {
        // 章の扉。ラベルと題の間の空白は、見出しの文字として読み上げに残す（ブロックの間なので見た目には出ない）
        const door = splitChapterHeading(lead.text);
        if (door) {
          return (
            <h1 id={id} className="bzr-door" {...blockAttr(props)}>
              <span className="bzr-door-label">{door.label}</span>{" "}
              <span className="bzr-door-title">
                {door.title}
                {lead.gap}
                {lead.rest}
              </span>
            </h1>
          );
        }
      }
      if (lead && (Tag === "h2" || Tag === "h3")) {
        const section = splitSectionNumber(lead.text);
        if (section) {
          return (
            <Tag id={id} {...blockAttr(props)}>
              <span className="bzr-sec-num">{section.number}</span> {section.title}
              {lead.gap}
              {lead.rest}
            </Tag>
          );
        }
      }
      return (
        <Tag id={id} {...blockAttr(props)}>
          {cleaned}
        </Tag>
      );
    };
    return H;
  };

  return {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    p: (props) => {
      const { node, children } = props;
      const kids = (node?.children ?? []).filter((c) => !(c.type === "text" && c.value.trim() === ""));
      const only = kids.length === 1 ? kids[0] : null;
      if (only && only.type === "element" && only.tagName === "img") {
        return (
          <figure className="bzr-figure" {...blockAttr(props)}>
            {children}
          </figure>
        );
      }
      const first = kids[0];
      const isCaption =
        first !== undefined &&
        first.type === "element" &&
        first.tagName === "strong" &&
        CAPTION_RE.test(hastText(first as HastElement).trim());
      return (
        <p className={isCaption ? "bzr-caption" : undefined} {...blockAttr(props)}>
          {children}
        </p>
      );
    },
    a: ({ href, title, children }) => {
      // 文献の引用番号。md 側は `[12](#ref-12 "書誌")`、論文を章に割った本では `[12](/bzm/read/<本>/references#ref-12 "書誌")`。
      // 本文には上付きの番号だけを出す
      if (href && /#ref-\d+$/.test(href)) {
        return (
          <sup className="bzr-cite">
            <a href={href} title={title ?? undefined}>
              [{children}]
            </a>
          </sup>
        );
      }
      // 文献一覧の側の目印。md 側は `[12](#refdef-12) 著者 (年) …`
      if (href && /^#refdef-\d+$/.test(href)) {
        return (
          <span id={`ref-${href.replace("#refdef-", "")}`} className="bzr-refdef">
            [{children}]
          </span>
        );
      }
      const external = href ? /^https?:\/\//.test(href) : false;
      return (
        <a href={href} title={title ?? undefined} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {children}
        </a>
      );
    },
    pre: (props) => {
      const { children } = props;
      const child = Children.toArray(children)[0];
      if (isValidElement(child)) {
        const cp = child.props as { className?: string; children?: ReactNode };
        if (typeof cp.className === "string" && cp.className.includes("language-bzr-math")) {
          const item = maths[Number(plainText(cp.children).trim())];
          return (
            <div className="bzr-hscroll bzr-math-block" {...blockAttr(props)}>
              <span
                // KaTeX の出力は、原稿の TeX をサーバで変換した HTML
                dangerouslySetInnerHTML={{ __html: renderKatex(item?.tex ?? "", true) }}
              />
            </div>
          );
        }
      }
      return <pre {...blockAttr(props)}>{children}</pre>;
    },
    code: ({ className, children }) => {
      const text = typeof children === "string" ? children : null;
      if (!className && text !== null) {
        const m = text.match(MARK_FULL_RE);
        if (m) return mathInline(Number(m[1]));
      }
      return <code className={className}>{children}</code>;
    },
    table: (props) => {
      // 列が 5 つ以上の表は表だけを横スクロールさせ、4 つ以下は本文の幅に収めて段をまたがせる
      const wide = tableColumnCount(props.node) >= WIDE_TABLE_COLUMNS;
      return (
        <div className={wide ? "bzr-hscroll bzr-table bzr-table--wide" : "bzr-table bzr-table--fit"} {...blockAttr(props)}>
          <table>{props.children}</table>
        </div>
      );
    },
    img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="eager" decoding="async" />,
  };
}

export function ReaderMarkdown({ markdown, lang }: { markdown: string; lang: ReaderLang }) {
  const { text, maths } = protectMath(markdown);
  return (
    <div className="bzr-content" lang={lang}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeBlockIndex]} components={createComponents(maths)}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
