// 書斎（/bzm/read）の基盤の検査。設計正本は pwa/design/bzm_reader.md。
// 前処理の各規則、章の割り、見出し抽出、manifest、進み具合、端末内保存を、小さな入力と実原稿で確かめる。
// load.ts（`@/` 別名を使う）は、register_ts_aliases.mjs で別名を解く登録をしてから読み込む。
// ReaderMarkdown.tsx（JSX と css の import を含む）は、typescript で変換した写しを
// node_modules/.cache の下に作って読み込み、react-dom/server で描く。
// 章の扉と節番号の分け方（heading-parts.ts）、目次が持つ全章の見出し（bookHeadings）、目次の「導入」の判定
// （chapterHasIntro。章の題から最初の節までの本文の有無）、文字の色の比も確かめる。
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
  chapterHasIntro,
  countReaderChars,
  ensureLeadingH1,
  extractReaderHeadings,
  extractReferenceTexts,
  firstHeadingText,
  preprocessReaderMarkdown,
  rewriteReferenceCitations,
  splitByH1,
} from "../src/lib/bzm-reader/preprocess.ts";
import { splitChapterHeading, splitSectionNumber } from "../src/lib/bzm-reader/heading-parts.ts";
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
import {
  DEFAULT_READER_SETTINGS,
  readerAssetHref,
  readerChapterHref,
  readerHeadingHref,
  readerShowsIntro,
} from "../src/lib/bzm-reader/types.ts";

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

