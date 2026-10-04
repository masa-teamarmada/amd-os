// 書斎（/bzm/read）の基盤の検査。設計正本は pwa/design/bzm_reader.md。
// 前処理の各規則、章の割り、見出し抽出、manifest、進み具合、端末内保存を、小さな入力と実原稿で確かめる。
// load.ts（`@/` 別名を使う）は、register_ts_aliases.mjs で別名を解く登録をしてから読み込む。
// ReaderMarkdown.tsx（JSX と css の import を含む）は、typescript で変換した写しを
// node_modules/.cache の下に作って読み込み、react-dom/server で描く。
// Run: npm run test:bzm-reader

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { BZM_PARTS } from "../src/app/(app)/bzm/bzm-chapters.ts";
import { headingAnchorId } from "../src/lib/heading-anchor.ts";
import { READER_LIBRARY } from "../src/lib/bzm-reader/library.ts";
import {
  countReaderChars,
  ensureLeadingH1,
  extractReaderHeadings,
  extractReferenceTexts,
  firstHeadingText,
  preprocessReaderMarkdown,
  rewriteReferenceCitations,
  splitByH1,
} from "../src/lib/bzm-reader/preprocess.ts";
import { protectMath } from "../src/lib/bzm-reader/protect-math.ts";
import { AMD_OS_HOST, SHOSAI_HOST, isShosaiHost, readerHostRedirect } from "../src/lib/bzm-reader/hosts.ts";
import { bookProgressFraction, remainingMinutes } from "../src/lib/bzm-reader/progress.ts";
import {
  loadReaderBookmarks,
  loadReaderPosition,
  loadReaderSettings,
  saveReaderBookmarks,
  saveReaderPosition,
  saveReaderSettings,
} from "../src/lib/bzm-reader/storage.ts";
import { DEFAULT_READER_SETTINGS, readerAssetHref, readerChapterHref } from "../src/lib/bzm-reader/types.ts";

const opts = { file: "book-a-ch-1.md", bookId: "book-a", bookChapterSlugs: ["book-a-ch-1", "book-a-ch-2"] };
const run = (source: string, over: Partial<typeof opts> = {}) => preprocessReaderMarkdown(source, { ...opts, ...over });

// 実原稿の件数の下限は、原稿の書き換えで動く。本番反映（deploy.sh）を止めないよう、警告だけにする。
// 目次と描画の id の一致、数式の目印の残り、<sup> の残りのような「壊れていない」ことの検査は assert のまま。
const soft = (cond: boolean, message: string) => {
  if (!cond) console.warn(`  警告（原稿の件数）: ${message}`);
};

// ---------------------------------------------------------------------------
// (a) 前処理の各規則
// ---------------------------------------------------------------------------

// 1. YAML の先頭
{
  const r = run('---\ntitle: "The Model: a test"\nauthor: x\n---\n\n# Body\n\ntext');
  assert.equal(r.frontMatterTitle, "The Model: a test");
  assert.equal(r.markdown, "# Body\n\ntext");
  assert.equal(run("# No yaml").frontMatterTitle, null);
  // 閉じが無い `---` は YAML として扱わない
  assert.equal(run("---\nnot closed\n\ntext").markdown, "---\nnot closed\n\ntext");
}

// 2. HTML コメント（複数行・行の途中・コードブロック内・インラインコード内）
{
  const r = run("before\n<!-- memo one\n  line two -->\nafter <!-- inline --> tail\n\n```\n<!-- keep -->\n```\n\n`<!-- keep too -->`");
  assert.deepEqual(r.notes, ["memo one\n  line two", "inline"]);
  assert.ok(!r.markdown.includes("memo one"));
  assert.ok(r.markdown.includes("after  tail") || r.markdown.includes("after tail"), r.markdown);
  assert.ok(r.markdown.includes("<!-- keep -->"), "コードブロックの中のコメントは残す");
  assert.ok(r.markdown.includes("`<!-- keep too -->`"), "インラインコードの中のコメントは残す");
  // 閉じていないコメントも本文へ漏らさない
  const open = run("a\n<!-- never closed\nb");
  assert.ok(!open.markdown.includes("never closed"));
  assert.equal(open.notes.length, 1);
}

// 3. pandoc の見出し属性
{
  const r = run("# Abstract {-}\n\n## Part {.unnumbered}\n\n### Keep {#my-id}\n\n#### Both {-  #both-id}\n\n## Set $\\{a\\}$ {x}");
  assert.ok(r.markdown.includes("# Abstract\n"), r.markdown);
  assert.ok(r.markdown.includes("## Part\n"), r.markdown);
  assert.ok(r.markdown.includes("### Keep {#my-id}"), r.markdown);
  assert.ok(r.markdown.includes("#### Both {#both-id}"), r.markdown);
  assert.ok(r.markdown.includes("{x}"), "属性として読めない波括弧は本文として残す");
}

// 4. 論文の引用番号
{
  const r = run(
    "a<sup>[1,2]</sup> b<sup>[3–5]</sup> c<sup>[3-5]</sup> d<sup>[1, 2]</sup> e<sup>[75,76]</sup>",
  );
  assert.equal(
    r.markdown,
    "a[1,2](#ref-1) b[3–5](#ref-3) c[3-5](#ref-3) d[1, 2](#ref-1) e[75,76](#ref-75)",
  );
  assert.ok(run("```\n<sup>[1]</sup>\n```").markdown.includes("<sup>[1]</sup>"));
}

