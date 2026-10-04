/**
 * 書斎（/bzm/read）の共有型。
 *
 * 執筆途中の本・論文を、ページ送りで読む画面の部品どうしの受け渡しをここに固定する。
 * 設計正本は `pwa/design/bzm_reader.md`。型を変えるときは設計正本も同じ commit で直す。
 */

export type ReaderBookId =
  | "bzm30-textbook"
  | "book-a"
  | "bzm22-textbook"
  | "bzm-course"
  | "p1-paper"
  | "p1-supplement";

export type ReaderBookKind = "textbook" | "book" | "paper" | "course";

export type ReaderLang = "ja" | "en";

/** 棚に並べる本の定義（manifest）。原稿の場所と順番だけを持つ。 */
export interface ReaderBookManifest {
  id: ReaderBookId;
  title: string;
  /** 棚のカードに出す一行の説明 */
  description: string;
  kind: ReaderBookKind;
  lang: ReaderLang;
  /** カードの色。CSS の色値 */
  accent: string;
  chapters: ReaderChapterManifest[];
}

/**
 * 章の定義。
 * - `file` は `bzm/` からの相対パス（例: `book-a-ch-1.md`、`sm_v2/SM-A.md`）。
 * - `split: "h1"` は、1ファイルを `# ` 見出しごとに章へ割る（論文用）。割った章の slug は見出しから作る。
 * - `title` を書かなければ md の最初の `# ` 見出し（split 時はその見出し）を使う。
 * - `plannedTitle` は、まだファイルが無い章に出す題（未執筆の章を目次に灰色で出すため）。
 */
export interface ReaderChapterManifest {
  slug: string;
  file: string;
  title?: string;
  plannedTitle?: string;
  split?: "h1";
}

/** 読み込み後の章。存在しないファイルは exists=false で残す（目次に未執筆として出す）。 */
export interface ReaderChapterInfo {
  slug: string;
  title: string;
  exists: boolean;
  /**
   * 本文の文字数の目安。進捗と残り時間の計算に使う。数え方は `countReaderChars`。
   * 数えない: 空白と改行、見出しの `#`、表の区切り行。
   * 1 字に置き換えて数える: 図 1 枚、数式 1 件。リンクは表示文字だけで、URL は数えない。
   */
  charCount: number;
}

export interface ReaderBookInfo {
  id: ReaderBookId;
  title: string;
  description: string;
  kind: ReaderBookKind;
  lang: ReaderLang;
  accent: string;
  chapters: ReaderChapterInfo[];
  /** 書けている章の数 / 全章の数 */
  writtenCount: number;
  totalCount: number;
  /** 全章の文字数の合計 */
  totalChars: number;
}

/** 章の中の見出し（目次の第2階層）。id は描画された見出しの id 属性と一致させる */
export interface ReaderHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * 前処理済みの章。サーバで作り、描画部品へ渡す。
 * 未執筆の章（manifest にあり原稿が無い）は `chapter.exists=false`、markdown は空文字、headings と notes は空配列。
 */
export interface ReaderChapterContent {
  book: ReaderBookInfo;
  chapterIndex: number;
  chapter: ReaderChapterInfo;
  /** 描画用に前処理した Markdown（YAML・HTML コメントを除き、図と章間リンクを書き換え済み。論文の引用は文献一覧の章へのリンク） */
  markdown: string;
  headings: ReaderHeading[];
  /**
   * 本の全章の見出し（章の slug → その章の見出し）。書けている章だけが入る（未執筆の章のキーは無い）。
   * 目次で、別の章の見出しも画面遷移なしに開くため、どの章のページにも全章分を載せる（本 1 冊で数百件）。
   * 自分の章の分は `headings` と同じ。
   */
  bookHeadings: Record<string, ReaderHeading[]>;
  /** 本文から外した HTML コメント（執筆メモなど）。前後の空白を落とした中身 */
  notes: string[];
}

/** 端末ごとの読書位置（localStorage `amd-os.bzm-reader.position.<bookId>`） */
export interface ReaderPosition {
  chapterSlug: string;
  /** 章の中での位置 0〜1 */
  fraction: number;
  /** ページ先頭にあった本文ブロックの番号（data-bzr-block）。復元の第一候補 */
  blockIndex: number | null;
  updatedAt: string;
}

/** しおり（localStorage `amd-os.bzm-reader.bookmarks.<bookId>`） */
export interface ReaderBookmark {
  id: string;
  chapterSlug: string;
  chapterTitle: string;
  fraction: number;
  blockIndex: number | null;
  snippet: string;
  createdAt: string;
}

export type ReaderTheme = "white" | "sepia" | "black";
export type ReaderFontFamily = "gothic" | "mincho";
export type ReaderLayoutMode = "page" | "scroll";

/** 表示設定（localStorage `amd-os.bzm-reader.settings`。全書籍で共通） */
export interface ReaderSettings {
  /** 本文の文字の大きさ（px）。READER_FONT_SIZES のどれか */
  fontSize: number;
  /** 行間。READER_LINE_HEIGHTS のどれか */
  lineHeight: number;
  /** 左右の余白の段階 0=狭い 1=標準 2=広い */
  margin: 0 | 1 | 2;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  layout: ReaderLayoutMode;
  /** 広い画面で2ページ見開きにする（page モードのみ） */
  spread: boolean;
  /** 章末に執筆メモを出す */
  showNotes: boolean;
}

export const READER_FONT_SIZES = [14, 15, 16, 17, 18, 20, 22, 24, 27, 30] as const;
export const READER_LINE_HEIGHTS = [1.6, 1.8, 2.0, 2.2] as const;

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontSize: 17,
  lineHeight: 1.8,
  margin: 1,
  fontFamily: "gothic",
  theme: "white",
  layout: "page",
  spread: true,
  showNotes: false,
};

/** 1分あたりに読む文字数（残り時間の目安） */
export const READING_CHARS_PER_MINUTE: Record<ReaderLang, number> = {
  ja: 500,
  en: 1300,
};

export const READER_STORAGE_KEYS = {
  settings: "amd-os.bzm-reader.settings",
  position: (bookId: string) => `amd-os.bzm-reader.position.${bookId}`,
  bookmarks: (bookId: string) => `amd-os.bzm-reader.bookmarks.${bookId}`,
} as const;

/** 読書画面の URL */
export function readerChapterHref(bookId: string, chapterSlug: string, at?: "start" | "end"): string {
  const base = `/bzm/read/${encodeURIComponent(bookId)}/${encodeURIComponent(chapterSlug)}`;
  return at ? `${base}?at=${at}` : base;
}

/**
 * 章の中の見出しへの URL。読書画面は URL の `#見出しid` を拾い、その見出しのあるページから開く。
 * 先読みの対象は `#` を含まない `readerChapterHref`（Next.js の先読みの鍵は pathname と search で、`#` は含まない）。
 */
export function readerHeadingHref(bookId: string, chapterSlug: string, headingId: string): string {
  return `${readerChapterHref(bookId, chapterSlug)}#${encodeURIComponent(headingId)}`;
}

/** 原稿内の図を配る API の URL（`bzm/` からの相対パス） */
export function readerAssetHref(relPath: string): string {
  return `/api/bzm-reader/asset/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}
