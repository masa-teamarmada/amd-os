import { redirect } from "next/navigation";

/**
 * /bzm — 教科書の入口。Book A 『ディープテック起業の経営学』(巻頭 + 15章 + 巻末) が正本。
 * 2026-07-18: 入口を旧版アーカイブの序文 (preface) から Book A 巻頭へ変更
 * (まさ 2026-07-18 フィードバック: 通読の入口で旧版アーカイブの序文に当たり、
 * です・ます調のため現行 Book A の序文と取り違えた)。
 * 旧ナラティブ版は /bzm/public/00-prologue で引き続き閲覧できる。
 */
export default function BzmIndexPage() {
  redirect("/bzm/book-a-frontmatter");
}
