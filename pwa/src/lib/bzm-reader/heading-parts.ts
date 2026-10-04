/**
 * 見出しの文字を、章の扉（ラベルと題）と節の番号（番号と題）に分ける純関数。設計正本 `pwa/design/bzm_reader.md` §5。
 *
 * 描画（`ReaderMarkdown.tsx`）が、章の見出し（h1）を「第1章」の小さな色つきラベルと大きな題に、
 * 節・項の見出し（h2・h3）を番号の色分けに使う。検査（node --experimental-strip-types）から読むので、
 * `@/` と他のファイルを import しない。
 *
 * 教科書の原稿は、次の形へ書き直している途中で、新旧の形が混ざる（制作正本 BZM_3_0_TEXTBOOK_PLAN.md §2.1a）。
 * - 新: `# 第1章　産業創出価値と最上段の式`（章番号と題の間は全角の空白）、`# 序章　…`、`# 付録　…`、
 *       節 `## 1.1 題`、項 `### 1.1.1 題`
 * - 旧: `# BZM 3.0教科書 第2章 — 題`、`# BZM 3.0教科書 序 — 題`、節 `## 1. 題`、項 `### 題`（番号なし）
 * どちらの形でも分けられ、分けられない文字は null を返す（呼び出し側は、分けずにそのまま描く）。
 */

export interface ChapterHeadingParts {
  /** 章のラベル。「第1章」「序章」「序」「付録」 */
  label: string;
  /** 題。ラベルと区切りを除いた残り */
  title: string;
}

export interface SectionNumberParts {
  /** 節の番号。「1.1」「1.1.1」「A.2」「0.1.1」「1.」 */
  number: string;
  /** 題。番号と空白を除いた残り */
  title: string;
}

/** 古い形の接頭辞（`BZM 3.0教科書 `）。書名は棚の本の題と重なるので、扉には出さない */
const OLD_BOOK_PREFIX_RE = /^BZM\s*\d+(?:\.\d+)*\s*教科書\s*/;

/**
 * 章のラベル。序章、序（古い形の序）、第N章（N は算用数字・全角数字・漢数字）、付録（付録A のような英大文字つきも）。
 */
const CHAPTER_LABEL_RE = /^(序章|序|第[0-9０-９一二三四五六七八九十百]+章|付録[A-ZＡ-Ｚ]?)/;

/**
 * ラベルと題の区切り。全角・半角の空白、または前後に空白を置いてよい長いダッシュ（古い形の ` — `）。
 * 区切りが無い文字（`序論`、`第2章の補足`）は、ラベルで始まっても章の扉にしない。
 */
const SEPARATOR_RE = /^(?:\s*[—―–─]+\s*|\s+)/;

/**
 * 章の見出しを、ラベルと題に分ける。章の見出しでなければ null。
 *
 * 入力は見出しの平文（`{#id}` は外した後）。
 * - `第1章　産業創出価値と最上段の式` → `{ label: "第1章", title: "産業創出価値と最上段の式" }`
 * - `BZM 3.0教科書 第2章 — 観測状態と資金の二勘定` → `{ label: "第2章", title: "観測状態と資金の二勘定" }`
 * - `序章　このモデルは何を測るのか`、`BZM 3.0教科書 序 — このモデルは何を測るのか`、`付録　記号一覧`
 * - 題が空、ラベルで始まらない、ラベルの後に区切りが無い（`序論`）は null。
 * 題の中のダッシュ（Book A の `第5章 生存の静学 — 生存条件式…`）は、ラベルの直後の区切りだけを外し、題の中は触らない。
 */
export function splitChapterHeading(text: string): ChapterHeadingParts | null {
  const trimmed = text.replace(OLD_BOOK_PREFIX_RE, "").trim();
  const labelMatch = CHAPTER_LABEL_RE.exec(trimmed);
  if (!labelMatch) return null;
  const label = labelMatch[1];
  const rest = trimmed.slice(label.length);
  const separator = SEPARATOR_RE.exec(rest);
  if (!separator) return null;
  const title = rest.slice(separator[0].length).trim();
  if (title === "") return null;
  return { label, title };
}

/**
 * 節・項の番号。`1.1`、`1.1.1`、`0.1`、`A.2`（付録）のようにドットでつなぐもの（末尾のドットは許す）と、
 * 古い形の `1.`（章内の通し番号）。番号の直後に空白が続くものだけを番号として読む
 * （`1.5倍の根拠` や `2024年の動向`、`3D 設計` は番号ではない）。
 */
const SECTION_NUMBER_RE = /^((?:[0-9]+|[A-Z])(?:\.[0-9]+)+\.?|[0-9]+\.)\s+(\S[\s\S]*)$/;

/**
 * 節・項の見出しを、番号と題に分ける。番号で始まらなければ null。
 *
 * - `1.1 産業創出価値とは何か` → `{ number: "1.1", title: "産業創出価値とは何か" }`
 * - `1.1.1 国内で数える理由`、`0.1.1 …`、`A.2 …`、古い形の `1. スコアが答える問い`（番号は `1.`）
 * - 番号が無い見出し（古い形の項 `内側の平均`）、番号の直後に空白が無い `1.5倍の根拠`、題が空は null。
 */
export function splitSectionNumber(text: string): SectionNumberParts | null {
  const match = SECTION_NUMBER_RE.exec(text.trim());
  if (!match) return null;
  const title = match[2].trim();
  if (title === "") return null;
  return { number: match[1], title };
}
