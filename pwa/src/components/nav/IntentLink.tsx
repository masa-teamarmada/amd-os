"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, FocusEvent, MouseEvent } from "react";

/**
 * 表示時に先読みせず、hover/focusのときだけ先読みするリンク。
 * 左メニューやホームのカードを表示時に先読みすると、開かない画面のサーバ描画が1回の表示で20〜40回走っていた（2026-10-20 Vercel CPU対策）。
 * 新しいタブで開くリンクは先読みが使われないため、hover/focusでも先読みしない。
 */
export function IntentLink({ href, target, onMouseEnter, onFocus, ...props }: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const router = useRouter();
  const destination = typeof href === "string" ? href : null;
  const warm = () => {
    if (destination && target !== "_blank") router.prefetch(destination);
  };
  return (
    <Link
      {...props}
      href={href}
      target={target}
      prefetch={false}
      onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => { warm(); onMouseEnter?.(event); }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => { warm(); onFocus?.(event); }}
    />
  );
}
