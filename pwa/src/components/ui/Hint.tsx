"use client";

/**
 * Hint コンポーネント (= まさ #22 案 D 2026-05-24 確定、2026-05-25 実装着手)
 *
 * 各 UI 要素に「機能の存在 + 使い方」のヒントを付ける小さな ⓘ アイコン。
 * マウスオーバー / フォーカスで詳細ポップアップが表示される。
 *
 * 使い方:
 *   <Hint id="cockpit.strategy-signals.tsukuyomi-feedback" />
 *
 * または既存要素のラッパとして:
 *   <HintWrap id="cockpit.strategy-signals.section">
 *     <h2>経営ハイライト</h2>
 *   </HintWrap>
 *
 * 説明文は `pwa/src/lib/ui-hints/index.ts` の `UI_HINTS` 定数から引く。
 *
 * 現状は HTML `title` 属性 + 詳細パネル (= focus / hover 時に表示) のシンプル実装。
 * 将来 (= 数十個に増えたら) Radix Tooltip / @base-ui Tooltip でリッチ化検討。
 */

import { useState } from "react";
import Link from "next/link";
import { getHint, type UiHint } from "@/lib/ui-hints";

interface HintProps {
  /** ui-hints/index.ts の UI_HINTS key */
  id: string;
  /** インラインで表示する hint アイコン (= default) or ラッパ (= 子要素を包む) */
  variant?: "inline" | "wrap";
  /** ラッパ variant で子要素を渡す */
  children?: React.ReactNode;
  /** カスタム title (= UI_HINTS にない場合の fallback) */
  fallbackTitle?: string;
  /** カスタム body */
  fallbackBody?: string;
}

export function Hint({ id, variant = "inline", children, fallbackTitle, fallbackBody }: HintProps) {
  const hint = getHint(id);
  const [open, setOpen] = useState(false);
  if (!hint && !fallbackTitle) {
    // hint がない場合は要素だけ返す (= 何も表示しない)
    return variant === "wrap" ? <>{children}</> : null;
  }
  const effectiveHint: UiHint = hint ?? {
    id,
    title: fallbackTitle || "",
    body: fallbackBody || "",
  };
  if (variant === "wrap") {
    return (
      <span className="relative inline-flex items-center gap-1">
        {children}
        <HintIcon hint={effectiveHint} open={open} setOpen={setOpen} />
      </span>
    );
  }
  return <HintIcon hint={effectiveHint} open={open} setOpen={setOpen} />;
}

function HintIcon({ hint, open, setOpen }: { hint: UiHint; open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`${hint.title} の説明`}
        title={`${hint.title}\n\n${hint.body}`}
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-100 text-sky-700 text-[9px] font-bold hover:bg-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400 align-middle"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-full top-0 ml-1 z-[9999] w-64 rounded border border-sky-200 bg-white px-2 py-1.5 text-[11px] shadow-lg pointer-events-auto"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <span className="block font-semibold text-sky-900 mb-1">{hint.title}</span>
          <span className="block text-zinc-700 leading-snug whitespace-pre-wrap">{hint.body}</span>
          {hint.docHref && (
            <Link
              href={hint.docHref}
              className="block mt-1 text-[10px] text-sky-700 hover:underline"
            >
              詳細マニュアル ↗
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
