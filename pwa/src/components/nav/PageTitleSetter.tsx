"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { surfaceTitleForPath } from "@/lib/surface-catalog";

// 詳細名は認可済みの本文が持つ。外枠でURLからPJ名を推測しない。
const PROJECT_TITLE_ROUTE = /^\/project\/[^/]+\/(?:cockpit|workspace)\/?$/;
const PRINT_ROUTE = /\/print(?:\/|$)/;

/** 開いているタブにだけ▶を付け、Nextの遅延metadata更新でも選択印を保つ。 */
export function PageTitleSetter({ title, pageLabel = "" }: { title?: string; pageLabel?: string } = {}) {
  const pathname = usePathname() ?? "";
  const page = surfaceTitleForPath(pathname);
  const baseTitle = title ?? (page ? `${page} - AMD OS` : "AMD OS");
  const enabled = !PRINT_ROUTE.test(pathname) && (title !== undefined || !PROJECT_TITLE_ROUTE.test(pathname));

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.dataset.amiePagePath = pathname;
    document.documentElement.dataset.amiePageLabel = pageLabel;
    window.dispatchEvent(new Event("amie-page-selection"));
    let printing = false;
    const updateTitle = () => {
      if (printing) return;
      const nextTitle = document.visibilityState === "visible" ? `▶ ${baseTitle}` : baseTitle;
      if (document.title !== nextTitle) document.title = nextTitle;
    };
    const beforePrint = () => { printing = true; };
    const afterPrint = () => { printing = false; updateTitle(); };
    updateTitle();
    document.addEventListener("visibilitychange", updateTitle);
    window.addEventListener("pageshow", updateTitle);
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    // Next.jsがroute metadataでtitle要素を差し替える場合も追従する。
    const observer = new MutationObserver(updateTitle);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateTitle);
      window.removeEventListener("pageshow", updateTitle);
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, [baseTitle, enabled, pathname, pageLabel]);
  return null;
}

export function ProjectPageTitle({ projectName, surface, pageLabel }: {
  projectName: string;
  surface: "コックピット" | "ワークスペース" | "DD";
  pageLabel: string;
}) {
  return <PageTitleSetter title={`${projectName}｜${surface}｜${pageLabel} - AMD OS`} pageLabel={pageLabel} />;
}
