import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ReaderLayoutMode } from "@/lib/bzm-reader/types";

/** 1段のときの段の間（px）。めくり幅 = 1画面の幅 + 段の間 */
export const READER_COLUMN_GAP = 48;
/** 見開きの段の間の下限・上限（px）と、本文の領域の幅に対する割合 */
export const SPREAD_GAP_MIN = 72;
export const SPREAD_GAP_MAX = 120;
export const SPREAD_GAP_RATIO = 0.07;
/** 左の目次の列の幅の上限（px）と、画面の幅に対する割合の上限 */
export const TOC_COLUMN_MAX_WIDTH = 280;
export const TOC_COLUMN_MAX_RATIO = 0.22;

/**
 * 段の間（px）。1段は固定、見開きは本文の領域の幅の 7% か 72px の大きいほう（上限 120px）。
 * 見開きの左右のページの間を広げ、ノドの罫線を置く余白にする。
 */
export function readerColumnGap(cols: 1 | 2, bodyWidth: number): number {
  if (cols === 1) return READER_COLUMN_GAP;
  const w = Number.isFinite(bodyWidth) ? Math.max(0, bodyWidth) : 0;
  return Math.min(SPREAD_GAP_MAX, Math.max(SPREAD_GAP_MIN, Math.round(w * SPREAD_GAP_RATIO)));
}

/** 左の目次の列の幅（px）。280px か画面の幅の 22% の小さいほう。CSS の min(280px, 22vw) と同じ値 */
export function readerTocWidth(viewportWidth: number): number {
  const w = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  return Math.min(TOC_COLUMN_MAX_WIDTH, Math.round(w * TOC_COLUMN_MAX_RATIO));
}

/**
 * 目次の見出しのうち、いまの画面の先頭ブロックに当たるもの。
 * 先頭ブロックと同じか、それより前にある最後の見出し。見出しのブロック番号が分からないもの（null）は飛ばす。
 * 先頭ブロックより前に見出しが無いときは null。
 */
export function activeHeadingId(
  headings: { id: string; block: number | null }[],
  topBlock: number | null,
): string | null {
  if (topBlock === null) return null;
  let found: string | null = null;
  let foundBlock = -1;
  for (const h of headings) {
    if (h.block === null || h.block > topBlock) continue;
    if (h.block >= foundBlock) {
      found = h.id;
      foundBlock = h.block;
    }
  }
  return found;
}

/** 画面の数え方は、ページ表示では「めくり1回 = 1画面」、スクロール表示では「ビューポートの高さ = 1画面」 */
export interface PaginationView {
  /** 0 始まりの画面番号 */
  screen: number;
  /** 総画面数 */
  count: number;
  /** 章の中での位置 0〜1（ページ表示は screen / (count - 1)、スクロール表示は scrollTop / 最大 scrollTop） */
  fraction: number;
  /** この画面の先頭にある本文ブロックの番号（data-bzr-block）。位置の保存に使う */
  blockIndex: number | null;
}

/** ビューポートの実寸（整数）。多段組みの高さと幅をこの値に固定する */
export interface PaginationMetrics {
  width: number;
  height: number;
}

/** 最初の割り付けで戻す位置の候補。先頭から順に試し、解けた最初のものを使う */
export type InitialCandidate =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "hash"; id: string }
  | { kind: "saved"; blockIndex: number | null; fraction: number };

interface Options {
  enabled: boolean;
  layout: ReaderLayoutMode;
  cols: 1 | 2;
  gap: number;
  /** 文字の大きさ・行間など、設定から決まる割り直しの鍵 */
  layoutKey: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  columnsRef: RefObject<HTMLDivElement | null>;
  /** URL と保存位置から、最初に戻す位置の候補を返す。ブラウザ専用の読み取りはここで行う */
  resolveInitial: () => InitialCandidate[];
}