// ---------------------------------------------------------------------------
// (c2) chapterHasIntro: 目次の「導入」の項目を置くか。
// 章の題（最初の h1）から、目次に載る最初の見出し（h2。h2 より先に h3 が来る原稿はその h3）までに、空白以外の本文があるか
// ---------------------------------------------------------------------------
{
  // h1 の後に段落があり、そのあとに節が来る
  assert.equal(chapterHasIntro("# 第1章　題\n\n導入の段落。\n\n## 1.1 最初の節\n\n本文"), true);
  assert.equal(chapterHasIntro("# 序章　題\n\n導入の段落。\n\n> 本章の到達目標\n\n## 0.1 最初の節"), true);
  // h1 のすぐ後に h2（間は空行だけ、または改行だけ）
  assert.equal(chapterHasIntro("# 第1章　題\n\n## 1.1 最初の節\n\n本文"), false);
  assert.equal(chapterHasIntro("# 第1章　題\n## 1.1 最初の節\n\n本文"), false);
  // 間の空行がいくつあっても、空白だけの行（全角の空白を含む）があっても、本文ではない
  assert.equal(chapterHasIntro("# 題\n\n\n   \n　\n\n## 節\n\n本文"), false);
  // 段落以外（リスト、表、図、引用、h4 の見出し）も本文
  assert.equal(chapterHasIntro("# 題\n\n- 到達目標\n\n## 節"), true);
  assert.equal(chapterHasIntro("# 題\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n## 節"), true);
  assert.equal(chapterHasIntro("# 題\n\n![図](/api/bzm-reader/asset/a.png)\n\n## 節"), true);
  assert.equal(chapterHasIntro("# 題\n\n#### 小見出し\n\n## 節"), true);
  // 改行コードは問わない。見出し属性 {-} つきの h1 も h1
  assert.equal(chapterHasIntro("# 題\r\n\r\n導入\r\n\r\n## 節"), true);
  assert.equal(chapterHasIntro("# 題 {-}\n\n導入\n\n## 節"), true);
  // h1 が無い原稿は false（導入は章の題の直後から数える）
  assert.equal(chapterHasIntro("本文だけ\n\n## 節\n\n本文"), false);
  assert.equal(chapterHasIntro("## 節\n\n本文"), false);
  assert.equal(chapterHasIntro(""), false);
  // コードブロックの中の # に惑わされない。中の「# 題」は h1 ではなく、そのせいで導入ありにならない
  assert.equal(chapterHasIntro("```\n# コードの中の見出しに見える行\n```\n\n本文\n\n## 節"), false);
  assert.equal(chapterHasIntro("~~~\n# 同じく\n~~~\n\n本文"), false);
  // コードブロックそのものは本文。中の ## は節の始まりではない
  assert.equal(chapterHasIntro("# 題\n\n```\n## コードの中の節に見える行\n```\n\n## 節"), true);
  assert.equal(chapterHasIntro("# 題\n\n~~~\n## コードの中\n~~~"), true);
  // 最初の節より後のコードブロックは導入ではない
  assert.equal(chapterHasIntro("# 題\n\n## 節\n\n```\n# コードの中\n```\n\n本文"), false);
  // 節が 1 つも無い章は、h1 より後のすべてが導入。h1 だけで本文が無ければ false
  assert.equal(chapterHasIntro("# 題\n\n本文だけで節が無い"), true);
  assert.equal(chapterHasIntro("# 題"), false);
  assert.equal(chapterHasIntro("# 題\n\n\n"), false);
  // 補足資料のように h1 の後が h3 から始まる原稿は、最初の h3 を最初の節として扱う（h2 だけを境にすると全章が導入ありになる）
  assert.equal(chapterHasIntro("# SM-A. 題\n\n### A.0 最初の項\n\n本文"), false);
  assert.equal(chapterHasIntro("# SM-B. 題\n\n導入の文\n\n### B.1 最初の項\n\n本文"), true);
  // 見るのは最初の節より前だけ。節が複数あっても、最初の節より後の本文は導入ではない
  assert.equal(chapterHasIntro("# 題\n\n導入\n\n## 節\n\n本文\n\n## 次の節"), true);
  assert.equal(chapterHasIntro("# 題\n\n## 節\n\n本文\n\n導入のように見える文\n\n## 次の節"), false);

  // 目次に「導入」を置くか。見出しが 1 つも無い章は、導入の本文が空でも置く（章の最初へ移る入口を残す）
  assert.equal(readerShowsIntro({ hasIntro: true }, 3), true);
  assert.equal(readerShowsIntro({ hasIntro: false }, 3), false);
  assert.equal(readerShowsIntro({ hasIntro: false }, 0), true);
  assert.equal(readerShowsIntro({ hasIntro: true }, 0), true);
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

// 章の扉（ラベルと題）の分け方。新しい形（全角の空白）、古い形（BZM x.y教科書 の接頭辞と ` — `）、該当しない文字
{
  const door = (text: string) => splitChapterHeading(text);
  // 新しい形（BZM_3_0_TEXTBOOK_PLAN.md §2.1a）
  assert.deepEqual(door("第1章　産業創出価値と最上段の式"), { label: "第1章", title: "産業創出価値と最上段の式" });
  assert.deepEqual(door("序章　このモデルは何を測るのか"), { label: "序章", title: "このモデルは何を測るのか" });
  assert.deepEqual(door("付録　記号、用語、参考文献"), { label: "付録", title: "記号、用語、参考文献" });
  assert.deepEqual(door("第14章　モデルが表現していないこと、近似、反証条件"), {
    label: "第14章",
    title: "モデルが表現していないこと、近似、反証条件",
  });
  // 古い形（書き直していない章）
  assert.deepEqual(door("BZM 3.0教科書 第2章 — 観測状態と資金の二勘定"), { label: "第2章", title: "観測状態と資金の二勘定" });
  assert.deepEqual(door("BZM 3.0教科書 序 — このモデルは何を測るのか"), { label: "序", title: "このモデルは何を測るのか" });
  assert.deepEqual(door("BZM 3.0教科書 付録 — 記号一覧、用語、参考文献"), { label: "付録", title: "記号一覧、用語、参考文献" });
  assert.deepEqual(door("第13章 巨人の肩 — 要件ごとの既存理論"), { label: "第13章", title: "巨人の肩 — 要件ごとの既存理論" }, "題の中のダッシュは触らない");
  // Book A（ラベルのあとが普通の空白）
  assert.deepEqual(door("第5章 生存の静学 — 生存条件式と創業者機能 F_founder-CES"), {
    label: "第5章",
    title: "生存の静学 — 生存条件式と創業者機能 F_founder-CES",
  });
  assert.deepEqual(door("第１章　全角の数字"), { label: "第１章", title: "全角の数字" });
  assert.deepEqual(door("  第3章   前後の空白  "), { label: "第3章", title: "前後の空白" });
  // 該当しない文字は null（分けずにそのまま描く）
  for (const text of [
    "序論 はじめに",
    "序・凡例・記号一覧",
    "第2章の補足",
    "第3章",
    "第3章　",
    "Abstract",
    "1. Introduction",
    "SM-A. Notation and complete model equations",
    "読書案内と索引",
    "BZM 2.2教科書 I — 八層の状態と行動の制約",
    "BZM批判的基礎講座",
    "",
  ]) {
    assert.equal(door(text), null, JSON.stringify(text));
  }
}

// 節・項の番号の分け方。`1.1` `1.1.1` `A.2` `0.1.1`、古い形の `1.`、番号でない文字
{
  const num = (text: string) => splitSectionNumber(text);
  assert.deepEqual(num("1.1 産業創出価値とは何か"), { number: "1.1", title: "産業創出価値とは何か" });
  assert.deepEqual(num("1.1.1 国内で数える理由"), { number: "1.1.1", title: "国内で数える理由" });
  assert.deepEqual(num("0.1 はじめに"), { number: "0.1", title: "はじめに" });
  assert.deepEqual(num("0.1.1 序章の項"), { number: "0.1.1", title: "序章の項" });
  assert.deepEqual(num("A.2 記号の定義"), { number: "A.2", title: "記号の定義" });
  assert.deepEqual(num("A.1.2 付録の項"), { number: "A.1.2", title: "付録の項" });
  assert.deepEqual(num("10.12.3 桁の多い番号"), { number: "10.12.3", title: "桁の多い番号" });
  assert.deepEqual(num("1.1　全角の空白"), { number: "1.1", title: "全角の空白" });
  assert.deepEqual(num("1.1. 末尾にドット"), { number: "1.1.", title: "末尾にドット" });
  // 古い形（書き直していない章）。節は `1.`、項は番号なし
  assert.deepEqual(num("1. スコアが答える問い"), { number: "1.", title: "スコアが答える問い" });
  assert.deepEqual(num("2.1 The measurement problem"), { number: "2.1", title: "The measurement problem" });
  // 番号ではない文字は null
  for (const text of ["内側の平均", "1.5倍の根拠", "2024年の動向", "3D 設計", "1.1", "1.1  ", "A. Smith の議論", "§1.1 節", ""]) {
    assert.equal(num(text), null, JSON.stringify(text));
  }
  // 見出しの href（別の章の見出しへ移る URL）。先読みの鍵（# を含まない URL）とは別
  assert.equal(readerHeadingHref("bzm30-textbook", "bzm-3-0-textbook-parameters", "h-0639ddce"), "/bzm/read/bzm30-textbook/bzm-3-0-textbook-parameters#h-0639ddce");
  assert.equal(readerHeadingHref("p1-paper", "a b", "x y"), "/bzm/read/p1-paper/a%20b#x%20y");
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
  assert.equal(bzm30.chapters[0].plannedTitle, "序章　このモデルは何を測るのか");
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
      { slug: "c1", title: "1", exists: true, charCount: 400, hasIntro: true },
      { slug: "c2", title: "2", exists: false, charCount: 0, hasIntro: false },
      { slug: "c3", title: "3", exists: true, charCount: 600, hasIntro: false },
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
      assert.equal(content.chapter.hasIntro, false, `${manifest.id}/${chapter.slug}: 未執筆の章に導入がある`);
      assert.ok(content.chapter.title.length > 0);
      unwritten += 1;
    }
  }
  console.log(`  未執筆の章: ${unwritten} 件が exists=false で返る`);

  // 目次が持つ全章の見出し（bookHeadings）: 書けている章をすべて持ち、未執筆の章は持たない。
  // 各章の見出しは、その章を単独で読んだときの headings と一致する。どの章（未執筆の章を含む）にも同じ内容が付く
  {
    let chaptersChecked = 0;
    let headingsTotal = 0;
    for (const manifest of READER_LIBRARY) {
      const book = getReaderBook(manifest.id);
      assert.ok(book, manifest.id);
      const written = book.chapters.filter((c) => c.exists).map((c) => c.slug);
      assert.ok(written.length > 0, `${manifest.id}: 書けている章が無い`);
      const first = getReaderChapterContent(manifest.id, written[0]);
      assert.ok(first, manifest.id);
      assert.deepEqual(
        Object.keys(first.bookHeadings).sort(),
        [...written].sort(),
        `${manifest.id}: bookHeadings のキーが書けている章と一致しない`,
      );
      for (const chapter of book.chapters) {
        const content = getReaderChapterContent(manifest.id, chapter.slug);
        assert.ok(content, `${manifest.id}/${chapter.slug}`);
        assert.deepEqual(content.bookHeadings, first.bookHeadings, `${manifest.id}/${chapter.slug}: 章ごとに bookHeadings が違う`);
        if (!chapter.exists) {
          assert.equal(chapter.slug in content.bookHeadings, false, `${manifest.id}/${chapter.slug}: 未執筆の章が bookHeadings にある`);
          continue;
        }
        assert.deepEqual(
          first.bookHeadings[chapter.slug],
          content.headings,
          `${manifest.id}/${chapter.slug}: bookHeadings の見出しが、その章の headings と違う`,
        );
        chaptersChecked += 1;
        headingsTotal += content.headings.length;
      }
    }
    soft(chaptersChecked >= 40, `bookHeadings を突き合わせた章が少ない: ${chaptersChecked}`);
    soft(headingsTotal >= 800, `bookHeadings を突き合わせた見出しが少ない: ${headingsTotal}`);
    console.log(`  bookHeadings: ${chaptersChecked} 章、見出し ${headingsTotal} 件が、各章の headings と一致`);
  }

  // 章の最初の文章（hasIntro）: load.ts が、前処理後の本文から章ごとに求める。
  // 目次は、これが true の章の見出しの一覧の先頭に「導入」を置き、章の行は見出しを開閉するだけにする
  {
    const bzm30 = getReaderBook("bzm30-textbook");
    assert.ok(bzm30);
    // BZM 3.0教科書の序章と第1章は、扉の導入の段落があるので導入ありになる
    for (const slug of ["bzm-3-0-textbook-introduction", "bzm-3-0-textbook-industrial-value"]) {
      const content = getReaderChapterContent("bzm30-textbook", slug);
      assert.ok(content && content.chapter.exists, `${slug}: 章が無い`);
      assert.equal(content.chapter.hasIntro, true, `${slug}: 章の題と最初の節のあいだに本文があるのに、導入なしになっている`);
      assert.equal(bzm30.chapters[content.chapterIndex].hasIntro, true, `${slug}: 棚の章の情報（book.chapters）にも導入ありが載る`);
      assert.ok(content.headings.length > 0, `${slug}: 見出しが無い`);
      assert.equal(readerShowsIntro(content.chapter, content.headings.length), true);
    }
    // 全章: 書けている章の hasIntro は、前処理後の本文を chapterHasIntro に通した値と一致する。
    // どの章（どの章のページでも）の book.chapters にも載り、未執筆の章は false
    let withIntro = 0;
    let withoutIntro = 0;
    let headingless = 0;
    for (const manifest of READER_LIBRARY) {
      const book = getReaderBook(manifest.id);
      assert.ok(book, manifest.id);
      for (const chapter of book.chapters) {
        assert.equal(typeof chapter.hasIntro, "boolean", `${manifest.id}/${chapter.slug}: hasIntro が無い`);
        const content = getReaderChapterContent(manifest.id, chapter.slug);
        assert.ok(content, `${manifest.id}/${chapter.slug}`);
        assert.deepEqual(content.book.chapters, book.chapters, `${manifest.id}/${chapter.slug}: 章ごとに book.chapters が違う`);
        if (!chapter.exists) {
          assert.equal(chapter.hasIntro, false, `${manifest.id}/${chapter.slug}: 未執筆の章に導入がある`);
          continue;
        }
        assert.equal(
          chapter.hasIntro,
          chapterHasIntro(content.markdown),
          `${manifest.id}/${chapter.slug}: hasIntro が前処理後の本文の判定と違う`,
        );
        // 書けている章は、目次で必ず 1 項目以上を持つ（導入か見出し）。見出しが 1 つも無い章（論文の Abstract など）は「導入」だけが出る
        const items = (readerShowsIntro(chapter, content.headings.length) ? 1 : 0) + content.headings.length;
        assert.ok(items >= 1, `${manifest.id}/${chapter.slug}: 目次の項目が 1 つも無く、章の最初へ移る入口が無い`);
        if (content.headings.length === 0) headingless += 1;
        if (chapter.hasIntro) withIntro += 1;
        else withoutIntro += 1;
      }
    }
    // 実原稿の件数は原稿の書き換えで動くので、下限は警告だけにする
    soft(withIntro >= 30, `導入ありの章が少ない: ${withIntro}`);
    soft(withoutIntro >= 5, `導入なしの章が少ない: ${withoutIntro}`);
    // h1 の直後に節が来る章（補足資料 SM-A は、h1 の後がすぐ h3 の項）は、導入なしになる
    const smA = getReaderBook("p1-supplement")?.chapters.find((c) => c.slug === "sm-a");
    if (smA?.exists) soft(smA.hasIntro === false, "SM-A は h1 のすぐ後が最初の項なので導入なしの前提が崩れた");
    console.log(`  導入: 導入あり ${withIntro} 章、なし ${withoutIntro} 章（見出しの無い章 ${headingless} 章）`);
  }

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

  // 章の扉と節番号の描画。新しい形（`第1章　題`、`## 1.1 題`）と古い形（`BZM 3.0教科書 第2章 — 題`、`## 1. 題`、番号なしの項）
  {
    const idOf = (html: string, tag: string, nth = 0) => [...html.matchAll(new RegExp(`<${tag} id="([^"]+)"`, "g"))][nth]?.[1];
    const newForm = "# 第1章　産業創出価値と最上段の式\n\n導入の段落。\n\n## 1.1 産業創出価値とは何か\n\n### 1.1.1 国内で数える理由\n\n## 本章のまとめ\n\n### 項";
    const html = render(newForm);
    assert.ok(
      html.includes(
        `<h1 id="${headingAnchorId("第1章　産業創出価値と最上段の式")}" class="bzr-door" data-bzr-block="0"><span class="bzr-door-label">第1章</span> <span class="bzr-door-title">産業創出価値と最上段の式</span></h1>`,
      ),
      html,
    );
    assert.ok(html.includes('<span class="bzr-sec-num">1.1</span> 産業創出価値とは何か</h2>'), html);
    assert.ok(html.includes('<span class="bzr-sec-num">1.1.1</span> 国内で数える理由</h3>'), html);
    assert.ok(/<h2 id="[^"]+" data-bzr-block="\d+">本章のまとめ<\/h2>/.test(html), "番号の無い節は分けない");
    assert.ok(/<h3 id="[^"]+" data-bzr-block="\d+">項<\/h3>/.test(html), "番号の無い項は分けない");
    // 見出しの id と、目次の見出しの文字は、分ける前の原稿の文字から作る（分けても変わらない）
    const toc = extractReaderHeadings(newForm, headingAnchorId);
    assert.deepEqual(
      toc.map((h) => h.text),
      ["1.1 産業創出価値とは何か", "1.1.1 国内で数える理由", "本章のまとめ", "項"],
    );
    assert.deepEqual(
      [...html.matchAll(/<h([23]) id="([^"]+)"/g)].map((m) => m[2]),
      toc.map((h) => h.id),
      "番号を分けても、目次の id と描画の id が一致する",
    );
    // 読み上げ用の文字は、ラベルと題の間に空白が残る
    const plain = html.replace(/<[^>]+>/g, "");
    assert.ok(plain.includes("第1章 産業創出価値と最上段の式"), plain);

    // 古い形
    const oldForm = "# BZM 3.0教科書 第2章 — 観測状態と資金の二勘定\n\n導入。\n\n## 1. 題\n\n### 番号の無い項";
    const oldHtml = render(oldForm);
    assert.ok(
      oldHtml.includes('class="bzr-door" data-bzr-block="0"><span class="bzr-door-label">第2章</span> <span class="bzr-door-title">観測状態と資金の二勘定</span></h1>'),
      oldHtml,
    );
    assert.ok(oldHtml.includes('<span class="bzr-sec-num">1.</span> 題</h2>'), oldHtml);
    assert.ok(/<h3 id="[^"]+" data-bzr-block="\d+">番号の無い項<\/h3>/.test(oldHtml));
    assert.ok(render("# BZM 3.0教科書 序 — このモデルは何を測るのか").includes('<span class="bzr-door-label">序</span>'));
    assert.ok(render("# 序章　このモデルは何を測るのか").includes('<span class="bzr-door-label">序章</span>'));
    assert.ok(render("# 付録　記号、用語、参考文献").includes('<span class="bzr-door-label">付録</span>'));
    assert.ok(render("## A.2 記号の定義").includes('<span class="bzr-sec-num">A.2</span> 記号の定義'));
    assert.ok(render("### 0.1.1 序章の項").includes('<span class="bzr-sec-num">0.1.1</span> 序章の項'));

    // 扉にしない h1（論文・補足資料・講座の題、ラベルの後に区切りが無い文字）と、番号にしない h2
    for (const md of ["# Abstract", "# 1. Introduction", "# SM-A. Notation", "# 序論 はじめに", "# 第2章の補足", "# 第3章"]) {
      assert.ok(!render(md).includes("bzr-door"), md);
    }
    assert.ok(!render("## 1.5倍の根拠").includes("bzr-sec-num"));
    assert.ok(!render("## 2024年の動向").includes("bzr-sec-num"));
    assert.ok(render("## 2.1 The measurement problem", "en").includes('<span class="bzr-sec-num">2.1</span> The measurement problem'));

    // `{#id}` つきの章の題は、id をそのまま使い、題から外す
    assert.ok(render("# 第1章　題 {#ch-1}").includes('<h1 id="ch-1" class="bzr-door"'));
    assert.ok(render("# 第1章　題 {#ch-1}").includes('<span class="bzr-door-title">題</span>'));
    assert.equal(idOf(render("## 1.1 題 {#sec-1}"), "h2"), "sec-1");

    // 題の途中に数式やコードがあっても崩れない。先頭が数式やコードの見出しは分けない
    const mixed = render("# 第1章　式 $x_t$ と `code` の題\n\n## 1.1 式 $y_t$ の節\n\n## `code` の節\n\n# 第2章　`code`");
    assert.ok(mixed.includes('<span class="bzr-door-label">第1章</span>'), mixed);
    assert.ok(mixed.includes('<span class="bzr-door-title">式 <span class="bzr-math-inline">'), mixed);
    assert.ok(mixed.includes('<span class="bzr-sec-num">1.1</span> 式 <span class="bzr-math-inline">'), mixed);
    assert.ok(!mixed.includes("katex-error") && !mixed.includes("⟦bzr-math"), mixed);
    assert.equal((mixed.match(/bzr-door-label/g) ?? []).length, 1, "ラベルだけで題が文字列に無い h1 は扉にしない");

    // 実原稿: BZM 3.0教科書の書けている章は、新旧どちらの形でも扉になる（書き直しの途中で扉が欠けない）
    const bzm30 = getReaderBook("bzm30-textbook");
    assert.ok(bzm30);
    let textbookDoors = 0;
    for (const chapter of bzm30.chapters) {
      if (!chapter.exists) continue;
      const content = getReaderChapterContent("bzm30-textbook", chapter.slug);
      assert.ok(content);
      const chapterHtml = render(content.markdown);
      const door = /<h1 id="[^"]+" class="bzr-door" data-bzr-block="\d+"><span class="bzr-door-label">([^<]+)<\/span> <span class="bzr-door-title">([^<]+)/.exec(chapterHtml);
      assert.ok(door, `${chapter.slug}: 章の扉になっていない`);
      assert.match(door[1], /^(序章|序|第\d+章|付録)$/, `${chapter.slug}: ラベル ${door[1]}`);
      assert.ok(!door[2].startsWith("BZM") && !door[2].startsWith("—") && door[2].trim() === door[2], `${chapter.slug}: 題 ${door[2]}`);
      textbookDoors += 1;
    }
    soft(textbookDoors >= 15, `扉になった教科書の章が少ない: ${textbookDoors}`);
    console.log(`  章の扉: BZM 3.0教科書 ${textbookDoors} 章が扉になる`);
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

