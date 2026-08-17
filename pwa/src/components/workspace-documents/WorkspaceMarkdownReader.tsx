"use client";

import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => <h1 className="mt-12 border-b border-slate-300 pb-4 text-3xl font-bold tracking-tight text-slate-950 first:mt-0 sm:text-4xl">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-12 border-b border-slate-200 pb-2 text-2xl font-bold tracking-tight text-slate-950">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-9 border-l-4 border-blue-600 pl-3 text-xl font-bold text-slate-900">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-7 text-lg font-bold text-slate-900">{children}</h4>,
  p: ({ children }) => <p className="my-5 whitespace-pre-wrap break-words text-base leading-8 text-slate-800">{children}</p>,
  ul: ({ children }) => <ul className="my-5 list-disc space-y-2 pl-6 text-base leading-8 text-slate-800">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 list-decimal space-y-2 pl-6 text-base leading-8 text-slate-800">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
  em: ({ children }) => <em className="rounded-sm bg-amber-100 px-0.5 not-italic">{children}</em>,
  blockquote: ({ children }) => <blockquote className="my-7 border-l-4 border-blue-500 bg-blue-50/70 px-5 py-2 text-slate-800">{children}</blockquote>,
  hr: () => <hr className="my-10 border-slate-300" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900">{children}</code>,
  pre: ({ children }) => <pre className="my-6 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-5 text-sm leading-6 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit">{children}</pre>,
  table: ({ children }) => <div className="my-7 overflow-x-auto border-y border-slate-300"><table className="w-full min-w-[640px] border-collapse text-left text-sm leading-6">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-slate-100 text-slate-950">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-200">{children}</tbody>,
  th: ({ children }) => <th className="border-r border-slate-200 px-4 py-3 font-bold last:border-r-0">{children}</th>,
  td: ({ children }) => <td className="border-r border-slate-200 px-4 py-3 align-top text-slate-800 last:border-r-0">{children}</td>,
  img: ({ src, alt }) => (
    // Markdownは任意の外部画像URLを含められるため、固定loader前提のnext/imageではなく原文URLを安全属性付きで表示する。
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} referrerPolicy="no-referrer" className="my-8 h-auto max-w-full rounded-lg border border-slate-200" />
  ),
};

export function WorkspaceMarkdownReader({ source }: { source: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{source}</ReactMarkdown>;
}