interface BlockPos {
  index: number;
  el: HTMLElement;
  /** ページ表示は本文の左端からの x、スクロール表示は本文の上端からの y */
  pos: number;
  /** ページ表示: ブロックが始まる画面 */
  screen: number;
  /** ページ表示: ブロックが占める最後の画面（スクロール表示では screen と同じ） */
  endScreen: number;
}

interface Geometry {
  step: number;
  count: number;
}

/**
 * 割り直しで戻る先。
 * - ブロック番号と、そのブロックの中の差（ページ表示は先頭の画面からの画面差、スクロール表示はブロック先頭からの px 差）
 * - fraction は章の中の正確な位置
 * 表示方式か段数が変わったときは差を使わず、ブロック番号と fraction で戻す
 * （差は記録したときの段数で数えた画面数で、段数が違えば別の位置を指すため）。
 */
interface Anchor {
  blockIndex: number | null;
  fraction: number;
  delta: number;
  layout: ReaderLayoutMode;
  /** 差を記録したときの段数。ページ表示の差はこの段数で数えている */
  cols: 1 | 2;
}

/** 位置の端数で隣の画面へずれないための余裕（px） */
const EDGE_EPSILON = 4;
/** 割り付けが落ち着かなくても本文を見せる上限（ms） */
const READY_FAILSAFE_MS = 1500;
/** スクロール表示で、見出しやブロックの上に空ける余白（px） */
export const SCROLL_PAD = 8;
/**
 * スクロール表示で「上端のブロック」を決める許容（px）。
 * ブロックの先頭は上端より SCROLL_PAD 手前に置くので、その分と端数の 2px を足して判定する。
 * 戻す位置と判定の位置は、この同じ値で決める。
 */
const SCROLL_OWN_SLACK = SCROLL_PAD + 2;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function fractionOf(screen: number, count: number): number {
  return count > 1 ? clamp(screen / (count - 1), 0, 1) : 0;
}

function findById(root: HTMLElement | null, id: string): HTMLElement | null {
  if (!root || !id) return null;
  try {
    return root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  } catch {
    return null;
  }
}

/* ------------------------------ 位置の純関数 ------------------------------ */

interface ScrollPosBlock {
  index: number;
  pos: number;
}

/** スクロール表示: 上端にいるブロック（上端 + 許容以前で最後に始まったもの） */
export function scrollAnchorIndex(list: ScrollPosBlock[], scrollTop: number): number | null {
  if (list.length === 0) return null;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].pos <= scrollTop + SCROLL_OWN_SLACK) lo = mid + 1;
    else hi = mid;
  }
  return list[Math.max(0, lo - 1)].index;
}

/** スクロール表示: k 番目のブロックが「上端のブロック」と判定される scrollTop の範囲 */
function scrollOwnRange(list: ScrollPosBlock[], k: number): { lo: number; hi: number } {
  const lo = Math.max(0, list[k].pos - SCROLL_OWN_SLACK);
  const hi = k + 1 < list.length ? list[k + 1].pos - SCROLL_OWN_SLACK - 1 : Number.POSITIVE_INFINITY;
  return { lo, hi: Math.max(lo, hi) };
}

/**
 * スクロール表示: ブロックの先頭からの px 差で戻す scrollTop。
 * 戻した位置は、同じブロックが「上端のブロック」と判定される範囲に収める。
 */
export function scrollPlaceByDelta(
  list: ScrollPosBlock[],
  blockIndex: number,
  delta: number,
  maxScroll: number,
): number | null {
  const k = list.findIndex((b) => b.index === blockIndex);
  if (k < 0) return null;
  const { lo, hi } = scrollOwnRange(list, k);
  return clamp(clamp(list[k].pos + delta, lo, hi), 0, maxScroll);
}

/** スクロール表示: 保存された fraction に最も近い位置を、ブロックの範囲の中で選ぶ */
export function scrollPlaceByFraction(
  list: ScrollPosBlock[],
  blockIndex: number,
  fraction: number,
  maxScroll: number,
): number | null {
  const k = list.findIndex((b) => b.index === blockIndex);
  if (k < 0) return null;
  const { lo, hi } = scrollOwnRange(list, k);
  return clamp(clamp(clamp(fraction, 0, 1) * maxScroll, lo, hi), 0, maxScroll);
}

