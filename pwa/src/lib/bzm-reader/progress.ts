/**
 * 書斎の進み具合と残り時間（純関数）。設計正本 §6.6。
 * 検査から読むので、拡張子付きの相対 import だけにする。
 */
import { READING_CHARS_PER_MINUTE } from "./types.ts";
import type { ReaderBookInfo, ReaderLang } from "./types.ts";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * 本全体の進み具合（0〜1）。
 * =（前の章までの文字数 ＋ いまの章の文字数 × 章の中の位置）÷ 本の総文字数
 */
export function bookProgressFraction(
  book: Pick<ReaderBookInfo, "chapters" | "totalChars">,
  chapterSlug: string,
  fraction: number,
): number {
  if (!(book.totalChars > 0)) return 0;
  const index = book.chapters.findIndex((chapter) => chapter.slug === chapterSlug);
  if (index < 0) return 0;

  let before = 0;
  for (let i = 0; i < index; i += 1) before += book.chapters[i].charCount;
  const current = book.chapters[index].charCount * clamp01(fraction);
  return clamp01((before + current) / book.totalChars);
}

/** いまの章の残り時間（分、切り上げの整数）。1 分あたりの文字数は和文 500、英文 1,300 */
export function remainingMinutes(charCount: number, fraction: number, lang: ReaderLang): number {
  if (!(charCount > 0)) return 0;
  const remainingChars = charCount * (1 - clamp01(fraction));
  // 浮動小数点の端数（例 1.0000000000000002）で 1 分余計に出さない
  return Math.max(0, Math.ceil(remainingChars / READING_CHARS_PER_MINUTE[lang] - 1e-9));
}
