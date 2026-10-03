/**
 * 書斎の端末内保存（localStorage）。設計正本 §6.6。
 *
 * 読み書きはすべて try/catch。プライベートブラウズや容量超過、サーバ側の実行でも落とさず、
 * 読めなければ既定値（位置としおりは空）で画面を動かす。
 * 検査から読むので、拡張子付きの相対 import だけにする。
 */
import {
  DEFAULT_READER_SETTINGS,
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  READER_STORAGE_KEYS,
} from "./types.ts";
import type { ReaderBookmark, ReaderPosition, ReaderSettings } from "./types.ts";

function getStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = getStore()?.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    getStore()?.setItem(key, JSON.stringify(value));
  } catch {
    // 容量超過や保存禁止でも画面は止めない
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function blockIndexOrNull(value: unknown): number | null {
  const n = finiteNumber(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

/** 保存値を検証しながら既定値へ重ねる。未知の値や古い版の値は項目ごとに既定へ戻す */
export function loadReaderSettings(): ReaderSettings {
  const defaults = DEFAULT_READER_SETTINGS;
  const raw = readJson(READER_STORAGE_KEYS.settings);
  if (!isRecord(raw)) return { ...defaults };

  const fontSize = finiteNumber(raw.fontSize);
  const lineHeight = finiteNumber(raw.lineHeight);
  return {
    fontSize:
      fontSize !== null && (READER_FONT_SIZES as readonly number[]).includes(fontSize) ? fontSize : defaults.fontSize,
    lineHeight:
      lineHeight !== null && (READER_LINE_HEIGHTS as readonly number[]).includes(lineHeight)
        ? lineHeight
        : defaults.lineHeight,
    margin: raw.margin === 0 || raw.margin === 1 || raw.margin === 2 ? raw.margin : defaults.margin,
    fontFamily: raw.fontFamily === "gothic" || raw.fontFamily === "mincho" ? raw.fontFamily : defaults.fontFamily,
    theme: raw.theme === "white" || raw.theme === "sepia" || raw.theme === "black" ? raw.theme : defaults.theme,
    layout: raw.layout === "page" || raw.layout === "scroll" ? raw.layout : defaults.layout,
    spread: typeof raw.spread === "boolean" ? raw.spread : defaults.spread,
    showNotes: typeof raw.showNotes === "boolean" ? raw.showNotes : defaults.showNotes,
  };
}

/** 背景の色を Cookie にも残す名前。サーバが最初の描画の色を決めるために読む（白い光りの防止） */
export const READER_THEME_COOKIE = "amd-os.bzm-reader.theme";

/** 背景の色を Cookie へ書く。Cookie が使えない環境（サーバ側の実行、保存禁止）では何もしない */
export function writeReaderThemeCookie(theme: ReaderSettings["theme"]): void {
  try {
    if (typeof document === "undefined") return;
    document.cookie = `${READER_THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookie が書けなくても画面は止めない
  }
}

export function saveReaderSettings(s: ReaderSettings): void {
  writeJson(READER_STORAGE_KEYS.settings, s);
  writeReaderThemeCookie(s.theme);
}

export function loadReaderPosition(bookId: string): ReaderPosition | null {
  const raw = readJson(READER_STORAGE_KEYS.position(bookId));
  if (!isRecord(raw)) return null;
  const fraction = finiteNumber(raw.fraction);
  if (typeof raw.chapterSlug !== "string" || raw.chapterSlug === "" || fraction === null) return null;
  return {
    chapterSlug: raw.chapterSlug,
    fraction: clamp01(fraction),
    blockIndex: blockIndexOrNull(raw.blockIndex),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function saveReaderPosition(bookId: string, p: ReaderPosition): void {
  writeJson(READER_STORAGE_KEYS.position(bookId), p);
}

export function loadReaderBookmarks(bookId: string): ReaderBookmark[] {
  const raw = readJson(READER_STORAGE_KEYS.bookmarks(bookId));
  if (!Array.isArray(raw)) return [];
  const list: ReaderBookmark[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const fraction = finiteNumber(item.fraction);
    if (typeof item.id !== "string" || typeof item.chapterSlug !== "string" || fraction === null) continue;
    list.push({
      id: item.id,
      chapterSlug: item.chapterSlug,
      chapterTitle: typeof item.chapterTitle === "string" ? item.chapterTitle : "",
      fraction: clamp01(fraction),
      blockIndex: blockIndexOrNull(item.blockIndex),
      snippet: typeof item.snippet === "string" ? item.snippet : "",
      createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    });
  }
  return list;
}

export function saveReaderBookmarks(bookId: string, list: ReaderBookmark[]): void {
  writeJson(READER_STORAGE_KEYS.bookmarks(bookId), list);
}
