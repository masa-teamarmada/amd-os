"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, List, Type } from "lucide-react";
import {
  DEFAULT_READER_SETTINGS,
  READER_STORAGE_KEYS,
  readerChapterHref,
  type ReaderBookmark,
  type ReaderChapterContent,
  type ReaderSettings,
  type ReaderTheme,
} from "@/lib/bzm-reader/types";
import {
  loadReaderBookmarks,
  loadReaderPosition,
  loadReaderSettings,
  saveReaderBookmarks,
  saveReaderPosition,
  saveReaderSettings,
  writeReaderThemeCookie,
} from "@/lib/bzm-reader/storage";
import { bookProgressFraction, remainingMinutes } from "@/lib/bzm-reader/progress";
import { ReaderPanels, type ReaderPanelKind, type ReaderTocTab } from "./ReaderPanels";
import {
  READER_COLUMN_GAP,
  useReaderPagination,
  type InitialCandidate,
} from "./useReaderPagination";
import "./reader.css";
import "./reader-shell.css";

/* ---------------------------------- 定数 ---------------------------------- */

/** 余白の段階 → 左右の余白（px）。狭い画面では幅の 8% までに抑える（CSS 側） */
const MARGIN_PX = [16, 28, 48] as const;
/** 本文の1行の最大幅（文字数）。広い画面で行が伸びすぎないようにする */
const MEASURE_EM = { ja: 40, en: 36 } as const;
/** 見開きにできる画面の幅（px） */
const SPREAD_MIN_WIDTH = 1100;
const POSITION_SAVE_DELAY_MS = 300;
const SWIPE_MIN_PX = 40;
const TAP_MAX_MOVE_PX = 10;
/** ホイール・トラックパッドでめくる量（px）。この量がたまったら1回めくる */
const WHEEL_FLIP_PX = 60;
/** たまった量を捨てるまでの無操作の時間（ms） */
const WHEEL_RESET_MS = 200;
/** めくったあと、続けてめくらない時間（ms） */
const WHEEL_LOCK_MS = 400;
/** めくった後、ホイールのイベントがこの時間だけ途切れるまで次のめくりを受けない（トラックパッドの慣性の尾で何ページも進まないため） */
const WHEEL_QUIET_MS = 150;
/** 「ここが端です」の表示時間（ms） */
const NOTICE_MS = 2200;

const FONT_STACKS = {
  ja: {
    gothic:
      '"YuGothic", "Yu Gothic", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
    mincho: '"YuMincho", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif',
  },
  en: {
    gothic: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
    mincho: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  },
} as const;

/**
 * この要素の上で押したときは、ページをめくらない。
 * 横へはみ出している表（.bzr-hscroll）は、動きだけをめくりに使わない（押下は別に判定する）。
 */
const NO_FLIP_SELECTOR = 'a, button, input, select, textarea, summary, [role="slider"]';
/** ページ表示のキー操作から外す入力部品。範囲スライダーだけは、矢印キー以外をめくりに使う */
const KEY_IGNORE_SELECTOR = 'input:not([type="range"]), textarea, select, [contenteditable="true"], [role="dialog"]';

/* ------------------------- 端末の保存値（外部ストア） ------------------------- */

const EMPTY_BOOKMARKS: ReaderBookmark[] = [];

/**
 * 設定は全書籍で共通の保存値。useSyncExternalStore で読むと、
 * サーバの描画と最初のクライアント描画は同じ値（既定値。背景だけ Cookie の値）で揃い、直後に保存値へ切り替わる。
 */