interface PageSpanBlock {
  index: number;
  pos: number;
  screen: number;
  endScreen: number;
}

/** ページ表示: 各ブロックが占める最後の画面を求める（次のブロックが画面の先頭から始まるなら、その手前まで） */
export function fillPageEndScreens(list: PageSpanBlock[], step: number, count: number): void {
  for (let i = 0; i < list.length; i++) {
    const next = list[i + 1];
    let end = count - 1;
    if (next) {
      const s2 = clamp(Math.floor((next.pos + EDGE_EPSILON) / step), 0, count - 1);
      const rem = next.pos + EDGE_EPSILON - s2 * step;
      end = rem < 2 * EDGE_EPSILON && s2 > 0 ? s2 - 1 : s2;
    }
    list[i].endScreen = Math.max(list[i].screen, end);
  }
}

/**
 * ページ表示: 画面ごとの「先頭として扱うブロック」。
 * その画面で最初に始まるブロック。無ければ、前から続くブロック。
 */
export function pageOwners(list: PageSpanBlock[], count: number): (number | null)[] {
  const owners: (number | null)[] = [];
  for (let s = 0; s < count; s++) {
    if (list.length === 0) {
      owners.push(null);
      continue;
    }
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].screen >= s) hi = mid;
      else lo = mid + 1;
    }
    if (lo >= list.length) owners.push(list[list.length - 1].index);
    else if (list[lo].screen === s) owners.push(list[lo].index);
    else owners.push(lo > 0 ? list[lo - 1].index : list[0].index);
  }
  return owners;
}

/** ページ表示: 差で戻す画面。ブロックが先頭として扱われる画面の範囲に収める */
export function pagePlaceByDelta(
  list: PageSpanBlock[],
  owners: (number | null)[],
  blockIndex: number,
  delta: number,
): number | null {
  const b = list.find((x) => x.index === blockIndex);
  if (!b) return null;
  const first = owners.indexOf(blockIndex);
  if (first < 0) return b.screen;
  const last = owners.lastIndexOf(blockIndex);
  return clamp(first + delta, first, last);
}

/**
 * 保存された位置（ブロック番号と fraction）から、戻す先を求める。
 * ページ表示は画面番号、スクロール表示は scrollTop。ブロックが無ければ fraction だけで決める。
 * ブロックが見つかるときは、ブロックを含む画面（スクロールなら範囲）の中で fraction に最も近い位置を選ぶ。
 */
export function savedTarget(
  mode: ReaderLayoutMode,
  list: PageSpanBlock[],
  count: number,
  maxScroll: number,
  blockIndex: number | null,
  fraction: number,
): number {
  const f = clamp(fraction, 0, 1);
  if (mode === "page") {
    const s = clamp(Math.round(f * (count - 1)), 0, count - 1);
    const b = blockIndex === null ? undefined : list.find((x) => x.index === blockIndex);
    return b ? clamp(s, b.screen, b.endScreen) : s;
  }
  const placed = blockIndex === null ? null : scrollPlaceByFraction(list, blockIndex, f, maxScroll);
  return placed ?? f * maxScroll;
}

/**
 * 読書画面のページ送り。
 *
 * ページ表示は、多段組みの本文を横へずらして1段（見開きは2段）ずつ見せる。
 * 割り直すたびに、読んでいた本文ブロックと、そのブロックの中の位置へ戻す（anchor）。
 * スクロール表示は、縦スクロールの量で位置を持つ。
 */