// 5. 文献一覧
{
  const r = run("# Body\n\n1. not a reference\n\n# References {-}\n\n*Note line.*\n\n1. Foo, A. (2020). *Title*.\n2. Bar, B. (2021). Other.\n   continued line.\n\n# After\n\n1. stays a list");
  assert.ok(r.markdown.includes("[1](#refdef-1) Foo, A. (2020). *Title*."), r.markdown);
  assert.ok(r.markdown.includes("\n\n[2](#refdef-2) Bar, B. (2021). Other.\n   continued line."), r.markdown);
  assert.ok(r.markdown.includes("1. not a reference"), "文献一覧の外の番号付きリストは触らない");
  assert.ok(r.markdown.includes("1. stays a list"), "次の h1 以降は文献一覧ではない");
  const ja = run("## 参考文献\n\n1. 山田 (2020).\n2. 鈴木 (2021).");
  assert.ok(ja.markdown.includes("[2](#refdef-2) 鈴木 (2021)."), ja.markdown);
}

// 6. 図のパス
{
  const paper = run("![](figures_v2/fig1.png) ![alt](sub/../figures_v2/a%20b.png \"cap\")", { file: "PAPER_P1_DRAFT_V2.md" });
  assert.ok(paper.markdown.includes("![](/api/bzm-reader/asset/figures_v2/fig1.png)"), paper.markdown);
  assert.ok(paper.markdown.includes(`![alt](${readerAssetHref("figures_v2/a b.png")} "cap")`), paper.markdown);
  const nested = run("![x](../figures/p.png)", { file: "sm_v2/SM-A.md" });
  assert.ok(nested.markdown.includes("/api/bzm-reader/asset/figures/p.png"), nested.markdown);
  const keep = run("![a](/images/x.png) ![b](https://example.com/y.png) ![c](../../out.png)", { file: "sm_v2/SM-A.md" });
  assert.equal(keep.markdown, "![a](/images/x.png) ![b](https://example.com/y.png) ![c](../../out.png)");
  assert.ok(run("```\n![](a.png)\n```").markdown.includes("![](a.png)"));
}

// 7. 章間リンク
{
  const r = run("[a](./book-a-ch-2) [b](./book-a-ch-2.md#sec) [c](./other-chapter) [d](./other.md#x) [e](./pic.png) [f](https://x.test/y)");
  assert.ok(r.markdown.includes(`[a](${readerChapterHref("book-a", "book-a-ch-2")})`), r.markdown);
  assert.ok(r.markdown.includes(`[b](${readerChapterHref("book-a", "book-a-ch-2")}#sec)`), r.markdown);
  assert.ok(r.markdown.includes("[c](/bzm/other-chapter)"), r.markdown);
  assert.ok(r.markdown.includes("[d](/bzm/other#x)"), r.markdown);
  assert.ok(r.markdown.includes("[e](./pic.png)"), "拡張子付きの別ファイルは章リンクにしない");
  assert.ok(r.markdown.includes("[f](https://x.test/y)"));
}

// 8. callout
{
  const r = run("> [!NOTE]\n> n\n\n> [!TIP]\n> t\n\n> [!IMPORTANT]\n> i\n\n> [!WARNING]\n> w\n\n> [!CAUTION]\n> c\n\n```\n> [!NOTE]\n```");
  for (const label of ["メモ", "ヒント", "重要", "注意"]) {
    assert.ok(r.markdown.includes(`> **${label}**`), `${label}: ${r.markdown}`);
  }
  assert.equal(r.markdown.match(/> \*\*注意\*\*/g)?.length, 2, "WARNING と CAUTION はどちらも注意");
  assert.ok(!/^> \[!(?:TIP|IMPORTANT|WARNING|CAUTION)\]/m.test(r.markdown));
  assert.ok(r.markdown.includes("```\n> [!NOTE]\n```"), "コードブロックの中は触らない");
  // ラベルだけの段落にして、本文と同じ段落に溶けない
  assert.ok(r.markdown.includes("> **メモ**\n>\n> n"), r.markdown);
}

// コードブロック内を触らない（まとめて）
{
  const fenced = "```md\n# H {-}\n<!-- c -->\n<sup>[1]</sup>\n[x](./book-a-ch-2)\n> [!NOTE]\n1. a\n```";
  assert.equal(run(fenced).markdown, fenced);
  const tilde = "~~~\n<!-- c -->\n~~~";
  assert.equal(run(tilde).markdown, tilde);
}

// ---------------------------------------------------------------------------
// (b) splitByH1
// ---------------------------------------------------------------------------
{
  const parts = splitByH1(
    "**Author** line\n\n# Abstract\n\nabs\n\n# 1. Introduction\n\nintro\n\n```\n# not a heading\n```\n\n# 日本語だけ\n\njp\n\n# Abstract\n\nagain\n\n# Supplementary Material (contents)\n\ns",
  );
  assert.deepEqual(
    parts.map((p) => [p.title, p.slug]),
    [
      ["Abstract", "abstract"],
      ["1. Introduction", "1-introduction"],
      ["日本語だけ", "section-3"],
      ["Abstract", "abstract-2"],
      ["Supplementary Material (contents)", "supplementary-material-contents"],
    ],
  );
  assert.ok(parts[0].markdown.startsWith("**Author** line"), "前置きは最初の章の頭に入る");
  assert.ok(parts[0].markdown.includes("# Abstract"));
  assert.ok(parts[1].markdown.startsWith("# 1. Introduction"));
  assert.ok(parts[1].markdown.includes("# not a heading"), "コードブロック内の # では割らない");
  assert.equal(parts.length, 5);
  assert.equal(splitByH1("{-} only").length, 1);
  assert.equal(splitByH1("# Title {-}\n\nx")[0].title, "Title");
}

// ensureLeadingH1（補足資料は `## ` 始まり）
{
  assert.equal(ensureLeadingH1("## SM-A. Title\n\n### A.0 x"), "# SM-A. Title\n\n### A.0 x");
  assert.equal(ensureLeadingH1("# Already\n\n## sub"), "# Already\n\n## sub");
  assert.equal(ensureLeadingH1("text first\n\n## sub"), "text first\n\n## sub");
  assert.equal(firstHeadingText("intro\n\n## Second {-}\n\n# First?"), "Second");
  assert.equal(firstHeadingText("intro\n\n## Second\n\n# First `code`", 1), "First code");
}