const settingsStore = (() => {
  let cache: ReaderSettings | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const onStorage = (e: StorageEvent) => {
    if (e.key === READER_STORAGE_KEYS.settings) {
      cache = null;
      emit();
    }
  };
  return {
    subscribe(listener: () => void) {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    get(): ReaderSettings {
      if (!cache) cache = loadReaderSettings();
      return cache;
    },
    update(patch: Partial<ReaderSettings>) {
      const next = { ...settingsStore.get(), ...patch };
      cache = next;
      saveReaderSettings(next);
      emit();
    },
  };
})();

const bookmarkStore = (() => {
  const cache = new Map<string, ReaderBookmark[]>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get(bookId: string): ReaderBookmark[] {
      let list = cache.get(bookId);
      if (!list) {
        list = loadReaderBookmarks(bookId);
        cache.set(bookId, list);
      }
      return list;
    },
    set(bookId: string, list: ReaderBookmark[]) {
      cache.set(bookId, list);
      saveReaderBookmarks(bookId, list);
      emit();
    },
  };
})();

function subscribeNever() {
  return () => undefined;
}

/** ブラウザで描画されたあとだけ true。測定や保存値の読み取りを始める合図 */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function subscribeWide(listener: () => void) {
  const mq = window.matchMedia(`(min-width: ${SPREAD_MIN_WIDTH}px)`);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

function useWideScreen(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(`(min-width: ${SPREAD_MIN_WIDTH}px)`).matches,
    () => false,
  );
}

function newBookmarkId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/* ------------------------------- 読書画面本体 ------------------------------- */

export interface ReaderViewProps {
  content: Omit<ReaderChapterContent, "markdown">;
  /** サーバが Cookie から読んだ背景。最初の描画から正しい色で出すために使う */
  initialTheme?: ReaderTheme | null;
  /** 描画済みの本文（ReaderMarkdown） */
  children: ReactNode;
}

/**
 * 読書画面。章が変わったら作り直す（位置の復元と測定を章ごとにやり直すため）。
 */
export function ReaderView(props: ReaderViewProps) {
  const { content } = props;
  return <ReaderViewInner key={`${content.book.id}/${content.chapter.slug}`} {...props} />;
}

