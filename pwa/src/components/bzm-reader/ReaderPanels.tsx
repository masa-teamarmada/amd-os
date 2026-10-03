"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  readerChapterHref,
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

function TocPanel({
  tab,
  onTabChange,
  book,
  chapterIndex,
  headings,
  bookmarks,
  onJumpHeading,
  onJumpChapterStart,
  onJumpBookmark,
  onRemoveBookmark,
}: ReaderPanelsProps) {
  const router = useRouter();
  const prefetch = useCallback(
    (slug: string) => {
      try {
        router.prefetch(readerChapterHref(book.id, slug));
      } catch {
        // 先読みの失敗は無視する
      }
    },
    [router, book.id],
  );
  // パネルを開いたとき、いまの章が見える位置へ寄せる
  const currentRef = useCallback((el: HTMLElement | null) => {
    el?.scrollIntoView({ block: "center" });
  }, []);

  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const ai = book.chapters.findIndex((c) => c.slug === a.chapterSlug);
    const bi = book.chapters.findIndex((c) => c.slug === b.chapterSlug);
    return ai - bi || a.fraction - b.fraction;
  });

  return (
    <>
      <SheetHeader className="flex-row items-center justify-between gap-2 pb-0">
        <div className="min-w-0">
          <SheetTitle lang={book.lang}>{book.title}</SheetTitle>
          <SheetDescription className="sr-only">章の一覧としおり</SheetDescription>
        </div>
        <PanelClose />
      </SheetHeader>
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
              if (index === chapterIndex) {
                return (
                  <li key={chapter.slug} aria-current="location">
                    <button
                      type="button"
                      ref={currentRef}
                      className="bzr-toc-item is-current"
                      onClick={onJumpChapterStart}
                    >
                      {chapter.title}
                    </button>
                    {headings.length > 0 ? (
                      <ul className="bzr-toc-sub">
                        {headings.map((h, i) => (
                          <li key={`${h.id}-${i}`} data-level={h.level}>
                            <button type="button" className="bzr-toc-sub-item" onClick={() => onJumpHeading(h.id)}>
                              {h.text}
                            </button>
                          </li>
                        ))}
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
              return (
                <li key={chapter.slug}>
                  <Link
                    href={readerChapterHref(book.id, chapter.slug)}
                    prefetch={false}
                    className="bzr-toc-item"
                    onPointerEnter={() => prefetch(chapter.slug)}
                    onFocus={() => prefetch(chapter.slug)}
                  >
                    {chapter.title}
                  </Link>
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

function SettingsPanel({ settings, onSettingsChange, canSpread }: ReaderPanelsProps) {
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
