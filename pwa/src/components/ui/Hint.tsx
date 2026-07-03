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

import { useCallback, useEffect, useRef, useState } from "react";
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;

    const rect = button.getBoundingClientRect();
    const pad = 12;
    const gap = 8;
    const width = Math.min(288, window.innerWidth - pad * 2);
    const height = tooltipRef.current?.offsetHeight ?? 150;

    let left = rect.right + gap;
    if (left + width > window.innerWidth - pad) {
      left = rect.left - width - gap;
    }
    if (left < pad) {
      left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, pad), window.innerWidth - width - pad);
    }

    let top = rect.top - 8;
    if (top + height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - height - pad);
    }
    if (top < pad) top = pad;

    setPosition({ left, top, width });
  }, []);

  const show = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
    requestAnimationFrame(updatePosition);
  }, [clearCloseTimer, setOpen, updatePosition]);

  const hideSoon = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  }, [clearCloseTimer, setOpen]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(updatePosition);
    const handleUpdate = () => updatePosition();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [open, updatePosition]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${hint.title} の説明`}
        aria-expanded={open}
        onClick={() => {
          clearCloseTimer();
          if (open) {
            setOpen(false);
          } else {
            setOpen(true);
            requestAnimationFrame(updatePosition);
          }
        }}
        onFocus={show}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-100 text-sky-700 text-[9px] font-bold hover:bg-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400 align-middle"
      >
        ?
      </button>
      {open && (
        <span
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-[9999] max-w-[calc(100vw-24px)] rounded-md border border-sky-200 bg-white px-3 py-2 text-[11px] shadow-lg pointer-events-auto"
          style={{
            left: position?.left ?? 12,
            top: position?.top ?? 12,
            width: position?.width ?? 288,
          }}
          onMouseEnter={show}
          onMouseLeave={hideSoon}
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
