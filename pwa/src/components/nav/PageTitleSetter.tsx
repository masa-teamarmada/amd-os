"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { surfaceTitleForPath } from "@/lib/surface-catalog";

/**
 * pathname に応じて document.title を「<page> - AMD OS」形式に動的更新する。
 * 各 page.tsx に export const metadata を散らさず、layout 側で 1 箇所管理。
 */
export function PageTitleSetter() {
  const pathname = usePathname();
  useEffect(() => {
    const page = surfaceTitleForPath(pathname);
    document.title = page ? `${page} - AMD OS` : "AMD OS";
  }, [pathname]);
  return null;
}
