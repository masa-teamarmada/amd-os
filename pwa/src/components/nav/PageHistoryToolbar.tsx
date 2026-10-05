"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

type BrowserNavigation = EventTarget & { canGoBack: boolean; canGoForward: boolean };

function browserNavigation() {
  return (window as Window & { navigation?: BrowserNavigation }).navigation;
}

function subscribe(onChange: () => void) {
  const navigation = browserNavigation();
  navigation?.addEventListener("currententrychange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener("pageshow", onChange);
  return () => {
    navigation?.removeEventListener("currententrychange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("pageshow", onChange);
  };
}

function historyAvailability() {
  const navigation = browserNavigation();
  if (navigation) return Number(navigation.canGoBack) | (Number(navigation.canGoForward) << 1);
  // 履歴位置を提供しないブラウザでは、移動はブラウザ自身に委譲する。
  // history.lengthだけでは進む先の有無を判定できないため、進むを操作可能に保つ。
  return (window.history.length > 1 ? 1 : 0) | 2;
}

const serverAvailability = () => 0;

/** ブラウザと同じ履歴を使い、元のページ・検索条件・タブへ戻る。履歴を独自に書き換えない。 */
export function PageHistoryToolbar({ leading }: { leading?: ReactNode } = {}) {
  // Navigation APIが無いブラウザでも、Next.js内のページ移動ごとに再評価する。
  usePathname();
  const availability = useSyncExternalStore(subscribe, historyAvailability, serverAvailability);
  const buttonClass = "inline-flex h-11 w-11 items-center justify-center rounded-full text-[#374151] transition-colors hover:bg-[#e8edf3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#027FDC] disabled:cursor-default disabled:text-[#aeb5bf] disabled:hover:bg-transparent sm:h-9 sm:w-9";

  return (
    <nav aria-label="閲覧履歴" data-testid="page-history-toolbar" className="flex h-[52px] shrink-0 items-center gap-1 border-b border-[#e5e7eb] bg-[#f8fafc] px-3 sm:h-11 sm:px-4 print:hidden">
      {leading}
      <button type="button" aria-label="戻る" title="前のページに戻る" disabled={!(availability & 1)} onClick={() => window.history.back()} className={buttonClass}>
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label="進む" title="次のページに進む" disabled={!(availability & 2)} onClick={() => window.history.forward()} className={buttonClass}>
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </nav>
  );
}