// ---------------------------------------------------------------------------
// 文字の色と背景の比（白・セピア・黒）。reader.css の変数を読み、文字に使う色（本文 fg、補助 muted、
// 章のラベルと節番号 accent）が、どのテーマも背景との比 4.5:1 以上（WCAG 2.x AA の通常の文字）であること。
// 目次で強調した行（accent を 14% 混ぜた下地）の上の本文の色も同じ基準で確かめる。
// ---------------------------------------------------------------------------
{
  const css = fs.readFileSync(path.resolve(process.cwd(), "src/components/bzm-reader/reader.css"), "utf8");
  type Rgb = [number, number, number];
  const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = ([r, g, b]: Rgb) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const contrast = (a: Rgb, b: Rgb) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (fg: Rgb, bg: Rgb, ratio: number): Rgb => fg.map((c, i) => Math.round(c * ratio + bg[i] * (1 - ratio))) as Rgb;

  const ratios: string[] = [];
  for (const name of ["white", "sepia", "black"] as const) {
    const block = new RegExp(String.raw`\.bzr-root\[data-theme="${name}"\]\s*\{([^}]*)\}`).exec(css);
    assert.ok(block, `${name}: reader.css にテーマの変数の塊が無い`);
    const variable = (key: string): Rgb => {
      const m = new RegExp(String.raw`--bzr-${key}:\s*(#[0-9a-fA-F]{6})\s*;`).exec(block[1]);
      assert.ok(m, `${name}: --bzr-${key} が無い`);
      return toRgb(m[1]);
    };
    const bg = variable("bg");
    for (const key of ["fg", "muted", "accent"]) {
      const ratio = contrast(variable(key), bg);
      assert.ok(ratio >= 4.5, `${name}: --bzr-${key} と背景の比が 4.5:1 に足りない (${ratio.toFixed(2)})`);
      ratios.push(`${name}/${key} ${ratio.toFixed(2)}`);
    }
    const tint = mix(variable("accent"), bg, 0.14);
    const onTint = contrast(variable("fg"), tint);
    assert.ok(onTint >= 4.5, `${name}: 強調した行の下地と本文の色の比が 4.5:1 に足りない (${onTint.toFixed(2)})`);
  }
  console.log(`  文字の色と背景の比（4.5:1 以上）: ${ratios.join("、")}`);
}

console.log("check_bzm_reader: ok");
