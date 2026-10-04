import { useEffect } from "react";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import type { useRouter } from "next/navigation";

/**
 * 章の先読み（ブラウザ専用）。設計正本 `pwa/design/bzm_reader.md` §6.4。
 *
 * 章のページは、管理者の判定（cookies）を読む動的なページで、`loading.js` も無い。
 * `router.prefetch(href)`（既定の auto）は、動的なページでは `loading.js` の境界までしか先読みしないため、
 * ここでは実質なにも運ばない。章を押したときの待ちを縮めるには、章のページ全体（RSC）を先に取っておく
 * 完全な先読み（`PrefetchKind.FULL`）が要る。
 *
 * 完全な先読みの持ち時間は、Next.js の `staleTimes.static`（既定 5 分。`next.config.ts` に上書きは無い）。
 * 同梱文書 `01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md` に
 * 「`static` は、`router.prefetch` を呼んだとき、`Link` の `prefetch` が true のときに使う」とある。
 * 5 分以内に章へ移れば、サーバへ往復せずに、取っておいた章がそのまま使われる。
 * 5 分を過ぎた分は古い扱いになり、移るときに取り直す。通読の途中で切れた分は、ReaderView が
 * 章の終わり近く（始まり近く）で取り直す。
 *
 * 先読みの鍵は pathname と search で、`#`（見出しの飛び先）は含まない。
 * 前後の章へめくって移るときの URL は `?at=start` / `?at=end` つきなので、先読みする URL もそれに合わせる。
 */

type Router = Pick<ReturnType<typeof useRouter>, "prefetch">;

/** ポインタが乗ってから先読みを始めるまで。目次を上から下へなぞるだけで、全章を取りに行かないための間 */
export const HOVER_INTENT_MS = 80;
/** フォーカスが来てから先読みを始めるまで（Tab で目次を素通りしたときに、全章を取りに行かないため） */
export const FOCUS_INTENT_MS = 120;
/** ブラウザが空くのを待つ上限（ms）。空きが来なくても、この時間で先読みを始める */
const IDLE_TIMEOUT_MS = 4000;
/** `requestIdleCallback` が無いブラウザ（Safari）で、先読みを始めるまで待つ時間（ms） */
const IDLE_FALLBACK_MS = 1500;

/** 章のページ全体を先に取っておく。失敗しても何もしない（押したときに普通に取りに行くだけ） */
export function prefetchChapterFull(router: Router, href: string): void {
  try {
    router.prefetch(href, { kind: PrefetchKind.FULL });
  } catch {
    // 先読みの失敗は無視する
  }
}

/** 端末が通信量の節約（データセーバー）を求めているか。求めているときは、自動の先読みをしない */
export function isDataSaverOn(): boolean {
  try {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connection?.saveData === true;
  } catch {
    return false;
  }
}

/** ブラウザが空いたときに実行する。`requestIdleCallback` が無ければ 1500ms 後。戻り値は取り消し */
export function runWhenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => task(), { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, IDLE_FALLBACK_MS);
  return () => window.clearTimeout(id);
}

/**
 * 自動の先読み。`ready`（最初の割り付けが済んだ）になり、ブラウザが空いたときに `href` の章を完全に先読みする。
 * データセーバーが入っている端末では何もしない。
 * `refreshKey` が変わるたびにもう一度先読みする（呼び出し側が、章の終わり近く・始まり近くに来たことを渡す）。
 * 取ってある分がまだ新しければ、Next.js が通信せずに済ませる。
 */
export function useIdlePrefetch(router: Router, href: string | null, ready: boolean, refreshKey: boolean): void {
  useEffect(() => {
    if (!ready || !href || isDataSaverOn()) return;
    return runWhenIdle(() => prefetchChapterFull(router, href));
  }, [router, href, ready, refreshKey]);
}
