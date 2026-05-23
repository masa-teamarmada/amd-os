"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  source: string;
  tone?: "light" | "hud";
}

export function MarkdownView({ source, tone = "light" }: Props) {
  const isHud = tone === "hud";
  const baseText = isHud ? "text-[12px] text-cyan-50/90" : "text-[13px] text-[#1d1d1f]";
  const headingClass = isHud ? "text-cyan-100 font-bold" : "text-[#1d1d1f] font-semibold";
  const codeClass = isHud
    ? "rounded bg-cyan-300/10 px-1 py-0.5 text-[11px] font-mono text-cyan-100"
    : "rounded bg-[#f5f5f7] px-1 py-0.5 text-[11px] font-mono text-[#1d1d1f]";
  const linkClass = isHud ? "text-cyan-300 underline hover:text-cyan-100" : "text-[#007aff] underline hover:opacity-80";
  const tableBorder = isHud ? "border-cyan-300/30" : "border-[#e5e5e7]";
  const tableHeaderBg = isHud ? "bg-cyan-300/10 text-cyan-100" : "bg-[#f5f5f7] text-[#1d1d1f]";
  const tableRowAlt = isHud ? "even:bg-slate-900/30" : "even:bg-[#fafafa]";

  return (
    <div className={`${baseText} leading-relaxed space-y-2`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={`${headingClass} text-[15px] mt-3 mb-1.5`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`${headingClass} text-[14px] mt-3 mb-1.5`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`${headingClass} text-[13px] mt-2.5 mb-1`}>{children}</h3>,
          h4: ({ children }) => <h4 className={`${headingClass} text-[12px] mt-2 mb-1`}>{children}</h4>,
          p: ({ children }) => <p className="my-1.5 leading-relaxed whitespace-pre-wrap break-words">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 pl-5 space-y-0.5 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 pl-5 space-y-0.5 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => <strong className={isHud ? "font-bold text-white" : "font-semibold text-[#1d1d1f]"}>{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {children}
            </a>
          ),
          code: ({ children }) => <code className={codeClass}>{children}</code>,
          pre: ({ children }) => (
            <pre className={`my-2 overflow-x-auto rounded p-3 text-[11px] font-mono ${isHud ? "bg-slate-900/70 text-cyan-50" : "bg-[#f5f5f7] text-[#1d1d1f]"}`}>{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className={`my-2 border-l-2 ${isHud ? "border-cyan-300/40 text-cyan-50/75" : "border-[#d2d2d7] text-[#3c3c43]"} pl-3`}>{children}</blockquote>
          ),
          hr: () => <hr className={`my-3 border-t ${isHud ? "border-cyan-300/20" : "border-[#e5e5e7]"}`} />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className={`min-w-full border-collapse text-[11px] ${tableBorder} border`}>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={tableHeaderBg}>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className={`${tableRowAlt}`}>{children}</tr>,
          th: ({ children }) => <th className={`border ${tableBorder} px-2 py-1.5 text-left font-bold align-top`}>{children}</th>,
          td: ({ children }) => <td className={`border ${tableBorder} px-2 py-1.5 align-top whitespace-pre-wrap`}>{children}</td>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