// ---------------------------------------------------------------------------
// (c) extractReaderHeadings
// ---------------------------------------------------------------------------
{
  const heads = extractReaderHeadings(
    "# H1\n\n## Plain *emph* heading\n\n### With id {#custom-id}\n\n## 数式 $x_t$ と `code`\n\n```\n## in code\n```\n\n#### h4 is skipped",
    headingAnchorId,
  );
  assert.deepEqual(heads, [
    { id: headingAnchorId("Plain emph heading"), text: "Plain emph heading", level: 2 },
    { id: "custom-id", text: "With id", level: 3 },
    { id: headingAnchorId("数式 $x_t$ と code"), text: "数式 $x_t$ と code", level: 2 },
  ]);
  const withAttr = extractReaderHeadings("## Title {-}", headingAnchorId);
  assert.deepEqual(withAttr, [{ id: headingAnchorId("Title"), text: "Title", level: 2 }]);
}

// countReaderChars: 画面に見える字に近づける（URL・図・数式の原文は数えない）
{
  assert.equal(countReaderChars("# 見出し\n\n本文 です"), 7);
  assert.equal(countReaderChars("```js\nab cd\n```"), 4);
  // 区切り行は数えない（セルの縦棒は目安として数える）
  assert.equal(countReaderChars("| a | b |\n|---|:-:|\n| c | d |"), 10);
  assert.equal(countReaderChars(""), 0);
  assert.equal(countReaderChars("あいう"), 3);
  assert.equal(countReaderChars("# 見出し {#custom-id}"), 3, "見出しの # と {#id} は数えない");
  assert.equal(countReaderChars("[あ](https://example.com/very/long/url)"), 1, "リンクは表示文字だけ");
  assert.equal(countReaderChars("[1,2](/bzm/read/p1-paper/references#ref-1 \"A, B. (2020). Title.\")"), 3, "引用は番号だけ");
  assert.equal(countReaderChars("![](/api/bzm-reader/asset/figures_v2/fig1_framework.png)"), 1, "図は 1 字");
  assert.equal(countReaderChars("$$\\frac{a}{b}$$"), 1, "表示数式は 1 字");
  assert.equal(countReaderChars("値は $x_t = \\frac{a}{b}$ です"), 5, "インライン数式は 1 字");
  assert.equal(countReaderChars("\\[\nx\n\\]"), 1);
  assert.equal(countReaderChars("`$x$` と $y$"), 7, "インラインコードの中の $ は数式にしない（コードは記号ごと数える）");
}

// 同じ平文の見出しは 2 件目以降に連番つきの明示 id を付け、目次の id と一致させる（取り決め B）
{
  const r = run("# Top\n\n## 討議課題\n\n### 討議課題\n\n## 討議課題\n\n## 討議課題 ##\n\n#### 解答\n\n#### 解答");
  const id = headingAnchorId("討議課題");
  assert.ok(r.markdown.includes(`## 討議課題\n`), r.markdown);
  assert.ok(r.markdown.includes(`### 討議課題 {#${id}-2}`), r.markdown);
  assert.ok(r.markdown.includes(`## 討議課題 {#${id}-3}`), r.markdown);
  assert.ok(r.markdown.includes(`## 討議課題 {#${id}-4}`), "閉じの # 列は外して明示 id を付ける");
  assert.ok(r.markdown.includes(`#### 解答 {#${headingAnchorId("解答")}-2}`), r.markdown);
  const ids = extractReaderHeadings(r.markdown, headingAnchorId).map((h) => h.id);
  assert.deepEqual(ids, [id, `${id}-2`, `${id}-3`, `${id}-4`]);
  // 最初から `{#id}` を持つ見出しは触らない
  assert.ok(run("## A {#same}\n\n## A {#same2}").markdown.includes("## A {#same2}"));
}

// 論文の引用 → 文献一覧の章へのリンク（取り決め C。load.ts が使う純関数）
{
  const refsMd =
    "# References\n\n[1](#refdef-1) Foo, A. (2020). *A \"quoted\" title*. [Link](https://x.test/a).\n\n[2](#refdef-2) Bar, B. (2021).\n   continued line.\n\n[3](#refdef-3) Baz (2022).";
  const texts = extractReferenceTexts(refsMd);
  assert.equal(texts.get(1), 'Foo, A. (2020). A "quoted" title. Link.');
  assert.equal(texts.get(2), "Bar, B. (2021). continued line.");
  assert.equal(texts.get(3), "Baz (2022).");
  const rewritten = rewriteReferenceCitations(
    "a[1,2](#ref-1) b[3](#ref-3) c[1–3](#ref-1) d[9](#ref-9)\n\n```\n[1](#ref-1)\n```",
    { bookId: "p1-paper", referencesSlug: "references", texts },
  );
  const base = "/bzm/read/p1-paper/references";
  assert.ok(rewritten.includes(`[1](${base}#ref-1 "Foo, A. (2020). A \\"quoted\\" title. Link."),[2](${base}#ref-2 "Bar, B. (2021). continued line.")`), rewritten);
  assert.ok(rewritten.includes(`b[3](${base}#ref-3 "Baz (2022).")`), rewritten);
  assert.ok(rewritten.includes(`c[1](${base}#ref-1 "Foo, A. (2020). A \\"quoted\\" title. Link.")–[3](${base}#ref-3`), rewritten);
  assert.ok(rewritten.includes(`d[9](${base}#ref-9)`), "書誌が無い番号は title なしでリンクだけ残す");
  assert.ok(rewritten.includes("```\n[1](#ref-1)\n```"), "コードブロックの中は触らない");
}

// ---------------------------------------------------------------------------
// 数式の退避（content-2）。インラインの規則は BzmMarkdown と同じ（`$` と `$` の間に `$` を含まない。
// 改行は許し、空行はまたがない。`\$` は数式にしない）
// ---------------------------------------------------------------------------

