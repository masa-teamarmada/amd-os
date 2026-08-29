"use client";

/**
 * マニュアル・仕様の ```mermaid ブロックを図として描く。
 *
 * これまで mermaid ブロックはコードのまま画面に出ていて、10ファイル16個の図が
 * 誰にも図として読まれていなかった (2026-08-27 まさ依頼でフロー図を作る際に判明)。
 *
 * mermaid 本体は重いので、図が実際に画面へ出るときだけ読み込む (dynamic import)。
 * 描画に失敗したら元のコードをそのまま出す。図が出ないことより、
 * 中身が消えるほうが害が大きいため。
 */

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  code: string;
  tone?: "light" | "hud";
};

export function MermaidDiagram({ code, tone = "light" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const rawId = useId();
  const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: tone === "hud" ? "dark" : "neutral",
          fontFamily: "inherit",
        });
        const { svg } = await mermaid.render(renderId, code);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;

        // mermaid は svg を width:100% で出すため、画面が狭いと図全体が縮んで字が読めなくなる。
        // 実寸を保って、狭い画面では横スクロールで読ませる。
        const rendered = containerRef.current.querySelector("svg");
        const viewBox = rendered?.getAttribute("viewBox");
        const naturalWidth = viewBox ? Number(viewBox.split(/\s+/)[2]) : NaN;
        if (rendered && Number.isFinite(naturalWidth) && naturalWidth > 0) {
          rendered.setAttribute("width", `${Math.round(naturalWidth)}`);
          rendered.style.maxWidth = "none";
          rendered.style.minWidth = `${Math.round(naturalWidth)}px`;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, renderId, tone]);

  if (failed) {
    return (
      <pre
        className={`my-2 overflow-x-auto rounded p-3 text-[11px] font-mono ${
          tone === "hud" ? "bg-slate-900/70 text-cyan-50" : "bg-[#f5f5f7] text-[#1d1d1f]"
        }`}
      >
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="mermaid-diagram"
      className={`my-3 overflow-x-auto rounded-lg border p-3 ${
        tone === "hud" ? "border-cyan-300/30 bg-slate-900/40" : "border-[#d2d2d7] bg-white"
      } [&_svg]:mx-auto [&_svg]:h-auto`}
    />
  );
}
