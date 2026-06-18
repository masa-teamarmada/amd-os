"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LinkedMemberText } from "@/components/members/LinkedMemberText";

interface Props {
  source: string;
  tone?: "light" | "hud";
  linkMode?: "default" | "manual";
  memberLinks?: boolean;
}

/**
 * MarkdownView — dialogue narrative や MTGサマリで使う Markdown renderer。
 *
 * まさ #5-2nd (2026-05-24) 指示でメリハリ強化:
 *  - 見出しに絵文字 + 色アクセント + 下線
 *  - `<strong>` は太字 + 微妙な背景強調
 *  - `<em>` は斜体ではなく **黄色マーカー** に転用 (= まさが「マーカー引いて」と言った要件)
 *  - `<blockquote>` は左ボーダー色 + 微妙な背景で callout 風に
 *  - `<table>` は header に色背景、列幅自動、最初の列を太字風に
 *  - GFM の TODO checkbox (`- [ ]` / `- [x]`) に対応 (= remark-gfm が `<input type="checkbox">` を生成)
 *  - `<hr>` は太め + 色付き
 *  - 将来 `<img>` (図・写真) も挿入予定。img はそのまま max-w-full で出す
 */
export function MarkdownView({ source, tone = "light", linkMode = "default", memberLinks = false }: Props) {
  const isHud = tone === "hud";
  const segments = splitDisplayMath(source);
  const baseText = isHud ? "text-[12px] text-cyan-50/90" : "text-[13px] text-[#1d1d1f]";
  const codeClass = isHud
    ? "rounded bg-cyan-300/10 px-1 py-0.5 text-[11px] font-mono text-cyan-100"
    : "rounded bg-[#f5f5f7] px-1 py-0.5 text-[11.5px] font-mono text-[#1d1d1f]";
  const linkClass = isHud ? "text-cyan-300 underline hover:text-cyan-100" : "text-[#007aff] underline hover:opacity-80";
  const tableBorder = isHud ? "border-cyan-300/30" : "border-[#d2d2d7]";
  const tableHeaderBg = isHud ? "bg-cyan-300/15 text-cyan-100" : "bg-gradient-to-b from-[#eef1f6] to-[#e5e7ec] text-[#1d1d1f]";
  const tableRowAlt = isHud ? "even:bg-slate-900/30" : "even:bg-[#f7f8fb]";
  const memberLinkClass = isHud
    ? "font-medium text-cyan-300 underline-offset-2 hover:text-cyan-100 hover:underline"
    : "font-medium text-[#007aff] underline-offset-2 hover:underline";
  const renderChildren = (children: ReactNode) => (
    <MemberLinkedChildren enabled={memberLinks} linkClassName={memberLinkClass}>
      {children}
    </MemberLinkedChildren>
  );

  return (
    <div className={`${baseText} leading-relaxed`}>
      {segments.map((segment, index) =>
        segment.type === "math" ? (
          <div
            key={`math-${index}`}
            className={`my-4 overflow-x-auto text-center ${isHud ? "text-cyan-50" : "text-[#1d1d1f]"}`}
            dangerouslySetInnerHTML={{ __html: renderKatex(segment.content) }}
          />
        ) : (
          <ReactMarkdown
            key={`md-${index}`}
            remarkPlugins={[remarkGfm]}
            components={{
          // ===== Headings: 絵文字付き / 色アクセント / 下線 =====
          h1: ({ children }) => (
            <h1 className={isHud
              ? "text-cyan-100 text-[20px] font-bold mt-5 mb-2.5 pb-1.5 border-b-2 border-cyan-300/40"
              : "text-[#1d1d1f] text-[20px] font-bold mt-5 mb-2.5 pb-1.5 border-b-2 border-[#1d1d1f]"}>
              {renderChildren(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={isHud
              ? "text-cyan-100 text-[16px] font-bold mt-6 mb-2 pb-1 border-b-2 border-cyan-300/40 flex items-baseline gap-1"
              : "text-[#1d1d1f] text-[16.5px] font-bold mt-6 mb-2 pb-1 border-b-2 border-[#1d1d1f] flex items-baseline gap-1"}>
              {renderChildren(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={isHud
              ? "text-cyan-200 text-[14px] font-bold mt-4 mb-1.5 pl-2 border-l-[3px] border-cyan-300"
              : "text-[#1d1d1f] text-[14px] font-bold mt-4 mb-1.5 pl-2 border-l-[3px] border-blue-400"}>
              {renderChildren(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className={isHud ? "text-cyan-100 text-[12.5px] font-bold mt-3 mb-1" : "text-[#1d1d1f] text-[12.5px] font-bold mt-3 mb-1"}>
              {renderChildren(children)}
            </h4>
          ),

          // ===== Paragraphs =====
          p: ({ children }) => (
            <p className="my-2 leading-[1.75] whitespace-pre-wrap break-words">{renderChildren(children)}</p>
          ),

          // ===== Lists (GFM TODO checkbox 含む) =====
          ul: ({ children, className }) => {
            // remark-gfm の task-list は <ul class="contains-task-list"> を付ける
            const isTask = (className || "").includes("contains-task-list");
            return (
              <ul className={isTask ? "my-2 pl-1 space-y-1.5" : "my-2 pl-5 space-y-1 list-disc"}>
                {children}
              </ul>
            );
          },
          ol: ({ children }) => <ol className="my-2 pl-5 space-y-1 list-decimal">{children}</ol>,
          li: ({ children, className }) => {
            const isTask = (className || "").includes("task-list-item");
            return (
              <li className={isTask ? "leading-snug flex items-start gap-2 list-none" : "leading-snug"}>
                {renderChildren(children)}
              </li>
            );
          },
          // task list checkbox を視覚的にちゃんとした「□ / ☑」風に
          input: ({ type, checked, disabled, ...rest }) => {
            if (type === "checkbox") {
              return (
                <span className={`inline-flex shrink-0 mt-1 w-[14px] h-[14px] border-[1.5px] rounded-sm items-center justify-center text-[10px] font-bold ${
                  checked
                    ? (isHud ? "bg-cyan-400 border-cyan-400 text-slate-900" : "bg-emerald-500 border-emerald-500 text-white")
                    : (isHud ? "border-cyan-300/60" : "border-[#86868b]")
                }`}>
                  {checked ? "✓" : ""}
                </span>
              );
            }
            return <input type={type} checked={checked} disabled={disabled} {...rest} />;
          },

          // ===== Emphasis: strong = 太字 + 黒 / em = 黄色マーカー =====
          strong: ({ children }) => (
            <strong className={isHud
              ? "font-bold text-white bg-cyan-300/15 px-0.5 rounded"
              : "font-bold text-[#0a0a0c]"}>
              {renderChildren(children)}
            </strong>
          ),
          em: ({ children }) => (
            // em は斜体ではなく「黄色マーカー」に転用 — まさが「マーカー引いたり」と要件
            <em className={isHud
              ? "not-italic bg-amber-300/30 px-0.5 rounded"
              : "not-italic bg-amber-200/70 px-0.5 rounded"}>
              {renderChildren(children)}
            </em>
          ),
          del: ({ children }) => <del className="text-[#86868b] line-through">{renderChildren(children)}</del>,

          // ===== Links =====
          a: ({ href, children }) => {
            const normalizedHref = normalizeHref(href, linkMode);
            const isExternal = normalizedHref ? /^https?:\/\//.test(normalizedHref) : false;
            return (
              <a
                href={normalizedHref}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={linkClass}
              >
                {children}
              </a>
            );
          },

          // ===== Code =====
          code: ({ children }) => <code className={codeClass}>{children}</code>,
          pre: ({ children }) => (
            <pre className={`my-2 overflow-x-auto rounded p-3 text-[11px] font-mono ${isHud ? "bg-slate-900/70 text-cyan-50" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}>{children}</pre>
          ),

          // ===== Blockquote: 左ボーダー色 + 微妙な背景で callout 風 =====
          blockquote: ({ children }) => (
            <blockquote className={isHud
              ? "my-3 border-l-4 border-cyan-400/60 bg-cyan-300/5 pl-3 pr-2 py-1.5 text-cyan-50/90 rounded-r"
              : "my-3 border-l-4 border-blue-400 bg-blue-50/60 pl-3 pr-2 py-1.5 text-[#1d1d1f] rounded-r"}>
              {renderChildren(children)}
            </blockquote>
          ),

          // ===== HR =====
          hr: () => <hr className={`my-4 border-t-2 ${isHud ? "border-cyan-300/30" : "border-[#d2d2d7]"}`} />,

          // ===== Tables (GFM) =====
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-md ring-1 ring-[#d2d2d7]/50">
              <table className={`min-w-full border-collapse text-[12px] ${tableBorder} border`}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={tableHeaderBg}>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className={`${tableRowAlt}`}>{children}</tr>,
          th: ({ children }) => <th className={`border ${tableBorder} px-2.5 py-1.5 text-left font-bold align-top whitespace-nowrap`}>{renderChildren(children)}</th>,
          td: ({ children }) => <td className={`border ${tableBorder} px-2.5 py-1.5 align-top whitespace-pre-wrap [&:first-child]:font-semibold`}>{renderChildren(children)}</td>,

          // ===== Images (将来挿入予定) =====
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt || ""}
              className="my-3 max-w-full rounded border border-[#e5e5e7]"
              loading="lazy"
            />
          ),
            }}
          >
            {segment.content}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
}

function MemberLinkedChildren({
  children,
  enabled,
  linkClassName,
}: {
  children: ReactNode;
  enabled: boolean;
  linkClassName: string;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <>
      {Children.map(children, (child) => {
        if (typeof child === "string") {
          return <LinkedMemberText text={child} linkClassName={linkClassName} />;
        }
        return child;
      })}
    </>
  );
}

type MarkdownSegment = { type: "md"; content: string } | { type: "math"; content: string };

function splitDisplayMath(source: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const regex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "md", content: source.slice(lastIndex, match.index) });
    }
    segments.push({ type: "math", content: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < source.length) {
    segments.push({ type: "md", content: source.slice(lastIndex) });
  }

  return segments;
}

function renderKatex(tex: string) {
  return katex.renderToString(tex, {
    throwOnError: false,
    displayMode: true,
    output: "html",
    strict: "ignore",
  });
}

function normalizeHref(href: string | undefined, linkMode: Props["linkMode"]) {
  if (!href || linkMode !== "manual") return href;
  if (/^(https?:|mailto:|tel:|#|\/)/.test(href)) return href;

  const [pathPart, hashPart] = href.split("#");
  const hash = hashPart ? `#${hashPart}` : "";
  const cleanPath = pathPart.replace(/^\.\//, "").replace(/^\.\.\//, "");
  const fileName = cleanPath.split("/").pop() ?? cleanPath;

  if (cleanPath.startsWith("manual/") || (!cleanPath.includes("/") && fileName.endsWith(".md"))) {
    return `/manual/${fileName.replace(/\.md$/, "")}${hash}`;
  }

  if (
    cleanPath.startsWith("design/") ||
    cleanPath.startsWith("design_log/") ||
    cleanPath.startsWith("scripts/") ||
    cleanPath === "CLAUDE.md" ||
    cleanPath === "BUGS.md" ||
    cleanPath === "HANDOFF_pwa_rebuild.md"
  ) {
    return `https://github.com/masa-teamarmada/amd-os/blob/main/pwa/${cleanPath}${hash}`;
  }

  return href;
}