/** 数式の目印・コードブロック・インラインコードの外に残った `$` の数（`\$` は文字なので数えない） */
function strayDollars(text: string): number {
  let fence: string | null = null;
  let count = 0;
  for (const line of text.split("\n")) {
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (open && open[1][0] === fence[0] && open[1].length >= fence.length && open[2].trim() === "") fence = null;
      continue;
    }
    if (open && !(open[1][0] === "`" && open[2].includes("`"))) {
      fence = open[1];
      continue;
    }
    count += (line.replace(/`[^`]*`/g, "").replace(/\\\$/g, "").match(/\$/g) ?? []).length;
  }
  return count;
}

{
  // BZM 2.2教科書 value-and-indices の 3 か所
  const a = protectMath("$P=$3億8400万円と$J=$1200万円は矛盾していない。");
  assert.deepEqual(a.maths.map((m) => m.tex), ["P=", "J="]);
  assert.equal(strayDollars(a.text), 0, a.text);
  assert.ok(a.text.includes("3億8400万円と") && a.text.includes("1200万円は矛盾していない。"), a.text);
  const b = protectMath("p03の$P=$3億8400万円は…");
  assert.deepEqual(b.maths.map((m) => m.tex), ["P="]);
  assert.equal(strayDollars(b.text), 0);
  const c = protectMath("p03では$J=$1200万円になる。");
  assert.deepEqual(c.maths.map((m) => m.tex), ["J="]);
  assert.equal(strayDollars(c.text), 0);
  // Book A 第8章の表のセル
  const d = protectMath("| 項目 | 値 |\n|---|---|\n| 係数 | $1.6/2 = $ **0.800** |");
  assert.deepEqual(d.maths.map((m) => m.tex), ["1.6/2 ="]);
  assert.equal(strayDollars(d.text), 0, d.text);
  assert.ok(d.text.includes("**0.800**"));
  // SM-C の、行の途中で折り返された式
  const e = protectMath("Table C-18 は $\\lambda^{\\mathrm{comp}} = 3.0\\%/\n\\mathrm{yr}$ を置く。");
  assert.equal(e.maths.length, 1);
  assert.equal(e.maths[0].tex, "\\lambda^{\\mathrm{comp}} = 3.0\\%/\n\\mathrm{yr}");
  assert.equal(strayDollars(e.text), 0, e.text);
  // 空行（段落の切れ目）はまたがない
  const f = protectMath("段落 $x\n\n段落 y$ 終わり");
  assert.equal(f.maths.length, 0);
  // `\$` は文字としての $。数式にしない
  const g = protectMath("価格は\\$5 と \\$6 です。式 $a_1$ は別。");
  assert.deepEqual(g.maths.map((m) => m.tex), ["a_1"]);
  assert.ok(g.text.includes("価格は\\$5 と \\$6 です。"), g.text);
  // 表示数式、コードブロック、インラインコード
  const h = protectMath("$$\nx_1 + y_2\n$$\n\n```\n$not math$\n```\n\n`$also not$` と \\(z_3\\) と \\[w_4\\]");
  assert.deepEqual(h.maths.map((m) => m.tex), ["x_1 + y_2", "z_3", "w_4"]);
  assert.ok(h.text.includes("$not math$") && h.text.includes("`$also not$`"), h.text);
  assert.ok(!/\$\$/.test(h.text), h.text);
  // 引用の中の表示数式は入れ物を保つ
  const i = protectMath("> $$x_1$$");
  assert.ok(i.text.includes("> ```bzr-math"), i.text);
}

// 実原稿の全章: 数式の外に `$` が残らない
{
  const bzmDir = path.resolve(process.cwd(), "..", "bzm");
  let checked = 0;
  for (const book of READER_LIBRARY) {
    for (const chapter of book.chapters) {
      const file = path.join(bzmDir, chapter.file);
      if (!fs.existsSync(file)) continue;
      const prepared = preprocessReaderMarkdown(fs.readFileSync(file, "utf8"), {
        file: chapter.file,
        bookId: book.id,
        bookChapterSlugs: book.chapters.map((c) => c.slug),
      });
      const { text } = protectMath(prepared.markdown);
      assert.equal(strayDollars(text), 0, `${chapter.file}: 数式の外に $ が残っている`);
      checked += 1;
    }
  }
  soft(checked >= 40, `実原稿の章が少ない: ${checked}`);
}

// ---------------------------------------------------------------------------
// (d)(e) manifest
// ---------------------------------------------------------------------------
{
  const ids = READER_LIBRARY.map((book) => book.id);
  assert.equal(new Set(ids).size, ids.length, "本の id が重複している");
  assert.deepEqual(ids, ["bzm30-textbook", "book-a", "bzm22-textbook", "bzm-course", "p1-paper", "p1-supplement"]);

  for (const book of READER_LIBRARY) {
    const slugs = book.chapters.map((chapter) => chapter.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${book.id}: 章の slug が重複している`);
    const files = book.chapters.map((chapter) => chapter.file);
    assert.equal(new Set(files).size, files.length, `${book.id}: 章の file が重複している`);
    assert.ok(book.chapters.length > 0, `${book.id}: 章が空`);
  }

  const bookA = READER_LIBRARY.find((book) => book.id === "book-a");
  const part = BZM_PARTS.find((p) => p.key === "book-a");
  assert.ok(bookA && part);
  assert.deepEqual(bookA.chapters.map((chapter) => chapter.slug), part.slugs);
  assert.ok(bookA.chapters.every((chapter) => chapter.title), "book-a の章に題が付いていない");

  const bzm30 = READER_LIBRARY[0];
  assert.equal(bzm30.chapters.length, 16);
  assert.equal(bzm30.chapters[0].slug, "bzm-3-0-textbook-introduction");
  assert.equal(bzm30.chapters[0].plannedTitle, "序 — このモデルは何を測るのか");
  assert.equal(bzm30.chapters[3].plannedTitle, "第3章 — 案件パラメータと事前分布");
  assert.equal(bzm30.chapters[15].plannedTitle, "付録 — 記号一覧、用語、参考文献");

  const bzm22 = READER_LIBRARY[2];
  assert.equal(bzm22.chapters.at(-1)?.plannedTitle, "第III部 — 文脈と限界");
  assert.deepEqual(READER_LIBRARY[3].chapters.map((chapter) => chapter.slug), [
    "course-bzm-foundations-index",
    "course-bzm-foundations-s00",
    "course-bzm-foundations-s01",
  ]);
  assert.deepEqual(READER_LIBRARY[4].chapters, [{ slug: "paper", file: "PAPER_P1_DRAFT_V2.md", split: "h1" }]);
  assert.deepEqual(
    READER_LIBRARY[5].chapters.map((chapter) => [chapter.slug, chapter.file]),
    ["a", "b", "c", "d", "e", "f", "g"].map((l) => [`sm-${l}`, `sm_v2/SM-${l.toUpperCase()}.md`]),
  );
  assert.deepEqual(
    READER_LIBRARY.map((book) => book.lang),
    ["ja", "ja", "ja", "ja", "en", "en"],
  );

  // 実在する章ファイルは存在し、存在しないのは manifest が未執筆と知っているものだけ
  const bzmDir = path.resolve(process.cwd(), "..", "bzm");
  assert.ok(fs.existsSync(bzmDir), `bzm フォルダが見つからない: ${bzmDir}`);
  for (const book of READER_LIBRARY) {
    for (const chapter of book.chapters) {
      if (!fs.existsSync(path.join(bzmDir, chapter.file))) {
        assert.ok(chapter.plannedTitle, `${book.id}/${chapter.slug}: ファイルが無いのに plannedTitle が無い (${chapter.file})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// (f) 実原稿（第1論文）
// ---------------------------------------------------------------------------
{
  const file = "PAPER_P1_DRAFT_V2.md";
  const source = fs.readFileSync(path.resolve(process.cwd(), "..", "bzm", file), "utf8");
  const r = preprocessReaderMarkdown(source, { file, bookId: "p1-paper", bookChapterSlugs: ["paper"] });
  assert.ok(!r.markdown.includes("<sup>"), "<sup> が残っている");
  assert.ok(!r.markdown.includes("<!--"), "HTML コメントが残っている");
  assert.ok(r.notes.length >= 1);
  assert.ok(r.frontMatterTitle?.startsWith("The Before Zero Model"), String(r.frontMatterTitle));
  assert.ok(!r.markdown.startsWith("---"));
  assert.ok(!/\{-\}/.test(r.markdown), "{-} が残っている");
  const refDefs = r.markdown.match(/^\[\d+\]\(#refdef-\d+\) /gm) ?? [];
  soft(refDefs.length >= 70, `文献の目印が少ない: ${refDefs.length}`);
  const cites = r.markdown.match(/\[[\d,\s–-]+\]\(#ref-\d+\)/g) ?? [];
  soft(cites.length >= 50, `引用番号のリンクが少ない: ${cites.length}`);
  assert.equal(
    (r.markdown.match(/\/api\/bzm-reader\/asset\/figures_v2\/fig\d_[a-z_]+\.png/g) ?? []).length,
    5,
    "図が 5 枚書き換わっていない",
  );

  const sections = splitByH1(r.markdown);
  assert.equal(sections[0].slug, "abstract");
  assert.equal(sections.at(-1)?.slug, "references");
  assert.equal(new Set(sections.map((s) => s.slug)).size, sections.length);
  assert.ok(sections.some((s) => s.slug === "1-introduction"));
  assert.ok(sections[0].markdown.includes("Masa Yamaji"), "著者行が最初の章に入っていない");
  assert.ok(sections.every((s) => countReaderChars(s.markdown) > 0));
  const heads = extractReaderHeadings(sections[1].markdown, headingAnchorId);
  assert.ok(heads.length === 0 || heads.every((h) => h.id && h.text));
  const section2 = sections.find((s) => s.slug === "2-the-measurement-problem");
  assert.ok(section2 && extractReaderHeadings(section2.markdown, headingAnchorId).length >= 4);

  // 実原稿の他の本: コメントと callout が残らない
  const chapter6 = fs.readFileSync(path.resolve(process.cwd(), "..", "bzm", "book-a-ch-6.md"), "utf8");
  const p6 = preprocessReaderMarkdown(chapter6, {
    file: "book-a-ch-6.md",
    bookId: "book-a",
    bookChapterSlugs: READER_LIBRARY[1].chapters.map((c) => c.slug),
  });
  assert.ok(!/\[!CAUTION\]/.test(p6.markdown) && p6.markdown.includes("**注意**"), "Book A 第5章の警告が落ちている");

  const sm = fs.readFileSync(path.resolve(process.cwd(), "..", "bzm", "sm_v2", "SM-A.md"), "utf8");
  const smReady = ensureLeadingH1(
    preprocessReaderMarkdown(sm, { file: "sm_v2/SM-A.md", bookId: "p1-supplement", bookChapterSlugs: [] }).markdown,
  );
  assert.ok(smReady.startsWith("# SM-A. Notation and complete model equations"));
}

// ---------------------------------------------------------------------------
// (g) 進み具合と残り時間
// ---------------------------------------------------------------------------
{
  const book = {
    totalChars: 1000,
    chapters: [
      { slug: "c1", title: "1", exists: true, charCount: 400 },
      { slug: "c2", title: "2", exists: false, charCount: 0 },
      { slug: "c3", title: "3", exists: true, charCount: 600 },
    ],
  };
  assert.equal(bookProgressFraction(book, "c1", 0), 0);
  assert.equal(bookProgressFraction(book, "c1", 0.5), 0.2);
  assert.equal(bookProgressFraction(book, "c1", 1), 0.4);
  assert.equal(bookProgressFraction(book, "c3", 0), 0.4);
  assert.equal(bookProgressFraction(book, "c3", 0.5), 0.7);
  assert.equal(bookProgressFraction(book, "c3", 1), 1);
  assert.equal(bookProgressFraction(book, "c3", 7), 1, "範囲外の位置は 1 に丸める");
  assert.equal(bookProgressFraction(book, "c3", -1), 0.4);
  assert.equal(bookProgressFraction(book, "c3", Number.NaN), 0.4);
  assert.equal(bookProgressFraction(book, "nope", 0.5), 0);
  assert.equal(bookProgressFraction({ ...book, totalChars: 0 }, "c1", 0.5), 0);

  assert.equal(remainingMinutes(0, 0, "ja"), 0);
  assert.equal(remainingMinutes(500, 0, "ja"), 1);
  assert.equal(remainingMinutes(501, 0, "ja"), 2);
  assert.equal(remainingMinutes(1000, 0.5, "ja"), 1);
  assert.equal(remainingMinutes(1000, 0.4, "ja"), 2);
  assert.equal(remainingMinutes(1000, 1, "ja"), 0);
  assert.equal(remainingMinutes(1000, 2, "ja"), 0);
  assert.equal(remainingMinutes(1300, 0, "en"), 1);
  assert.equal(remainingMinutes(1301, 0, "en"), 2);
  assert.equal(remainingMinutes(13000, 0.1, "en"), 9);
  assert.equal(remainingMinutes(10, 0, "ja"), 1, "1 字でも残れば 1 分");
}

// ---------------------------------------------------------------------------
// 端末内保存（localStorage の代わりに入れ物を差し込んで確かめる）
// ---------------------------------------------------------------------------
{
  // window が無い（サーバ側）でも落ちない
  assert.deepEqual(loadReaderSettings(), DEFAULT_READER_SETTINGS);
  assert.equal(loadReaderPosition("book-a"), null);
  assert.deepEqual(loadReaderBookmarks("book-a"), []);
  saveReaderSettings(DEFAULT_READER_SETTINGS);

  const data = new Map<string, string>();
  const stub = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  (globalThis as unknown as { window: unknown }).window = { localStorage: stub };

  const settings = { ...DEFAULT_READER_SETTINGS, fontSize: 22, theme: "sepia" as const, spread: false };
  saveReaderSettings(settings);
  assert.deepEqual(loadReaderSettings(), settings);

  data.set("amd-os.bzm-reader.settings", JSON.stringify({ fontSize: 19, lineHeight: 1.8, theme: "neon", margin: 2 }));
  const partial = loadReaderSettings();
  assert.equal(partial.fontSize, DEFAULT_READER_SETTINGS.fontSize, "候補に無い文字の大きさは既定へ戻す");
  assert.equal(partial.theme, DEFAULT_READER_SETTINGS.theme);
  assert.equal(partial.margin, 2);

  data.set("amd-os.bzm-reader.settings", "{broken");
  assert.deepEqual(loadReaderSettings(), DEFAULT_READER_SETTINGS);

  const position = { chapterSlug: "book-a-ch-2", fraction: 0.4, blockIndex: 12, updatedAt: "2026-10-03T00:00:00.000Z" };
  saveReaderPosition("book-a", position);
  assert.deepEqual(loadReaderPosition("book-a"), position);
  assert.equal(loadReaderPosition("book-a-other"), null);
  data.set("amd-os.bzm-reader.position.book-a", JSON.stringify({ chapterSlug: "x", fraction: 5, blockIndex: -2 }));
  assert.deepEqual(loadReaderPosition("book-a"), { chapterSlug: "x", fraction: 1, blockIndex: null, updatedAt: "" });
  data.set("amd-os.bzm-reader.position.book-a", JSON.stringify({ fraction: 0.2 }));
  assert.equal(loadReaderPosition("book-a"), null);

  const mark = {
    id: "m1",
    chapterSlug: "book-a-ch-1",
    chapterTitle: "第1章",
    fraction: 0.1,
    blockIndex: null,
    snippet: "冒頭",
    createdAt: "2026-10-03T00:00:00.000Z",
  };
  saveReaderBookmarks("book-a", [mark]);
  assert.deepEqual(loadReaderBookmarks("book-a"), [mark]);
  data.set("amd-os.bzm-reader.bookmarks.book-a", JSON.stringify([mark, { id: 3 }, "x"]));
  assert.deepEqual(loadReaderBookmarks("book-a"), [mark], "壊れた項目は捨てる");

  // 保存先が例外を投げても画面は止まらない
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    },
  };
  assert.deepEqual(loadReaderSettings(), DEFAULT_READER_SETTINGS);
  assert.equal(loadReaderPosition("book-a"), null);
  saveReaderSettings(DEFAULT_READER_SETTINGS);
  saveReaderPosition("book-a", position);
  saveReaderBookmarks("book-a", [mark]);
  delete (globalThis as unknown as { window?: unknown }).window;
}

// ---------------------------------------------------------------------------
// load.ts を実際に通す（取り決め A・C）と、ReaderMarkdown の描画（取り決め B・C・D）
// ---------------------------------------------------------------------------
{
  await import("./register_ts_aliases.mjs");
  const { getReaderLibrary, getReaderBook, getReaderChapterContent } = await import("../src/lib/bzm-reader/load.ts");
  const bzmDir = path.resolve(process.cwd(), "..", "bzm");

  // ReaderMarkdown.tsx は JSX と css の import を含むので、typescript で変換した写しを作って読み込む
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const cacheDir = path.resolve(process.cwd(), "node_modules", ".cache", "bzm-reader-check");
  fs.mkdirSync(cacheDir, { recursive: true });
  const componentSource = fs
    .readFileSync(path.resolve(process.cwd(), "src/components/bzm-reader/ReaderMarkdown.tsx"), "utf8")
    .replace(/^import "[^"]+\.css";\n/gm, "");
  const transpiled = ts.transpileModule(componentSource, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const componentFile = path.join(cacheDir, "ReaderMarkdown.mjs");
  fs.writeFileSync(componentFile, transpiled.outputText);
  const { ReaderMarkdown } = (await import(pathToFileURL(componentFile).href)) as {
    ReaderMarkdown: (props: { markdown: string; lang: "ja" | "en" }) => unknown;
  };
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const render = (markdown: string, lang: "ja" | "en" = "ja") =>
    renderToStaticMarkup(createElement(ReaderMarkdown as never, { markdown, lang } as never));

  // 棚: 書けている章の数は、ファイルの有無と一致する
  const library = getReaderLibrary();
  assert.equal(library.length, READER_LIBRARY.length);
  for (const manifest of READER_LIBRARY) {
    const book = getReaderBook(manifest.id);
    assert.ok(book, manifest.id);
    if (manifest.chapters.some((c) => c.split === "h1")) {
      // 1 ファイルを章に割る本: ファイルがあれば全章が書けている
      const present = manifest.chapters.every((c) => fs.existsSync(path.join(bzmDir, c.file)));
      assert.equal(book.chapters.every((c) => c.exists), present, `${manifest.id}: 章の有無がファイルと合わない`);
      assert.ok(book.chapters.length > manifest.chapters.length, `${manifest.id}: 章に割れていない`);
    } else {
      assert.deepEqual(
        book.chapters.map((c) => c.exists),
        manifest.chapters.map((c) => fs.existsSync(path.join(bzmDir, c.file))),
        `${manifest.id}: 章の有無がファイルと合わない`,
      );
    }
    assert.equal(book.writtenCount, book.chapters.filter((c) => c.exists).length);
    assert.equal(book.totalCount, book.chapters.length);
  }

  // 取り決め A: 本か章が manifest に無いときだけ null。未執筆の章は exists=false で空の中身を返す
  assert.equal(getReaderChapterContent("no-such-book", "x"), null);
  assert.equal(getReaderChapterContent("book-a", "no-such-chapter"), null);
  let unwritten = 0;
  for (const manifest of READER_LIBRARY) {
    for (const chapter of manifest.chapters) {
      if (fs.existsSync(path.join(bzmDir, chapter.file))) continue;
      const content = getReaderChapterContent(manifest.id, chapter.slug);
      assert.ok(content, `${manifest.id}/${chapter.slug}: 未執筆の章が null`);
      assert.equal(content.chapter.exists, false);
      assert.equal(content.markdown, "");
      assert.deepEqual(content.headings, []);
      assert.deepEqual(content.notes, []);
      assert.equal(content.chapter.charCount, 0);
      assert.ok(content.chapter.title.length > 0);
      unwritten += 1;
    }
  }
  console.log(`  未執筆の章: ${unwritten} 件が exists=false で返る`);

  // 取り決め C: 論文の引用は、文献一覧の章へ飛ぶリンクに書き換わり、書誌が title に入る
  const paper = getReaderBook("p1-paper");
  assert.ok(paper);
  const referencesSlug = paper.chapters.find((c) => c.slug === "references")?.slug;
  assert.equal(referencesSlug, "references");
  let rewrittenCites = 0;
  for (const chapter of paper.chapters) {
    const content = getReaderChapterContent("p1-paper", chapter.slug);
    assert.ok(content);
    if (chapter.slug === "references") {
      assert.ok(/^\[1\]\(#refdef-1\) /m.test(content.markdown), "文献一覧に目印が無い");
      continue;
    }
    assert.ok(!/\]\(#ref-\d+/.test(content.markdown), `${chapter.slug}: 章内だけを指す #ref- のリンクが残っている`);
    const links = [...content.markdown.matchAll(/\]\(\/bzm\/read\/p1-paper\/references#ref-(\d+)( "(?:[^"\\]|\\.)+")?\)/g)];
    for (const link of links) assert.ok(link[2], `${chapter.slug}: 引用 ${link[1]} に書誌の title が無い`);
    rewrittenCites += links.length;

    const html = render(content.markdown, "en");
    assert.ok(!html.includes('href="#ref-'), `${chapter.slug}: 描画に章内の #ref- が残っている`);
    for (const m of html.matchAll(/<a href="\/bzm\/read\/p1-paper\/references#ref-(\d+)"( title="[^"]+")?>/g)) {
      assert.ok(m[2], `${chapter.slug}: 描画の引用 ${m[1]} に title が無い`);
    }
    assert.equal((html.match(/class="bzr-cite"/g) ?? []).length, links.length, `${chapter.slug}: 上付きの引用の数が合わない`);
  }
  soft(rewrittenCites >= 72, `書き換わった引用が少ない: ${rewrittenCites}`);

  // 文献一覧の章の描画: 目印 id="ref-N" が並ぶ
  const refsContent = getReaderChapterContent("p1-paper", "references");
  assert.ok(refsContent);
  const refsHtml = render(refsContent.markdown, "en");
  soft((refsHtml.match(/id="ref-\d+"/g) ?? []).length >= 70, "文献一覧の目印が少ない");

  // 取り決め B: 全章で、目次の id と描画された見出しの id が順番まで一致し、重複しない
  let chaptersRendered = 0;
  let headingsMatched = 0;
  for (const manifest of READER_LIBRARY) {
    const book = getReaderBook(manifest.id);
    assert.ok(book);
    for (const chapter of book.chapters) {
      if (!chapter.exists) continue;
      const content = getReaderChapterContent(manifest.id, chapter.slug);
      assert.ok(content);
      const html = render(content.markdown, manifest.lang);
      const rendered = [...html.matchAll(/<h([1-4]) id="([^"]+)"/g)].map((m) => ({ level: Number(m[1]), id: m[2] }));
      const ids = rendered.map((h) => h.id);
      assert.equal(new Set(ids).size, ids.length, `${manifest.id}/${chapter.slug}: 見出しの id が重複している`);
      const renderedToc = rendered.filter((h) => h.level === 2 || h.level === 3).map((h) => h.id);
      assert.deepEqual(
        renderedToc,
        content.headings.map((h) => h.id),
        `${manifest.id}/${chapter.slug}: 目次の id と描画の id が一致しない`,
      );
      assert.ok(!html.includes("katex-error"), `${manifest.id}/${chapter.slug}: 数式の変換に失敗している`);
      assert.ok(!html.includes("⟦bzr-math"), `${manifest.id}/${chapter.slug}: 数式の目印が描画に残っている`);
      chaptersRendered += 1;
      headingsMatched += content.headings.length;
    }
  }
  soft(chaptersRendered >= 40, `描画した章が少ない: ${chaptersRendered}`);
  soft(headingsMatched >= 500, `突き合わせた見出しが少ない: ${headingsMatched}`);
  console.log(`  描画 ${chaptersRendered} 章、見出し ${headingsMatched} 件の id が目次と一致`);

  // 実原稿の重複見出し（Book A 第15章の「討議課題」）
  const chapter15 = getReaderChapterContent("book-a", "book-a-ch-15");
  if (chapter15) {
    const same = chapter15.headings.filter((h) => h.text === "討議課題");
    soft(same.length >= 2, "討議課題の見出しが 2 件以上ある前提が崩れた");
    assert.equal(new Set(same.map((h) => h.id)).size, same.length, "討議課題の目次 id が重複している");
  }

  // 取り決め D: 表は列が 5 つ以上なら横スクロール、4 つ以下なら本文の幅に収める
  const table = (columns: number) =>
    `|${Array.from({ length: columns }, (_, i) => ` h${i} `).join("|")}|\n|${Array.from({ length: columns }, () => "---").join("|")}|\n|${Array.from({ length: columns }, (_, i) => ` c${i} `).join("|")}|`;
  for (const columns of [1, 2, 3, 4]) {
    const html = render(table(columns));
    assert.ok(html.includes('class="bzr-table bzr-table--fit"'), `${columns} 列: ${html}`);
    assert.ok(!html.includes("bzr-hscroll"), `${columns} 列の表に横スクロールの囲みが付いている`);
  }
  for (const columns of [5, 6, 9]) {
    const html = render(table(columns));
    assert.ok(html.includes('class="bzr-hscroll bzr-table bzr-table--wide"'), `${columns} 列: ${html}`);
  }
  // 表示数式は今のまま
  assert.ok(render("$$x_1 + y_2$$").includes('class="bzr-hscroll bzr-math-block"'));
  // 実原稿の表: 囲みの class は 2 種類のどちらかだけ
  const sample = getReaderChapterContent("p1-supplement", "sm-a");
  if (sample && sample.chapter.exists) {
    const html = render(sample.markdown, "en");
    const boxes = [...html.matchAll(/<div class="([^"]*bzr-table[^"]*)"/g)].map((m) => m[1]);
    assert.ok(boxes.length > 0);
    for (const box of boxes) {
      assert.ok(box === "bzr-hscroll bzr-table bzr-table--wide" || box === "bzr-table bzr-table--fit", box);
    }
  }
}

// 書斎のアドレスの振り分け（hosts.ts）
{
  const at = (u: string) => new URL(u);
  // 書斎のアドレス: `/` は棚へ、書斎・図の API・ログインは通し、それ以外は AMD OS へ
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/`), SHOSAI_HOST), `https://${SHOSAI_HOST}/bzm/read`);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/read`), SHOSAI_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/read/bzm30-textbook/x?at=end`), SHOSAI_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/api/bzm-reader/asset/a.png`), SHOSAI_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/auth/login?next=%2Fbzm%2Fread`), SHOSAI_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/auth/callback?code=1`), SHOSAI_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/dashboard`), SHOSAI_HOST), `https://${AMD_OS_HOST}/dashboard`);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/book-a-ch-1?x=1`), SHOSAI_HOST), `https://${AMD_OS_HOST}/bzm/book-a-ch-1?x=1`);
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/bzm/readme`), SHOSAI_HOST), `https://${AMD_OS_HOST}/bzm/readme`);
  // 大文字やポート付きの Host でも同じ
  assert.equal(readerHostRedirect(at(`https://${SHOSAI_HOST}/`), `Bookshelf-Armada.vercel.app:443`), `https://${SHOSAI_HOST}/bzm/read`);
  // AMD OS のアドレス: 書斎だけを書斎のアドレスへ。他は触らない
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm/read/book-a?x=1`), AMD_OS_HOST), `https://${SHOSAI_HOST}/bzm/read/book-a?x=1`);
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm/read`), AMD_OS_HOST), `https://${SHOSAI_HOST}/bzm/read`);
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm`), AMD_OS_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/bzm/readme`), AMD_OS_HOST), null);
  assert.equal(readerHostRedirect(at(`https://${AMD_OS_HOST}/dashboard`), AMD_OS_HOST), null);
  // その他のアドレス（プレビュー、手元の開発）は振り分けない
  assert.equal(readerHostRedirect(at("http://localhost:3000/bzm/read"), "localhost:3000"), null);
  assert.equal(readerHostRedirect(at("https://amd-os-abc123-armada0130.vercel.app/bzm/read"), "amd-os-abc123-armada0130.vercel.app"), null);
  // ログイン画面の出し分け
  assert.equal(isShosaiHost(SHOSAI_HOST), true);
  assert.equal(isShosaiHost("BOOKSHELF-ARMADA.vercel.app:443"), true);
  assert.equal(isShosaiHost(AMD_OS_HOST), false);
  assert.equal(isShosaiHost(null), false);
  console.log("  書斎のアドレスの振り分け: ok");
}

console.log("check_bzm_reader: ok");
