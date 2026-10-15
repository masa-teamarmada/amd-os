"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** ページ遷移だけを示す。元のアイコンのURL・種類・サイズを必ず戻す。 */
export function NavigationFavicon() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const finish = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return;
    const frames = Array.from({ length: 12 }, (_, index) => {
      context.clearRect(0, 0, 32, 32);
      context.lineWidth = 4;
      context.strokeStyle = "#d2d2d7";
      context.beginPath(); context.arc(16, 16, 11, 0, Math.PI * 2); context.stroke();
      context.strokeStyle = "#027FDC";
      context.lineCap = "round";
      context.beginPath(); context.arc(16, 16, 11, index * Math.PI / 6, index * Math.PI / 6 + Math.PI * 1.3); context.stroke();
      return canvas.toDataURL("image/png");
    });
    let timer: number | undefined;
    let timeout: number | undefined;
    let frame = 0;
    const saved = new Map<HTMLLinkElement, { href: string | null; type: string | null; sizes: string | null }>();
    const stop = () => {
      window.clearInterval(timer); window.clearTimeout(timeout);
      timer = undefined;
      for (const [link, attrs] of saved) {
        for (const [key, value] of Object.entries(attrs)) {
          if (value === null) link.removeAttribute(key); else link.setAttribute(key, value);
        }
      }
      saved.clear();
      delete document.documentElement.dataset.amieNavigationPending;
    };
    finish.current = stop;
    const draw = () => {
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')) {
        if (!saved.has(link)) saved.set(link, { href: link.getAttribute("href"), type: link.getAttribute("type"), sizes: link.getAttribute("sizes") });
        link.href = frames[frame % frames.length]; link.type = "image/png"; link.sizes = "32x32";
      }
      frame++;
    };
    const start = () => {
      window.clearTimeout(timeout);
      // 失敗・キャンセル・画面離脱でも回転を残さない。
      timeout = window.setTimeout(stop, 30_000);
      if (timer !== undefined) return;
      document.documentElement.dataset.amieNavigationPending = "true";
      draw(); timer = window.setInterval(draw, 80);
    };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      start();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", start);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", stop);
    return () => {
      stop();
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", start);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", stop);
    };
  }, []);

  useEffect(() => { finish.current(); }, [pathname, search]);
  return null;
}
