"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Plus, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FOCUS_INTENT_MS, HOVER_INTENT_MS, prefetchChapterFull } from "./chapter-prefetch";
import {
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  readerChapterHref,
  readerHeadingHref,
  type ReaderBookInfo,
  type ReaderBookmark,
  type ReaderFontFamily,
  type ReaderHeading,
  type ReaderLayoutMode,
  type ReaderSettings,
  type ReaderTheme,
} from "@/lib/bzm-reader/types";

export type ReaderPanelKind = "toc" | "settings";
export type ReaderTocTab = "toc" | "bookmarks";

export interface ReaderPanelsProps {
  panel: ReaderPanelKind | null;
  onClose: () => void;
  tab: ReaderTocTab;
  onTabChange: (tab: ReaderTocTab) => void;
  book: ReaderBookInfo;
  chapterIndex: number;
  headings: ReaderHeading[];
  /** 本の全章の見出し（章の slug → 見出し。書けている章だけ）。別の章の見出しも画面遷移なしに開く */
  bookHeadings: Record<string, ReaderHeading[]>;
  bookmarks: ReaderBookmark[];
  /** 見出しの画面へ移る（パネルも閉じる） */
  onJumpHeading: (id: string) => void;
  /** いまの章の最初へ移る（パネルも閉じる） */
  onJumpChapterStart: () => void;
  /** しおりの位置へ移る（別の章なら呼び出し側が画面遷移する） */
  onJumpBookmark: (bookmark: ReaderBookmark) => void;
  onRemoveBookmark: (id: string) => void;
  settings: ReaderSettings;
  onSettingsChange: (patch: Partial<ReaderSettings>) => void;
  /** 見開きが効く広さか。狭い画面では見開きの切替に補足を出す */
  canSpread: boolean;
  /** 左の目次の列を閉じれば見開きが効く広さか（列の分だけ本文の領域が狭くなっている） */
  spreadNeedsTocClosed?: boolean;
  /** いま読んでいるページに当たる見出しの id（目次で強調する） */
  activeHeadingId?: string | null;
  /** 別の章の題か見出しを押して、まだ届いていない章の slug。目次では、その章を「開いている章」として出す */
  openingSlug?: string | null;
  /** 別の章の題か見出しを押した（画面遷移が始まる）。呼び出し側が「開いています」の表示を出す */
  onOpenChapter?: (slug: string) => void;
}

const SHEET_WIDTH = "data-[side=left]:w-[88%] data-[side=right]:w-[88%]";

/** パネルの閉じるボタン。共通の Sheet のものは小さいため使わず、44px のボタンを見出しの行に置く */
function PanelClose() {
  return (
    <SheetClose className="bzr-icon-btn" aria-label="閉じる">
      <X aria-hidden="true" />
    </SheetClose>
  );
}

