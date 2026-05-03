"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

interface MathProps {
  tex: string;
  display?: boolean;
  className?: string;
}

export function Tex({ tex, display = false, className }: MathProps) {
  const html = katex.renderToString(tex, {
    throwOnError: false,
    displayMode: display,
    output: "html",
    strict: "ignore",
  });
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