export function useReaderPagination(opts: Options) {
  const { enabled, layout, cols, gap, layoutKey, viewportRef, trackRef, columnsRef } = opts;

  const [metrics, setMetrics] = useState<PaginationMetrics | null>(null);
  const [view, setView] = useState<PaginationView>({ screen: 0, count: 1, fraction: 0, blockIndex: null });
  const [measured, setMeasured] = useState(false);
  const [ready, setReady] = useState(false);
  /** 割り付けのたびに増える。しおりの判定など、ブロックの位置に依存する表示の再計算用 */
  const [layoutVersion, setLayoutVersion] = useState(0);

  const viewRef = useRef<PaginationView>(view);
  const cfgRef = useRef({ layout, cols, gap });
  const geomRef = useRef<Geometry>({ step: 1, count: 1 });
  const blockPosRef = useRef<BlockPos[]>([]);
  const ownersRef = useRef<(number | null)[]>([]);
  /** 割り直しで戻る先。ユーザー操作とスクロールだけが更新し、割り直しでは動かさない */
  const anchorRef = useRef<Anchor>({ blockIndex: null, fraction: 0, delta: 0, layout: "page", cols });
  const initialDoneRef = useRef(false);
  const resolveInitialRef = useRef(opts.resolveInitial);

  useEffect(() => {
    cfgRef.current = { layout, cols, gap };
    resolveInitialRef.current = opts.resolveInitial;
  });

  const commitView = useCallback((screen: number, count: number, fraction: number, blockIndex: number | null) => {
    const prev = viewRef.current;
    if (
      prev.screen === screen &&
      prev.count === count &&
      prev.fraction === fraction &&
      prev.blockIndex === blockIndex
    ) {
      return;
    }
    const next = { screen, count, fraction, blockIndex };
    viewRef.current = next;
    setView(next);
  }, []);

  /** ページ表示: この画面の先頭として扱う本文ブロック。画面に始まるブロックが無ければ、前から続くブロック */
  const pageAnchorBlock = useCallback((screen: number): number | null => ownersRef.current[screen] ?? null, []);

  /** スクロール表示: 上端にいるブロック */
  const scrollAnchorBlock = useCallback(
    (scrollTop: number): number | null => scrollAnchorIndex(blockPosRef.current, scrollTop),
    [],
  );

  /** ページ表示の位置を anchor に記録する */
  const setPageAnchor = useCallback((screen: number, count: number) => {
    const owners = ownersRef.current;
    const blockIndex = owners[screen] ?? null;
    const first = blockIndex === null ? -1 : owners.indexOf(blockIndex);
    anchorRef.current = {
      blockIndex,
      fraction: fractionOf(screen, count),
      delta: first >= 0 ? screen - first : 0,
      layout: "page",
      cols: cfgRef.current.cols,
    };
  }, []);

  /** スクロール表示の位置を anchor に記録する */
  const setScrollAnchor = useCallback((scrollTop: number, fraction: number) => {
    const blockIndex = scrollAnchorIndex(blockPosRef.current, scrollTop);
    const hit = blockIndex === null ? undefined : blockPosRef.current.find((b) => b.index === blockIndex);
    anchorRef.current = {
      blockIndex,
      fraction,
      delta: hit ? scrollTop - hit.pos : 0,
      layout: "scroll",
      cols: cfgRef.current.cols,
    };
  }, []);

  /** 見出しなどの要素（id）が属する本文ブロックの番号。目次で、いま読んでいる見出しを決めるのに使う */
  const blockIndexOfId = useCallback(
    (id: string): number | null => {
      const el = findById(columnsRef.current, id);
      const blockEl = el?.closest<HTMLElement>("[data-bzr-block]") ?? null;
      if (!blockEl) return null;
      const n = Number(blockEl.dataset.bzrBlock);
      return Number.isFinite(n) ? n : null;
    },
    [columnsRef],
  );

  /** 要素の位置 → スクロール表示の scrollTop / ページ表示の画面番号を求める */
  const elementOffset = useCallback(
    (el: Element): { x: number; y: number } | null => {
      const vp = viewportRef.current;
      if (!vp) return null;
      const vpRect = vp.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return { x: rect.left - vpRect.left + vp.scrollLeft, y: rect.top - vpRect.top + vp.scrollTop };
    },
    [viewportRef],
  );

  const screenOfElement = useCallback(
    (el: Element): number | null => {
      const off = elementOffset(el);
      if (!off) return null;
      const { step, count } = geomRef.current;
      return clamp(Math.floor((off.x + EDGE_EPSILON) / step), 0, count - 1);
    },
    [elementOffset],
  );

  const goToScreen = useCallback(
    (index: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { step, count } = geomRef.current;
      const s = clamp(Math.round(index), 0, count - 1);
      if (cfgRef.current.layout === "page") {
        vp.scrollLeft = s * step;
        commitView(s, count, fractionOf(s, count), pageAnchorBlock(s));
        setPageAnchor(s, count);
      } else {
        const max = Math.max(0, vp.scrollHeight - vp.clientHeight);
        vp.scrollTop = count > 1 ? (s / (count - 1)) * max : 0;
      }
    },
    [viewportRef, commitView, pageAnchorBlock, setPageAnchor],
  );

  const goToFraction = useCallback(
    (fraction: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const f = clamp(fraction, 0, 1);
      if (cfgRef.current.layout === "page") {
        goToScreen(Math.round(f * (geomRef.current.count - 1)));
      } else {
        vp.scrollTop = f * Math.max(0, vp.scrollHeight - vp.clientHeight);
      }
    },
    [viewportRef, goToScreen],
  );

  const goToElement = useCallback(
    (el: Element | null): boolean => {
      const vp = viewportRef.current;
      if (!vp || !el) return false;
      if (cfgRef.current.layout === "page") {
        const s = screenOfElement(el);
        if (s === null) return false;
        goToScreen(s);
      } else {
        const off = elementOffset(el);
        if (!off) return false;
        vp.scrollTop = Math.max(0, off.y - SCROLL_PAD);
      }
      return true;
    },
    [viewportRef, screenOfElement, goToScreen, elementOffset],
  );

  const goToElementId = useCallback(
    (id: string): boolean => goToElement(findById(columnsRef.current, id)),
    [columnsRef, goToElement],
  );

  /** 保存された位置（ブロック番号と fraction）へ移る。ブロックの画面の範囲の中で fraction に最も近い位置へ寄せる */
  const goToBlock = useCallback(
    (blockIndex: number | null, fraction: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const { count } = geomRef.current;
      const mode = cfgRef.current.layout;
      const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
      const target = savedTarget(mode, blockPosRef.current, count, maxScroll, blockIndex, fraction);
      if (mode === "page") goToScreen(target);
      else vp.scrollTop = target;
    },
    [viewportRef, goToScreen],
  );

  /**
   * しおりが、いまの画面に挟まれているか。
   * しおりのブロックがいまの画面に含まれ、かつ fraction がいまの画面に最も近いとき。
   * 挟むときと外すときは、同じ条件を使う。
   */
  const bookmarkMatches = useCallback(
    (blockIndex: number | null, fraction: number): boolean => {
      const v = viewRef.current;
      const list = blockPosRef.current;
      const k = blockIndex === null ? -1 : list.findIndex((b) => b.index === blockIndex);
      if (cfgRef.current.layout === "page") {
        const target = savedTarget("page", list, v.count, 0, k >= 0 ? blockIndex : null, fraction);
        return target === v.screen;
      }
      const vp = viewportRef.current;
      if (!vp) return false;
      const ch = vp.clientHeight;
      const max = Math.max(0, vp.scrollHeight - ch);
      const near = max === 0 || Math.abs(fraction - v.fraction) * max <= ch / 2;
      if (k < 0) return near;
      const top = vp.scrollTop;
      const bottom = k + 1 < list.length ? list[k + 1].pos : vp.scrollHeight;
      return list[k].pos < top + ch && bottom > top && near;
    },
    [viewportRef],
  );

  /** 次へ。章の端で動けなかったら false（呼び出し側が次の章へ移る） */
  const next = useCallback((): boolean => {
    const vp = viewportRef.current;
    if (!vp) return false;
    if (cfgRef.current.layout === "page") {
      const { screen, count } = viewRef.current;
      if (screen >= count - 1) return false;
      goToScreen(screen + 1);
      return true;
    }
    if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 2) return false;
    vp.scrollTop += vp.clientHeight * 0.9;
    return true;
  }, [viewportRef, goToScreen]);

  const prev = useCallback((): boolean => {
    const vp = viewportRef.current;
    if (!vp) return false;
    if (cfgRef.current.layout === "page") {
      const { screen } = viewRef.current;
      if (screen <= 0) return false;
      goToScreen(screen - 1);
      return true;
    }
    if (vp.scrollTop <= 1) return false;
    vp.scrollTop -= vp.clientHeight * 0.9;
    return true;
  }, [viewportRef, goToScreen]);

  /** スクロール表示の矢印キー用の小さな移動 */
  const nudge = useCallback(
    (dy: number) => {
      const vp = viewportRef.current;
      if (vp && cfgRef.current.layout === "scroll") vp.scrollTop += dy;
    },
    [viewportRef],
  );

  const goFirst = useCallback(() => goToFraction(0), [goToFraction]);
  const goLast = useCallback(() => goToFraction(1), [goToFraction]);

  /** いまの画面の先頭にある本文ブロックと、しおりに残す冒頭 40 字 */
  const currentBlock = useCallback((): { blockIndex: number | null; snippet: string } => {
    const vp = viewportRef.current;
    const blockIndex =
      cfgRef.current.layout === "page"
        ? pageAnchorBlock(viewRef.current.screen)
        : vp
          ? scrollAnchorBlock(vp.scrollTop)
          : null;
    const hit = blockIndex === null ? undefined : blockPosRef.current.find((b) => b.index === blockIndex);
    const text = (hit?.el.textContent ?? "").replace(/\s+/g, " ").trim();
    return { blockIndex, snippet: Array.from(text).slice(0, 40).join("") };
  }, [viewportRef, pageAnchorBlock, scrollAnchorBlock]);

  /** ビューポートの実寸を state に持つ（多段組みの高さと幅を整数で固定するため） */
  useEffect(() => {
    if (!enabled) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => {
      const rect = vp.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setMetrics((prevMetrics) =>
        prevMetrics && prevMetrics.width === width && prevMetrics.height === height ? prevMetrics : { width, height },
      );
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [enabled, viewportRef]);

  /** 最初の割り付けが長引いても、本文は必ず見せる */
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setReady(true), READY_FAILSAFE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  /** 割り付け: 総画面数を数え、位置を戻す */
  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const cont = columnsRef.current;
    const track = trackRef.current;
    if (!vp || !cont) return;
    const { layout: mode, cols: nCols, gap: g } = cfgRef.current;
    const rect = vp.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);
    if (width <= 0 || height <= 0) return;

    const els = cont.querySelectorAll<HTMLElement>("[data-bzr-block]");
    const list: BlockPos[] = [];
    let count: number;
    let step = width + g;

    if (mode === "page") {
      // 多段組みの幅と高さが実寸へ反映される前は測らない（反映後にもう一度走る）
      if (Math.abs(cont.offsetWidth - width) > 1 || Math.abs(cont.offsetHeight - height) > 1) return;
      vp.scrollTop = 0;
      const columnWidth = (width - (nCols - 1) * g) / nCols;
      const totalColumns = Math.max(1, Math.round((cont.scrollWidth + g) / (columnWidth + g)));
      count = Math.max(1, Math.ceil(totalColumns / nCols));
      const originX = rect.left - vp.scrollLeft;
      const xs = Array.from(els, (el) => el.getBoundingClientRect().left - originX);
      // 幅の測定が小さく出ても、最後のブロックの位置までは画面を数える
      if (xs.length > 0) count = Math.max(count, Math.floor((xs[xs.length - 1] + EDGE_EPSILON) / step) + 1);
      // 最後の画面が段の数で割り切れなくても、画面の先頭へ寄せられるだけ横幅を確保する
      if (track) track.style.minWidth = `${count * step - g}px`;
      els.forEach((el, i) => {
        list.push({
          index: Number(el.dataset.bzrBlock),
          el,
          pos: xs[i],
          screen: clamp(Math.floor((xs[i] + EDGE_EPSILON) / step), 0, count - 1),
          endScreen: 0,
        });
      });
      fillPageEndScreens(list, step, count);
    } else {
      vp.scrollLeft = 0;
      if (track) track.style.minWidth = "";
      const ch = Math.max(1, vp.clientHeight);
      step = ch;
      count = Math.max(1, Math.ceil(vp.scrollHeight / ch));
      const originY = rect.top - vp.scrollTop;
      els.forEach((el) => {
        const y = el.getBoundingClientRect().top - originY;
        const screen = clamp(Math.floor(y / ch), 0, count - 1);
        list.push({ index: Number(el.dataset.bzrBlock), el, pos: y, screen, endScreen: screen });
      });
    }

    geomRef.current = { step, count };
    blockPosRef.current = list;
    ownersRef.current = mode === "page" ? pageOwners(list, count) : [];

    // 戻す位置を決める。ページ表示は画面番号、スクロール表示は scrollTop で持つ
    const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
    let landed = 0;
    let scrollTop = 0;

    const placeFraction = (fraction: number) => {
      if (mode === "page") landed = Math.round(clamp(fraction, 0, 1) * (count - 1));
      else scrollTop = clamp(fraction, 0, 1) * maxScroll;
    };
    const placeSaved = (blockIndex: number | null, fraction: number) => {
      const target = savedTarget(mode, list, count, maxScroll, blockIndex, fraction);
      if (mode === "page") landed = target;
      else scrollTop = target;
    };
    const placeElement = (el: HTMLElement) => {
      const off = elementOffset(el);
      if (mode === "page") {
        landed = off ? clamp(Math.floor((off.x + EDGE_EPSILON) / step), 0, count - 1) : 0;
      } else {
        scrollTop = off ? Math.max(0, off.y - SCROLL_PAD) : 0;
      }
    };

    const firstTime = !initialDoneRef.current;
    if (firstTime) {
      initialDoneRef.current = true;
      let solved = false;
      for (const c of resolveInitialRef.current()) {
        if (c.kind === "start") {
          placeFraction(0);
          solved = true;
        } else if (c.kind === "end") {
          placeFraction(1);
          solved = true;
        } else if (c.kind === "hash") {
          const el = findById(cont, c.id);
          if (el) {
            placeElement(el);
            solved = true;
          }
        } else {
          placeSaved(c.blockIndex, c.fraction);
          solved = true;
        }
        if (solved) break;
      }
      if (!solved) placeFraction(0);
    } else {
      const a = anchorRef.current;
      const hasBlock = a.blockIndex !== null && list.some((b) => b.index === a.blockIndex);
      if (!hasBlock || a.blockIndex === null) {
        placeFraction(a.fraction);
      } else if (a.layout !== mode || (mode === "page" && a.cols !== nCols)) {
        placeSaved(a.blockIndex, a.fraction);
      } else if (mode === "page") {
        landed =
          pagePlaceByDelta(list, ownersRef.current, a.blockIndex, a.delta) ??
          savedTarget(mode, list, count, maxScroll, a.blockIndex, a.fraction);
      } else {
        scrollTop =
          scrollPlaceByDelta(list, a.blockIndex, a.delta, maxScroll) ??
          savedTarget(mode, list, count, maxScroll, a.blockIndex, a.fraction);
      }
    }

    if (mode === "page") {
      landed = clamp(landed, 0, count - 1);
      vp.scrollLeft = landed * step;
      commitView(landed, count, fractionOf(landed, count), pageAnchorBlock(landed));
      if (firstTime) setPageAnchor(landed, count);
    } else {
      vp.scrollTop = clamp(scrollTop, 0, maxScroll);
      const f = maxScroll > 0 ? vp.scrollTop / maxScroll : 0;
      commitView(Math.round(f * (count - 1)), count, f, scrollAnchorBlock(vp.scrollTop));
      if (firstTime) setScrollAnchor(vp.scrollTop, f);
    }

    setMeasured(true);
    setReady(true);
    setLayoutVersion((v) => v + 1);
  }, [
    viewportRef,
    columnsRef,
    trackRef,
    commitView,
    pageAnchorBlock,
    scrollAnchorBlock,
    elementOffset,
    setPageAnchor,
    setScrollAnchor,
  ]);

  /** 割り直しの契機: 実寸・設定の変更、フォント準備、図の読み込み（成功も失敗も） */
  useEffect(() => {
    if (!enabled || !metrics) return;
    const cont = columnsRef.current;
    const vp = viewportRef.current;
    if (!cont || !vp) return;
    let raf = 0;
    let disposed = false;
    const schedule = () => {
      if (raf || disposed) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!disposed) measure();
      });
    };
    // 図は遅延読み込みにしない。最初の測定の前に図の高さが決まるようにする
    cont.querySelectorAll("img").forEach((img) => {
      if (img.loading !== "eager") img.loading = "eager";
    });
    schedule();
    cont.addEventListener("load", schedule, true);
    cont.addEventListener("error", schedule, true);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(schedule).catch(() => undefined);
    }
    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cont.removeEventListener("load", schedule, true);
      cont.removeEventListener("error", schedule, true);
    };
    // layoutKey / layout / cols / gap は measure が cfgRef 越しに読むため、割り直しの鍵として並べる
  }, [enabled, metrics, layout, cols, gap, layoutKey, measure, columnsRef, viewportRef]);

  /**
   * スクロールの追従。
   * ページ表示: 検索・フォーカス・アンカー移動などで本文が勝手にずれたら、最も近い画面へ寄せ直す。
   * スクロール表示: スクロール量から位置と anchor を更新する。
   */
  useEffect(() => {
    if (!enabled) return;
    const vp = viewportRef.current;
    if (!vp) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const { step, count } = geomRef.current;
        if (cfgRef.current.layout === "page") {
          if (vp.scrollTop !== 0) vp.scrollTop = 0;
          const s = clamp(Math.round(vp.scrollLeft / step), 0, count - 1);
          if (Math.abs(vp.scrollLeft - s * step) > 1) vp.scrollLeft = s * step;
          if (s !== viewRef.current.screen) {
            commitView(s, count, fractionOf(s, count), pageAnchorBlock(s));
            setPageAnchor(s, count);
          }
        } else {
          if (vp.scrollLeft !== 0) vp.scrollLeft = 0;
          const max = Math.max(0, vp.scrollHeight - vp.clientHeight);
          const f = max > 0 ? clamp(vp.scrollTop / max, 0, 1) : 0;
          commitView(Math.round(f * (count - 1)), count, f, scrollAnchorBlock(vp.scrollTop));
          setScrollAnchor(vp.scrollTop, f);
        }
      });
    };
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, viewportRef, commitView, pageAnchorBlock, scrollAnchorBlock, setPageAnchor, setScrollAnchor]);

  return {
    ready,
    /** 最初の割り付けが済んだか（済む前の位置は保存しない） */
    measured,
    view,
    metrics,
    /** 割り付けのたびに増える値。ブロックの位置に依存する表示の再計算の鍵 */
    layoutVersion,
    next,
    prev,
    nudge,
    goToScreen,
    goToFraction,
    goToElementId,
    goToBlock,
    blockIndexOfId,
    bookmarkMatches,
    goFirst,
    goLast,
    currentBlock,
  };
}