export function ReaderPanels(props: ReaderPanelsProps) {
  const { panel, onClose } = props;
  return (
    <>
      <Sheet open={panel === "toc"} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="left" className={SHEET_WIDTH} showCloseButton={false}>
          <TocPanel {...props} />
        </SheetContent>
      </Sheet>
      <Sheet open={panel === "settings"} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className={SHEET_WIDTH} showCloseButton={false}>
          <SettingsPanel {...props} />
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ------------------------------ 目次としおり ------------------------------ */

/** 目次としおりの中身（タブと本体）。横から出るパネルと、左の目次の列で同じ部品を使う */
export interface ReaderTocContentProps {
  tab: ReaderTocTab;
  onTabChange: (tab: ReaderTocTab) => void;
  book: ReaderBookInfo;
  chapterIndex: number;
  /** いまの章の見出し */
  headings: ReaderHeading[];
  /** 本の全章の見出し（章の slug → 見出し。書けている章だけ）。別の章の見出しも、画面遷移なしに開く */
  bookHeadings: Record<string, ReaderHeading[]>;
  bookmarks: ReaderBookmark[];
  onJumpHeading: (id: string) => void;
  onJumpChapterStart: () => void;
  onJumpBookmark: (bookmark: ReaderBookmark) => void;
  onRemoveBookmark: (id: string) => void;
  /** いま読んでいるページに当たる見出しの id（強調する）。無ければ強調しない */
  activeHeadingId?: string | null;
  /** 別の章の題か見出しを押して、まだ届いていない章の slug。その章を「開いている章」として出す */
  openingSlug?: string | null;
  /** 別の章の題か見出しを押した（画面遷移が始まる）。呼び出し側が「開いています」の表示を出す */
  onOpenChapter?: (slug: string) => void;
  /** panel: 開いたときにいまの章へ寄せる。column: 呼び出し側（列）が寄せる */
  variant: "panel" | "column";
}

/** 章の見出しを開閉する矢印（右端）。押せる大きさは 44px。読み上げの名前に章の題を入れる */
function TocToggle({
  title,
  open,
  controlsId,
  onToggle,
}: {
  title: string;
  open: boolean;
  controlsId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="bzr-toc-toggle"
      aria-expanded={open}
      aria-controls={open ? controlsId : undefined}
      aria-label={`「${title}」の見出しを${open ? "閉じる" : "開く"}`}
      onClick={onToggle}
    >
      <ChevronDown aria-hidden="true" />
    </button>
  );
}

export function ReaderTocContent({
  tab,
  onTabChange,
  book,
  chapterIndex,
  headings,
  bookHeadings,
  bookmarks,
  onJumpHeading,
  onJumpChapterStart,
  onJumpBookmark,
  onRemoveBookmark,
  activeHeadingId = null,
  openingSlug = null,
  onOpenChapter,
  variant,
}: ReaderTocContentProps) {
  const router = useRouter();
  const subListId = useId();
  const currentSlug = book.chapters[chapterIndex]?.slug ?? null;
  // いまの章と同じ章は「開いています」にしない（押した章がいまの章になっていれば、もう届いている）
  const opening = openingSlug !== null && openingSlug !== currentSlug ? openingSlug : null;

  // 章ごとの見出しの開閉。矢印で開閉した章だけを持ち、持っていない章は、いまの章だけが開いている。
  // 別の章を押した直後は、その章を開いて見せ、いまの章は閉じる（届いて章が替わると、画面ごと作り直されて初めに戻る）
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (slug: string): boolean => {
    if (slug === opening) return true;
    const override = toggled[slug];
    if (override !== undefined) return override;
    return opening === null && slug === currentSlug;
  };

  // 章の完全な先読み。ポインタが乗ったとき・フォーカスが来たとき・触り始めたときに始める。
  // 目次を上から下へなぞるだけで全章を取りに行かないよう、ポインタとフォーカスは少し待ち、離れたら取り消す
  const intentTimer = useRef<number | null>(null);
  const cancelIntent = useCallback(() => {
    if (intentTimer.current !== null) {
      window.clearTimeout(intentTimer.current);
      intentTimer.current = null;
    }
  }, []);
  const startIntent = useCallback(
    (slug: string, delayMs: number) => {
      cancelIntent();
      const href = readerChapterHref(book.id, slug);
      if (delayMs <= 0) {
        prefetchChapterFull(router, href);
        return;
      }
      intentTimer.current = window.setTimeout(() => {
        intentTimer.current = null;
        prefetchChapterFull(router, href);
      }, delayMs);
    },
    [router, book.id, cancelIntent],
  );
  useEffect(() => cancelIntent, [cancelIntent]);
  const intentProps = (slug: string) => ({
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) =>
      startIntent(slug, e.pointerType === "touch" ? 0 : HOVER_INTENT_MS),
    onPointerLeave: cancelIntent,
    onPointerDown: () => startIntent(slug, 0),
    onFocus: () => startIntent(slug, FOCUS_INTENT_MS),
    onBlur: cancelIntent,
  });

  // 別の章の題か見出しを押したとき、その章を「開いています」にする。新しいタブへ開く操作では、この画面は動かない
  const openClick = (slug: string) => (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onOpenChapter?.(slug);
  };

  const toggleChapter = (slug: string) => {
    const open = isOpen(slug);
    setToggled((prev) => ({ ...prev, [slug]: !open }));
    // 開いたら、次は見出しを押す。いまのうちに章を先読みしておく
    if (!open && slug !== currentSlug) startIntent(slug, 0);
  };

  // パネルを開いたとき、いまの章が見える位置へ寄せる
  const currentRef = useCallback(
    (el: HTMLElement | null) => {
      if (variant === "panel") el?.scrollIntoView({ block: "center" });
    },
    [variant],
  );

  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const ai = book.chapters.findIndex((c) => c.slug === a.chapterSlug);
    const bi = book.chapters.findIndex((c) => c.slug === b.chapterSlug);
    return ai - bi || a.fraction - b.fraction;
  });

  return (
    <>
      <div className="bzr-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "toc"}
          className="bzr-tab"
          onClick={() => onTabChange("toc")}
        >
          目次
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bookmarks"}
          className="bzr-tab"
          onClick={() => onTabChange("bookmarks")}
        >
          しおり{bookmarks.length > 0 ? `（${bookmarks.length}）` : ""}
        </button>
      </div>
      <div className="bzr-panel-body" role="tabpanel">
        {tab === "toc" ? (
          <ol className="bzr-toc">
            {book.chapters.map((chapter, index) => {
              const subId = `${subListId}-${index}`;
              if (index === chapterIndex) {
                const expanded = headings.length > 0 && isOpen(chapter.slug);
                return (
                  <li key={chapter.slug} aria-current="location">
                    <div className={cn("bzr-toc-row", opening === null && "is-current")}>
                      <button
                        type="button"
                        ref={currentRef}
                        className={cn("bzr-toc-item", opening === null && "is-current")}
                        onClick={onJumpChapterStart}
                      >
                        {chapter.title}
                      </button>
                      {headings.length > 0 ? (
                        <TocToggle
                          title={chapter.title}
                          open={expanded}
                          controlsId={subId}
                          onToggle={() => toggleChapter(chapter.slug)}
                        />
                      ) : null}
                    </div>
                    {expanded ? (
                      <ul className="bzr-toc-sub" id={subId}>
                        {headings.map((h, i) => {
                          const active = activeHeadingId !== null && h.id === activeHeadingId;
                          return (
                            <li key={`${h.id}-${i}`} data-level={h.level}>
                              <button
                                type="button"
                                className={active ? "bzr-toc-sub-item is-active" : "bzr-toc-sub-item"}
                                aria-current={active ? "true" : undefined}
                                onClick={() => onJumpHeading(h.id)}
                              >
                                {h.text}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              }
              if (!chapter.exists) {
                return (
                  <li key={chapter.slug}>
                    <span className="bzr-toc-item is-disabled" aria-disabled="true">
                      <span className="bzr-toc-title">{chapter.title}</span>
                      <span className="bzr-toc-badge">未執筆</span>
                    </span>
                  </li>
                );
              }
              const list = bookHeadings[chapter.slug] ?? [];
              const isOpening = chapter.slug === opening;
              const expanded = list.length > 0 && isOpen(chapter.slug);
              return (
                <li key={chapter.slug}>
                  <div className={cn("bzr-toc-row", isOpening && "is-opening")} {...intentProps(chapter.slug)}>
                    <Link
                      href={readerChapterHref(book.id, chapter.slug)}
                      prefetch={false}
                      className={cn("bzr-toc-item", isOpening && "is-opening")}
                      aria-busy={isOpening || undefined}
                      onClick={openClick(chapter.slug)}
                    >
                      <span className="bzr-toc-title">{chapter.title}</span>
                      {isOpening ? (
                        <span className="bzr-toc-opening" role="status">
                          開いています…
                        </span>
                      ) : null}
                    </Link>
                    {list.length > 0 ? (
                      <TocToggle
                        title={chapter.title}
                        open={expanded}
                        controlsId={subId}
                        onToggle={() => toggleChapter(chapter.slug)}
                      />
                    ) : null}
                  </div>
                  {expanded ? (
                    <ul className="bzr-toc-sub" id={subId}>
                      {list.map((h, i) => (
                        <li key={`${h.id}-${i}`} data-level={h.level}>
                          <Link
                            href={readerHeadingHref(book.id, chapter.slug, h.id)}
                            prefetch={false}
                            className="bzr-toc-sub-item"
                            onClick={openClick(chapter.slug)}
                            {...intentProps(chapter.slug)}
                          >
                            {h.text}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : sortedBookmarks.length === 0 ? (
          <p className="bzr-empty">しおりなし（上の帯のしおりで現在のページを挟む）</p>
        ) : (
          <ul className="bzr-bookmarks">
            {sortedBookmarks.map((b) => (
              <li key={b.id} className="bzr-bookmark">
                <button type="button" className="bzr-bookmark-main" onClick={() => onJumpBookmark(b)}>
                  <span className="bzr-bookmark-chapter">{b.chapterTitle}</span>
                  {b.snippet ? <span className="bzr-bookmark-snippet">{b.snippet}</span> : null}
                  <span className="bzr-bookmark-date">{formatBookmarkDate(b.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className="bzr-icon-btn"
                  aria-label="しおりを外す"
                  title="しおりを外す"
                  onClick={() => onRemoveBookmark(b.id)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function TocPanel(props: ReaderPanelsProps) {
  const { book } = props;
  return (
    <>
      <SheetHeader className="flex-row items-center justify-between gap-2 pb-0">
        <div className="min-w-0">
          <SheetTitle lang={book.lang}>{book.title}</SheetTitle>
          <SheetDescription className="sr-only">章の一覧としおり</SheetDescription>
        </div>
        <PanelClose />
      </SheetHeader>
      <ReaderTocContent
        tab={props.tab}
        onTabChange={props.onTabChange}
        book={book}
        chapterIndex={props.chapterIndex}
        headings={props.headings}
        bookHeadings={props.bookHeadings}
        bookmarks={props.bookmarks}
        onJumpHeading={props.onJumpHeading}
        onJumpChapterStart={props.onJumpChapterStart}
        onJumpBookmark={props.onJumpBookmark}
        onRemoveBookmark={props.onRemoveBookmark}
        activeHeadingId={props.activeHeadingId}
        openingSlug={props.openingSlug}
        onOpenChapter={props.onOpenChapter}
        variant="panel"
      />
    </>
  );
}

function formatBookmarkDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}に追加`;
}

/* ------------------------------- 文字の設定 ------------------------------- */

const MARGIN_OPTIONS: { value: ReaderSettings["margin"]; label: string }[] = [
  { value: 0, label: "狭い" },
  { value: 1, label: "標準" },
  { value: 2, label: "広い" },
];

const FONT_OPTIONS: { value: ReaderFontFamily; label: string }[] = [
  { value: "gothic", label: "ゴシック" },
  { value: "mincho", label: "明朝" },
];

const THEME_OPTIONS: { value: ReaderTheme; label: string }[] = [
  { value: "white", label: "白" },
  { value: "sepia", label: "セピア" },
  { value: "black", label: "黒" },
];

const LAYOUT_OPTIONS: { value: ReaderLayoutMode; label: string }[] = [
  { value: "page", label: "ページ" },
  { value: "scroll", label: "スクロール" },
];

function SettingsPanel({ settings, onSettingsChange, canSpread, spreadNeedsTocClosed }: ReaderPanelsProps) {
  const sizeIndex = Math.max(0, READER_FONT_SIZES.indexOf(settings.fontSize as (typeof READER_FONT_SIZES)[number]));
  const stepSize = (delta: number) => {
    const next = READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, Math.max(0, sizeIndex + delta))];
    onSettingsChange({ fontSize: next });
  };

  return (
    <>
      <SheetHeader className="flex-row items-center justify-between gap-2 pb-0">
        <div className="min-w-0">
          <SheetTitle>文字の設定</SheetTitle>
          <SheetDescription className="sr-only">文字の大きさ、行間、余白、書体、背景、表示の設定</SheetDescription>
        </div>
        <PanelClose />
      </SheetHeader>
      <div className="bzr-panel-body bzr-settings">
        <div className="bzr-setting">
          <div className="bzr-setting-label">文字の大きさ</div>
          <div className="bzr-stepper">
            <button
              type="button"
              className="bzr-icon-btn"
              aria-label="文字を小さく"
              disabled={sizeIndex <= 0}
              onClick={() => stepSize(-1)}
            >
              <Minus aria-hidden="true" />
            </button>
            <span className="bzr-stepper-value" aria-live="polite">
              {settings.fontSize}
            </span>
            <button
              type="button"
              className="bzr-icon-btn"
              aria-label="文字を大きく"
              disabled={sizeIndex >= READER_FONT_SIZES.length - 1}
              onClick={() => stepSize(1)}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
        </div>

        <Segmented
          label="行間"
          value={settings.lineHeight}
          options={READER_LINE_HEIGHTS.map((v) => ({ value: v as number, label: v.toFixed(1) }))}
          onChange={(lineHeight) => onSettingsChange({ lineHeight })}
        />
        <Segmented
          label="余白"
          value={settings.margin}
          options={MARGIN_OPTIONS}
          onChange={(margin) => onSettingsChange({ margin })}
        />
        <Segmented
          label="書体"
          value={settings.fontFamily}
          options={FONT_OPTIONS}
          onChange={(fontFamily) => onSettingsChange({ fontFamily })}
        />
        <Segmented
          label="背景"
          value={settings.theme}
          options={THEME_OPTIONS}
          swatch
          onChange={(theme) => onSettingsChange({ theme })}
        />
        <Segmented
          label="表示"
          value={settings.layout}
          options={LAYOUT_OPTIONS}
          onChange={(layout) => onSettingsChange({ layout })}
        />

        <Switch
          label="見開き"
          hint={
            settings.layout === "scroll"
              ? "ページ表示のときだけ有効"
              : canSpread
                ? "広い画面で2ページを並べる"
                : spreadNeedsTocClosed
                  ? "左の目次を閉じると有効"
                  : "幅が広い画面で有効"
          }
          checked={settings.spread}
          onChange={(spread) => onSettingsChange({ spread })}
        />
        <Switch
          label="執筆メモ"
          hint="章末に執筆メモを出す"
          checked={settings.showNotes}
          onChange={(showNotes) => onSettingsChange({ showNotes })}
        />
      </div>
    </>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
  swatch,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  swatch?: boolean;
}) {
  return (
    <div className="bzr-setting">
      <div className="bzr-setting-label">{label}</div>
      <div className="bzr-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className="bzr-seg-btn"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {swatch ? <span className="bzr-swatch" data-swatch={String(o.value)} aria-hidden="true" /> : null}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="bzr-setting bzr-setting-row">
      <div className="bzr-setting-text">
        <div className="bzr-setting-label">{label}</div>
        <div className="bzr-setting-hint">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn("bzr-switch")}
        onClick={() => onChange(!checked)}
      >
        <span className="bzr-switch-knob" />
      </button>
    </div>
  );
}