function ReaderViewInner({ content, initialTheme, children }: ReaderViewProps) {
  const router = useRouter();
  const { book, chapter, chapterIndex, headings, notes } = content;
  const lang = book.lang;

  const serverSettings = useMemo<ReaderSettings>(
    () => (initialTheme ? { ...DEFAULT_READER_SETTINGS, theme: initialTheme } : DEFAULT_READER_SETTINGS),
    [initialTheme],
  );
  const getServerSettings = useCallback(() => serverSettings, [serverSettings]);
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, getServerSettings);
  const bookmarks = useSyncExternalStore(
    bookmarkStore.subscribe,
    () => bookmarkStore.get(book.id),
    () => EMPTY_BOOKMARKS,
  );
  const mounted = useMounted();
  const wide = useWideScreen();

  const [bars, setBars] = useState(true);
  const [panel, setPanel] = useState<ReaderPanelKind | null>(null);
  const [tab, setTab] = useState<ReaderTocTab>("toc");
  const [notice, setNotice] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const pendingPositionRef = useRef<{
    chapterSlug: string;
    fraction: number;
    blockIndex: number | null;
    updatedAt: string;
  } | null>(null);
  const navigatingRef = useRef(false);
  const pointerRef = useRef<{ x: number; y: number; ignore: boolean; hscroll: boolean } | null>(null);
  const wheelRef = useRef({ sum: 0, last: 0, lockUntil: 0 });
  const noticeTimerRef = useRef<number | null>(null);
  const panelClosedAtRef = useRef(0);

  const cols: 1 | 2 = settings.layout === "page" && settings.spread && wide ? 2 : 1;
  const layoutKey = `${settings.fontSize}|${settings.lineHeight}|${settings.margin}|${settings.fontFamily}|${settings.showNotes}|${lang}`;

  const resolveInitial = useCallback((): InitialCandidate[] => {
    const out: InitialCandidate[] = [];
    try {
      const url = new URL(window.location.href);
      const at = url.searchParams.get("at");
      const hash = safeDecode(url.hash.replace(/^#/, ""));
      if (at === "start" || at === "end") out.push({ kind: at });
      if (hash) out.push({ kind: "hash", id: hash });
      if (at !== null || hash) {
        // 再読み込みで先頭・末尾や引用の行き先へ飛び直さないよう、at と # は使ったら外す（以後は保存位置で戻る）
        url.searchParams.delete("at");
        url.hash = "";
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
      const saved = loadReaderPosition(book.id);
      if (saved && saved.chapterSlug === chapter.slug) {
        out.push({ kind: "saved", blockIndex: saved.blockIndex, fraction: saved.fraction });
      }
    } catch {
      // URL や保存値が読めなくても、先頭から開く
    }
    out.push({ kind: "start" });
    return out;
  }, [book.id, chapter.slug]);

  const pagination = useReaderPagination({
    enabled: mounted,
    layout: settings.layout,
    cols,
    gap: READER_COLUMN_GAP,
    layoutKey,
    viewportRef,
    trackRef,
    columnsRef,
    resolveInitial,
  });
  const {
    ready,
    measured,
    view,
    metrics,
    next: pageNext,
    prev: pagePrev,
    nudge,
    goToScreen,
    goToFraction,
    goToElementId,
    goToBlock,
    bookmarkMatches,
    layoutVersion,
    goFirst,
    goLast,
    currentBlock,
  } = pagination;

  // 背景は Cookie にも残してある。保存値だけが残っている端末にも、次の読み込みから効かせる
  useEffect(() => {
    writeReaderThemeCookie(settings.theme);
  }, [settings.theme]);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    },
    [],
  );

  /* ---- 隣の書けている章 ---- */
  const nextSlug = useMemo(
    () => book.chapters.slice(chapterIndex + 1).find((c) => c.exists)?.slug ?? null,
    [book.chapters, chapterIndex],
  );
  const prevSlug = useMemo(
    () =>
      [...book.chapters.slice(0, chapterIndex)]
        .reverse()
        .find((c) => c.exists)?.slug ?? null,
    [book.chapters, chapterIndex],
  );

  // 開いたら次の章を先読みする
  useEffect(() => {
    if (!nextSlug) return;
    try {
      router.prefetch(readerChapterHref(book.id, nextSlug));
    } catch {
      // 先読みの失敗は無視する
    }
  }, [router, book.id, nextSlug]);

  const goChapter = useCallback(
    (dir: "next" | "prev") => {
      const slug = dir === "next" ? nextSlug : prevSlug;
      if (!slug || navigatingRef.current) return;
      navigatingRef.current = true;
      router.push(readerChapterHref(book.id, slug, dir === "next" ? "start" : "end"));
    },
    [router, book.id, nextSlug, prevSlug],
  );

  /** めくる。章の端なら隣の章へ移る。本の端では帯を隠さず、端であることを示す */
  const flip = useCallback(
    (dir: "next" | "prev") => {
      const moved = dir === "next" ? pageNext() : pagePrev();
      if (moved) {
        setBars(false);
        return;
      }
      const slug = dir === "next" ? nextSlug : prevSlug;
      if (slug) {
        setBars(false);
        goChapter(dir);
        return;
      }
      showNotice(dir === "next" ? "本の最後" : "本の最初");
    },
    [pageNext, pagePrev, goChapter, nextSlug, prevSlug, showNotice],
  );

  /* ---- 位置の保存（画面が変わるたび、遅らせて書く） ---- */
  useEffect(() => {
    if (!measured) return;
    pendingPositionRef.current = {
      chapterSlug: chapter.slug,
      fraction: view.fraction,
      blockIndex: view.blockIndex,
      updatedAt: new Date().toISOString(),
    };
    const timer = window.setTimeout(() => {
      const p = pendingPositionRef.current;
      if (p) saveReaderPosition(book.id, p);
      pendingPositionRef.current = null;
    }, POSITION_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [measured, book.id, chapter.slug, view.fraction, view.blockIndex, view.screen]);

  // 画面を離れる前に、書き残しがあれば書く
  useEffect(() => {
    const flush = () => {
      const p = pendingPositionRef.current;
      if (p) saveReaderPosition(book.id, p);
      pendingPositionRef.current = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [book.id]);

  /* ---- キー操作 ---- */
  const panelOpen = panel !== null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || panelOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(KEY_IGNORE_SELECTOR)) return;
      const scrollMode = settings.layout === "scroll";
      const onControl = Boolean(target?.closest("button, a, summary"));
      // ページ位置のスライダーでは、矢印キーだけをスライダーの操作として残す
      const onSlider = Boolean(target?.closest('input[type="range"]'));
      let handled = true;
      switch (e.key) {
        case "Escape":
          // パネルを閉じた直後の同じキー操作では、帯を動かさない
          if (performance.now() - panelClosedAtRef.current < 100) handled = false;
          else setBars((v) => !v);
          break;
        case "ArrowRight":
          if (scrollMode || onSlider) handled = false;
          else flip("next");
          break;
        case "ArrowLeft":
          if (scrollMode || onSlider) handled = false;
          else flip("prev");
          break;
        case "PageDown":
          flip("next");
          break;
        case "PageUp":
          flip("prev");
          break;
        case "ArrowDown":
          if (onSlider) handled = false;
          else if (scrollMode) nudge(56);
          else flip("next");
          break;
        case "ArrowUp":
          if (onSlider) handled = false;
          else if (scrollMode) nudge(-56);
          else flip("prev");
          break;
        case " ":
          // ボタンやリンクの上の Space は、そのボタンの操作として残す
          if (onControl) handled = false;
          else flip(e.shiftKey ? "prev" : "next");
          break;
        case "Home":
          goFirst();
          break;
        case "End":
          goLast();
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, settings.layout, flip, nudge, goFirst, goLast]);

  /* ---- 押す・スワイプ ---- */
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target instanceof Element ? e.target : null;
    // 実際に横へはみ出している表だけは、横の動きをめくりに使わない（タップはめくり領域として扱う）
    const scroller = target?.closest<HTMLElement>(".bzr-hscroll") ?? null;
    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      ignore: Boolean(target?.closest(NO_FLIP_SELECTOR)),
      hscroll: Boolean(scroller && scroller.scrollWidth > scroller.clientWidth + 1),
    };
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const down = pointerRef.current;
      pointerRef.current = null;
      if (!down || down.ignore || !e.isPrimary) return;
      // 文字を選択しているあいだは、めくらない
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      const page = settings.layout === "page";
      if (page && !down.hscroll && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
        flip(dx < 0 ? "next" : "prev");
        return;
      }
      if (Math.abs(dx) > TAP_MAX_MOVE_PX || Math.abs(dy) > TAP_MAX_MOVE_PX) return;
      const ratio = e.clientX / Math.max(1, window.innerWidth);
      if (page && ratio >= 0.7) flip("next");
      else if (page && ratio <= 0.3) flip("prev");
      else setBars((v) => !v);
    },
    [settings.layout, flip],
  );

  const onPointerCancel = useCallback(() => {
    pointerRef.current = null;
  }, []);

  /* ---- ホイール・トラックパッド ---- */
  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (e.ctrlKey || panelOpen) return;
      const vp = viewportRef.current;
      const target = e.target instanceof Element ? e.target : null;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (vp?.clientHeight ?? 600) : 1;
      if (settings.layout === "scroll") {
        // 本文の箱の上は、ブラウザの標準のスクロールに任せる。左右の余白の上だけ、本文の箱へ転送する
        if (!vp || (target && vp.contains(target))) return;
        vp.scrollBy({ top: e.deltaY * unit });
        return;
      }
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const scroller = target?.closest<HTMLElement>(".bzr-hscroll") ?? null;
      if (scroller) {
        if (horizontal) {
          // はみ出している表を横へ動かしているあいだは、めくらない
          if (scroller.scrollWidth > scroller.clientWidth + 1) return;
        } else if (scroller.scrollHeight > scroller.clientHeight + 1) {
          // 縦に長い表の中をまだ動かせるあいだは、表の中のスクロールに任せる。端に着いてからめくる
          const atTop = scroller.scrollTop <= 0;
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
          if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return;
        }
      }
      const delta = (horizontal ? e.deltaX : e.deltaY) * unit;
      const now = performance.now();
      const w = wheelRef.current;
      if (now < w.lockUntil) {
        // 慣性の尾が続くあいだはロックを延ばす
        w.sum = 0;
        w.last = now;
        w.lockUntil = Math.max(w.lockUntil, now + WHEEL_QUIET_MS);
        return;
      }
      if (now - w.last > WHEEL_RESET_MS) w.sum = 0;
      w.last = now;
      w.sum += delta;
      if (Math.abs(w.sum) >= WHEEL_FLIP_PX) {
        const dir = w.sum > 0 ? "next" : "prev";
        w.sum = 0;
        w.lockUntil = now + WHEEL_LOCK_MS;
        flip(dir);
      }
    },
    [panelOpen, settings.layout, flip, viewportRef],
  );

  /* ---- 本文の中のリンク ---- */
  const onContentClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Link など、子の側で処理済みのクリックは重ねて扱わない
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = e.target instanceof Element ? e.target.closest("a") : null;
      if (!anchor) return;
      // ポインタで押したリンクにフォーカスを残すと、次の Space がリンクの操作と見なされてめくれない
      if (e.detail > 0) anchor.blur();
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) {
        // 同じ章の中のリンク。ブラウザの移動に任せると、隠れたビューポートがずれる
        e.preventDefault();
        goToElementId(safeDecode(href.slice(1)));
        return;
      }
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith("/bzm/read/") && !anchor.target) {
          e.preventDefault();
          if (url.pathname === window.location.pathname) {
            // 引用番号などで、いま開いている章の中の目印へ移る
            const id = safeDecode(url.hash.replace(/^#/, ""));
            if (id) goToElementId(id);
            return;
          }
          // 別の章へは、URL の #ref-N などを行き先の章が拾って、その目印のページを開く
          router.push(`${url.pathname}${url.search}${url.hash}`);
        }
      } catch {
        // 解けないリンクはブラウザに任せる
      }
    },
    [goToElementId, router],
  );

  /* ---- 設定 ---- */
  const onSettingsChange = useCallback((patch: Partial<ReaderSettings>) => {
    settingsStore.update(patch);
  }, []);

  /* ---- しおり ---- */
  // 挟んでいる判定は、しおりのブロックがいまの画面に含まれ、fraction がいまの画面に最も近いこと。
  // 外すときも同じ条件で、いまの画面に当たるしおりをすべて外す。
  // ブロックの位置と画面が変わったら判定をやり直す。bookmarkMatches は ref を読むため、変化を鍵の文字列で渡す
  const viewKey = `${layoutVersion}|${view.screen}|${view.count}|${view.fraction}`;
  const marked = useMemo(() => {
    void viewKey;
    return bookmarks.some((b) => b.chapterSlug === chapter.slug && bookmarkMatches(b.blockIndex, b.fraction));
  }, [bookmarks, chapter.slug, bookmarkMatches, viewKey]);

  const toggleBookmark = useCallback(() => {
    if (marked) {
      const rest = bookmarks.filter(
        (b) => b.chapterSlug !== chapter.slug || !bookmarkMatches(b.blockIndex, b.fraction),
      );
      bookmarkStore.set(book.id, rest);
      return;
    }
    const { blockIndex, snippet } = currentBlock();
    const entry: ReaderBookmark = {
      id: newBookmarkId(),
      chapterSlug: chapter.slug,
      chapterTitle: chapter.title,
      fraction: view.fraction,
      blockIndex,
      snippet,
      createdAt: new Date().toISOString(),
    };
    bookmarkStore.set(book.id, [...bookmarks, entry]);
  }, [marked, bookmarks, book.id, chapter.slug, chapter.title, view.fraction, currentBlock, bookmarkMatches]);

  const removeBookmark = useCallback(
    (id: string) => {
      bookmarkStore.set(
        book.id,
        bookmarks.filter((b) => b.id !== id),
      );
    },
    [book.id, bookmarks],
  );

  const jumpBookmark = useCallback(
    (b: ReaderBookmark) => {
      setPanel(null);
      if (b.chapterSlug === chapter.slug) {
        goToBlock(b.blockIndex, b.fraction);
        setBars(false);
        return;
      }
      // 別の章は、位置を保存位置として渡してから開く
      saveReaderPosition(book.id, {
        chapterSlug: b.chapterSlug,
        fraction: b.fraction,
        blockIndex: b.blockIndex,
        updatedAt: new Date().toISOString(),
      });
      pendingPositionRef.current = null;
      router.push(readerChapterHref(book.id, b.chapterSlug));
    },
    [chapter.slug, book.id, goToBlock, router],
  );

  const jumpHeading = useCallback(
    (id: string) => {
      setPanel(null);
      setBars(false);
      goToElementId(id);
    },
    [goToElementId],
  );

  const jumpChapterStart = useCallback(() => {
    setPanel(null);
    setBars(false);
    goToFraction(0);
  }, [goToFraction]);

  const closePanel = useCallback(() => {
    panelClosedAtRef.current = performance.now();
    setPanel(null);
  }, []);
  const openPanel = useCallback((kind: ReaderPanelKind) => setPanel(kind), []);
  // 目次ボタンは、最後に開いていたタブに関わらず目次を開く
  const openToc = useCallback(() => {
    setTab("toc");
    setPanel("toc");
  }, []);

  // 帯のボタンをポインタで押したあとは、フォーカスを外す（直後のキーをボタンが取らないように）。
  // キーボードの操作（detail が 0）では、フォーカスを残す
  const blurAfterPointer = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (e.detail === 0) return;
    const control = e.target instanceof Element ? e.target.closest("button, a") : null;
    if (control instanceof HTMLElement) control.blur();
  }, []);

  /* ---- 表示 ---- */
  const measureEm = MEASURE_EM[lang];
  const vpMax = Math.round(settings.fontSize * measureEm) * cols + (cols === 2 ? READER_COLUMN_GAP : 0);
  const columnWidth = metrics ? (metrics.width - (cols - 1) * READER_COLUMN_GAP) / cols : 0;
  const stackSet = FONT_STACKS[lang];

  const rootStyle = {
    "--bzr-font-size": `${settings.fontSize}px`,
    "--bzr-line-height": String(settings.lineHeight),
    "--bzr-font-family": stackSet[settings.fontFamily],
    "--bzr-page-height": `${metrics ? metrics.height : 600}px`,
    "--bzr-page-width": `${Math.max(0, Math.round(columnWidth))}px`,
    "--bzr-cols": cols,
    "--bzr-gap": `${READER_COLUMN_GAP}px`,
    "--bzr-side": `${MARGIN_PX[settings.margin]}px`,
    "--bzr-vp-max": `${vpMax}px`,
  } as CSSProperties;

  const columnsStyle: CSSProperties | undefined =
    settings.layout === "page" && metrics ? { width: metrics.width, height: metrics.height } : undefined;

  const pageLabel = `p. ${view.screen + 1} / ${view.count}`;
  const overall = Math.round(bookProgressFraction(book, chapter.slug, view.fraction) * 100);
  const minutes = remainingMinutes(chapter.charCount, view.fraction, lang);
  const minutesLabel = minutes <= 0 ? "この章の残り 1分未満" : `この章の残り 約${minutes}分`;

  const nextChapter = nextSlug ? book.chapters.find((c) => c.slug === nextSlug) : undefined;
  const prevChapter = prevSlug ? book.chapters.find((c) => c.slug === prevSlug) : undefined;

  return (
    <div
      className="bzr-root"
      data-theme={settings.theme}
      data-layout={settings.layout}
      data-ready={ready ? "true" : undefined}
      lang={lang}
      style={rootStyle}
    >
      {/* 帯は本文より前の順に置く（Tab で本文のリンクより先に届く）。見た目の位置は CSS で決める */}
      <header
        className="bzr-bar bzr-bar-top"
        data-hidden={bars ? undefined : "true"}
        onClick={blurAfterPointer}
      >
        <Link href="/bzm/read" className="bzr-btn" aria-label="書斎へ戻る" title="書斎へ戻る">
          <ChevronLeft aria-hidden="true" />
        </Link>
        <div className="bzr-titles">
          <span className="bzr-book-title" lang={lang}>
            {book.title}
          </span>
          <span className="bzr-chapter-title" lang={lang}>
            {chapter.title}
          </span>
        </div>
        <button type="button" className="bzr-btn" aria-label="目次" title="目次" onClick={openToc}>
          <List aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bzr-btn"
          aria-label="しおり"
          title={marked ? "しおりを外す" : "このページにしおりを挟む"}
          aria-pressed={marked}
          onClick={toggleBookmark}
        >
          <Bookmark aria-hidden="true" className={marked ? "bzr-icon-filled" : undefined} />
        </button>
        <button
          type="button"
          className="bzr-btn"
          aria-label="文字の設定"
          title="文字の設定"
          onClick={() => openPanel("settings")}
        >
          <Type aria-hidden="true" />
        </button>
      </header>

      <div
        className="bzr-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
      >
        <div className="bzr-runhead" aria-hidden="true">
          <span>{chapter.title}</span>
        </div>
        <div className="bzr-viewport" ref={viewportRef}>
          <div className="bzr-track" ref={trackRef}>
            <div className="bzr-columns" ref={columnsRef} style={columnsStyle} onClick={onContentClick}>
              {children}
              {settings.showNotes && notes.length > 0 ? (
                <aside className="bzr-notes">
                  <h2 className="bzr-notes-title">執筆メモ</h2>
                  {notes.map((note, i) => (
                    <p key={i} className="bzr-note">
                      {note}
                    </p>
                  ))}
                </aside>
              ) : null}
              <nav className="bzr-endnav" aria-label="章の移動">
                {prevChapter ? <Link href={readerChapterHref(book.id, prevChapter.slug, "end")}>前の章 {prevChapter.title}</Link> : <span />}
                {nextChapter ? <Link href={readerChapterHref(book.id, nextChapter.slug, "start")}>次の章 {nextChapter.title}</Link> : <span />}
              </nav>
            </div>
          </div>
        </div>
        <div className="bzr-runfoot" aria-hidden="true">
          <span>{pageLabel}</span>
          <span>本全体 {overall}%</span>
        </div>
      </div>

      <div className="bzr-toast" role="status" aria-live="polite" data-show={notice ? "true" : undefined}>
        {notice}
      </div>

      <footer className="bzr-bar bzr-bar-bottom" data-hidden={bars ? undefined : "true"} onClick={blurAfterPointer}>
        <input
          type="range"
          className="bzr-slider"
          aria-label="ページの位置"
          aria-valuetext={pageLabel}
          min={0}
          max={Math.max(0, view.count - 1)}
          step={1}
          value={Math.min(view.screen, Math.max(0, view.count - 1))}
          disabled={view.count <= 1}
          onChange={(e) => goToScreen(Number(e.target.value))}
        />
        <div className="bzr-meta">
          <span>{pageLabel}</span>
          <span>本全体 {overall}%</span>
          <span>{minutesLabel}</span>
        </div>
      </footer>

      <ReaderPanels
        panel={panel}
        onClose={closePanel}
        tab={tab}
        onTabChange={setTab}
        book={book}
        chapterIndex={chapterIndex}
        headings={headings}
        bookmarks={bookmarks}
        onJumpHeading={jumpHeading}
        onJumpChapterStart={jumpChapterStart}
        onJumpBookmark={jumpBookmark}
        onRemoveBookmark={removeBookmark}
        settings={settings}
        onSettingsChange={onSettingsChange}
        canSpread={wide}
      />
    </div>
  );
}
